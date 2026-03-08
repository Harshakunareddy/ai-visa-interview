/**
 * Demo Routes
 */
'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/demoController');
const interviewCtrl = require('../controllers/interviewController');

// Public Demo Routes (No Auth)
router.get('/', ctrl.demoSetup);
router.post('/create', ctrl.createDemoSession);
router.get('/room/:sessionId', ctrl.demoRoom);
router.get('/results/:sessionId', ctrl.demoResults);

// We also need the API routes for answering questions, but without auth
// We can either bypass auth in apiRoutes or create demo-specific ones.
// To keep it simple, let's create demo-specific API endpoints for the room logic if it uses them.

// Looking at frontend/public/js/interview.js:
// It calls:
// /api/interview/:sessionId/start
// /api/interview/:sessionId/answer
// /api/interview/:sessionId/end

// We should provide these without auth for the demo user if they are on a demo session.

module.exports = router;
