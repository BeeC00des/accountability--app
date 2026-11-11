const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const newFriendCode = () => `AC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// GET /api/friends - Get all friends
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'name email streak lastCheckIn createdAt friendCode');
    res.json({ friends: user.friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ message: 'Could not load friends.' });
  }
});

// GET /api/friends/code - Get or generate the current user's shareable friend code
router.get('/code', protect, async (req, res) => {
  try {
    let user = await User.findById(req.user._id).select('friendCode');
    if (!user.friendCode) {
      for (let attempt = 0; attempt < 5 && !user.friendCode; attempt += 1) {
        const candidate = newFriendCode();
        try {
          user = await User.findOneAndUpdate(
            { _id: req.user._id, $or: [{ friendCode: { $exists: false } }, { friendCode: null }, { friendCode: '' }] },
            { $set: { friendCode: candidate } },
            { new: true }
          ).select('friendCode');
          if (!user) user = await User.findById(req.user._id).select('friendCode');
        } catch (error) {
          if (error.code !== 11000) throw error;
          user = await User.findById(req.user._id).select('friendCode');
        }
      }
    }
    if (!user?.friendCode) return res.status(503).json({ message: 'Could not create a friend code. Please try again.' });
    res.json({ friendCode: user.friendCode });
  } catch (error) {
    console.error('Friend code error:', error);
    res.status(500).json({ message: 'Could not load your friend code.' });
  }
});

// GET /api/friends/requests - Get pending friend requests
router.get('/requests', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.from', 'name email friendCode');
    const pending = user.friendRequests.filter(request => request.status === 'pending');
    res.json({ requests: pending });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ message: 'Could not load friend requests.' });
  }
});

// POST /api/friends/search - Search by exact email address or friend code
router.post('/search', protect, async (req, res) => {
  try {
    const query = typeof req.body.query === 'string' ? req.body.query.trim() :
      (typeof req.body.email === 'string' ? req.body.email.trim() : '');
    if (!query || query.length > 254) return res.status(400).json({ message: 'Enter an email address or friend code.' });

    const isEmail = query.includes('@');
    const normalizedEmail = query.toLowerCase();
    const normalizedCode = query.replace(/[^a-z0-9]/gi, '').toUpperCase();
    const lookup = isEmail ? { email: normalizedEmail } : { friendCode: `AC-${normalizedCode.replace(/^AC/, '')}` };
    const target = await User.findOne({ ...lookup, _id: { $ne: req.user._id } }).select('name email streak friendCode');
    if (!target) return res.status(404).json({ message: 'No account found. Check the email or friend code and try again.' });

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id).select('friends friendRequests'),
      User.findById(target._id).select('friends friendRequests')
    ]);
    const isAlreadyFriend = currentUser.friends.some(id => id.equals(target._id));
    const hasPendingRequest = targetUser.friendRequests.some(request =>
      request.from.equals(req.user._id) && request.status === 'pending'
    );
    const incomingRequest = currentUser.friendRequests.find(request =>
      request.from.equals(target._id) && request.status === 'pending'
    );

    res.json({
      user: target,
      isAlreadyFriend,
      hasPendingRequest,
      receivedRequestId: incomingRequest?._id || null
    });
  } catch (error) {
    console.error('Friend search error:', error);
    res.status(500).json({ message: 'Could not search for that account.' });
  }
});

// POST /api/friends/request/:userId - Send friend request
router.post('/request/:userId', protect, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) return res.status(400).json({ message: 'You cannot add yourself.' });
    const [targetUser, currentUser] = await Promise.all([
      User.findById(req.params.userId),
      User.findById(req.user._id)
    ]);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });
    if (currentUser.friends.some(id => id.equals(targetUser._id))) return res.status(409).json({ message: 'You are already friends.' });

    const outgoing = targetUser.friendRequests.find(request =>
      request.from.equals(currentUser._id) && request.status === 'pending'
    );
    if (outgoing) return res.status(409).json({ message: 'Friend request already sent.' });

    const incoming = currentUser.friendRequests.find(request =>
      request.from.equals(targetUser._id) && request.status === 'pending'
    );
    if (incoming) return res.status(409).json({ message: 'This person already sent you a request. Accept it in Friend requests.' });

    targetUser.friendRequests.push({ from: currentUser._id, status: 'pending' });
    await targetUser.save();
    res.status(201).json({ message: 'Friend request sent!' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ message: 'Could not send friend request.' });
  }
});

// PUT /api/friends/request/:requestId - Accept or reject a request
router.put('/request/:requestId', protect, async (req, res) => {
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
      await User.findByIdAndUpdate(senderId, { $addToSet: { friends: user._id } });
    }

    res.json({ message: action === 'accept' ? 'Friend request accepted!' : 'Friend request declined.' });
  } catch (error) {
    console.error('Respond to friend request error:', error);
    res.status(500).json({ message: 'Could not update friend request.' });
  }
});

// DELETE /api/friends/:userId - Remove a friend
router.delete('/:userId', protect, async (req, res) => {
  try {
    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $pull: { friends: req.params.userId } }),
      User.findByIdAndUpdate(req.params.userId, { $pull: { friends: req.user._id } })
    ]);
    res.json({ message: 'Friend removed.' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ message: 'Could not remove friend.' });
  }
});

module.exports = router;
