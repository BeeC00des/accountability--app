const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  // Small profile photo stored as a data URL (resized client-side to 256×256).
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [160, 'Bio cannot exceed 160 characters'],
    default: ''
  },
  friendCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  reminderTime: {
    type: String,
    default: '08:00'
  },
  // Second daily reminder (evening). Both times nudge only if a goal still needs today's check-in.
  reminderTime2: {
    type: String,
    default: '20:00'
  },
  // Play an alarm sound in the app at reminder times.
  alarmSound: {
    type: Boolean,
    default: true
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  streak: {
    type: Number,
    default: 0
  },
  lastCheckIn: {
    type: Date,
    default: null
  },
  // Who invited this user (their friend code doubles as a referral code).
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  // White-label dashboard color: a preset name or a #rrggbb hex.
  accent: {
    type: String,
    default: 'lime',
    match: [/^(lime|ocean|coral|lavender|mint|amber|graphite|#[0-9a-fA-F]{6})$/, 'Choose a valid color']
  },
  // Pinterest profiles/boards the user browses in the inspiration gallery.
  inspirationSources: [{
    url: { type: String, required: true, maxlength: 300 },
    label: { type: String, maxlength: 80 },
    _id: false
  }],
  notificationsEnabled: {
    type: Boolean,
    default: true
  },
  // Premium unlocks Community. Only the server (npm run premium) can change it; users can only request it.
  plan: {
    type: String,
    enum: ['free', 'premium'],
    default: 'free'
  },
  premiumRequestedAt: {
    type: Date,
    default: null
  },
  // Paid Community membership: access lasts until this date (null = no expiry, e.g. granted by the owner).
  premiumUntil: {
    type: Date,
    default: null
  },
  // member (default) | expert (mentor, therapist, career coach) | admin
  role: {
    type: String,
    enum: ['member', 'expert', 'admin'],
    default: 'member'
  },
  expertProfile: {
    title: { type: String, trim: true, maxlength: 80, default: '' },
    categories: [{ type: String, enum: ['mentor', 'therapist', 'career_coach'] }],
    bio: { type: String, trim: true, maxlength: 600, default: '' },
    meetingLink: { type: String, trim: true, maxlength: 300, default: '' },
    slotMinutes: { type: Number, enum: [30, 45, 60], default: 30 },
    // Weekly availability in the expert's own timezone: day 0 = Sunday … 6 = Saturday.
    availability: [{
      day: { type: Number, min: 0, max: 6, required: true },
      start: { type: String, match: /^\d{2}:\d{2}$/, required: true },
      end: { type: String, match: /^\d{2}:\d{2}$/, required: true },
      _id: false
    }]
  },
  // The year the streak counter is showing (X/365). When a new year starts, the user flips it over.
  streakYear: {
    type: Number,
    default: null
  },
  // Password reset: only a SHA-256 hash of the emailed token is stored; it expires after an hour.
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  passwordResetRequestedAt: { type: Date, select: false },
  // Sign-ins issued before this moment are no longer accepted (set when a password is reset).
  passwordChangedAt: { type: Date }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/** Community access: premium plan and (if set) not yet expired. */
userSchema.methods.hasCommunityAccess = function() {
  if (this.role === 'expert' || this.role === 'admin') return true;
  return this.plan === 'premium' && (!this.premiumUntil || this.premiumUntil > new Date());
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.passwordResetRequestedAt;
  obj.communityAccess = this.hasCommunityAccess();
  return obj;
};

module.exports = mongoose.model('User', userSchema);
