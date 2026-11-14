const { getLocalDateKey, getPeriodKey } = require('../utils/timezone');

const stepBack = (key, frequency) => {
  const cursor = new Date(`${key}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - (frequency === 'weekly' ? 7 : 1));
  return cursor.toISOString().slice(0, 10);
};

const completedPeriodSet = (checkIns, timezone, frequency) => new Set(
  (checkIns || [])
    .filter(checkIn => checkIn.completed)
    .map(checkIn => getPeriodKey(checkIn.date, timezone, frequency))
);

/**
 * Live streak: counts consecutive completed periods ending in the current period,
 * or the previous one (so a streak is not "lost" before the day/week is over).
 */
const computeStreak = (checkIns, timezone, frequency, now = new Date()) => {
  const periods = completedPeriodSet(checkIns, timezone, frequency);
  let cursor = getPeriodKey(now, timezone, frequency);
  if (!periods.has(cursor)) cursor = stepBack(cursor, frequency);
  let streak = 0;
  while (periods.has(cursor)) {
    streak += 1;
    cursor = stepBack(cursor, frequency);
  }
  return streak;
};

/** User streak: consecutive local days with at least one completed check-in on any goal. */
const computeUserStreak = (goals, timezone, now = new Date()) => {
  const days = new Set();
  goals.forEach(goal => (goal.checkIns || []).forEach(checkIn => {
    if (checkIn.completed) days.add(getLocalDateKey(checkIn.date, timezone));
  }));
  let cursor = getLocalDateKey(now, timezone);
  if (!days.has(cursor)) cursor = stepBack(cursor, 'daily');
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = stepBack(cursor, 'daily');
  }
  return streak;
};

const currentPeriodCheckIn = (goal, timezone, now = new Date()) => {
  const frequency = goal.frequency || 'daily';
  const period = getPeriodKey(now, timezone, frequency);
  return (goal.checkIns || []).find(checkIn => getPeriodKey(checkIn.date, timezone, frequency) === period) || null;
};

/**
 * Serialises a goal with server-computed, timezone-aware status so clients never
 * have to guess what "today" or "this week" means.
 */
const decorateGoal = (goal, timezone = 'UTC', { includePrivate = true } = {}) => {
  const json = typeof goal.toJSON === 'function' ? goal.toJSON() : { ...goal };
  const frequency = json.frequency || 'daily';
  const checkIns = json.checkIns || [];
  const todos = json.todos || [];
  const current = currentPeriodCheckIn(json, timezone);
  const completedCount = checkIns.filter(checkIn => checkIn.completed).length;

  const decorated = {
    ...json,
    streak: computeStreak(checkIns, timezone, frequency),
    checkedInThisPeriod: Boolean(current?.completed),
    currentCheckIn: current ? { completed: current.completed, mood: current.mood, note: includePrivate ? current.note : '' } : null,
    completedCheckIns: completedCount,
    completionRate: checkIns.length ? Math.round((completedCount / checkIns.length) * 100) : 0,
    todoProgress: { done: todos.filter(todo => todo.done).length, total: todos.length },
    lastCheckInAt: checkIns.length ? checkIns[checkIns.length - 1].date : null
  };

  if (!includePrivate) {
    // Friends see progress, not private notes or the raw check-in log.
    delete decorated.checkIns;
    delete decorated.sharedWith;
    decorated.todos = todos.map(({ _id, title, done }) => ({ _id, title, done }));
  }
  return decorated;
};

module.exports = { computeStreak, computeUserStreak, currentPeriodCheckIn, decorateGoal };
