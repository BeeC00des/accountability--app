import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';

const timeAgo = d => {
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

  return `${Math.floor(diff / 86400)}d ago`;
};

const initials = n => n?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => API.get('/reminders').then(r => setReminders(r.data.reminders)).finally(() => setLoading(false));
  
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await API.put(`/reminders/${id}/read`);
    setReminders(rs => rs.map(r => r._id === id ? { ...r, isRead: true } : r));
  };

  const markAllRead = async () => {
    await API.put('/reminders/read-all');
    setReminders(rs => rs.map(r => ({ ...r, isRead: true })));
  };

  const unreadCount = reminders.filter(r => !r.isRead).length;

  if (loading) return <div className="page" style={{ display:'flex', justifyContent:'center', paddingTop:'4rem' }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header" style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h2>Reminders</h2>
          <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>

      {reminders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h3>No reminders yet</h3>
          <p>When friends send you reminders or automated daily nudges arrive, they'll show up here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {reminders.map(r => (
            <div
              key={r._id}
              className={`reminder-card${!r.isRead ? ' unread' : ''}`}
              onClick={() => !r.isRead && markRead(r._id)}
              style={{ cursor: !r.isRead ? 'pointer' : 'default' }}
            >
              <div className="avatar">{initials(r.from?.name)}</div>
              <div className="reminder-body">
                <h4>{r.from?.name || 'System'}</h4>
                <p>{r.message}</p>
                {r.goal && (
                  <p style={{ marginTop: '2px', color: 'var(--accent-light)', fontSize: '0.8rem' }}>
                    re: {r.goal.emoji} {r.goal.title}
                  </p>
                )}
                <p className="reminder-time">
                  {timeAgo(r.createdAt)} · {r.type === 'automated' ? '🤖 Automated' : '💬 Personal'}
                  {!r.isRead && <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>· Unread</span>}
                </p>
              </div>
              {!r.isRead && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '4px' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
