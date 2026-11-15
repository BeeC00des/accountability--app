import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, ConfirmDialog, Dialog, EmptyState, ErrorBanner, Icon, LinearProgress, Menu, Spinner, TextField } from '../components/ui';
import NudgeDialog from '../components/NudgeDialog';
import { apiError, firstName, plural, relativeTime } from '../lib/format';
import { periodLabel, periodWord, tileClass } from '../lib/goals';

const TABS = [
  { value: 'circle', label: 'Circle', icon: 'groups' },
  { value: 'requests', label: 'Requests', icon: 'person_add' },
  { value: 'add', label: 'Add friend', icon: 'search' }
];
const NUDGE_LIMIT = 3;

/** A friend's profile: shared goals with progress, plus nudge / cheer actions. */
function FriendSheet({ friend, onClose, onCompose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/friends/${friend._id}/goals`)
      .then(response => setData(response.data))
      .catch(loadError => setError(apiError(loadError, 'Could not load shared goals.')));
  }, [friend._id]);

  const goals = data?.goals || [];
  return (
    <Dialog
      wide
      title={friend.name}
      description={`${plural(friend.streak || 0, 'day')} streak · last check-in ${relativeTime(friend.lastCheckIn).toLowerCase()}`}
      onClose={onClose}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-filled state-layer" onClick={() => onCompose('nudge', goals)} disabled={friend.nudgesSentToday >= NUDGE_LIMIT}><Icon name="notifications_active" />Nudge</button>
      </>}
    >
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {!data && !error && <Spinner label="Loading shared goals" />}
      {data && goals.length === 0 && (
        <EmptyState icon="visibility_off" title="No shared goals">{firstName(friend.name)} hasn’t shared any goals yet. You can still send a nudge.</EmptyState>
      )}
      {goals.length > 0 && (
        <ul className="friend-goal-list" role="list">
          {goals.map(goal => (
            <li key={goal._id} className="card card-tonal friend-goal">
              <div className="friend-goal-head">
                <span className={`tile ${tileClass(goal)}`} aria-hidden="true">{goal.emoji}</span>
                <div className="list-item-content">
                  <span className="title-small">{goal.title}</span>
                  <span className="body-small text-variant">
                    {goal.isCompleted ? 'Completed 🏆' : goal.checkedInThisPeriod ? `Checked in ${periodLabel(goal)}` : `Not checked in ${periodLabel(goal)}`}
                    {goal.streak > 0 && ` · 🔥 ${plural(goal.streak, periodWord(goal))}`}
                  </span>
                </div>
                <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => onCompose('cheer', goals, goal._id)}><Icon name="celebration" />Cheer</button>
              </div>
              <LinearProgress value={goal.completionRate} label={`${goal.title} consistency`} />
              <span className="body-small text-variant">{goal.completionRate}% consistency{goal.todoProgress.total > 0 && ` · ${goal.todoProgress.done}/${goal.todoProgress.total} steps`}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

export default function Friends() {
  const { notify } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(item => item.value === params.get('tab')) ? params.get('tab') : 'circle';
  const setTab = value => setParams(value === 'circle' ? {} : { tab: value }, { replace: true });

  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sent, setSent] = useState([]);
  const [friendCode, setFriendCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [result, setResult] = useState(null);

  const [sheetFriend, setSheetFriend] = useState(null);
  const [compose, setCompose] = useState(null); // { friend, mode, goals, goalId }
  const [confirmRemove, setConfirmRemove] = useState(null);

  const loadFriends = useCallback(() => API.get('/friends').then(response => setFriends(response.data.friends || [])), []);
  const loadRequests = useCallback(() => API.get('/friends/requests').then(response => {
    setRequests(response.data.requests || []);
    setSent(response.data.sent || []);
  }), []);

  const load = useCallback(async () => {
    setError('');
    try {
      const [, , codeResponse] = await Promise.all([loadFriends(), loadRequests(), API.get('/friends/code')]);
      setFriendCode(codeResponse.data.friendCode || '');
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your friends.'));
    } finally {
      setLoading(false);
    }
  }, [loadFriends, loadRequests]);
  useEffect(() => { load(); }, [load]);

  const search = async event => {
    event.preventDefault();
    const value = query.trim();
    if (!value) { setSearchError('Enter an email address or friend code.'); return; }
    setSearching(true);
    setSearchError('');
    setResult(null);
    try {
      const response = await API.post('/friends/search', { query: value });
      setResult(response.data);
    } catch (searchFailure) {
      setSearchError(apiError(searchFailure, 'Could not find that account.'));
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async user => {
    setBusyId(user._id);
    try {
      await API.post(`/friends/request/${user._id}`);
      setResult(current => ({ ...current, hasPendingRequest: true }));
      setSent(current => [{ _id: `pending-${user._id}`, to: user, createdAt: new Date().toISOString() }, ...current]);
      notify(`Request sent to ${firstName(user.name)}`);
    } catch (requestError) {
      setSearchError(apiError(requestError, 'Could not send the friend request.'));
    } finally {
      setBusyId('');
    }
  };

  const cancelRequest = async target => {
    setBusyId(target._id);
    try {
      await API.delete(`/friends/request/${target._id}`);
      setSent(current => current.filter(item => item.to._id !== target._id));
      if (result?.user._id === target._id) setResult(current => ({ ...current, hasPendingRequest: false }));
      notify('Request cancelled');
    } catch (cancelError) {
      notify(apiError(cancelError, 'Could not cancel the request.'));
    } finally {
      setBusyId('');
    }
  };

  const respond = async (requestId, action) => {
    setBusyId(requestId);
    try {
      const response = await API.put(`/friends/request/${requestId}`, { action });
      setRequests(current => current.filter(request => request._id !== requestId));
      if (result?.receivedRequestId === requestId) setResult(current => ({ ...current, receivedRequestId: null, isAlreadyFriend: action === 'accept' }));
      if (action === 'accept') await loadFriends();
      notify(response.data.message);
    } catch (respondError) {
      notify(apiError(respondError, 'Could not update the request.'));
    } finally {
      setBusyId('');
    }
  };

  const removeFriend = async () => {
    const friend = confirmRemove;
    setBusyId(friend._id);
    try {
      await API.delete(`/friends/${friend._id}`);
      setFriends(current => current.filter(item => item._id !== friend._id));
      notify(`${firstName(friend.name)} removed from your circle`);
      setConfirmRemove(null);
    } catch (removeError) {
      notify(apiError(removeError, 'Could not remove this friend.'));
    } finally {
      setBusyId('');
    }
  };

  const invite = `Join me on Accountable so we can keep each other on track. My friend code is ${friendCode}`;
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(friendCode);
      notify('Friend code copied');
    } catch {
      notify('Copy isn’t available here — select the code to copy it.');
    }
  };
  const shareInvite = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Join me on Accountable', text: invite });
      else { await navigator.clipboard.writeText(invite); notify('Invite copied — paste it anywhere'); }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') notify('Could not share the invite.');
    }
  };

  const openCompose = (friend, mode, goals = [], goalId = '') => { setSheetFriend(null); setCompose({ friend, mode, goals, goalId }); };
  const onSent = friendId => setFriends(current => current.map(friend => (friend._id === friendId ? { ...friend, nudgesSentToday: (friend.nudgesSentToday || 0) + 1 } : friend)));

  if (loading) return <Spinner label="Loading friends" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Friends</h1>
          <p className="body-large text-variant">Your accountability circle — nudge, cheer, and grow together.</p>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="tabs" role="tablist" aria-label="Friends sections">
        {TABS.map(item => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={tab === item.value}
            aria-controls={`panel-${item.value}`}
            className="tab state-layer"
            onClick={() => setTab(item.value)}
          >
            <Icon name={item.icon} size="20" />{item.label}
            {item.value === 'requests' && requests.length > 0 && <span className="badge">{requests.length}</span>}
          </button>
        ))}
      </div>

      <section className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'circle' && (friends.length === 0 ? (
          <div className="card card-outlined">
            <EmptyState icon="group_add" title="Your circle starts here" action={<button type="button" className="btn btn-filled state-layer" onClick={() => setTab('add')}><Icon name="person_add" />Add a friend</button>}>
              Add someone by email or friend code. You’ll be able to see shared goals and send each other nudges.
            </EmptyState>
          </div>
        ) : (
          <div className="card card-outlined list-card">
            <ul className="list" role="list">
              {friends.map((friend, index) => (
                <React.Fragment key={friend._id}>
                  {index > 0 && <li className="list-divider" role="separator" />}
                  <li className="list-item friend-row">
                    <button type="button" className="friend-row-main state-layer" onClick={() => setSheetFriend(friend)} aria-label={`View ${friend.name}’s shared goals`}>
                      <Avatar name={friend.name} src={friend.avatar} />
                      <span className="list-item-content">
                        <span className="list-item-headline">{friend.name}</span>
                        <span className="list-item-supporting friend-status">
                          {friend.checkedInToday
                            ? <span className="tag tag-success"><Icon name="check" />Checked in today</span>
                            : <span>Last check-in {relativeTime(friend.lastCheckIn).toLowerCase()}</span>}
                          <span className="streak-inline"><Icon name="local_fire_department" filled size="18" />{friend.streak || 0}</span>
                          {friend.sharedGoalCount > 0 && <span>{plural(friend.sharedGoalCount, 'shared goal')}</span>}
                        </span>
                      </span>
                    </button>
                    <div className="list-item-trailing">
                      {friend.checkedInToday
                        ? <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => openCompose(friend, 'cheer')} disabled={friend.nudgesSentToday >= NUDGE_LIMIT}><Icon name="celebration" />Cheer</button>
                        : <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={() => openCompose(friend, 'nudge')} disabled={friend.nudgesSentToday >= NUDGE_LIMIT} title={friend.nudgesSentToday >= NUDGE_LIMIT ? 'Daily limit reached' : undefined}>Nudge</button>}
                      <Menu
                        label={`More actions for ${friend.name}`}
                        items={[
                          { label: 'View shared goals', icon: 'visibility', onSelect: () => setSheetFriend(friend) },
                          { label: 'Send encouragement', icon: 'celebration', onSelect: () => openCompose(friend, 'cheer') },
                          { divider: true },
                          { label: 'Remove friend', icon: 'person_remove', danger: true, onSelect: () => setConfirmRemove(friend) }
                        ]}
                      />
                    </div>
                  </li>
                </React.Fragment>
              ))}
            </ul>
          </div>
        ))}

        {tab === 'requests' && (
          <>
            <h2 className="title-small section-label">Received</h2>
            {requests.length === 0 ? (
              <p className="body-medium text-variant section-empty"><Icon name="inbox" />No pending requests.</p>
            ) : (
              <div className="card card-outlined list-card">
                <ul className="list" role="list">
                  {requests.map(request => (
                    <li key={request._id} className="list-item">
                      <Avatar name={request.from?.name} />
                      <span className="list-item-content">
                        <span className="list-item-headline">{request.from?.name}</span>
                        <span className="list-item-supporting">{request.from?.email} · {relativeTime(request.createdAt)}</span>
                      </span>
                      <div className="list-item-trailing">
                        <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => respond(request._id, 'reject')} disabled={busyId === request._id}>Decline</button>
                        <button type="button" className="btn btn-filled btn-sm state-layer" onClick={() => respond(request._id, 'accept')} disabled={busyId === request._id}>Accept</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <h2 className="title-small section-label">Sent</h2>
            {sent.length === 0 ? (
              <p className="body-medium text-variant section-empty"><Icon name="outgoing_mail" />No requests waiting on a reply.</p>
            ) : (
              <div className="card card-outlined list-card">
                <ul className="list" role="list">
                  {sent.map(request => (
                    <li key={request._id} className="list-item">
                      <Avatar name={request.to.name} />
                      <span className="list-item-content">
                        <span className="list-item-headline">{request.to.name}</span>
                        <span className="list-item-supporting">Waiting · sent {relativeTime(request.createdAt).toLowerCase()}</span>
                      </span>
                      <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => cancelRequest(request.to)} disabled={busyId === request.to._id}>Cancel</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === 'add' && (
          <div className="add-friend-grid">
            <section className="card card-outlined" aria-labelledby="find-title">
              <h2 id="find-title" className="title-medium card-title">Find a friend</h2>
              <form onSubmit={search} className="search-form">
                <TextField
                  label="Email or friend code"
                  value={query}
                  onChange={event => { setQuery(event.target.value); setSearchError(''); }}
                  placeholder="name@example.com or AC-1A2B3C4D"
                  autoComplete="off"
                  maxLength={254}
                  error={searchError}
                  help="Exact email address or their AC- code."
                />
                <button type="submit" className="btn btn-filled state-layer" disabled={searching}><Icon name="search" />{searching ? 'Searching…' : 'Search'}</button>
              </form>
              {result && (
                <div className="search-result card card-tonal">
                  <Avatar name={result.user.name} src={result.user.avatar} size="lg" />
                  <div className="list-item-content">
                    <span className="title-medium">{result.user.name}</span>
                    <span className="body-medium text-variant">{result.user.email}</span>
                  </div>
                  {result.isAlreadyFriend ? <span className="tag tag-success"><Icon name="check" />Friends</span>
                    : result.receivedRequestId ? <button type="button" className="btn btn-filled state-layer" onClick={() => respond(result.receivedRequestId, 'accept')} disabled={busyId === result.receivedRequestId}>Accept request</button>
                      : result.hasPendingRequest ? <button type="button" className="btn btn-outlined state-layer" onClick={() => cancelRequest(result.user)} disabled={busyId === result.user._id}>Cancel request</button>
                        : <button type="button" className="btn btn-filled state-layer" onClick={() => sendRequest(result.user)} disabled={busyId === result.user._id}><Icon name="person_add" />{busyId === result.user._id ? 'Sending…' : 'Add friend'}</button>}
                </div>
              )}
            </section>

            <section className="card card-filled invite-card" aria-labelledby="invite-title">
              <Icon name="qr_code_2" className="invite-icon" />
              <h2 id="invite-title" className="title-medium">Invite with your code</h2>
              <p className="body-medium text-variant">Friends can enter this code to send you a request.</p>
              <div className="code-display">
                <span className="title-large code-value" aria-label={`Your friend code ${friendCode.split('').join(' ')}`}>{friendCode || '…'}</span>
                <button type="button" className="icon-btn state-layer" onClick={copyCode} disabled={!friendCode} aria-label="Copy friend code"><Icon name="content_copy" /></button>
              </div>
              <button type="button" className="btn btn-tonal state-layer" onClick={shareInvite} disabled={!friendCode}><Icon name="share" />Share invite</button>
            </section>
          </div>
        )}
      </section>

      {sheetFriend && <FriendSheet friend={sheetFriend} onClose={() => setSheetFriend(null)} onCompose={(mode, goals, goalId) => openCompose(sheetFriend, mode, goals, goalId)} />}
      {compose && <NudgeDialog friend={compose.friend} mode={compose.mode} goals={compose.goals} initialGoalId={compose.goalId} onClose={() => setCompose(null)} onSent={() => onSent(compose.friend._id)} />}
      {confirmRemove && (
        <ConfirmDialog title={`Remove ${firstName(confirmRemove.name)}?`} confirmLabel="Remove" onClose={() => setConfirmRemove(null)} onConfirm={removeFriend} busy={busyId === confirmRemove._id}>
          You’ll stop seeing each other’s shared goals and won’t be able to send reminders. You can add them again later.
        </ConfirmDialog>
      )}
    </div>
  );
}
