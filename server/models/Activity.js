const mongoose = require('mongoose');

/**
 * One row per thing a user did on a given local day (a completed check-in, a finished step, a won challenge).
 * Drives Duolingo-style streaks (any activity keeps the streak alive) and leaderboard XP.
 */
const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['checkin', 'step', 'challenge_win'], required: true },
  ref: { type: mongoose.Schema.Types.ObjectId, required: true }, // goal, todo or challenge id
  dateKey: { type: String, required: true }, // YYYY-MM-DD in the user's timezone
  points: { type: Number, required: true },
  date: { type: Date, default: Date.now }
}, { timestamps: false });

activitySchema.index({ user: 1, type: 1, ref: 1, dateKey: 1 }, { unique: true });
activitySchema.index({ user: 1, dateKey: -1 });
activitySchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('Activity', activitySchema);
