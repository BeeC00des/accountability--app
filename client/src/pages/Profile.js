import React, { useState } from 'react';
import { useAuth, API } from '../context/AuthContext';

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kolkata', 'Africa/Lagos', 'Australia/Sydney'];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    reminderTime: user?.reminderTime || '08:00',
    timezone: user?.timezone || 'UTC',
    notificationsEnabled: user?.notificationsEnabled !== false
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async e => {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await API.put('/auth/profile', form);
      updateUser(res.data.user);
      setSuccess('Profile saved!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <div className="page">
      <div className="page-header">
        <h2>Profile</h2>
        <p>Manage your account and preferences</p>
      </div>

      {/* Avatar and stats */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="avatar avatar-lg" style={{ width: '72px', height: '72px', fontSize: '1.5rem' }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{user?.name}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</p>
          {memberSince && <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '4px' }}>Member since {memberSince}</p>}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>🔥 {user?.streak || 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Day streak</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-light)' }}>{user?.friends?.length || 0}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends</div>
          </div>
        </div>
      </div>

      {/* Settings form */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1.5rem' }}>Settings</h3>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label">Display name</label>
            <input className="form-input" type="text" value={form.name} onChange={set('name')} required />
          </div>

          <hr className="divider" />
          <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Reminder settings</p>

          <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Daily reminder time</label>
              <input className="form-input" type="time" value={form.reminderTime} onChange={set('reminderTime')} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Timezone</label>
              <select className="form-select" value={form.timezone} onChange={set('timezone')}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.875rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <input type="checkbox" id="notif" checked={form.notificationsEnabled} onChange={set('notificationsEnabled')} style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <div>
              <label htmlFor="notif" style={{ fontWeight: 500, cursor: 'pointer', display: 'block', fontSize: '0.875rem' }}>Daily reminders</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive automated daily nudges from your friends</p>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* About the app */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>How it works</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            ['🎯', 'Set goals', 'Create daily or weekly habits you want to build'],
            ['✅', 'Check in', 'Log your progress every day to build a streak'],
            ['🔥', 'Build streaks', 'Consistency is the key — never miss twice'],
            ['👥', 'Add friends', 'Connect with others for mutual accountability'],
            ['🔔', 'Send reminders', 'Nudge your friends when they need a push'],
          ].map(([emoji, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{emoji}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
