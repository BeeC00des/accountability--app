const express = require('express');
const { body, validationResult } = require('express-validator');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { getLocalDateKey, getPeriodKey } = require('../utils/timezone');

const router = express.Router();

const sanitizeTodos = (todos = []) => {
  if (!Array.isArray(todos)) return [];

  return todos
    .map((todo) => {
      if (!todo || typeof todo.title !== 'string') return null;

      const title = todo.title.trim();
      if (!title) return null;

      return {
        title: title.slice(0, 200),
        done: Boolean(todo.done),
        dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined,
        notes: typeof todo.notes === 'string' ? todo.notes.trim().slice(0, 500) : ''
      };
    })
    .filter(Boolean)
    .slice(0, 50);
};

// GET /api/goals - Get all goals for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const goals = await Goal.find({ owner: req.user._id, isActive: true }).sort({ createdAt: -1 });
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/goals/friends - Get public goals from friends
router.get('/friends', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const goals = await Goal.find({ owner: { $in: user.friends }, isPublic: true, isActive: true })
      .populate('owner', 'name email streak');
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/goals - Create a new goal
router.post('/', protect, [
  body('title').trim().notEmpty().isLength({ max: 100 }).withMessage('Goal title is required and must be 100 characters or fewer'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('category').optional().isIn(['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other']),
  body('frequency').optional().isIn(['daily', 'weekly']),
  body('targetDays').optional().isInt({ min: 7, max: 3650 }),
  body('year').optional().isInt({ min: 2020, max: 2100 }),
  body('isPublic').optional().isBoolean(),
  body('todos').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { title, description, category, frequency, targetDays, isPublic, emoji, sharedWith, year } = req.body;
    const duration = Number(targetDays) || 30;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);

    const goal = await Goal.create({
      owner: req.user._id,
      title,
      description,
      category,
      frequency,
      targetDays: duration,
      startDate,
      year: Number.isInteger(Number(year)) ? Number(year) : new Date().getFullYear(),
      isPublic: isPublic || false,
      emoji: emoji || '🎯',
      sharedWith: sharedWith || [],
      endDate,
      todos: sanitizeTodos(req.body.todos)
    });

    res.status(201).json({ message: 'Goal created!', goal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/goals/:id/checkin - Check in using the user's local calendar day/week
router.post('/:id/checkin', protect, [
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('note').optional().trim().isLength({ max: 300 }),
  body('mood').optional().isIn(['great', 'good', 'okay', 'tough', ''])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });

    const now = new Date();
    const timezone = req.user.timezone || 'UTC';
    const frequency = goal.frequency || 'daily';
    const currentPeriod = getPeriodKey(now, timezone, frequency);
    const existingCheckIn = goal.checkIns.find(checkIn =>
      getPeriodKey(checkIn.date, timezone, frequency) === currentPeriod
    );

    if (existingCheckIn) {
      existingCheckIn.completed = req.body.completed;
      existingCheckIn.note = req.body.note || '';
      existingCheckIn.mood = req.body.mood || '';
    } else {
      goal.checkIns.push({ date: now, completed: req.body.completed, note: req.body.note || '', mood: req.body.mood || '' });
    }

    const completedPeriods = new Set(goal.checkIns
      .filter(checkIn => checkIn.completed)
      .map(checkIn => getPeriodKey(checkIn.date, timezone, frequency)));

    let streak = 0;
    const cursor = new Date(`${currentPeriod}T00:00:00.000Z`);
    while (completedPeriods.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - (frequency === 'weekly' ? 7 : 1));
    }
    goal.streak = streak;
    if (streak > goal.longestStreak) goal.longestStreak = streak;

    if (req.body.completed) {
      await User.findByIdAndUpdate(req.user._id, { lastCheckIn: now });
    }

    await goal.save();
    res.json({ message: 'Checked in!', goal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/goals/:id - Update a goal
router.put('/:id', protect, async (req, res) => {
  try {
    const sanitizedBody = { ...req.body };
    if (Array.isArray(sanitizedBody.todos)) {
      sanitizedBody.todos = sanitizeTodos(sanitizedBody.todos);
    }

    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      sanitizedBody,
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ message: 'Goal updated.', goal });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/goals/:id - Delete a goal (soft delete)
router.delete('/:id', protect, async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ message: 'Goal removed.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
