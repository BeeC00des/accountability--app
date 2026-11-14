const express = require('express');
const { body, query } = require('express-validator');
const Goal = require('../models/Goal');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getPeriodKey } = require('../utils/timezone');
const { requireObjectIds, handleValidation } = require('../utils/validate');
const { decorateGoal, computeStreak } = require('../services/goalStats');
const { recordActivity, removeActivity, refreshStreak } = require('../services/activity');

const router = express.Router();
router.use(protect);

const CATEGORIES = ['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other'];
const MOODS = ['great', 'good', 'okay', 'tough', ''];
const MAX_TODOS = 50;

const tz = req => req.user.timezone || 'UTC';

const sanitizeTodo = todo => {
  if (!todo || typeof todo.title !== 'string') return null;
  const title = todo.title.trim();
  if (!title) return null;
  const dueDate = todo.dueDate ? new Date(todo.dueDate) : undefined;
  return {
    title: title.slice(0, 200),
    done: Boolean(todo.done),
    dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
    notes: typeof todo.notes === 'string' ? todo.notes.trim().slice(0, 500) : ''
  };
};
const sanitizeTodos = (todos = []) => (Array.isArray(todos) ? todos.map(sanitizeTodo).filter(Boolean).slice(0, MAX_TODOS) : []);

const endDateFrom = (startDate, days) => {
  const end = new Date(startDate);
  end.setDate(end.getDate() + days);
  return end;
};

const goalFields = [
  body('title').optional().trim().notEmpty().withMessage('Give your goal a name.')
    .isLength({ max: 100 }).withMessage('Goal names can be up to 100 characters.'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Descriptions can be up to 500 characters.'),
  body('category').optional().isIn(CATEGORIES).withMessage('Choose a valid category.'),
  body('frequency').optional().isIn(['daily', 'weekly']).withMessage('Choose daily or weekly.'),
  body('targetDays').optional().isInt({ min: 7, max: 3650 }).withMessage('Timeframe must be between 7 days and 10 years.').toInt(),
  body('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Choose a year between 2020 and 2100.').toInt(),
  body('isPublic').optional().isBoolean().toBoolean(),
  body('emoji').optional().isString().isLength({ min: 1, max: 8 }).withMessage('Choose an icon.'),
  body('todos').optional().isArray({ max: MAX_TODOS }).withMessage(`Add up to ${MAX_TODOS} steps.`)
];

const loadOwnGoal = async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id, isActive: true });
  if (!goal) res.status(404).json({ message: 'Goal not found.' });
  return goal;
};

// GET /api/goals?status=active|completed|all
router.get('/', [query('status').optional().isIn(['active', 'completed', 'all']), handleValidation], async (req, res) => {
  try {
    const status = req.query.status || 'all';
    const filter = { owner: req.user._id, isActive: true };
    if (status === 'active') filter.isCompleted = { $ne: true };
    if (status === 'completed') filter.isCompleted = true;
    const goals = await Goal.find(filter).sort({ createdAt: -1 });
    res.json({ goals: goals.map(goal => decorateGoal(goal, tz(req))) });
  } catch (error) {
    console.error('List goals error:', error);
    res.status(500).json({ message: 'Could not load your goals.' });
  }
});

// GET /api/goals/friends - Shared goals from friends (progress only, no private notes)
router.get('/friends', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('friends');
    const goals = await Goal.find({ owner: { $in: user.friends }, isPublic: true, isActive: true })
      .populate('owner', 'name streak timezone')
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ goals: goals.map(goal => decorateGoal(goal, goal.owner?.timezone || 'UTC', { includePrivate: false })) });
  } catch (error) {
    console.error('Friend goals error:', error);
    res.status(500).json({ message: 'Could not load shared goals.' });
  }
});

// POST /api/goals
router.post('/', [body('title').exists().withMessage('Give your goal a name.'), ...goalFields, handleValidation], async (req, res) => {
  try {
    const { title, description, category, frequency, isPublic, emoji, year } = req.body;
    const targetDays = req.body.targetDays || 30;
    const startDate = new Date();

    const goal = await Goal.create({
      owner: req.user._id,
      title,
      description,
      category,
      frequency,
      targetDays,
      startDate,
      endDate: endDateFrom(startDate, targetDays),
      year: year || startDate.getFullYear(),
      isPublic: Boolean(isPublic),
      emoji: emoji || '🎯',
      todos: sanitizeTodos(req.body.todos)
    });

    res.status(201).json({ message: 'Goal created.', goal: decorateGoal(goal, tz(req)) });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Could not create this goal.' });
  }
});

// PATCH /api/goals/:id - Update an explicit allow-list of fields (never owner, streak or check-ins)
const updateGoal = async (req, res) => {
  try {
    const goal = await loadOwnGoal(req, res);
    if (!goal) return;

    ['title', 'description', 'category', 'frequency', 'year', 'isPublic', 'emoji'].forEach(field => {
      if (req.body[field] !== undefined) goal[field] = req.body[field];
    });
    if (req.body.targetDays !== undefined) {
      goal.targetDays = req.body.targetDays;
      goal.endDate = endDateFrom(goal.startDate, req.body.targetDays);
    }
    if (req.body.isCompleted !== undefined) {
      goal.isCompleted = Boolean(req.body.isCompleted);
      goal.completedAt = goal.isCompleted ? new Date() : undefined;
    }
    if (Array.isArray(req.body.todos)) goal.todos = sanitizeTodos(req.body.todos);

    await goal.save();
    res.json({ message: 'Goal updated.', goal: decorateGoal(goal, tz(req)) });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Could not update this goal.' });
  }
};
const updateValidators = [requireObjectIds('id'), ...goalFields, body('isCompleted').optional().isBoolean().toBoolean(), handleValidation];
router.patch('/:id', updateValidators, updateGoal);
router.put('/:id', updateValidators, updateGoal); // Backwards compatible alias.

