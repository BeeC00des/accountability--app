import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const TOKEN_KEY = 'token';

const readToken = () => { try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = token => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch { /* Storage may be blocked; the session still works until reload. */ }
};

export const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api' });

API.interceptors.request.use(config => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const browserTimezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => { writeToken(null); setUser(null); }, []);

  // An expired or revoked token anywhere in the app signs the user out cleanly.
  useEffect(() => {
    const id = API.interceptors.response.use(response => response, error => {
      if (error.response?.status === 401 && readToken()) logout();
      return Promise.reject(error);
    });
    return () => API.interceptors.response.eject(id);
  }, [logout]);

  useEffect(() => {
    if (!readToken()) { setLoading(false); return; }
    API.get('/auth/me')
      .then(response => setUser(response.data.user))
      .catch(() => writeToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await API.post('/auth/login', { email, password });
    writeToken(response.data.token);
    setUser(response.data.user);
    return response.data;
  }, []);

  const register = useCallback(async (name, email, password, referralCode) => {
    // Carry over the theme colour picked on the website so the new account looks the same.
    let accent;
    try { accent = window.localStorage.getItem('accountable-accent') || undefined; } catch { accent = undefined; }
    const response = await API.post('/auth/register', { name, email, password, timezone: browserTimezone(), referralCode: referralCode || undefined, accent });
    writeToken(response.data.token);
    setUser(response.data.user);
    return response.data;
  }, []);

  /** Signs in with a token the server already issued (e.g. after resetting a password). */
  const signInWith = useCallback((token, nextUser) => { writeToken(token); setUser(nextUser); }, []);

  // Merge partial updates (e.g. a new streak after check-in) into the signed-in user.
  const updateUser = useCallback(patch => setUser(previous => (previous ? { ...previous, ...patch } : previous)), []);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser, signInWith, API }), [user, loading, login, register, logout, updateUser, signInWith]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
