import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { to: '/goals', label: 'My Goals', icon: '🎯' },
  { to: '/friends', label: 'Friends', icon: '👥' },
  { to: '/reminders', label: 'Reminders', icon: '🔔' },
  { to: '/profile', label: 'Profile', icon: '⚙' },
];

export default function Layout() {
  
  const { user, logout } = useAuth();

  const [unread, setUnread] = useState(0);

  const navigate = useNavigate();

  // The reminder is not working and the count discover why ?
  useEffect(() => {

    API.get('/reminders/unread-count')
    .then(r => setUnread(r.data.count)).catch(() => {});

    const interval = setInterval(() => {
      API.get('/reminders/unread-count').then(r => setUnread(r.data.count)).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);

  }, []);

  const handleLogout = () => { 
    logout(); 
    navigate('/auth');
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🔥 Doers Team'26</h1>
          <p> Let's stay consistent together</p>
        </div>

        <nav className="nav-links">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={ ({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span>{icon}</span>
              <span>{label}</span>
              
              {to === '/reminders' && unread > 0 && (
                <span className="badge">{unread > 9 ? '9+' : unread}</span>
              )}

            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              
              <div className="streak">🔥 {user ?.streak || 0} day streak</div>
              
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ setUnread }} />
      </main>
    </div>
  );
}
