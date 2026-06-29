const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Goal = require('../models/Goal');

const sendDailyReminders = async () => {
  try {
    const users = await User.findWithFriends();
    
    // For each user, create automated reminders from their friends
    const usersWithGoals = await User.find({ notificationsEnabled: true }).populate('friends');

    for (const user of usersWithGoals) {
      // Check if user hasn't checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const checkedInToday = user.lastCheckIn && new Date(user.lastCheckIn) >= today;

      if (!checkedInToday && user.friends.length > 0) {
        // Pick a random friend to send the reminder "from"
        const randomFriend = user.friends[Math.floor(Math.random() * user.friends.length)];

        if (randomFriend && randomFriend._id) {
          const messages = [
            "Hey! Don't forget to check in on your goals today 💪",
            "Your goals are waiting for you! Keep the streak going 🔥",
            "Time to make progress! Check in on your goals today ✨",
            "Stay consistent! Your daily check-in is waiting 🎯",
            "Small steps every day = big results. Check in now! 🚀"
          ];

          const randomMessage = messages[Math.floor(Math.random() * messages.length)];

          await Reminder.create({
            from: randomFriend._id,
            to: user._id,
            message: randomMessage,
            type: 'automated'
          });
        }
      }
    }

    console.log('✅ Daily reminders sent');
  } catch (error) {
    console.error('❌ Error sending daily reminders:', error);
  }
};

module.exports = { sendDailyReminders };
