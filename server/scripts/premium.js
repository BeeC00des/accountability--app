/**
 * Manage Premium (unlocks Community).
 *   npm run premium                     list pending requests and premium members
 *   npm run premium -- <email>          turn Premium on
 *   npm run premium -- <email> free     turn Premium off
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const [email, plan = 'premium'] = process.argv.slice(2);

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) { console.error('MONGO_URI is missing from server/.env'); process.exit(1); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    if (!email) {
      const [requests, members] = await Promise.all([
        User.find({ plan: { $ne: 'premium' }, premiumRequestedAt: { $ne: null } }).select('name email premiumRequestedAt').sort({ premiumRequestedAt: 1 }),
        User.find({ plan: 'premium' }).select('name email')
      ]);
      console.log(`\nPending Premium requests (${requests.length}):`);
      requests.forEach(user => console.log(`  ${user.email}  ·  ${user.name}  ·  ${user.premiumRequestedAt.toISOString().slice(0, 10)}`));
      console.log(`\nPremium members (${members.length}):`);
      members.forEach(user => console.log(`  ${user.email}  ·  ${user.name}`));
      console.log('\nGrant:   npm run premium -- someone@example.com\nRemove:  npm run premium -- someone@example.com free\n');
      return;
    }
    if (!['premium', 'free'].includes(plan)) throw new Error('Plan must be "premium" or "free".');
    const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() }, { $set: { plan } }, { new: true }).select('name email plan');
    if (!user) throw new Error(`No account found for ${email}`);
    console.log(`${user.email} (${user.name}) is now on the ${user.plan === 'premium' ? 'Premium' : 'Free'} plan.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
