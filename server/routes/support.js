const express = require('express');
const { body } = require('express-validator');
const SupportRequest = require('../models/SupportRequest');
const { CATEGORIES } = require('../models/SupportRequest');
const Goal = require('../models/Goal');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { requirePremium } = require('../middleware/premium');
const { handleValidation, isObjectId, requireObjectIds } = require('../utils/validate');
const { ensureFriendCode } = require('../services/friendCode');
const { SUPPORT_EMAIL, sendMail, escape } = require('../services/mailer');

const router = express.Router();
router.use(protect, requirePremium); // Community is Premium-only

// Capital support (sponsored subscriptions) is reserved for people who've grown the community.
const REFERRALS_REQUIRED = Number(process.env.SPONSORSHIP_REFERRALS_REQUIRED) || 5;
const MAX_OPEN_REQUESTS = 5;

const referralStats = async user => {
  const [count, code] = await Promise.all([User.countDocuments({ referredBy: user._id }), ensureFriendCode(user._id)]);
  return { count, required: REFERRALS_REQUIRED, eligible: count >= REFERRALS_REQUIRED, code };
};

// GET /api/support - My requests + referral progress
router.get('/', async (req, res) => {
  try {
    const [requests, referrals] = await Promise.all([
      SupportRequest.find({ user: req.user._id }).populate('goal', 'title emoji').sort({ createdAt: -1 }).limit(50),
      referralStats(req.user)
    ]);
    res.json({ requests, referrals });
  } catch (error) {
    console.error('List support error:', error);
    res.status(500).json({ message: 'Could not load your support requests.' });
  }
});

// POST /api/support - Ask for human or capital support
router.post('/', [
  body('kind').isIn(Object.keys(CATEGORIES)).withMessage('Choose a type of support.'),
  body('category').custom((value, { req }) => (CATEGORIES[req.body.kind] || []).includes(value)).withMessage('Choose what you need.'),
  body('message').isString().trim().isLength({ min: 10, max: 1000 }).withMessage('Tell us a little more (10–1000 characters).'),
  body('goalId').optional({ values: 'falsy' }).custom(isObjectId).withMessage('Invalid goal.'),
  body('format').optional().isIn(['online', 'in_person', 'either']),
  body('urgency').optional().isIn(['low', 'normal', 'high']),
  body('contact').optional().isIn(['in_app', 'email']),
  handleValidation
], async (req, res) => {
  try {
    const { kind, category, message, goalId, format, urgency, contact } = req.body;
    if (kind === 'capital') {
      const stats = await referralStats(req.user);
      if (!stats.eligible) {
        return res.status(403).json({ message: `Sponsored subscriptions open up after ${stats.required} people join with your invite. You're at ${stats.count}.` });
      }
    }
    if (goalId && !(await Goal.exists({ _id: goalId, owner: req.user._id, isActive: true }))) return res.status(404).json({ message: 'Goal not found.' });
    const open = await SupportRequest.countDocuments({ user: req.user._id, status: { $in: ['submitted', 'in_review'] } });
    if (open >= MAX_OPEN_REQUESTS) return res.status(429).json({ message: `You have ${MAX_OPEN_REQUESTS} open requests. We'll get back to you on those first.` });

    const request = await SupportRequest.create({ user: req.user._id, kind, category, message, goal: goalId || undefined, format, urgency, contact });
    await request.populate('goal', 'title emoji');
    const label = `${kind === 'capital' ? 'Sponsored subscription' : category.replace('_', ' ')}`;
    sendMail({
      to: SUPPORT_EMAIL,
      replyTo: req.user.email,
      subject: `Support request · ${label} · ${req.user.name}`,
      text: `${req.user.name} (${req.user.email}) asked for: ${label}\nUrgency: ${urgency || 'normal'} · Format: ${format || 'either'} · Contact: ${contact || 'in_app'}${request.goal ? `\nGoal: ${request.goal.title}` : ''}\n\n${message}\n\nReply to this email to contact them.`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:560px"><p style="margin:0 0 6px;color:#777;font-size:13px">Community support request</p>
        <h2 style="margin:0 0 6px;font-size:18px">${escape(req.user.name)} · ${escape(label)}</h2>
        <p style="margin:0 0 14px;color:#555;font-size:14px">${escape(req.user.email)} · urgency ${escape(urgency || 'normal')} · ${escape(format || 'either')} · contact ${escape(contact || 'in_app')}${request.goal ? ` · goal “${escape(request.goal.title)}”` : ''}</p>
        <p style="margin:0 0 18px;white-space:pre-wrap">${escape(message)}</p>
        <p style="margin:0;color:#777;font-size:13px">Reply to this email to contact them.</p></div>`
    }).then(result => { if (!result.sent) console.warn(`Support email not sent (${result.reason})`); });
    res.status(201).json({ message: 'Request sent. Our team will reach out soon.', request });
  } catch (error) {
    console.error('Create support error:', error);
    res.status(500).json({ message: 'Could not send your request.' });
  }
});

// DELETE /api/support/:id - Withdraw a request that hasn't been picked up yet
router.delete('/:id', requireObjectIds('id'), async (req, res) => {
  try {
    const request = await SupportRequest.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: 'submitted' },
      { status: 'closed' },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Only new requests can be withdrawn.' });
    res.json({ message: 'Request withdrawn.', request });
  } catch (error) {
    res.status(500).json({ message: 'Could not withdraw this request.' });
  }
});

module.exports = router;
