'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const ctrl = require('../controllers/profileController');

router.use(protect);
router.get('/', ctrl.profilePage);
router.put('/', ctrl.updateProfile);
router.post('/photo', ...ctrl.uploadPhoto);
router.post('/resume', ...ctrl.uploadResume);

// Also expose under /api/profile
module.exports = router;
