/*
 * Paid Community: experts (mentor, therapist, career coach), member ↔ expert connections,
 * bookable time slots, and the expert's tools for following and shaping a member's goals.
 */
const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Activity = require('../models/Activity');
const Reminder = require('../models/Reminder');
const ExpertConnection = require('../models/ExpertConnection');
const Booking = require('../models/Booking');
const { protect } = require('../middleware/auth');
const { requirePremium } = require('../middleware/premium');
const { handleValidation, isObjectId, requireObjectIds } = require('../utils/validate');
const { getLocalDateKey, zonedMidnight } = require('../utils/timezone');
const { shiftKey } = require('../services/activity');
const { decorateGoal } = require('../services/goalStats');
const { sendMail, escape } = require('../services/mailer');

const CATEGORIES = ['mentor', 'therapist', 'career_coach'];
const CATEGORY_LABEL = { mentor: 'mentor', therapist: 'therapist', career_coach: 'career coach' };
const BOOK_DAYS = 21; // how far ahead members can book
const MIN_LEAD_MS = 2 * 60 * 60 * 1000; // book at least 2 hours ahead
const MAX_TODOS = 50;
const PUBLIC_EXPERT = 'name avatar timezone expertProfile.title expertProfile.bio expertProfile.categories expertProfile.slotMinutes';

