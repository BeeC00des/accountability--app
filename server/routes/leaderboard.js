const express = require('express');
const { query } = require('express-validator');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const { getLocalDateKey } = require('../utils/timezone');
const { shiftKey } = require('../services/activity');

const router = express.Router();
router.use(protect);

const rangeStart = (range, timezone) => {
  const today = getLocalDateKey(new Date(), timezone);
  if (range === 'week') {
    const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    return shiftKey(today, -weekday);
  }
  if (range === 'month') return `${today.slice(0, 8)}01`;
  return '0000-00-00';
};

// GET /api/leaderboard?range=week|month|all - You and your friends ranked by XP
router.get('/', [query('range').optional().isIn(['week', 'month', 'all']), handleValidation], async (req, res) => {
  try {
    const range = req.query.range || 'week';
    const me = await User.findById(req.user._id).select('friends');
    const ids = [req.user._id, ...me.friends];
    const from = rangeStart(range, req.user.timezone || 'UTC');

    const [totals, people] = await Promise.all([
      Activity.aggregate([
        { $match: { user: { $in: ids }, dateKey: { $gte: from } } },
        { $group: { _id: '$user', xp: { $sum: '$points' }, checkins: { $sum: { $cond: [{ $eq: ['$type', 'checkin'] }, 1, 0] } }, steps: { $sum: { $cond: [{ $eq: ['$type', 'step'] }, 1, 0] } }, days: { $addToSet: '$dateKey' } } }
      ]),
      User.find({ _id: { $in: ids } }).select('name avatar streak')
    ]);
    const byId = new Map(totals.map(row => [String(row._id), row]));
    const rows = people.map(person => {
      const total = byId.get(String(person._id));
      return {
        _id: person._id,
        name: person.name,
        avatar: person.avatar,
        streak: person.streak || 0,
        xp: total?.xp || 0,
        checkins: total?.checkins || 0,
        steps: total?.steps || 0,
        activeDays: total?.days.length || 0,
        isMe: person._id.equals(req.user._id)
      };
    }).sort((a, b) => b.xp - a.xp || b.streak - a.streak || a.name.localeCompare(b.name));

    let rank = 0;
    let previous = null;
    rows.forEach((row, index) => { if (row.xp !== previous) { rank = index + 1; previous = row.xp; } row.rank = rank; });
    res.json({ range, from, leaderboard: rows });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ message: 'Could not load the leaderboard.' });
  }
});

module.exports = router;
