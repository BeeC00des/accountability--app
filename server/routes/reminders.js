const express = require('express');
const { body, query } = require('express-validator');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const { requireObjectIds, handleValidation, isObjectId } = require('../utils/validate');

const router = express.Router();
router.use(protect);

const DEFAULT_MESSAGE = "Hey! Don't forget to check in on your goals today 💪";
const DAILY_LIMIT_PER_FRIEND = 3;

// GET /api/reminders?box=inbox|sent&filter=all|unread|friends|nudges
router.get('/', [
  query('box').optional().isIn(['inbox', 'sent']),
  query('filter').optional().isIn(['all', 'unread', 'friends', 'nudges']),
  handleValidation
], async (req, res) => {
  try {
    const box = req.query.box || 'inbox';
    const filter = req.query.filter || 'all';
    const criteria = box === 'sent'
      ? { from: req.user._id, to: { $ne: req.user._id } }
      : { to: req.user._id };
    if (box === 'inbox' && filter === 'unread') criteria.isRead = false;
    if (box === 'inbox' && filter === 'friends') criteria.type = { $in: ['manual', 'encouragement'] };
    if (box === 'inbox' && filter === 'nudges') criteria.type = 'automated';

    const reminders = await Reminder.find(criteria)
      .populate('from', 'name')
      .populate('to', 'name')
      .populate('goal', 'title emoji isActive')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ reminders });
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({ message: 'Could not load reminders.' });
  }
});

// GET /api/reminders/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Reminder.countDocuments({ to: req.user._id, isRead: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Could not load unread count.' });
  }
});

// POST /api/reminders - Nudge or cheer a friend, optionally about one of their shared goals
router.post('/', [
  body('to').custom(isObjectId).withMessage('Choose a friend to remind.'),
  body('goalId').optional({ values: 'falsy' }).custom(isObjectId).withMessage('Invalid goal.'),
  body('message').optional().isString().trim().isLength({ max: 300 }).withMessage('Messages can be up to 300 characters.'),
  body('type').optional().isIn(['manual', 'encouragement']),
  handleValidation
], async (req, res) => {
  try {
    const { to, goalId } = req.body;
    const currentUser = await User.findById(req.user._id).select('friends name');
    if (!currentUser.friends.some(id => id.equals(to))) {
      return res.status(403).json({ message: 'You can only send reminders to friends.' });
    }

    if (goalId) {
      const goal = await Goal.exists({ _id: goalId, owner: to, isPublic: true, isActive: true });
      if (!goal) return res.status(404).json({ message: 'That goal is not shared with you.' });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Reminder.countDocuments({ from: req.user._id, to, createdAt: { $gte: since } });
    if (recent >= DAILY_LIMIT_PER_FRIEND) {
      return res.status(429).json({ message: `You've sent ${DAILY_LIMIT_PER_FRIEND} reminders to this friend today. Give them a little space.` });
    }

    const reminder = await Reminder.create({
      from: req.user._id,
      to,
      goal: goalId || undefined,
      message: req.body.message || DEFAULT_MESSAGE,
      type: req.body.type || 'manual'
    });
    await reminder.populate([{ path: 'from', select: 'name' }, { path: 'to', select: 'name' }, { path: 'goal', select: 'title emoji' }]);
    res.status(201).json({ message: 'Reminder sent.', reminder });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ message: 'Could not send the reminder.' });
  }
});

// PUT /api/reminders/read-all  (declared before /:id routes)
router.put('/read-all', async (req, res) => {
  try {
    const result = await Reminder.updateMany({ to: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'All caught up.', updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Could not update reminders.' });
  }
});

// PUT /api/reminders/:id/read  body: { isRead?: boolean }
router.put('/:id/read', requireObjectIds('id'), async (req, res) => {
  try {
    const isRead = req.body?.isRead !== false;
    const reminder = await Reminder.findOneAndUpdate({ _id: req.params.id, to: req.user._id }, { isRead }, { new: true });
    if (!reminder) return res.status(404).json({ message: 'Reminder not found.' });
    res.json({ message: isRead ? 'Marked as read.' : 'Marked as unread.', isRead });
  } catch (error) {
    res.status(500).json({ message: 'Could not update this reminder.' });
  }
});

// DELETE /api/reminders/:id - Recipient removes it from their inbox
router.delete('/:id', requireObjectIds('id'), async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, to: req.user._id });
    if (!reminder) return res.status(404).json({ message: 'Reminder not found.' });
    res.json({ message: 'Reminder deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete this reminder.' });
  }
});

module.exports = router;
