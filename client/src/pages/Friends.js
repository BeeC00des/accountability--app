import React, { useEffect, useState } from 'react';
import { API } from '../context/AuthContext';

const initials = name => name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';
const formatDate = dateValue => {
  if (!dateValue) return 'Never';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const DEFAULT_REMINDER = "Hey! Don't forget to check in on your goals today 💪";

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friendCode, setFriendCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState('');
  const [searchError, setSearchError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reminderTo, setReminderTo] = useState(null);
  const [reminderMsg, setReminderMsg] = useState(DEFAULT_REMINDER);
  const [sendingReminder, setSendingReminder] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [friendsResponse, requestsResponse, codeResponse] = await Promise.all([
        API.get('/friends'),
        API.get('/friends/requests'),
        API.get('/friends/code')
      ]);
      setFriends(friendsResponse.data.friends || []);
      setRequests(requestsResponse.data.requests || []);
      setFriendCode(codeResponse.data.friendCode || '');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Could not load your friends. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const search = async event => {
    event?.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Enter an email address or friend code.');
      return;
    }
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const response = await API.post('/friends/search', { query });
      setSearchResult(response.data);
    } catch (searchFailure) {
      setSearchError(searchFailure.response?.data?.message || 'Could not find that account. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async userId => {
    setActionId(userId);
    setSearchError('');
    try {
      await API.post(`/friends/request/${userId}`);
      setSearchResult(result => ({ ...result, hasPendingRequest: true }));
      setSuccess('Friend request sent!');
    } catch (requestError) {
      setSearchError(requestError.response?.data?.message || 'Could not send the friend request.');
    } finally {
      setActionId('');
    }
  };

  const respondToRequest = async (requestId, action) => {
    setActionId(requestId);
    setError('');
    try {
      await API.put(`/friends/request/${requestId}`, { action });
      setRequests(current => current.filter(request => request._id !== requestId));
      setSuccess(action === 'accept' ? 'You are now friends!' : 'Friend request declined.');
      if (searchResult?.receivedRequestId === requestId) {
        setSearchResult(result => ({ ...result, receivedRequestId: null, isAlreadyFriend: action === 'accept' }));
      }
      if (action === 'accept') {
        const response = await API.get('/friends');
        setFriends(response.data.friends || []);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update the friend request.');
    } finally {
      setActionId('');
    }
  };

  const removeFriend = async userId => {
    if (!window.confirm('Remove this friend?')) return;
    setActionId(userId);
    try {
      await API.delete(`/friends/${userId}`);
      setFriends(current => current.filter(friend => friend._id !== userId));
      setSuccess('Friend removed.');
    } catch (removeError) {
      setError(removeError.response?.data?.message || 'Could not remove friend.');
    } finally {
      setActionId('');
    }
  };

  const shareFriendCode = async () => {
    const message = `Add me on Accountable! Use my friend code: ${friendCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Add me on Accountable', text: message });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setSuccess('Invite copied. Share it with your friend!');
      } else {
        window.prompt('Copy and share this invite:', message);
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setError('Could not share the invite. You can copy the code manually.');
    }
  };

  const sendReminder = async () => {
    if (!reminderTo) return;
    setSendingReminder(true);
    try {
      await API.post('/reminders', { to: reminderTo._id, message: reminderMsg.trim() });
      setReminderTo(null);
      setSuccess(`Reminder sent to ${reminderTo.name}!`);
    } catch (reminderError) {
      setError(reminderError.response?.data?.message || 'Could not send the reminder.');
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) return <div className="page loading-state"><div className="spinner" role="status" aria-label="Loading friends" /></div>;

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div><h2>Friends</h2><p>Build your accountability circle</p></div>
      </header>
      {success && <div className="alert alert-success" role="status">{success}</div>}
      {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="inline-link" onClick={load}>Try again</button></div>}

      <section className="card friends-invite-card" aria-labelledby="invite-heading">
        <div className="friends-section-heading">
          <div><h3 id="invite-heading">Add an accountability partner</h3><p>Find friends by email or share your code anywhere.</p></div>
          <span className="friends-heading-icon" aria-hidden="true">👥</span>
        </div>
        <form className="friend-search-form" onSubmit={search}>
          <label className="form-label" htmlFor="friend-search">Email address or friend code</label>
          <div className="friend-search-controls">
            <input
              id="friend-search"
              className="form-input"
              type="text"
              autoComplete="off"
              maxLength={254}
              placeholder="name@example.com or AC-1A2B3C4D"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={searching}>{searching ? 'Searching…' : 'Find friend'}</button>
          </div>
        </form>
        {searchError && <div className="alert alert-error friends-inline-error" role="alert">{searchError}</div>}

        {searchResult && (
          <div className="friend-search-result">
            <div className="avatar avatar-lg" aria-hidden="true">{initials(searchResult.user.name)}</div>
            <div className="friend-result-info">
              <strong>{searchResult.user.name}</strong>
              <span>{searchResult.user.email}</span>
              {searchResult.user.friendCode && <small>Friend code: {searchResult.user.friendCode}</small>}
            </div>
            {searchResult.isAlreadyFriend ? <span className="badge badge-success">Already friends</span> :
              searchResult.receivedRequestId ? <button className="btn btn-primary btn-sm" onClick={() => respondToRequest(searchResult.receivedRequestId, 'accept')} disabled={actionId === searchResult.receivedRequestId}>Accept request</button> :
              searchResult.hasPendingRequest ? <span className="badge badge-accent">Request sent</span> :
              <button className="btn btn-primary btn-sm" onClick={() => sendRequest(searchResult.user._id)} disabled={actionId === searchResult.user._id}>{actionId === searchResult.user._id ? 'Sending…' : 'Add friend'}</button>}
          </div>
        )}

        <div className="share-code-panel">
          <div><span className="share-code-label">Your friend code</span><strong className="share-code-value">{friendCode || 'Loading code…'}</strong></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={shareFriendCode} disabled={!friendCode}>Share invite</button>
        </div>
        <p className="field-help">Your friend can enter this code here. Use Share to send it in a message or social app.</p>
      </section>

      {requests.length > 0 && (
        <section className="friends-section" aria-labelledby="requests-heading">
          <h3 className="friends-section-title" id="requests-heading">Friend requests <span className="badge badge-accent">{requests.length}</span></h3>
          <div className="friends-list">
            {requests.map(request => (
              <article className="friend-card" key={request._id}>
                <div className="avatar" aria-hidden="true">{initials(request.from?.name)}</div>
                <div className="friend-info"><h4>{request.from?.name || 'Accountable user'}</h4><p>{request.from?.email}</p></div>
                <div className="friend-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => respondToRequest(request._id, 'accept')} disabled={actionId === request._id}>{actionId === request._id ? 'Please wait…' : 'Accept'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => respondToRequest(request._id, 'reject')} disabled={actionId === request._id}>Decline</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="friends-section" aria-labelledby="friends-heading">
        <h3 className="friends-section-title" id="friends-heading">My friends <span className="badge badge-accent">{friends.length}</span></h3>
        {friends.length === 0 ? (
          <div className="empty-state card"><div className="empty-icon" aria-hidden="true">🤝</div><h3>Your circle starts here</h3><p>Search by email or share your friend code to connect with someone.</p></div>
        ) : (
          <div className="friends-list">
            {friends.map(friend => (
              <article key={friend._id} className="friend-card">
                <div className="avatar avatar-lg" aria-hidden="true">{initials(friend.name)}</div>
                <div className="friend-info"><h4>{friend.name}</h4><p>{friend.email}</p><p className="friend-last-active">Last active: {formatDate(friend.lastCheckIn)}</p></div>
                <span className="streak" aria-label={`${friend.streak || 0} day streak`}>🔥 {friend.streak || 0}</span>
                <div className="friend-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setReminderTo(friend); setReminderMsg(DEFAULT_REMINDER); }}>Remind</button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeFriend(friend._id)} disabled={actionId === friend._id} aria-label={`Remove ${friend.name} from friends`}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {reminderTo && (
        <div className="modal-backdrop" onClick={event => event.target === event.currentTarget && setReminderTo(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="send-reminder-title">
            <div className="modal-header"><h3 id="send-reminder-title">Send a reminder to {reminderTo.name}</h3><button type="button" className="btn btn-ghost btn-icon" onClick={() => setReminderTo(null)} aria-label="Close">✕</button></div>
            <div className="form-group"><label className="form-label" htmlFor="reminder-message">Message</label><textarea id="reminder-message" className="form-textarea" maxLength={300} value={reminderMsg} onChange={event => setReminderMsg(event.target.value)} rows={3} /></div>
            <div className="reminder-suggestions">
              {["You've got this! 💪", "Don't break the streak! 🔥", 'One small step today 🚶', 'Your future self will thank you ✨'].map(message => <button type="button" key={message} className="mood-btn" onClick={() => setReminderMsg(message)}>{message}</button>)}
            </div>
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setReminderTo(null)}>Cancel</button><button className="btn btn-primary" onClick={sendReminder} disabled={sendingReminder || !reminderMsg.trim()}>{sendingReminder ? 'Sending…' : 'Send reminder'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
