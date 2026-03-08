/**
 * Error Log Controller
 * Admin-only routes for viewing and managing error logs.
 * Protected by the same setup token as /setup.
 */
'use strict';

const ErrorLog = require('../models/ErrorLog');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /setup/errors
 * Render the error dashboard UI
 */
const errorDashboard = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 50;
    const skip = (page - 1) * limit;

    // Filters
    const filter = {};
    if (req.query.status) filter.statusCode = parseInt(req.query.status);
    if (req.query.resolved) filter.resolved = req.query.resolved === 'true';
    if (req.query.search) {
        const re = new RegExp(req.query.search, 'i');
        filter.$or = [{ message: re }, { url: re }, { file: re }, { userEmail: re }];
    }
    if (req.query.since) {
        filter.timestamp = { $gte: new Date(req.query.since) };
    }

    const [logs, total, stats] = await Promise.all([
        ErrorLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        ErrorLog.countDocuments(filter),
        // Aggregated stats
        ErrorLog.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    errors5xx: { $sum: { $cond: [{ $gte: ['$statusCode', 500] }, 1, 0] } },
                    errors4xx: { $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 400] }, { $lt: ['$statusCode', 500] }] }, 1, 0] } },
                    resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
                    last24h: { $sum: { $cond: [{ $gte: ['$timestamp', new Date(Date.now() - 86400000)] }, 1, 0] } },
                    last1h: { $sum: { $cond: [{ $gte: ['$timestamp', new Date(Date.now() - 3600000)] }, 1, 0] } },
                },
            },
        ]),
    ]);

    // Timeline: error counts by hour for the last 24h
    const hourlyTimeline = await ErrorLog.aggregate([
        { $match: { timestamp: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } } },
        {
            $group: {
                _id: {
                    hour: { $hour: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' },
                },
                count: { $sum: 1 },
                errors5xx: { $sum: { $cond: [{ $gte: ['$statusCode', 500] }, 1, 0] } },
            },
        },
        { $sort: { '_id.day': 1, '_id.hour': 1 } },
    ]);

    // Most common errors
    const topErrors = await ErrorLog.aggregate([
        { $group: { _id: '$message', count: { $sum: 1 }, lastSeen: { $max: '$timestamp' }, statusCode: { $first: '$statusCode' } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
    ]);

    const s = stats[0] || { total: 0, errors5xx: 0, errors4xx: 0, resolved: 0, last24h: 0, last1h: 0 };

    return res.render('setup/errors', {
        title: '🔴 Error Logs — AI',
        layout: false,
        logs,
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        stats: s,
        topErrors,
        hourlyTimeline,
        filters: req.query,
    });
});

/**
 * GET /setup/errors/api
 * Raw JSON endpoint — returns errors as paginated JSON
 */
const errorLogsApi = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.statusCode = parseInt(req.query.status);
    if (req.query.resolved !== undefined) filter.resolved = req.query.resolved === 'true';
    if (req.query.search) {
        const re = new RegExp(req.query.search, 'i');
        filter.$or = [{ message: re }, { url: re }, { file: re }];
    }
    if (req.query.since) filter.timestamp = { $gte: new Date(req.query.since) };

    const [logs, total] = await Promise.all([
        ErrorLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        ErrorLog.countDocuments(filter),
    ]);

    return res.json({
        success: true,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: logs,
    });
});

/**
 * PATCH /setup/errors/:id/resolve
 * Mark an error as resolved with an optional note
 */
const resolveError = asyncHandler(async (req, res) => {
    const log = await ErrorLog.findByIdAndUpdate(
        req.params.id,
        {
            resolved: true,
            resolvedAt: new Date(),
            resolvedNote: req.body.note || '',
        },
        { new: true }
    );
    if (!log) return res.status(404).json({ success: false, message: 'Error log not found' });
    return res.json({ success: true, data: log });
});

/**
 * DELETE /setup/errors/clear
 * Clear all resolved errors (or all if ?all=true)
 */
const clearErrors = asyncHandler(async (req, res) => {
    const filter = req.query.all === 'true' ? {} : { resolved: true };
    const result = await ErrorLog.deleteMany(filter);
    return res.json({ success: true, deleted: result.deletedCount });
});

module.exports = { errorDashboard, errorLogsApi, resolveError, clearErrors };
