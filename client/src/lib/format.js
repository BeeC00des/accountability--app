export const initials = name => name?.trim().split(/\s+/).map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';

export const firstName = name => name?.trim().split(/\s+/)[0] || '';

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
export const relativeTime = value => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'Just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relativeFormatter.format(Math.round(seconds / 86400), 'day');
  return formatDate(date);
};

export const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, options).format(date);
};

export const formatDateTime = value => formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });

export const plural = (count, singular, pluralWord = `${singular}s`) => `${count} ${count === 1 ? singular : pluralWord}`;

/** Reads the most useful message from an axios error. */
export const apiError = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.message || error?.response?.data?.errors?.[0]?.msg ||
  (error?.request && !error?.response ? 'You appear to be offline. Check your connection and try again.' : fallback);

/** Stable pastel gradient avatars derived from a name (readable in light and dark). */
const AVATAR_TONES = [
  'linear-gradient(135deg, #e4f69a, #c3eb3a)',
  'linear-gradient(135deg, #c9ecff, #8fb8ff)',
  'linear-gradient(135deg, #ffd1ec, #d9a2ff)',
  'linear-gradient(135deg, #c8f5df, #74d9ad)',
  'linear-gradient(135deg, #ffe8a8, #f8c44c)'
];
export const avatarTone = (seed = '') => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  return { '--avatar-bg': AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length], '--avatar-fg': '#111111' };
};

/** Local calendar key (YYYY-MM-DD) for a date in the browser's timezone. */
export const dayKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
