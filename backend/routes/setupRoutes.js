'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/setupController');
const errCtrl = require('../controllers/errorLogController');

// Token verification on all setup routes
router.use(ctrl.verifySetupToken);

// Main setup dashboard
router.get('/', ctrl.setupPage);

// Lock page
router.get('/lock', (req, res) => res.render('setup/lock', { title: 'Setup Access Required', layout: false, error: null }));

// Token actions
router.post('/verify-token', ctrl.verifyToken);
router.post('/regenerate-token', ctrl.regenerateToken);

// Section save (AJAX)
router.post('/section/:section', ctrl.saveSection);

// Service connection test (AJAX)
router.get('/test/:service', ctrl.testConnection);

// ── Error Log routes ──────────────────────────────────────────────────────────
router.get('/errors', errCtrl.errorDashboard);   // UI dashboard
router.get('/errors/api', errCtrl.errorLogsApi);      // Raw JSON API
router.patch('/errors/:id/resolve', errCtrl.resolveError); // Mark resolved
router.delete('/errors/clear', errCtrl.clearErrors);       // Clear logs

module.exports = router;
