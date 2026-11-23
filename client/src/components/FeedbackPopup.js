import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiError } from '../lib/format';
import { Icon, TextField } from './ui';

const KINDS = [
  { value: 'idea', label: 'Idea', icon: 'lightbulb' },
  { value: 'bug', label: 'Problem', icon: 'bug_report' },
  { value: 'praise', label: 'Praise', icon: 'favorite' },
  { value: 'other', label: 'Other', icon: 'chat' }
];

/** In-app "Share feedback": a floating button that opens a panel on the right-hand side. */
export default function FeedbackPopup() {
  const { user } = useAuth();
  const { notify } = useApp();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('idea');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const focus = setTimeout(() => textRef.current?.querySelector('textarea')?.focus(), 50);
    const onKey = event => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(focus); document.removeEventListener('keydown', onKey); };
  }, [open]); // eslint-disable-line

  const close = () => { setOpen(false); setError(''); buttonRef.current?.focus(); };

  const submit = async event => {
    event.preventDefault();
    if (message.trim().length < 5) { setError('Tell us a bit more (at least 5 characters).'); return; }
    setBusy(true);
    try {
      const response = await API.post('/feedback', { kind, message: message.trim(), email: user?.email || '', page: location.pathname });
      notify(response.data.message || 'Thanks for your feedback!');
      setMessage('');
      setKind('idea');
      close();
    } catch (sendError) {
      setError(apiError(sendError, 'Could not send your feedback.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button ref={buttonRef} type="button" className={`app-feedback-fab state-layer${open ? ' open' : ''}`} onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-controls="app-feedback-panel">
        <Icon name={open ? 'close' : 'chat_bubble'} /><span>{open ? 'Close' : 'Feedback'}</span>
      </button>
      {open && (
        <section id="app-feedback-panel" className="app-feedback-panel" role="dialog" aria-labelledby="app-feedback-title" aria-modal="false">
          <form onSubmit={submit} noValidate>
            <header className="app-feedback-head">
              <span className="app-feedback-icon" aria-hidden="true"><Icon name="chat_bubble" filled /></span>
              <div>
                <h2 id="app-feedback-title" className="title-medium">Share feedback</h2>
                <p className="body-small text-variant">Ideas, problems or praise — it all helps us make doerstab better.</p>
              </div>
              <button type="button" className="icon-btn state-layer" onClick={close} aria-label="Close feedback"><Icon name="close" /></button>
            </header>
            {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
            <div className="segmented segmented-block feedback-kinds" role="radiogroup" aria-label="Type of feedback">
              {KINDS.map(item => (
                <button key={item.value} type="button" role="radio" aria-checked={kind === item.value} className="state-layer" onClick={() => { setKind(item.value); setError(''); }}>
                  <Icon name={item.icon} />{item.label}
                </button>
              ))}
            </div>
            <div ref={textRef}>
              <TextField as="textarea" rows={5} label="Your feedback" value={message} onChange={event => { setMessage(event.target.value); setError(''); }} maxLength={2000} counter={`${message.length}/2000`} placeholder="What would make doerstab better for you?" />
            </div>
            {user?.email && <p className="body-small text-variant app-feedback-reply"><Icon name="mail" size="16" />We’ll reply to {user.email} if needed.</p>}
            <div className="app-feedback-actions">
              <button type="button" className="btn btn-text state-layer" onClick={close} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-filled state-layer" disabled={busy}><Icon name="send" />{busy ? 'Sending…' : 'Send feedback'}</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
