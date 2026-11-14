const mongoose = require('mongoose');

const PERIODS = ['year', 'h1', 'h2', 'q1', 'q2', 'q3', 'q4', 'q1-q3', 'q2-q4'];
const THEMES = ['lime', 'cream', 'midnight'];
const TEXT_COLORS = ['lime', 'yellow', 'pink', 'blue', 'ink'];

const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'text'], required: true },
  // image items
  imageUrl: { type: String, maxlength: 400 * 1024 }, // https://i.pinimg.com/... or a resized data URL upload
  source: { type: String, enum: ['pinterest', 'upload', ''], default: '' },
  sourceUrl: { type: String, maxlength: 500, default: '' },
  width: Number,
  height: Number,
  // text items
  text: { type: String, trim: true, maxlength: 120, default: '' },
  color: { type: String, enum: TEXT_COLORS, default: 'lime' },
  // shared
  caption: { type: String, trim: true, maxlength: 80, default: '' }
}, { timestamps: true });

const visionBoardSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  year: { type: Number, min: 2020, max: 2100, required: true },
  period: { type: String, enum: PERIODS, required: true },
  title: { type: String, trim: true, maxlength: 60, default: '' },
  theme: { type: String, enum: THEMES, default: 'lime' },
  items: [itemSchema]
}, { timestamps: true });

visionBoardSchema.index({ owner: 1, year: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('VisionBoard', visionBoardSchema);
module.exports.PERIODS = PERIODS;
module.exports.THEMES = THEMES;
module.exports.TEXT_COLORS = TEXT_COLORS;
