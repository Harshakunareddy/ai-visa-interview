/**
 * AppConfig Model
 * Stores ALL application secrets and credentials in MongoDB.
 * Only MONGODB_URI stays in .env — everything else lives here.
 */
'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

// ── Encryption helpers (AES-256-GCM) ─────────────────────────────────────────
const ALGO = 'aes-256-gcm';
const ENC_KEY = (process.env.CONFIG_ENCRYPTION_KEY || 'embassy_ai_default_encryption_key_32b').padEnd(32).substring(0, 32);

function encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, Buffer.from(ENC_KEY), iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(text) {
    if (!text || !text.includes(':')) return text;
    try {
        const [ivHex, tagHex, encrypted] = text.split(':');
        const decipher = crypto.createDecipheriv(ALGO, Buffer.from(ENC_KEY), Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (_) { return text; }
}

// ── Encrypted field type ──────────────────────────────────────────────────────
const EncryptedString = {
    type: String,
    get: (v) => decrypt(v),
    set: (v) => (v ? encrypt(v) : ''),
    default: '',
};

// ── Schema ────────────────────────────────────────────────────────────────────
const appConfigSchema = new mongoose.Schema({
    // Singleton key — only one config document
    key: { type: String, default: 'main', unique: true },

    // ── App ──────────────────────────────────────────────────────────────────
    app: {
        nodeEnv: { type: String, default: 'development' },
        port: { type: String, default: '5000' },
        appUrl: { type: String, default: 'http://localhost:5000' },
        sessionSecret: EncryptedString,
        paywallEnabled: { type: Boolean, default: true }, // Default to restricted in production mindset
        unlimitedAccess: { type: Boolean, default: false }, // Manual override for unlimited
        behavioralFeaturesEnabled: { type: Boolean, default: true }, // Eye tracking + Calmness
    },


    // ── Firebase Admin (server-side) ─────────────────────────────────────────
    firebase: {
        projectId: { type: String, default: '' },
        clientEmail: { type: String, default: '' },
        privateKey: EncryptedString,
        // Client-side config
        apiKey: { type: String, default: '' },
        authDomain: { type: String, default: '' },
        storageBucket: { type: String, default: '' },
        messagingSenderId: { type: String, default: '' },
        appId: { type: String, default: '' },
    },

    // ── Razorpay ──────────────────────────────────────────────────────────────
    razorpay: {
        keyId: { type: String, default: '' },
        keySecret: EncryptedString,
        webhookSecret: EncryptedString,
        monthlyPlanId: { type: String, default: '' },
        yearlyPlanId: { type: String, default: '' },
    },

    // ── Cloudinary ────────────────────────────────────────────────────────────
    cloudinary: {
        cloudName: { type: String, default: '' },
        apiKey: { type: String, default: '' },
        apiSecret: EncryptedString,
    },

    // ── AI Provider (OpenAI or Groq) ──────────────────────────────────────────
    gemini: {
        openaiApiKey: EncryptedString,  // OpenAI API key (sk-...)
        groqApiKey: EncryptedString,    // Groq API key (gsk_...) — free tier
        provider: { type: String, default: 'openai', enum: ['openai', 'groq'] },
    },

    // ── Company ──────────────────────────────────────────────────────────────
    company: {
        name: { type: String, default: 'AI' },
        description: { type: String, default: 'AI-powered visa interview simulator. Practice with a real embassy-style AI officer and boost your approval chances.' },
        contactEmail: { type: String, default: 'support@ai.com' },
        contactPhone: { type: String, default: '+1 (555) 000-0000' },
        address: { type: String, default: '123 AI Way, Tech City, TC 10101' },
        aboutContent: { type: String, default: 'We are a team of AI enthusiasts dedicated to helping people ace their visa interviews.' },
        privacyPolicy: { type: String, default: 'Your privacy is important to us. We do not sell your data.' },
        termsOfService: { type: String, default: 'By using our service, you agree to our terms and conditions.' },
        legalNotice: { type: String, default: 'AI is a simulation tool and does not guarantee visa approval.' },
    },

    // ── Setup Access ──────────────────────────────────────────────────────────
    setup: {
        adminToken: EncryptedString,   // hashed access token for setup page
        isConfigured: { type: Boolean, default: false },
        lastUpdatedBy: { type: String, default: '' },
        lastUpdatedAt: { type: Date, default: null },
        configuredSections: {
            app: { type: Boolean, default: false },
            firebase: { type: Boolean, default: false },
            razorpay: { type: Boolean, default: false },
            cloudinary: { type: Boolean, default: false },
            gemini: { type: Boolean, default: false },
            company: { type: Boolean, default: false },
        },
    },
}, {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
});

// ── Virtual: completionPercentage ────────────────────────────────────────────
appConfigSchema.virtual('completionPercentage').get(function () {
    const secs = this.setup?.configuredSections || {};
    const done = Object.values(secs).filter(Boolean).length;
    return Math.round((done / 6) * 100);
});

// ── Static: getConfig ─────────────────────────────────────────────────────────
appConfigSchema.statics.getConfig = async function () {
    let cfg = await this.findOne({ key: 'main' });
    if (!cfg) {
        // Generate a random admin token for first-time access
        const adminToken = crypto.randomBytes(24).toString('hex');
        cfg = await this.create({
            key: 'main',
            'setup.adminToken': adminToken,
        });
        console.log('\n🔑 FIRST-TIME SETUP TOKEN (save this!):');
        console.log(`   ${adminToken}`);
        console.log(`   Visit: http://localhost:${process.env.PORT || 5000}/setup?token=${adminToken}\n`);
    }
    return cfg;
};

// ── Static: applyToEnv ───────────────────────────────────────────────────────
// Pushes decrypted values into process.env so the rest of the app can use them
appConfigSchema.statics.applyToEnv = async function () {
    const cfg = await this.getConfig();
    const d = cfg.toObject({ getters: true });

    // App
    if (d.app?.sessionSecret) process.env.SESSION_SECRET = d.app.sessionSecret;
    if (d.app?.appUrl) process.env.APP_URL = d.app.appUrl;
    if (d.app?.port) process.env.PORT = d.app.port;
    process.env.PAYWALL_ENABLED = d.app?.paywallEnabled === true ? 'true' : 'false';
    process.env.UNLIMITED_ACCESS = d.app?.unlimitedAccess === true ? 'true' : 'false';
    process.env.BEHAVIORAL_FEATURES_ENABLED = d.app?.behavioralFeaturesEnabled === true ? 'true' : 'false';


    // Firebase Admin
    if (d.firebase?.projectId) process.env.FIREBASE_PROJECT_ID = d.firebase.projectId;
    if (d.firebase?.clientEmail) process.env.FIREBASE_CLIENT_EMAIL = d.firebase.clientEmail;
    if (d.firebase?.privateKey) process.env.FIREBASE_PRIVATE_KEY = d.firebase.privateKey;

    // Firebase Client
    if (d.firebase?.apiKey) process.env.FIREBASE_API_KEY = d.firebase.apiKey;
    if (d.firebase?.authDomain) process.env.FIREBASE_AUTH_DOMAIN = d.firebase.authDomain;
    if (d.firebase?.storageBucket) process.env.FIREBASE_STORAGE_BUCKET = d.firebase.storageBucket;
    if (d.firebase?.messagingSenderId) process.env.FIREBASE_MESSAGING_SENDER_ID = d.firebase.messagingSenderId;
    if (d.firebase?.appId) process.env.FIREBASE_APP_ID = d.firebase.appId;

    // Razorpay
    if (d.razorpay?.keyId) process.env.RAZORPAY_KEY_ID = d.razorpay.keyId;
    if (d.razorpay?.keySecret) process.env.RAZORPAY_KEY_SECRET = d.razorpay.keySecret;
    if (d.razorpay?.webhookSecret) process.env.RAZORPAY_WEBHOOK_SECRET = d.razorpay.webhookSecret;
    if (d.razorpay?.monthlyPlanId) process.env.RAZORPAY_MONTHLY_PLAN_ID = d.razorpay.monthlyPlanId;
    if (d.razorpay?.yearlyPlanId) process.env.RAZORPAY_YEARLY_PLAN_ID = d.razorpay.yearlyPlanId;

    // Cloudinary
    if (d.cloudinary?.cloudName) process.env.CLOUDINARY_CLOUD_NAME = d.cloudinary.cloudName;
    if (d.cloudinary?.apiKey) process.env.CLOUDINARY_API_KEY = d.cloudinary.apiKey;
    if (d.cloudinary?.apiSecret) process.env.CLOUDINARY_API_SECRET = d.cloudinary.apiSecret;

    // AI Provider
    if (d.gemini?.openaiApiKey) process.env.OPENAI_API_KEY = d.gemini.openaiApiKey;
    if (d.gemini?.groqApiKey) process.env.GROQ_API_KEY = d.gemini.groqApiKey;
    
    // Only set AI_PROVIDER from DB if it was explicitly configured, 
    // otherwise respect what was in process.env already (from Render/Docker)
    if (d.setup?.configuredSections?.gemini && d.gemini?.provider) {
        process.env.AI_PROVIDER = d.gemini.provider;
    }


    // Company
    if (d.company?.name) process.env.COMPANY_NAME = d.company.name;
    if (d.company?.description) process.env.COMPANY_DESCRIPTION = d.company.description;
    if (d.company?.contactEmail) process.env.COMPANY_EMAIL = d.company.contactEmail;
    if (d.company?.contactPhone) process.env.COMPANY_PHONE = d.company.contactPhone;

    return cfg;
};

module.exports = mongoose.model('AppConfig', appConfigSchema);
