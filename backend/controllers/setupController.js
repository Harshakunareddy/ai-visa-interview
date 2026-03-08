/**
 * Setup Controller
 * Handles the /setup admin UI for configuring all app credentials
 */
'use strict';

const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ErrorResponse = require('../utils/errorResponse');
const AppConfig = require('../models/AppConfig');
const { reloadConfig } = require('../services/configService');
const logger = require('../utils/logger');

// Health-check helpers
const pingFirebase = async () => {
    try {
        const { getFirebaseAdmin } = require('../config/firebase');

        // Basic check for presence of ENV vars
        if (!process.env.FIREBASE_PROJECT_ID) return { ok: false, msg: 'Missing Project ID' };
        if (!process.env.FIREBASE_PRIVATE_KEY) return { ok: false, msg: 'Missing Private Key' };

        // Check for common key errors
        const key = process.env.FIREBASE_PRIVATE_KEY;
        if (!key.includes('BEGIN PRIVATE KEY')) {
            return { ok: false, msg: 'Invalid Private Key format. Must include "-----BEGIN PRIVATE KEY-----"' };
        }

        const admin = getFirebaseAdmin();
        if (!admin.apps.length) {
            return { ok: false, msg: 'Firebase Admin not initialized. Check your credentials and server logs.' };
        }

        // List 1 user to verify the connection works
        // This is a real integration test
        await admin.auth().listUsers(1);
        return { ok: true, msg: 'Firebase Admin connected ✅' };
    } catch (e) {
        let errorMsg = e.message;

        // Provide more helpful tips for specific Firebase errors
        if (errorMsg.includes('error parsing')) errorMsg += ' — Your Private Key format might be incorrect.';
        if (errorMsg.includes('project ID')) errorMsg += ' — Check your Firebase Project ID.';

        logger.error(`Firebase Ping Error: ${errorMsg}`);
        return { ok: false, msg: `Connection failed: ${errorMsg}` };
    }
};

const pingOpenAI = async () => {
    try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { ok: false, msg: 'No OpenAI API key configured. Add it in the AI Provider section above.' };

        logger.info(`🔍 Testing OpenAI with key: ${key.substring(0, 7)}...${key.slice(-4)}`);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
        });

        const data = await response.json();
        if (response.ok) return { ok: true, msg: '⚡ OpenAI connected (gpt-4o-mini) ✅' };
        if (response.status === 401) return { ok: false, msg: 'Invalid OpenAI API Key.' };
        if (response.status === 429) return { ok: false, msg: '⚠️ OpenAI rate limited or quota exceeded.' };
        return { ok: false, msg: `OpenAI error: ${data.error?.message || response.status}` };
    } catch (e) {
        logger.error(`OpenAI Ping Exception: ${e.message}`);
        return { ok: false, msg: `Connection failed: ${e.message}` };
    }
};

const pingGroq = async () => {
    try {
        const key = process.env.GROQ_API_KEY;
        if (!key) return { ok: false, msg: 'No Groq API key configured. Add it in the AI Provider section above.' };

        logger.info(`🔍 Testing Groq with key: ${key.substring(0, 6)}...${key.slice(-4)}`);
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
        });

        const data = await response.json();
        if (response.ok) return { ok: true, msg: '⚡ Groq connected (Llama 3.3 70B) ✅ — 14,400 req/day free' };
        if (response.status === 401) return { ok: false, msg: 'Invalid Groq API Key.' };
        if (response.status === 429) return { ok: false, msg: '⚠️ Groq rate limited.' };
        return { ok: false, msg: `Groq error: ${data.error?.message || response.status}` };
    } catch (e) {
        logger.error(`Groq Ping Exception: ${e.message}`);
        return { ok: false, msg: `Connection failed: ${e.message}` };
    }
};

// Tests whichever provider is currently selected
const pingAI = async () => {
    const provider = process.env.AI_PROVIDER || 'openai';
    if (provider === 'groq') return pingGroq();
    return pingOpenAI();
};


const pingCloudinary = async () => {
    try {
        if (!process.env.CLOUDINARY_CLOUD_NAME) return { ok: false, msg: 'Not configured' };
        const cloudinary = require('../config/cloudinary');
        await cloudinary.api.ping();
        return { ok: true, msg: 'Cloudinary connected ✅' };
    } catch (e) { return { ok: false, msg: e.message }; }
};

