import React, { useState, useEffect } from 'react';
import { API } from '../context/AuthContext';

const initials = n => n?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || '?';
const formatDate = d => {
  if (!d) return 'Never';
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (diff === 0) return 'Today'; if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
};

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSending] = useState(false);
  const [sending, setSendingReq] = useState(false);
  const [reminderTo, setReminderTo] = useState(null);
  const [reminderMsg, setReminderMsg] = useState("Hey! Don't forget to check in on your goals today 💪");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [success, setSuccess] = useState('');

  const load = () => Promise.all([
    API.get('/friends'),
    API.get('/friends/requests')
  ]).then(([f, r]) => {
    setFriends(f.data.friends);
    setRequests(r.data.requests);
  }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const search = async () => {
    if (!searchEmail.trim()) return;
    setSending(true);
    setSearchError(''); setSearchResult(null);
    try {
      const r = await API.post('/friends/search', { email: searchEmail });
      setSearchResult(r.data);
    } catch (e) {
      setSearchError(e.response?.data?.message || 'User not found.');
    } finally {
      setSending(false);
    }
  };

  const sendRequest = async (userId) => {
    setSendingReq(true);
    try {
      await API.post(`/friends/request/${userId}`);
      setSearchResult(r => ({ ...r, hasPendingRequest: true }));
      setSuccess('Friend request sent!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setSearchError(e.response?.data?.message || 'Failed to send request.');
    } finally {
      setSendingReq(false);
    }
  };

  const handleRequest = async (requestId, action) => {
    try {
      await API.put(`/friends/request/${requestId}`, { action });
      load();
    } catch (e) { console.error(e); }
  };

  const removeFriend = async (userId) => {
    if (!window.confirm('Remove this friend?')) return;
    await API.delete(`/friends/${userId}`);
    load();
  };

  const sendReminder = async () => {
    if (!reminderTo) return;
    setSendingReminder(true);
    try {
      await API.post('/reminders', { to: reminderTo._id, message: reminderMsg });
      setReminderTo(null);
      setSuccess(`Reminder sent to ${reminderTo.name}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to send.');
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) return <div className="page" style={{ display:'flex', justifyContent:'center', paddingTop:'4rem' }}><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Friends</h2>
        <p>Your accountability circle</p>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Add friend */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>Add a friend</h3>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            className="form-input"
            type="email"
            placeholder="Enter their email address"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button className="btn btn-primary" onClick={search} disabled={searching} style={{ flexShrink: 0 }}>
            {searching ? '…' : 'Search'}
          </button>
        </div>

        {searchError && <div className="alert alert-error" style={{ marginTop: '0.75rem', marginBottom: 0 }}>{searchError}</div>}

        {searchResult && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="avatar avatar-lg">{initials(searchResult.user.name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{searchResult.user.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{searchResult.user.email}</div>
              <div className="streak" style={{ fontSize: '0.8rem', marginTop: '2px' }}>🔥 {searchResult.user.streak || 0} day streak</div>
            </div>
            {searchResult.isAlreadyFriend ? (
              <span className="badge badge-success">Already friends</span>
            ) : searchResult.hasPendingRequest ? (
              <span className="badge badge-accent">Request sent</span>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => sendRequest(searchResult.user._id)} disabled={sending}>
                {sending ? '…' : 'Add friend'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pending requests */}
      {requests.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Friend requests <span className="badge badge-accent" style={{ marginLeft: '0.5rem' }}>{requests.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {requests.map(req => (
              <div key={req._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)' }}>
                <div className="avatar">{initials(req.from?.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{req.from?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.from?.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleRequest(req._id, 'accept')}>Accept</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRequest(req._id, 'reject')}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          My friends ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h4>No friends yet</h4>
            <p>Search by email to add your first accountability partner</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {friends.map(f => (
              <div key={f._id} className="friend-card">
                <div className="avatar avatar-lg">{initials(f.name)}</div>
                <div className="friend-info">
                  <h4>{f.name}</h4>
                  <p>{f.email}</p>
                  <p style={{ marginTop: '2px' }}>Last active: {formatDate(f.lastCheckIn)}</p>
                </div>
                <span className="streak">🔥 {f.streak || 0}</span>
                <div className="friend-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setReminderTo(f); setReminderMsg("Hey! Don't forget to check in on your goals today 💪"); }}>
                    🔔 Remind
                  </button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeFriend(f._id)} title="Remove friend">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send reminder modal */}
      {reminderTo && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setReminderTo(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Send reminder to {reminderTo.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setReminderTo(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea className="form-textarea" value={reminderMsg} onChange={e => setReminderMsg(e.target.value)} rows={3} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {[
                "You've got this! 💪",
                "Don't break the streak! 🔥",
                "One small step today 🚶",
                "Your future self will thank you ✨"
              ].map(m => (
                <button key={m} className="mood-btn" style={{ fontSize: '0.75rem' }} onClick={() => setReminderMsg(m)}>{m}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setReminderTo(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={sendReminder} disabled={sendingReminder}>
                {sendingReminder ? 'Sending…' : 'Send reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
