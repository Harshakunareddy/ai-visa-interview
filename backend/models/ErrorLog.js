/**
 * ErrorLog Model
 * Captures every server error with full context:
 * timestamp, file location, request info, stack trace, user details.
 */
'use strict';

const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
    // ── When ─────────────────────────────────────────────────────────────────
    timestamp: { type: Date, default: Date.now, index: true },

    // ── What happened ────────────────────────────────────────────────────────
    message: { type: String, required: true },
    errorCode: { type: String, default: 'SERVER_ERROR' },
    statusCode: { type: Number, default: 500, index: true },
    errorType: { type: String, default: 'Error' },       // e.g. ValidationError, CastError

    // ── Where (parsed from stack trace) ──────────────────────────────────────
    file: { type: String, default: '' },            // e.g. backend/ai/geminiService.js
    line: { type: String, default: '' },            // e.g. 42
    column: { type: String, default: '' },
    stackTrace: { type: String, default: '' },            // full stack (trimmed)

    // ── Request context ───────────────────────────────────────────────────────
    method: { type: String, default: '' },
    url: { type: String, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    referer: { type: String, default: '' },
    body: { type: mongoose.Schema.Types.Mixed, default: null },  // sanitized

    // ── User context ──────────────────────────────────────────────────────────
    userId: { type: String, default: null },
    userEmail: { type: String, default: null },

    // ── Environment ───────────────────────────────────────────────────────────
    environment: { type: String, default: process.env.NODE_ENV || 'development' },
    nodeVersion: { type: String, default: process.version },

    // ── Resolution ───────────────────────────────────────────────────────────
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
    resolvedNote: { type: String, default: '' },
}, {
    timestamps: false,
    collection: 'error_logs',
});

// ── Indexes ─────────────────────────────────────────────────────────────────
errorLogSchema.index({ timestamp: -1 });
errorLogSchema.index({ statusCode: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1 });

// ── Helper: parse file/line from stack trace ─────────────────────────────────
errorLogSchema.statics.parseStack = function (stack = '') {
    if (!stack) return { file: '', line: '', column: '' };

    // Match lines like:  at funcName (C:\...\file.js:42:10)  or  at file.js:42:10
    const frames = stack.split('\n').filter(l => l.trim().startsWith('at '));
    for (const frame of frames) {
        // Skip node_modules and internal node frames
        if (frame.includes('node_modules') || frame.includes('node:')) continue;

        // Extract path:line:col
        const match = frame.match(/\((.+?):(\d+):(\d+)\)/) ||
            frame.match(/at (.+?):(\d+):(\d+)/);
        if (match) {
            // Normalize path to relative project path
            let filePath = match[1].replace(/\\/g, '/');
            const projectMarker = 'visa_ai/';
            const markerIdx = filePath.indexOf(projectMarker);
            if (markerIdx !== -1) filePath = filePath.slice(markerIdx + projectMarker.length);
            return { file: filePath, line: match[2], column: match[3] };
        }
    }
    return { file: '', line: '', column: '' };
};

// ── Helper: sanitize request body (remove passwords/tokens) ──────────────────
errorLogSchema.statics.sanitizeBody = function (body) {
    if (!body || typeof body !== 'object') return null;
    const sensitive = ['password', 'token', 'secret', 'key', 'apiKey', 'idToken', 'privateKey', 'authorization'];
    const clone = { ...body };
    for (const field of sensitive) {
        if (clone[field]) clone[field] = '[REDACTED]';
    }
    return clone;
};

module.exports = mongoose.model('ErrorLog', errorLogSchema);
