const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_MESSAGE = "Hey! Don't forget to check in on your goals today 💪";

router.get('/', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ to: req.user._id })
      .populate('from', 'name email')
      .populate('goal', 'title emoji')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ reminders });
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({ message: 'Could not load reminders.' });
  }
});

router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Reminder.countDocuments({ to: req.user._id, isRead: false });
    res.json({ count });
  } catch (error) {
    console.error('Unread reminder count error:', error);
    res.status(500).json({ message: 'Could not load unread reminder count.' });
  }
});

router.post('/', protect, [
  body('to').isMongoId().withMessage('A valid recipient is required.'),
  body('message').optional().isString().trim().isLength({ min: 1, max: 300 }),
  body('goalId').optional({ values: 'falsy' }).isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { to, goalId } = req.body;
    const message = (req.body.message || DEFAULT_MESSAGE).trim();
    if (to === req.user._id.toString()) return res.status(400).json({ message: 'You cannot send a reminder to yourself.' });

    const user = await User.findById(req.user._id).select('friends');
    const isFriend = user.friends.some(friendId => friendId.equals(to));
    if (!isFriend) return res.status(403).json({ message: 'You can only send reminders to accepted friends.' });

    let goal;
    if (goalId) {
      goal = await Goal.findOne({ _id: goalId, owner: req.user._id, isActive: true }).select('_id');
      if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    }

    const reminder = await Reminder.create({
      from: req.user._id,
      to,
      goal: goal?._id,
      message,
      type: 'manual'
    });
    await reminder.populate('from', 'name email');
    if (goal) await reminder.populate('goal', 'title emoji');
    res.status(201).json({ message: 'Reminder sent!', reminder });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ message: 'Could not send reminder.' });
  }
});

router.put('/:id/read', protect, [param('id').isMongoId()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, to: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ message: 'Reminder not found.' });
    res.json({ message: 'Marked as read.', reminder });
  } catch (error) {
    console.error('Mark reminder read error:', error);
    res.status(500).json({ message: 'Could not update reminder.' });
  }
});

router.put('/read-all', protect, async (req, res) => {
  try {
    const result = await Reminder.updateMany({ to: req.user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ message: 'All reminders marked as read.', updated: result.modifiedCount });
  } catch (error) {
    console.error('Mark all reminders read error:', error);
    res.status(500).json({ message: 'Could not update reminders.' });
  }
});

module.exports = router;
