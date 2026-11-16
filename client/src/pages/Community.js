import React, { useCallback, useEffect, useState } from 'react';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Dialog, EmptyState, ErrorBanner, Icon, LinearProgress, Spinner, TextField } from '../components/ui';
import { apiError, relativeTime } from '../lib/format';

const HUMAN = [
  { value: 'therapist', label: 'Therapist', icon: 'psychology', tile: 'tile-purple', text: 'Licensed support for stress, anxiety, or what’s holding you back.' },
  { value: 'mentor', label: 'Mentor', icon: 'school', tile: 'tile-blue', text: 'Someone a few steps ahead who can guide your path.' },
  { value: 'counsellor', label: 'Counsellor', icon: 'forum', tile: 'tile-pink', text: 'A safe space to talk through life or career decisions.' },
  { value: 'coach', label: 'Coach', icon: 'sports', tile: 'tile-green', text: 'Structure, accountability and skills for a specific goal.' },
  { value: 'accountability', label: 'Accountability buddy', icon: 'handshake', tile: 'tile-yellow', text: 'We’ll match you with someone working on something similar.' }
];
const CATEGORY_LABEL = { ...Object.fromEntries(HUMAN.map(item => [item.value, item.label])), subscription: 'Sponsored subscription' };
const STATUS = {
  submitted: { label: 'Sent', className: 'tag-warning', icon: 'schedule' },
  in_review: { label: 'In review', className: 'tag-primary', icon: 'visibility' },
  matched: { label: 'Matched', className: 'tag-success', icon: 'check_circle' },
  closed: { label: 'Closed', className: '', icon: 'do_not_disturb_on' }
};

