import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';

const dateKey = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const periodKey = (date, timeZone, frequency) => {
  const localDate = dateKey(date, timeZone);
  if (frequency !== 'weekly') return localDate;
  const cursor = new Date(`${localDate}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  return cursor.toISOString().slice(0, 10);
};

const initials = name => name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';
const relativeTime = date => {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(Math.round(seconds), 'second');
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
};

export default function Dashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [friends, setFriends] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingIn, setCheckingIn] = useState('');

  const loadDashboard = async () => {
    setError('');
    try {
      const [goalResponse, friendResponse, reminderResponse] = await Promise.all([
        API.get('/goals'), API.get('/friends'), API.get('/reminders')
      ]);
      setGoals(goalResponse.data.goals || []);
      setFriends(friendResponse.data.friends || []);
      setReminders((reminderResponse.data.reminders || []).filter(reminder => !reminder.isRead).slice(0, 4));
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Some dashboard information could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadDashboard(); }, []);

  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const now = new Date();
  const goalIsDone = goal => (goal.checkIns || []).some(checkIn => checkIn.completed &&
    periodKey(checkIn.date, timezone, goal.frequency || 'daily') === periodKey(now, timezone, goal.frequency || 'daily'));
  const activeGoals = goals.filter(goal => goal.isActive !== false && (!goal.endDate || new Date(goal.endDate) >= now));
  const pendingGoals = activeGoals.filter(goal => !goalIsDone(goal));
  const completedGoals = activeGoals.length - pendingGoals.length;
  const totalCheckIns = activeGoals.reduce((sum, goal) => sum + (goal.checkIns || []).filter(checkIn => checkIn.completed).length, 0);
  const annualGoals = activeGoals.filter(goal => Number(goal.targetDays) >= 300);

  const quickCheckIn = async goalId => {
    setCheckingIn(goalId);
    setError('');
    try {
      await API.post(`/goals/${goalId}/checkin`, { completed: true, note: '', mood: 'good' });
      const response = await API.get('/goals');
      setGoals(response.data.goals || []);
    } catch (checkInError) {
      setError(checkInError.response?.data?.message || 'Could not save your check-in.');
    } finally {
      setCheckingIn('');
    }
  };

  const greetingHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(now));
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';

  if (loading) return <div className="page loading-state"><div className="spinner" role="status" aria-label="Loading dashboard" /></div>;

  return (
    <div className="page dashboard-page">
      <header className="page-header dashboard-header">
        <div><p className="eyebrow">YOUR ACCOUNTABILITY SPACE</p><h2>{greeting}, {firstName}</h2><p>Small steps today make long-term goals possible.</p></div>
        <Link to="/goals" className="btn btn-primary">+ New goal</Link>
      </header>
      {error && <div className="alert alert-error" role="alert">{error}<button className="inline-link" onClick={loadDashboard}>Retry</button></div>}

      <section className="dashboard-stats" aria-label="Your progress">
        <article className="dashboard-stat"><span className="dashboard-stat-icon" aria-hidden="true">🔥</span><strong>{user?.streak || 0}</strong><span>Current streak</span></article>
        <article className="dashboard-stat"><span className="dashboard-stat-icon" aria-hidden="true">✓</span><strong>{completedGoals}<small>/{activeGoals.length}</small></strong><span>Goals done this period</span></article>
        <article className="dashboard-stat"><span className="dashboard-stat-icon" aria-hidden="true">↗</span><strong>{totalCheckIns}</strong><span>Total check-ins</span></article>
        <article className="dashboard-stat"><span className="dashboard-stat-icon" aria-hidden="true">♧</span><strong>{friends.length}</strong><span>Accountability partners</span></article>
      </section>

      {annualGoals.length > 0 && (
        <section className="annual-highlight" aria-labelledby="annual-heading">
          <div><span className="annual-icon" aria-hidden="true">✦</span><div><h3 id="annual-heading">Your long-term goals</h3><p>{annualGoals.length} year-long goal{annualGoals.length === 1 ? '' : 's'} in progress. Keep showing up, one check-in at a time.</p></div></div>
          <Link to="/goals" className="btn btn-ghost btn-sm">View goals</Link>
        </section>
      )}

      <div className="dashboard-columns">
        <section className="dashboard-panel" aria-labelledby="today-goals-heading">
          <div className="dashboard-panel-heading"><div><h3 id="today-goals-heading">Your goals</h3><p>{pendingGoals.length ? `${pendingGoals.length} ready for a check-in` : 'You’re all caught up for this period'}</p></div><Link to="/goals" className="text-link">View all</Link></div>
          {activeGoals.length === 0 ? (
            <div className="empty-state card"><div className="empty-icon" aria-hidden="true">◎</div><h3>Start with one meaningful goal</h3><p>Choose a daily, weekly, or year-long goal and build progress at your own pace.</p><Link to="/goals" className="btn btn-primary btn-sm dashboard-empty-action">Create a goal</Link></div>
          ) : (
            <div className="dashboard-goal-list">
              {activeGoals.slice(0, 6).map(goal => {
                const done = goalIsDone(goal);
                const completed = (goal.checkIns || []).filter(checkIn => checkIn.completed).length;
                const annual = Number(goal.targetDays) >= 300;
                return <article className={`dashboard-goal${done ? ' complete' : ''}`} key={goal._id}>
                  <span className="dashboard-goal-emoji" aria-hidden="true">{goal.emoji || '🎯'}</span>
                  <div className="dashboard-goal-copy"><strong>{goal.title}</strong><span>{annual ? 'Year-long goal' : `${goal.frequency || 'daily'} goal`} · {completed} check-in{completed === 1 ? '' : 's'}{goal.streak ? ` · ${goal.streak} period streak` : ''}</span></div>
                  {done ? <span className="goal-done-label">Done ✓</span> : <button className="btn btn-ghost btn-sm" onClick={() => quickCheckIn(goal._id)} disabled={checkingIn === goal._id}>{checkingIn === goal._id ? 'Saving…' : 'Check in'}</button>}
                </article>;
              })}
            </div>
          )}
        </section>

        <aside className="dashboard-side">
          <section className="dashboard-panel" aria-labelledby="reminders-heading">
            <div className="dashboard-panel-heading"><div><h3 id="reminders-heading">Reminders</h3><p>{reminders.length ? `${reminders.length} unread` : 'Nothing new right now'}</p></div><Link to="/reminders" className="text-link">Inbox</Link></div>
            {reminders.length > 0 ? <div className="dashboard-reminders">{reminders.map(reminder => <article className="dashboard-reminder" key={reminder._id}><span className="avatar" aria-hidden="true">{initials(reminder.from?.name)}</span><div><strong>{reminder.from?.name || 'Accountable'}</strong><p>{reminder.message}</p><time dateTime={reminder.createdAt}>{relativeTime(reminder.createdAt)}</time></div></article>)}</div> : <p className="dashboard-supporting-copy">Friend encouragement and check-in nudges will show up here.</p>}
          </section>
          <section className="dashboard-panel" aria-labelledby="friends-heading">
            <div className="dashboard-panel-heading"><div><h3 id="friends-heading">Your circle</h3><p>{friends.length ? `${friends.length} accountability partner${friends.length === 1 ? '' : 's'}` : 'Progress is better together'}</p></div><Link to="/friends" className="text-link">{friends.length ? 'Manage' : 'Connect'}</Link></div>
            {friends.length ? <div className="dashboard-friends">{friends.slice(0, 4).map(friend => <div className="dashboard-friend" key={friend._id}><span className="avatar" aria-hidden="true">{initials(friend.name)}</span><strong>{friend.name}</strong><span className="streak">🔥 {friend.streak || 0}</span></div>)}</div> : <p className="dashboard-supporting-copy">Invite someone who can encourage your long-term goals.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
