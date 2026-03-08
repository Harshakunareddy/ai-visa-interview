/**
 * MongoDB Database Connection
 * Uses Google DNS (8.8.8.8) to resolve SRV records — fixes querySrv ECONNREFUSED
 * on systems where the local DNS resolver doesn't support SRV queries.
 */
'use strict';

// ── DNS Override — MUST be before any mongoose import ──────────────────────
// Forces Node.js to use Google DNS instead of the local resolver.
// This fixes: "querySrv ECONNREFUSED _mongodb._tcp.*" with Atlas +srv URIs.
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    logger.info('✅ MongoDB reconnected');
});

module.exports = connectDB;