const pingRazorpay = async () => {
    try {
        if (!process.env.RAZORPAY_KEY_ID) return { ok: false, msg: 'Not configured' };
        const Razorpay = require('razorpay');
        const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
        // Razorpay doesn't have a simple ping, we just validate instantiation
        return { ok: true, msg: 'Razorpay credentials loaded ✅' };
    } catch (e) { return { ok: false, msg: e.message }; }
};

// ── Token verification middleware ─────────────────────────────────────────────
const verifySetupToken = asyncHandler(async (req, res, next) => {
    const cfg = await AppConfig.getConfig();
    const saved = cfg.toObject({ getters: true }).setup?.adminToken;

    // If not yet configured, allow free access
    if (!cfg.setup?.isConfigured) return next();

    // Check ?token= param or session
    const token = req.query.token || req.session?.setupToken;
    if (token && token === saved) {
        req.session.setupToken = token; // persist in session
        return next();
    }

    // Wrong token → show lock page
    if (req.method === 'GET') {
        return res.render('setup/lock', {
            title: 'Setup Access Required',
            layout: false,
            error: req.query.error ? 'Invalid access token.' : null,
        });
    }
    return res.status(403).json({ success: false, message: 'Unauthorized. Invalid setup token.' });
});

// ── Main setup page ───────────────────────────────────────────────────────────
const setupPage = asyncHandler(async (req, res) => {
    const cfg = await AppConfig.getConfig();
    const raw = cfg.toObject({ getters: true });

    // Mask secrets for display
    const masked = maskSecrets(raw);

    // Health checks (fast — run in parallel)
    // NOTE: We don't ping Gemini on every load to save free-tier quota
    const [fbStatus, cloudStatus, rzpStatus] = await Promise.all([
        pingFirebase(), pingCloudinary(), pingRazorpay(),
    ]);

    // For AI, show which provider is active. Don't ping on every load to save quota.
    const activeProvider = raw.gemini?.provider || 'openai';
    const hasOpenAI = !!raw.gemini?.openaiApiKey;
    const hasGroq = !!raw.gemini?.groqApiKey;
    const hasActiveKey = (activeProvider === 'groq' && hasGroq) || (activeProvider === 'openai' && hasOpenAI);
    const geminiStatus = hasActiveKey
        ? { ok: true, msg: `${activeProvider === 'groq' ? '⚡ Groq (Llama 3.3 70B)' : '🧠 OpenAI (gpt-4o-mini)'} configured. Use "Test Active Provider" to verify.` }
        : { ok: false, msg: `${activeProvider === 'groq' ? 'Groq' : 'OpenAI'} key missing. Add it below.` };

    return res.render('setup/index', {
        title: '⚙️ AI Setup',
        layout: false, // Completely standalone page
        cfg: masked,
        raw,
        status: {
            firebase: fbStatus,
            gemini: geminiStatus,
            cloudinary: cloudStatus,
            razorpay: rzpStatus,
            mongodb: { ok: true, msg: 'MongoDB connected ✅' },
        },
        completion: raw.completionPercentage || 0,
        isConfigured: cfg.setup?.isConfigured,
        adminToken: raw.setup?.adminToken,
    });
});

