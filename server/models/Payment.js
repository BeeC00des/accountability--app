const mongoose = require('mongoose');

/** One Community membership payment through Bachs (hosted checkout). */
const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  product: { type: String, enum: ['community_annual'], default: 'community_annual' },
  amount: { type: String, required: true }, // decimal string, e.g. "22000.00"
  currency: { type: String, default: 'NGN' },
  checkoutId: { type: String, index: true, sparse: true },
  chargeId: { type: String },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending', index: true },
  paidAt: { type: Date },
  accessUntil: { type: Date },
  events: [{ type: String }] // processed webhook envelope ids (dedupe)
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
