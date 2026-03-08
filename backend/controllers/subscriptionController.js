/**
 * Subscription Controller
 */
'use strict';

const subscriptionService = require('../services/subscriptionService');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');

/**
 * GET /subscription — Pricing page
 */
const pricingPage = asyncHandler(async (req, res) => {
    const sub = req.user ? await Subscription.findOne({ user: req.user._id }) : null;
    const upgradeReq = req.query.upgrade === 'true';
    const message = req.query.message || null;

    res.render('dashboard/pricing', {
        title: 'Pricing — AI',
        page: 'pricing',
        layout: req.user ? 'layouts/dashboard' : 'layouts/main',
        currentSub: sub,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
        upgradeReq,
        message
    });
});

/**
 * POST /api/subscription/create-order
 */
const createOrder = asyncHandler(async (req, res, next) => {
    const { plan } = req.body;
    if (!['monthly', 'yearly'].includes(plan)) {
        return next(ErrorResponse.badRequest('Invalid plan. Choose monthly or yearly'));
    }
    const order = await subscriptionService.createOrder(plan, req.user._id);
    res.status(200).json({
        success: true,
        message: 'Order created',
        data: { orderId: order.id, amount: order.amount, currency: order.currency, plan },
    });
});

/**
 * POST /api/subscription/verify-payment
 */
const verifyPayment = asyncHandler(async (req, res, next) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const isValid = subscriptionService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
    });

    if (!isValid) {
        return next(ErrorResponse.badRequest('Payment verification failed. Invalid signature.', 'PAYMENT_INVALID'));
    }

    const sub = await subscriptionService.activateSubscription(req.user._id, plan, {
        paymentId: razorpay_payment_id,
    });

    // Update session
    req.session.subscription = {
        plan: sub.plan,
        status: sub.status,
        features: sub.features,
    };

    res.status(200).json({
        success: true,
        message: `${plan} subscription activated successfully!`,
        data: { plan: sub.plan, status: sub.status },
    });
});

/**
 * GET /api/subscription/status
 */
const getStatus = asyncHandler(async (req, res) => {
    const sub = await Subscription.findOne({ user: req.user._id });
    res.status(200).json({
        success: true,
        message: 'Subscription status',
        data: sub || null,
    });
});

module.exports = { pricingPage, createOrder, verifyPayment, getStatus };
