/**
 * Page Controller — Landing and static pages
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');

const landingPage = asyncHandler(async (req, res) => {
    if (req.session?.user) return res.redirect('/dashboard');
    res.render('pages/landing', {
        title: 'AI — AI Visa Interview Simulator',
        page: 'landing',
        layout: 'layouts/main',
    });
});

const aboutPage = (req, res) => {
    res.render('pages/about', {
        title: 'About — AI',
        page: 'about',
        layout: 'layouts/main',
        content: res.locals.company?.aboutContent || 'We are a team of AI enthusiasts dedicated to helping people ace their visa interviews.'
    });
};

const pricingPublicPage = (req, res) => {
    if (req.session?.user) return res.redirect('/subscription');
    res.render('pages/pricing', {
        title: 'Pricing — AI',
        page: 'pricing',
        layout: 'layouts/main',
        razorpayKey: process.env.RAZORPAY_KEY_ID,
    });
};

const privacyPage = (req, res) => {
    res.render('pages/legal', {
        title: 'Privacy Policy — AI',
        page: 'privacy',
        layout: 'layouts/main',
        legalTitle: 'Privacy Policy',
        content: res.locals.company?.privacyPolicy || 'Privacy policy coming soon.'
    });
};

const termsPage = (req, res) => {
    res.render('pages/legal', {
        title: 'Terms of Service — AI',
        page: 'terms',
        layout: 'layouts/main',
        legalTitle: 'Terms of Service',
        content: res.locals.company?.termsOfService || 'Terms of service coming soon.'
    });
};

module.exports = { landingPage, aboutPage, pricingPublicPage, privacyPage, termsPage };
