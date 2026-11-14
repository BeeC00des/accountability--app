const mongoose = require('mongoose');

const CATEGORIES = {
  human: ['therapist', 'mentor', 'counsellor', 'coach', 'accountability'],
  capital: ['subscription']
};

const supportRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: Object.keys(CATEGORIES), required: true },
  category: { type: String, enum: Object.values(CATEGORIES).flat(), required: true },
  message: { type: String, trim: true, minlength: 10, maxlength: 1000, required: true },
  goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
  format: { type: String, enum: ['online', 'in_person', 'either'], default: 'either' },
  urgency: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
  contact: { type: String, enum: ['in_app', 'email'], default: 'in_app' },
  status: { type: String, enum: ['submitted', 'in_review', 'matched', 'closed'], default: 'submitted' },
  response: { type: String, trim: true, maxlength: 1000, default: '' } // filled in by the support team
}, { timestamps: true });

module.exports = mongoose.model('SupportRequest', supportRequestSchema);
module.exports.CATEGORIES = CATEGORIES;
