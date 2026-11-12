const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
  note: { type: String, default: '' },
  mood: { type: String, enum: ['great', 'good', 'okay', 'tough', ''], default: '' }
});

const todoItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Todo title is required'],
    trim: true,
    maxlength: [200, 'Todo title cannot exceed 200 characters']
  },
  done: {
    type: Boolean,
    default: false
  },
  dueDate: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Todo notes cannot exceed 500 characters']
  }
}, { timestamps: true });

const goalSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    enum: ['fitness', 'learning', 'health', 'career', 'personal', 'finance', 'other'],
    default: 'personal'
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly'],
    default: 'daily'
  },
  year: {
    type: Number,
    default: () => new Date().getFullYear()
  },
  targetDays: {
    type: Number,
    default: 30
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  todos: [todoItemSchema],
  checkIns: [checkInSchema],
  streak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emoji: {
    type: String,
    default: '🎯'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Virtual for completion percentage
goalSchema.virtual('completionRate').get(function() {
  if (this.checkIns.length === 0) return 0;
  const completed = this.checkIns.filter(c => c.completed).length;
  return Math.round((completed / this.checkIns.length) * 100);
});

// Virtual for total days since start
goalSchema.virtual('totalDays').get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  return Math.floor((now - start) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('Goal', goalSchema);
