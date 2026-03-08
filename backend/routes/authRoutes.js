'use strict';
const express = require('express');
const router = express.Router();
const { loginPage, verifyToken, logout, getMe } = require('../controllers/authController');

router.get('/login', loginPage);
router.post('/verify-token', verifyToken);
router.post('/logout', logout);
router.get('/me', getMe);

module.exports = router;
