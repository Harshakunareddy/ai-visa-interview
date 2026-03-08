/**
 * Global Error Handler Middleware
 * Catches all errors, logs them to MongoDB, and renders the right response.
 */
'use strict';

const logger = require('../utils/logger');
const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to console
    if (process.env.NODE_ENV === 'development') {
        logger.error(`${err.message}\n${err.stack}`);
    } else {
        logger.error(err.message);
    }

    // ── Mongoose bad ObjectId ────────────────────────────────────────────────
    if (err.name === 'CastError') {
        error = ErrorResponse.notFound('Resource');
    }

    // ── Mongoose duplicate key ───────────────────────────────────────────────
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        error = ErrorResponse.conflict(message, 'DUPLICATE_FIELD');
    }

    // ── Mongoose validation error ────────────────────────────────────────────
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        error = ErrorResponse.badRequest(messages.join(', '), 'VALIDATION_ERROR');
    }

    // ── JWT errors ───────────────────────────────────────────────────────────
    if (err.name === 'JsonWebTokenError') {
        error = ErrorResponse.unauthorized('Invalid token', 'INVALID_TOKEN');
    }
    if (err.name === 'TokenExpiredError') {
        error = ErrorResponse.unauthorized('Token expired', 'TOKEN_EXPIRED');
    }

    // ── Firebase auth errors ─────────────────────────────────────────────────
    if (err.code === 'auth/id-token-expired') {
        error = ErrorResponse.unauthorized('Firebase token expired', 'FIREBASE_TOKEN_EXPIRED');
    }
    if (err.code === 'auth/argument-error') {
        error = ErrorResponse.unauthorized('Invalid Firebase token', 'FIREBASE_TOKEN_INVALID');
    }

    const statusCode = error.statusCode || err.statusCode || 500;
    const isApiRoute = req.path.startsWith('/api') || req.xhr ||
        (req.headers.accept && req.headers.accept.includes('application/json'));

    // ── Async: log error to MongoDB (fire-and-forget, don't block response) ──
    setImmediate(async () => {
        try {
            const ErrorLog = require('../models/ErrorLog');
            const { file, line, column } = ErrorLog.parseStack(err.stack);

            await ErrorLog.create({
                message: error.message || err.message || 'Unknown error',
                errorCode: error.errorCode || 'SERVER_ERROR',
                statusCode,
                errorType: err.name || 'Error',
                file,
                line,
                column,
                stackTrace: (err.stack || '').substring(0, 3000), // cap at 3000 chars
                method: req.method,
                url: req.originalUrl,
                ip: req.ip || req.connection?.remoteAddress || '',
                userAgent: req.headers['user-agent'] || '',
                referer: req.headers['referer'] || '',
                body: ErrorLog.sanitizeBody(req.body),
                userId: req.session?.user?._id || null,
                userEmail: req.session?.user?.email || null,
            });
        } catch (logErr) {
            logger.warn(`⚠️ Could not save error log to DB: ${logErr.message}`);
        }
    });

    // ── Payment Required / Upgrade needed ───────────────────────────────────
    if (statusCode === 402 && !isApiRoute) {
        return res.redirect('/subscription?upgrade=true&message=' + encodeURIComponent(error.message));
    }

    // ── API response ─────────────────────────────────────────────────────────
    if (isApiRoute) {
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Server Error',
            errorCode: error.errorCode || 'SERVER_ERROR',
            data: error.data || null,
        });
    }

    // ── Browser: render standalone error page ────────────────────────────────
    const userMessage = process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'An unexpected error occurred. Our team has been notified.'
        : (error.message || 'Something went wrong');

    // To change back to the premium error page, replace 'pages/error_demo' with 'pages/error' below
    res.status(statusCode).render('pages/error_demo', {
        title: statusCode === 404 ? '404 — Not Found' : 'Something Went Wrong',
        statusCode,
        message: userMessage,
        layout: false,
    });

};

module.exports = errorHandler;
