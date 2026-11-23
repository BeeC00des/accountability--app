const express = require('express');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Reminder = require('../models/Reminder');
const { protect } = require('../middleware/auth');
const { requireObjectIds } = require('../utils/validate');
const { getLocalDateKey } = require('../utils/timezone');
const { decorateGoal } = require('../services/goalStats');
const { ensureFriendCode } = require('../services/friendCode');
const { sendMail, escape } = require('../services/mailer');

/** Emails a friend-request notification in the background; the in-app flow never waits for it. */
const appLink = path => `${(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '')}${path}`;
const emailFriend = ({ to, subject, heading, lead, button, path }) => {
  if (!to?.email || to.notificationsEnabled === false) return;
  const link = appLink(path);
  sendMail({
    to: to.email,
    subject,
    text: `Hi ${to.name},\n\n${lead}\n\n${button}: ${link}\n\n— doerstab`,
    html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px">
      <h2 style="margin:0 0 12px">${escape(heading)}</h2>
      <p style="margin:0 0 20px">Hi ${escape(to.name)}, ${escape(lead)}</p>
      <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">${escape(button)}</a></p>
      <p style="margin:0;color:#777;font-size:13px">You get these emails because notifications are on. Turn them off in your doerstab profile.</p></div>`
  }).then(result => { if (!result.sent) console.warn(`Friend email not sent (${result.reason})`); });
};

const router = express.Router();
router.use(protect);

const PUBLIC_FIELDS = 'name email avatar bio streak lastCheckIn createdAt friendCode timezone';

// GET /api/friends - Friends with what you need to decide who to nudge
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', PUBLIC_FIELDS);
    const friendIds = user.friends.map(friend => friend._id);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [goalCounts, recentNudges] = await Promise.all([
      Goal.aggregate([
        { $match: { owner: { $in: friendIds }, isActive: true, isPublic: true, isCompleted: { $ne: true } } },
        { $group: { _id: '$owner', count: { $sum: 1 } } }
      ]),
      Reminder.aggregate([
        { $match: { from: req.user._id, to: { $in: friendIds }, createdAt: { $gte: dayAgo } } },
        { $group: { _id: '$to', count: { $sum: 1 }, last: { $max: '$createdAt' } } }
      ])
    ]);
    const countBy = new Map(goalCounts.map(row => [String(row._id), row.count]));
    const nudgeBy = new Map(recentNudges.map(row => [String(row._id), row]));

    const friends = user.friends.map(friend => {
      const timezone = friend.timezone || 'UTC';
      const checkedInToday = Boolean(friend.lastCheckIn) &&
        getLocalDateKey(friend.lastCheckIn, timezone) === getLocalDateKey(new Date(), timezone);
      const { timezone: _omit, ...rest } = friend.toJSON();
      return {
        ...rest,
        checkedInToday,
        sharedGoalCount: countBy.get(String(friend._id)) || 0,
        nudgesSentToday: nudgeBy.get(String(friend._id))?.count || 0,
        lastNudgedAt: nudgeBy.get(String(friend._id))?.last || null
      };
    });
    // People who still need to check in first, then by name.
    friends.sort((a, b) => Number(a.checkedInToday) - Number(b.checkedInToday) || a.name.localeCompare(b.name));
    res.json({ friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Could not load friends.' });
  }
});

// GET /api/friends/code
router.get('/code', async (req, res) => {
  try {
    const friendCode = await ensureFriendCode(req.user._id);
    if (!friendCode) return res.status(503).json({ message: 'Could not create a friend code. Please try again.' });
    res.json({ friendCode });
  } catch (error) {
    console.error('Friend code error:', error);
    res.status(500).json({ message: 'Could not load your friend code.' });
  }
});

// GET /api/friends/requests - Incoming and outgoing pending requests
router.get('/requests', async (req, res) => {
  try {
    const [user, outgoingUsers] = await Promise.all([
      User.findById(req.user._id).populate('friendRequests.from', 'name email friendCode'),
      User.find({ friendRequests: { $elemMatch: { from: req.user._id, status: 'pending' } } }).select('name email friendCode friendRequests')
    ]);
    const requests = user.friendRequests.filter(request => request.status === 'pending' && request.from);
    const sent = outgoingUsers.map(target => {
      const request = target.friendRequests.find(item => item.from.equals(req.user._id) && item.status === 'pending');
      return { _id: request._id, to: { _id: target._id, name: target.name, email: target.email }, createdAt: request.createdAt };
    });
    res.json({ requests, sent });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Could not load friend requests.' });
  }
});

// POST /api/friends/search - Exact email or friend code
router.post('/search', async (req, res) => {
  try {
    const raw = typeof req.body.query === 'string' ? req.body.query : (typeof req.body.email === 'string' ? req.body.email : '');
    const query = raw.trim();
    if (!query || query.length > 254) return res.status(400).json({ message: 'Enter an email address or friend code.' });

    const isEmail = query.includes('@');
    const code = query.replace(/[^a-z0-9]/gi, '').toUpperCase().replace(/^AC/, '');
    const lookup = isEmail ? { email: query.toLowerCase() } : { friendCode: `AC-${code}` };
    const target = await User.findOne({ ...lookup, _id: { $ne: req.user._id } }).select('name email avatar streak friendCode friends friendRequests');
    if (!target) return res.status(404).json({ message: 'No account found. Check the email or friend code and try again.' });

    const currentUser = await User.findById(req.user._id).select('friendRequests');
    const incoming = currentUser.friendRequests.find(request => request.from.equals(target._id) && request.status === 'pending');

    res.json({
      user: { _id: target._id, name: target.name, email: target.email, avatar: target.avatar, streak: target.streak, friendCode: target.friendCode },
      isAlreadyFriend: target.friends.some(id => id.equals(req.user._id)),
      hasPendingRequest: target.friendRequests.some(request => request.from.equals(req.user._id) && request.status === 'pending'),
      receivedRequestId: incoming?._id || null
    });
  } catch (error) {
    console.error('Friend search error:', error);
    res.status(500).json({ message: 'Could not search for that account.' });
  }
});

// POST /api/friends/request/:userId - Send a request
router.post('/request/:userId', requireObjectIds('userId'), async (req, res) => {
  try {
    if (req.params.userId === String(req.user._id)) return res.status(400).json({ message: 'You cannot add yourself.' });
    const [targetUser, currentUser] = await Promise.all([User.findById(req.params.userId), User.findById(req.user._id)]);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });
    if (currentUser.friends.some(id => id.equals(targetUser._id))) return res.status(409).json({ message: 'You are already friends.' });
    if (targetUser.friendRequests.some(request => request.from.equals(currentUser._id) && request.status === 'pending')) {
      return res.status(409).json({ message: 'Friend request already sent.' });
    }
    if (currentUser.friendRequests.some(request => request.from.equals(targetUser._id) && request.status === 'pending')) {
      return res.status(409).json({ message: 'This person already sent you a request. Accept it under Requests.' });
    }

    targetUser.friendRequests.push({ from: currentUser._id, status: 'pending' });
    await targetUser.save();
    emailFriend({
      to: targetUser,
      subject: `${currentUser.name} wants to be your accountability partner`,
      heading: 'New friend request',
      lead: `${currentUser.name} wants to be your accountability partner on doerstab. Accept to cheer each other on and see each other's shared goals.`,
      button: 'See the request',
      path: '/friends?tab=requests'
    });
    res.status(201).json({ message: 'Friend request sent.' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Could not send friend request.' });
  }
});

