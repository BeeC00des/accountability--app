import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon, TextField } from '../components/ui';
import { apiError } from '../lib/format';

const MIN_PASSWORD = 8;

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const referralCode = (params.get('ref') || '').slice(0, 20);
  const [mode, setMode] = useState(referralCode || params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const isRegister = mode === 'register';

  const set = key => event => { setForm(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: '' })); };
  const switchMode = next => { setMode(next); setErrors({}); setFormError(''); };

  const validate = () => {
    const next = {};
    if (isRegister && !form.name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Enter your password.';
    else if (isRegister && form.password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async event => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      if (isRegister) await register(form.name.trim(), form.email.trim(), form.password, referralCode);
      else await login(form.email.trim(), form.password);
      navigate('/board', { replace: true });
    } catch (submitError) {
      setFormError(apiError(submitError, 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <Link to="/" className="auth-back state-layer"><Icon name="arrow_back" />Home</Link>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
          <h1 id="auth-title" className="headline-small">{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="body-medium text-variant">{isRegister ? 'Imagine your future, get inspired and act.' : 'to continue to accounTable'}</p>
        </div>

        {isRegister && referralCode && (
          <p className="referral-chip"><Icon name="redeem" filled />Invited by a friend · you’ll be connected automatically</p>
        )}
        <form onSubmit={submit} noValidate>
          {formError && <p className="inline-error" role="alert"><Icon name="error" />{formError}</p>}
          {isRegister && <TextField label="Name" value={form.name} onChange={set('name')} autoComplete="name" maxLength={50} error={errors.name} autoFocus />}
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" error={errors.email} autoFocus={!isRegister} />
          <div className="password-field">
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              error={errors.password}
              help={isRegister ? `At least ${MIN_PASSWORD} characters.` : undefined}
            />
            <button type="button" className="icon-btn state-layer password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
            </button>
          </div>
          {!isRegister && <Link to="/forgot-password" className="auth-forgot body-medium">Forgot password?</Link>}
          <div className="auth-actions">
            <button type="button" className="btn btn-text state-layer" onClick={() => switchMode(isRegister ? 'login' : 'register')}>
              {isRegister ? 'Sign in instead' : 'Create account'}
            </button>
            <button type="submit" className="btn btn-filled state-layer" disabled={loading}>{loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
