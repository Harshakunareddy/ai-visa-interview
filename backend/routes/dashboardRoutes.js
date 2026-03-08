'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { dashboardHome, analyticsPage } = require('../controllers/dashboardController');

router.use(protect);
router.get('/', dashboardHome);
router.get('/analytics', analyticsPage);

module.exports = router;
