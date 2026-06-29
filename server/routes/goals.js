const express = require('express');
const { body, validationResult } = require('express-validator');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// GET /api/goals - Get all goals for logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const goals = await Goal.find({ owner: req.user._id, isActive: true })
      .sort({ createdAt: -1 });
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/goals/friends - Get public goals from friends
router.get('/friends', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const goals = await Goal.find({
      owner: { $in: user.friends },
      isPublic: true,
      isActive: true
    }).populate('owner', 'name email streak');
    res.json({ goals });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/goals - Create a new goal
router.post('/', protect, [
  body('title').trim().notEmpty().withMessage('Goal title is required'),
  body('category').optional().isIn(['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other']),
  body('frequency').optional().isIn(['daily', 'weekly']),
  body('targetDays').optional().isInt({ min: 1, max: 365 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { title, description, category, frequency, targetDays, isPublic, emoji, sharedWith } = req.body;

    const goal = await Goal.create({
      owner: req.user._id,
      title, description, category, frequency,
      targetDays: targetDays || 30,
      isPublic: isPublic || false,
      emoji: emoji || '🎯',
      sharedWith: sharedWith || [],
      endDate: new Date(Date.now() + (targetDays || 30) * 24 * 60 * 60 * 1000)
    });

    res.status(201).json({ message: 'Goal created!', goal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/goals/:id/checkin - Check in on a goal
router.post('/:id/checkin', protect, [
  body('completed').isBoolean().withMessage('Completed status is required'),
  body('note').optional().trim().isLength({ max: 300 }),
  body('mood').optional().isIn(['great', 'good', 'okay', 'tough', ''])
], async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, owner: req.user._id });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existingCheckIn = goal.checkIns.find(c => {
      const checkInDate = new Date(c.date);
      checkInDate.setHours(0, 0, 0, 0);
      return checkInDate.getTime() === today.getTime();
    });

    if (existingCheckIn) {
      existingCheckIn.completed = req.body.completed;
      existingCheckIn.note = req.body.note || '';
      existingCheckIn.mood = req.body.mood || '';
    } else {
      goal.checkIns.push({
        date: new Date(),
        completed: req.body.completed,
        note: req.body.note || '',
        mood: req.body.mood || ''
      });
    }

    // Calculate streak
    if (req.body.completed) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const checkedInYesterday = goal.checkIns.some(c => {
        const checkInDate = new Date(c.date);
        checkInDate.setHours(0, 0, 0, 0);
        return checkInDate.getTime() === yesterday.getTime() && c.completed;
      });

      goal.streak = checkedInYesterday ? goal.streak + 1 : 1;
      if (goal.streak > goal.longestStreak) goal.longestStreak = goal.streak;

      // Update user's last check-in and streak
      await User.findByIdAndUpdate(req.user._id, {
        lastCheckIn: new Date(),
        $inc: { streak: 0 }
      });
    } else {
      goal.streak = 0;
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
    const goal = await Goal.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
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
