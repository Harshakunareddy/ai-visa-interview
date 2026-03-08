/**
 * Dashboard Controller
 */
'use strict';

const InterviewSession = require('../models/InterviewSession');
const Subscription = require('../models/Subscription');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /dashboard
 */
const dashboardHome = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [sub, profile, recentSessions, stats] = await Promise.all([
        Subscription.findOne({ user: userId }),
        Profile.findOne({ user: userId }),
        InterviewSession.find({ user: userId, status: 'completed' })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('sessionId targetCountry visaType scores decision createdAt duration'),
        InterviewSession.aggregate([
            { $match: { user: userId, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    avgScore: { $avg: '$scores.overall' },
                    avgApproval: { $avg: '$decision.approvalProbability' },
                    avgConfidence: { $avg: '$scores.confidence' },
                    avgCommunication: { $avg: '$scores.communication' },
                    totalInterviews: { $sum: 1 },
                    countryDistribution: { $push: '$targetCountry' },
                }
            },
        ]),
    ]);

    const analyticsData = stats[0] || {
        avgScore: 0, avgApproval: 0, avgConfidence: 0, avgCommunication: 0,
        totalInterviews: 0, countryDistribution: [],
    };

    // Score timeline for chart
    const timeline = await InterviewSession.find({ user: userId, status: 'completed' })
        .sort({ createdAt: 1 })
        .limit(10)
        .select('scores.overall decision.approvalProbability createdAt');

    res.render('dashboard/index', {
        title: 'Dashboard — AI',
        page: 'dashboard',
        layout: 'layouts/dashboard',
        profile,
        sub,
        recentSessions,
        analytics: analyticsData,
        timeline: timeline.map(t => ({
            date: t.createdAt.toLocaleDateString(),
            score: Math.round(t.scores?.overall || 0),
            approval: Math.round(t.decision?.approvalProbability || 0),
        })),
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false',
    });

});

/**
 * GET /dashboard/analytics
 */
const analyticsPage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const mongoose = require('mongoose');
    const objectId = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    const sessions = await InterviewSession.find({ user: userId, status: 'completed' })
        .sort({ createdAt: 1 })
        .select('sessionId targetCountry visaType scores decision createdAt duration');

    const countryMap = {};
    sessions.forEach(s => {
        countryMap[s.targetCountry] = (countryMap[s.targetCountry] || 0) + 1;
    });

    const verdictMap = {};
    sessions.forEach(s => {
        const v = (s.decision && s.decision.verdict) ? s.decision.verdict : 'Pending';
        verdictMap[v] = (verdictMap[v] || 0) + 1;
    });

    // Build chart data safely without optional chaining (for EJS compat)
    const chartDataArr = sessions.map(function (s) {
        var sc = s.scores || {};
        var dec = s.decision || {};
        return {
            date: s.createdAt.toLocaleDateString(),
            overall: Math.round(sc.overall || 0),
            confidence: Math.round(sc.confidence || 0),
            communication: Math.round(sc.communication || 0),
            approval: Math.round(dec.approvalProbability || 0),
        };
    });

    res.render('dashboard/analytics', {
        title: 'Analytics — AI',
        page: 'analytics',
        layout: 'layouts/dashboard',
        sessions,
        countryMap: JSON.stringify(countryMap),
        verdictMap: JSON.stringify(verdictMap),
        chartData: JSON.stringify(chartDataArr),
        totalSessions: sessions.length,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false',
    });

});

module.exports = { dashboardHome, analyticsPage };