const siteUrl = path => `${(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '')}${path}`;
const presentExpert = expert => expert && ({
  _id: expert._id,
  name: expert.name,
  avatar: expert.avatar,
  title: expert.expertProfile?.title || '',
  bio: expert.expertProfile?.bio || '',
  categories: expert.expertProfile?.categories || [],
  slotMinutes: expert.expertProfile?.slotMinutes || 30,
  timezone: expert.timezone || 'UTC'
});
const when = (date, timezone) => new Date(date).toLocaleString('en-GB', { timeZone: timezone || 'UTC', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

/** In-app message + email (email in the background; never blocks the request). */
const notify = async ({ from, to, message, subject, heading, lead, button, path }) => {
  await Reminder.create({ from: from._id, to: to._id, type: 'system', message: message.slice(0, 300) }).catch(() => {});
  if (!to.email || to.notificationsEnabled === false) return;
  const link = siteUrl(path);
  sendMail({
    to: to.email,
    subject,
    text: `Hi ${to.name},\n\n${lead}\n\n${button}: ${link}\n\n— doerstab`,
    html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px"><h2 style="margin:0 0 12px">${escape(heading)}</h2>
      <p style="margin:0 0 20px">Hi ${escape(to.name)}, ${escape(lead)}</p>
      <p style="margin:0"><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">${escape(button)}</a></p></div>`
  }).then(result => { if (!result.sent) console.warn(`Community email not sent (${result.reason})`); });
};

/** Free slots for an expert over the next BOOK_DAYS days, as { start, end } ISO strings. */
const freeSlots = async expert => {
  const timezone = expert.timezone || 'UTC';
  const minutes = expert.expertProfile?.slotMinutes || 30;
  const windows = expert.expertProfile?.availability || [];
  if (!windows.length) return [];
  const now = Date.now();
  const today = getLocalDateKey(new Date(), timezone);
  const horizon = new Date(now + (BOOK_DAYS + 1) * 86400000);
  const taken = new Set((await Booking.find({ expert: expert._id, status: 'booked', start: { $gte: new Date(now), $lte: horizon } }).select('start')).map(b => b.start.getTime()));
  const slots = [];
  for (let offset = 0; offset < BOOK_DAYS; offset += 1) {
    const key = shiftKey(today, offset);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    const midnight = zonedMidnight(key, timezone).getTime();
    windows.filter(window => window.day === weekday).forEach(window => {
      const [sh, sm] = window.start.split(':').map(Number);
      const [eh, em] = window.end.split(':').map(Number);
      for (let at = sh * 60 + sm; at + minutes <= eh * 60 + em; at += minutes) {
        const start = midnight + at * 60000;
        if (start < now + MIN_LEAD_MS || taken.has(start)) continue;
        slots.push({ start: new Date(start).toISOString(), end: new Date(start + minutes * 60000).toISOString() });
      }
    });
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
};

const requireExpert = (req, res, next) => (req.user.role === 'expert' || req.user.role === 'admin' ? next() : res.status(403).json({ message: 'Only Community experts can do this.' }));

/** The expert's active connection with a member (the member must still have Community access). */
const memberFor = async (req, res) => {
  const connection = await ExpertConnection.findOne({ expert: req.user._id, member: req.params.memberId, status: 'active' });
  if (!connection) { res.status(404).json({ message: 'This member isn’t connected with you.' }); return null; }
  const member = await User.findById(req.params.memberId);
  if (!member || !member.hasCommunityAccess()) { res.status(403).json({ message: 'This member’s Community membership has ended.' }); return null; }
  return { connection, member };
};

const router = express.Router();
router.use(protect);

/* ================= Members ================= */

// GET /api/community/experts?category=mentor - Experts available in a category
router.get('/experts', requirePremium, [query('category').optional().isIn(CATEGORIES), handleValidation], async (req, res) => {
  try {
    const filter = { role: 'expert', ...(req.query.category ? { 'expertProfile.categories': req.query.category } : {}) };
    const experts = await User.find(filter).select(PUBLIC_EXPERT).sort({ name: 1 }).limit(100);
    res.json({ experts: experts.map(presentExpert) });
  } catch (error) {
    console.error('List experts error:', error);
    res.status(500).json({ message: 'Could not load experts.' });
  }
});

// GET /api/community/my-experts - My chosen expert per category, plus upcoming sessions
router.get('/my-experts', requirePremium, async (req, res) => {
  try {
    const connections = await ExpertConnection.find({ member: req.user._id, status: 'active' }).populate('expert', PUBLIC_EXPERT);
    const bookings = await Booking.find({ member: req.user._id, status: 'booked', end: { $gte: new Date() } }).populate('expert', 'name avatar expertProfile.title expertProfile.meetingLink timezone').sort({ start: 1 }).limit(20);
    res.json({
      experts: Object.fromEntries(connections.filter(c => c.expert).map(c => [c.category, presentExpert(c.expert)])),
      bookings: bookings.map(b => ({ _id: b._id, category: b.category, start: b.start, end: b.end, note: b.note, expert: presentExpert(b.expert), meetingLink: b.expert?.expertProfile?.meetingLink || '' })),
      premiumUntil: req.user.premiumUntil
    });
  } catch (error) {
    console.error('My experts error:', error);
    res.status(500).json({ message: 'Could not load your experts.' });
  }
});

// POST /api/community/connect { expertId, category } - Choose (or switch) my expert for a category
router.post('/connect', requirePremium, [body('expertId').custom(isObjectId), body('category').isIn(CATEGORIES), handleValidation], async (req, res) => {
  try {
    const expert = await User.findOne({ _id: req.body.expertId, role: 'expert', 'expertProfile.categories': req.body.category });
    if (!expert) return res.status(404).json({ message: 'That expert isn’t available for this category.' });
    if (String(expert._id) === String(req.user._id)) return res.status(400).json({ message: 'You can’t choose yourself.' });
    await ExpertConnection.updateMany({ member: req.user._id, category: req.body.category, status: 'active' }, { status: 'ended' });
    await ExpertConnection.create({ member: req.user._id, expert: expert._id, category: req.body.category });
    await notify({
      from: req.user, to: expert,
      message: `👋 ${req.user.name} chose you as their ${CATEGORY_LABEL[req.body.category]} on doerstab.`,
      subject: `${req.user.name} chose you as their ${CATEGORY_LABEL[req.body.category]}`,
      heading: 'You have a new member',
      lead: `${req.user.name} chose you as their ${CATEGORY_LABEL[req.body.category]}. You can now see their goals and daily progress, and add steps to help them get there.`,
      button: 'Open your expert dashboard', path: '/expert'
    });
    res.status(201).json({ message: `${expert.name} is now your ${CATEGORY_LABEL[req.body.category]}.`, expert: presentExpert(expert) });
  } catch (error) {
    console.error('Connect expert error:', error);
    res.status(500).json({ message: 'Could not choose this expert.' });
  }
});

// GET /api/community/experts/:expertId/slots - Bookable times for the next three weeks
router.get('/experts/:expertId/slots', requirePremium, requireObjectIds('expertId'), async (req, res) => {
  try {
    const expert = await User.findOne({ _id: req.params.expertId, role: 'expert' }).select('name timezone expertProfile');
    if (!expert) return res.status(404).json({ message: 'Expert not found.' });
    res.json({ slots: await freeSlots(expert), slotMinutes: expert.expertProfile?.slotMinutes || 30, timezone: expert.timezone || 'UTC' });
  } catch (error) {
    console.error('Slots error:', error);
    res.status(500).json({ message: 'Could not load available times.' });
  }
});

// POST /api/community/bookings { expertId, category, start, note } - Book a session
router.post('/bookings', requirePremium, [
  body('expertId').custom(isObjectId),
  body('category').isIn(CATEGORIES),
  body('start').isISO8601().withMessage('Pick a time.'),
  body('note').optional().isString().trim().isLength({ max: 500 }),
  handleValidation
], async (req, res) => {
  try {
    const connected = await ExpertConnection.exists({ member: req.user._id, expert: req.body.expertId, category: req.body.category, status: 'active' });
    if (!connected) return res.status(403).json({ message: 'Choose this expert for the category first.' });
    const expert = await User.findOne({ _id: req.body.expertId, role: 'expert' });
    if (!expert) return res.status(404).json({ message: 'Expert not found.' });
    const start = new Date(req.body.start);
    const slot = (await freeSlots(expert)).find(item => new Date(item.start).getTime() === start.getTime());
    if (!slot) return res.status(409).json({ message: 'That time is no longer available. Pick another one.' });
    const openWithExpert = await Booking.countDocuments({ member: req.user._id, expert: expert._id, status: 'booked', end: { $gte: new Date() } });
    if (openWithExpert >= 3) return res.status(429).json({ message: 'You already have 3 upcoming sessions with this expert.' });
    let booking;
    try {
      booking = await Booking.create({ member: req.user._id, expert: expert._id, category: req.body.category, start, end: new Date(slot.end), note: req.body.note || '' });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Someone just booked that time. Pick another one.' });
      throw error;
    }
    const link = expert.expertProfile?.meetingLink;
    await notify({
      from: req.user, to: expert,
      message: `📅 ${req.user.name} booked a session: ${when(start, expert.timezone)}.`,
      subject: `New session booked: ${req.user.name}`,
      heading: 'New session booked',
      lead: `${req.user.name} booked a ${CATEGORY_LABEL[req.body.category]} session with you on ${when(start, expert.timezone)}.${req.body.note ? ` Their note: “${req.body.note}”` : ''}`,
      button: 'See your sessions', path: '/expert'
    });
    await notify({
      from: expert, to: req.user,
      message: `📅 Session booked with ${expert.name}: ${when(start, req.user.timezone)}.`,
      subject: `Your session with ${expert.name} is booked`,
      heading: 'Your session is booked',
      lead: `Your ${CATEGORY_LABEL[req.body.category]} session with ${expert.name} is on ${when(start, req.user.timezone)}.${link ? ` Join here: ${link}` : ' They’ll share the call link before the session.'}`,
      button: 'See your sessions', path: '/community'
    });
    res.status(201).json({ message: 'Session booked.', booking: { _id: booking._id, start: booking.start, end: booking.end, category: booking.category, meetingLink: link || '' } });
  } catch (error) {
    console.error('Book session error:', error);
    res.status(500).json({ message: 'Could not book this session.' });
  }
});

// POST /api/community/bookings/:id/cancel - Member or expert cancels
router.post('/bookings/:id/cancel', requireObjectIds('id'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, status: 'booked', $or: [{ member: req.user._id }, { expert: req.user._id }] });
    if (!booking) return res.status(404).json({ message: 'Session not found.' });
    if (booking.start < new Date()) return res.status(400).json({ message: 'This session has already started.' });
    booking.status = 'cancelled';
    booking.cancelledBy = req.user._id;
    await booking.save();
    const otherId = String(booking.member) === String(req.user._id) ? booking.expert : booking.member;
    const other = await User.findById(otherId);
    if (other) {
      await notify({
        from: req.user, to: other,
        message: `❌ ${req.user.name} cancelled the session on ${when(booking.start, other.timezone)}.`,
        subject: `Session cancelled by ${req.user.name}`,
        heading: 'Session cancelled',
        lead: `${req.user.name} cancelled the session on ${when(booking.start, other.timezone)}.`,
        button: 'Open doerstab', path: other.role === 'expert' ? '/expert' : '/community'
      });
    }
    res.json({ message: 'Session cancelled.' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ message: 'Could not cancel this session.' });
  }
});

