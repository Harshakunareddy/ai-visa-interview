/**
 * MediaFile Model
 */
'use strict';

const mongoose = require('mongoose');

const mediaFileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InterviewSession',
        default: null,
    },
    type: {
        type: String,
        enum: ['video', 'audio', 'screenshot', 'document'],
        required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, default: 'auto' },
    originalName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // for video/audio
    format: { type: String, default: '' },
}, {
    timestamps: true,
});

mediaFileSchema.index({ user: 1, type: 1 });
mediaFileSchema.index({ session: 1 });

module.exports = mongoose.model('MediaFile', mediaFileSchema);
