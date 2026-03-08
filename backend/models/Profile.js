/**
 * Profile Model
 */
'use strict';

const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    nationality: { type: String, trim: true },
    passportNumber: { type: String, trim: true },
    passportExpiry: { type: Date },
    targetCountry: {
        type: String,
        enum: ['USA', 'Canada', 'UK', 'Australia', 'Germany'],
        default: 'USA',
    },
    visaType: {
        type: String,
        enum: ['Student', 'Tourist', 'Work', 'Business', 'Family'],
        default: 'Student',
    },
    travelHistory: [{ country: String, year: Number, duration: String }],
    education: [{
        institution: String,
        degree: String,
        field: String,
        year: Number,
    }],
    employment: [{
        company: String,
        position: String,
        startDate: Date,
        endDate: Date,
        current: Boolean,
    }],
    bio: { type: String, maxlength: 500 },
    profilePhoto: {
        url: { type: String, default: null },
        publicId: { type: String, default: null },
    },
    preferredLanguage: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    interviewReminders: { type: Boolean, default: true },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Profile', profileSchema);
