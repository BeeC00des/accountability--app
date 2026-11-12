const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
  note: { type: String, default: '', maxlength: 300 },
  mood: { type: String, enum: ['great', 'good', 'okay', 'tough', ''], default: '' }
});

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  targetDate: { type: Date, required: true },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

const goalSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: { type: String, trim: true, maxlength: [500, 'Description cannot exceed 500 characters'] },
  category: {
    type: String,
    enum: ['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other'],
    default: 'personal'
  },
  frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  targetDays: { type: Number, min: 7, max: 365, default: 30 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  isPublic: { type: Boolean, default: false },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  checkIns: [checkInSchema],
  milestones: [milestoneSchema],
  streak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  emoji: { type: String, default: '🎯' }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

goalSchema.virtual('completionRate').get(function() {
  if (!this.checkIns.length) return 0;
  return Math.round((this.checkIns.filter(checkIn => checkIn.completed).length / this.checkIns.length) * 100);
});

goalSchema.virtual('totalDays').get(function() {
  return Math.floor((Date.now() - new Date(this.startDate).getTime()) / 86400000);
});

module.exports = mongoose.model('Goal', goalSchema);
