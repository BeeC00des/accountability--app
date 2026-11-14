const express = require('express');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const { requireObjectIds } = require('../utils/validate');

const router = express.Router();

// GET /api/users/:id/stats - Public stats, visible only to yourself and your friends
router.get('/:id/stats', protect, requireObjectIds('id'), async (req, res) => {
  try {
    const isSelf = String(req.user._id) === req.params.id;
    const isFriend = req.user.friends.some(id => id.equals(req.params.id));
    if (!isSelf && !isFriend) return res.status(403).json({ message: 'You can only view stats for your friends.' });

    const user = await User.findById(req.params.id).select('name streak lastCheckIn createdAt');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const goals = await Goal.find({ owner: req.params.id, isActive: true, ...(isSelf ? {} : { isPublic: true }) }).select('checkIns');
    const totalCheckIns = goals.reduce((sum, goal) => sum + goal.checkIns.filter(checkIn => checkIn.completed).length, 0);

    res.json({ user, stats: { totalGoals: goals.length, totalCheckIns, currentStreak: user.streak } });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
