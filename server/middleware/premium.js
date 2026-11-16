/** Blocks Premium-only routes (Community) for free accounts. Use after `protect`. */
const requirePremium = (req, res, next) => {
  if (req.user?.plan === 'premium') return next();
  return res.status(403).json({ code: 'PREMIUM_REQUIRED', message: 'Community is a Premium feature. Request Premium to unlock it.' });
};

module.exports = { requirePremium };
