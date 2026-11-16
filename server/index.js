require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const goalRoutes = require('./routes/goals');
const friendRoutes = require('./routes/friends');
const reminderRoutes = require('./routes/reminders');
const visionRoutes = require('./routes/vision');
const leaderboardRoutes = require('./routes/leaderboard');
const challengeRoutes = require('./routes/challenges');
const supportRoutes = require('./routes/support');
const reportRoutes = require('./routes/reports');
const { router: adminRoutes } = require('./routes/admin');
const feedbackRoutes = require('./routes/feedback');
const { backfillActivities } = require('./services/activity');
const { sendDailyReminders } = require('./services/reminderService');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '1mb' })); // room for a resized photo upload (profile or vision board)

app.get('/api/health', (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(database === 'connected' ? 200 : 503).json({ status: database === 'connected' ? 'ok' : 'degraded', database, timestamp: new Date().toISOString() });
});

// Fail fast with a clear 503 while the database is unreachable, instead of letting
// queries buffer for 10s and surface as a generic "Server error".
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json({ message: 'We can’t reach the database right now. Please try again in a moment.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// Malformed JSON and other unhandled errors return JSON instead of an HTML stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error.' });
});

// Connect with retries: mongoose does not retry a failed *initial* connection on its own.
const RETRY_MS = 10000;
const explainConnectionError = error => {
  if (!process.env.MONGODB_URI) return 'MONGODB_URI is not set. Copy server/.env.example to server/.env and fill it in.';
  if (/whitelist|IP that isn't|ip access list/i.test(error.message)) {
    return 'Atlas rejected this machine\'s IP address. Add your current IP in Atlas → Security → Network Access, then this server will reconnect automatically.';
  }
  if (/authentication failed|bad auth/i.test(error.message)) return 'MongoDB username or password in MONGODB_URI is wrong.';
  if (/ENOTFOUND|querySrv|ECONNREFUSED/i.test(error.message)) return 'Could not reach the MongoDB host. Check your internet connection and the host in MONGODB_URI.';
  return error.message;
};
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ MongoDB connected');
    // Count existing check-ins and finished steps toward streaks and XP (idempotent).
    backfillActivities()
      .then(added => { if (added) console.log(`✅ Streak history backfilled (${added} activities)`); })
      .catch(error => console.error('Streak backfill failed:', error.message));
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${explainConnectionError(error)}`);
    console.error(`   Retrying in ${RETRY_MS / 1000}s… (API requests return 503 until connected)`);
    setTimeout(connectToDatabase, RETRY_MS);
  }
};
let hasConnected = false;
mongoose.connection.on('connected', () => { hasConnected = true; });
mongoose.connection.on('disconnected', () => { if (hasConnected) console.warn('⚠️  MongoDB disconnected — mongoose will try to reconnect.'); });
mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));
connectToDatabase();

// Evaluate users' configured local reminder time once per minute (only while the DB is connected).
cron.schedule('* * * * *', async () => {
  if (mongoose.connection.readyState === 1) await sendDailyReminders();
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Explain port conflicts instead of crashing with an unhandled 'error' event.
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use — another server (maybe a previous \`npm run dev\`) is still running.`);
    console.error(`   Find it with:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN   then stop it, or start on another port:  PORT=5001 npm start`);
    console.error('   (On macOS, the AirPlay Receiver can also hold port 5000: System Settings → General → AirDrop & Handoff.)');
    process.exit(1);
  }
  throw error;
});

// Close cleanly on Ctrl+C / nodemon restarts so the port is released immediately.
const shutdown = () => server.close(() => mongoose.connection.close(false).finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
