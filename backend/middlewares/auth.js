/**
 * Firebase Auth Middleware
 * Verifies Firebase ID tokens from cookies or Authorization header
 */
'use strict';

const { getFirebaseAdmin } = require('../config/firebase');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

/**
 * Protect routes — verifies Firebase token and attaches user to req
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Try session first
    if (req.session?.firebaseToken) {
        token = req.session.firebaseToken;
    }
    // 2. Try Authorization header
    else if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 3. Try cookie
    else if (req.cookies?.firebaseToken) {
        token = req.cookies.firebaseToken;
    }

    if (!token) {
        if (req.path.startsWith('/api')) {
            return next(ErrorResponse.unauthorized('Please log in to access this resource', 'NO_TOKEN'));
        }
        return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    try {
        const admin = getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(token, true);

        // Find or sync user in DB
        let user = await User.findOne({ firebaseUid: decoded.uid });
        if (!user) {
            user = await User.create({
                firebaseUid: decoded.uid,
                email: decoded.email,
                displayName: decoded.name || decoded.email.split('@')[0],
                photoURL: decoded.picture || null,
                lastLoginAt: new Date(),
            });
            // Create free subscription
            const planData = Subscription.getPlanFeatures('free');
            await Subscription.create({
                user: user._id,
                plan: 'free',
                status: 'active',
                features: planData.features,
                interviewsLimit: planData.interviewsLimit,
            });
        } else {
            await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
        }

        // Attach to request
        req.user = user;
        req.token = token;
        req.session.user = {
            _id: user._id.toString(),
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: user.role,
        };
        next();
    } catch (err) {
        logger.warn(`Auth middleware error: ${err.message}`);
        req.session.destroy(() => { });
        if (req.path.startsWith('/api')) {
            return next(ErrorResponse.unauthorized('Token invalid or expired', 'TOKEN_INVALID'));
        }
        res.clearCookie('firebaseToken');
        return res.redirect('/auth/login?error=session_expired');
    }
});

/**
 * Authorize by role
 */
const authorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return next(ErrorResponse.forbidden('You do not have permission to perform this action'));
    }
    next();
};

/**
 * Optional auth — attaches user if token present but doesn't block
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
    const token = req.session?.firebaseToken || req.cookies?.firebaseToken;
    if (!token) return next();

    try {
        const admin = getFirebaseAdmin();
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = await User.findOne({ firebaseUid: decoded.uid });
    } catch (_) { /* ignore */ }
    next();
});

/**
 * Subscription guard — ensures user has active subscription
 */
const requireSubscription = (...plans) => asyncHandler(async (req, res, next) => {
    if (!req.user) {
        return next(ErrorResponse.unauthorized());
    }

    const sub = await Subscription.findOne({ user: req.user._id });
    if (!sub) {
        return next(ErrorResponse.paymentRequired('No subscription found'));
    }

    // Check plan restriction
    if (plans.length && !plans.includes(sub.plan)) {
        return next(ErrorResponse.paymentRequired(
            `This feature requires ${plans.join(' or ')} subscription`, 'PLAN_UPGRADE_REQUIRED'
        ));
    }

    // Check activity
    if (sub.plan !== 'free') {
        if (sub.status !== 'active') {
            return next(ErrorResponse.paymentRequired('Your subscription is not active', 'SUBSCRIPTION_INACTIVE'));
        }
        if (sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
            await Subscription.findByIdAndUpdate(sub._id, { status: 'expired' });
            return next(ErrorResponse.paymentRequired('Your subscription has expired', 'SUBSCRIPTION_EXPIRED'));
        }
    }

    // Check interview limit for free plan — bypass if UNLIMITED_ACCESS is ON
    const unlimitedAccess = process.env.UNLIMITED_ACCESS === 'true';
    if (!unlimitedAccess && sub.plan === 'free' && sub.interviewsUsed >= sub.interviewsLimit) {
        return next(ErrorResponse.paymentRequired(
            'Free trial interview used. Please upgrade to continue.', 'FREE_LIMIT_REACHED'
        ));
    }

    req.subscription = sub;
    req.session.subscription = {
        plan: sub.plan,
        status: sub.status,
        features: sub.features,
        remainingInterviews: (unlimitedAccess || sub.features.unlimitedInterviews)
            ? 999 : Math.max(0, sub.interviewsLimit - sub.interviewsUsed),
    };
    next();
});

/**
 * Demo Session Bypass — Allows access if isDemo flag is set in session
 */
const demoSession = asyncHandler(async (req, res, next) => {
    if (req.session?.isDemo) {
        const demoUser = await User.findOne({ email: 'demo@guest.com' });
        if (demoUser) {
            req.user = demoUser;
            return next();
        }
    }
    protect(req, res, next);
});

module.exports = { protect, authorize, optionalAuth, requireSubscription, demoSession };

