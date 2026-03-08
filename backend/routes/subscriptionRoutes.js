'use strict';
const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middlewares/auth');
const { pricingPage, createOrder, verifyPayment, getStatus } = require('../controllers/subscriptionController');

router.get('/', optionalAuth, pricingPage);
router.post('/create-order', protect, createOrder);
router.post('/verify-payment', protect, verifyPayment);
router.get('/status', protect, getStatus);

module.exports = router;
