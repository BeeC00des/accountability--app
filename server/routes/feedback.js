const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const Feedback = require('../models/Feedback');
const { handleValidation } = require('../utils/validate');

const router = express.Router();

// Simple in-memory rate limit: 5 submissions per IP per hour (public endpoint).
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;
const hits = new Map();
const rateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const recent = (hits.get(key) || []).filter(time => now - time < WINDOW_MS);
  if (recent.length >= LIMIT) return res.status(429).json({ message: 'Thanks! You’ve sent a lot of feedback — please try again a little later.' });
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  next();
};

/** Attach the signed-in user when a valid token is sent; anonymous feedback is fine too. */
const optionalUser = req => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), process.env.JWT_SECRET).id; } catch { return null; }
};

// POST /api/feedback  { kind, message, email?, page? }
router.post('/', rateLimit, [
  body('kind').optional().isIn(['idea', 'bug', 'praise', 'other']),
  body('message').isString().trim().isLength({ min: 5, max: 2000 }).withMessage('Tell us a bit more (5–2000 characters).'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email, or leave it empty.').normalizeEmail(),
  body('page').optional().isString().isLength({ max: 200 }),
  handleValidation
], async (req, res) => {
  try {
    await Feedback.create({
      user: optionalUser(req),
      kind: req.body.kind || 'idea',
      message: req.body.message,
      email: req.body.email || '',
      page: req.body.page || ''
    });
    res.status(201).json({ message: 'Thank you — your feedback was sent.' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ message: 'Could not send your feedback.' });
  }
});

module.exports = router;
