const Activity = require('../models/Activity');
const User = require('../models/User');
const Goal = require('../models/Goal');
const { getLocalDateKey } = require('../utils/timezone');

const POINTS = { checkin: 10, step: 5, challenge_win: 25 };

const shiftKey = (key, days) => {
  const date = new Date(`${key}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Idempotent: the same goal check-in / step on the same day is only counted once. */
const recordActivity = async ({ userId, type, ref, timezone = 'UTC', date = new Date() }) => {
  const dateKey = getLocalDateKey(date, timezone);
  await Activity.updateOne(
    { user: userId, type, ref, dateKey },
    { $setOnInsert: { user: userId, type, ref, dateKey, points: POINTS[type], date } },
    { upsert: true }
  );
};

const removeActivity = async ({ userId, type, ref, timezone, date }) => {
  const filter = { user: userId, type, ref };
  if (date) filter.dateKey = getLocalDateKey(date, timezone || 'UTC');
  await Activity.deleteMany(filter);
};

/**
 * Duolingo-style streak: consecutive local days with any activity.
 * Today not done yet doesn't break the streak — it stays alive until the day ends.
 */
const streakFor = async (userId, timezone = 'UTC', now = new Date()) => {
  const today = getLocalDateKey(now, timezone);
  const keys = await Activity.distinct('dateKey', { user: userId, dateKey: { $gte: shiftKey(today, -800) } });
  const days = new Set(keys);
  const streakToday = days.has(today);
  let cursor = streakToday ? today : shiftKey(today, -1);
  let streak = 0;
  while (days.has(cursor)) { streak += 1; cursor = shiftKey(cursor, -1); }
  return { streak, streakToday };
};

/** Recomputes and stores the user's streak (friends and leaderboards read the stored value). */
const refreshStreak = async (user, now = new Date()) => {
  const result = await streakFor(user._id, user.timezone || 'UTC', now);
  if (result.streak !== user.streak) await User.updateOne({ _id: user._id }, { streak: result.streak });
  return result;
};

/** One-time-safe backfill so existing check-ins and finished steps count toward streaks and XP. */
const backfillActivities = async () => {
  const goals = await Goal.find({ isActive: true }).select('owner checkIns todos').populate('owner', 'timezone');
  const operations = [];
  goals.forEach(goal => {
    if (!goal.owner) return;
    const timezone = goal.owner.timezone || 'UTC';
    goal.checkIns.filter(checkIn => checkIn.completed).forEach(checkIn => {
      const dateKey = getLocalDateKey(checkIn.date, timezone);
      operations.push({ updateOne: { filter: { user: goal.owner._id, type: 'checkin', ref: goal._id, dateKey }, update: { $setOnInsert: { points: POINTS.checkin, date: checkIn.date } }, upsert: true } });
    });
    goal.todos.filter(todo => todo.done).forEach(todo => {
      const when = todo.updatedAt || todo.createdAt || new Date();
      const dateKey = getLocalDateKey(when, timezone);
      operations.push({ updateOne: { filter: { user: goal.owner._id, type: 'step', ref: todo._id, dateKey }, update: { $setOnInsert: { points: POINTS.step, date: when } }, upsert: true } });
    });
  });
  if (!operations.length) return 0;
  const result = await Activity.bulkWrite(operations, { ordered: false });
  return result.upsertedCount || 0;
};

module.exports = { POINTS, shiftKey, recordActivity, removeActivity, streakFor, refreshStreak, backfillActivities };
