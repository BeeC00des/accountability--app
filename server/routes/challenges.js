const express = require('express');
const { body } = require('express-validator');
const Challenge = require('../models/Challenge');
const Activity = require('../models/Activity');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { handleValidation, isObjectId, requireObjectIds } = require('../utils/validate');
const { getLocalDateKey, zonedMidnight } = require('../utils/timezone');
const { shiftKey, recordActivity } = require('../services/activity');

const router = express.Router();
router.use(protect);

const MAX_OPEN_PER_PAIR = 3;
const MAX_BOOK_AHEAD_DAYS = 30;

const scoreFor = async (userId, challenge) => {
  // Score by exact time window so both friends share the same day boundaries, whatever their timezones.
  const startAt = challenge.startAt || zonedMidnight(challenge.startKey, challenge.timezone);
  const endAt = challenge.endAt || zonedMidnight(shiftKey(challenge.endKey, 1), challenge.timezone);
  const match = { user: userId, date: { $gte: startAt, $lt: endAt } };
  if (challenge.metric === 'checkins') match.type = 'checkin';
  const [row] = await Activity.aggregate([{ $match: match }, { $group: { _id: null, xp: { $sum: '$points' }, count: { $sum: 1 } } }]);
  if (!row) return 0;
  return challenge.metric === 'checkins' ? row.count : row.xp;
};

const phaseOf = (challenge, today) => {
  if (['pending', 'declined', 'cancelled'].includes(challenge.status)) return challenge.status;
  if (challenge.status === 'completed') return 'completed';
  if (today < challenge.startKey) return 'upcoming';
  if (today > challenge.endKey) return 'finished';
  return 'live';
};

/** Serialises a challenge with live scores; settles it (winner, bonus XP) once its last day has passed. */
const present = async (challenge, viewerId) => {
  const today = getLocalDateKey(new Date(), challenge.timezone);
  let phase = phaseOf(challenge, today);
  let scores = challenge.finalScores?.challenger !== undefined && challenge.status === 'completed'
    ? { challenger: challenge.finalScores.challenger, opponent: challenge.finalScores.opponent }
    : null;

  if (!scores && ['live', 'finished'].includes(phase)) {
    scores = { challenger: await scoreFor(challenge.challenger._id, challenge), opponent: await scoreFor(challenge.opponent._id, challenge) };
  }

  if (phase === 'finished') {
    const settled = await Challenge.findOneAndUpdate(
      { _id: challenge._id, status: 'accepted' },
      {
        status: 'completed',
        finalScores: scores,
        isTie: scores.challenger === scores.opponent,
        winner: scores.challenger === scores.opponent ? null : (scores.challenger > scores.opponent ? challenge.challenger._id : challenge.opponent._id)
      },
      { new: true }
    );
    if (settled?.winner) {
      const winner = await User.findById(settled.winner).select('timezone');
      await recordActivity({ userId: settled.winner, type: 'challenge_win', ref: settled._id, timezone: winner?.timezone || 'UTC' });
    }
    if (settled) Object.assign(challenge, { status: settled.status, winner: settled.winner, isTie: settled.isTie });
    phase = 'completed';
  }

  const json = challenge.toJSON();
  const viewerIsChallenger = challenge.challenger._id.equals(viewerId);
  const daysLeft = phase === 'live' ? Math.round((new Date(`${challenge.endKey}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000) + 1 : null;
  const startsIn = phase === 'upcoming' || phase === 'pending'
    ? Math.max(0, Math.round((new Date(`${challenge.startKey}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000))
    : null;
  return {
    ...json,
    phase,
    scores,
    daysLeft,
    startsIn,
    role: viewerIsChallenger ? 'challenger' : 'opponent',
    me: viewerIsChallenger ? json.challenger : json.opponent,
    them: viewerIsChallenger ? json.opponent : json.challenger,
    myScore: scores ? (viewerIsChallenger ? scores.challenger : scores.opponent) : null,
    theirScore: scores ? (viewerIsChallenger ? scores.opponent : scores.challenger) : null,
    iWon: challenge.winner ? challenge.winner.equals(viewerId) : false
  };
};

const notify = (from, to, message) => Reminder.create({ from, to, message, type: 'challenge' }).catch(() => {});

// GET /api/challenges - All my challenges, newest first, with live scores
router.get('/', async (req, res) => {
  try {
    const challenges = await Challenge.find({ $or: [{ challenger: req.user._id }, { opponent: req.user._id }] })
      .populate('challenger', 'name avatar streak')
      .populate('opponent', 'name avatar streak')
      .sort({ createdAt: -1 })
      .limit(50);
    const presented = [];
    for (const challenge of challenges) {
      // eslint-disable-next-line no-await-in-loop
      if (challenge.challenger && challenge.opponent) presented.push(await present(challenge, req.user._id));
    }
    res.json({ challenges: presented });
  } catch (error) {
    console.error('List challenges error:', error);
    res.status(500).json({ message: 'Could not load challenges.' });
  }
});

// POST /api/challenges - Book a friend for a healthy challenge
router.post('/', [
  body('opponentId').custom(isObjectId).withMessage('Choose a friend to challenge.'),
  body('title').isString().trim().isLength({ min: 3, max: 60 }).withMessage('Give your challenge a name (3–60 characters).'),
  body('metric').optional().isIn(['xp', 'checkins']),
  body('days').isInt({ min: 3, max: 30 }).withMessage('Challenges run for 3 to 30 days.').toInt(),
  body('startDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Pick a start date.'),
  body('reward').optional().isString().trim().isLength({ max: 60 }).withMessage('Keep the reward under 60 characters.'),
  body('message').optional().isString().trim().isLength({ max: 200 }),
  handleValidation
], async (req, res) => {
  try {
    const { opponentId, title, metric = 'xp', days, startDate, reward = '', message = '' } = req.body;
    if (opponentId === String(req.user._id)) return res.status(400).json({ message: 'Challenge a friend, not yourself.' });
    if (!req.user.friends.some(id => id.equals(opponentId))) return res.status(403).json({ message: 'You can only challenge friends.' });

    const timezone = req.user.timezone || 'UTC';
    const today = getLocalDateKey(new Date(), timezone);
    if (startDate < today || startDate > shiftKey(today, MAX_BOOK_AHEAD_DAYS)) {
      return res.status(400).json({ message: `Start today or book up to ${MAX_BOOK_AHEAD_DAYS} days ahead.` });
    }
    const open = await Challenge.countDocuments({
      status: { $in: ['pending', 'accepted'] },
      $or: [{ challenger: req.user._id, opponent: opponentId }, { challenger: opponentId, opponent: req.user._id }]
    });
    if (open >= MAX_OPEN_PER_PAIR) return res.status(409).json({ message: `You already have ${MAX_OPEN_PER_PAIR} open challenges with this friend.` });

    const challenge = await Challenge.create({
      challenger: req.user._id, opponent: opponentId, title, metric, days, reward, message, timezone,
      startKey: startDate, endKey: shiftKey(startDate, days - 1),
      startAt: zonedMidnight(startDate, timezone), endAt: zonedMidnight(shiftKey(startDate, days), timezone)
    });
    await notify(req.user._id, opponentId, `🏁 ${req.user.name} challenged you: “${title}” — ${days} days from ${startDate}.${reward ? ` Reward: ${reward}.` : ''} Accept it in Compete.`);
    await challenge.populate([{ path: 'challenger', select: 'name avatar streak' }, { path: 'opponent', select: 'name avatar streak' }]);
    res.status(201).json({ message: 'Challenge sent.', challenge: await present(challenge, req.user._id) });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ message: 'Could not create the challenge.' });
  }
});

