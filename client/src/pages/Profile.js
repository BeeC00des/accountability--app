import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, Icon, Switch, TextField } from '../components/ui';
import { ChangePasswordDialog, EditProfileDialog } from '../components/ProfileDialogs';
import { savePreference } from '../lib/consent';
import { testAlarm, unlockAudio } from '../lib/alarm';
import { apiError, formatDate, plural } from '../lib/format';

const TIMEZONES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', 'Africa/Lagos', 'America/Los_Angeles', 'America/New_York', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris'];
const browserTimezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };

const HOW_IT_WORKS = [
  ['flag', 'Set a goal', 'Pick a daily or weekly rhythm and break it into steps.'],
  ['check_circle', 'Check in', 'One tap each day or week. Notes and mood are private.'],
  ['local_fire_department', 'Build streaks', 'Every period you show up adds to your streak.'],
  ['group', 'Share with friends', 'Friends see shared goals and can nudge or cheer you.'],
  ['notifications', 'Get reminded', 'A daily reminder arrives if a goal still needs a check-in.']
];

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState(null); // 'profile' | 'password'
  const [reminders, setReminders] = useState({
    reminderTime: user?.reminderTime || '08:00',
    reminderTime2: user?.reminderTime2 || '20:00',
    alarmSound: user?.alarmSound !== false,
    timezone: user?.timezone || browserTimezone() || 'UTC',
    notificationsEnabled: user?.notificationsEnabled !== false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const allowNotifications = async () => {
    try { setPermission(await Notification.requestPermission()); } catch { setPermission('denied'); }
  };

  useEffect(() => {
    if (location.hash === '#settings') document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  // /profile?edit=1 (from the account menu) opens the editor.
  useEffect(() => {
    if (params.get('edit')) { setDialog('profile'); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const set = (key, value) => setReminders(current => ({ ...current, [key]: value }));
  const detected = browserTimezone();
  const dirty = reminders.reminderTime !== (user?.reminderTime || '08:00')
    || reminders.reminderTime2 !== (user?.reminderTime2 || '20:00')
    || reminders.alarmSound !== (user?.alarmSound !== false)
    || reminders.timezone !== (user?.timezone || 'UTC')
    || reminders.notificationsEnabled !== (user?.notificationsEnabled !== false);

  const saveReminders = async event => {
    event.preventDefault();
    if (reminders.reminderTime2 === reminders.reminderTime) { setError('Choose two different reminder times.'); return; }
    setSaving(true);
    setError('');
    try {
      const response = await API.put('/auth/profile', reminders);
      const { friends, friendRequests, ...rest } = response.data.user;
      updateUser(rest);
      savePreference('accountable-reminder-set', '1');
      notify('Reminder settings saved');
    } catch (saveError) {
      setError(apiError(saveError, 'Could not save your settings.'));
    } finally {
      setSaving(false);
    }
  };

  const friendCount = user?.friends?.length || 0;
  const accountRows = [
    { icon: 'badge', label: 'Name', value: user?.name, onClick: () => setDialog('profile') },
    { icon: 'mail', label: 'Email', value: user?.email, onClick: () => setDialog('profile') },
    { icon: 'notes', label: 'Bio', value: user?.bio || 'Add a short bio', muted: !user?.bio, onClick: () => setDialog('profile') },
    { icon: 'lock', label: 'Password', value: '••••••••', onClick: () => setDialog('password') },
    { icon: 'workspace_premium', label: 'Plan', value: user?.plan === 'premium' ? 'Premium' : user?.premiumRequestedAt ? 'Free · Premium requested' : 'Free', onClick: () => navigate('/community') }
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Profile</h1>
          <p className="body-large text-variant">Your account and reminder preferences.</p>
        </div>
        <button type="button" className="btn btn-filled state-layer" onClick={() => setDialog('profile')}><Icon name="edit" />Edit profile</button>
      </header>

      <section className="card card-filled profile-hero" aria-label="Account summary">
        <button type="button" className="profile-photo state-layer" onClick={() => setDialog('profile')} aria-label={user?.avatar ? 'Change profile photo' : 'Add profile photo'}>
          <Avatar self name={user?.name} src={user?.avatar} size="xl" />
          <span className="photo-editor-badge" aria-hidden="true"><Icon name="photo_camera" filled /></span>
        </button>
        <div className="list-item-content profile-identity">
          <h2 className="title-large">{user?.name}</h2>
          {user?.bio
            ? <p className="body-medium profile-bio">{user.bio}</p>
            : <button type="button" className="link-btn body-medium" onClick={() => setDialog('profile')}>Add a short bio</button>}
          <p className="body-small text-variant">{user?.email}{user?.createdAt && ` · Member since ${formatDate(user.createdAt, { month: 'long', year: 'numeric' })}`}</p>
        </div>
        <div className="profile-stats">
          <div><strong className="title-large">🔥 {user?.streak || 0}</strong><span className="body-small text-variant">Day streak</span></div>
          <div><strong className="title-large">{friendCount}</strong><span className="body-small text-variant">{friendCount === 1 ? 'Friend' : 'Friends'}</span></div>
        </div>
      </section>

      <section className="card account-card" aria-labelledby="account-title">
        <h2 id="account-title" className="title-medium card-title">Account</h2>
        <ul className="settings-list" role="list">
          {accountRows.map(row => (
            <li key={row.label}>
              <button type="button" className="settings-row state-layer" onClick={row.onClick} aria-label={row.label === 'Plan' ? 'Plan: open Community' : `Edit ${row.label.toLowerCase()}`}>
                <span className="settings-row-icon" aria-hidden="true"><Icon name={row.icon} /></span>
                <span className="settings-row-label body-large">{row.label}</span>
                <span className={`settings-row-value body-medium${row.muted ? ' muted' : ''}`}>{row.swatch && <span className="row-swatch" style={{ background: row.swatch }} aria-hidden="true" />}{row.value}</span>
                <Icon name="chevron_right" className="text-variant" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form className="card settings-card" id="settings" onSubmit={saveReminders} noValidate>
        <h2 className="title-medium card-title">Daily reminders</h2>
        {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
        <label className="setting-row" htmlFor="notifications-enabled">
          <Icon name="notifications_active" className="text-variant" />
          <span className="setting-row-text">
            <span className="body-large">Remind me to check in</span>
            <span className="body-medium text-variant">Twice a day. Only sent when a goal still needs a check-in.</span>
          </span>
          <Switch id="notifications-enabled" checked={reminders.notificationsEnabled} onChange={value => set('notificationsEnabled', value)} />
        </label>
        <div className="field-row">
          <TextField label="Morning reminder" type="time" value={reminders.reminderTime} onChange={event => set('reminderTime', event.target.value)} disabled={!reminders.notificationsEnabled} />
          <TextField label="Evening reminder" type="time" value={reminders.reminderTime2} onChange={event => set('reminderTime2', event.target.value)} disabled={!reminders.notificationsEnabled} error={reminders.reminderTime2 === reminders.reminderTime ? 'Pick a different time from the morning reminder.' : undefined} />
        </div>
        <label className="setting-row" htmlFor="alarm-sound">
          <Icon name="alarm" className="text-variant" />
          <span className="setting-row-text">
            <span className="body-large">Alarm sound</span>
            <span className="body-medium text-variant">Rings at both times while accounTable is open in a tab.</span>
          </span>
          <Switch id="alarm-sound" checked={reminders.alarmSound} onChange={value => set('alarmSound', value)} disabled={!reminders.notificationsEnabled} />
        </label>
        <div className="alarm-tools">
          <button type="button" className="btn btn-outlined state-layer" onClick={() => { unlockAudio(); testAlarm(); }}><Icon name="volume_up" />Test alarm</button>
          {permission === 'default' && <button type="button" className="btn btn-tonal state-layer" onClick={allowNotifications}><Icon name="notifications_active" />Allow notifications</button>}
          {permission === 'granted' && <span className="body-small text-variant"><Icon name="check_circle" size="18" /> Notifications on: you’ll also get a pop-up when the tab is in the background.</span>}
          {permission === 'denied' && <span className="body-small text-variant">Notifications are blocked in your browser settings.</span>}
        </div>
        <div className="field-row">
          <TextField
            as="select"
            label="Time zone"
            value={reminders.timezone}
            onChange={event => set('timezone', event.target.value)}
            help={reminders.timezone !== detected && detected ? <>Your device is on {detected.replaceAll('_', ' ')}. <button type="button" className="link-btn" onClick={() => set('timezone', detected)}>Use it</button></> : 'Your day and reminder follow this zone.'}
          >
            {!TIMEZONES.includes(reminders.timezone) && <option value={reminders.timezone}>{reminders.timezone}</option>}
            {TIMEZONES.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
          </TextField>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-filled state-layer" disabled={saving || !dirty}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        </div>
      </form>

      <section className="card" aria-labelledby="how-title">
        <h2 id="how-title" className="title-medium card-title">How accounTable works</h2>
        <ol className="list how-list" role="list">
          {HOW_IT_WORKS.map(([icon, title, text], index) => (
            <li key={title} className="list-item">
              <span className="how-step" aria-hidden="true"><Icon name={icon} /></span>
              <span className="list-item-content">
                <span className="list-item-headline">{index + 1}. {title}</span>
                <span className="list-item-supporting">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="form-actions sign-out-row">
        <span className="body-small text-variant">{plural(friendCount, 'friend')} in your circle</span>
        <button type="button" className="btn btn-outlined btn-danger state-layer" onClick={() => { logout(); navigate('/auth'); }}><Icon name="logout" />Sign out</button>
      </div>

      {dialog === 'profile' && <EditProfileDialog onClose={() => setDialog(null)} />}
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
