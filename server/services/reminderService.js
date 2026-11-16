const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Goal = require('../models/Goal');
const { getLocalDateKey, getLocalTimeKey } = require('../utils/timezone');
const { currentPeriodCheckIn } = require('./goalStats');

/**
 * Runs every minute. Each user has two daily reminder times (morning and evening). When the local
 * time matches either, creates one private nudge for that slot per local day if any active goal
 * still needs a check-in for its current period (today for daily goals, this week for weekly goals).
 */
const sendDailyReminders = async (now = new Date()) => {
  try {
    const users = await User.find({ notificationsEnabled: true }).select('_id timezone reminderTime reminderTime2');

    for (const user of users) {
      const timezone = user.timezone || 'UTC';
      const time = getLocalTimeKey(now, timezone);
      const morning = user.reminderTime || '08:00';
      const evening = user.reminderTime2 || '20:00';
      const slot = time === morning ? 1 : time === evening ? 2 : 0;
      if (!slot) continue;

      // Slot 1 keeps the original key format so existing reminders still dedupe.
      const reminderKey = `${user._id}:${getLocalDateKey(now, timezone)}${slot === 2 ? ':2' : ''}`;
      if (await Reminder.exists({ reminderKey })) continue;

      const goals = await Goal.find({ owner: user._id, isActive: true, isCompleted: { $ne: true } }).select('title emoji frequency checkIns');
      const pending = goals.filter(goal => !currentPeriodCheckIn(goal, timezone, now)?.completed);
      if (!pending.length) continue;

      const lead = slot === 2 ? '⏰ Evening check: ' : '⏰ ';
      const message = pending.length === 1
        ? `${lead}${pending[0].emoji || '🎯'} "${pending[0].title}" is waiting for today's check-in.`
        : `${lead}You have ${pending.length} goals waiting for a check-in. A small step still counts.`;

      try {
        await Reminder.create({
          from: user._id,
          to: user._id,
          goal: pending.length === 1 ? pending[0]._id : undefined,
          message,
          type: 'automated',
          scheduledFor: now,
          reminderKey
        });
      } catch (error) {
        // The unique key prevents duplicates if several app instances run the job.
        if (error.code !== 11000) throw error;
      }
    }
  } catch (error) {
    console.error('❌ Error sending daily reminders:', error);
  }
};

module.exports = { sendDailyReminders };
