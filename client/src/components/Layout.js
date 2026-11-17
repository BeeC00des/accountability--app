import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { ACCENT_PRESETS, accentHex, useTheme } from '../context/ThemeContext';
import { Avatar, Icon, Menu } from './ui';
import AccentDialog from './AccentDialog';
import ReminderAlarm from './ReminderAlarm';
import StreakDialog from './StreakDialog';
import { savePreference } from '../lib/consent';

// Board is the home page. `tab` marks the items shown in the phone tab bar (Inbox lives in the top bar).
const NAV = [
  { to: '/board', label: 'Board', icon: 'auto_awesome_mosaic', tab: true },
  { to: '/today', label: 'Today', icon: 'today', tab: true },
  { to: '/goals', label: 'Goals', icon: 'flag', tab: true },
  { to: '/friends', label: 'Friends', icon: 'group', tab: true },
  { to: '/challenge', label: 'Challenge', icon: 'emoji_events', tab: true },
  { to: '/inbox', label: 'Inbox', icon: 'notifications' },
  { to: '/community', label: 'Community', icon: 'diversity_1', tab: true, premium: true }
];
const SIDEBAR_KEY = 'accountable-sidebar-collapsed';
const readCollapsed = () => { try { return window.localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; } };

export default function Layout() {
  const { user, logout } = useAuth();
  const { unread, streakOpen, setStreakOpen } = useApp();
  const { mode, toggleTheme, accent } = useTheme();
  const accentLabel = ACCENT_PRESETS.find(preset => preset.value === accent)?.label || accentHex(accent).toUpperCase();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [accentOpen, setAccentOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isPremium = user?.plan === 'premium';

  // Move focus to the page on navigation so screen readers announce the new view.
  useEffect(() => { document.getElementById('main-content')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [location.pathname]);

  const toggleSidebar = () => setCollapsed(value => {
    savePreference(SIDEBAR_KEY, value ? '0' : '1');
    return !value;
  });
  const signOut = () => { logout(); navigate('/auth'); };
  const unreadLabel = unread > 99 ? '99+' : unread;
  const streak = user?.streak || 0;
  const streakTitle = user?.streakToday
    ? `${streak}-day streak — extended today 🔥`
    : streak ? `${streak}-day streak — finish a step or check in today to keep it` : 'Finish a step or check in to start a streak';

  return (
    <div className={`app-shell${collapsed ? ' sidebar-is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>

      {/* Desktop / tablet: sidebar — collapsible to icons only */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Primary">
        <div className="sidebar-top">
          <Link to="/board" className="sidebar-brand" aria-label="doerstab home" title={collapsed ? 'doerstab' : undefined}>
            <span className="brand-mark" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
            <span className="title-medium sidebar-label">doerstab</span>
          </Link>
          <button type="button" className="icon-btn state-layer sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} />
          </button>
        </div>
        <button type="button" className="btn btn-filled state-layer sidebar-cta" onClick={() => navigate('/board?new=1')} aria-label="Add vision board" title={collapsed ? 'Add vision board' : undefined}>
          <Icon name="add" /><span className="sidebar-label">Add vision board</span>
        </button>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon, premium }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item state-layer${isActive ? ' active' : ''}`} aria-label={collapsed ? (to === '/inbox' && unread > 0 ? `${label}, ${unread} unread` : label) : undefined} title={collapsed ? label : undefined}>
              {({ isActive }) => (
                <>
                  <span className="sidebar-icon">
                    <Icon name={icon} filled={isActive} />
                    {to === '/inbox' && unread > 0 && collapsed && <span className="badge badge-dot sidebar-dot" aria-hidden="true" />}
                  </span>
                  <span className="sidebar-label">{label}</span>
                  {to === '/inbox' && unread > 0 && !collapsed && <span className="badge" aria-label={`${unread} unread`}>{unreadLabel}</span>}
                  {premium && !collapsed && <span className="premium-tag" aria-label={isPremium ? 'Premium' : 'Premium feature'}>{isPremium ? <Icon name="workspace_premium" filled /> : <Icon name="lock" />}Premium</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-item state-layer sidebar-theme" onClick={() => setAccentOpen(true)} aria-label={`Theme color: ${accentLabel}`} title={collapsed ? `Theme color · ${accentLabel}` : undefined}>
            <span className="sidebar-icon"><Icon name="palette" /></span>
            <span className="sidebar-label">Theme color</span>
            <span className="sidebar-swatch" style={{ background: accentHex(accent) }} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="app-body">
        <header className="top-bar">
          <Link to="/board" className="top-bar-brand" aria-label="doerstab home">
            <span className="brand-mark" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
          </Link>
          <span className="top-bar-spacer" />
          <button type="button" className={`round-btn state-layer streak-pill${user?.streakToday ? ' lit' : ''}`} onClick={() => setStreakOpen(true)} aria-label={streakTitle} title={streakTitle} aria-haspopup="dialog">
            <Icon name="local_fire_department" filled /><span className="round-btn-count">{streak}</span>
          </button>
          <Link to="/inbox" className="round-btn state-layer bell-btn" aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'} title="Inbox">
            <Icon name="notifications" />
            {unread > 0 && <span className="badge bell-badge" aria-hidden="true">{unreadLabel}</span>}
          </Link>
          <button type="button" className="round-btn state-layer" onClick={toggleTheme} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />
          </button>
          {/* Phones and tablets have no sidebar, so the theme colour sits beside light/dark mode. */}
          <button type="button" className="round-btn state-layer top-bar-accent" onClick={() => setAccentOpen(true)} aria-label={`Theme color: ${accentLabel}`} title="Theme color">
            <Icon name="palette" /><span className="top-bar-swatch" style={{ background: accentHex(accent) }} aria-hidden="true" />
          </button>
          <div className="top-bar-profile">
            <Menu
              label={`Account menu for ${user?.name || 'you'}`}
              trigger={<Avatar self name={user?.name} src={user?.avatar} />}
              items={[
                {
                  header: (
                    <>
                      <Avatar self name={user?.name} src={user?.avatar} />
                      <span className="list-item-content">
                        <span className="title-small">{user?.name}</span>
                        <span className="body-small text-variant">{user?.email}</span>
                      </span>
                    </>
                  )
                },
                { divider: true },
                { label: 'View profile', icon: 'person', onSelect: () => navigate('/profile') },
                { label: 'Edit profile', icon: 'edit', onSelect: () => navigate('/profile?edit=1') },
                { label: 'Reminder settings', icon: 'schedule', onSelect: () => navigate('/profile#settings') },
                { divider: true },
                { label: 'Sign out', icon: 'logout', danger: true, onSelect: signOut }
              ]}
            />
          </div>
        </header>

        <main className="main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {/* Phone: floating tab bar */}
      <nav className="tab-bar" aria-label="Primary">
        {NAV.filter(item => item.tab).map(({ to, label, icon, premium }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `tab-bar-item state-layer${isActive ? ' active' : ''}`} aria-label={premium && !isPremium ? `${label} (Premium)` : label} title={label}>
            {({ isActive }) => <>
              <Icon name={icon} filled={isActive} />
              {premium && !isPremium && <span className="tab-lock" aria-hidden="true"><Icon name="lock" filled /></span>}
            </>}
          </NavLink>
        ))}
      </nav>

      {accentOpen && <AccentDialog onClose={() => setAccentOpen(false)} />}
      <ReminderAlarm />
      {streakOpen && <StreakDialog onClose={() => setStreakOpen(false)} />}
    </div>
  );
}
