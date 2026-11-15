import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Icon } from './ui';
import SiteFooter from './SiteFooter';
import '../pages/Landing.css';

/** Header + footer for public pages (changelog, privacy). */
export default function PublicShell({ title, children }) {
  const { mode, toggleTheme } = useTheme();
  const { user } = useAuth();
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — Accountable`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [title]);

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link to="/" className="landing-brand" aria-label="Accountable home">
            <span className="brand-mark" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
            <span className="title-medium">Accountable</span>
          </Link>
          <div className="landing-actions">
            <button type="button" className="round-btn state-layer" onClick={toggleTheme} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
            {user
              ? <Link to="/board" className="btn btn-filled state-layer">Open app</Link>
              : <Link to="/auth" className="btn btn-filled state-layer">Sign in</Link>}
          </div>
        </div>
      </header>
      <main className="public-page landing-container" id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