// DELETE /api/friends/request/:userId - Cancel a request you sent
router.delete('/request/:userId', requireObjectIds('userId'), async (req, res) => {
  try {
    // matchedCount (not modifiedCount): timestamps always touch updatedAt.
    const result = await User.updateOne(
      { _id: req.params.userId, friendRequests: { $elemMatch: { from: req.user._id, status: 'pending' } } },
      { $pull: { friendRequests: { from: req.user._id, status: 'pending' } } }
    );
    if (!result.matchedCount) return res.status(404).json({ message: 'Pending request not found.' });
    res.json({ message: 'Friend request cancelled.' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    res.status(500).json({ message: 'Could not cancel the request.' });
  }
});

// PUT /api/friends/request/:requestId - Accept or decline
router.put('/request/:requestId', requireObjectIds('requestId'), async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ message: 'Choose accept or reject.' });

    const user = await User.findById(req.user._id);
    const request = user.friendRequests.id(req.params.requestId);
    if (!request || request.status !== 'pending') return res.status(404).json({ message: 'Pending request not found.' });

    const senderId = request.from;
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    if (action === 'accept') user.friends.addToSet(senderId);
    await user.save();
    if (action === 'accept') {
      const sender = await User.findByIdAndUpdate(senderId, { $addToSet: { friends: user._id } }, { new: true }).select('name email notificationsEnabled');
      emailFriend({
        to: sender,
        subject: `${user.name} accepted your friend request`,
        heading: 'You have a new accountability partner',
        lead: `${user.name} accepted your friend request. You can now see each other's shared goals, nudge and cheer.`,
        button: 'Open your circle',
        path: '/friends'
      });
    }

    res.json({ message: action === 'accept' ? 'You are now accountability partners.' : 'Friend request declined.' });
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ message: 'Could not update friend request.' });
  }
});

// GET /api/friends/:userId/goals - A friend's shared goals
router.get('/:userId/goals', requireObjectIds('userId'), async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('friends');
    if (!me.friends.some(id => id.equals(req.params.userId))) return res.status(403).json({ message: 'You can only view goals shared by friends.' });
    const friend = await User.findById(req.params.userId).select('name streak lastCheckIn timezone');
    if (!friend) return res.status(404).json({ message: 'Friend not found.' });
    const goals = await Goal.find({ owner: friend._id, isActive: true, isPublic: true }).sort({ isCompleted: 1, updatedAt: -1 });
    res.json({
      friend: { _id: friend._id, name: friend.name, streak: friend.streak, lastCheckIn: friend.lastCheckIn },
      goals: goals.map(goal => decorateGoal(goal, friend.timezone || 'UTC', { includePrivate: false }))
    });
  } catch (error) {
    console.error('Friend goals error:', error);
    res.status(500).json({ message: 'Could not load this friend’s goals.' });
  }
});

// DELETE /api/friends/:userId - Remove a friend (both sides)
router.delete('/:userId', requireObjectIds('userId'), async (req, res) => {
  try {
    const result = await User.updateOne({ _id: req.user._id, friends: req.params.userId }, { $pull: { friends: req.params.userId } });
    if (!result.matchedCount) return res.status(404).json({ message: 'This person is not in your friends.' });
    await User.updateOne({ _id: req.params.userId }, { $pull: { friends: req.user._id } });
    res.json({ message: 'Friend removed.' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Could not remove friend.' });
  }
});

module.exports = router;
