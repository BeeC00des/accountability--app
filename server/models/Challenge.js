const mongoose = require('mongoose');

/** A friendly, time-boxed duel between two friends ("booked" for a start date). */
const challengeSchema = new mongoose.Schema({
  challenger: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  opponent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, trim: true, maxlength: 60, required: true },
  metric: { type: String, enum: ['xp', 'checkins'], default: 'xp' },
  startKey: { type: String, required: true }, // YYYY-MM-DD (challenger's timezone)
  endKey: { type: String, required: true },
  startAt: { type: Date }, // local midnight at the start of startKey (challenger's timezone)
  endAt: { type: Date },   // local midnight after endKey
  days: { type: Number, min: 3, max: 30, required: true },
  reward: { type: String, trim: true, maxlength: 60, default: '' }, // e.g. "Loser cooks a healthy dinner"
  message: { type: String, trim: true, maxlength: 200, default: '' },
  timezone: { type: String, default: 'UTC' },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled', 'completed'], default: 'pending' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isTie: { type: Boolean, default: false },
  finalScores: { challenger: Number, opponent: Number }
}, { timestamps: true });

challengeSchema.index({ challenger: 1, status: 1 });
challengeSchema.index({ opponent: 1, status: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);
