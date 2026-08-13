const express = require('express');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/:id/stats - Get a user's public stats
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name email streak lastCheckIn createdAt');
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const goals = await Goal.find({ owner: req.params.id, isActive: true, isPublic: true });
    
    const totalCheckIns = goals.reduce((sum, g) => sum + g.checkIns.filter(c => c.completed).length, 0);

    res.json({
      user,
      stats: {
        totalGoals: goals.length,
        totalCheckIns,
        currentStreak: user.streak
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
