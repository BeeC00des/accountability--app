import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiError } from '../lib/format';
import { Avatar, Dialog, Icon, Spinner, TextField } from './ui';

export const EXPERT_CATEGORIES = [
  { value: 'mentor', label: 'Mentor', icon: 'school', blurb: 'Someone a few steps ahead who guides your path.' },
  { value: 'therapist', label: 'Therapist', icon: 'psychology', blurb: 'Licensed support for stress, anxiety and what holds you back.' },
  { value: 'career_coach', label: 'Career coach', icon: 'work', blurb: 'A plan for your next role, promotion or business move.' }
];
const labelFor = value => EXPERT_CATEGORIES.find(item => item.value === value)?.label || value;
const fmtDay = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const fmtWhen = iso => new Date(iso).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Pick an expert for one category. */
function ChooseExpertDialog({ category, current, onClose, onChosen }) {
  const { notify } = useApp();
  const [experts, setExperts] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    API.get('/community/experts', { params: { category } })
      .then(response => setExperts(response.data.experts))
      .catch(loadError => setError(apiError(loadError, 'Could not load experts.')));
  }, [category]);

  const choose = async expert => {
    setBusy(expert._id);
    try {
      const response = await API.post('/community/connect', { expertId: expert._id, category });
      notify(response.data.message);
      onChosen();
      onClose();
    } catch (chooseError) {
      notify(apiError(chooseError, 'Could not choose this expert.'));
      setBusy('');
    }
  };

  return (
    <Dialog wide icon="person_search" title={`Choose your ${labelFor(category).toLowerCase()}`} description="They’ll see your goals and daily progress, and can add steps to help you get there." onClose={onClose}
      actions={<button type="button" className="btn btn-text state-layer" onClick={onClose}>Close</button>}>
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {!experts && !error && <Spinner label="Loading experts" />}
      {experts && !experts.length && <p className="body-medium text-variant">No {labelFor(category).toLowerCase()}s are available yet. We’re onboarding experts — check back soon.</p>}
      {experts && experts.length > 0 && (
        <ul className="expert-pick-list" role="list">
          {experts.map(expert => (
            <li key={expert._id} className="expert-pick">
              <Avatar name={expert.name} src={expert.avatar} />
              <span className="expert-pick-text">
                <strong className="title-small">{expert.name}</strong>
                {expert.title && <span className="body-small text-variant">{expert.title}</span>}
                {expert.bio && <span className="body-small expert-bio">{expert.bio}</span>}
              </span>
              {current?._id === expert._id
                ? <span className="tag"><Icon name="check" />Your {labelFor(category).toLowerCase()}</span>
                : <button type="button" className="btn btn-filled state-layer" onClick={() => choose(expert)} disabled={Boolean(busy)}>{busy === expert._id ? 'Choosing…' : 'Choose'}</button>}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** Pick one of the expert's free slots and book it. */
function BookDialog({ category, expert, onClose, onBooked }) {
  const { notify } = useApp();
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setSlots(null);
    API.get(`/community/experts/${expert._id}/slots`)
      .then(response => setSlots(response.data.slots))
      .catch(loadError => setError(apiError(loadError, 'Could not load available times.')));
  }, [expert._id]);
  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => {
    const groups = new Map();
    (slots || []).forEach(slot => {
      const key = new Date(slot.start).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(slot);
    });
    return [...groups.entries()];
  }, [slots]);

  const book = async () => {
    setBusy(true);
    try {
      const response = await API.post('/community/bookings', { expertId: expert._id, category, start: picked, note: note.trim() || undefined });
      notify(`Booked: ${fmtWhen(picked)}`);
      onBooked(response.data.booking);
      onClose();
    } catch (bookError) {
      notify(apiError(bookError, 'Could not book this session.'));
      setBusy(false);
      setPicked('');
      load();
    }
  };

  return (
    <Dialog wide icon="event_available" title={`Book a session with ${expert.name}`} description={`${expert.slotMinutes || 30}-minute video call. Times are shown in your time zone.`} onClose={onClose} busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-filled state-layer" onClick={book} disabled={!picked || busy}><Icon name="event_available" />{busy ? 'Booking…' : picked ? `Book ${fmtDay(picked)}, ${fmtTime(picked)}` : 'Pick a time'}</button>
      </>}>
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {!slots && !error && <Spinner label="Loading times" />}
      {slots && !slots.length && <p className="body-medium text-variant">{expert.name} has no open times in the next three weeks. Check back soon.</p>}
      {days.length > 0 && (
        <div className="slot-days" role="radiogroup" aria-label="Available times">
          {days.map(([key, items]) => (
            <div key={key} className="slot-day">
              <span className="label-large slot-day-label">{fmtDay(items[0].start)}</span>
              <div className="slot-times">
                {items.map(slot => (
                  <button key={slot.start} type="button" role="radio" aria-checked={picked === slot.start} className={`chip state-layer${picked === slot.start ? ' selected' : ''}`} onClick={() => setPicked(slot.start)}>{fmtTime(slot.start)}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {picked && <TextField as="textarea" rows={2} label="What would you like to cover? (optional)" value={note} onChange={event => setNote(event.target.value)} maxLength={500} />}
    </Dialog>
  );
}

/** Community home for members: your expert per category, booking, and upcoming sessions. */
export default function CommunityExperts() {
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'choose' | 'book', category, expert }

  const load = useCallback(() => {
    API.get('/community/my-experts')
      .then(response => setData(response.data))
      .catch(loadError => setError(apiError(loadError, 'Could not load your experts.')));
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async booking => {
    if (!window.confirm(`Cancel your session on ${fmtWhen(booking.start)}?`)) return;
    try {
      await API.post(`/community/bookings/${booking._id}/cancel`);
      notify('Session cancelled');
      load();
    } catch (cancelError) {
      notify(apiError(cancelError, 'Could not cancel this session.'));
    }
  };

  return (
    <section className="community-experts" aria-labelledby="experts-title">
      <div className="section-head">
        <h2 id="experts-title" className="title-large">Your experts</h2>
        {data?.premiumUntil && <span className="body-small text-variant">Member until {new Date(data.premiumUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
      </div>
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {!data && !error && <Spinner label="Loading your experts" />}
      {data && (
        <>
          <ul className="expert-grid" role="list">
            {EXPERT_CATEGORIES.map(category => {
              const expert = data.experts[category.value];
              return (
                <li key={category.value} className="card expert-card">
                  <span className="expert-card-cat label-medium"><Icon name={category.icon} />{category.label}</span>
                  {expert ? (
                    <>
                      <div className="expert-card-person">
                        <Avatar name={expert.name} src={expert.avatar} />
                        <span><strong className="title-small">{expert.name}</strong>{expert.title && <span className="body-small text-variant">{expert.title}</span>}</span>
                      </div>
                      <p className="body-small text-variant">Sees your goals and daily progress, and adds steps to your board.</p>
                      <div className="expert-card-actions">
                        <button type="button" className="btn btn-filled state-layer" onClick={() => setDialog({ type: 'book', category: category.value, expert })}><Icon name="event_available" />Book a session</button>
                        <button type="button" className="btn btn-text state-layer" onClick={() => setDialog({ type: 'choose', category: category.value, expert })}>Change</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="body-medium text-variant">{category.blurb}</p>
                      <div className="expert-card-actions">
                        <button type="button" className="btn btn-tonal state-layer" onClick={() => setDialog({ type: 'choose', category: category.value })}><Icon name="person_search" />Choose a {category.label.toLowerCase()}</button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="card list-card sessions-card">
            <h3 className="title-medium card-title">Upcoming sessions</h3>
            {!data.bookings.length ? (
              <p className="body-medium text-variant section-empty"><Icon name="event" />No sessions booked yet. Book one with any of your experts.</p>
            ) : (
              <ul className="list" role="list">
                {data.bookings.map(booking => (
                  <li key={booking._id} className="list-item session-item">
                    <Avatar name={booking.expert?.name} src={booking.expert?.avatar} size="sm" />
                    <span className="list-item-content">
                      <span className="list-item-headline">{fmtWhen(booking.start)}</span>
                      <span className="list-item-supporting">{booking.expert?.name} · {labelFor(booking.category)}{booking.note ? ` · “${booking.note}”` : ''}</span>
                    </span>
                    <span className="session-actions">
                      {booking.meetingLink && <a className="btn btn-filled btn-sm state-layer" href={booking.meetingLink} target="_blank" rel="noopener noreferrer"><Icon name="videocam" />Join</a>}
                      <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => cancel(booking)}>Cancel</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {dialog?.type === 'choose' && <ChooseExpertDialog category={dialog.category} current={dialog.expert} onClose={() => setDialog(null)} onChosen={load} />}
      {dialog?.type === 'book' && <BookDialog category={dialog.category} expert={dialog.expert} onClose={() => setDialog(null)} onBooked={load} />}
    </section>
  );
}
