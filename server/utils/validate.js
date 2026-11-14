const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

const isObjectId = value => mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value);

/** Rejects requests whose named route params are not valid ObjectIds (prevents CastError 500s). */
const requireObjectIds = (...params) => (req, res, next) => {
  const invalid = params.find(param => !isObjectId(req.params[param]));
  if (invalid) return res.status(400).json({ message: `Invalid ${invalid}.` });
  next();
};

/** Sends the first express-validator error as { message, errors } so clients have one shape to read. */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const list = errors.array();
  res.status(400).json({ message: list[0].msg, errors: list });
};

module.exports = { isObjectId, requireObjectIds, handleValidation };
