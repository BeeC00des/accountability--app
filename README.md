# 🔥 Accountable — MERN Stack Accountability App

A full-stack app where friends keep each other accountable with daily reminders, goal tracking, and streaks.

## Features

- **Authentication** — JWT-based register/login with bcrypt password hashing
- **Goals** — Create daily/weekly goals with categories, emojis, and progress tracking
- **Check-ins** — Log daily progress with mood tracking and notes
- **Streaks** — Automatic streak calculation and longest streak history
- **Friends** — Search by email, send/accept friend requests, remove friends
- **Reminders** — Send personal reminders to friends, receive automated daily nudges
- **Dashboard** — Overview of today's goals, friends' activity, and unread reminders

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router v6, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| Auth | JWT + bcryptjs |
| Scheduler | node-cron (daily reminders at 8 AM) |
| Validation | express-validator |

## Quick Start

### 1. Prerequisites

- Node.js 18+
- MongoDB running locally OR a MongoDB Atlas connection string

### 2. Clone and install

```bash
git clone <your-repo>
cd accountability-app
npm install          # installs concurrently
npm run install:all  # installs server + client deps
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/accountability
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
```

### 4. Start development

```bash
npm run dev
```

This runs both server (port 5000) and client (port 3000) concurrently.

Open: **http://localhost:3000**

---

## Project Structure

```
accountability-app/
├── server/
│   ├── index.js              # Express app entry point
│   ├── models/
│   │   ├── User.js           # User schema (auth, friends, streak)
│   │   ├── Goal.js           # Goal schema (check-ins, progress)
│   │   └── Reminder.js       # Reminder schema
│   ├── routes/
│   │   ├── auth.js           # /api/auth (register, login, me, profile)
│   │   ├── goals.js          # /api/goals (CRUD, check-in)
│   │   ├── friends.js        # /api/friends (search, requests, remove)
│   │   ├── reminders.js      # /api/reminders (send, mark read)
│   │   └── users.js          # /api/users (public stats)
│   ├── middleware/
│   │   └── auth.js           # JWT protect middleware
│   └── services/
│       └── reminderService.js # Cron job logic
│
└── client/src/
    ├── context/AuthContext.js # Auth state + API instance
    ├── pages/
    │   ├── AuthPage.js        # Login / Register
    │   ├── Dashboard.js       # Home overview
    │   ├── Goals.js           # Goal management + check-ins
    │   ├── Friends.js         # Friend management + reminders
    │   ├── Reminders.js       # Notification inbox
    │   └── Profile.js         # Settings
    └── components/
        └── Layout.js          # Sidebar + nav
```

## API Reference

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |

### Goals
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/goals` | List my goals |
| POST | `/api/goals` | Create goal |
| POST | `/api/goals/:id/checkin` | Check in on a goal |
| PUT | `/api/goals/:id` | Update goal |
| DELETE | `/api/goals/:id` | Remove goal |

### Friends
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/friends` | List friends |
| POST | `/api/friends/search` | Search by email |
| POST | `/api/friends/request/:userId` | Send request |
| PUT | `/api/friends/request/:id` | Accept/reject |
| DELETE | `/api/friends/:userId` | Remove friend |

### Reminders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reminders` | Get all reminders |
| POST | `/api/reminders` | Send reminder to friend |
| PUT | `/api/reminders/:id/read` | Mark as read |
| PUT | `/api/reminders/read-all` | Mark all as read |

## Daily Reminders Cron Job

Runs automatically at **8:00 AM** every day. For each user with notifications enabled who hasn't checked in today, it creates an automated reminder "from" one of their friends. This appears in the user's reminders inbox.

To test it manually:
```javascript
// In server/index.js, call the function directly
const { sendDailyReminders } = require('./services/reminderService');
sendDailyReminders();
```

## Deployment

### Backend (Railway / Render / Fly.io)
1. Set all env vars in dashboard
2. Set `MONGODB_URI` to a MongoDB Atlas connection string
3. Deploy the `/server` folder

### Frontend (Vercel / Netlify)
1. Update `client/package.json` — remove `"proxy"` and set `REACT_APP_API_URL=https://your-backend.com`
2. Update `AuthContext.js`: `baseURL: process.env.REACT_APP_API_URL || '/api'`
3. Deploy the `/client` folder

## Extending the App

Ideas to add next:
- **Push notifications** via Web Push API or Firebase Cloud Messaging
- **Goal templates** (popular habit templates)
- **Friend leaderboard** (who has the longest streak)
- **Weekly digest email** with stats summary
- **Comments on goals** for encouragement
- **Group challenges** (shared goals between friends)
