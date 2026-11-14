# 🔥 Accountable — MERN Stack Accountability App

A full-stack app where friends keep each other accountable with daily reminders, goal tracking, and streaks.

## Features

- **Today** — a setup checklist for new users, a progress ring for today's check-ins, one-tap check-ins, friends who still need a nudge, and new inbox items
- **Goals** — daily or weekly goals created in a 3-step flow (Goal → Rhythm → Plan), with steps (to-dos), active/completed/all filters, edit, mark complete, and delete
- **Check-ins** — one per local day (daily) or ISO week (weekly), with mood and a private note; can be edited later
- **Streaks** — computed live on the server in each user's timezone, so a missed day resets the streak
- **Friends** — add by email or friend code; incoming and sent requests (with cancel); view a friend's shared goals; nudge or cheer them
- **Inbox** — Inbox/Sent tabs; filters (All, Unread, From friends, Daily reminders); "Check in" and "Say thanks" actions; mark read/unread; delete
- **Daily reminder** — sent at each user's local reminder time, only when a goal still needs a check-in
- **Design** — Material Design 3 (Google): navigation rail on desktop, navigation bar on mobile, light/dark/system themes, accessible dialogs and menus

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
│   ├── services/
│   │   ├── goalStats.js      # Timezone-aware streaks & goal status
│   │   └── reminderService.js # Cron job logic
│   └── utils/                # timezone + validation helpers
│
└── client/src/
    ├── AppBase.css            # Material 3 design system (tokens + components)
    ├── App.css                # Page layouts
    ├── context/               # AuthContext (API + session), AppContext (snackbar, unread)
    ├── lib/                   # Formatting + goal constants
    ├── pages/
    │   ├── AuthPage.js        # /auth   Sign in / create account
    │   ├── Dashboard.js       # /today  Today overview
    │   ├── Goals.js           # /goals  Goals, steps, check-ins
    │   ├── Friends.js         # /friends Circle, requests, add friend
    │   ├── Reminders.js       # /inbox  Inbox + sent
    │   └── Profile.js         # /profile Settings
    └── components/
        ├── Layout.js          # Nav rail / nav bar / top app bar
        ├── ui.js              # Icon, Dialog, Menu, TextField, Switch…
        ├── GoalEditorDialog.js, CheckInDialog.js, NudgeDialog.js
```

## API Reference

Every route except register/login needs `Authorization: Bearer <token>`. Errors return `{ message }`.

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account (`name`, `email`, `password` ≥ 8, optional `timezone`) |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user (refreshes the live streak) |
| PUT | `/api/auth/profile` | Update `name`, `reminderTime` (HH:MM), `timezone`, `notificationsEnabled` |

### Goals
Goal responses include server-computed `checkedInThisPeriod`, `currentCheckIn`, `streak`, `completionRate` and `todoProgress`.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/goals?status=active\|completed\|all` | List my goals |
| GET | `/api/goals/friends` | Friends' shared goals (no private notes) |
| POST | `/api/goals` | Create goal |
| PATCH | `/api/goals/:id` | Update allowed fields only (`title`, `description`, `category`, `frequency`, `targetDays`, `year`, `isPublic`, `emoji`, `isCompleted`) |
| POST | `/api/goals/:id/checkin` | Check in for the current day/week (`completed`, `mood`, `note`) |
| POST | `/api/goals/:id/todos` | Add a step |
| PATCH | `/api/goals/:id/todos/:todoId` | Toggle or rename a step |
| DELETE | `/api/goals/:id/todos/:todoId` | Remove a step |
| DELETE | `/api/goals/:id` | Delete goal (soft delete) |

### Friends
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/friends` | Friends, with `checkedInToday`, `sharedGoalCount`, `nudgesSentToday` |
| GET | `/api/friends/code` | My shareable friend code |
| GET | `/api/friends/requests` | `{ requests (incoming), sent (outgoing) }` |
| POST | `/api/friends/search` | Find by exact email or friend code (`query`) |
| POST | `/api/friends/request/:userId` | Send request |
| DELETE | `/api/friends/request/:userId` | Cancel a request I sent |
| PUT | `/api/friends/request/:requestId` | Accept/reject (`action`) |
| GET | `/api/friends/:userId/goals` | A friend's shared goals |
| DELETE | `/api/friends/:userId` | Remove friend |

### Reminders
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/reminders?box=inbox\|sent&filter=all\|unread\|friends\|nudges` | List messages |
| GET | `/api/reminders/unread-count` | Unread count |
| POST | `/api/reminders` | Nudge or cheer a friend (`to`, optional `goalId` of their shared goal, `message`, `type`: `manual`/`encouragement`). Max 3 per friend per 24h |
| PUT | `/api/reminders/:id/read` | Mark read (or unread with `{ isRead: false }`) |
| PUT | `/api/reminders/read-all` | Mark all read |
| DELETE | `/api/reminders/:id` | Delete from my inbox |

## Daily Reminders Cron Job

Runs every minute. When it is a user's chosen `reminderTime` in their own timezone, and at least one active goal still needs a check-in for its current period, the job creates one private reminder for that day. A unique key prevents duplicates, even with several server instances.

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
