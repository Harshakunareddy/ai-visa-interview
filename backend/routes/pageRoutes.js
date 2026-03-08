'use strict';
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middlewares/auth');
const { landingPage, aboutPage, pricingPublicPage, privacyPage, termsPage } = require('../controllers/pageController');

router.get('/', optionalAuth, landingPage);
router.get('/about', aboutPage);
router.get('/pricing', pricingPublicPage);
router.get('/privacy', privacyPage);
router.get('/terms', termsPage);

module.exports = router;
