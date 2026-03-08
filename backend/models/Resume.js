/**
 * Resume Model
 */
'use strict';

const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    fileSize: { type: Number, default: 0 }, // bytes
    fileType: { type: String, default: 'application/pdf' },
    isActive: { type: Boolean, default: true },
    parsedText: { type: String, default: '' }, // extracted text for AI context
}, {
    timestamps: true,
});

// Only one active resume per user
resumeSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('Resume', resumeSchema);
