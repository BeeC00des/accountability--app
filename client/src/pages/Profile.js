import React, { useState } from 'react';
import { useAuth, API } from '../context/AuthContext';

const getTimezones = () => {
  if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  return ['UTC', 'Africa/Lagos', 'America/Los_Angeles', 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris'];
};
const TIMEZONES = getTimezones();

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    reminderTime: user?.reminderTime || '08:00',
    timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    notificationsEnabled: user?.notificationsEnabled !== false
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const set = key => event => setForm(formState => ({
    ...formState,
    [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value
  }));

  const save = async event => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await API.put('/auth/profile', form);
      updateUser(response.data.user);
      setSuccess('Profile saved. Reminder times use your selected time zone.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';
  const memberSince = user?.createdAt ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(user.createdAt)) : '';

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <h2>Profile</h2>
        <p>Manage your account and preferences</p>
      </div>

      <section className="card profile-card" aria-label="Account summary">
        <div className="avatar avatar-lg" aria-hidden="true">{initials}</div>
        <div className="profile-card-copy">
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          {memberSince && <p className="member-since">Member since {memberSince}</p>}
        </div>
        <div className="profile-stat"><strong>🔥 {user?.streak || 0}</strong><span>Day streak</span></div>
        <div className="profile-stat"><strong>{user?.friends?.length || 0}</strong><span>Friends</span></div>
      </section>

      <section className="card settings-card">
        <h3 className="section-title">Account settings</h3>
        {success && <div className="alert alert-success" role="status">{success}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label" htmlFor="display-name">Display name</label>
            <input id="display-name" className="form-input" type="text" autoComplete="name" maxLength={50} value={form.name} onChange={set('name')} required />
          </div>
          <hr className="divider" />
          <h4 className="settings-subtitle">Reminder preferences</h4>
          <div className="grid-2 settings-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="reminder-time">Daily reminder time</label>
              <input id="reminder-time" className="form-input" type="time" value={form.reminderTime} onChange={set('reminderTime')} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="timezone">Time zone</label>
              <select id="timezone" className="form-select" value={form.timezone} onChange={set('timezone')}>
                {!TIMEZONES.includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
                {TIMEZONES.map(timezone => <option key={timezone} value={timezone}>{timezone.replaceAll('_', ' ')}</option>)}
              </select>
              <p className="field-help">Your check-in day and reminder time follow this time zone.</p>
            </div>
          </div>
          <label className="preference-toggle" htmlFor="notifications-enabled">
            <input id="notifications-enabled" type="checkbox" checked={form.notificationsEnabled} onChange={set('notificationsEnabled')} />
            <span><strong>Daily reminders</strong><small>Get a private nudge when you have goals to check in on.</small></span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </section>

      <section className="card about-card">
        <h3 className="section-title">How it works</h3>
        <ul className="how-list">
          {[
            ['🎯', 'Set goals', 'Create daily or weekly habits you want to build'],
            ['✅', 'Check in', 'Log progress in your local day or week'],
            ['🔥', 'Build streaks', 'Celebrate consistent effort, one period at a time'],
            ['👥', 'Add friends', 'Connect with people who support your goals'],
            ['🔔', 'Send reminders', 'Encourage friends when they need a nudge'],
          ].map(([emoji, title, description]) => (
            <li key={title}><span aria-hidden="true">{emoji}</span><div><strong>{title}</strong><p>{description}</p></div></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
