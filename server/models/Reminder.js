const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  goal: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
  message: {
    type: String,
    trim: true,
    maxlength: [300, 'Message cannot exceed 300 characters'],
    default: "Hey! Don't forget to check in on your goals today 💪"
  },
  type: { type: String, enum: ['manual', 'automated', 'encouragement'], default: 'manual' },
  isRead: { type: Boolean, default: false },
  scheduledFor: { type: Date },
  reminderKey: { type: String, unique: true, sparse: true }
}, { timestamps: true });

reminderSchema.index({ to: 1, createdAt: -1 });
reminderSchema.index({ to: 1, isRead: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
