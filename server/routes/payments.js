const express = require('express');
const { query } = require('express-validator');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const { protect } = require('../middleware/auth');
const { handleValidation } = require('../utils/validate');
const bachs = require('../services/bachs');
const { sendMail, escape } = require('../services/mailer');

const PRICE_NGN = String(process.env.COMMUNITY_PRICE_NGN || '22000');
const AMOUNT = `${Number(PRICE_NGN).toFixed(2)}`; // "22000.00"
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const siteUrl = path => `${(process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/+$/, '')}${path}`;
// Bachs only returns customers to a public address, so local testing can point this at the live site.
const returnUrl = path => (process.env.PUBLIC_SITE_URL ? `${process.env.PUBLIC_SITE_URL.trim().replace(/\/+$/, '')}${path}` : siteUrl(path));

/** Marks a payment paid (once) and gives the member a year of Community access, extending any time left. */
const fulfil = async (payment, { chargeId } = {}) => {
  const claimed = await Payment.findOneAndUpdate({ _id: payment._id, status: 'pending' }, { status: 'paid', paidAt: new Date(), ...(chargeId ? { chargeId } : {}) }, { new: true });
  if (!claimed) return false; // already fulfilled by the other event
  const user = await User.findById(payment.user);
  if (!user) return false;
  const from = user.premiumUntil && user.premiumUntil > new Date() ? user.premiumUntil : new Date();
  user.plan = 'premium';
  user.premiumUntil = new Date(from.getTime() + YEAR_MS);
  await user.save();
  await Payment.updateOne({ _id: payment._id }, { accessUntil: user.premiumUntil });
  const until = user.premiumUntil.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  await Reminder.create({ from: user._id, to: user._id, type: 'system', message: `🎉 Welcome to the doerstab Community! Your membership runs until ${until}.` }).catch(() => {});
  sendMail({
    to: user.email,
    subject: 'Welcome to the doerstab Community',
    text: `Hi ${user.name},\n\nYour payment of ₦${Number(PRICE_NGN).toLocaleString('en-NG')} was received. Your Community membership runs until ${until}.\n\nChoose your mentor, therapist and career coach: ${siteUrl('/community')}\n\n— doerstab`,
    html: `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:520px"><h2 style="margin:0 0 12px">Welcome to the Community 🎉</h2>
      <p style="margin:0 0 16px">Hi ${escape(user.name)}, your payment of ₦${Number(PRICE_NGN).toLocaleString('en-NG')} was received. Your membership runs until <strong>${escape(until)}</strong>.</p>
      <p style="margin:0 0 20px"><a href="${siteUrl('/community')}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111;color:#fff;text-decoration:none;font-weight:600">Choose your experts</a></p></div>`
  }).then(result => { if (!result.sent) console.warn(`Welcome email not sent (${result.reason})`); });
  return true;
};

/* ---------- Webhook (mounted before express.json so the raw body is available) ---------- */
const webhook = async (req, res) => {
  let event;
  try {
    event = bachs.verifyWebhook(req.body, req.headers);
  } catch (error) {
    console.warn('Bachs webhook rejected:', error.message);
    return res.status(error.status || 400).json({ message: 'Invalid webhook.' });
  }
  try {
    const type = event.type || event.event;
    const data = event.data || {};
    if (!['checkout.completed', 'collection.succeeded'].includes(type)) return res.json({ received: true });
    const checkoutId = data.checkout_id || data.checkout?.id || (type === 'checkout.completed' ? data.id : undefined);
    const paymentId = data.metadata?.payment_id || event.metadata?.payment_id || data.reference;
    let payment = checkoutId ? await Payment.findOne({ checkoutId }) : null;
    if (!payment && paymentId && /^[a-f0-9]{24}$/i.test(paymentId)) payment = await Payment.findById(paymentId);
    if (!payment) { console.warn(`Bachs webhook ${type}: no matching payment`); return res.json({ received: true }); }
    if (event.id && payment.events.includes(event.id)) return res.json({ received: true, duplicate: true });
    if (type === 'collection.succeeded' && data.status && String(data.status).toUpperCase() !== 'SUCCEEDED') return res.json({ received: true });
    if (data.currency && data.amount && (String(data.currency).toUpperCase() !== payment.currency || Number(data.amount) + 0.001 < Number(payment.amount))) {
      console.warn(`Bachs webhook amount mismatch for payment ${payment._id}: ${data.amount} ${data.currency}`);
      return res.json({ received: true });
    }
    if (event.id) await Payment.updateOne({ _id: payment._id }, { $addToSet: { events: event.id } });
    await fulfil(payment, { chargeId: data.charge_id });
    res.json({ received: true });
  } catch (error) {
    console.error('Bachs webhook error:', error);
    res.status(500).json({ message: 'Webhook processing failed.' }); // Bachs retries on 5xx
  }
};

