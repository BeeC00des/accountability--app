const crypto = require('crypto');
const User = require('../models/User');

const newFriendCode = () => `AC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

/** Returns the user's shareable friend/referral code, creating a unique one on first use. */
const ensureFriendCode = async userId => {
  let user = await User.findById(userId).select('friendCode');
  for (let attempt = 0; attempt < 5 && !user?.friendCode; attempt += 1) {
    try {
      user = await User.findOneAndUpdate(
        { _id: userId, $or: [{ friendCode: { $exists: false } }, { friendCode: null }, { friendCode: '' }] },
        { $set: { friendCode: newFriendCode() } },
        { new: true }
      ).select('friendCode') || await User.findById(userId).select('friendCode');
    } catch (error) {
      if (error.code !== 11000) throw error; // Collision: retry with a new code.
    }
  }
  return user?.friendCode || null;
};

module.exports = { ensureFriendCode };
