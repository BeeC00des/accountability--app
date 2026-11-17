import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../context/AuthContext';
import { Icon, TextField } from '../components/ui';
import { apiError } from '../lib/format';

/** Step 1 of a password reset: ask for the account email and send a one-time link. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await API.post('/auth/forgot-password', { email: email.trim() });
      setSent(response.data.message);
    } catch (submitError) {
      setError(apiError(submitError, 'Could not send the link. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <Link to="/auth" className="auth-back state-layer"><Icon name="arrow_back" />Sign in</Link>
      <section className="auth-card" aria-labelledby="forgot-title">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true"><Icon name={sent ? 'mark_email_read' : 'lock_reset'} filled /></span>
          <h1 id="forgot-title" className="headline-small">{sent ? 'Check your email' : 'Forgot your password?'}</h1>
          <p className="body-medium text-variant">{sent ? 'The link works for 1 hour.' : 'Enter your email and we’ll send you a link to choose a new one.'}</p>
        </div>
        {sent ? (
          <div className="auth-done">
            <p className="body-medium" role="status">{sent}</p>
            <div className="auth-actions">
              <button type="button" className="btn btn-text state-layer" onClick={() => { setSent(''); }}>Use a different email</button>
              <Link to="/auth" className="btn btn-filled state-layer">Back to sign in</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <TextField label="Email" type="email" value={email} onChange={event => { setEmail(event.target.value); setError(''); }} autoComplete="email" error={error} autoFocus />
            <div className="auth-actions">
              <Link to="/auth" className="btn btn-text state-layer">Back to sign in</Link>
              <button type="submit" className="btn btn-filled state-layer" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
