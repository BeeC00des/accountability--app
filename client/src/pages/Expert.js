import React, { useCallback, useEffect, useState } from 'react';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiError, relativeTime } from '../lib/format';
import { Avatar, ErrorBanner, Icon, LinearProgress, Spinner, TextField } from '../components/ui';

const CATEGORY = { mentor: 'Mentor', therapist: 'Therapist', career_coach: 'Career coach' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtWhen = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One member: 14-day activity, goals with steps, add a step, draft a new goal. */
function MemberPanel({ memberId, onBack }) {
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [goalForm, setGoalForm] = useState({ title: '', frequency: 'daily', targetDays: 30, steps: '' });

  const load = useCallback(() => {
    API.get(`/community/expert/members/${memberId}`)
      .then(response => setData(response.data))
      .catch(loadError => setError(apiError(loadError, 'Could not load this member.')));
  }, [memberId]);
  useEffect(() => { load(); }, [load]);

  const addStep = async goal => {
    const title = (drafts[goal._id] || '').trim();
    if (title.length < 2) return;
    setBusy(goal._id);
    try {
      await API.post(`/community/expert/members/${memberId}/goals/${goal._id}/steps`, { title });
      setDrafts(current => ({ ...current, [goal._id]: '' }));
      notify('Step added to their board');
      load();
    } catch (stepError) {
      notify(apiError(stepError, 'Could not add this step.'));
    } finally {
      setBusy('');
    }
  };

  const addGoal = async event => {
    event.preventDefault();
    if (goalForm.title.trim().length < 2) { notify('Name the goal first.'); return; }
    setBusy('goal');
    try {
      await API.post(`/community/expert/members/${memberId}/goals`, {
        title: goalForm.title.trim(),
        frequency: goalForm.frequency,
        targetDays: Number(goalForm.targetDays) || 30,
        steps: goalForm.steps.split('\n').map(line => line.trim()).filter(Boolean)
      });
      setGoalForm({ title: '', frequency: 'daily', targetDays: 30, steps: '' });
      notify('Goal added to their board');
      load();
    } catch (goalError) {
      notify(apiError(goalError, 'Could not add this goal.'));
    } finally {
      setBusy('');
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading member" />;
  const { member, goals, days } = data;
  const maxDay = Math.max(1, ...days.map(day => day.checkins + day.steps));

  return (
    <div className="expert-member">
      <button type="button" className="btn btn-text state-layer expert-back" onClick={onBack}><Icon name="arrow_back" />All members</button>
      <section className="card expert-member-head">
        <Avatar name={member.name} src={member.avatar} size="lg" />
        <div>
          <h2 className="title-large">{member.name}</h2>
          <p className="body-small text-variant">{CATEGORY[member.category]} · 🔥 {member.streak || 0}-day streak · Last check-in {relativeTime(member.lastCheckIn).toLowerCase()}</p>
        </div>
      </section>

      <section className="card" aria-labelledby="growth-title">
        <h3 id="growth-title" className="title-medium card-title">Daily growth · last 14 days</h3>
        <ol className="growth-strip" role="list">
          {days.map(day => {
            const total = day.checkins + day.steps;
            return (
              <li key={day.date} title={`${day.date}: ${day.checkins} check-ins, ${day.steps} steps`}>
                <span className="growth-bar" style={{ height: `${total ? Math.max(12, (total / maxDay) * 100) : 4}%` }} data-empty={!total || undefined} />
                <span className="label-small">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </li>
            );
          })}
        </ol>
        <p className="body-small text-variant">{days.filter(day => day.checkins + day.steps > 0).length} of 14 days active · {days.reduce((sum, day) => sum + day.checkins, 0)} check-ins · {days.reduce((sum, day) => sum + day.steps, 0)} steps done</p>
      </section>

      <section aria-labelledby="mgoals-title">
        <h3 id="mgoals-title" className="section-label">Their goals</h3>
        {!goals.length && <p className="body-medium text-variant">No goals yet — draft the first one below.</p>}
        <ul className="expert-goals" role="list">
          {goals.map(goal => (
            <li key={goal._id} className="card expert-goal">
              <div className="expert-goal-head">
                <span className="expert-goal-emoji" aria-hidden="true">{goal.emoji || '🎯'}</span>
                <span className="expert-goal-title">
                  <strong className="title-small">{goal.title}</strong>
                  <span className="body-small text-variant">{goal.frequency === 'weekly' ? 'Weekly' : 'Daily'} · {goal.completedCheckIns}/{goal.target} check-ins · {goal.checkedInThisPeriod ? 'checked in ✓' : 'not checked in yet'}</span>
                </span>
              </div>
              <LinearProgress value={goal.target ? Math.min(100, (goal.completedCheckIns / goal.target) * 100) : 0} label={`${goal.title} progress`} />
              {goal.todos.length > 0 && (
                <ul className="expert-steps" role="list">
                  {goal.todos.map(todo => (
                    <li key={todo._id} className={todo.done ? 'done' : ''}>
                      <Icon name={todo.done ? 'check_circle' : 'radio_button_unchecked'} size="18" />
                      <span>{todo.title}</span>
                      {todo.addedByName && <span className="step-by">by {todo.addedByName}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <form className="expert-add-step" onSubmit={event => { event.preventDefault(); addStep(goal); }}>
                <label className="visually-hidden" htmlFor={`exp-step-${goal._id}`}>Add a step to {goal.title}</label>
                <input id={`exp-step-${goal._id}`} className="field-control" placeholder="Add a step to this goal…" value={drafts[goal._id] || ''} onChange={event => setDrafts(current => ({ ...current, [goal._id]: event.target.value }))} maxLength={200} />
                <button type="submit" className="btn btn-tonal state-layer" disabled={busy === goal._id || (drafts[goal._id] || '').trim().length < 2}><Icon name="add" />Add</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <form className="card expert-new-goal" onSubmit={addGoal}>
        <h3 className="title-medium card-title">Draft a new goal for {member.name.split(' ')[0]}</h3>
        <TextField label="Goal" value={goalForm.title} onChange={event => setGoalForm(current => ({ ...current, title: event.target.value }))} maxLength={100} placeholder="e.g. Land a product design role by June" />
        <div className="field-row">
          <TextField as="select" label="Check-in rhythm" value={goalForm.frequency} onChange={event => setGoalForm(current => ({ ...current, frequency: event.target.value }))}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </TextField>
          <TextField label="Timeframe (days)" type="number" min="7" max="3650" value={goalForm.targetDays} onChange={event => setGoalForm(current => ({ ...current, targetDays: event.target.value }))} />
        </div>
        <TextField as="textarea" rows={4} label="Steps to get there (one per line)" value={goalForm.steps} onChange={event => setGoalForm(current => ({ ...current, steps: event.target.value }))} placeholder={'Update CV\nApply to 3 roles a week\nPractise one interview each Friday'} />
        <div className="form-actions"><button type="submit" className="btn btn-filled state-layer" disabled={busy === 'goal'}><Icon name="flag" />{busy === 'goal' ? 'Adding…' : 'Add to their board'}</button></div>
      </form>
    </div>
  );
}

/** Title, bio, call link, session length and weekly availability. */
function ProfileEditor({ profile, onSaved }) {
  const { notify } = useApp();
  const [form, setForm] = useState({ title: profile.title, bio: profile.bio, meetingLink: profile.meetingLink, slotMinutes: profile.slotMinutes, availability: profile.availability });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const setWindow = (index, key, value) => set('availability', form.availability.map((item, i) => (i === index ? { ...item, [key]: key === 'day' ? Number(value) : value } : item)));

  const save = async event => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await API.put('/community/expert/profile', { ...form, slotMinutes: Number(form.slotMinutes) });
      notify(response.data.message);
      onSaved(response.data.profile);
    } catch (saveError) {
      notify(apiError(saveError, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card expert-profile" onSubmit={save}>
      <h2 className="title-medium card-title">Your expert profile</h2>
      <p className="body-small text-variant">Categories: {profile.categories.map(c => CATEGORY[c]).join(', ') || '—'} · Times use your time zone ({profile.timezone}).</p>
      <TextField label="Title" value={form.title} onChange={event => set('title', event.target.value)} maxLength={80} placeholder="e.g. Licensed therapist · 8 years" />
      <TextField as="textarea" rows={3} label="Short bio members see" value={form.bio} onChange={event => set('bio', event.target.value)} maxLength={600} />
      <div className="field-row">
        <TextField label="Video-call link" type="url" value={form.meetingLink} onChange={event => set('meetingLink', event.target.value)} placeholder="https://meet.google.com/…" help="Shared with members who book you." />
        <TextField as="select" label="Session length" value={form.slotMinutes} onChange={event => set('slotMinutes', event.target.value)}>
          <option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option>
        </TextField>
      </div>
      <fieldset className="plain-fieldset">
        <legend className="fieldset-legend">Weekly availability</legend>
        {!form.availability.length && <p className="body-small text-variant">Add the times members can book you.</p>}
        <ul className="availability-list" role="list">
          {form.availability.map((item, index) => (
            <li key={index} className="availability-row">
              <select className="field-control" value={item.day} onChange={event => setWindow(index, 'day', event.target.value)} aria-label="Day">{DAYS.map((day, d) => <option key={day} value={d}>{day}</option>)}</select>
              <input className="field-control" type="time" value={item.start} onChange={event => setWindow(index, 'start', event.target.value)} aria-label="From" />
              <span aria-hidden="true">–</span>
              <input className="field-control" type="time" value={item.end} onChange={event => setWindow(index, 'end', event.target.value)} aria-label="To" />
              <button type="button" className="icon-btn state-layer" onClick={() => set('availability', form.availability.filter((_, i) => i !== index))} aria-label="Remove this time"><Icon name="delete" /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-text state-layer" onClick={() => set('availability', [...form.availability, { day: 1, start: '09:00', end: '12:00' }])}><Icon name="add" />Add a time window</button>
      </fieldset>
      <div className="form-actions"><button type="submit" className="btn btn-filled state-layer" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  );
}

export default function Expert() {
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [memberId, setMemberId] = useState(null);
  const [tab, setTab] = useState('members');

  const load = useCallback(() => {
    API.get('/community/expert/me').then(response => setData(response.data)).catch(loadError => setError(apiError(loadError, 'Could not load your dashboard.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async booking => {
    if (!window.confirm(`Cancel the session with ${booking.member?.name} on ${fmtWhen(booking.start)}?`)) return;
    try { await API.post(`/community/bookings/${booking._id}/cancel`); notify('Session cancelled'); load(); } catch (cancelError) { notify(apiError(cancelError, 'Could not cancel.')); }
  };

  if (error) return <div className="page"><ErrorBanner message={error} onRetry={load} /></div>;
  if (!data) return <Spinner label="Loading your dashboard" />;

  return (
    <div className="page expert-page">
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Expert <span className="italic-accent">dashboard.</span></h1>
          <p className="body-large text-variant">Follow your members’ daily growth and shape the steps to their goals.</p>
        </div>
      </header>
      {memberId ? <MemberPanel memberId={memberId} onBack={() => { setMemberId(null); load(); }} /> : (
        <>
          <div className="tabs" role="tablist" aria-label="Expert dashboard">
            {[['members', `Members (${data.members.length})`], ['sessions', `Sessions (${data.bookings.length})`], ['profile', 'Profile & availability']].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} className="tab state-layer" onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>
          {tab === 'members' && (
            !data.members.length
              ? <div className="card"><p className="body-medium text-variant section-empty"><Icon name="group" />No members yet. When a member chooses you, they’ll appear here.</p></div>
              : <ul className="expert-member-list" role="list">
                {data.members.map(({ member, category, since }) => (
                  <li key={`${member._id}-${category}`}>
                    <button type="button" className="card expert-member-row state-layer" onClick={() => setMemberId(member._id)} disabled={!member.active}>
                      <Avatar name={member.name} src={member.avatar} />
                      <span className="list-item-content">
                        <span className="list-item-headline">{member.name}</span>
                        <span className="list-item-supporting">{CATEGORY[category]} · 🔥 {member.streak || 0} · last check-in {relativeTime(member.lastCheckIn).toLowerCase()} · since {new Date(since).toLocaleDateString()}</span>
                      </span>
                      {member.active ? <Icon name="chevron_right" /> : <span className="tag">Membership ended</span>}
                    </button>
                  </li>
                ))}
              </ul>
          )}
          {tab === 'sessions' && (
            <div className="card list-card">
              {!data.bookings.length ? <p className="body-medium text-variant section-empty"><Icon name="event" />No upcoming sessions.</p> : (
                <ul className="list" role="list">
                  {data.bookings.map(booking => (
                    <li key={booking._id} className="list-item session-item">
                      <Avatar name={booking.member?.name} src={booking.member?.avatar} size="sm" />
                      <span className="list-item-content">
                        <span className="list-item-headline">{fmtWhen(booking.start)}</span>
                        <span className="list-item-supporting">{booking.member?.name} · {CATEGORY[booking.category]}{booking.note ? ` · “${booking.note}”` : ''}</span>
                      </span>
                      <span className="session-actions">
                        {data.profile.meetingLink && <a className="btn btn-filled btn-sm state-layer" href={data.profile.meetingLink} target="_blank" rel="noopener noreferrer"><Icon name="videocam" />Join</a>}
                        <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => cancel(booking)}>Cancel</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {tab === 'profile' && <ProfileEditor profile={data.profile} onSaved={profile => setData(current => ({ ...current, profile }))} />}
        </>
      )}
    </div>
  );
}
