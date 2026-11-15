import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, ErrorBanner, Icon, Spinner } from '../components/ui';
import CheckInDialog from '../components/CheckInDialog';
import NudgeDialog from '../components/NudgeDialog';
import { apiError, dayKey, firstName, formatDate, plural, relativeTime } from '../lib/format';
import { MOODS, periodLabel, periodWord, tileClass } from '../lib/goals';
import { savePreference } from '../lib/consent';

const SETUP_DISMISSED = 'accountable-setup-dismissed';
const DAY_MS = 86400000;
const readFlag = key => { try { return window.localStorage.getItem(key) === '1'; } catch { return false; } };
const writeFlag = key => savePreference(key, '1');
const startOfDay = value => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };

/** Friendly mascot: a soft "sun" blob with a face. Decorative. */
const Mascot = () => (
  <svg className="mascot" viewBox="0 0 120 120" aria-hidden="true">
    <g className="mascot-body">
      {Array.from({ length: 9 }, (_, index) => {
        const angle = (index / 9) * Math.PI * 2;
        return <circle key={index} cx={60 + Math.cos(angle) * 30} cy={60 + Math.sin(angle) * 30} r="20" />;
      })}
      <circle cx="60" cy="60" r="36" />
    </g>
    <g className="mascot-face">
      <circle cx="49" cy="55" r="4" />
      <circle cx="71" cy="55" r="4" />
      <path d="M52 66 q8 7 16 0" fill="none" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  </svg>
);

