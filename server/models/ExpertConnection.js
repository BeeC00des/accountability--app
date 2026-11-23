const mongoose = require('mongoose');

/** A member's chosen expert for one Community category. One active expert per category per member. */
const connectionSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expert: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['mentor', 'therapist', 'career_coach'], required: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' }
}, { timestamps: true });

connectionSchema.index({ member: 1, category: 1, status: 1 });

module.exports = mongoose.model('ExpertConnection', connectionSchema);
