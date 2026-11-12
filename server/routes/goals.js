const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getPeriodKey } = require('../utils/timezone');

const router = express.Router();

const addCalendarMonths = (date, months) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
};

router.get('/', protect, async (req, res) => {
  try {
    const goals = await Goal.find({ owner: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ goals });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Could not load goals.' });
  }
});

router.get('/friends', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('friends');
    const goals = await Goal.find({ owner: { $in: user.friends }, isPublic: true, isActive: true })
      .populate('owner', 'name streak');
    res.json({ goals });
  } catch (error) {
    console.error('Get friends goals error:', error);
    res.status(500).json({ message: 'Could not load friends’ goals.' });
  }
});

router.post('/', protect, [
  body('title').trim().notEmpty().isLength({ max: 100 }).withMessage('Goal title is required and must be 100 characters or fewer'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('category').optional().isIn(['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other']),
  body('frequency').optional().isIn(['daily', 'weekly']),
  body('targetDays').optional().isInt({ min: 7, max: 365 }),
  body('isPublic').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, description, category, frequency, targetDays, isPublic, emoji } = req.body;
    const duration = Number(targetDays) || 30;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);
    const milestones = duration >= 300
      ? Array.from({ length: 12 }, (_, index) => ({
        title: `Month ${index + 1} check-in`,
        targetDate: addCalendarMonths(startDate, index + 1)
      }))
      : [];

    const goal = await Goal.create({
      owner: req.user._id, title, description, category, frequency,
      targetDays: duration, startDate, endDate,
      isPublic: isPublic === true,
      emoji: emoji || '🎯',
      milestones
    });
    res.status(201).json({ message: 'Goal created!', goal });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Could not create goal.' });
  }
});

router.post('/:id/checkin', protect, [
  param('id').isMongoId(),
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('note').optional().trim().isLength({ max: 300 }),
  body('mood').optional().isIn(['great', 'good', 'okay', 'tough', ''])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id, isActive: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });

    const now = new Date();
    const timezone = req.user.timezone || 'UTC';
    const frequency = goal.frequency || 'daily';
    const currentPeriod = getPeriodKey(now, timezone, frequency);
    const existing = goal.checkIns.find(checkIn => getPeriodKey(checkIn.date, timezone, frequency) === currentPeriod);
    if (existing) {
      existing.completed = req.body.completed;
      existing.note = req.body.note || '';
      existing.mood = req.body.mood || '';
    } else {
      goal.checkIns.push({ date: now, completed: req.body.completed, note: req.body.note || '', mood: req.body.mood || '' });
    }

    const completedPeriods = new Set(goal.checkIns.filter(checkIn => checkIn.completed)
      .map(checkIn => getPeriodKey(checkIn.date, timezone, frequency)));
    let streak = 0;
    const cursor = new Date(`${currentPeriod}T00:00:00.000Z`);
    while (completedPeriods.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - (frequency === 'weekly' ? 7 : 1));
    }
    goal.streak = streak;
    goal.longestStreak = Math.max(goal.longestStreak || 0, streak);
    if (req.body.completed) await User.findByIdAndUpdate(req.user._id, { lastCheckIn: now });
    await goal.save();
    res.json({ message: 'Checked in!', goal });
  } catch (error) {
    console.error('Goal check-in error:', error);
    res.status(500).json({ message: 'Could not save your check-in.' });
  }
});

router.post('/:id/milestones/:milestoneId/complete', protect, [
  param('id').isMongoId(),
  param('milestoneId').isMongoId()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id, isActive: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    const milestone = goal.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found.' });
    milestone.completedAt = milestone.completedAt ? null : new Date();
    await goal.save();
    res.json({ message: milestone.completedAt ? 'Milestone completed!' : 'Milestone reopened.', goal });
  } catch (error) {
    console.error('Milestone update error:', error);
    res.status(500).json({ message: 'Could not update milestone.' });
  }
});

router.put('/:id', protect, [
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('category').optional().isIn(['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other']),
  body('frequency').optional().isIn(['daily', 'weekly']),
  body('targetDays').optional().isInt({ min: 7, max: 365 }),
  body('isPublic').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const allowedFields = ['title', 'description', 'category', 'frequency', 'targetDays', 'isPublic', 'emoji'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id, isActive: true },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ message: 'Goal updated.', goal });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Could not update goal.' });
  }
});

router.delete('/:id', protect, [param('id').isMongoId()], async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid goal id.' });
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ message: 'Goal removed.' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Could not remove goal.' });
  }
});

module.exports = router;
