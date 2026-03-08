# 🏛️ EmbassyAI — Setup Guide

## Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Firebase project
- Razorpay account
- Cloudinary free account
- Google Gemini API key

---

## 1. Clone / Navigate to Project

```bash
cd visa_ai
```

## 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

## 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project → Enable **Google Authentication**
3. Project Settings → Service Accounts → **Generate new private key**
4. Copy `project_id`, `client_email`, `private_key` to `.env`
5. Enable Google Auth in Authentication → Sign-in methods

### Razorpay Setup
1. Create account at [Razorpay](https://razorpay.com)
2. Get Test API Key ID & Secret from Dashboard → Settings → API Keys
3. Create subscription plans in Razorpay Dashboard → Products → Subscriptions → Plans
4. Copy Plan IDs to `.env`

### Cloudinary Setup
1. Sign up free at [Cloudinary](https://cloudinary.com)
2. Copy Cloud Name, API Key, API Secret from Dashboard

### Gemini AI Setup
1. Go to [Google AI Studio](https://ai.google.dev)
2. Create API key → copy to `.env` as `GEMINI_API_KEY`

---

## 4. Start MongoDB

```bash
# Local MongoDB
mongod

# OR use MongoDB Atlas (cloud) — update MONGODB_URI in .env
```

## 5. Run Development Server

```bash
npm run dev
```

Server starts at: **http://localhost:5000**

---

## 📁 Project Structure

```
visa_ai/
├── server.js                    # Entry point
├── .env                         # Environment variables
├── package.json
│
├── backend/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   ├── firebase.js          # Firebase Admin SDK
│   │   └── cloudinary.js        # Cloudinary config
│   │
│   ├── models/
│   │   ├── User.js              # User model
│   │   ├── Profile.js           # Visa applicant profile
│   │   ├── InterviewSession.js  # Interview session + scores
│   │   ├── InterviewAnswer.js   # Per-question answers + eval
│   │   ├── Subscription.js      # Razorpay subscription
│   │   ├── Resume.js            # Resume uploads
│   │   └── MediaFile.js         # Videos, screenshots
│   │
│   ├── ai/
│   │   ├── geminiService.js     # Gemini AI client
│   │   └── interviewEngine.js   # AI officer + evaluation
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── interviewController.js
│   │   ├── dashboardController.js
│   │   ├── subscriptionController.js
│   │   ├── profileController.js
│   │   └── pageController.js
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── interviewService.js
│   │   ├── subscriptionService.js
│   │   └── uploadService.js
│   │
│   ├── middlewares/
│   │   ├── auth.js              # Firebase auth middleware
│   │   ├── errorHandler.js      # Global error handler
│   │   └── notFound.js          # 404 handler
│   │
│   ├── routes/
│   │   ├── pageRoutes.js
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── interviewRoutes.js
│   │   ├── subscriptionRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── apiRoutes.js
│   │   └── webhookRoutes.js
│   │
│   └── utils/
│       ├── errorResponse.js     # Standard error class
│       ├── logger.js            # Winston logger
│       └── asyncHandler.js      # Async wrapper
│
└── frontend/
    ├── views/
    │   ├── layouts/             # main.ejs, auth.ejs, dashboard.ejs, interview.ejs
    │   ├── partials/            # navbar, sidebar, topbar, footer
    │   ├── pages/               # landing, about, error
    │   ├── auth/                # login
    │   ├── dashboard/           # index, analytics, pricing
    │   ├── interview/           # setup, room, results
    │   └── profile/             # index
    │
    └── public/
        ├── css/                 # variables, reset, main, components, animations, ...
        ├── js/                  # theme, main, dashboard, interview, charts, ...
        └── images/              # favicon.svg
```

---

## 🔑 Key Features

| Feature | Implementation |
|---------|---------------|
| Auth | Firebase Google OAuth + session |
| AI Officer | Google Gemini 1.5 Flash |
| Eye Tracking | MediaPipe FaceMesh |
| Speech | Web Speech API (Recognition + Synthesis) |
| Payments | Razorpay (order + webhook) |
| Storage | Cloudinary (free tier) |
| Database | MongoDB + Mongoose |
| Theme | CSS Variables dark/light |
| Security | Helmet + rate limiting + XSS |

---

## 🌐 Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | / | Landing page |
| GET | /auth/login | Login page |
| POST | /auth/verify-token | Firebase token verification |
| GET | /dashboard | Dashboard home |
| GET | /dashboard/analytics | Analytics |
| GET | /interview | Setup page |
| GET | /interview/:id | Interview room |
| GET | /interview/:id/results | Results page |
| POST | /api/interview/create | Create session |
| POST | /api/interview/:id/start | Start interview |
| POST | /api/interview/:id/answer | Submit answer |
| POST | /api/subscription/create-order | Razorpay order |
| POST | /api/subscription/verify-payment | Verify payment |
| POST | /api/webhooks/razorpay | Webhook |

---

## 🚀 Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use MongoDB Atlas for production DB
3. Configure Razorpay live keys
4. Set up proper Firebase domain in Authentication settings
5. Use PM2 or similar process manager

```bash
npm start
```