/* ---------- Member routes ---------- */
const router = express.Router();
router.use(protect);

// GET /api/payments/community - Price and my membership status
router.get('/community', async (req, res) => {
  res.json({
    price: { amount: AMOUNT, currency: 'NGN', label: `₦${Number(PRICE_NGN).toLocaleString('en-NG')}`, period: 'year' },
    available: bachs.configured(),
    access: req.user.hasCommunityAccess(),
    premiumUntil: req.user.premiumUntil
  });
});

// POST /api/payments/community/checkout - Start a Bachs hosted checkout and return its URL
router.post('/community/checkout', async (req, res) => {
  if (!bachs.configured()) return res.status(503).json({ message: 'Payments aren’t set up yet. Please try again later.' });
  let payment;
  try {
    payment = await Payment.create({ user: req.user._id, amount: AMOUNT, currency: 'NGN' });
    const session = await bachs.createCheckout({
      amount: AMOUNT,
      currency: 'NGN',
      customer: { email: req.user.email, name: req.user.name },
      successUrl: returnUrl('/community?payment=success'),
      cancelUrl: returnUrl('/community?payment=cancelled'),
      metadata: { payment_id: String(payment._id), user_id: String(req.user._id), product: 'community_annual' },
      reference: String(payment._id),
      idempotencyKey: `community-${payment._id}`
    });
    const checkoutId = session.checkout_id || session.id;
    const url = session.checkout_url || session.url;
    if (!checkoutId || !url) throw new Error('Bachs did not return a checkout URL');
    await Payment.updateOne({ _id: payment._id }, { checkoutId });
    res.status(201).json({ checkoutUrl: url, checkoutId });
  } catch (error) {
    console.error('Create checkout error:', error.message, error.details || '');
    if (payment) await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed' }).catch(() => {});
    const localhost = /localhost is not allowed/i.test(JSON.stringify(error.details || ''));
    res.status(502).json({ message: localhost ? 'Payments can’t return to a local address. Set PUBLIC_SITE_URL to your live site, or test on the live site.' : 'Could not start the payment. Please try again.' });
  }
});

// GET /api/payments/community/status?checkout_id=… - After returning from checkout: confirm (also checks Bachs directly)
router.get('/community/status', [query('checkout_id').optional().isString().isLength({ max: 120 }), handleValidation], async (req, res) => {
  try {
    const filter = { user: req.user._id, ...(req.query.checkout_id ? { checkoutId: req.query.checkout_id } : {}) };
    const payment = await Payment.findOne(filter).sort({ createdAt: -1 });
    if (payment && payment.status === 'pending' && payment.checkoutId && bachs.configured()) {
      // The webhook is the source of truth; this is a backup in case it's delayed.
      const session = await bachs.getCheckout(payment.checkoutId).catch(() => null);
      if (session && bachs.isPaidCheckout(session)) await fulfil(payment);
    }
    const user = await User.findById(req.user._id);
    const latest = payment ? await Payment.findById(payment._id) : null;
    res.json({ status: latest?.status || 'none', access: user.hasCommunityAccess(), premiumUntil: user.premiumUntil, user: user.toJSON() });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ message: 'Could not check your payment.' });
  }
});

module.exports = { router, webhook, fulfil };
