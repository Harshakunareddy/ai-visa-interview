'use strict';
const express = require('express');
const router = express.Router();
const { protect, requireSubscription } = require('../middlewares/auth');
const ctrl = require('../controllers/interviewController');

// Pages (protected)
router.get('/', protect, requireSubscription(), ctrl.setupPage);
router.get('/:sessionId', protect, ctrl.interviewRoom);
router.get('/:sessionId/results', protect, ctrl.resultsPage);

module.exports = router;
