/**
 * Winston Logger
 */
'use strict';

const { createLogger, format, transports } = require('winston');
const path = require('path');

const { combine, timestamp, colorize, printf, errors } = format;

const consoleFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        consoleFormat,
    ),
    transports: [
        new transports.Console({
            format: combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
        }),
    ],
    exceptionHandlers: [
        new transports.Console(),
    ],
});

module.exports = logger;
