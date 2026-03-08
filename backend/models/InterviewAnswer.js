/**
 * InterviewAnswer Model
 */
'use strict';

const mongoose = require('mongoose');

const interviewAnswerSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InterviewSession',
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    questionIndex: { type: Number, required: true },
    question: { type: String, required: true, trim: true },
    questionType: {
        type: String,
        enum: ['opening', 'purpose', 'financial', 'ties', 'travel', 'education', 'work', 'followup', 'closing'],
        default: 'purpose',
    },
    answer: { type: String, trim: true, default: '' },
    answerAudio: { type: String, default: null }, // Cloudinary URL
    duration: { type: Number, default: 0 },   // seconds taken to answer
    wordCount: { type: Number, default: 0 },
    pauseCount: { type: Number, default: 0 },
    hesitationWords: [String], // um, uh, err, etc.
    // AI evaluation per answer
    evaluation: {
        relevance: { type: Number, default: 0, min: 0, max: 10 },
        credibility: { type: Number, default: 0, min: 0, max: 10 },
        clarity: { type: Number, default: 0, min: 0, max: 10 },
        consistency: { type: Number, default: 0, min: 0, max: 10 },
        flags: [String],
        aiComment: { type: String, default: '' },
    },
    timestamp: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

interviewAnswerSchema.index({ session: 1, questionIndex: 1 });

module.exports = mongoose.model('InterviewAnswer', interviewAnswerSchema);