/* ================= Experts ================= */

// GET /api/community/expert/me - My expert profile, members and upcoming sessions
router.get('/expert/me', requireExpert, async (req, res) => {
  try {
    const connections = await ExpertConnection.find({ expert: req.user._id, status: 'active' }).populate('member', 'name avatar email streak lastCheckIn plan premiumUntil role timezone');
    const members = connections.filter(c => c.member).map(c => ({ category: c.category, since: c.createdAt, member: { _id: c.member._id, name: c.member.name, avatar: c.member.avatar, streak: c.member.streak, lastCheckIn: c.member.lastCheckIn, active: c.member.hasCommunityAccess() } }));
    const bookings = await Booking.find({ expert: req.user._id, status: 'booked', end: { $gte: new Date() } }).populate('member', 'name avatar').sort({ start: 1 }).limit(50);
    res.json({
      profile: { ...presentExpert(req.user), meetingLink: req.user.expertProfile?.meetingLink || '', availability: req.user.expertProfile?.availability || [] },
      members,
      bookings: bookings.map(b => ({ _id: b._id, category: b.category, start: b.start, end: b.end, note: b.note, member: b.member && { _id: b.member._id, name: b.member.name, avatar: b.member.avatar } }))
    });
  } catch (error) {
    console.error('Expert dashboard error:', error);
    res.status(500).json({ message: 'Could not load your dashboard.' });
  }
});

