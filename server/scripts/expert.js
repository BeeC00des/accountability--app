/**
 * Manage Community experts (mentor, therapist, career coach).
 *
 *   npm run expert -- list
 *   npm run expert -- add someone@example.com --name "Dr Ada Obi" --title "Licensed therapist" --categories therapist,mentor
 *   npm run expert -- remove someone@example.com
 *
 * "add" turns an existing account into an expert, or creates one and emails a link to set a password
 * (valid 7 days). Without email set up, the link is printed here instead.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { sendMail, escape } = require('../services/mailer');

const CATEGORIES = ['mentor', 'therapist', 'career_coach'];
const [command, email, ...rest] = process.argv.slice(2);
const flag = name => { const index = rest.indexOf(`--${name}`); return index >= 0 ? rest[index + 1] : undefined; };
const site = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) { console.error('MONGODB_URI is missing from server/.env'); process.exit(1); }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    if (!command || command === 'list') {
      const experts = await User.find({ role: 'expert' }).select('name email expertProfile.title expertProfile.categories');
      console.log(`\nExperts (${experts.length}):`);
      experts.forEach(e => console.log(`  ${e.email}  ·  ${e.name}  ·  ${e.expertProfile?.title || '—'}  ·  ${(e.expertProfile?.categories || []).join(', ')}`));
      console.log('\nAdd:    npm run expert -- add someone@example.com --name "Name" --title "Title" --categories mentor,therapist,career_coach\nRemove: npm run expert -- remove someone@example.com\n');
      return;
    }
    if (!email) throw new Error('Give an email address.');
    const address = email.trim().toLowerCase();

    if (command === 'remove') {
      const user = await User.findOneAndUpdate({ email: address, role: 'expert' }, { role: 'member' }, { new: true });
      if (!user) throw new Error(`No expert found for ${address}`);
      console.log(`${user.email} is no longer an expert.`);
      return;
    }
    if (command !== 'add') throw new Error(`Unknown command "${command}". Use list, add or remove.`);

    const categories = (flag('categories') || '').split(',').map(c => c.trim()).filter(Boolean);
    if (!categories.length || categories.some(c => !CATEGORIES.includes(c))) throw new Error(`--categories must be any of: ${CATEGORIES.join(', ')}`);
    let user = await User.findOne({ email: address });
    let link = '';
    if (!user) {
      const name = flag('name');
      if (!name) throw new Error('New experts need --name "Their name".');
      user = await User.create({ name, email: address, password: crypto.randomBytes(24).toString('hex') });
      const token = crypto.randomBytes(32).toString('hex');
      await User.updateOne({ _id: user._id }, { passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'), passwordResetExpires: new Date(Date.now() + 7 * 86400000) });
      link = `${site}/reset-password?token=${token}`;
    }
    user.role = 'expert';
    user.expertProfile = { ...(user.expertProfile?.toObject?.() || {}), categories, title: flag('title') || user.expertProfile?.title || '' };
    await user.save();

    const mail = await sendMail({
      to: user.email,
      subject: 'You’re invited to be a doerstab Community expert',
      text: `Hi ${user.name},\n\nYou've been added as a doerstab Community expert (${categories.join(', ').replace('career_coach', 'career coach')}).\n${link ? `Set your password (link valid 7 days): ${link}\n` : `Sign in at ${site}/auth\n`}\nThen open your expert dashboard to set your availability and call link.\n\n— doerstab`,
      html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px"><h2 style="margin:0 0 12px">Welcome to the doerstab Community</h2>
        <p style="margin:0 0 16px">Hi ${escape(user.name)}, you've been added as a Community expert (${escape(categories.join(', ').replace('career_coach', 'career coach'))}).</p>
        <p style="margin:0 0 20px"><a href="${link || `${site}/auth`}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">${link ? 'Set your password' : 'Sign in'}</a></p>
        <p style="margin:0;color:#777;font-size:13px">Then open your expert dashboard to set your availability and video-call link.</p></div>`
    });
    console.log(`${user.email} (${user.name}) is now an expert: ${categories.join(', ')}.`);
    if (!mail.sent) console.log(`Invite email not sent (${mail.reason}).${link ? `\nSend them this link to set a password: ${link}` : ''}`);
    else console.log('Invite email sent.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
