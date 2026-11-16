const nodemailer = require('nodemailer');

// Where Premium requests are sent. Override with ADMIN_EMAIL in server/.env.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ajayibcd@gmail.com';

const configured = () => Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
  && !/your_|example/i.test(`${process.env.EMAIL_USER}${process.env.EMAIL_PASS}`));

let transport = null;
const getTransport = () => {
  if (!transport) {
    const port = Number(process.env.EMAIL_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  return transport;
};

/** Sends an email; never throws. Returns { sent, reason }. */
const sendMail = async ({ to, subject, text, html, replyTo }) => {
  if (!configured()) return { sent: false, reason: 'Email is not set up: add EMAIL_USER and EMAIL_PASS to server/.env.' };
  try {
    await getTransport().sendMail({ from: `"Accountable" <${process.env.EMAIL_USER}>`, to, subject, text, html, replyTo });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
};

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

module.exports = { ADMIN_EMAIL, sendMail, escape, emailConfigured: configured };