// PUT /api/community/expert/profile - Title, bio, call link, session length and weekly availability
router.put('/expert/profile', requireExpert, [
  body('title').optional().isString().trim().isLength({ max: 80 }),
  body('bio').optional().isString().trim().isLength({ max: 600 }),
  body('meetingLink').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true }).withMessage('Use a full https:// link (Zoom, Google Meet, etc.).'),
  body('slotMinutes').optional().isIn([30, 45, 60]).toInt(),
  body('availability').optional().isArray({ max: 28 }),
  handleValidation
], async (req, res) => {
  try {
    const profile = req.user.expertProfile || {};
    ['title', 'bio', 'meetingLink', 'slotMinutes'].forEach(key => { if (req.body[key] !== undefined) profile[key] = req.body[key]; });
    if (Array.isArray(req.body.availability)) {
      const valid = req.body.availability.filter(item => Number.isInteger(item?.day) && item.day >= 0 && item.day <= 6 && /^\d{2}:\d{2}$/.test(item.start) && /^\d{2}:\d{2}$/.test(item.end) && item.start < item.end);
      if (valid.length !== req.body.availability.length) return res.status(400).json({ message: 'Each time window needs a day and a start before its end.' });
      profile.availability = valid.map(({ day, start, end }) => ({ day, start, end }));
    }
    req.user.expertProfile = profile;
    await req.user.save();
    res.json({ message: 'Profile saved.', profile: { ...presentExpert(req.user), meetingLink: profile.meetingLink || '', availability: profile.availability || [] } });
  } catch (error) {
    console.error('Expert profile error:', error);
    res.status(500).json({ message: 'Could not save your profile.' });
  }
});

// GET /api/community/expert/members/:memberId - A member's goals and the last 14 days of activity
router.get('/expert/members/:memberId', requireExpert, requireObjectIds('memberId'), async (req, res) => {
  try {
    const found = await memberFor(req, res);
    if (!found) return;
    const { member, connection } = found;
    const timezone = member.timezone || 'UTC';
    const today = getLocalDateKey(new Date(), timezone);
    const from = shiftKey(today, -13);
    const [goals, activity] = await Promise.all([
      Goal.find({ owner: member._id, isActive: true }).sort({ createdAt: -1 }),
      Activity.find({ user: member._id, dateKey: { $gte: from } }).select('dateKey type')
    ]);
    const byDay = Array.from({ length: 14 }, (_, index) => {
      const key = shiftKey(from, index);
      const items = activity.filter(item => item.dateKey === key);
      return { date: key, checkins: items.filter(item => item.type === 'checkin').length, steps: items.filter(item => item.type === 'step').length };
    });
    res.json({
      member: { _id: member._id, name: member.name, avatar: member.avatar, streak: member.streak, lastCheckIn: member.lastCheckIn, timezone, category: connection.category },
      // Private check-in notes stay private; experts see progress and moods.
      goals: goals.map(goal => {
        const decorated = decorateGoal(goal, timezone);
        decorated.checkIns = (goal.checkIns || []).slice(-30).map(c => ({ date: c.date, completed: c.completed, mood: c.mood }));
        return decorated;
      }),
      days: byDay
    });
  } catch (error) {
    console.error('Expert member view error:', error);
    res.status(500).json({ message: 'Could not load this member.' });
  }
});

