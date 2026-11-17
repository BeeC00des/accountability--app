/*
 * Storage consent. accounTable uses no ads or third-party trackers; the only browser storage is:
 *  - essential: your sign-in session (always on — the app can't work without it)
 *  - preferences: appearance, theme color, sidebar state and dismissed tips (optional)
 */
const CONSENT_KEY = 'accountable-consent';
export const PREFERENCE_KEYS = ['accountable-theme', 'accountable-accent', 'accountable-sidebar-collapsed', 'accountable-setup-dismissed', 'accountable-reminder-set', 'accountable-studio', 'accountable-accent-pending'];

export const getConsent = () => {
  try { return { preferences: true, ...JSON.parse(window.localStorage.getItem(CONSENT_KEY) || '{}') }; } catch { return { preferences: true }; }
};

export const setConsent = consent => {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ preferences: Boolean(consent.preferences), updatedAt: new Date().toISOString() }));
    if (!consent.preferences) PREFERENCE_KEYS.forEach(key => window.localStorage.removeItem(key));
  } catch { /* storage unavailable */ }
};

/** Saves a preference only if the person allows preference storage. */
export const savePreference = (key, value) => {
  if (!getConsent().preferences) return;
  try { window.localStorage.setItem(key, value); } catch { /* session only */ }
};
