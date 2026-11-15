import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Icon } from '../components/ui';
import SiteFooter from '../components/SiteFooter';
import './Landing.css';

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#compete', label: 'Compete' }
];

const STEPS = [
  { icon: 'auto_awesome', title: 'Imagine', text: 'Pick your season — a year, a half or a quarter — and write the words you want to live by.' },
  { icon: 'photo_library', title: 'Get inspired', text: 'Collect pins from Pinterest into a vision board you can print or set as your wallpaper.' },
  { icon: 'bolt', title: 'Act', text: 'Turn any pin into a goal with small daily steps. Every step keeps your streak alive.' }
];

const FEATURES = [
  { icon: 'auto_awesome_mosaic', tile: 'tile-lime', title: 'Vision boards', text: 'One board per year, half or quarter. Words, uploads and Pinterest pins in one place.' },
  { icon: 'photo_library', tile: 'tile-pink', title: 'Pinterest gallery', text: 'Browse featured boards or your own Pinterest, tap the pins that feel like your future.' },
  { icon: 'print', tile: 'tile-blue', title: 'Print & wallpaper', text: 'Download a 300 dpi A4 print or a 4K, iPhone and iPad wallpaper in one tap.' },
  { icon: 'flag', tile: 'tile-green', title: 'Goals & steps', text: 'Daily or weekly goals with check-ins, moods, private notes and bite-sized steps.' },
  { icon: 'local_fire_department', tile: 'tile-yellow', title: 'Streaks that stick', text: 'Finish one step or one check-in and your day counts — Duolingo-style.' },
  { icon: 'group', tile: 'tile-purple', title: 'Friends who nudge', text: 'Share goals, send nudges and cheers, and see who’s checked in today.' },
  { icon: 'diversity_1', tile: 'tile-teal', title: 'Community support', text: 'Stuck? Ask for a mentor, coach, counsellor or therapist — we’ll help you find one.' },
  { icon: 'palette', tile: 'tile-lime', title: 'Your colors', text: 'Light and dark mode plus white-label theme colors to make the dashboard yours.' }
];

const BOARD_TILES = [
  { kind: 'words', text: 'Strong, calm & consistent', className: 'w-ink' },
  { kind: 'image', emoji: '🏝️', className: 'tile-blue' },
  { kind: 'words', text: 'Run a 10k', className: 'w-lime' },
  { kind: 'image', emoji: '📚', className: 'tile-pink' },
  { kind: 'image', emoji: '🧘', className: 'tile-green' },
  { kind: 'words', text: 'Save for Lisbon ✈️', className: 'w-yellow' }
];

const LEADERS = [
  { name: 'Amara', xp: 185, streak: 12, me: false },
  { name: 'You', xp: 160, streak: 9, me: true },
  { name: 'Tunde', xp: 120, streak: 5, me: false }
];

