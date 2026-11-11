import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { to: '/goals', label: 'My goals', icon: '◎' },
  { to: '/friends', label: 'Friends', icon: '♧' },
  { to: '/reminders', label: 'Reminders', icon: '◷' },
  { to: '/profile', label: 'Profile', icon: '⚙' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const refreshUnread = () => API.get('/reminders/unread-count')
      .then(response => { if (mounted) setUnread(response.data.count); })
      .catch(() => {});
    refreshUnread();
    const interval = setInterval(refreshUnread, 60000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const initials = user?.name?.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || '?';
  const renderLinks = () => NAV.map(({ to, label, icon }) => (
    <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {to === '/reminders' && unread > 0 && <span className="badge" aria-label={`${unread} unread reminders`}>{unread > 9 ? '9+' : unread}</span>}
    </NavLink>
  ));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Accountable</h1>
          <p>Small steps. Meaningful progress.</p>
        </div>
        <nav className="nav-links" aria-label="Main navigation">{renderLinks()}</nav>
        <div className="sidebar-footer">
          <div className="profile-summary">
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div className="profile-summary-copy">
              <div className="profile-summary-name">{user?.name}</div>
              <div className="streak">🔥 {user?.streak || 0} day streak</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm sign-out" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main" id="main-content"><Outlet context={{ setUnread }} /></main>
      <nav className="mobile-nav" aria-label="Main navigation">{renderLinks()}</nav>
    </div>
  );
}
