/**
 * Demo Controller
 * Minimal auth-free interview flow for client demos
 */
'use strict';

const User = require('../models/User');
const Subscription = require('../models/Subscription');
const interviewService = require('../services/interviewService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Get or create the Demo Guest user
 */
const getDemoUser = async () => {
    let user = await User.findOne({ email: 'demo@guest.com' });
    if (!user) {
        user = await User.create({
            firebaseUid: 'demo-guest-uid',
            email: 'demo@guest.com',
            displayName: 'Demo Guest',
            role: 'user'
        });
    }
    
    // Ensure demo user has a subscription
    let sub = await Subscription.findOne({ user: user._id });
    if (!sub) {
        const features = Subscription.getPlanFeatures('yearly');
        await Subscription.create({
            user: user._id,
            plan: 'yearly', // Yearly has unlimited features
            interviewsLimit: 999,
            interviewsUsed: 0,
            features: features.features
        });
    } else if (sub.plan !== 'yearly') {
        const features = Subscription.getPlanFeatures('yearly');
        sub.plan = 'yearly';
        sub.interviewsLimit = 999;
        sub.features = features.features;
        await sub.save();
    }

    
    return user;
};

/**
 * GET /demo — Simple setup for demo
 */
const demoSetup = asyncHandler(async (req, res) => {
    const user = await getDemoUser();
    req.session.isDemo = true;
    req.session.user = {
        _id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        photoURL: null
    };
    
    res.render('interview/setup', {

        title: 'Demo Interview Mode',
        page: 'interview',
        pageCSS: 'interview.css',
        pageJS: 'setup.js',
        layout: 'layouts/dashboard',
        sub: { plan: 'yearly', interviewsUsed: 0, interviewsLimit: 999 },
        paywallBlocked: false,
        interviewsUsed: 0,
        interviewsLimit: 999,
        isDemo: true,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false'
    });


});



/**
 * POST /demo/create — Create session for demo
 */
const createDemoSession = asyncHandler(async (req, res, next) => {
    const { targetCountry, visaType } = req.body;
    if (!targetCountry || !visaType) {
        return next(ErrorResponse.badRequest('Country and visa type are required'));
    }
    
    const demoUser = await getDemoUser();
    
    // Inject into session so existing services/controllers can find it if needed
    req.user = demoUser;
    req.session.isDemo = true;
    req.session.user = {
        _id: demoUser._id.toString(),
        email: demoUser.email,
        displayName: demoUser.displayName,
        role: demoUser.role
    };
    
    const session = await interviewService.createSession(demoUser._id, { targetCountry, visaType });


    
    res.status(201).json({
        success: true,
        message: 'Demo session created',
        data: { sessionId: session.sessionId, targetCountry, visaType },
    });
});

/**
 * GET /demo/room/:sessionId — Interview room for demo
 */
const demoRoom = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const demoUser = await getDemoUser();
    req.session.isDemo = true;
    req.session.user = {
        _id: demoUser._id.toString(),
        email: demoUser.email,
        displayName: demoUser.displayName,
        role: demoUser.role
    };
    
    const { session } = await interviewService.getSessionDetails(sessionId, demoUser._id);

    
    if (session.status === 'completed') {
        return res.redirect(`/demo/results/${sessionId}`);
    }
    
    res.render('interview/room', {
        title: `Demo Mode — ${session.targetCountry} ${session.visaType} Visa`,
        page: 'interview-room',
        layout: 'layouts/interview',
        session: JSON.stringify({ 
            sessionId: session.sessionId, 
            targetCountry: session.targetCountry, 
            visaType: session.visaType,
            isDemo: true,
            behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false'
        }),
        sub: { plan: 'yearly' },
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false'
    });

});


/**
 * GET /demo/results/:sessionId — Results for demo
 */
const demoResults = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const demoUser = await getDemoUser();
    req.session.isDemo = true;
    req.session.user = {
        _id: demoUser._id.toString(),
        email: demoUser.email,
        displayName: demoUser.displayName,
        role: demoUser.role
    };
    
    const { session, answers } = await interviewService.getSessionDetails(sessionId, demoUser._id);

    
    res.render('interview/results', {
        title: 'Demo Results — AI',
        page: 'interview-results',
        layout: 'layouts/dashboard',
        session,
        answers,
        isDemo: true,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false'
    });
});


module.exports = {
    demoSetup,
    createDemoSession,
    demoRoom,
    demoResults
};
