/** Blocks Premium-only routes (Community) unless the account has active access. Use after `protect`. */
const requirePremium = (req, res, next) => {
  if (req.user?.hasCommunityAccess?.()) return next();
  const expired = req.user?.plan === 'premium' && req.user?.premiumUntil && req.user.premiumUntil <= new Date();
  return res.status(403).json({
    code: expired ? 'PREMIUM_EXPIRED' : 'PREMIUM_REQUIRED',
    message: expired ? 'Your Community membership has ended. Renew to keep your experts and sessions.' : 'Community is a paid membership. Join to unlock it.'
  });
};

module.exports = { requirePremium };
