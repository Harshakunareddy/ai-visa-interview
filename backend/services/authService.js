/**
 * Auth Service — Firebase token handling & user sync
 */
'use strict';

const { getFirebaseAdmin } = require('../config/firebase');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Subscription = require('../models/Subscription');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * Verify Firebase ID token and return decoded claims
 */
const verifyFirebaseToken = async (idToken) => {
    const admin = getFirebaseAdmin();
    return await admin.auth().verifyIdToken(idToken, true);
};

/**
 * Find or create user from Firebase token
 */
const findOrCreateUser = async (decoded) => {
    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
        user = await User.create({
            firebaseUid: decoded.uid,
            email: decoded.email,
            displayName: decoded.name || decoded.email.split('@')[0],
            photoURL: decoded.picture || null,
            lastLoginAt: new Date(),
        });
        logger.info(`New user created: ${user.email}`);

        // Create default profile
        await Profile.create({ user: user._id });

        // Create free subscription
        const planData = Subscription.getPlanFeatures('free');
        await Subscription.create({
            user: user._id,
            plan: 'free',
            status: 'active',
            features: planData.features,
            interviewsLimit: planData.interviewsLimit,
        });

        logger.info(`Free subscription created for: ${user.email}`);
    } else {
        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    }

    return user;
};

/**
 * Get user subscription status for session
 */
const getUserSubscription = async (userId) => {
    return await Subscription.findOne({ user: userId });
};

/**
 * Logout — clear session and cookie
 */
const logout = async (req, res) => {
    req.session.destroy();
    res.clearCookie('firebaseToken');
};

module.exports = { verifyFirebaseToken, findOrCreateUser, getUserSubscription, logout };
