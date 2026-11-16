import React, { useRef, useState } from 'react';
import { API, useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { Avatar, Dialog, Icon, TextField } from './ui';
import { apiError } from '../lib/format';

const PHOTO_SIZE = 256;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Center-crops an image file to a square and returns a small JPEG data URL. */
const resizePhoto = file => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.85));
  };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
  image.src = url;
});

export function EditProfileDialog({ onClose }) {
  const { user, updateUser } = useAuth();
  const { notify } = useApp();
  const fileInput = useRef(null);
  const [form, setForm] = useState({ name: user?.name || '', bio: user?.bio || '', email: user?.email || '', avatar: user?.avatar || '' });
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = key => event => { setForm(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: '' })); };
  const emailChanged = form.email.trim().toLowerCase() !== (user?.email || '').toLowerCase();

  const pickPhoto = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrors(current => ({ ...current, avatar: 'Choose an image file.' })); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setErrors(current => ({ ...current, avatar: 'Choose a photo under 10 MB.' })); return; }
    try {
      const avatar = await resizePhoto(file);
      setForm(current => ({ ...current, avatar }));
      setErrors(current => ({ ...current, avatar: '' }));
    } catch {
      setErrors(current => ({ ...current, avatar: 'We couldn’t read that image. Try a JPEG or PNG.' }));
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (emailChanged && !password) next.password = 'Enter your current password to change your email.';
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async event => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), bio: form.bio.trim() };
      if (form.avatar !== (user?.avatar || '')) payload.avatar = form.avatar;
      const profile = await API.put('/auth/profile', payload);
      let updated = profile.data.user;
      if (emailChanged) {
        const emailResponse = await API.put('/auth/email', { email: form.email.trim(), password });
        updated = { ...updated, email: emailResponse.data.user.email };
      }
      // Keep populated friends from /me; the profile endpoint returns ids only.
      const { friends, friendRequests, ...rest } = updated;
      updateUser(rest);
      notify('Profile updated');
      onClose();
    } catch (saveError) {
      setFormError(apiError(saveError, 'Could not save your profile.'));
      setSaving(false);
    }
  };

  return (
    <Dialog
      as="form"
      onSubmit={save}
      title="Edit profile"
      description="This is how friends see you on accounTable."
      onClose={onClose}
      busy={saving}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      {formError && <p className="inline-error" role="alert"><Icon name="error" />{formError}</p>}

      <div className="photo-editor">
        <button type="button" className="photo-editor-avatar state-layer" onClick={() => fileInput.current?.click()} aria-label={form.avatar ? 'Change photo' : 'Add photo'}>
          <Avatar self name={form.name || user?.name} src={form.avatar} size="xl" />
          <span className="photo-editor-badge" aria-hidden="true"><Icon name="photo_camera" filled /></span>
        </button>
        <div className="photo-editor-actions">
          <button type="button" className="btn btn-tonal btn-sm state-layer" onClick={() => fileInput.current?.click()}>{form.avatar ? 'Change photo' : 'Add photo'}</button>
          {form.avatar && <button type="button" className="btn btn-text btn-sm btn-danger state-layer" onClick={() => setForm(current => ({ ...current, avatar: '' }))}>Remove</button>}
        </div>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/*" className="visually-hidden" onChange={pickPhoto} tabIndex={-1} aria-hidden="true" />
        {errors.avatar && <p className="inline-error photo-editor-error" role="alert"><Icon name="error" />{errors.avatar}</p>}
      </div>

      <TextField label="Name" value={form.name} onChange={set('name')} maxLength={50} autoComplete="name" error={errors.name} counter={`${form.name.length}/50`} data-autofocus />
      <TextField as="textarea" label="Bio" value={form.bio} onChange={set('bio')} maxLength={160} rows={3} placeholder="What are you working towards?" counter={`${form.bio.length}/160`} />
      <TextField label="Email" type="email" value={form.email} onChange={set('email')} autoComplete="email" error={errors.email} help={emailChanged ? 'You’ll sign in with this new email.' : undefined} />
      {emailChanged && (
        <TextField label="Current password" type="password" value={password} onChange={event => { setPassword(event.target.value); setErrors(current => ({ ...current, password: '' })); }} autoComplete="current-password" error={errors.password} help="Required to change your email." />
      )}
    </Dialog>
  );
}

export function ChangePasswordDialog({ onClose }) {
  const { notify } = useApp();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = key => event => { setForm(current => ({ ...current, [key]: event.target.value })); setErrors(current => ({ ...current, [key]: '' })); };

  const save = async event => {
    event.preventDefault();
    setFormError('');
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password.';
    if (form.newPassword.length < 8) next.newPassword = 'Use at least 8 characters.';
    if (form.confirm !== form.newPassword) next.confirm = 'Passwords don’t match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      await API.put('/auth/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      notify('Password updated');
      onClose();
    } catch (saveError) {
      setFormError(apiError(saveError, 'Could not update your password.'));
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Dialog
      as="form"
      onSubmit={save}
      icon="lock"
      title="Change password"
      description="Use at least 8 characters. You’ll stay signed in on this device."
      onClose={onClose}
      busy={saving}
      actions={<>
        <button type="button" className="btn btn-text state-layer" onClick={() => setShow(value => !value)} aria-pressed={show}><Icon name={show ? 'visibility_off' : 'visibility'} />{show ? 'Hide' : 'Show'}</button>
        <span className="spacer" />
        <button type="button" className="btn btn-text state-layer" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-filled state-layer" disabled={saving}>{saving ? 'Saving…' : 'Update'}</button>
      </>}
    >
      {formError && <p className="inline-error" role="alert"><Icon name="error" />{formError}</p>}
      <TextField label="Current password" type={type} value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" error={errors.currentPassword} data-autofocus />
      <TextField label="New password" type={type} value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" error={errors.newPassword} help="At least 8 characters." />
      <TextField label="Confirm new password" type={type} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" error={errors.confirm} />
    </Dialog>
  );
}
