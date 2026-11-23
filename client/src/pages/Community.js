import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import CommunityExperts from '../components/CommunityExperts';
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
        <option value="in_app">doerstab inbox</option>
        <option value="email">Email</option>
      </TextField>
    </Dialog>
  );
}

/** Upgrade card shown over the locked Community preview for free accounts. */
function PremiumCard() {
  const { user, updateUser } = useAuth();
  const { notify } = useApp();
  const [busy, setBusy] = useState('');
  const [offer, setOffer] = useState(null);
  const requested = Boolean(user?.premiumRequestedAt);
  const expired = user?.plan === 'premium' && user?.premiumUntil && new Date(user.premiumUntil) <= new Date();

  useEffect(() => { API.get('/payments/community').then(response => setOffer(response.data)).catch(() => setOffer({ available: false })); }, []);

  const join = async () => {
    setBusy('pay');
    try {
      const response = await API.post('/payments/community/checkout');
      window.location.assign(response.data.checkoutUrl); // Bachs secure hosted checkout
    } catch (payError) {
      notify(apiError(payError, 'Could not start the payment. Try again.'));
      setBusy('');
    }
  };

  const requestPremium = async () => {
    setBusy('request');
    try {
      const response = await API.post('/auth/premium-request');
      updateUser({ premiumRequestedAt: response.data.user.premiumRequestedAt, plan: response.data.user.plan });
      notify(response.data.message);
    } catch (requestError) {
      notify(apiError(requestError, 'Could not send your request. Try again.'));
    } finally {
      setBusy('');
    }
  };

  const price = offer?.price?.label || '₦22,000';
  return (
    <section className="premium-gate" aria-labelledby="premium-title">
      <span className="premium-gate-icon" aria-hidden="true"><Icon name="workspace_premium" filled /></span>
      <span className="premium-tag premium-tag-lg"><Icon name="lock" />Private community</span>
      <h1 id="premium-title" className="headline-small">{expired ? <>Renew your <span className="italic-accent">membership.</span></> : <>Join the <span className="italic-accent">Community.</span></>}</h1>
      <p className="body-medium text-variant premium-gate-copy">Your own mentor, therapist and career coach. They draft the steps to your goals right on your board, follow your daily progress, and you can book sessions with each of them.</p>
      <p className="premium-price"><strong>{price}</strong><span className="body-small text-variant"> / year</span></p>
      {offer?.available !== false ? (
        <>
          <button type="button" className="btn btn-filled state-layer premium-gate-btn" onClick={join} disabled={Boolean(busy) || !offer}>
            <Icon name="lock_open" />{busy === 'pay' ? 'Opening secure checkout…' : expired ? `Renew for ${price}` : `Join for ${price}/year`}
          </button>
          <p className="body-small text-variant premium-secure"><Icon name="verified_user" size="16" />Pay by card or bank transfer · secured by Bachs</p>
        </>
      ) : requested ? (
        <div className="premium-requested" role="status">
          <Icon name="schedule" />
          <span><strong className="title-small">Request sent</strong><span className="body-small text-variant">Online payment is coming soon. We’ll turn your access on and let you know. Requested {relativeTime(user.premiumRequestedAt).toLowerCase()}.</span></span>
        </div>
      ) : (
        <button type="button" className="btn btn-filled state-layer premium-gate-btn" onClick={requestPremium} disabled={Boolean(busy)}>
          <Icon name="workspace_premium" filled />{busy === 'request' ? 'Sending…' : 'Request access'}
        </button>
      )}
    </section>
  );
}

/** After returning from checkout (?payment=success): confirm the payment, then unlock. */
function PaymentReturn() {
  const { updateUser } = useAuth();
  const { notify } = useApp();
  const [params, setParams] = useSearchParams();
  const outcome = params.get('payment');
  const checkoutId = params.get('checkout_id');
  const [state, setState] = useState(outcome === 'success' ? 'checking' : outcome === 'cancelled' ? 'cancelled' : '');

  useEffect(() => {
    if (outcome !== 'success') return undefined;
    let stopped = false;
    let tries = 0;
    const check = async () => {
      tries += 1;
      try {
        const response = await API.get('/payments/community/status', { params: checkoutId ? { checkout_id: checkoutId } : {} });
        if (stopped) return;
        if (response.data.access) {
          updateUser(response.data.user);
          setState('done');
          notify('Welcome to the Community! 🎉');
          setParams({}, { replace: true });
          return;
        }
      } catch { /* keep trying */ }
      if (tries < 20) setTimeout(check, 3000); else if (!stopped) setState('slow');
    };
    check();
    return () => { stopped = true; };
  }, [outcome, checkoutId, updateUser, notify, setParams]);

  if (!state || state === 'done') return null;
  return (
    <div className={`payment-banner ${state}`} role="status">
      <Icon name={state === 'checking' ? 'hourglass_top' : state === 'cancelled' ? 'info' : 'schedule'} />
      <span>{state === 'checking' ? 'Confirming your payment… this usually takes a few seconds.'
        : state === 'cancelled' ? 'Payment cancelled — you haven’t been charged. You can join whenever you’re ready.'
          : 'Your payment is still being confirmed. We’ll unlock the Community as soon as it arrives — you’ll get an email too.'}</span>
      {state !== 'checking' && <button type="button" className="icon-btn state-layer" onClick={() => { setState(''); setParams({}, { replace: true }); }} aria-label="Dismiss"><Icon name="close" /></button>}
    </div>
  );
}

const PREVIEW_DATA = { requests: [], referrals: { count: 0, required: 5, eligible: false, code: null } };

export default function Community() {
  const { user } = useAuth();
  return <><PaymentReturn /><CommunityContent preview={!user?.communityAccess} /></>;
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
  const referrals = data?.referrals || { count: 0, required: 5, eligible: false, code: null };
  const inviteLink = referrals.code ? `${window.location.origin}/auth?ref=${encodeURIComponent(referrals.code)}` : '';

  const shareInvite = async () => {
    const text = `I’m using doerstab to imagine my future, get inspired and act. Join me: ${inviteLink}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Join me on doerstab', text, url: inviteLink });
      else { await navigator.clipboard.writeText(inviteLink); notify('Invite link copied'); }
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') notify('Could not share — copy the link instead.');
    }
  };

  const body = (
    <>
      <header className="page-header">
        <div>
          <h1 className="headline-medium">Your <span className="italic-accent">Community.</span></h1>
          <p className="body-large text-variant">Your mentor, therapist and career coach — drafting your steps, following your progress, a session away.</p>
        </div>
      </header>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!preview && <CommunityExperts />}

      <section aria-labelledby="human-title">
        <h2 id="human-title" className="section-label">More support</h2>
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
