/**
 * Interview Service
 */
'use strict';

const { v4: uuidv4 } = require('uuid');
const InterviewSession = require('../models/InterviewSession');
const InterviewAnswer = require('../models/InterviewAnswer');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const interviewEngine = require('../ai/interviewEngine');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * Create a new interview session
 */
const createSession = async (userId, { targetCountry, visaType }) => {
    let sub = await Subscription.findOne({ user: userId });
    // Auto-create subscription if missing (safety net)
    if (!sub) {
        sub = await Subscription.create({ user: userId, plan: 'free', interviewsLimit: 1 });
    }

    // Paywall enforcement — controlled via /setup → Application Settings
    const paywallEnabled = process.env.PAYWALL_ENABLED === 'true';
    const unlimitedAccess = process.env.UNLIMITED_ACCESS === 'true';
    
    if (paywallEnabled && !unlimitedAccess && sub.plan === 'free' && sub.interviewsUsed >= sub.interviewsLimit) {
        throw ErrorResponse.paymentRequired('Free interview limit reached. Please upgrade.', 'FREE_LIMIT_REACHED');
    }


    const session = await InterviewSession.create({
        user: userId,
        sessionId: uuidv4(),
        targetCountry,
        visaType,
        status: 'pending',
        plannedDuration: 300,
    });

    return session;
};

/**
 * Start session — generate opening question
 */
const startSession = async (sessionId, userId) => {
    const session = await InterviewSession.findOne({ sessionId, user: userId });
    if (!session) throw ErrorResponse.notFound('Interview session');

    if (session.status === 'completed') {
        throw ErrorResponse.badRequest('This interview is already completed');
    }

    const openingQuestion = await interviewEngine.generateOpeningQuestion(
        session.targetCountry, session.visaType
    );

    session.status = 'active';
    session.startedAt = new Date();
    session.questionCount = 1;
    session.conversationContext = [{
        role: 'model',
        content: openingQuestion,
        timestamp: new Date(),
    }];
    await session.save();

    // Create first answer slot
    await InterviewAnswer.create({
        session: session._id,
        user: userId,
        questionIndex: 0,
        question: openingQuestion,
        questionType: 'opening',
    });

    return { session, question: openingQuestion };
};

/**
 * Submit answer, evaluate, generate next question
 */
