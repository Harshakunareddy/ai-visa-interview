/**
 * Centralized Error Response class
 * All API errors use this standard structure
 */
'use strict';

class ErrorResponse extends Error {
    /**
     * @param {string} message  - Human-readable error message
     * @param {number} statusCode - HTTP status code
     * @param {string} errorCode  - Machine-readable error code
     * @param {any}    data       - Additional error context
     */
    constructor(message, statusCode = 500, errorCode = 'SERVER_ERROR', data = null) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.data = data;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Returns standardized JSON response object
     */
    toJSON() {
        return {
            success: false,
            message: this.message,
            errorCode: this.errorCode,
            data: this.data,
        };
    }
}

// Common error factories
ErrorResponse.badRequest = (msg, code = 'BAD_REQUEST', data = null) =>
    new ErrorResponse(msg, 400, code, data);

ErrorResponse.unauthorized = (msg = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new ErrorResponse(msg, 401, code);

ErrorResponse.forbidden = (msg = 'Forbidden', code = 'FORBIDDEN') =>
    new ErrorResponse(msg, 403, code);

ErrorResponse.notFound = (resource = 'Resource') =>
    new ErrorResponse(`${resource} not found`, 404, 'NOT_FOUND');

ErrorResponse.conflict = (msg, code = 'CONFLICT') =>
    new ErrorResponse(msg, 409, code);

ErrorResponse.paymentRequired = (msg = 'Subscription required', code = 'PAYMENT_REQUIRED') =>
    new ErrorResponse(msg, 402, code);

ErrorResponse.tooManyRequests = (msg = 'Too many requests', code = 'RATE_LIMIT') =>
    new ErrorResponse(msg, 429, code);

ErrorResponse.serverError = (msg = 'Internal server error', code = 'SERVER_ERROR') =>
    new ErrorResponse(msg, 500, code);

module.exports = ErrorResponse;
