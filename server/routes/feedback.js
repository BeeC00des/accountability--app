const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const { SUPPORT_EMAIL, sendMail, escape } = require('../services/mailer');

const KIND_LABEL = { idea: 'Idea', bug: 'Problem', praise: 'Praise', other: 'Other' };
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
    const userId = optionalUser(req);
    const kind = req.body.kind || 'idea';
    await Feedback.create({ user: userId, kind, message: req.body.message, email: req.body.email || '', page: req.body.page || '' });
    // Email the support inbox in the background; the visitor never waits for it.
    const from = userId ? await User.findById(userId).select('name email').catch(() => null) : null;
    const replyTo = req.body.email || from?.email || '';
    const who = from ? `${from.name} (${from.email})` : replyTo || 'A visitor (no email given)';
    const where = req.body.page ? ` on ${req.body.page}` : '';
    sendMail({
      to: SUPPORT_EMAIL,
      replyTo: replyTo || undefined,
      subject: `${from ? 'App feedback' : 'Website message'} · ${KIND_LABEL[kind]}: ${req.body.message.slice(0, 60)}`,
      text: `${KIND_LABEL[kind]} from ${who}${where}:\n\n${req.body.message}\n\n${replyTo ? 'Reply to this email to answer them.' : 'No reply address was given.'}`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:560px"><p style="margin:0 0 6px;color:#777;font-size:13px">${escape(KIND_LABEL[kind])} · ${from ? 'from the app' : 'from the website'}${escape(where)}</p>
        <h2 style="margin:0 0 14px;font-size:18px">${escape(who)}</h2>
        <p style="margin:0 0 18px;white-space:pre-wrap">${escape(req.body.message)}</p>
        <p style="margin:0;color:#777;font-size:13px">${replyTo ? 'Reply to this email to answer them.' : 'No reply address was given.'}</p></div>`
    }).then(result => { if (!result.sent) console.warn(`Feedback email not sent (${result.reason})`); });
    res.status(201).json({ message: 'Thank you — your feedback was sent.' });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ message: 'Could not send your feedback.' });
  }
});

module.exports = router;