// POST /api/community/expert/members/:memberId/goals - Draft a new goal (with steps) on the member's board
router.post('/expert/members/:memberId/goals', requireExpert, requireObjectIds('memberId'), [
  body('title').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name the goal (2–100 characters).'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('frequency').optional().isIn(['daily', 'weekly']),
  body('targetDays').optional().isInt({ min: 7, max: 3650 }).toInt(),
  body('emoji').optional().isString().isLength({ min: 1, max: 8 }),
  body('steps').optional().isArray({ max: MAX_TODOS }),
  handleValidation
], async (req, res) => {
  try {
    const found = await memberFor(req, res);
    if (!found) return;
    const { member, connection } = found;
    const targetDays = req.body.targetDays || 30;
    const startDate = new Date();
    const steps = (req.body.steps || []).filter(step => typeof step === 'string' && step.trim()).slice(0, MAX_TODOS)
      .map(step => ({ title: step.trim().slice(0, 200), addedBy: req.user._id, addedByName: req.user.name, addedByRole: connection.category }));
    const goal = await Goal.create({
      owner: member._id,
      title: req.body.title,
      description: req.body.description || '',
      frequency: req.body.frequency || 'daily',
      category: connection.category === 'career_coach' ? 'career' : 'personal',
      targetDays, startDate, endDate: new Date(startDate.getTime() + targetDays * 86400000),
      emoji: req.body.emoji || '🎯',
      isPublic: false,
      todos: steps,
      createdByExpert: req.user._id,
      createdByExpertName: req.user.name
    });
    await notify({
      from: req.user, to: member,
      message: `🧭 Your ${CATEGORY_LABEL[connection.category]} ${req.user.name} added a goal for you: “${goal.title}”${steps.length ? ` with ${steps.length} steps` : ''}.`,
      subject: `${req.user.name} drafted a goal for you`,
      heading: 'A new goal on your board',
      lead: `Your ${CATEGORY_LABEL[connection.category]} ${req.user.name} added “${goal.title}” to your goals${steps.length ? ` with ${steps.length} steps to get there` : ''}.`,
      button: 'Open your goals', path: '/goals'
    });
    res.status(201).json({ message: 'Goal added to their board.', goal: decorateGoal(goal, member.timezone || 'UTC') });
  } catch (error) {
    console.error('Expert add goal error:', error);
    res.status(500).json({ message: 'Could not add this goal.' });
  }
});

// POST /api/community/expert/members/:memberId/goals/:goalId/steps { title } - Add a step to one of the member's goals
router.post('/expert/members/:memberId/goals/:goalId/steps', requireExpert, requireObjectIds('memberId', 'goalId'), [
  body('title').isString().trim().isLength({ min: 2, max: 200 }).withMessage('Describe the step (2–200 characters).'),
  body('dueDate').optional({ values: 'falsy' }).isISO8601(),
  handleValidation
], async (req, res) => {
  try {
    const found = await memberFor(req, res);
    if (!found) return;
    const { member, connection } = found;
    const goal = await Goal.findOne({ _id: req.params.goalId, owner: member._id, isActive: true });
    if (!goal) return res.status(404).json({ message: 'Goal not found.' });
    if (goal.todos.length >= MAX_TODOS) return res.status(400).json({ message: `A goal can have up to ${MAX_TODOS} steps.` });
    goal.todos.push({ title: req.body.title.trim(), dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined, addedBy: req.user._id, addedByName: req.user.name, addedByRole: connection.category });
    await goal.save();
    await notify({
      from: req.user, to: member,
      message: `🧭 ${req.user.name} added a step to “${goal.title}”: ${req.body.title.trim()}`,
      subject: `New step from ${req.user.name}`,
      heading: 'A new step on your goal',
      lead: `Your ${CATEGORY_LABEL[connection.category]} ${req.user.name} added a step to “${goal.title}”: ${req.body.title.trim()}`,
      button: 'See the goal', path: `/goals?goal=${goal._id}`
    });
    res.status(201).json({ message: 'Step added.', goal: decorateGoal(goal, member.timezone || 'UTC') });
  } catch (error) {
    console.error('Expert add step error:', error);
    res.status(500).json({ message: 'Could not add this step.' });
  }
});

module.exports = router;
