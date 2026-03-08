/**
 * Profile Controller
 */
'use strict';

const multer = require('multer');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const User = require('../models/User');
const uploadService = require('../services/uploadService');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Only JPG, PNG, WebP images and PDF files are allowed'), false);
    },
});

/**
 * GET /profile
 */
const profilePage = asyncHandler(async (req, res) => {
    const [profile, resume, user] = await Promise.all([
        Profile.findOne({ user: req.user._id }),
        Resume.findOne({ user: req.user._id, isActive: true }),
        User.findById(req.user._id),
    ]);
    res.render('profile/index', {
        title: 'Profile — AI',
        page: 'profile',
        layout: 'layouts/dashboard',
        profile: profile || {},
        resume: resume || null,
        user,
    });
});

/**
 * PUT /api/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
    const allowed = [
        'firstName', 'lastName', 'phone', 'dateOfBirth', 'nationality',
        'passportNumber', 'passportExpiry', 'targetCountry', 'visaType', 'bio',
        'preferredLanguage', 'timezone', 'interviewReminders',
    ];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        updates,
        { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, message: 'Profile updated', data: profile });
});

/**
 * POST /api/profile/photo
 */
const uploadPhoto = asyncHandler(async (req, res, next) => {
    if (!req.file) return next(ErrorResponse.badRequest('No file uploaded'));
    const result = await uploadService.uploadProfilePhoto(req.file.buffer, req.user._id);

    await Profile.findOneAndUpdate(
        { user: req.user._id },
        { profilePhoto: result },
        { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Profile photo updated', data: { url: result.url } });
});

/**
 * POST /api/profile/resume
 */
const uploadResume = asyncHandler(async (req, res, next) => {
    if (!req.file) return next(ErrorResponse.badRequest('No file uploaded'));
    if (req.file.mimetype !== 'application/pdf') {
        return next(ErrorResponse.badRequest('Only PDF files allowed for resume'));
    }

    const result = await uploadService.uploadResume(req.file.buffer, req.user._id);

    // Deactivate previous resumes
    await Resume.updateMany({ user: req.user._id }, { isActive: false });

    const resume = await Resume.create({
        user: req.user._id,
        originalName: req.file.originalname,
        url: result.url,
        publicId: result.publicId,
        fileSize: result.fileSize,
        fileType: req.file.mimetype,
        isActive: true,
    });

    res.status(201).json({ success: true, message: 'Resume uploaded', data: resume });
});

module.exports = {
    profilePage,
    updateProfile,
    uploadPhoto: [upload.single('photo'), uploadPhoto],
    uploadResume: [upload.single('resume'), uploadResume],
};