/** Month calendar with a check badge on every day that has at least one completed check-in. */
function MonthCalendar({ completedDays, monthStart }) {
  const today = startOfDay(new Date());
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (monthStart.getDay() + 6) % 7; // Monday-first week
  const weekdays = Array.from({ length: 7 }, (_, index) => formatDate(new Date(2024, 0, 1 + index), { weekday: 'narrow' }));

  return (
    <div className="calendar" role="grid" aria-label={formatDate(monthStart, { month: 'long', year: 'numeric' })}>
      <div className="calendar-row calendar-weekdays" role="row">
        {weekdays.map((day, index) => <span key={index} role="columnheader" className="label-small text-variant">{day}</span>)}
      </div>
      <div className="calendar-grid" role="rowgroup">
        {Array.from({ length: leading }, (_, index) => <span key={`pad-${index}`} className="calendar-cell pad" aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(year, month, index + 1);
          const key = dayKey(date);
          const done = completedDays.has(key);
          const isToday = date.getTime() === today.getTime();
          const future = date > today;
          return (
            <span
              key={key}
              role="gridcell"
              className={`calendar-cell${done ? ' done' : ''}${isToday ? ' today' : ''}${future ? ' future' : ''}`}
              aria-label={`${formatDate(date, { month: 'long', day: 'numeric' })}${done ? ', checked in' : ''}${isToday ? ', today' : ''}`}
              aria-current={isToday ? 'date' : undefined}
            >
              {index + 1}
              {done && <span className="calendar-check" aria-hidden="true"><Icon name="check" /></span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Today() {
  const { user, updateUser } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [friends, setFriends] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quickId, setQuickId] = useState('');
  const [checkInGoal, setCheckInGoal] = useState(null);
  const [nudgeFriend, setNudgeFriend] = useState(null);
  const [setupDismissed, setSetupDismissed] = useState(() => readFlag(SETUP_DISMISSED));

  const load = useCallback(async () => {
    setError('');
    try {
      const [goalsResponse, friendsResponse, inboxResponse] = await Promise.all([
        API.get('/goals', { params: { status: 'active' } }),
        API.get('/friends'),
        API.get('/reminders', { params: { filter: 'unread' } })
      ]);
      setGoals(goalsResponse.data.goals || []);
      setFriends(friendsResponse.data.friends || []);
      setInbox((inboxResponse.data.reminders || []).slice(0, 3));
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load today’s overview.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replaceGoal = updated => setGoals(current => current.map(goal => (goal._id === updated._id ? updated : goal)));

  const quickCheckIn = async goal => {
    setQuickId(goal._id);
    try {
      const response = await API.post(`/goals/${goal._id}/checkin`, { completed: true });
      replaceGoal(response.data.goal);
      if (response.data.user) updateUser(response.data.user);
      notify(`${goal.emoji} Done ${periodLabel(goal)}`, { actionLabel: 'Add note', onAction: () => setCheckInGoal(response.data.goal) });
    } catch (checkInError) {
      notify(apiError(checkInError, 'Could not check in.'));
    } finally {
      setQuickId('');
    }
  };

  const pending = useMemo(() => goals.filter(goal => !goal.checkedInThisPeriod), [goals]);
  const plan = useMemo(() => [...pending, ...goals.filter(goal => goal.checkedInThisPeriod)], [goals, pending]);
  const needNudge = friends.filter(friend => !friend.checkedInToday).slice(0, 4);

  // Month view: which days had a completed check-in, and how many check-ins were due vs. done.
  const month = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = startOfDay(now);
    const completedDays = new Set();
    let expected = 0;
    let achieved = 0;
    goals.forEach(goal => {
      const completedThisMonth = (goal.checkIns || []).filter(checkIn => checkIn.completed && new Date(checkIn.date) >= monthStart);
      completedThisMonth.forEach(checkIn => completedDays.add(dayKey(checkIn.date)));
      const from = new Date(Math.max(monthStart.getTime(), startOfDay(goal.startDate || goal.createdAt).getTime()));
      const days = from <= today ? Math.floor((today - from) / DAY_MS) + 1 : 0;
      const due = goal.frequency === 'weekly' ? Math.ceil(days / 7) : days;
      expected += due;
      achieved += Math.min(due, completedThisMonth.length);
    });
    return { monthStart, completedDays, expected, achieved, rate: expected ? Math.round((achieved / expected) * 100) : 0 };
  }, [goals]);

  // The next unfinished step across goals, for the "small change" card.
  const nextStep = useMemo(() => {
    for (const goal of goals) {
      const todo = (goal.todos || []).find(item => !item.done);
      if (todo) return { goal, todo };
    }
    return null;
  }, [goals]);

  const setupSteps = [
    { done: goals.length > 0, label: 'Create your first goal', detail: 'Something small you can check in on.', to: '/goals?new=1', icon: 'flag' },
    { done: friends.length > 0, label: 'Add an accountability partner', detail: 'Friends can nudge and cheer you on.', to: '/friends?tab=add', icon: 'person_add' },
    { done: readFlag('accountable-reminder-set'), label: 'Choose your reminder time', detail: `Currently ${user?.reminderTime || '08:00'} · ${user?.timezone || 'UTC'}`, to: '/profile#settings', icon: 'schedule' }
  ];
  const setupRemaining = setupSteps.filter(step => !step.done).length;
  const showSetup = !setupDismissed && setupRemaining > 0;

  if (loading) return <Spinner label="Loading today" />;

  const name = firstName(user?.name);
  const hero = !goals.length
    ? { lead: 'what goal', tail: 'will you start?', copy: 'Pick one thing that matters. We’ll help you show up for it.', cta: 'Create your first goal' }
    : pending.length
      ? { lead: 'one small step', tail: 'at a time.', copy: `${plural(pending.length, 'goal')} waiting for a check-in. You’ve got this.`, cta: `Check in · ${pending[0].title}` }
      : { lead: 'you showed up', tail: 'today.', copy: 'Every goal is checked in. Enjoy the momentum.', cta: 'Review your goals' };
  const heroAction = () => {
    if (!goals.length) navigate('/goals?new=1');
    else if (pending.length) setCheckInGoal(pending[0]);
    else navigate('/goals');
  };

  return (
    <div className="page today-page">
      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="today-grid">
        <div className="today-main">
          <section className="hero" aria-labelledby="hero-title">
            <p className="hero-date label-medium">{formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <Mascot />
            <h1 id="hero-title" className="hero-title">
              {name}, <span className="italic-accent">{hero.lead}</span> {hero.tail}
            </h1>
            <p className="hero-copy body-medium">{hero.copy}</p>
            <button type="button" className="slide-cta state-layer" onClick={heroAction}>
              <Icon name="keyboard_double_arrow_right" className="slide-cta-hint" />
              <span className="slide-cta-label">{hero.cta}</span>
              <span className="slide-cta-knob"><Icon name="keyboard_double_arrow_right" /></span>
            </button>
          </section>

          {showSetup && (
            <section className="card setup-card" aria-labelledby="setup-title">
              <div className="card-header">
                <div>
                  <h2 id="setup-title" className="title-medium">Get set up</h2>
                  <p className="body-small text-variant">{3 - setupRemaining} of 3 done</p>
                </div>
                <button type="button" className="icon-btn state-layer" onClick={() => { writeFlag(SETUP_DISMISSED); setSetupDismissed(true); }} aria-label="Dismiss setup"><Icon name="close" /></button>
              </div>
              <ol className="list setup-list" role="list">
                {setupSteps.map(step => (
                  <li key={step.label}>
                    <Link to={step.to} className={`list-item state-layer setup-step${step.done ? ' done' : ''}`}>
                      <span className={`check-btn${step.done ? ' done' : ''}`} aria-hidden="true"><Icon name={step.done ? 'check' : step.icon} /></span>
                      <span className="list-item-content">
                        <span className="list-item-headline">{step.label}</span>
                        <span className="list-item-supporting">{step.done ? 'Done' : step.detail}</span>
                      </span>
                      {!step.done && <Icon name="chevron_right" className="text-variant" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {goals.length > 0 && (
            <section aria-labelledby="plan-title">
              <div className="section-head">
                <h2 id="plan-title" className="title-large">Your plan for today</h2>
                <Link to="/goals" className="see-all">See all</Link>
              </div>
              <ul className="plan-list" role="list">
                {plan.map(goal => {
                  const done = goal.checkedInThisPeriod;
                  const mood = MOODS.find(item => item.value === goal.currentCheckIn?.mood);
                  return (
                    <li key={goal._id} className={`plan-item${done ? ' done' : ''}`}>
                      <span className={`tile ${tileClass(goal)}`} aria-hidden="true">{goal.emoji || '🎯'}</span>
                      <button type="button" className="plan-item-body" onClick={() => setCheckInGoal(goal)}>
                        <span className="list-item-headline">{goal.title}</span>
                        <span className="list-item-supporting">
                          {done
                            ? `Done ${periodLabel(goal)}${mood ? ` · ${mood.emoji} ${mood.label}` : ''}`
                            : goal.streak > 0 ? `🔥 ${plural(goal.streak, periodWord(goal))} streak · tap to check in` : 'Tap to complete this goal'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`check-btn state-layer${done ? ' done' : ''}`}
                        onClick={() => (done ? setCheckInGoal(goal) : quickCheckIn(goal))}
                        disabled={quickId === goal._id}
                        aria-label={done ? `${goal.title} done — edit check-in` : `Mark ${goal.title} done ${periodLabel(goal)}`}
                      >
                        <Icon name="check" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {goals.length > 0 && (
            <Link to="/goals" className="impact-card state-layer">
              <span className="impact-icon" aria-hidden="true"><Icon name={nextStep ? 'bolt' : 'checklist'} filled /></span>
              <span className="list-item-content">
                <span className="title-small">{nextStep ? `Next: ${nextStep.todo.title}` : 'Small change, big impact'}</span>
                <span className="body-small impact-sub">
                  {nextStep
                    ? `${nextStep.goal.title} · ${nextStep.goal.todoProgress.done}/${nextStep.goal.todoProgress.total} steps achieved`
                    : 'Break a goal into small steps to keep moving.'}
                </span>
              </span>
              <Icon name="chevron_right" />
            </Link>
          )}
        </div>

        <aside className="today-side">
          <section className="month-card" aria-labelledby="month-title">
            <h2 id="month-title" className="visually-hidden">{formatDate(month.monthStart, { month: 'long' })} progress</h2>
            <p className="month-figure"><strong>{month.achieved}/{month.expected}</strong><span className="body-small">check-ins achieved</span></p>
            <span className="completion-pill"><span className="italic-accent">{month.rate}%</span> completion</span>
            <p className={`label-medium month-streak${user?.streakToday ? ' lit' : ''}`}>
              {user?.streakToday
                ? `🔥 ${plural(user?.streak || 0, 'day')} streak — extended today`
                : (user?.streak || 0) > 0
                  ? `🔥 ${plural(user.streak, 'day')} streak — finish one step or check-in to keep it`
                  : '🔥 Finish one step or check-in to start a streak'}
            </p>
          </section>

          <section className="card calendar-card" aria-labelledby="calendar-title">
            <div className="card-header">
              <h2 id="calendar-title" className="title-medium">{formatDate(month.monthStart, { month: 'long', year: 'numeric' })}</h2>
              <span className="body-small text-variant">{plural(month.completedDays.size, 'active day')}</span>
            </div>
            <MonthCalendar completedDays={month.completedDays} monthStart={month.monthStart} />
          </section>

          <section className="card section-card" aria-labelledby="circle-title">
            <div className="section-head">
              <h2 id="circle-title" className="title-medium">Your circle</h2>
              <Link to="/friends" className="see-all">See all</Link>
            </div>
            {friends.length === 0 ? (
              <div className="section-empty-block">
                <p className="body-medium text-variant">Accountability works better together.</p>
                <Link to="/friends?tab=add" className="btn btn-tonal state-layer"><Icon name="person_add" />Add a friend</Link>
              </div>
            ) : needNudge.length === 0 ? (
              <p className="body-medium text-variant section-empty"><Icon name="verified" filled className="text-primary" />Everyone has checked in today.</p>
            ) : (
              <ul className="list" role="list">
                {needNudge.map(friend => (
                  <li key={friend._id} className="list-item">
                    <Avatar name={friend.name} src={friend.avatar} />
                    <span className="list-item-content">
                      <span className="list-item-headline">{friend.name}</span>
                      <span className="list-item-supporting">Last check-in {relativeTime(friend.lastCheckIn).toLowerCase()}</span>
                    </span>
                    <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={() => setNudgeFriend(friend)} disabled={friend.nudgesSentToday >= 3} title={friend.nudgesSentToday >= 3 ? 'Daily limit reached' : undefined}>Nudge</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card section-card" aria-labelledby="inbox-title">
            <div className="section-head">
              <h2 id="inbox-title" className="title-medium">New in inbox</h2>
              <Link to="/inbox" className="see-all">See all</Link>
            </div>
            {inbox.length === 0 ? (
              <p className="body-medium text-variant section-empty"><Icon name="mark_email_read" className="text-primary" />You’re all caught up.</p>
            ) : (
              <ul className="list" role="list">
                {inbox.map(reminder => {
                  const automated = reminder.type === 'automated';
                  return (
                    <li key={reminder._id}>
                      <button type="button" className="list-item three-line state-layer" onClick={() => navigate('/inbox')}>
                        <Avatar name={reminder.from?.name} icon={automated ? 'alarm' : reminder.type === 'encouragement' ? 'celebration' : undefined} size="sm" />
                        <span className="list-item-content">
                          <span className="list-item-overline">{automated ? 'Daily reminder' : reminder.from?.name || 'A friend'} · {relativeTime(reminder.createdAt)}</span>
                          <span className="list-item-supporting clamp-2">{reminder.message}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {checkInGoal && <CheckInDialog goal={checkInGoal} onClose={() => setCheckInGoal(null)} onSaved={goal => { replaceGoal(goal); setCheckInGoal(null); }} />}
      {nudgeFriend && <NudgeDialog friend={nudgeFriend} onClose={() => setNudgeFriend(null)} onSent={() => setFriends(current => current.map(friend => (friend._id === nudgeFriend._id ? { ...friend, nudgesSentToday: friend.nudgesSentToday + 1 } : friend)))} />}
    </div>
  );
}