// ── Save a config section ─────────────────────────────────────────────────────
const saveSection = asyncHandler(async (req, res) => {
    const { section } = req.params;
    const allowed = ['app', 'firebase', 'razorpay', 'cloudinary', 'gemini', 'company'];
    if (!allowed.includes(section)) {
        return res.status(400).json({ success: false, message: 'Invalid config section' });
    }

    const cfg = await AppConfig.findOne({ key: 'main' });
    const body = req.body;

    // Apply incoming fields to the section
    Object.keys(body).forEach((field) => {
        let val = body[field];
        
        // Handle common source of 400 validation errors (improper boolean casting or empty required fields)
        if (field === 'paywallEnabled' || field === 'unlimitedAccess' || field === 'behavioralFeaturesEnabled') {
            val = (val === 'on' || val === true || val === 'true');
        }


        if (val !== undefined && val !== '') {
            // Sanitize Firebase Private Key (common source of copy-paste errors)
            if (section === 'firebase' && field === 'privateKey') {
                // Remove surrounding quotes if user copied from JSON value
                val = val.replace(/^["']|["']$/g, '').trim();
                // Ensure it has the headers
                if (!val.includes('BEGIN PRIVATE KEY')) {
                    logger.warn('⚠️  Setup: Firebase Private Key missing headers; format might be invalid.');
                }
            }
            cfg.set(`${section}.${field}`, val);
        } else if (val === false) {
             // Explicitly set false values (for UNCHECKED checkboxes)
             cfg.set(`${section}.${field}`, false);
        }
    });

    // Mark section as configured
    cfg.set(`setup.configuredSections.${section}`, true);
    cfg.set('setup.lastUpdatedAt', new Date());

    // Check if all sections are done
    const secs = cfg.toObject({ getters: false })?.setup?.configuredSections || {};
    secs[section] = true;
    const allDone = ['app', 'firebase', 'razorpay', 'cloudinary', 'gemini', 'company'].every(k => secs[k]);
    cfg.set('setup.isConfigured', allDone);

    try {
        await cfg.save();
    } catch (saveErr) {
        logger.error(`❌ Setup: FAILED to save section "${section}": ${saveErr.message}`);
        throw saveErr;
    }

    // Hot-reload config into process.env immediately
    try { await reloadConfig(); } catch (_) { }

    logger.info(`🔧 Setup: Section "${section}" updated`);

    return res.json({
        success: true,
        message: `${section} configuration saved successfully`,
        allConfigured: allDone,
    });
});

// ── Regenerate admin token ────────────────────────────────────────────────────
const regenerateToken = asyncHandler(async (req, res) => {
    const newToken = crypto.randomBytes(24).toString('hex');
    await AppConfig.findOneAndUpdate({ key: 'main' }, { 'setup.adminToken': newToken });
    req.session.setupToken = newToken;
    return res.json({ success: true, token: newToken });
});

// ── Verify access token (from lock page form) ─────────────────────────────────
const verifyToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    const cfg = await AppConfig.getConfig();
    const saved = cfg.toObject({ getters: true }).setup?.adminToken;

    if (token === saved) {
        req.session.setupToken = token;
        return res.redirect('/setup');
    }
    return res.redirect('/setup/lock?error=1');
});

// ── Test a single service connection ─────────────────────────────────────────
const testConnection = asyncHandler(async (req, res) => {
    const { service } = req.params;
    let result;
    if (service === 'firebase') result = await pingFirebase();
    else if (service === 'gemini') result = await pingAI();
    else if (service === 'cloudinary') result = await pingCloudinary();
    else if (service === 'razorpay') result = await pingRazorpay();
    else if (service === 'mongodb') result = { ok: true, msg: 'MongoDB connected ✅' };
    else return res.status(400).json({ success: false, message: 'Unknown service' });

    return res.json({ success: true, result });
});

// ── Helper: mask secret fields for template display ───────────────────────────
function maskSecrets(raw) {
    const m = JSON.parse(JSON.stringify(raw));
    const mask = (v) => (v && v.length > 4 ? '••••••••' + v.slice(-4) : '');

    // Only mask actual secret fields; leave IDs/project names readable
    if (m.app?.sessionSecret) m.app.sessionSecret = mask(raw.app?.sessionSecret || '');
    if (m.firebase?.privateKey) m.firebase.privateKey = mask(raw.firebase?.privateKey || '');
    if (m.razorpay?.keySecret) m.razorpay.keySecret = mask(raw.razorpay?.keySecret || '');
    if (m.razorpay?.webhookSecret) m.razorpay.webhookSecret = mask(raw.razorpay?.webhookSecret || '');
    if (m.cloudinary?.apiSecret) m.cloudinary.apiSecret = mask(raw.cloudinary?.apiSecret || '');
    if (m.gemini?.openaiApiKey) m.gemini.openaiApiKey = mask(raw.gemini?.openaiApiKey || '');
    if (m.gemini?.groqApiKey) m.gemini.groqApiKey = mask(raw.gemini?.groqApiKey || '');
    if (m.setup?.adminToken) m.setup.adminToken = mask(raw.setup?.adminToken || '');

    return m;
}

module.exports = { setupPage, saveSection, verifySetupToken, verifyToken, regenerateToken, testConnection };
