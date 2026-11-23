const mongoose = require('mongoose');

/** A session a member booked with an expert. */
const bookingSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expert: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: ['mentor', 'therapist', 'career_coach'], required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['booked', 'cancelled'], default: 'booked' },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// No double-booking: one active booking per expert per start time.
bookingSchema.index({ expert: 1, start: 1 }, { unique: true, partialFilterExpression: { status: 'booked' } });

module.exports = mongoose.model('Booking', bookingSchema);
