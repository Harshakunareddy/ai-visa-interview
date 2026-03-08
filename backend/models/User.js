/**
 * User Model
 * Core user document storing Firebase UID and role
 */
'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firebaseUid: {
        type: String,
        required: [true, 'Firebase UID is required'],
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    displayName: {
        type: String,
        trim: true,
        maxlength: [100, 'Display name cannot exceed 100 characters'],
    },
    photoURL: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLoginAt: {
        type: Date,
        default: Date.now,
    },
    totalInterviews: {
        type: Number,
        default: 0,
    },
    averageScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual: subscription
userSchema.virtual('subscription', {
    ref: 'Subscription',
    localField: '_id',
    foreignField: 'user',
    justOne: true,
});

// Virtual: profile
userSchema.virtual('profile', {
    ref: 'Profile',
    localField: '_id',
    foreignField: 'user',
    justOne: true,
});

// Method: update average score
userSchema.methods.updateAverageScore = async function (newScore) {
    const total = this.totalInterviews;
    this.averageScore = total === 0
        ? newScore
        : Math.round(((this.averageScore * total) + newScore) / (total + 1));
    this.totalInterviews += 1;
    await this.save();
};

module.exports = mongoose.model('User', userSchema);
