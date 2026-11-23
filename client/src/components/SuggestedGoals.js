import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiError } from '../lib/format';
import { Icon } from './ui';

const DISMISSED_KEY = 'accountable-dismissed-suggestions';
const readDismissed = () => { try { return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || '{}'); } catch { return {}; } };
const fmt = day => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const toIso = day => new Date(`${day}T00:00:00`).toISOString();

/** Goals (with dated steps) suggested from what's on the board; Accept adds them to Goals. */
export default function SuggestedGoals({ year, period, itemCount }) {
  const { notify } = useApp();
  const [suggestions, setSuggestions] = useState(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState('');
  const boardKey = `${year}-${period}`;

  useEffect(() => {
    let alive = true;
    API.get('/vision/suggestions', { params: { year, period } })
      .then(response => { if (alive) setSuggestions(response.data.suggestions); })
      .catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [year, period, itemCount]);

  const dismiss = id => setDismissed(current => {
    const next = { ...current, [boardKey]: [...(current[boardKey] || []), id].slice(-50) };
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
    return next;
  });

  const accept = async suggestion => {
    setBusy(suggestion.id);
    try {
      await API.post('/goals', {
        title: suggestion.title,
        emoji: suggestion.emoji,
        category: suggestion.category,
        frequency: suggestion.frequency,
        year: Number(suggestion.startDate.slice(0, 4)),
        startDate: toIso(suggestion.startDate),
        endDate: toIso(suggestion.endDate),
        todos: suggestion.steps.map(step => ({ title: step.title, dueDate: toIso(step.dueDate) }))
      });
      notify(`Added “${suggestion.title}” with ${suggestion.steps.length} dated steps`, { actionLabel: 'View', onAction: () => window.location.assign('/goals') });
      setSuggestions(current => current.filter(item => item.id !== suggestion.id));
    } catch (acceptError) {
      notify(apiError(acceptError, 'Could not add this goal.'));
    } finally {
      setBusy('');
    }
  };

  const visible = (suggestions || []).filter(item => !(dismissed[boardKey] || []).includes(item.id));
  if (!visible.length) return null;

  return (
    <section className="suggested-goals" aria-labelledby="suggested-title">
      <div className="section-head">
        <h2 id="suggested-title" className="title-large"><Icon name="auto_awesome" filled />Suggested goals from your board</h2>
        <Link to="/goals" className="see-all">Your goals</Link>
      </div>
      <p className="body-medium text-variant">Turn what you’ve pictured into a plan. Accept one and it’s added to your goals with dated steps.</p>
      <ul className="suggestion-list" role="list">
        {visible.map(suggestion => (
          <li key={suggestion.id} className="card suggestion-card">
            <div className="suggestion-head">
              <span className="suggestion-emoji" aria-hidden="true">{suggestion.emoji}</span>
              <span className="suggestion-title">
                <strong className="title-small">{suggestion.title}</strong>
                <span className="body-small text-variant">{suggestion.reason}</span>
              </span>
            </div>
            <p className="suggestion-dates body-small"><Icon name="event" size="16" />{fmt(suggestion.startDate)} – {fmt(suggestion.endDate)} · {suggestion.frequency === 'weekly' ? 'weekly' : 'daily'} check-ins · {suggestion.steps.length} steps</p>
            <button type="button" className="btn btn-text btn-sm state-layer suggestion-toggle" onClick={() => setOpen(current => ({ ...current, [suggestion.id]: !current[suggestion.id] }))} aria-expanded={Boolean(open[suggestion.id])}>
              <Icon name={open[suggestion.id] ? 'expand_less' : 'expand_more'} />{open[suggestion.id] ? 'Hide steps' : 'See the steps'}
            </button>
            {open[suggestion.id] && (
              <ol className="suggestion-steps" role="list">
                {suggestion.steps.map(step => <li key={step.title}><span className="suggestion-due">{fmt(step.dueDate)}</span>{step.title}</li>)}
              </ol>
            )}
            <div className="suggestion-actions">
              <button type="button" className="btn btn-filled state-layer" onClick={() => accept(suggestion)} disabled={Boolean(busy)}><Icon name="check" />{busy === suggestion.id ? 'Adding…' : 'Accept'}</button>
              <button type="button" className="btn btn-text state-layer" onClick={() => dismiss(suggestion.id)} disabled={busy === suggestion.id}>Not now</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
