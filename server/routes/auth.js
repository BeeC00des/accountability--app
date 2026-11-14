const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
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
  body('referralCode').optional().isString().isLength({ max: 20 })
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
    const user = await User.create({ name, email, password, timezone, referredBy: referrer?._id || null, friends: referrer ? [referrer._id] : [] });
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
  body('timezone').optional().custom(value => isValidTimeZone(value)).withMessage('Choose a valid IANA timezone'),
  body('notificationsEnabled').optional().isBoolean(),
  body('accent').optional().matches(/^(lime|ocean|coral|lavender|mint|amber|graphite|#[0-9a-fA-F]{6})$/).withMessage('Choose a valid color.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  try {
    const { name, bio, avatar, reminderTime, timezone, notificationsEnabled, accent } = req.body;
    const updateData = {};
    if (accent !== undefined) updateData.accent = accent;
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    // Store as zero-padded HH:MM — the scheduler compares exact strings.
    if (reminderTime !== undefined) updateData.reminderTime = normalizeTime(reminderTime);
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

module.exports = router;
