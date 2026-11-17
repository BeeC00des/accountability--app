import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Icon, TextField } from '../components/ui';
import { apiError } from '../lib/format';

const MIN_PASSWORD = 8;

/** Step 2 of a password reset: opened from the emailed link (/reset-password?token=…). */
export default function ResetPassword() {
  const { signInWith } = useAuth();
  const { notify } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const validLink = /^[a-f0-9]{64}$/.test(token);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = key => event => { setForm(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: '' })); setFormError(''); };

  const submit = async event => {
    event.preventDefault();
    const next = {};
    if (form.password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (form.confirm !== form.password) next.confirm = 'The passwords don’t match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      const response = await API.post('/auth/reset-password', { token, password: form.password });
      signInWith(response.data.token, response.data.user);
      notify(response.data.message);
      navigate('/board', { replace: true });
    } catch (submitError) {
      setFormError(apiError(submitError, 'Could not reset your password. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <Link to="/auth" className="auth-back state-layer"><Icon name="arrow_back" />Sign in</Link>
      <section className="auth-card" aria-labelledby="reset-title">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true"><Icon name="password" filled /></span>
          <h1 id="reset-title" className="headline-small">{validLink ? 'Choose a new password' : 'This link doesn’t work'}</h1>
          <p className="body-medium text-variant">{validLink ? 'You’ll be signed in straight after.' : 'It may be incomplete or out of date.'}</p>
        </div>
        {!validLink ? (
          <div className="auth-actions">
            <Link to="/forgot-password" className="btn btn-filled state-layer">Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {formError && (
              <p className="inline-error" role="alert"><Icon name="error" />{formError}{/expired|already used/i.test(formError) && <> <Link to="/forgot-password">Request a new link</Link></>}</p>
            )}
            <div className="password-field">
              <TextField label="New password" type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="new-password" error={errors.password} help={`At least ${MIN_PASSWORD} characters.`} autoFocus />
              <button type="button" className="icon-btn state-layer password-toggle" onClick={() => setShow(value => !value)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                <Icon name={show ? 'visibility_off' : 'visibility'} />
              </button>
            </div>
            <TextField label="Confirm new password" type={show ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" error={errors.confirm} />
            <div className="auth-actions">
              <span />
              <button type="submit" className="btn btn-filled state-layer" disabled={loading}>{loading ? 'Saving…' : 'Save and sign in'}</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
