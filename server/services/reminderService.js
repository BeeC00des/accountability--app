const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Goal = require('../models/Goal');
const { getLocalDateKey, getLocalTimeKey } = require('../utils/timezone');

const sendDailyReminders = async (now = new Date()) => {
  try {
    const users = await User.find({ notificationsEnabled: true }).select('_id timezone reminderTime');

    for (const user of users) {
      const timezone = user.timezone || 'UTC';
      if (getLocalTimeKey(now, timezone) !== (user.reminderTime || '08:00')) continue;

      const localDate = getLocalDateKey(now, timezone);
      const reminderKey = `${user._id}:${localDate}`;
      const existingReminder = await Reminder.exists({ reminderKey });
      if (existingReminder) continue;

      const goals = await Goal.find({ owner: user._id, isActive: true, frequency: 'daily' }).select('checkIns');
      if (!goals.length) continue;

      const hasUncheckedGoal = goals.some(goal => !goal.checkIns.some(checkIn =>
        checkIn.completed && getLocalDateKey(checkIn.date, timezone) === localDate
      ));
      if (!hasUncheckedGoal) continue;

      try {
        await Reminder.create({
          from: user._id,
          to: user._id,
          message: "Your daily goals are waiting for you. Take a moment to check in.",
          type: 'automated',
          scheduledFor: now,
          reminderKey
        });
      } catch (error) {
        // A unique key prevents duplicate reminders if multiple app instances run the job.
        if (error.code !== 11000) throw error;
      }
    }

    console.log('✅ Local-time daily reminders checked');
  } catch (error) {
    console.error('❌ Error sending daily reminders:', error);
  }
};

module.exports = { sendDailyReminders };
