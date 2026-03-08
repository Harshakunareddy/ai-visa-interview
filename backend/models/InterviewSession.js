/**
 * InterviewSession Model
 */
'use strict';

const mongoose = require('mongoose');

const interviewSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    targetCountry: {
        type: String,
        enum: ['USA', 'Canada', 'UK', 'Australia', 'Germany'],
        required: true,
    },
    visaType: {
        type: String,
        enum: ['Student', 'Tourist', 'Work', 'Business', 'Family'],
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'completed', 'abandoned'],
        default: 'pending',
    },
    duration: { type: Number, default: 0 }, // in seconds
    plannedDuration: { type: Number, default: 300 }, // 5 minutes
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    questionCount: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },

    // Scores (0–100)
    scores: {
        overall: { type: Number, default: 0 },
        confidence: { type: Number, default: 0 },
        communication: { type: Number, default: 0 },
        consistency: { type: Number, default: 0 },
        eyeContact: { type: Number, default: 0 },
        nervousness: { type: Number, default: 0 }, // lower = better
    },

    // AI Embassy Decision
    decision: {
        approvalProbability: { type: Number, default: 0 },
        verdict: {
            type: String,
            enum: ['Strong Approval', 'Likely Approved', 'Borderline', 'Likely Rejected', 'Strong Rejection', 'Pending'],
            default: 'Pending',
        },
        riskFlags: [String],
        suspicionIndicators: [String],
        strengths: [String],
        improvements: [String],
        officerNotes: { type: String, default: '' },
    },

    // Media
    videoRecording: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
        duration: { type: Number, default: 0 },
    },

    // Realtime AI context (last N messages for follow-up)
    conversationContext: [{
        role: { type: String, enum: ['user', 'model'] },
        content: String,
        timestamp: { type: Date, default: Date.now },
    }],

    // Eye tracking aggregate
    eyeContactData: {
        totalFrames: { type: Number, default: 0 },
        lookingAtCamera: { type: Number, default: 0 },
        blinkCount: { type: Number, default: 0 },
        avgGazeScore: { type: Number, default: 0 },
    },

    // Nervousness aggregate
    nervousnessData: {
        avgHeadMotion: { type: Number, default: 0 },
        speechPauses: { type: Number, default: 0 },
        hesitations: { type: Number, default: 0 },
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual: answers
interviewSessionSchema.virtual('answers', {
    ref: 'InterviewAnswer',
    localField: '_id',
    foreignField: 'session',
});

// Index for analytics queries
interviewSessionSchema.index({ user: 1, createdAt: -1 });
interviewSessionSchema.index({ status: 1 });

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
