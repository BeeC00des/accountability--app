const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Goal = require('../models/Goal');
const { getLocalDateKey, getLocalTimeKey, getPeriodKey } = require('../utils/timezone');

const sendDailyReminders = async (now = new Date()) => {
  try {
    const users = await User.find({ notificationsEnabled: true }).select('_id timezone reminderTime');
    for (const user of users) {
      const timezone = user.timezone || 'UTC';
      if (getLocalTimeKey(now, timezone) !== (user.reminderTime || '08:00')) continue;

      const localDate = getLocalDateKey(now, timezone);
      const reminderKey = `${user._id}:${localDate}`;
      if (await Reminder.exists({ reminderKey })) continue;

      const goals = await Goal.find({ owner: user._id, isActive: true }).select('frequency checkIns');
      if (!goals.length) continue;
      const hasUncheckedGoal = goals.some(goal => {
        const frequency = goal.frequency || 'daily';
        const currentPeriod = getPeriodKey(now, timezone, frequency);
        return !goal.checkIns.some(checkIn => checkIn.completed && getPeriodKey(checkIn.date, timezone, frequency) === currentPeriod);
      });
      if (!hasUncheckedGoal) continue;

      try {
        await Reminder.create({
          from: user._id,
          to: user._id,
          message: "Your goals are waiting for you. Take a moment to check in.",
          type: 'automated',
          scheduledFor: now,
          reminderKey
        });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
  } catch (error) {
    console.error('Daily reminder job failed:', error);
  }
};

module.exports = { sendDailyReminders };