const submitAnswer = async (sessionId, userId, { answer, questionIndex, behavioralData }) => {
    const session = await InterviewSession.findOne({ sessionId, user: userId });
    if (!session) throw ErrorResponse.notFound('Interview session');
    if (session.status !== 'active') throw ErrorResponse.badRequest('Session not active');

    const profile = await Profile.findOne({ user: userId });
    const resume = await Resume.findOne({ user: userId, isActive: true });
    const resumeText = resume?.parsedText || '';

    // Update current answer
    const currentAnswer = await InterviewAnswer.findOne({
        session: session._id, questionIndex,
    });

    const hesitationWords = ['um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'literally'];
    const hesitations = hesitationWords.filter(w =>
        answer.toLowerCase().includes(` ${w} `) || answer.toLowerCase().startsWith(`${w} `)
    );

    if (currentAnswer) {
        const evaluation = await interviewEngine.evaluateAnswer(
            currentAnswer.question, answer, session.targetCountry, session.visaType,
            session.conversationContext
        );

        currentAnswer.answer = answer;
        currentAnswer.wordCount = answer.split(/\s+/).filter(Boolean).length;
        currentAnswer.hesitationWords = hesitations;
        currentAnswer.evaluation = evaluation;
        if (behavioralData?.duration) currentAnswer.duration = behavioralData.duration;
        await currentAnswer.save();

        // Update session context
        session.conversationContext.push({ role: 'user', content: answer, timestamp: new Date() });
        session.answeredCount = (session.answeredCount || 0) + 1;
    }

    // Update behavioral/eye data if provided
    if (behavioralData) {
        const count = Math.max(1, session.answeredCount);
        if (behavioralData.eyeContact !== undefined) {
            // Incremental running average
            session.eyeContactData.avgGazeScore =
                Math.round(((session.eyeContactData.avgGazeScore * (count - 1)) + behavioralData.eyeContact) / count);
        }
        if (behavioralData.nervousness !== undefined) {
            session.nervousnessData.avgHeadMotion = behavioralData.nervousness;
        }
        if (behavioralData.blinkRate !== undefined) {
            session.eyeContactData.blinkCount += behavioralData.blinkRate;
        }
        if (behavioralData.pauses !== undefined) {
            session.nervousnessData.speechPauses += behavioralData.pauses;
        }
    }


    // Check if interview should end (8–12 questions or time limit)
    const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000;
    const shouldEnd = session.questionCount >= 10 || elapsed >= session.plannedDuration;

    if (shouldEnd) {
        return await endSession(session, userId, profile, resume);
    }

    // Generate next question
    const nextQuestion = await interviewEngine.generateNextQuestion(
        session.targetCountry, session.visaType, session.conversationContext, profile, resumeText
    );

    session.questionCount += 1;
    session.conversationContext.push({ role: 'model', content: nextQuestion, timestamp: new Date() });
    await session.save();

    // Create next answer slot
    await InterviewAnswer.create({
        session: session._id,
        user: userId,
        questionIndex: session.questionCount - 1,
        question: nextQuestion,
    });

    return {
        question: nextQuestion,
        questionIndex: session.questionCount - 1,
        isComplete: false,
        elapsed: Math.round(elapsed),
        remaining: Math.max(0, session.plannedDuration - elapsed),
    };
};

/**
 * End interview session and generate final report
 */
const endSession = async (session, userId, profile, resume) => {
    const answers = await InterviewAnswer.find({ session: session._id }).sort('questionIndex');

    const finalEval = await interviewEngine.generateFinalEvaluation(session, answers, profile);

    // Calculate scores
    // avgGazeScore is stored as 0-100 (percent), NOT 0-1
    const eyeScore = session.eyeContactData.totalFrames > 0
        ? Math.round((session.eyeContactData.lookingAtCamera / session.eyeContactData.totalFrames) * 100)
        : Math.min(100, Math.round(session.eyeContactData.avgGazeScore || 0));

    session.status = 'completed';
    session.completedAt = new Date();
    session.duration = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    session.scores = {
        overall: finalEval.overallScore || 0,
        confidence: finalEval.confidenceScore || 0,
        communication: finalEval.communicationScore || 0,
        consistency: finalEval.consistencyScore || 0,
        eyeContact: eyeScore || 50,
        nervousness: finalEval.nervousnessScore || 50,
    };
    session.decision = {
        approvalProbability: finalEval.approvalProbability,
        verdict: finalEval.verdict,
        riskFlags: finalEval.riskFlags || [],
        suspicionIndicators: finalEval.suspicionIndicators || [],
        strengths: finalEval.strengths || [],
        improvements: finalEval.improvements || [],
        officerNotes: finalEval.officerNotes || '',
    };
    await session.save();

    // Update user stats
    await User.findByIdAndUpdate(userId, {
        $inc: { totalInterviews: 1 },
    });
    await Subscription.findOneAndUpdate({ user: userId }, { $inc: { interviewsUsed: 1 } });

    return { isComplete: true, sessionId: session.sessionId, scores: session.scores, decision: session.decision };
};

/**
 * Get session with answers
 */
const getSessionDetails = async (sessionId, userId) => {
    const session = await InterviewSession.findOne({ sessionId, user: userId });
    if (!session) throw ErrorResponse.notFound('Interview session');

    const answers = await InterviewAnswer.find({ session: session._id }).sort('questionIndex');
    return { session, answers };
};

/**
 * Get user interview history
 */
const getUserInterviews = async (userId, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const total = await InterviewSession.countDocuments({ user: userId, status: 'completed' });
    const sessions = await InterviewSession
        .find({ user: userId, status: 'completed' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-conversationContext');

    return { sessions, total, pages: Math.ceil(total / limit), page };
};

module.exports = { createSession, startSession, submitAnswer, endSession, getSessionDetails, getUserInterviews };
