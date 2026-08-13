import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';

const formatDate = d => {
  if (!d) return 'Never';
  const date = new Date(d);
  const diff = Math.floor((Date.now() - date) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
};

const categoryColor = {
  spirtual : '#4ade80', learning: '#60a5fa', health: '#f472b6',
  career: '#a78bfa', personal: '#fb923c', finance: '#34d399', ot: '#888'
};

export default function Dashboard() {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [friends, setFriends] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(null);

  useEffect(() => {
    Promise.all([
      API.get('/goals'),
      API.get('/friends'),
      API.get('/reminders')
    ]).then(([g, f, r]) => {
      setGoals(g.data.goals);
      setFriends(f.data.friends);
      setReminders(r.data.reminders.filter(r => !r.isRead).slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const todayGoals = goals.filter(g => {
    const today = new Date(); today.setHours(0,0,0,0);
    return !g.checkIns.some(c => {
      const d = new Date(c.date); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime() && c.completed;
    });
  });

  const completedToday = goals.length - todayGoals.length;
  const totalCheckIns = goals.reduce((s, g) => s + g.checkIns.filter(c => c.completed).length, 0);

  const quickCheckin = async (goalId) => {
    setCheckingIn(goalId);
    try {
      await API.post(`/goals/${goalId}/checkin`, { completed: true, note: '', mood: 'good' });
      const res = await API.get('/goals');
      setGoals(res.data.goals);
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingIn(null);
    }
  };

  const isCheckedToday = (goal) => {
    const today = new Date(); today.setHours(0,0,0,0);
    return goal.checkIns.some(c => {
      const d = new Date(c.date); d.setHours(0,0,0,0);
      return d.getTime() === today.getTime() && c.completed;
    });
  };

  if (loading) return <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><div className="spinner" /></div>;

  const initials = n => n?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';

  return (
    <div className="page">
      <div className="page-header">
        <h2>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]} 👋</h2>
        <p style={{ paddingTop:'3px', fontSize: '1rem', fontWeight: 500 }}>Welcome to growth with sunshine, standout today!</p>
      </div>

      {/* Stats */}
      <div className="grid-stat" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">🔥 {user?.streak || 0}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedToday}/{goals.length}</div>
          <div className="stat-label">Done Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalCheckIns}</div>
          <div className="stat-label">Total Check-ins</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{friends.length}</div>
          <div className="stat-label">Friends</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Today's goals */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Today's goals</h3>
            <Link to="/goals" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {goals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎯</div>
              <h4>No goals yet</h4>
              <p>Add your first goal to get started</p>
              <Link to="/goals" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>Add a goal</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {goals.slice(0, 5).map(goal => {
                const done = isCheckedToday(goal);
                return (
                  <div key={goal._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'var(--bg-card)', border: `1px solid ${done ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', opacity: done ? 0.7 : 1 }}>
                    <span style={{ fontSize: '1.25rem' }}>{goal.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : 'var(--text)' }}>{goal.title}</div>
                      <div style={{ fontSize: '0.75rem', color: categoryColor[goal.category] || 'var(--text-muted)' }}>{goal.category} · {goal.streak > 0 && `🔥 ${goal.streak} streak`}</div>
                    </div>
                    {!done ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => quickCheckin(goal._id)} disabled={checkingIn === goal._id}>
                        {checkingIn === goal._id ? '…' : '✓ Done'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '1.25rem' }}>✅</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Unread reminders */}
          {reminders.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>New reminders</h3>
                <Link to="/reminders" className="btn btn-ghost btn-sm">See all</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {reminders.map(r => (
                  <div key={r._id} style={{ padding: '0.875rem', background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-light)' }}>{r.from?.name || 'Friend'}</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends activity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Friends</h3>
              <Link to="/friends" className="btn btn-ghost btn-sm">Manage</Link>
            </div>
            {friends.length === 0 ? (
              <div style={{ padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Add friends to hold each other accountable!</p>
                <Link to="/friends" className="btn btn-primary btn-sm" style={{ marginTop: '0.75rem' }}>Find friends</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {friends.slice(0, 4).map(f => (
                  <div key={f._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="avatar">{initials(f.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last seen: {formatDate(f.lastCheckIn)}</div>
                    </div>
                    <span className="streak">🔥 {f.streak || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
