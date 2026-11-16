const express = require('express');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { getLocalDateKey } = require('../utils/timezone');
const { shiftKey, refreshStreak } = require('../services/activity');

const router = express.Router();
router.use(protect);

const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 250, 365, 500, 730, 1000];
const isLeap = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysIn = year => (isLeap(year) ? 366 : 365);
const dayOfYear = key => Math.round((new Date(`${key}T00:00:00Z`) - new Date(`${key.slice(0, 4)}-01-01T00:00:00Z`)) / 86400000) + 1;
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' });

const longestRun = keys => {
  let best = 0; let run = 0; let previous = null;
  keys.forEach(key => { run = previous && shiftKey(previous, 1) === key ? run + 1 : 1; best = Math.max(best, run); previous = key; });
  return best;
};

/** Everything the Duolingo-style streak view needs, for the user's local "today". */
const buildStreak = async user => {
  const timezone = user.timezone || 'UTC';
  const today = getLocalDateKey(new Date(), timezone);
  const year = Number(today.slice(0, 4));
  const { streak, streakToday } = await refreshStreak(user);
  const keys = (await Activity.distinct('dateKey', { user: user._id })).sort();
  const days = new Set(keys);

  // Year counter: days you showed up in a year, out of 365 (366 in leap years).
  const perYear = keys.reduce((all, key) => { const y = Number(key.slice(0, 4)); all[y] = (all[y] || 0) + 1; return all; }, {});
  const yearCard = y => ({ year: y, activeDays: perYear[y] || 0, daysInYear: daysIn(y) });

  // Which year the counter shows: new accounts start on the current year; a new year waits to be flipped.
  let shownYear = user.streakYear;
  if (!shownYear || shownYear > year) {
    shownYear = year;
    await User.updateOne({ _id: user._id }, { streakYear: year });
  }
  const needsFlip = shownYear < year;

  // This week, Monday to Sunday, like Duolingo.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const monday = shiftKey(today, -weekday);
  const week = Array.from({ length: 7 }, (_, index) => {
    const key = shiftKey(monday, index);
    return { key, label: WEEKDAY.format(new Date(`${key}T00:00:00Z`)), active: days.has(key), today: key === today, future: key > today };
  });

  const next = MILESTONES.find(value => value > streak) || streak + 100;
  return {
    today,
    streak,
    streakToday,
    longest: longestRun(keys),
    totalDays: keys.length,
    week,
    nextMilestone: next,
    counter: yearCard(shownYear),
    current: { ...yearCard(year), dayOfYear: dayOfYear(today) },
    needsFlip,
    history: Object.keys(perYear).map(Number).filter(y => y < year).sort((a, b) => b - a).map(yearCard)
  };
};

// GET /api/streaks - Streak, this week, and the year counter (e.g. 245/365)
router.get('/', async (req, res) => {
  try {
    res.json(await buildStreak(req.user));
  } catch (error) {
    console.error('Streak error:', error);
    res.status(500).json({ message: 'Could not load your streak.' });
  }
});

// POST /api/streaks/flip - New year: flip the counter over to the current year
router.post('/flip', async (req, res) => {
  try {
    const year = Number(getLocalDateKey(new Date(), req.user.timezone || 'UTC').slice(0, 4));
    const from = req.user.streakYear;
    if (from && from >= year) return res.status(409).json({ message: `You’re already on ${year}.` });
    req.user.streakYear = year;
    await User.updateOne({ _id: req.user._id }, { streakYear: year });
    res.json({ message: `Welcome to ${year}! Your counter starts fresh.`, flippedFrom: from, ...(await buildStreak(req.user)) });
  } catch (error) {
    console.error('Flip streak error:', error);
    res.status(500).json({ message: 'Could not flip your counter.' });
  }
});

module.exports = router;