function RequestDialog({ kind, category, goals, onClose, onSent }) {
  const meta = HUMAN.find(item => item.value === category);
  const isCapital = kind === 'capital';
  const [form, setForm] = useState({ message: '', goalId: '', format: 'either', urgency: 'normal', contact: 'in_app' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setError(''); };

  const submit = async event => {
    event.preventDefault();
    if (form.message.trim().length < 10) { setError('Tell us a little more (at least 10 characters).'); return; }
    setBusy(true);
    try {
      const response = await API.post('/support', { kind, category, ...form, message: form.message.trim(), goalId: form.goalId || undefined });
      onSent(response.data.request, response.data.message);
      onClose();
    } catch (sendError) {
      setError(apiError(sendError, 'Could not send your request.'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      as="form"
      onSubmit={submit}
      icon={isCapital ? 'workspace_premium' : meta?.icon}
      title={isCapital ? 'Apply for a sponsored subscription' : `Request a ${meta?.label.toLowerCase()}`}
      description={isCapital ? 'Thank you for growing our community. Tell us how a subscription would help your plan.' : 'Share what you’re working on. Only our support team sees this.'}
      onClose={onClose}
      busy={busy}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={busy}><Icon name="send" />{busy ? 'Sending…' : 'Send request'}</button>
      </>}
    >
      {(category === 'therapist' || category === 'counsellor') && (
        <p className="crisis-note body-small"><Icon name="emergency" filled />If you’re in crisis or thinking about harming yourself, please contact local emergency services or a crisis line right now — don’t wait for a match.</p>
      )}
      {error && <p className="inline-error" role="alert"><Icon name="error" />{error}</p>}
      <TextField as="textarea" rows={4} label={isCapital ? 'How would it help?' : 'What do you need help with?'} value={form.message} onChange={event => set('message', event.target.value)} maxLength={1000} counter={`${form.message.length}/1000`} placeholder={isCapital ? 'e.g. Premium coaching tools would help me stay on track with…' : 'e.g. I keep losing momentum on my fitness goal after two weeks…'} data-autofocus />
      {goals.length > 0 && (
        <TextField as="select" label="Related goal (optional)" value={form.goalId} onChange={event => set('goalId', event.target.value)}>
          <option value="">No specific goal</option>
          {goals.map(goal => <option key={goal._id} value={goal._id}>{goal.emoji} {goal.title}</option>)}
        </TextField>
      )}
      {!isCapital && (
        <div className="field-row">
          <TextField as="select" label="Format" value={form.format} onChange={event => set('format', event.target.value)}>
            <option value="either">Online or in person</option>
            <option value="online">Online</option>
            <option value="in_person">In person</option>
          </TextField>
          <TextField as="select" label="How soon?" value={form.urgency} onChange={event => set('urgency', event.target.value)}>
            <option value="low">Whenever works</option>
            <option value="normal">In the next few weeks</option>
            <option value="high">As soon as possible</option>
          </TextField>
        </div>
      )}
      <TextField as="select" label="Reach me by" value={form.contact} onChange={event => set('contact', event.target.value)}>
        <option value="in_app">Accountable inbox</option>
        <option value="email">Email</option>
      </TextField>
    </Dialog>
  );
}

/** Upgrade card shown over the locked Community preview for free accounts. */
function PremiumCard() {
  const { user, updateUser } = useAuth();
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  const requested = Boolean(user?.premiumRequestedAt);

  const requestPremium = async () => {
    setBusy(true);
    try {
      const response = await API.post('/auth/premium-request');
      updateUser({ premiumRequestedAt: response.data.user.premiumRequestedAt, plan: response.data.user.plan });
      notify(response.data.message);
    } catch (requestError) {
      notify(apiError(requestError, 'Could not send your request. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="premium-gate" aria-labelledby="premium-title">
      <span className="premium-gate-icon" aria-hidden="true"><Icon name="workspace_premium" filled /></span>
      <span className="premium-tag premium-tag-lg"><Icon name="lock" />Premium</span>
      <h1 id="premium-title" className="headline-small">Community is <span className="italic-accent">Premium.</span></h1>
      <p className="body-medium text-variant premium-gate-copy">Request a therapist, mentor, counsellor, coach or accountability buddy, and track every request — all unlocked with Premium.</p>
      {requested ? (
        <div className="premium-requested" role="status">
          <Icon name="schedule" />
          <span><strong className="title-small">Request sent</strong><span className="body-small text-variant">We’ll turn Premium on for your account and let you know. Requested {relativeTime(user.premiumRequestedAt).toLowerCase()}.</span></span>
        </div>
      ) : (
        <button type="button" className="btn btn-filled state-layer premium-gate-btn" onClick={requestPremium} disabled={busy}>
          <Icon name="workspace_premium" filled />{busy ? 'Sending…' : 'Request Premium'}
        </button>
      )}
    </section>
  );
}

const PREVIEW_DATA = { requests: [], referrals: { count: 0, required: 3, eligible: false, code: null } };

export default function Community() {
  const { user } = useAuth();
  return <CommunityContent preview={user?.plan !== 'premium'} />;
}

/** The Community page. In `preview` (free accounts) it shows the same page, locked, under the upgrade card. */
function CommunityContent({ preview = false }) {
  const { notify } = useApp();
  const [data, setData] = useState(preview ? PREVIEW_DATA : null);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState('');
  const [request, setRequest] = useState(null); // { kind, category }

  const load = useCallback(async () => {
    setError('');
    try {
      const [support, goalList] = await Promise.all([API.get('/support'), API.get('/goals', { params: { status: 'active' } })]);
      setData(support.data);
      setGoals(goalList.data.goals || []);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load community support.'));
    }
  }, []);
  useEffect(() => { if (!preview) load(); }, [load, preview]);

  const withdraw = async item => {
    try {
      const response = await API.delete(`/support/${item._id}`);
      setData(current => ({ ...current, requests: current.requests.map(entry => (entry._id === item._id ? response.data.request : entry)) }));
      notify('Request withdrawn');
    } catch (withdrawError) {
      notify(apiError(withdrawError, 'Could not withdraw this request.'));
    }
  };

  if (!data && !error) return <Spinner label="Loading community" />;
  const referrals = data?.referrals || { count: 0, required: 3, eligible: false, code: null };
  const inviteLink = referrals.code ? `${window.location.origin}/auth?ref=${encodeURIComponent(referrals.code)}` : '';

  const shareInvite = async () => {
    const text = `I’m using Accountable to imagine my future, get inspired and act. Join me: ${inviteLink}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Join me on Accountable', text, url: inviteLink });
      else { await navigator.clipboard.writeText(inviteLink); notify('Invite link copied'); }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') notify('Could not share — copy the link instead.');
    }
  };

  const body = (
    <>
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Stuck with your <span className="italic-accent">growth plan?</span></h1>
          <p className="body-large text-variant">Let us know what you need. We’ll help you find the people and resources to keep going.</p>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <section aria-labelledby="human-title">
        <h2 id="human-title" className="section-label">Human support</h2>
        <ul className="support-grid" role="list">
          {HUMAN.map(item => (
            <li key={item.value}>
              <button type="button" className="support-card state-layer" onClick={() => setRequest({ kind: 'human', category: item.value })}>
                <span className={`tile ${item.tile}`} aria-hidden="true"><Icon name={item.icon} filled /></span>
                <span className="title-small">{item.label}</span>
                <span className="body-small text-variant">{item.text}</span>
                <span className="support-card-cta label-medium">Request <Icon name="arrow_forward" size="18" /></span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="capital-card" aria-labelledby="capital-title">
        <div className="capital-head">
          <span className="capital-icon" aria-hidden="true"><Icon name="workspace_premium" filled /></span>
          <div>
            <h2 id="capital-title" className="title-large">Capital: sponsored subscription</h2>
            <p className="body-medium capital-copy">For exceptional members who’ve brought others into the community. Invite {referrals.required} people who join, and we’ll consider sponsoring your platform subscription.</p>
          </div>
        </div>
        <div className="capital-progress">
          <div className="goal-metric-label"><span className="label-large">{referrals.count} of {referrals.required} people joined with your invite</span>{referrals.eligible && <span className="tag tag-success"><Icon name="check" />Eligible</span>}</div>
          <LinearProgress value={Math.min(100, (referrals.count / referrals.required) * 100)} label="Referral progress" />
        </div>
        <div className="capital-actions">
          {inviteLink && (
            <div className="code-display">
              <span className="body-small code-value invite-link">{inviteLink.replace(/^https?:\/\//, '')}</span>
              <button type="button" className="icon-btn state-layer" onClick={() => navigator.clipboard?.writeText(inviteLink).then(() => notify('Invite link copied')).catch(() => notify('Copy isn’t available here.'))} aria-label="Copy invite link"><Icon name="content_copy" /></button>
            </div>
          )}
          <button type="button" className="btn btn-tonal state-layer" onClick={shareInvite} disabled={!inviteLink}><Icon name="share" />Share invite</button>
          <button type="button" className="btn btn-filled state-layer" onClick={() => setRequest({ kind: 'capital', category: 'subscription' })} disabled={!referrals.eligible} title={referrals.eligible ? undefined : `Unlocks at ${referrals.required} referrals`}>
            <Icon name={referrals.eligible ? 'workspace_premium' : 'lock'} />Apply
          </button>
        </div>
      </section>

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" className="section-label">Your requests</h2>
        {!data?.requests?.length ? (
          <div className="card"><EmptyState icon="support_agent" title="No requests yet">When you ask for support, you’ll see its status here. Our team usually replies within a few days.</EmptyState></div>
        ) : (
          <div className="card list-card">
            <ul className="list" role="list">
              {data.requests.map(item => {
                const status = STATUS[item.status] || STATUS.submitted;
                return (
                  <li key={item._id} className="list-item three-line">
                    <span className="settings-row-icon" aria-hidden="true"><Icon name={item.kind === 'capital' ? 'workspace_premium' : (HUMAN.find(h => h.value === item.category)?.icon || 'support_agent')} /></span>
                    <span className="list-item-content">
                      <span className="list-item-headline">{CATEGORY_LABEL[item.category]}</span>
                      <span className="list-item-supporting clamp-2">{item.message}</span>
                      {item.response && <span className="body-small support-response"><Icon name="reply" size="18" />{item.response}</span>}
                      <span className="body-small text-variant">{relativeTime(item.createdAt)}{item.goal ? ` · ${item.goal.emoji} ${item.goal.title}` : ''}</span>
                    </span>
                    <span className="list-item-trailing support-trailing">
                      <span className={`tag ${status.className}`}><Icon name={status.icon} />{status.label}</span>
                      {item.status === 'submitted' && <button type="button" className="btn btn-text btn-sm state-layer" onClick={() => withdraw(item)}>Withdraw</button>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {request && (
        <RequestDialog
          {...request}
          goals={goals}
          onClose={() => setRequest(null)}
          onSent={(sent, message) => { setData(current => ({ ...current, requests: [sent, ...(current?.requests || [])] })); notify(message); }}
        />
      )}
    </>
  );

  if (!preview) return <div className="page">{body}</div>;
  return (
    <div className="page community-locked">
      {/* Read-only look at what Premium unlocks: not focusable, not clickable, hidden from screen readers. */}
      <div className="premium-preview" inert="" aria-hidden="true">{body}</div>
      <div className="premium-overlay"><PremiumCard /></div>
    </div>
  );
}
