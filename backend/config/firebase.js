/**
 * Firebase Admin SDK Initialization
 */
'use strict';

const admin = require('firebase-admin');
const logger = require('../utils/logger');

let firebaseApp;

const initializeFirebase = () => {
    // If already initialized and we don't want to reinit, return existing
    if (admin.apps.length) return admin.app();

    try {
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
            return null;
        }

        const serviceAccount = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        logger.info('✅ Firebase Admin SDK initialized');
        return firebaseApp;
    } catch (error) {
        logger.error(`❌ Firebase initialization error: ${error.message}`);
        return null;
    }
};

const reinitializeFirebase = async () => {
    try {
        if (admin.apps.length) {
            await Promise.all(admin.apps.map(app => app.delete()));
            logger.info('🔄 Previous Firebase app instances deleted for re-initialization');
        }
        return initializeFirebase();
    } catch (error) {
        logger.error(`❌ Firebase re-initialization error: ${error.message}`);
        return null;
    }
};

const getFirebaseAdmin = () => {
    if (!admin.apps.length) initializeFirebase();
    return admin;
};

module.exports = { initializeFirebase, reinitializeFirebase, getFirebaseAdmin };
