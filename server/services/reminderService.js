const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Goal = require('../models/Goal');
const { getLocalDateKey, getLocalTimeKey } = require('../utils/timezone');
const { currentPeriodCheckIn } = require('./goalStats');

/**
 * Runs every minute. For each user whose local time matches their reminder time,
 * creates one private nudge per local day if any active goal still needs a check-in
 * for its current period (today for daily goals, this week for weekly goals).
 */
const sendDailyReminders = async (now = new Date()) => {
  try {
    const users = await User.find({ notificationsEnabled: true }).select('_id timezone reminderTime');

    for (const user of users) {
      const timezone = user.timezone || 'UTC';
      if (getLocalTimeKey(now, timezone) !== (user.reminderTime || '08:00')) continue;

      const reminderKey = `${user._id}:${getLocalDateKey(now, timezone)}`;
      if (await Reminder.exists({ reminderKey })) continue;

      const goals = await Goal.find({ owner: user._id, isActive: true, isCompleted: { $ne: true } }).select('title emoji frequency checkIns');
      const pending = goals.filter(goal => !currentPeriodCheckIn(goal, timezone, now)?.completed);
      if (!pending.length) continue;

      const message = pending.length === 1
        ? `${pending[0].emoji || '🎯'} "${pending[0].title}" is waiting for today's check-in.`
        : `You have ${pending.length} goals waiting for a check-in. A small step still counts.`;

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
