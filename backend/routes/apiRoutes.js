'use strict';
const express = require('express');
const router = express.Router();
const { protect, requireSubscription, demoSession } = require('../middlewares/auth');
const interviewCtrl = require('../controllers/interviewController');
const subCtrl = require('../controllers/subscriptionController');
const profileCtrl = require('../controllers/profileController');

// Interview API
router.post('/interview/create', demoSession, requireSubscription(), interviewCtrl.createSession);
router.post('/interview/:sessionId/start', demoSession, interviewCtrl.startSession);
router.post('/interview/:sessionId/answer', demoSession, interviewCtrl.submitAnswer);
router.post('/interview/:sessionId/end', demoSession, interviewCtrl.endSession);
router.get('/interview/history', demoSession, interviewCtrl.getHistory);


// Subscription API
router.post('/subscription/create-order', protect, subCtrl.createOrder);
router.post('/subscription/verify-payment', protect, subCtrl.verifyPayment);
router.get('/subscription/status', protect, subCtrl.getStatus);

// Profile API
router.put('/profile', protect, profileCtrl.updateProfile);
router.post('/profile/photo', protect, ...profileCtrl.uploadPhoto);
router.post('/profile/resume', protect, ...profileCtrl.uploadResume);

module.exports = router;