export default function Landing() {
  const { mode, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear() + 1;

  useEffect(() => {
    const previous = document.title;
    document.title = 'Accountable — Imagine your future, get inspired and act';
    return () => { document.title = previous; };
  }, []);

  // The ☰ menu is for small screens only: close it if the window grows to desktop width.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const onChange = event => { if (event.matches) setMenuOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  // Close the phone menu on Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = event => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const themeButton = (
    <button type="button" className="round-btn state-layer" onClick={toggleTheme} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
      <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />
    </button>
  );

  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">Skip to content</a>

      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <a href="#top" className="landing-brand" aria-label="Accountable home">
            <span className="brand-mark" aria-hidden="true"><Icon name="local_fire_department" filled /></span>
            <span className="title-medium">Accountable</span>
          </a>
          <nav className="landing-nav" aria-label="Main">
            {NAV.map(item => <a key={item.href} href={item.href} className="landing-nav-link">{item.label}</a>)}
          </nav>
          <div className="landing-actions">
            {themeButton}
            <Link to="/auth" className="btn btn-text state-layer landing-signin">Sign in</Link>
            <Link to="/auth?mode=register" className="btn btn-filled state-layer landing-cta">Get started</Link>
            <button type="button" className="round-btn state-layer landing-menu-btn" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="landing-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="landing-menu" className="landing-menu" aria-label="Main">
            {NAV.map(item => <a key={item.href} href={item.href} className="landing-menu-link" onClick={() => setMenuOpen(false)}>{item.label}<Icon name="chevron_right" /></a>)}
            <Link to="/auth" className="btn btn-outlined state-layer btn-block">Sign in</Link>
            <Link to="/auth?mode=register" className="btn btn-filled state-layer btn-block">Get started — it’s free</Link>
          </nav>
        )}
      </header>

      <main id="landing-main" tabIndex={-1}>
        {/* ---------- Hero ---------- */}
        <section className="landing-hero" id="top" aria-labelledby="hero-heading">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-pill"><Icon name="auto_awesome" filled />Vision boards · Goals · Streaks · Friends</span>
              <h1 id="hero-heading" className="landing-title">
                Imagine your future<span className="italic-accent">,</span><br />
                <span className="italic-accent">get inspired</span> and act.
              </h1>
              <p className="landing-lead">Build a vision board from Pinterest, turn it into daily steps, and keep each other going with friends — one small step at a time.</p>
              <div className="landing-hero-actions">
                <Link to="/auth?mode=register" className="btn btn-filled state-layer landing-big-btn">Start your {year} board<Icon name="arrow_forward" /></Link>
                <a href="#how" className="btn btn-outlined state-layer landing-big-btn">See how it works</a>
              </div>
              <ul className="landing-proof" role="list">
                <li><Icon name="check_circle" filled />Free to start</li>
                <li><Icon name="check_circle" filled />Works on phone & desktop</li>
                <li><Icon name="check_circle" filled />Light & dark mode</li>
              </ul>
            </div>

            {/* Product preview: a board in a browser window + a phone with today's plan */}
            <div className="landing-preview" aria-hidden="true">
              <div className="preview-window">
                <div className="preview-window-bar"><span /><span /><span /></div>
                <div className="preview-board">
                  <div className="preview-board-head">
                    <strong>My {year} vision</strong>
                    <span className="italic-accent">January – December {year}</span>
                  </div>
                  <div className="preview-board-grid">
                    {BOARD_TILES.map((tile, index) => (
                      <div key={index} className={`preview-tile ${tile.kind === 'image' ? `tile ${tile.className}` : tile.className}`}>
                        {tile.kind === 'image' ? <span className="preview-emoji">{tile.emoji}</span> : tile.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="preview-phone">
                <div className="preview-phone-notch" />
                <div className="preview-phone-hero">
                  <span className="preview-streak"><Icon name="local_fire_department" filled />9</span>
                  <strong>Ada, <span className="italic-accent">one small step</span> at a time.</strong>
                </div>
                <p className="preview-phone-label">Your plan for today</p>
                {[['📚', 'Read 20 pages', true, 'tile-blue'], ['🏃', 'Morning run', true, 'tile-green'], ['💧', 'Drink 2L water', false, 'tile-pink']].map(([emoji, title, done, tile]) => (
                  <div key={title} className="preview-plan">
                    <span className={`tile ${tile}`}>{emoji}</span>
                    <span className="preview-plan-title">{title}</span>
                    <span className={`check-btn${done ? ' done' : ''}`}><Icon name="check" /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing-section" id="how" aria-labelledby="how-heading">
          <div className="landing-container">
            <p className="landing-eyebrow">How it works</p>
            <h2 id="how-heading" className="landing-h2">Three steps from <span className="italic-accent">dream</span> to <span className="italic-accent">done</span>.</h2>
            <ol className="landing-steps" role="list">
              {STEPS.map((step, index) => (
                <li key={step.title} className="landing-step">
                  <span className="landing-step-num">{index + 1}</span>
                  <span className="landing-step-icon"><Icon name={step.icon} filled /></span>
                  <h3 className="title-large">{step.title}</h3>
                  <p className="body-medium text-variant">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="landing-section landing-section-alt" id="features" aria-labelledby="features-heading">
          <div className="landing-container">
            <p className="landing-eyebrow">Features</p>
            <h2 id="features-heading" className="landing-h2">Everything you need to <span className="italic-accent">show up</span>.</h2>
            <ul className="landing-features" role="list">
              {FEATURES.map(feature => (
                <li key={feature.title} className="landing-feature">
                  <span className={`tile ${feature.tile}`}><Icon name={feature.icon} filled /></span>
                  <h3 className="title-medium">{feature.title}</h3>
                  <p className="body-medium text-variant">{feature.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Compete ---------- */}
        <section className="landing-section" id="compete" aria-labelledby="compete-heading">
          <div className="landing-container landing-split">
            <div>
              <p className="landing-eyebrow">Compete</p>
              <h2 id="compete-heading" className="landing-h2">Up for <span className="italic-accent">a challenge?</span></h2>
              <p className="landing-lead">Climb a friendly leaderboard and book a friend for a few days of healthy competition. Whoever shows up most, wins.</p>
              <ul className="landing-list" role="list">
                <li><Icon name="leaderboard" />Weekly, monthly and all-time XP among friends</li>
                <li><Icon name="event_available" />Book a challenge up to 30 days ahead</li>
                <li><Icon name="redeem" />Kind rewards — “loser cooks a healthy dinner”</li>
                <li><Icon name="favorite" />Built to reward consistency, not intensity</li>
              </ul>
              <Link to="/auth?mode=register" className="btn btn-filled state-layer landing-big-btn">Challenge a friend<Icon name="arrow_forward" /></Link>
            </div>

            <div className="landing-compete-visual" aria-hidden="true">
              <div className="card preview-leaderboard">
                <div className="preview-card-head"><Icon name="emoji_events" filled /><strong>This week</strong></div>
                {LEADERS.map((person, index) => (
                  <div key={person.name} className={`preview-leader${person.me ? ' me' : ''}`}>
                    <span className="preview-rank">{['🥇', '🥈', '🥉'][index]}</span>
                    <span className="preview-leader-name">{person.name}</span>
                    <span className="preview-leader-streak">🔥 {person.streak}</span>
                    <strong>{person.xp} XP</strong>
                  </div>
                ))}
              </div>
              <div className="card preview-duel">
                <div className="preview-card-head"><Icon name="sports_score" filled /><strong>7-day consistency duel</strong><span className="tag tag-success">3 days left</span></div>
                {[['You', 72, true], ['Tunde', 48, false]].map(([name, width, mine]) => (
                  <div key={name} className="preview-duel-row">
                    <span>{name}</span>
                    <span className="duel-track"><span className={`duel-fill${mine ? ' mine' : ''}`} style={{ width: `${width}%` }} /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Community ---------- */}
        <section className="landing-section landing-section-alt" aria-labelledby="community-heading">
          <div className="landing-container landing-community">
            <span className="landing-community-icon"><Icon name="diversity_1" filled /></span>
            <div>
              <h2 id="community-heading" className="landing-h2">Stuck with your <span className="italic-accent">growth plan?</span></h2>
              <p className="landing-lead">Ask for a mentor, coach, counsellor or therapist and we’ll help you find the right person. Members who invite others can earn a sponsored subscription.</p>
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="landing-final" aria-labelledby="final-heading">
          <div className="landing-container landing-final-inner">
            <h2 id="final-heading" className="landing-title landing-final-title">Your {year} starts <span className="italic-accent">with a picture.</span></h2>
            <p className="landing-lead">Create your free account and build your first vision board in minutes.</p>
            <div className="landing-hero-actions">
              <Link to="/auth?mode=register" className="btn btn-filled state-layer landing-big-btn">Get started — it’s free<Icon name="arrow_forward" /></Link>
              <Link to="/auth" className="btn btn-outlined state-layer landing-big-btn">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter onLanding />
    </div>
  );
}
