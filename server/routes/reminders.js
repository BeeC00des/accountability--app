const express = require('express');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/reminders - Get all reminders for current user
router.get('/', protect, async (req, res) => {
  try {
    const reminders = await Reminder.find({ to: req.user._id })
      .populate('from', 'name email')
      .populate('goal', 'title emoji')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ reminders });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/reminders/unread-count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Reminder.countDocuments({ to: req.user._id, isRead: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/reminders - Send a reminder to a friend
router.post('/', protect, async (req, res) => {
  try {
    const { to, goalId, message } = req.body;
    if (!to) return res.status(400).json({ message: 'Recipient is required.' });

    const currentUser = await User.findById(req.user._id);
    if (!currentUser.friends.map(f => f.toString()).includes(to)) {
      return res.status(403).json({ message: 'You can only send reminders to friends.' });
    }

    const reminder = await Reminder.create({
      from: req.user._id,
      to,
      goal: goalId || undefined,
      message: message || "Hey! Don't forget to check in on your goals today 💪",
      type: 'manual'
    });

    const populated = await reminder.populate('from', 'name email');
    res.status(201).json({ message: 'Reminder sent!', reminder: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/reminders/:id/read - Mark as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Reminder.findOneAndUpdate(
      { _id: req.params.id, to: req.user._id },
      { isRead: true }
    );
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/reminders/read-all - Mark all as read
router.put('/read-all', protect, async (req, res) => {
  try {
    await Reminder.updateMany({ to: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All marked as read.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
