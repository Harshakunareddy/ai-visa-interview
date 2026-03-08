/**
 * Subscription Model
 */
'use strict';

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    plan: {
        type: String,
        enum: ['free', 'monthly', 'yearly'],
        default: 'free',
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled', 'pending'],
        default: 'active',
    },
    // Razorpay fields
    razorpaySubscriptionId: { type: String, default: null },
    razorpayCustomerId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },

    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: { type: Date, default: null },

    interviewsUsed: { type: Number, default: 0 },
    interviewsLimit: { type: Number, default: 1 }, // free = 1

    features: {
        videoRecording: { type: Boolean, default: false },
        aiEvaluation: { type: Boolean, default: true },
        eyeTracking: { type: Boolean, default: false },
        nervousnessAnalysis: { type: Boolean, default: false },
        resumeUpload: { type: Boolean, default: false },
        advancedAnalytics: { type: Boolean, default: false },
        unlimitedInterviews: { type: Boolean, default: false },
    },

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
}, {
    timestamps: true,
});

// Static: set plan features
subscriptionSchema.statics.getPlanFeatures = function (plan) {
    const plans = {
        free: {
            interviewsLimit: 1,
            features: {
                videoRecording: false, aiEvaluation: true, eyeTracking: false,
                nervousnessAnalysis: false, resumeUpload: false,
                advancedAnalytics: false, unlimitedInterviews: false,
            },
        },
        monthly: {
            interviewsLimit: 30,
            features: {
                videoRecording: true, aiEvaluation: true, eyeTracking: true,
                nervousnessAnalysis: true, resumeUpload: true,
                advancedAnalytics: true, unlimitedInterviews: false,
            },
        },
        yearly: {
            interviewsLimit: 999,
            features: {
                videoRecording: true, aiEvaluation: true, eyeTracking: true,
                nervousnessAnalysis: true, resumeUpload: true,
                advancedAnalytics: true, unlimitedInterviews: true,
            },
        },
    };
    return plans[plan] || plans.free;
};

// Virtual: isActive
subscriptionSchema.virtual('isActive').get(function () {
    if (this.status !== 'active') return false;
    if (this.plan === 'free') return this.interviewsUsed < this.interviewsLimit;
    return this.currentPeriodEnd ? new Date() < this.currentPeriodEnd : true;
});

// Virtual: remainingInterviews
subscriptionSchema.virtual('remainingInterviews').get(function () {
    if (this.features.unlimitedInterviews) return Infinity;
    return Math.max(0, this.interviewsLimit - this.interviewsUsed);
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
