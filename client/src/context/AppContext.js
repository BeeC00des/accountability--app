import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API, useAuth } from './AuthContext';
import { Icon } from '../components/ui';

const AppContext = createContext(null);
const SNACK_MS = 4500;

/**
 * App-wide UI state:
 *  - notify(message, { actionLabel, onAction }) shows an M3 snackbar
 *  - unread / refreshUnread keep the Inbox badge in sync from any page
 *  - streakOpen / setStreakOpen show the streak dialog from any page
 */
export const AppProvider = ({ children }) => {
  const { user } = useAuth();
  const [snack, setSnack] = useState(null);
  const [unread, setUnread] = useState(0);
  const [streakOpen, setStreakOpen] = useState(false);
  const timer = useRef(null);

  const dismiss = useCallback(() => { clearTimeout(timer.current); setSnack(null); }, []);
  const notify = useCallback((message, options = {}) => {
    clearTimeout(timer.current);
    setSnack({ id: Date.now(), message, ...options });
    timer.current = setTimeout(() => setSnack(null), options.duration || SNACK_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const refreshUnread = useCallback(() => API.get('/reminders/unread-count')
    .then(response => setUnread(response.data.count || 0))
    .catch(() => {}), []);

  useEffect(() => {
    if (!user) { setUnread(0); return undefined; }
    refreshUnread();
    const interval = setInterval(refreshUnread, 60000);
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [user, refreshUnread]);

  const value = useMemo(() => ({ notify, unread, setUnread, refreshUnread, streakOpen, setStreakOpen }), [notify, unread, refreshUnread, streakOpen]);

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="snackbar-host" aria-live="polite" aria-atomic="true">
        {snack && (
          <div className="snackbar body-medium" key={snack.id} role="status">
            <span className="snackbar-text">{snack.message}</span>
            {snack.actionLabel && <button type="button" className="btn btn-text state-layer" onClick={() => { dismiss(); snack.onAction?.(); }}>{snack.actionLabel}</button>}
            <button type="button" className="icon-btn state-layer" onClick={dismiss} aria-label="Dismiss"><Icon name="close" size="20" /></button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