// POST /api/goals/:id/todos - Add one step
router.post('/:id/todos', [requireObjectIds('id'), body('title').isString().trim().notEmpty().withMessage('Name the step.').isLength({ max: 200 }), handleValidation], async (req, res) => {
  try {
    const goal = await loadOwnGoal(req, res);
    if (!goal) return;
    if (goal.todos.length >= MAX_TODOS) return res.status(400).json({ message: `A goal can have up to ${MAX_TODOS} steps.` });
    goal.todos.push(sanitizeTodo(req.body));
    await goal.save();
    res.status(201).json({ goal: decorateGoal(goal, tz(req)) });
  } catch (error) {
    console.error('Add todo error:', error);
    res.status(500).json({ message: 'Could not add this step.' });
  }
});

// PATCH /api/goals/:id/todos/:todoId - Toggle or rename a step
router.patch('/:id/todos/:todoId', [
  requireObjectIds('id', 'todoId'),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('done').optional().isBoolean().toBoolean(),
  handleValidation
], async (req, res) => {
  try {
    const goal = await loadOwnGoal(req, res);
    if (!goal) return;
    const todo = goal.todos.id(req.params.todoId);
    if (!todo) return res.status(404).json({ message: 'Step not found.' });
    if (req.body.title !== undefined) todo.title = req.body.title;
    const wasDone = todo.done;
    if (req.body.done !== undefined) todo.done = req.body.done;
    await goal.save();

    // Finishing a step counts as today's activity (keeps the streak alive, earns XP).
    if (!wasDone && todo.done) await recordActivity({ userId: req.user._id, type: 'step', ref: todo._id, timezone: tz(req) });
    if (wasDone && !todo.done) await removeActivity({ userId: req.user._id, type: 'step', ref: todo._id });
    const streak = await refreshStreak(req.user);
    res.json({ goal: decorateGoal(goal, tz(req)), user: streak });
  } catch (error) {
    console.error('Update todo error:', error);
    res.status(500).json({ message: 'Could not update this step.' });
  }
});

// DELETE /api/goals/:id/todos/:todoId
router.delete('/:id/todos/:todoId', requireObjectIds('id', 'todoId'), async (req, res) => {
  try {
    const goal = await loadOwnGoal(req, res);
    if (!goal) return;
    const todo = goal.todos.id(req.params.todoId);
    if (!todo) return res.status(404).json({ message: 'Step not found.' });
    todo.deleteOne();
    await goal.save();
    res.json({ goal: decorateGoal(goal, tz(req)) });
  } catch (error) {
    console.error('Delete todo error:', error);
    res.status(500).json({ message: 'Could not remove this step.' });
  }
});

// POST /api/goals/:id/checkin - One check-in per local day (daily) or ISO week (weekly)
router.post('/:id/checkin', [
  requireObjectIds('id'),
  body('completed').isBoolean().withMessage('Tell us whether you did it.').toBoolean(),
  body('note').optional().isString().trim().isLength({ max: 300 }).withMessage('Notes can be up to 300 characters.'),
  body('mood').optional().isIn(MOODS),
  handleValidation
], async (req, res) => {
  try {
    const goal = await loadOwnGoal(req, res);
    if (!goal) return;
    if (goal.isCompleted) return res.status(409).json({ message: 'This goal is marked complete. Reopen it to check in.' });

    const now = new Date();
    const timezone = tz(req);
    const frequency = goal.frequency || 'daily';
    const currentPeriod = getPeriodKey(now, timezone, frequency);
    const existing = goal.checkIns.find(checkIn => getPeriodKey(checkIn.date, timezone, frequency) === currentPeriod);
    const entry = { completed: req.body.completed, note: req.body.note || '', mood: req.body.mood || '' };

    if (existing) Object.assign(existing, entry);
    else goal.checkIns.push({ date: now, ...entry });

    goal.streak = computeStreak(goal.checkIns, timezone, frequency, now);
    goal.longestStreak = Math.max(goal.longestStreak || 0, goal.streak);
    await goal.save();

    // Any completed check-in counts as today's activity; un-completing today's check-in removes it.
    if (req.body.completed) {
      await recordActivity({ userId: req.user._id, type: 'checkin', ref: goal._id, timezone, date: now });
      await User.updateOne({ _id: req.user._id }, { lastCheckIn: now });
    } else {
      await removeActivity({ userId: req.user._id, type: 'checkin', ref: goal._id, timezone, date: now });
    }
    const before = req.user.streak || 0;
    const streak = await refreshStreak(req.user, now);
    const extended = req.body.completed && streak.streak > before;

    res.json({
      message: !req.body.completed ? 'Check-in saved. Tomorrow is a new chance.'
        : extended ? `🔥 ${streak.streak}-day streak! Keep it going.` : 'Nice work — check-in saved.',
      goal: decorateGoal(goal, timezone),
      user: { ...streak, lastCheckIn: req.body.completed ? now : req.user.lastCheckIn }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Could not save your check-in.' });
  }
});

// DELETE /api/goals/:id - Soft delete
router.delete('/:id', requireObjectIds('id'), async (req, res) => {
  try {
    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, owner: req.user._id, isActive: true }, { isActive: false }, { new: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    res.json({ message: 'Goal deleted.' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Could not delete this goal.' });
  }
});

module.exports = router;
