import React, { useCallback, useEffect, useState } from 'react';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiError, plural } from '../lib/format';
import { Dialog, Icon, LinearProgress, Spinner } from './ui';

/** Split-flap style number: each digit sits on its own tile and flips when it changes. */
export function FlipNumber({ value, minDigits = 1, className = '' }) {
  const digits = String(value).padStart(minDigits, '0').split('');
  return (
    <span className={`flip-number ${className}`} aria-hidden="true">
      {digits.map((digit, index) => (
        // Keying by position + digit remounts a tile only when its digit changes, which replays the flip.
        <span key={`${digits.length - index}-${digit}`} className="flip-digit"><span>{digit}</span></span>
      ))}
    </span>
  );
}

/** Year counter card: "245 / 365 days you showed up in 2026". */
function YearCard({ card, flipping, current }) {
  const percent = Math.round((card.activeDays / card.daysInYear) * 100);
  return (
    <div className={`year-card${flipping ? ` flip-${flipping}` : ''}`}>
      <span className="year-card-year">{card.year}</span>
      <p className="year-card-count" aria-label={`${card.activeDays} of ${card.daysInYear} days in ${card.year}`}>
        <FlipNumber value={card.activeDays} />
        <span className="year-card-of">/{card.daysInYear}</span>
      </p>
      <p className="body-small year-card-label">{current ? `days you’ve shown up in ${card.year}` : `days you showed up in ${card.year}`}</p>
      <LinearProgress value={percent} label={`${percent}% of ${card.year}`} />
    </div>
  );
}

/**
 * Duolingo-style streak: flame + day count, this week's flames, the next milestone,
 * and a year counter (X/365) that you flip over when a new year starts.
 */
export default function StreakDialog({ onClose }) {
  const { updateUser } = useAuth();
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [flipping, setFlipping] = useState(''); // '' | 'out' | 'in'

  const load = useCallback(async () => {
    try {
      const response = await API.get('/streaks');
      setData(response.data);
      updateUser({ streak: response.data.streak, streakToday: response.data.streakToday });
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your streak.'));
    }
  }, [updateUser]);
  useEffect(() => { load(); }, [load]);

  const flip = async () => {
    setFlipping('out');
    try {
      const [response] = await Promise.all([API.post('/streaks/flip'), new Promise(resolve => setTimeout(resolve, 450))]);
      setData(response.data);
      setFlipping('in');
      setTimeout(() => setFlipping(''), 500);
      notify(response.data.message);
    } catch (flipError) {
      setFlipping('');
      notify(apiError(flipError, 'Could not flip your counter.'));
    }
  };

  const lit = data?.streakToday;
  const milestoneFrom = data ? [0, 3, 7, 14, 30, 50, 100, 150, 200, 250, 365, 500, 730, 1000].filter(value => value <= data.streak).pop() || 0 : 0;
  const milestonePercent = data ? Math.round(((data.streak - milestoneFrom) / Math.max(1, data.nextMilestone - milestoneFrom)) * 100) : 0;

  return (
    <Dialog icon="local_fire_department" title="Your streak" onClose={onClose} actions={<button type="button" className="btn btn-filled state-layer" onClick={onClose} data-autofocus>Keep going</button>}>
      {!data && !error && <Spinner label="Loading your streak" />}
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      {data && (
        <div className="streak-view">
          <div className={`streak-hero${lit ? ' lit' : ''}`}>
            <span className="streak-flame" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
            <div>
              <p className="streak-count"><FlipNumber value={data.streak} /><span className="visually-hidden">{data.streak}</span></p>
              <p className="title-medium">day streak</p>
              <p className="body-small text-variant">{lit ? 'You’ve extended your streak today. 🎉' : data.streak ? 'Check in or finish a step today to keep it alive.' : 'Check in or finish a step today to start a streak.'}</p>
            </div>
          </div>

          <ol className="streak-week" role="list" aria-label="This week">
            {data.week.map(day => (
              <li key={day.key} className={`streak-day${day.active ? ' active' : ''}${day.today ? ' today' : ''}${day.future ? ' future' : ''}`} aria-label={`${day.key}: ${day.active ? 'active' : day.future ? 'upcoming' : 'missed'}`}>
                <span className="label-small">{day.label}</span>
                <span className="streak-dot" aria-hidden="true">{day.active ? <Icon name="local_fire_department" filled /> : day.future ? '' : <Icon name="close" />}</span>
              </li>
            ))}
          </ol>

          <div className="streak-milestone">
            <div className="goal-metric-label"><span className="label-large">Next milestone: {plural(data.nextMilestone, 'day')}</span><span className="body-small text-variant">{data.nextMilestone - data.streak} to go</span></div>
            <LinearProgress value={milestonePercent} label="Progress to next milestone" />
          </div>

          <section className="year-counter" aria-labelledby="year-counter-title">
            <h3 id="year-counter-title" className="title-small">Year counter</h3>
            {data.needsFlip && (
              <div className="year-flip-banner" role="status">
                <span className="year-flip-emoji" aria-hidden="true">🎆</span>
                <span>
                  <strong className="title-small">{data.counter.year} is done — you showed up {data.counter.activeDays}/{data.counter.daysInYear} days!</strong>
                  <span className="body-small text-variant">Flip your counter over to start {data.current.year}.</span>
                </span>
              </div>
            )}
            <YearCard card={data.counter} flipping={flipping} current={!data.needsFlip} />
            {data.needsFlip ? (
              <button type="button" className="btn btn-filled state-layer year-flip-btn" onClick={flip} disabled={Boolean(flipping)}>
                <Icon name="flip" />{flipping ? 'Flipping…' : `Flip to ${data.current.year}`}
              </button>
            ) : (
              <p className="body-small text-variant">Day {data.current.dayOfYear} of {data.current.daysInYear} in {data.current.year}. Every day you check in or finish a step adds one.</p>
            )}
          </section>

          <dl className="streak-stats">
            <div><dt className="body-small text-variant">Longest streak</dt><dd className="title-medium">{plural(data.longest, 'day')}</dd></div>
            <div><dt className="body-small text-variant">Total days shown up</dt><dd className="title-medium">{data.totalDays}</dd></div>
          </dl>

          {data.history.length > 0 && (
            <div className="year-history">
              <span className="fieldset-legend">Past years</span>
              <ul role="list">
                {data.history.map(card => <li key={card.year}><strong>{card.year}</strong> {card.activeDays}/{card.daysInYear}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
