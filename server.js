/**
 * EmbassyAI — Production-Grade Express Server
 * Entry Point: server.js
 */

'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB = require('./backend/config/database');
const logger = require('./backend/utils/logger');
const errorHandler = require('./backend/middlewares/errorHandler');
const { notFound } = require('./backend/middlewares/notFound');
const { bootstrapConfig } = require('./backend/services/configService');

// ─── Route Imports ────────────────────────────────────────────────────────────
const pageRoutes = require('./backend/routes/pageRoutes');
const authRoutes = require('./backend/routes/authRoutes');
const dashboardRoutes = require('./backend/routes/dashboardRoutes');
const interviewRoutes = require('./backend/routes/interviewRoutes');
const subscriptionRoutes = require('./backend/routes/subscriptionRoutes');
const profileRoutes = require('./backend/routes/profileRoutes');
const apiRoutes = require('./backend/routes/apiRoutes');
const webhookRoutes = require('./backend/routes/webhookRoutes');
const setupRoutes = require('./backend/routes/setupRoutes');
const demoRoutes = require('./backend/routes/demoRoutes');


// ─── Connect Database + Bootstrap Config ──────────────────────────────────────
connectDB().then(() => bootstrapConfig()).catch(() => { });

const app = express();

// ─── View Engine (ejs-mate for layout support) ───────────────────────────────
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));

// ─── Trust Proxy ──────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

// ─── Security Middlewares ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://www.gstatic.com",
        "https://www.googleapis.com",
        "https://apis.google.com",
        "https://*.firebaseapp.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://www.googletagmanager.com"
      ],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://lh3.googleusercontent.com",
        "https://*.googleusercontent.com"
      ],
      connectSrc: [
        "'self'",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://apis.google.com",
        "https://www.gstatic.com",
        "https://*.firebaseapp.com",
        "https://cdn.jsdelivr.net",
        "wss:",
        "ws:"
      ],
      mediaSrc: ["'self'", "blob:", "https://res.cloudinary.com"],
      frameSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://*.firebaseapp.com"
      ],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Extremely high for demo/presentation safety
  message: { success: false, message: 'Too many requests, please try again later.', errorCode: 'RATE_LIMIT', data: null },
  standardHeaders: true,
  legacyHeaders: false,
});



const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased from 20 to 1000 to prevent blocking
  message: { success: false, message: 'Too many auth attempts.', errorCode: 'AUTH_RATE_LIMIT', data: null },
});

app.use(globalLimiter);

// ─── Webhook routes BEFORE body parser (need raw body) ────────────────────────
app.use('/api/webhooks', webhookRoutes);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.SESSION_SECRET));

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(mongoSanitize());
app.use(xssClean());

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Session Store ────────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'embassy_ai_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 60 * 60 * 24 * 7, // 7 days
    touchAfter: 24 * 3600,
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

// ─── HTTP Logger ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend/public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
}));

// ─── Template Global Variables ────────────────────────────────────────────────
const AppConfig = require('./backend/models/AppConfig');
app.use(async (req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.subscription = req.session?.subscription || null;

  try {
    const config = await AppConfig.getConfig();
    res.locals.company = config.company || {};
  } catch (err) {
    res.locals.company = { name: 'AI' };
  }

  const fbConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
  };
  res.locals.firebaseConfig = fbConfig;
  res.locals.isFirebaseConfigured = !!(fbConfig.apiKey && fbConfig.projectId && fbConfig.appId);
  res.locals.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  res.locals.isDemo = req.session?.isDemo || false;
  next();
});


// ─── Demo Only Mode Redirect ──────────────────────────────────────────────────
if (process.env.DEMO_ONLY === 'true') {
  app.get('/', (req, res) => res.redirect('/demo'));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Setup Admin Route — must come FIRST, standalone (no auth required if fresh install)
app.use('/setup', setupRoutes);

app.get('/setup/debug-gemini', (req, res) => {
  const key = process.env.GEMINI_API_KEY || 'NOT_FOUND';
  res.json({
    keyInfo: `${key.substring(0, 6)}...${key.slice(-4)}`,
    fullLength: key.length
  });
});

app.use('/', pageRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/interview', interviewRoutes);
app.use('/subscription', subscriptionRoutes);
app.use('/profile', profileRoutes);
app.use('/demo', demoRoutes);
app.use('/api', apiRoutes);


// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 AI server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  logger.info(`🌐 URL: http://localhost:${PORT}`);
});

// ─── Unhandled Rejections ─────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = app;
