const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const { ADMIN_EMAIL, sendMail, escape } = require('../services/mailer');
const { premiumApproveLink } = require('./admin');
const { refreshStreak } = require('../services/activity');
const { protect } = require('../middleware/auth');
const { isValidTimeZone } = require('../utils/timezone');

const router = express.Router();

const normalizeTime = value => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
};

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

router.post('/register', [
  body('name').trim().notEmpty().isLength({ max: 50 }).withMessage('Name is required and must be 50 characters or fewer'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('timezone').optional().isString(),
  body('referralCode').optional().isString().isLength({ max: 20 }),
  body('accent').optional().matches(/^(lime|ocean|coral|lavender|mint|amber|graphite|#[0-9a-fA-F]{6})$/)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'An account with this email already exists.' });

    const timezone = isValidTimeZone(req.body.timezone) ? req.body.timezone : 'UTC';
    // A valid referral code credits the inviter and connects you as friends straight away.
    const code = typeof req.body.referralCode === 'string' ? req.body.referralCode.replace(/[^a-z0-9]/gi, '').toUpperCase().replace(/^AC/, '') : '';
    const referrer = code ? await User.findOne({ friendCode: `AC-${code}` }).select('_id') : null;
    // Keep the theme colour picked on the website, so the app looks the same after sign-up.
    const accent = req.body.accent || undefined;
    const user = await User.create({ name, email, password, timezone, accent, referredBy: referrer?._id || null, friends: referrer ? [referrer._id] : [] });
    if (referrer) await User.updateOne({ _id: referrer._id }, { $addToSet: { friends: user._id } });
    const token = generateToken(user._id);
    res.status(201).json({ message: 'Account created successfully!', token, user: user.toJSON() });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = generateToken(user._id);
    res.json({ message: 'Logged in successfully!', token, user: user.toJSON() });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    // Refresh the live streak so a missed day is reflected without waiting for new activity.
    const { streakToday } = await refreshStreak(req.user);
    const user = await User.findById(req.user._id)
      .populate('friends', 'name email avatar streak lastCheckIn')
      .populate('friendRequests.from', 'name email');
    res.json({ user: { ...user.toJSON(), streakToday } });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_LENGTH = 200 * 1024; // ~150KB image; clients resize to 256×256 first.

router.put('/profile', protect, [
  body('name').optional().trim().notEmpty().withMessage('Enter a display name.').isLength({ max: 50 }).withMessage('Names can be up to 50 characters.'),
  body('bio').optional().isString().trim().isLength({ max: 160 }).withMessage('Bios can be up to 160 characters.'),
  body('avatar').optional().custom(value => value === '' || (typeof value === 'string' && value.length <= MAX_AVATAR_LENGTH && AVATAR_PATTERN.test(value)))
    .withMessage('Use a PNG, JPEG or WebP photo under 150 KB.'),
  body('reminderTime').optional().custom(value => Boolean(normalizeTime(value))).withMessage('Choose a valid reminder time'),
  body('reminderTime2').optional().custom(value => Boolean(normalizeTime(value))).withMessage('Choose a valid evening reminder time'),
  body('alarmSound').optional().isBoolean().withMessage('Alarm sound must be on or off').toBoolean(),
  body('timezone').optional().custom(value => isValidTimeZone(value)).withMessage('Choose a valid IANA timezone'),
  body('notificationsEnabled').optional().isBoolean(),
  body('accent').optional().matches(/^(lime|ocean|coral|lavender|mint|amber|graphite|#[0-9a-fA-F]{6})$/).withMessage('Choose a valid color.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { name, bio, avatar, reminderTime, reminderTime2, alarmSound, timezone, notificationsEnabled, accent } = req.body;
    const updateData = {};
    if (accent !== undefined) updateData.accent = accent;
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    // Store as zero-padded HH:MM — the scheduler compares exact strings.
    if (reminderTime !== undefined) updateData.reminderTime = normalizeTime(reminderTime);
    if (reminderTime2 !== undefined) updateData.reminderTime2 = normalizeTime(reminderTime2);
    if (alarmSound !== undefined) updateData.alarmSound = alarmSound;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled === true || notificationsEnabled === 'true';

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Could not update your profile.' });
  }
});

// PUT /api/auth/email - Change sign-in email (requires current password)
router.put('/email', protect, [
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Enter your current password to change your email.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(req.body.password))) return res.status(400).json({ message: 'Your current password is incorrect.' }); // not 401: that signs the client out
    if (user.email === req.body.email) return res.json({ message: 'Email unchanged.', user: user.toJSON() });
    if (await User.exists({ email: req.body.email, _id: { $ne: user._id } })) return res.status(409).json({ message: 'Another account already uses this email.' });
    user.email = req.body.email;
    await user.save();
    res.json({ message: 'Email updated.', user: user.toJSON() });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Another account already uses this email.' });
    console.error('Change email error:', error);
    res.status(500).json({ message: 'Could not update your email.' });
  }
});

// PUT /api/auth/password - Change password (requires current password)
router.put('/password', protect, [
  body('currentPassword').notEmpty().withMessage('Enter your current password.'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(req.body.currentPassword))) return res.status(400).json({ message: 'Your current password is incorrect.' }); // not 401: that signs the client out
    if (await user.comparePassword(req.body.newPassword)) return res.status(400).json({ message: 'Choose a password different from your current one.' });
    user.password = req.body.newPassword; // hashed by the pre-save hook
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Could not update your password.' });
  }
});

/* ---------- Password reset ---------- */
const RESET_TTL_MS = 60 * 60 * 1000; // links work for 1 hour
const RESET_COOLDOWN_MS = 60 * 1000; // one email per minute per account
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const GENERIC_RESET = 'If an account exists for that email, we’ve sent a link to reset your password. Check your inbox (and spam).';

// POST /api/auth/forgot-password { email } - Emails a one-time reset link. Same reply whether or not the account exists.
router.post('/forgot-password', [body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const user = await User.findOne({ email: req.body.email }).select('+passwordResetRequestedAt');
    if (!user) return res.json({ message: GENERIC_RESET });
    if (user.passwordResetRequestedAt && Date.now() - user.passwordResetRequestedAt.getTime() < RESET_COOLDOWN_MS) {
      return res.json({ message: GENERIC_RESET });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await User.updateOne({ _id: user._id }, { passwordResetToken: hashToken(token), passwordResetExpires: new Date(Date.now() + RESET_TTL_MS), passwordResetRequestedAt: new Date() });

    const base = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');
    const link = `${base}/reset-password?token=${token}`;
    // Sent in the background: the reply is instant and identical whether or not the account exists.
    sendMail({
      to: user.email,
      subject: 'Reset your doerstab password',
      text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your doerstab password. This link works for 1 hour:\n${link}\n\nIf you didn't ask for this, ignore this email - your password stays the same.`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p style="margin:0 0 16px">Hi ${escape(user.name)}, someone (hopefully you) asked to reset your doerstab password. This link works for 1 hour.</p>
        <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">Choose a new password</a></p>
        <p style="margin:0;color:#777;font-size:13px">If you didn’t ask for this, ignore this email — your password stays the same.</p></div>`
    }).then(mail => {
      // Without email set up (e.g. local development), the link is printed for the person running the server.
      if (!mail.sent) console.warn(`Password reset email not sent (${mail.reason}). Reset link for ${user.email}: ${link}`);
    });
    res.json({ message: GENERIC_RESET });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Could not start the reset. Please try again.' });
  }
});

// POST /api/auth/reset-password { token, password } - Sets a new password and signs you in.
router.post('/reset-password', [
  body('token').isString().isLength({ min: 64, max: 64 }).withMessage('This reset link is invalid.'),
  body('password').isLength({ min: 8 }).withMessage('Use at least 8 characters.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
  try {
    const user = await User.findOne({ passwordResetToken: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } })
      .select('+password +passwordResetToken +passwordResetExpires');
    if (!user) return res.status(400).json({ message: 'This reset link has expired or was already used. Request a new one.' });
    user.password = req.body.password; // hashed by the pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();
    res.json({ message: 'Password updated. You’re signed in.', token: generateToken(user._id), user: user.toJSON() });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Could not reset your password. Please try again.' });
  }
});

// POST /api/auth/premium-request - Ask for Premium (Community). The owner grants it with `npm run premium -- <email>`.
router.post('/premium-request', protect, async (req, res) => {
  try {
    if (req.user.plan === 'premium') return res.json({ message: 'You already have Premium.', user: req.user.toJSON() });
    const already = Boolean(req.user.premiumRequestedAt);
    if (!already) {
      req.user.premiumRequestedAt = new Date();
      await req.user.save();
      await Feedback.create({ user: req.user._id, kind: 'other', message: `Premium access request from ${req.user.name}`, email: req.user.email, page: '/community' });
      const approve = premiumApproveLink(req.user._id);
      const when = new Date().toUTCString();
      const mail = await sendMail({
        to: ADMIN_EMAIL,
        replyTo: req.user.email,
        subject: `Premium request: ${req.user.name}`,
        text: `${req.user.name} (${req.user.email}) asked for Premium to unlock Community.\nRequested: ${when}\n\nApprove with one click: ${approve}\n\nOr run in server/: npm run premium -- ${req.user.email}`,
        html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px">
          <h2 style="margin:0 0 12px">New Premium request</h2>
          <p style="margin:0 0 16px"><strong>${escape(req.user.name)}</strong> (${escape(req.user.email)}) asked for Premium to unlock Community.</p>
          <p style="margin:0 0 20px;color:#555">Requested ${escape(when)}</p>
          <p style="margin:0 0 20px"><a href="${approve}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">Approve Premium</a></p>
          <p style="margin:0;color:#777;font-size:13px">Or run in server/: <code>npm run premium -- ${escape(req.user.email)}</code>. Reply to this email to contact them.</p></div>`
      });
      if (!mail.sent) console.warn(`Premium request email not sent: ${mail.reason}`);
    }
    res.json({ message: already ? 'Your request is already in — we’ll let you know.' : 'Request sent. We’ll let you know when Premium is on.', user: req.user.toJSON() });
  } catch (error) {
    console.error('Premium request error:', error);
    res.status(500).json({ message: 'Could not send your request.' });
  }
});

module.exports = router;
