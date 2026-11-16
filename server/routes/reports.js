const express = require('express');
const { query } = require('express-validator');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const { getLocalDateKey } = require('../utils/timezone');
const { shiftKey } = require('../services/activity');

const router = express.Router();
router.use(protect);

// Rolling windows ending today (in the user's timezone); half and year use whole calendar months.
const RANGES = {
  week: { days: 7, bucket: 'day', label: 'Last 7 days' },
  biweekly: { days: 14, bucket: 'day', label: 'Last 2 weeks' },
  month: { days: 30, bucket: 'day', label: 'Last 30 days' },
  quarter: { days: 91, bucket: 'week', label: 'Last 3 months' },
  half: { months: 6, bucket: 'month', label: 'Last 6 months' },
  year: { months: 12, bucket: 'month', label: 'Last 12 months' }
};

const toUTC = key => new Date(`${key}T00:00:00Z`);
const daysBetween = (from, to) => Math.round((toUTC(to) - toUTC(from)) / 86400000) + 1; // inclusive
const monthKey = key => key.slice(0, 7);
const shiftMonth = (key, months) => {
  const date = toUTC(`${key.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });

const windowFor = (range, today) => {
  const spec = RANGES[range];
  if (spec.months) {
    const start = shiftMonth(today, -(spec.months - 1));
    const prevStart = shiftMonth(start, -spec.months);
    return { start, end: today, prevStart, prevEnd: shiftKey(start, -1) };
  }
  const start = shiftKey(today, -(spec.days - 1));
  return { start, end: today, prevStart: shiftKey(start, -spec.days), prevEnd: shiftKey(start, -1) };
};

const longestRun = keys => {
  const sorted = [...new Set(keys)].sort();
  let best = 0; let run = 0; let previous = null;
  sorted.forEach(key => { run = previous && shiftKey(previous, 1) === key ? run + 1 : 1; best = Math.max(best, run); previous = key; });
  return best;
};

/** Check-ins done vs expected for each goal inside [start, end]. */
const goalStats = (goals, timezone, start, end) => goals.map(goal => {
  const created = getLocalDateKey(goal.createdAt, timezone);
  const from = created > start ? created : start;
  const span = from > end ? 0 : daysBetween(from, end);
  const expected = span ? (goal.frequency === 'weekly' ? Math.max(1, Math.ceil(span / 7)) : span) : 0;
  const keys = new Set();
  const moods = {};
  goal.checkIns.forEach(checkIn => {
    if (!checkIn.completed) return;
    const key = getLocalDateKey(checkIn.date, timezone);
    if (key < start || key > end) return;
    keys.add(key);
    if (checkIn.mood) moods[checkIn.mood] = (moods[checkIn.mood] || 0) + 1;
  });
  const done = Math.min(keys.size, expected || keys.size);
  return { _id: goal._id, title: goal.title, emoji: goal.emoji, frequency: goal.frequency, done, expected, rate: expected ? Math.round((done / expected) * 100) : 0, moods };
});

const totalsFor = (stats, activities, start, end) => {
  const inside = activities.filter(activity => activity.dateKey >= start && activity.dateKey <= end);
  const checkins = stats.reduce((sum, goal) => sum + goal.done, 0);
  const expected = stats.reduce((sum, goal) => sum + goal.expected, 0);
  return {
    checkins,
    expected,
    rate: expected ? Math.round((checkins / expected) * 100) : 0,
    activeDays: new Set(inside.map(activity => activity.dateKey)).size,
    days: daysBetween(start, end),
    xp: inside.reduce((sum, activity) => sum + activity.points, 0),
    steps: inside.filter(activity => activity.type === 'step').length,
    wins: inside.filter(activity => activity.type === 'challenge_win').length,
    bestStreak: longestRun(inside.map(activity => activity.dateKey))
  };
};

const seriesFor = (range, { start, end }, activities) => {
  const { bucket } = RANGES[range];
  const buckets = [];
  if (bucket === 'day') {
    for (let key = start; key <= end; key = shiftKey(key, 1)) {
      buckets.push({ from: key, to: key, label: range === 'month' ? DAY.format(toUTC(key)) : WEEKDAY.format(toUTC(key)), short: String(Number(key.slice(8))) });
    }
  } else if (bucket === 'week') {
    for (let to = end; to >= start; to = shiftKey(to, -7)) {
      const from = shiftKey(to, -6) < start ? start : shiftKey(to, -6);
      buckets.unshift({ from, to, label: `w/c ${DAY.format(toUTC(from))}`, short: DAY.format(toUTC(from)) });
    }
  } else {
    for (let key = start; key <= end; key = shiftMonth(key, 1)) {
      const last = shiftKey(shiftMonth(key, 1), -1);
      buckets.push({ from: key, to: last > end ? end : last, label: `${MONTH.format(toUTC(key))} ${key.slice(0, 4)}`, short: MONTH.format(toUTC(key)) });
    }
  }
  return buckets.map(item => {
    const inside = activities.filter(activity => activity.dateKey >= item.from && activity.dateKey <= item.to);
    return { ...item, checkins: inside.filter(a => a.type === 'checkin').length, steps: inside.filter(a => a.type === 'step').length, xp: inside.reduce((sum, a) => sum + a.points, 0) };
  });
};

// GET /api/reports?range=week|biweekly|month|quarter|half|year - Your progress report for a period vs the one before
router.get('/', [query('range').optional().isIn(Object.keys(RANGES)).withMessage('Choose week, biweekly, month, quarter, half or year.'), handleValidation], async (req, res) => {
  try {
    const range = req.query.range || 'week';
    const timezone = req.user.timezone || 'UTC';
    const today = getLocalDateKey(new Date(), timezone);
    const win = windowFor(range, today);
    const [goals, activities] = await Promise.all([
      Goal.find({ owner: req.user._id, isActive: true }).select('title emoji frequency checkIns createdAt'),
      Activity.find({ user: req.user._id, dateKey: { $gte: win.prevStart, $lte: win.end } }).select('type dateKey points').lean()
    ]);
    const current = goalStats(goals, timezone, win.start, win.end);
    const previous = goalStats(goals, timezone, win.prevStart, win.prevEnd);
    const moods = current.reduce((all, goal) => { Object.entries(goal.moods).forEach(([mood, count]) => { all[mood] = (all[mood] || 0) + count; }); return all; }, {});

    res.json({
      range,
      label: RANGES[range].label,
      start: win.start,
      end: win.end,
      totals: totalsFor(current, activities, win.start, win.end),
      previousTotals: totalsFor(previous, activities, win.prevStart, win.prevEnd),
      series: seriesFor(range, win, activities),
      goals: current.filter(goal => goal.expected > 0).map(({ moods: _moods, ...goal }) => goal).sort((a, b) => b.rate - a.rate || b.done - a.done),
      moods
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ message: 'Could not build your report.' });
  }
});

module.exports = router;
