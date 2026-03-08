/**
 * Interview Controller
 */
'use strict';

const interviewService = require('../services/interviewService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * GET /interview — Setup page
 */
const setupPage = asyncHandler(async (req, res) => {
    const Subscription = require('../models/Subscription');
    const sub = await Subscription.findOne({ user: req.user._id });

    // Check if user is paywall-blocked
    const paywallEnabled = process.env.PAYWALL_ENABLED === 'true';
    const unlimitedAccess = process.env.UNLIMITED_ACCESS === 'true';
    
    const paywallBlocked = paywallEnabled
        && !unlimitedAccess
        && sub
        && sub.plan === 'free'
        && sub.interviewsUsed >= sub.interviewsLimit;

    res.render('interview/setup', {
        title: 'Start Interview — AI',
        page: 'interview',
        pageCSS: 'interview.css',
        pageJS: 'setup.js',
        layout: 'layouts/dashboard',
        sub,
        paywallBlocked: !!paywallBlocked,
        interviewsUsed: sub ? sub.interviewsUsed : 0,
        interviewsLimit: sub ? sub.interviewsLimit : 1,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false',
    });

});

/**
 * POST /api/interview/create
 */
const createSession = asyncHandler(async (req, res, next) => {
    const { targetCountry, visaType } = req.body;
    if (!targetCountry || !visaType) {
        return next(ErrorResponse.badRequest('Country and visa type are required'));
    }
    const session = await interviewService.createSession(req.user._id, { targetCountry, visaType });
    res.status(201).json({
        success: true,
        message: 'Interview session created',
        data: { sessionId: session.sessionId, targetCountry, visaType },
    });
});

/**
 * GET /interview/:sessionId — Interview room
 */
const interviewRoom = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    const { session } = await interviewService.getSessionDetails(sessionId, req.user._id);
    if (session.status === 'completed') {
        return res.redirect(`/interview/${sessionId}/results`);
    }
    res.render('interview/room', {
        title: `Interview — ${session.targetCountry} ${session.visaType} Visa`,
        page: 'interview-room',
        layout: 'layouts/interview',
        session: JSON.stringify({ 
            sessionId: session.sessionId, 
            targetCountry: session.targetCountry, 
            visaType: session.visaType,
            behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false'
        }),
        sub: req.session?.subscription,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false',
    });

});

/**
 * POST /api/interview/:sessionId/start
 */
const startSession = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    const result = await interviewService.startSession(sessionId, req.user._id);
    res.status(200).json({
        success: true,
        message: 'Interview started',
        data: { question: result.question, questionIndex: 0 },
    });
});

/**
 * POST /api/interview/:sessionId/answer
 */
const submitAnswer = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    const { answer, questionIndex, behavioralData } = req.body;
    if (answer === undefined || questionIndex === undefined) {
        return next(ErrorResponse.badRequest('Answer and question index are required'));
    }
    const result = await interviewService.submitAnswer(sessionId, req.user._id, {
        answer, questionIndex, behavioralData,
    });
    res.status(200).json({ success: true, message: 'Answer submitted', data: result });
});

/**
 * POST /api/interview/:sessionId/end
 */
const endSession = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    const { session, answers } = await interviewService.getSessionDetails(sessionId, req.user._id);
    if (session.status === 'completed') {
        return res.status(200).json({ success: true, data: { sessionId, scores: session.scores, decision: session.decision } });
    }
    const profile = null;
    const result = await interviewService.endSession(session, req.user._id, profile, null);
    res.status(200).json({ success: true, message: 'Interview completed', data: result });
});

/**
 * GET /interview/:sessionId/results
 */
const resultsPage = asyncHandler(async (req, res, next) => {
    const { sessionId } = req.params;
    const { session, answers } = await interviewService.getSessionDetails(sessionId, req.user._id);
    if (session.status !== 'completed') {
        return res.redirect(`/interview/${sessionId}`);
    }
    res.render('interview/results', {
        title: 'Interview Results — AI',
        page: 'interview-results',
        layout: 'layouts/dashboard',
        session,
        answers,
        behavioralFeaturesEnabled: process.env.BEHAVIORAL_FEATURES_ENABLED !== 'false',
    });

});

/**
 * GET /api/interview/history
 */
const getHistory = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const data = await interviewService.getUserInterviews(req.user._id, page, limit);
    res.status(200).json({ success: true, message: 'Interview history', data });
});

module.exports = { setupPage, createSession, interviewRoom, startSession, submitAnswer, endSession, resultsPage, getHistory };
