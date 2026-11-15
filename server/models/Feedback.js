const mongoose = require('mongoose');

/** Product feedback from the landing page or the app (signed in or anonymous). */
const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  kind: { type: String, enum: ['idea', 'bug', 'praise', 'other'], default: 'idea' },
  message: { type: String, trim: true, minlength: 5, maxlength: 2000, required: true },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  page: { type: String, trim: true, maxlength: 200, default: '' },
  status: { type: String, enum: ['new', 'read', 'done'], default: 'new' }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
