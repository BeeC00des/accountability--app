/*
 * Bachs payments (https://docs.bachs.io): hosted checkout + signed webhooks.
 * Plain HTTPS calls (no SDK) so it runs on Node 18+.
 *
 * Env: BACHS_API_KEY (sk_sandbox_… or sk_live_…), BACHS_WEBHOOK_SECRET (Developer Portal → Webhooks),
 *      optional BACHS_API_BASE to override the host.
 */
const crypto = require('crypto');

const apiBase = () => {
  if (process.env.BACHS_API_BASE) return process.env.BACHS_API_BASE.replace(/\/+$/, '');
  return (process.env.BACHS_API_KEY || '').startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io';
};
const configured = () => Boolean(process.env.BACHS_API_KEY);

const request = async (method, path, body, { idempotencyKey } = {}) => {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.BACHS_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Bachs ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
};

/** Creates a hosted checkout for a one-time payment. Returns { checkout_id, checkout_url, … }. */
const createCheckout = ({ amount, currency, customer, successUrl, cancelUrl, metadata, reference, idempotencyKey }) => request('POST', '/v1/checkout-sessions', {
  pricing: { currency, amount },
  customer,
  success_url: successUrl,
  cancel_url: cancelUrl,
  metadata,
  reference,
  payment_method_types: currency === 'NGN' ? ['NGN_CARD', 'NGN_BANK_TRANSFER'] : undefined,
  expires_in_minutes: 60
}, { idempotencyKey });

const getCheckout = checkoutId => request('GET', `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);

/** True if a checkout session object says it was paid (field names vary by event/version, so be tolerant). */
const isPaidCheckout = session => {
  const values = [session?.status, session?.payment_status, session?.data?.status, session?.collection?.status, session?.charge?.status].filter(Boolean).map(value => String(value).toLowerCase());
  return values.some(value => ['completed', 'complete', 'paid', 'succeeded', 'success', 'successful', 'settled', 'captured'].includes(value));
};

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * Verifies a webhook: HMAC-SHA256 hex of "{timestamp}.{raw_body}" with the endpoint's signing secret.
 * Accepts X-Bachs-Signature-V2 ("t=…,v1=…[,v1=…]") or X-Bachs-Signature + X-Bachs-Timestamp. 5-minute tolerance.
 */
const verifyWebhook = (rawBody, headers, secret = process.env.BACHS_WEBHOOK_SECRET, toleranceSeconds = 300) => {
  if (!secret) throw Object.assign(new Error('BACHS_WEBHOOK_SECRET is not set'), { status: 500 });
  const v2 = headers['x-bachs-signature-v2'];
  let timestamp = headers['x-bachs-timestamp'];
  let signatures = headers['x-bachs-signature'] ? [headers['x-bachs-signature']] : [];
  if (v2) {
    const parts = String(v2).split(',').map(part => part.trim().split('='));
    timestamp = parts.find(([key]) => key === 't')?.[1] || timestamp;
    signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  }
  if (!timestamp || !signatures.length) throw Object.assign(new Error('Missing signature'), { status: 400 });
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) throw Object.assign(new Error('Signature timestamp out of tolerance'), { status: 400 });
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  if (!signatures.some(signature => safeEqual(signature, expected))) throw Object.assign(new Error('Invalid signature'), { status: 400 });
  return JSON.parse(rawBody.toString('utf8'));
};

module.exports = { configured, createCheckout, getCheckout, isPaidCheckout, verifyWebhook, apiBase };
