import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, ConfirmDialog, Dialog, EmptyState, ErrorBanner, Icon, Spinner, TextField } from '../components/ui';
import { apiError, dayKey, formatDate, plural } from '../lib/format';

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' }
];
const TITLE_IDEAS = ['7-day consistency duel', 'Morning check-in race', 'Steps sprint', 'Healthy habits week'];
const REWARD_IDEAS = ['Loser cooks a healthy dinner', 'Winner picks the weekend walk', 'Loser buys the smoothies', 'Bragging rights only 😄'];
const DURATIONS = [3, 7, 14, 30];
const addDays = (key, days) => { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate() + days); return dayKey(date); };
const prettyKey = key => formatDate(new Date(`${key}T12:00:00`), { weekday: 'short', month: 'short', day: 'numeric' });

function ChallengeDialog({ friends, initialFriendId, onClose, onCreated }) {
  const { notify } = useApp();
  const today = dayKey(new Date());
  const [form, setForm] = useState({ opponentId: initialFriendId || friends[0]?._id || '', title: TITLE_IDEAS[0], metric: 'xp', days: 7, startDate: today, reward: REWARD_IDEAS[0], message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setError(''); };

  const submit = async event => {
    event.preventDefault();
    if (!form.opponentId) { setError('Choose a friend to challenge.'); return; }
    if (form.title.trim().length < 3) { setError('Give your challenge a name.'); return; }
    setBusy(true);
    try {
      const response = await API.post('/challenges', { ...form, title: form.title.trim(), reward: form.reward.trim(), message: form.message.trim() });
      notify('Challenge sent — they’ll get it in their inbox');
      onCreated(response.data.challenge);
      onClose();
    } catch (createError) {
      setError(apiError(createError, 'Could not send the challenge.'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      as="form"
      onSubmit={submit}
      wide
      icon="sports_score"
      title="Challenge a friend"
      description="Book a friendly, time-boxed challenge. Compete on consistency — not intensity."
      onClose={onClose}
      busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={busy}><Icon name="send" />{busy ? 'Sending…' : 'Send challenge'}</button>
      </>}
    >
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      <fieldset className="plain-fieldset">
        <legend className="fieldset-legend">Who</legend>
        <div className="friend-pick" role="radiogroup" aria-label="Friend">
          {friends.map(friend => (
            <button key={friend._id} type="button" role="radio" aria-checked={form.opponentId === friend._id} className={`friend-pick-option state-layer${form.opponentId === friend._id ? ' selected' : ''}`} onClick={() => set('opponentId', friend._id)}>
              <Avatar name={friend.name} src={friend.avatar} size="sm" />
              <span className="label-medium">{friend.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <TextField label="Challenge name" value={form.title} onChange={event => set('title', event.target.value)} maxLength={60} counter={`${form.title.length}/60`} />
      <div className="chip-set idea-chips">{TITLE_IDEAS.map(idea => <button key={idea} type="button" className={`chip state-layer${form.title === idea ? ' selected' : ''}`} onClick={() => set('title', idea)}>{idea}</button>)}</div>
      <div className="field-row">
        <TextField label="Start date" type="date" value={form.startDate} min={today} max={addDays(today, 30)} onChange={event => set('startDate', event.target.value)} help={`Ends ${prettyKey(addDays(form.startDate, form.days - 1))}`} />
        <fieldset className="plain-fieldset">
          <legend className="fieldset-legend">Length</legend>
          <div className="segmented segmented-block" role="radiogroup" aria-label="Length">
            {DURATIONS.map(days => <button key={days} type="button" role="radio" aria-checked={form.days === days} className="state-layer" onClick={() => set('days', days)}>{days}d</button>)}
          </div>
        </fieldset>
      </div>
      <fieldset className="plain-fieldset">
        <legend className="fieldset-legend">Win by</legend>
        <div className="segmented segmented-block" role="radiogroup" aria-label="Scoring">
          <button type="button" role="radio" aria-checked={form.metric === 'xp'} className="state-layer" onClick={() => set('metric', 'xp')}><Icon name="bolt" />Most XP</button>
          <button type="button" role="radio" aria-checked={form.metric === 'checkins'} className="state-layer" onClick={() => set('metric', 'checkins')}><Icon name="task_alt" />Most check-ins</button>
        </div>
        <p className="body-small text-variant fieldset-help">{form.metric === 'xp' ? 'Check-ins earn 10 XP, finished steps 5 XP.' : 'Every completed goal check-in counts as one.'}</p>
      </fieldset>
      <TextField label="Friendly reward (optional)" value={form.reward} onChange={event => set('reward', event.target.value)} maxLength={60} help="Keep it kind — no money on the line." />
      <div className="chip-set idea-chips">{REWARD_IDEAS.map(idea => <button key={idea} type="button" className={`chip state-layer${form.reward === idea ? ' selected' : ''}`} onClick={() => set('reward', idea)}>{idea}</button>)}</div>
      <TextField as="textarea" rows={2} label="Message (optional)" value={form.message} onChange={event => set('message', event.target.value)} maxLength={200} placeholder="Let’s push each other this week!" />
    </Dialog>
  );
}

function DuelBar({ challenge }) {
  const max = Math.max(1, challenge.myScore || 0, challenge.theirScore || 0);
  const unit = challenge.metric === 'xp' ? 'XP' : 'check-ins';
  return (
    <div className="duel">
      {[['You', challenge.me, challenge.myScore, true], [challenge.them.name.split(' ')[0], challenge.them, challenge.theirScore, false]].map(([label, person, score, mine]) => (
        <div key={label} className="duel-row">
          <Avatar name={person.name} src={person.avatar} size="sm" />
          <span className="duel-name label-medium">{label}</span>
          <span className="duel-track"><span className={`duel-fill${mine ? ' mine' : ''}`} style={{ width: `${((score || 0) / max) * 100}%` }} /></span>
          <span className="duel-score title-small">{score || 0} <span className="body-small text-variant">{unit}</span></span>
        </div>
      ))}
    </div>
  );
}

export default function Compete() {
  const { notify } = useApp();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'challenges' ? 'challenges' : 'leaderboard';
  const [range, setRange] = useState('week');
  const [board, setBoard] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compose, setCompose] = useState(null); // { friendId? }
  const [cancelling, setCancelling] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [lb, ch, fr] = await Promise.all([API.get('/leaderboard', { params: { range } }), API.get('/challenges'), API.get('/friends')]);
      setBoard(lb.data.leaderboard);
      setChallenges(ch.data.challenges);
      setFriends(fr.data.friends || []);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load competitions.'));
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => ({
    toAnswer: challenges.filter(c => c.phase === 'pending' && c.role === 'opponent'),
    live: challenges.filter(c => c.phase === 'live'),
    upcoming: challenges.filter(c => c.phase === 'upcoming' || (c.phase === 'pending' && c.role === 'challenger')),
    finished: challenges.filter(c => ['completed', 'declined', 'cancelled'].includes(c.phase)).slice(0, 10)
  }), [challenges]);

  const respond = async (challenge, action) => {
    setBusyId(challenge._id);
    try {
      const response = await API.put(`/challenges/${challenge._id}/respond`, { action });
      setChallenges(current => current.map(item => (item._id === challenge._id ? response.data.challenge : item)));
      notify(response.data.message);
    } catch (respondError) {
      notify(apiError(respondError, 'Could not update the challenge.'));
    } finally {
      setBusyId('');
    }
  };

  const cancel = async () => {
    try {
      await API.delete(`/challenges/${cancelling._id}`);
      setChallenges(current => current.map(item => (item._id === cancelling._id ? { ...item, phase: 'cancelled', status: 'cancelled' } : item)));
      notify('Challenge cancelled');
    } catch (cancelError) {
      notify(apiError(cancelError, 'Could not cancel.'));
    }
    setCancelling(null);
  };

  const podium = board.slice(0, 3);
  const challengeCard = challenge => (
    <li key={challenge._id} className={`card challenge-card phase-${challenge.phase}`}>
      <div className="challenge-head">
        <span className="challenge-icon" aria-hidden="true"><Icon name={challenge.phase === 'completed' ? (challenge.iWon ? 'emoji_events' : challenge.isTie ? 'handshake' : 'sentiment_satisfied') : 'sports_score'} filled /></span>
        <div className="list-item-content">
          <span className="title-small">{challenge.title}</span>
          <span className="body-small text-variant">
            vs {challenge.them.name} · {challenge.days} days · {challenge.metric === 'xp' ? 'most XP' : 'most check-ins'}
          </span>
        </div>
        <span className={`tag ${challenge.phase === 'live' ? 'tag-success' : challenge.phase === 'pending' ? 'tag-warning' : ''}`}>
          {challenge.phase === 'live' ? `${plural(challenge.daysLeft, 'day')} left`
            : challenge.phase === 'upcoming' ? `Starts ${prettyKey(challenge.startKey)}`
              : challenge.phase === 'pending' ? (challenge.role === 'opponent' ? 'Needs your answer' : 'Waiting for reply')
                : challenge.phase === 'completed' ? (challenge.isTie ? 'Tie' : challenge.iWon ? 'You won 🎉' : `${challenge.them.name.split(' ')[0]} won`)
                  : challenge.phase === 'declined' ? 'Declined' : 'Cancelled'}
        </span>
      </div>
      {challenge.reward && <p className="body-small challenge-reward"><Icon name="redeem" size="18" />{challenge.reward}</p>}
      {challenge.message && challenge.phase === 'pending' && <p className="body-medium text-variant challenge-message">“{challenge.message}”</p>}
      {['live', 'completed'].includes(challenge.phase) && challenge.myScore !== null && <DuelBar challenge={challenge} />}
      {challenge.phase === 'pending' && challenge.role === 'opponent' && (
        <div className="challenge-actions">
          <button type="button" className="btn btn-text state-layer" onClick={() => respond(challenge, 'decline')} disabled={busyId === challenge._id}>Not now</button>
          <button type="button" className="btn btn-filled state-layer" onClick={() => respond(challenge, 'accept')} disabled={busyId === challenge._id}><Icon name="check" />Accept</button>
        </div>
      )}
      {challenge.role === 'challenger' && (challenge.phase === 'pending' || challenge.phase === 'upcoming') && (
        <div className="challenge-actions"><button type="button" className="btn btn-text btn-danger state-layer" onClick={() => setCancelling(challenge)}>Cancel challenge</button></div>
      )}
    </li>
  );

  if (loading) return <Spinner label="Loading leaderboard" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Up for <span className="italic-accent">a challenge?</span></h1>
          <p className="body-large text-variant">Climb the leaderboard and book a friend for a healthy challenge.</p>
        </div>
        <button type="button" className="btn btn-filled state-layer" onClick={() => setCompose({})} disabled={!friends.length}><Icon name="sports_score" />Challenge a friend</button>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="tabs" role="tablist" aria-label="Challenge">
        {[['leaderboard', 'Leaderboard', 'leaderboard'], ['challenges', 'Challenges', 'sports_score']].map(([value, label, icon]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className="tab state-layer" onClick={() => setParams(value === 'leaderboard' ? {} : { tab: value }, { replace: true })}>
            <Icon name={icon} size="20" />{label}{value === 'challenges' && groups.toAnswer.length > 0 && <span className="badge">{groups.toAnswer.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' && (
        <section aria-label="Leaderboard">
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Time range">
              {RANGES.map(option => <button key={option.value} type="button" className="state-layer" aria-pressed={range === option.value} onClick={() => setRange(option.value)}>{option.label}</button>)}
            </div>
            <span className="body-small text-variant xp-legend"><Icon name="bolt" size="18" />Check-in +10 · Step +5 · Challenge win +25</span>
          </div>

          {board.length <= 1 && (
            <div className="card">
              <EmptyState icon="group_add" title="It’s lonely at the top" action={<Link to="/friends?tab=add" className="btn btn-filled state-layer"><Icon name="person_add" />Add friends</Link>}>
                Add friends to see how your consistency stacks up — and challenge them.
              </EmptyState>
            </div>
          )}

          {board.length > 1 && (
            <>
              <ol className="podium" role="list" aria-label="Top three" style={{ gridTemplateColumns: `repeat(${podium.length}, minmax(0, 1fr))`, maxWidth: podium.length < 3 ? `${podium.length * 220}px` : undefined, marginInline: 'auto' }}>
                {[podium[1], podium[0], podium[2]].filter(Boolean).map(person => (
                  <li key={person._id} className={`podium-spot rank-${person.rank}${person.isMe ? ' me' : ''}`}>
                    <Avatar name={person.name} src={person.avatar} size="lg" />
                    <span className="podium-medal" aria-label={`Rank ${person.rank}`}>{['🥇', '🥈', '🥉'][person.rank - 1] || person.rank}</span>
                    <span className="title-small podium-name">{person.isMe ? 'You' : person.name.split(' ')[0]}</span>
                    <span className="podium-xp"><strong>{person.xp}</strong> XP</span>
                    <span className="podium-block" aria-hidden="true" />
                  </li>
                ))}
              </ol>

              <div className="card list-card">
                <ol className="list leaderboard-list" role="list">
                  {board.map(person => (
                    <li key={person._id} className={`list-item leaderboard-row${person.isMe ? ' me' : ''}`}>
                      <span className="leaderboard-rank title-small">{person.rank}</span>
                      <Avatar name={person.name} src={person.avatar} />
                      <span className="list-item-content">
                        <span className="list-item-headline">{person.isMe ? `${person.name} (you)` : person.name}</span>
                        <span className="list-item-supporting">🔥 {plural(person.streak, 'day')} · {plural(person.checkins, 'check-in')} · {plural(person.activeDays, 'active day')}</span>
                      </span>
                      <span className="leaderboard-xp"><strong className="title-medium">{person.xp}</strong><span className="body-small text-variant">XP</span></span>
                      {!person.isMe && <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={() => setCompose({ friendId: person._id })}>Challenge</button>}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'challenges' && (
        <section aria-label="Challenges">
          <aside className="healthy-note">
            <Icon name="favorite" filled />
            <p className="body-medium"><strong>Keep it healthy.</strong> Compete on showing up, not on pushing harder. Rest days count as growth too — cheer each other on, win or lose.</p>
          </aside>
          {challenges.length === 0 ? (
            <div className="card">
              <EmptyState icon="sports_score" title="No challenges yet" action={friends.length ? <button type="button" className="btn btn-filled state-layer" onClick={() => setCompose({})}><Icon name="sports_score" />Challenge a friend</button> : <Link to="/friends?tab=add" className="btn btn-filled state-layer">Add a friend first</Link>}>
                Book a friend for a few days of friendly competition. Whoever shows up most, wins.
              </EmptyState>
            </div>
          ) : (
            [['Needs your answer', groups.toAnswer], ['Live now', groups.live], ['Booked & waiting', groups.upcoming], ['Finished', groups.finished]]
              .filter(([, list]) => list.length)
              .map(([label, list]) => (
                <div key={label}>
                  <h2 className="section-label">{label}</h2>
                  <ul className="challenge-list" role="list">{list.map(challengeCard)}</ul>
                </div>
              ))
          )}
        </section>
      )}

      {compose && friends.length > 0 && <ChallengeDialog friends={friends} initialFriendId={compose.friendId} onClose={() => setCompose(null)} onCreated={challenge => { setChallenges(current => [challenge, ...current]); setParams({ tab: 'challenges' }, { replace: true }); }} />}
      {cancelling && <ConfirmDialog title="Cancel this challenge?" confirmLabel="Cancel challenge" onClose={() => setCancelling(null)} onConfirm={cancel}>“{cancelling.title}” with {cancelling.them.name} will be called off.</ConfirmDialog>}
    </div>
  );
}
