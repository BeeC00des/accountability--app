import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { ACCENT_PRESETS, useTheme } from '../context/ThemeContext';
import { getConsent, setConsent } from '../lib/consent';
import { apiError } from '../lib/format';
import { Dialog, Icon, Switch, TextField } from './ui';

const KINDS = [
  { value: 'idea', label: 'Idea', icon: 'lightbulb' },
  { value: 'bug', label: 'Problem', icon: 'bug_report' },
  { value: 'praise', label: 'Praise', icon: 'favorite' },
  { value: 'other', label: 'Other', icon: 'chat' }
];

function FeedbackDialog({ onClose }) {
  const { notify } = useApp();
  const location = useLocation();
  const [form, setForm] = useState({ kind: 'idea', message: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setError(''); };

  const submit = async event => {
    event.preventDefault();
    if (form.message.trim().length < 5) { setError('Tell us a bit more (at least 5 characters).'); return; }
    setBusy(true);
    try {
      const response = await API.post('/feedback', { ...form, message: form.message.trim(), email: form.email.trim(), page: location.pathname });
      notify(response.data.message);
      onClose();
    } catch (sendError) {
      setError(apiError(sendError, 'Could not send your feedback.'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      as="form"
      onSubmit={submit}
      icon="chat_bubble"
      title="Share feedback"
      description="Ideas, problems or praise — it all helps us make Accountable better."
      onClose={onClose}
      busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={busy}><Icon name="send" />{busy ? 'Sending…' : 'Send feedback'}</button>
      </>}
    >
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      <div className="segmented segmented-block feedback-kinds" role="radiogroup" aria-label="Type of feedback">
        {KINDS.map(kind => (
          <button key={kind.value} type="button" role="radio" aria-checked={form.kind === kind.value} className="state-layer" onClick={() => set('kind', kind.value)}>
            <Icon name={kind.icon} />{kind.label}
          </button>
        ))}
      </div>
      <TextField as="textarea" rows={4} label="Your feedback" value={form.message} onChange={event => set('message', event.target.value)} maxLength={2000} counter={`${form.message.length}/2000`} placeholder="What would make Accountable better for you?" data-autofocus />
      <TextField label="Email (optional)" type="email" value={form.email} onChange={event => set('email', event.target.value)} autoComplete="email" help="Only if you’d like a reply." />
    </Dialog>
  );
}

function ConsentDialog({ onClose }) {
  const { notify } = useApp();
  const [preferences, setPreferences] = useState(() => getConsent().preferences);
  const save = () => {
    setConsent({ preferences });
    notify(preferences ? 'Preferences will be remembered on this device' : 'Preference storage turned off and cleared');
    onClose();
  };
  return (
    <Dialog
      icon="cookie"
      title="Consent preferences"
      description="Accountable doesn’t use ads or third-party trackers. Here’s what we store in your browser."
      onClose={onClose}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-filled state-layer" onClick={save}>Save preferences</button>
      </>}
    >
      <div className="setting-row consent-row">
        <Icon name="lock" className="text-variant" />
        <span className="setting-row-text">
          <span className="body-large">Essential</span>
          <span className="body-medium text-variant">Keeps you signed in. Required for the app to work.</span>
        </span>
        <span className="tag">Always on</span>
      </div>
      <label className="setting-row consent-row" htmlFor="consent-preferences">
        <Icon name="tune" className="text-variant" />
        <span className="setting-row-text">
          <span className="body-large">Preferences</span>
          <span className="body-medium text-variant">Remembers light/dark mode, theme color, sidebar layout and dismissed tips on this device.</span>
        </span>
        <Switch id="consent-preferences" checked={preferences} onChange={setPreferences} />
      </label>
      <p className="body-small text-variant">Read more in our <Link to="/privacy" onClick={onClose}>Privacy Policy</Link>.</p>
    </Dialog>
  );
}

/** Public site footer (landing, changelog, privacy): wordmark, links, accent switcher and feedback. */
export default function SiteFooter() {
  const { accent, setAccent } = useTheme();
  const [dialog, setDialog] = useState(null); // 'feedback' | 'consent'

  return (
    <footer className="landing-footer">
      <Link to="/" className="landing-wordmark" aria-label="Accountable home">account<span>able</span></Link>
      <p className="landing-footer-tagline">Growing is easier when someone’s cheering you on.</p>
      <nav className="landing-footer-nav landing-footer-legal" aria-label="Legal">
        <Link to="/changelog">Changelog</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <button type="button" className="footer-link-btn" onClick={() => setDialog('consent')}>Consent Preferences</button>
      </nav>
      <p className="landing-footer-copy">© {new Date().getFullYear()} Accountable</p>

      <div className="accent-pill" role="radiogroup" aria-label="Accent color">
        <span className="accent-pill-label" aria-hidden="true">Accent</span>
        {ACCENT_PRESETS.map(preset => (
          <button
            key={preset.value}
            type="button"
            role="radio"
            aria-checked={accent === preset.value}
            aria-label={`${preset.label} accent`}
            title={preset.label}
            className={`accent-dot${accent === preset.value ? ' selected' : ''}`}
            style={{ '--dot': preset.hex }}
            onClick={() => setAccent(preset.value)}
          />
        ))}
      </div>

      <button type="button" className="feedback-fab state-layer" onClick={() => setDialog('feedback')}>
        <Icon name="chat_bubble" />Share feedback
      </button>

      {dialog === 'feedback' && <FeedbackDialog onClose={() => setDialog(null)} />}
      {dialog === 'consent' && <ConsentDialog onClose={() => setDialog(null)} />}
    </footer>
  );
}
