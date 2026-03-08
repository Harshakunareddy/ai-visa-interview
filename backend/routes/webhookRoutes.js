'use strict';
const express = require('express');
const router = express.Router();
const { handleWebhook, verifyWebhookSignature } = require('../services/subscriptionService');
const logger = require('../utils/logger');

// Razorpay webhook — raw body required (mounted BEFORE body parser in server.js)
router.post('/razorpay',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        const signature = req.headers['x-razorpay-signature'];
        const body = req.body;

        try {
            const isValid = verifyWebhookSignature(body, signature);
            if (!isValid) {
                logger.warn('Invalid Razorpay webhook signature');
                return res.status(400).json({ success: false, message: 'Invalid signature' });
            }

            const payload = JSON.parse(body.toString());
            const event = payload.event;
            await handleWebhook(event, payload);

            res.status(200).json({ success: true });
        } catch (err) {
            logger.error(`Webhook error: ${err.message}`);
            res.status(500).json({ success: false });
        }
    }
);

module.exports = router;
