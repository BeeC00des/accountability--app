import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API, useAuth } from './AuthContext';
import { savePreference } from '../lib/consent';

/*
 * Appearance (light / dark / system) + white-label brand color.
 * Any brand color generates a full, contrast-checked palette for both appearances.
 */

export const ACCENT_PRESETS = [
  { value: 'lime', label: 'Lime', hex: '#d8f36a' },
  { value: 'ocean', label: 'Ocean', hex: '#7cc4fa' },
  { value: 'coral', label: 'Coral', hex: '#ff8f7d' },
  { value: 'lavender', label: 'Lavender', hex: '#b9a5ff' },
  { value: 'mint', label: 'Mint', hex: '#7fe0b8' },
  { value: 'amber', label: 'Amber', hex: '#ffc24d' },
  { value: 'graphite', label: 'Graphite', hex: '#b8bec6' }
];
const presetHex = value => ACCENT_PRESETS.find(preset => preset.value === value)?.hex;
export const accentHex = accent => presetHex(accent) || (/^#[0-9a-f]{6}$/i.test(accent || '') ? accent : '#d8f36a');

/* ---------- color math ---------- */
const toRgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const toHex = rgb => `#${rgb.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, weightA) => toHex(toRgb(a).map((value, index) => value * weightA + toRgb(b)[index] * (1 - weightA)));
const rgba = (hex, alpha) => `rgb(${toRgb(hex).join(' ')} / ${alpha})`;
const luminance = hex => {
  const [r, g, b] = toRgb(hex).map(value => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const readableOn = hex => (contrast(hex, '#111111') >= contrast(hex, '#ffffff') ? '#111111' : '#ffffff');
/** Moves `hex` toward `target` until it reaches WCAG AA (4.5:1) against `background`. */
const ensureContrast = (hex, background, target) => {
  let color = hex;
  for (let step = 0; step < 20 && contrast(color, background) < 4.5; step += 1) color = mix(color, target, 0.88);
  return color;
};

export const paletteFor = (hex, mode) => {
  const onBrand = readableOn(hex);
  if (mode === 'dark') {
    return {
      '--lime': hex,
      '--lime-strong': mix(hex, '#000000', 0.88),
      '--on-lime': onBrand,
      '--lime-soft': rgba(hex, 0.14),
      '--tint': ensureContrast(hex, '#1c1c1e', '#ffffff'),
      '--check': hex,
      '--on-check': onBrand,
      '--hero': `radial-gradient(120% 95% at 50% 0%, ${rgba(hex, 0.3)}, ${rgba(hex, 0.07)} 55%, transparent 80%), #141414`,
      '--mascot': hex,
      '--mascot-face': onBrand,
      '--sidebar-bg': mix(hex, '#0e0e0f', 0.05),
      '--brand-mark': `linear-gradient(145deg, ${mix(hex, '#ffffff', 0.7)}, ${hex})`
    };
  }
  return {
    '--lime': hex,
    '--lime-strong': mix(hex, '#000000', 0.88),
    '--on-lime': onBrand,
    '--lime-soft': mix(hex, '#ffffff', 0.22),
    '--tint': ensureContrast(mix(hex, '#000000', 0.55), '#ffffff', '#000000'),
    '--check': '#1f2240',
    '--on-check': '#ffffff',
    '--hero': `linear-gradient(180deg, ${mix(hex, '#ffffff', 0.62)} 0%, ${mix(hex, '#ffffff', 0.34)} 42%, ${mix(hex, '#ffffff', 0.12)} 78%, #ffffff 100%)`,
    '--mascot': mix(hex, '#ffffff', 0.16),
    '--mascot-face': '#111111',
    '--sidebar-bg': mix(hex, '#f6f7f4', 0.07),
    '--brand-mark': `linear-gradient(145deg, ${mix(hex, '#ffffff', 0.55)}, ${mix(hex, '#000000', 0.9)})`
  };
};

/* ---------- storage ---------- */
const read = (key, fallback) => { try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; } };
const write = savePreference; // respects the visitor's storage consent
const systemMode = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const PENDING_KEY = 'accountable-accent-pending';
const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const { user, updateUser } = useAuth();
  const [theme, setTheme] = useState(() => { const stored = read('accountable-theme', 'system'); return ['light', 'dark', 'system'].includes(stored) ? stored : 'system'; });
  const [accent, setAccentState] = useState(() => read('accountable-accent', 'lime'));
  const [system, setSystem] = useState(systemMode);
  const mode = theme === 'system' ? system : theme;

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Another open tab (the website or the app) changed the colour: follow it here too.
  useEffect(() => {
    const onStorage = event => { if (event.key === 'accountable-accent' && event.newValue) setAccentState(event.newValue); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // On sign-in: a colour picked on the website while signed out wins and is saved to the account,
  // so the dashboard looks the same. Otherwise the account's saved colour is used.
  useEffect(() => {
    if (!user?._id) return;
    const pending = read(PENDING_KEY, '');
    if (pending) {
      try { window.localStorage.removeItem(PENDING_KEY); } catch { /* storage unavailable */ }
      setAccentState(pending);
      write('accountable-accent', pending);
      if (pending !== user.accent) API.put('/auth/profile', { accent: pending }).then(() => updateUser({ accent: pending })).catch(() => {});
      return;
    }
    if (user.accent) { setAccentState(user.accent); write('accountable-accent', user.accent); }
  }, [user?._id, user?.accent, updateUser]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme; else root.dataset.theme = theme;
    write('accountable-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(paletteFor(accentHex(accent), mode)).forEach(([name, value]) => root.style.setProperty(name, value));
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', mode === 'dark' ? '#000000' : mix(accentHex(accent), '#ffffff', 0.62)));
  }, [accent, mode]);

  /** One click flips what you see right now (light ↔ dark), whatever the starting point. */
  const toggleTheme = useCallback(() => setTheme(mode === 'dark' ? 'light' : 'dark'), [mode]);

  const setAccent = useCallback(async value => {
    setAccentState(value);
    write('accountable-accent', value);
    if (!user) write(PENDING_KEY, value); // remembered until the next sign-in, then applied to the account
    if (user) {
      try { await API.put('/auth/profile', { accent: value }); updateUser({ accent: value }); } catch { /* kept locally */ }
    }
  }, [user, updateUser]);

  const value = useMemo(() => ({ theme, mode, setTheme, toggleTheme, accent, setAccent }), [theme, mode, toggleTheme, accent, setAccent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
