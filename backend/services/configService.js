/**
 * Config Service
 * Loads config from MongoDB and applies it to process.env at startup.
 * Provides a live-reload method for after UI updates.
 */
'use strict';

const logger = require('../utils/logger');

let _cachedConfig = null;

/**
 * Bootstrap: load config from DB and inject into process.env
 * Called once at server startup, AFTER MongoDB connects.
 */
const bootstrapConfig = async () => {
    try {
        // Lazy-require to avoid circular deps (mongoose must be connected first)
        const AppConfig = require('../models/AppConfig');
        const cfg = await AppConfig.applyToEnv();
        _cachedConfig = cfg;
        logger.info('✅ App config loaded from MongoDB');

        // Re-initialize services that depend on config
        await reinitializeServices();
        return cfg;
    } catch (err) {
        logger.warn(`⚠️  Config bootstrap warning: ${err.message} — falling back to .env values`);
        return null;
    }
};

/**
 * Reload config from DB after a UI update (called by setup controller on save)
 */
const reloadConfig = async () => {
    try {
        const AppConfig = require('../models/AppConfig');
        const cfg = await AppConfig.applyToEnv();
        _cachedConfig = cfg;
        await reinitializeServices();
        logger.info('🔄 App config reloaded from MongoDB');
        return cfg;
    } catch (err) {
        logger.error(`Config reload error: ${err.message}`);
        throw err;
    }
};

/**
 * Re-initialize third-party services after config changes
 */
/**
 * Re-initialize third-party services after config changes
 */
const reinitializeServices = async () => {
    // Re-configure Cloudinary
    try {
        if (process.env.CLOUDINARY_CLOUD_NAME) {
            const cloudinary = require('../config/cloudinary');
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true,
            });
            logger.info('🔄 Cloudinary reconfigured with new values');
        }
    } catch (_) { }

    // Re-initialize Firebase Admin
    try {
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
            const { reinitializeFirebase } = require('../config/firebase');
            await reinitializeFirebase(); // Await the async deletion/init
            logger.info('🔄 Firebase Admin SDK re-initialized with new values');
        }
    } catch (_) { }
};

/**
 * Get cached config object
 */
const getConfig = () => _cachedConfig;

/**
 * Get a specific section from cached config
 */
const getSection = (section) => {
    if (!_cachedConfig) return {};
    return _cachedConfig[section] || {};
};

module.exports = { bootstrapConfig, reloadConfig, getConfig, getSection };
