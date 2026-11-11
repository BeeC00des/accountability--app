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
const { sendDailyReminders } = require('./services/reminderService');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/reminders', reminderRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Evaluate users' configured local reminder time once per minute.
cron.schedule('* * * * *', async () => {
  await sendDailyReminders();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
