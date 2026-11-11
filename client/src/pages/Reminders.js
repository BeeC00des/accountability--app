import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';

const relativeTime = date => {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return formatter.format(Math.round(seconds), 'second');
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour');
  return formatter.format(Math.round(seconds / 86400), 'day');
};

const initials = name => name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';

export default function Reminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => API.get('/reminders')
    .then(response => setReminders(response.data.reminders))
    .catch(() => setError('Could not load reminders. Please try again.'))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const markRead = async id => {
    try {
      await API.put(`/reminders/${id}/read`);
      setReminders(current => current.map(reminder => reminder._id === id ? { ...reminder, isRead: true } : reminder));
    } catch {
      setError('Could not update this reminder. Please try again.');
    }
  };

  const markAllRead = async () => {
    try {
      await API.put('/reminders/read-all');
      setReminders(current => current.map(reminder => ({ ...reminder, isRead: true })));
    } catch {
      setError('Could not update reminders. Please try again.');
    }
  };

  const unreadCount = reminders.filter(reminder => !reminder.isRead).length;
  if (loading) return <div className="page loading-state"><div className="spinner" role="status" aria-label="Loading reminders" /></div>;

  return (
    <div className="page page-narrow">
      <div className="page-header page-header-actions">
        <div><h2>Reminders</h2><p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p></div>
        {unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all as read</button>}
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {reminders.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon" aria-hidden="true">🔔</div>
          <h3>No reminders yet</h3>
          <p>Friend reminders and personal check-in nudges will appear here.</p>
        </div>
      ) : (
        <div className="reminder-list">
          {reminders.map(reminder => {
            const automated = reminder.type === 'automated';
            const sender = automated ? 'Your accountability reminder' : (reminder.from?.name || 'A friend');
            return (
              <article key={reminder._id} className={`reminder-card${!reminder.isRead ? ' unread' : ''}`}>
                <div className="avatar" aria-hidden="true">{automated ? '✓' : initials(reminder.from?.name)}</div>
                <div className="reminder-body">
                  <h3>{sender}</h3>
                  <p>{reminder.message}</p>
                  {reminder.goal && <p className="reminder-goal">Re: {reminder.goal.emoji} {reminder.goal.title}</p>}
                  <p className="reminder-time"><time dateTime={reminder.createdAt} title={new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(reminder.createdAt))}>{relativeTime(reminder.createdAt)}</time> · {automated ? 'Personal nudge' : 'Friend reminder'}{!reminder.isRead && ' · Unread'}</p>
                </div>
                {!reminder.isRead && <button className="btn btn-ghost btn-sm reminder-read" onClick={() => markRead(reminder._id)} aria-label={`Mark reminder from ${sender} as read`}>Mark read</button>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
