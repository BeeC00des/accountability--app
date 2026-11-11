const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { isValidTimeZone } = require('../utils/timezone');

const router = express.Router();

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d'
});

router.post('/register', [
  body('name').trim().notEmpty().isLength({ max: 50 }).withMessage('Name is required and must be 50 characters or fewer'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { name, email, password } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'An account with this email already exists.' });

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);
    res.status(201).json({
      message: 'Account created successfully!', token,
      user: { _id: user._id, name: user.name, email: user.email, streak: user.streak, friends: user.friends, timezone: user.timezone }
    });
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
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password.' });

    const token = generateToken(user._id);
    res.json({
      message: 'Logged in successfully!', token,
      user: { _id: user._id, name: user.name, email: user.email, streak: user.streak, friends: user.friends, reminderTime: user.reminderTime, timezone: user.timezone }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'name email streak lastCheckIn')
      .populate('friendRequests.from', 'name email');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

router.put('/profile', protect, [
  body('name').optional().trim().notEmpty().isLength({ max: 50 }),
  body('reminderTime').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('timezone').optional().custom(value => isValidTimeZone(value)).withMessage('Choose a valid IANA timezone'),
  body('notificationsEnabled').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { name, reminderTime, timezone, notificationsEnabled } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (reminderTime !== undefined) updateData.reminderTime = reminderTime;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
