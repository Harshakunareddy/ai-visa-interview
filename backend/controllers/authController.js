/**
 * Auth Controller
 */
'use strict';

const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * POST /auth/verify-token
 * Receives Firebase ID token from frontend, verifies it, creates session
 */
const verifyToken = asyncHandler(async (req, res, next) => {
    const { idToken } = req.body;
    if (!idToken) return next(ErrorResponse.badRequest('Firebase token required', 'NO_TOKEN'));

    const decoded = await authService.verifyFirebaseToken(idToken);
    const user = await authService.findOrCreateUser(decoded);
    const sub = await authService.getUserSubscription(user._id);

    // Store in session
    req.session.firebaseToken = idToken;
    req.session.user = {
        _id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role,
    };
    req.session.subscription = sub ? {
        plan: sub.plan,
        status: sub.status,
        features: sub.features,
        remainingInterviews: sub.features.unlimitedInterviews
            ? 999 : Math.max(0, sub.interviewsLimit - sub.interviewsUsed),
    } : null;

    // HttpOnly cookie
    res.cookie('firebaseToken', idToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    logger.info(`User logged in: ${user.email}`);

    res.status(200).json({
        success: true,
        message: 'Authenticated successfully',
        data: {
            user: req.session.user,
            subscription: req.session.subscription,
            redirect: '/dashboard',
        },
    });
});

/**
 * POST /auth/logout
 */
const logout = asyncHandler(async (req, res) => {
    const email = req.session?.user?.email;
    req.session.destroy((err) => {
        if (err) logger.error(`Session destroy error: ${err.message}`);
    });
    res.clearCookie('firebaseToken');
    res.clearCookie('connect.sid');
    logger.info(`User logged out: ${email}`);
    res.status(200).json({ success: true, message: 'Logged out successfully', data: null });
});

/**
 * GET /auth/me
 * Returns current user from session
 */
const getMe = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Current user',
        data: { user: req.session?.user || null, subscription: req.session?.subscription || null },
    });
});

/**
 * GET /auth/login  — Render login page
 */
const loginPage = (req, res) => {
    if (req.session?.user) return res.redirect('/dashboard');
    res.render('auth/login', {
        title: 'Login — AI',
        page: 'login',
        layout: 'layouts/auth',
        error: req.query.error || null,
        redirect: req.query.redirect || '/dashboard',
    });
};

module.exports = { verifyToken, logout, getMe, loginPage };
