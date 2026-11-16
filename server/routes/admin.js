const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const { escape } = require('../services/mailer');

const router = express.Router();
const PURPOSE = 'premium-approve';

/** Signed one-click link for the Premium request email (valid 30 days, only grants Premium to that one account). */
const premiumApproveLink = userId => {
  const token = jwt.sign({ purpose: PURPOSE, uid: String(userId) }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const base = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base}/api/admin/premium/approve?token=${encodeURIComponent(token)}`;
};

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f4f1;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111}main{max-width:440px;margin:24px;padding:32px;border-radius:24px;background:#fff;box-shadow:0 8px 30px rgb(0 0 0/.08);text-align:center}h1{margin:0 0 8px;font-size:24px}p{margin:0;color:#555}</style></head>
<body><main><h1>${escape(title)}</h1><p>${body}</p></main></body></html>`;

// GET /api/admin/premium/approve?token=... - Opened from the request email: turns Premium on for that account.
router.get('/premium/approve', async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(String(req.query.token || ''), process.env.JWT_SECRET);
    if (payload.purpose !== PURPOSE) throw new Error('wrong purpose');
  } catch {
    return res.status(400).send(page('Link not valid', 'This approval link is invalid or has expired. Grant Premium with <code>npm run premium -- email</code> instead.'));
  }
  try {
    const user = await User.findById(payload.uid).select('name email plan');
    if (!user) return res.status(404).send(page('Account not found', 'That account no longer exists.'));
    if (user.plan === 'premium') return res.send(page('Already Premium', `${escape(user.name)} (${escape(user.email)}) already has Premium.`));
    user.plan = 'premium';
    await user.save();
    await Reminder.create({ from: user._id, to: user._id, type: 'system', message: '🎉 Premium is on! Community is now unlocked for you.' }).catch(() => {});
    res.send(page('Premium is on ✅', `${escape(user.name)} (${escape(user.email)}) can now use Community. They’ve been notified in their inbox.`));
  } catch (error) {
    console.error('Approve premium error:', error);
    res.status(500).send(page('Something went wrong', 'Please try the link again in a moment.'));
  }
});

module.exports = { router, premiumApproveLink };
