const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/friends - Get all friends
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'name email streak lastCheckIn createdAt');
    res.json({ friends: user.friends });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// GET /api/friends/requests - Get pending friend requests
router.get('/requests', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.from', 'name email');
    const pending = user.friendRequests.filter(r => r.status === 'pending');
    res.json({ requests: pending });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/friends/search - Search users by email
router.post('/search', protect, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      _id: { $ne: req.user._id }
    }).select('name email streak');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const currentUser = await User.findById(req.user._id);
    const isAlreadyFriend = currentUser.friends.includes(user._id);
    const hasPendingRequest = user.friendRequests.some(
      r => r.from.toString() === req.user._id.toString() && r.status === 'pending'
    );

    res.json({ user, isAlreadyFriend, hasPendingRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/friends/request/:userId - Send friend request
router.post('/request/:userId', protect, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    const currentUser = await User.findById(req.user._id);

    if (currentUser.friends.includes(targetUser._id)) {
      return res.status(400).json({ message: 'Already friends.' });
    }

    const alreadySent = targetUser.friendRequests.some(
      r => r.from.toString() === req.user._id.toString() && r.status === 'pending'
    );
    if (alreadySent) {
      return res.status(400).json({ message: 'Friend request already sent.' });
    }

    targetUser.friendRequests.push({ from: req.user._id, status: 'pending' });
    await targetUser.save();

    res.json({ message: 'Friend request sent!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/friends/request/:requestId - Accept or reject a request
router.put('/request/:requestId', protect, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    const user = await User.findById(req.user._id);

    const request = user.friendRequests.id(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    if (action === 'accept') {
      request.status = 'accepted';
      user.friends.push(request.from);
      await user.save();

      // Add back as friend
      await User.findByIdAndUpdate(request.from, {
        $push: { friends: req.user._id }
      });

      res.json({ message: 'Friend request accepted!' });
    } else {
      request.status = 'rejected';
      await user.save();
      res.json({ message: 'Friend request declined.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/friends/:userId - Remove a friend
router.delete('/:userId', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { friends: req.params.userId }
    });
    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { friends: req.user._id }
    });
    res.json({ message: 'Friend removed.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