// PUT /api/challenges/:id/respond  { action: accept|decline } - Opponent only
router.put('/:id/respond', [requireObjectIds('id'), body('action').isIn(['accept', 'decline']).withMessage('Choose accept or decline.'), handleValidation], async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.params.id, opponent: req.user._id, status: 'pending' })
      .populate('challenger', 'name avatar streak').populate('opponent', 'name avatar streak');
    if (!challenge) return res.status(404).json({ message: 'Pending challenge not found.' });
    const today = getLocalDateKey(new Date(), challenge.timezone);
    if (req.body.action === 'accept' && challenge.endKey < today) return res.status(409).json({ message: 'This challenge has already ended.' });

    challenge.status = req.body.action === 'accept' ? 'accepted' : 'declined';
    await challenge.save();
    await notify(req.user._id, challenge.challenger._id, req.body.action === 'accept'
      ? `💪 ${req.user.name} accepted “${challenge.title}”. May the most consistent friend win!`
      : `${req.user.name} passed on “${challenge.title}” this time.`);
    res.json({ message: req.body.action === 'accept' ? 'Challenge accepted — good luck!' : 'Challenge declined.', challenge: await present(challenge, req.user._id) });
  } catch (error) {
    console.error('Respond challenge error:', error);
    res.status(500).json({ message: 'Could not update the challenge.' });
  }
});

// DELETE /api/challenges/:id - Challenger cancels before it starts
router.delete('/:id', requireObjectIds('id'), async (req, res) => {
  try {
    const challenge = await Challenge.findOne({ _id: req.params.id, challenger: req.user._id, status: { $in: ['pending', 'accepted'] } });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });
    const today = getLocalDateKey(new Date(), challenge.timezone);
    if (challenge.status === 'accepted' && today >= challenge.startKey) return res.status(409).json({ message: 'This challenge has started — see it through!' });
    challenge.status = 'cancelled';
    await challenge.save();
    res.json({ message: 'Challenge cancelled.' });
  } catch (error) {
    console.error('Cancel challenge error:', error);
    res.status(500).json({ message: 'Could not cancel the challenge.' });
  }
});

module.exports = router;
