/**
 * Razorpay Subscription Service
 */
'use strict';

const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

let razorpayInstance;

const getRazorpay = () => {
    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
};

// Plan amounts in paise (INR)
const PLAN_AMOUNTS = {
    monthly: { amount: 49900, period: 'monthly', interval: 1 }, // ₹499/month
    yearly: { amount: 399900, period: 'yearly', interval: 1 }, // ₹3999/year
};

/**
 * Create Razorpay order for one-time payment style
 */
const createOrder = async (plan, userId) => {
    const rz = getRazorpay();
    const config = PLAN_AMOUNTS[plan];
    if (!config) throw ErrorResponse.badRequest('Invalid plan selected');

    const order = await rz.orders.create({
        amount: config.amount,
        currency: 'INR',
        receipt: `rcpt_${userId}_${Date.now()}`,
        notes: { userId: userId.toString(), plan },
    });

    return order;
};

/**
 * Create Razorpay subscription (recurring)
 */
const createSubscription = async (plan, userId) => {
    const rz = getRazorpay();
    const planId = plan === 'monthly'
        ? process.env.RAZORPAY_MONTHLY_PLAN_ID
        : process.env.RAZORPAY_YEARLY_PLAN_ID;

    if (!planId) throw ErrorResponse.serverError('Plan ID not configured');

    const subscription = await rz.subscriptions.create({
        plan_id: planId,
        total_count: plan === 'yearly' ? 1 : 12,
        quantity: 1,
        notes: { userId: userId.toString(), plan },
    });

    return subscription;
};

/**
 * Verify Razorpay payment signature
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return expected === signature;
};

/**
 * Verify webhook signature
 */
const verifyWebhookSignature = (body, signature) => {
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    return expected === signature;
};

/**
 * Activate subscription after payment
 */
const activateSubscription = async (userId, plan, paymentData) => {
    const planData = Subscription.getPlanFeatures(plan);
    const now = new Date();
    const end = plan === 'yearly'
        ? new Date(now.setFullYear(now.getFullYear() + 1))
        : new Date(now.setMonth(now.getMonth() + 1));

    const sub = await Subscription.findOneAndUpdate(
        { user: userId },
        {
            plan,
            status: 'active',
            razorpayPaymentId: paymentData.paymentId,
            razorpaySubscriptionId: paymentData.subscriptionId || null,
            currentPeriodStart: new Date(),
            currentPeriodEnd: end,
            interviewsLimit: planData.interviewsLimit,
            features: planData.features,
        },
        { new: true, upsert: true }
    );

    logger.info(`Subscription activated: ${plan} for user ${userId}`);
    return sub;
};

/**
 * Handle Razorpay webhook events
 */
const handleWebhook = async (event, payload) => {
    logger.info(`Razorpay webhook: ${event}`);

    switch (event) {
        case 'payment.captured': {
            const payment = payload.payment.entity;
            const userId = payment.notes?.userId;
            const plan = payment.notes?.plan;
            if (userId && plan) {
                await activateSubscription(userId, plan, { paymentId: payment.id });
            }
            break;
        }
        case 'subscription.activated': {
            const sub = payload.subscription.entity;
            const userId = sub.notes?.userId;
            const plan = sub.notes?.plan;
            if (userId && plan) {
                await activateSubscription(userId, plan, {
                    paymentId: sub.charge_at,
                    subscriptionId: sub.id,
                });
            }
            break;
        }
        case 'subscription.cancelled':
        case 'subscription.expired': {
            const sub = payload.subscription.entity;
            await Subscription.findOneAndUpdate(
                { razorpaySubscriptionId: sub.id },
                { status: event.includes('cancelled') ? 'cancelled' : 'expired' }
            );
            break;
        }
        case 'payment.failed': {
            logger.warn(`Payment failed: ${JSON.stringify(payload.payment?.entity?.error_description)}`);
            break;
        }
    }
};

module.exports = { createOrder, createSubscription, verifyPaymentSignature, verifyWebhookSignature, activateSubscription, handleWebhook };
