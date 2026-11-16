import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Avatar, Icon } from '../components/ui';
import SiteFooter from '../components/SiteFooter';
import './Landing.css';

/*
 * Public landing page.
 * Header: floating pill navigation. Body: calm pastel cards and phone previews.
 * Story: picture the year → plan it → show up daily → bring friends → get help.
 * Section titles use two colours: the closing phrase takes the theme colour.
 * Copy is in British English.
 */

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#compete', label: 'Compete' }
];

/** Two-colour title: `lead` in the label colour, `accent` in the theme colour, optional marker underline. */
const Title = ({ as: Tag = 'h2', id, lead, accent, tail = '', className = 'lt-h2', underline = false }) => (
  <Tag id={id} className={className}>
    {lead}{' '}
    <span className={`lt-accent${underline ? ' lt-swoosh' : ''}`}>
      {accent}
      {underline && <svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path d="M3 10 C 50 3, 120 2, 197 7" /></svg>}
    </span>
    {tail}
  </Tag>
);

const Eyebrow = ({ children }) => <p className="lt-eyebrow">{children}</p>;

const STORY = [
  { id: 'imagine', tab: 'Picture it', icon: 'auto_awesome', tone: 'pink', title: 'See the year before you live it', text: 'Choose a year, a half or a quarter, then fill a board with the words and pictures of the life you’re working towards.' },
  { id: 'inspire', tab: 'Get inspired', icon: 'photo_library', tone: 'lavender', title: 'Borrow ideas from anywhere', text: 'Browse hand-picked Pinterest boards, paste a pin you’ve saved or upload your own photos. Print it for the wall or set it as your wallpaper.' },
  { id: 'act', tab: 'Act on it', icon: 'bolt', tone: 'accent', title: 'Big goals, small steps', text: 'Turn any picture into a goal and break it into steps small enough to do today. Finish one and the day counts towards your streak.' }
];

const FEATURES_LEFT = [
  { icon: 'auto_awesome_mosaic', title: 'Vision boards', text: 'One board for the year, a half or a quarter, with your words, photos and pins in one place.' },
  { icon: 'print', title: 'Print & wallpaper', text: 'Download a 300 dpi A4 print, a 4K desktop wallpaper or a lock screen for your phone.' },
  { icon: 'flag', title: 'Goals & steps', text: 'Daily or weekly goals with check-ins, moods, private notes and bite-sized steps.' }
];
const FEATURES_RIGHT = [
  { icon: 'local_fire_department', title: 'Streaks that stick', text: 'Finish one step or check in once, and the day counts. Miss a day and the counter starts again.' },
  { icon: 'group', title: 'Friends who nudge', text: 'Share goals, send a nudge or a cheer, and see who has shown up today.' },
  { icon: 'palette', title: 'Make it yours', text: 'Light and dark mode plus theme colours, so the app feels like your own space.' }
];

// Illustrative examples of who the app is for. These are not customer reviews.
const PEOPLE = [
  { name: 'Ada Runner', role: 'The runner', text: 'Ada is training for her first 10 km. A finish-line photo sits on her board, three runs a week are her steps, and her sister gets a nudge whenever she skips one.', spot: 'p1' },
  { name: 'Kemi Saver', role: 'The saver', text: 'Kemi is saving for Lisbon. She checks in every payday, her streak keeps her honest, and a friendly challenge with a colleague keeps it fun.', spot: 'p2' },
  { name: 'Tunde Reader', role: 'The reader', text: 'Tunde wants to read 24 books this year. Twenty pages a day is his step, and his friends can see when he’s checked in.', spot: 'p3' },
  { name: 'Zara Founder', role: 'The founder', text: 'Zara keeps a quarter board for her start-up and books a mentor through Community whenever the plan stalls.', spot: 'p4' },
  { name: 'Musa Mover', role: 'The mover', text: 'Musa made a half-year board for his move abroad. Small weekly steps turn a daunting list into something he can actually do.', spot: 'p5' },
  { name: 'Lola Calm', role: 'The calm seeker', text: 'Lola’s board is all words: “Rest, slow mornings, no phone at dinner.” A daily check-in with a mood keeps her gentle with herself.', spot: 'p6' }
];

const LEADERS = [
  { name: 'Amara', xp: 185, streak: 12, me: false },
  { name: 'You', xp: 160, streak: 9, me: true },
  { name: 'Tunde', xp: 120, streak: 5, me: false }
];

const FAQ = [
  { q: 'Is Accountable free?', a: 'Yes. Vision boards, goals, streaks, friends and challenges are all free.' },
  { q: 'Do I need a Pinterest account?', a: 'No. Browse the featured gallery, paste any public pin link or upload your own pictures. If you do use Pinterest, you can add your own public boards too.' },
  { q: 'How do streaks work?', a: 'Finish at least one step or one check-in on a given day and that day counts. Your streak is the number of days in a row you’ve shown up.' },
  { q: 'Can I print my vision board or use it as a wallpaper?', a: 'Yes. Download a 300 dpi A4 print, a 4K desktop wallpaper, or a lock screen for your phone or tablet in one tap.' },
  { q: 'How does a challenge with a friend work?', a: 'Pick a friend, a start date and a length of up to 30 days. Whoever earns more XP from steps and check-ins in that time wins, and the reward is whatever you agree on.' },
  { q: 'Can I get help from a mentor, coach or therapist?', a: 'Yes. Tell us what you need in Community and we’ll help you find the right person. Members who invite friends can also earn a sponsored subscription.' }
];

/** A simple phone frame used for the product previews. */
function Phone({ children, className = '', dark = false }) {
  return (
    <div className={`lt-phone${dark ? ' dark' : ''} ${className}`}>
      <div className="lt-phone-screen">
        <div className="lt-phone-status"><span>9:41</span><span className="lt-island" /><span className="lt-phone-icons"><Icon name="signal_cellular_alt" /><Icon name="battery_full" /></span></div>
        {children}
      </div>
    </div>
  );
}

const PhoneAppBar = () => (
  <div className="lt-appbar">
    <span className="lt-appbar-brand"><span className="lt-ring" />accountable</span>
    <Icon name="notifications" />
  </div>
);

const PhoneDock = () => (
  <div className="lt-dock"><span className="lt-dock-add"><Icon name="add" /></span><span className="lt-dock-me"><Icon name="person" /></span></div>
);

/** Decorative zig-zag drawn behind the story cards. */
const Zigzag = () => (
  <svg className="lt-zigzag" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"><path d="M40 300 L120 20 L170 220 L260 -10" /></svg>
);

function StoryPreview({ id, year }) {
  if (id === 'imagine') {
    return (
      <div className="lt-mini">
        <div className="lt-mini-head"><strong>My {year} vision</strong><span className="lt-select">Full year<Icon name="expand_more" /></span></div>
        <div className="lt-words">
          {['Strong', 'Calm', 'Consistent', 'Brave'].map(word => <span key={word}>{word}</span>)}
        </div>
        <div className="lt-mini-periods">{['Year', 'H1', 'H2', 'Q1'].map((period, index) => <span key={period} className={index === 0 ? 'on' : ''}>{period}</span>)}</div>
      </div>
    );
  }
  if (id === 'inspire') {
    return (
      <div className="lt-mini">
        <div className="lt-mini-tabs"><span className="on">Gallery</span><span>Paste a pin</span><span>Upload</span></div>
        <div className="lt-pins">
          {[['🏝️', 'tile-blue'], ['📚', 'tile-pink'], ['🧘', 'tile-green'], ['🏃', 'tile-yellow'], ['🏡', 'tile-purple'], ['✈️', 'tile-teal']].map(([emoji, tile], index) => (
            <span key={emoji} className={`tile ${tile}${index === 1 ? ' picked' : ''}`}>{emoji}{index === 1 && <Icon name="check" />}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="lt-mini">
      <div className="lt-metric">
        <span className="lt-metric-label">Today’s steps<small>Run a 10 km race</small></span>
        <Icon name="local_fire_department" filled />
        <strong>3/4<small>done</small></strong>
      </div>
      <div className="lt-bars" aria-hidden="true">
        {[40, 65, 50, 80, 70, 95, 75].map((height, index) => <span key={index} style={{ height: `${height}%` }} className={index === 5 ? 'peak' : ''} />)}
      </div>
      <div className="lt-bars-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}</div>
    </div>
  );
}

export default function Landing() {
  const { mode, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [story, setStory] = useState(0);
  const [person, setPerson] = useState(0);
  const tabRefs = useRef([]);
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

  // Arrow keys move between story tabs (WAI-ARIA tabs pattern).
  const onTabKey = event => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = (story + delta + STORY.length) % STORY.length;
    setStory(next);
    tabRefs.current[next]?.focus();
  };

  const featureCard = feature => (
    <li key={feature.title} className="lt-feature">
      <span className="lt-feature-icon"><Icon name={feature.icon} /></span>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
    </li>
  );

  return (
    <div className="landing lt">
      <a className="skip-link" href="#landing-main">Skip to content</a>

      {/* Floating pill navigation */}
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
            <button type="button" className="round-btn state-layer" onClick={toggleTheme} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />
            </button>
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
        <section className="lt-hero" id="top" aria-labelledby="hero-heading">
          <div className="landing-container lt-hero-grid">
            <div className="lt-hero-copy">
              <p className="lt-badge"><span className="lt-badge-dots" aria-hidden="true"><span /><span /><span /></span>Vision boards · Daily steps · Friends</p>
              <Title as="h1" id="hero-heading" className="lt-display" lead="Make this the year your goals" accent="stick." />
              <p className="lt-lead">Picture the life you want, break it into small daily steps, and bring your friends along to keep you honest. Progress comes easier when someone’s cheering you on.</p>
              <div className="lt-actions">
                <Link to="/auth?mode=register" className="lt-btn lt-btn-ink"><Icon name="auto_awesome_mosaic" />Start your {year} board</Link>
                <a href="#how" className="lt-btn lt-btn-ink lt-btn-ghost"><Icon name="play_circle" />See how it works</a>
              </div>
              <ul className="lt-ticks" role="list">
                <li>Free to start</li>
                <li>No card needed</li>
                <li>Works on any device</li>
              </ul>
            </div>

            <div className="lt-hero-visual" aria-hidden="true">
              <span className="lt-orb" />
              <Phone className="lt-hero-phone">
                <PhoneAppBar />
                <div className="lt-card lt-card-lavender lt-card-big">
                  <span className="lt-card-label">Current<br />streak</span>
                  <Icon name="local_fire_department" filled className="lt-card-icon" />
                  <strong className="lt-card-value">9<small>days</small></strong>
                  <span className="lt-status">On track</span>
                  <span className="lt-card-foot">Last check-in · today 07:40</span>
                </div>
                <div className="lt-card">
                  <span className="lt-card-label">Today’s steps</span>
                  <Icon name="checklist" className="lt-card-icon" />
                  <strong className="lt-card-value">3/4</strong>
                  <span className="lt-status">Nearly there</span>
                </div>
                <div className="lt-card">
                  <span className="lt-card-label">{year} board</span>
                  <Icon name="auto_awesome_mosaic" className="lt-card-icon" />
                  <strong className="lt-card-value">12<small>pins</small></strong>
                  <span className="lt-status">Printed</span>
                </div>
                <PhoneDock />
              </Phone>
            </div>
          </div>
        </section>

        {/* ---------- How it works: tabbed story carousel ---------- */}
        <section className="lt-section lt-story" id="how" aria-labelledby="how-heading">
          <div className="landing-container lt-center">
            <Eyebrow>How it works</Eyebrow>
            <Title id="how-heading" lead="From a picture to a" accent="plan" tail=" in minutes." underline />
            <p className="lt-sub">No blank pages and no complicated set-up. Three calm steps, starting today.</p>
            <div className="lt-tabs" role="tablist" aria-label="How it works">
              {STORY.map((item, index) => (
                <button
                  key={item.id}
                  ref={element => { tabRefs.current[index] = element; }}
                  type="button"
                  role="tab"
                  id={`story-tab-${item.id}`}
                  aria-selected={story === index}
                  aria-controls={`story-panel-${item.id}`}
                  tabIndex={story === index ? 0 : -1}
                  className="lt-tab"
                  onClick={() => setStory(index)}
                  onKeyDown={onTabKey}
                >
                  <Icon name={item.icon} />{item.tab}
                </button>
              ))}
            </div>
          </div>
          <div className="lt-carousel">
            <div className="lt-track" style={{ '--index': story }}>
              {STORY.map((item, index) => (
                <article
                  key={item.id}
                  id={`story-panel-${item.id}`}
                  role="tabpanel"
                  aria-labelledby={`story-tab-${item.id}`}
                  aria-hidden={story !== index}
                  className={`lt-slide lt-tone-${item.tone}${story === index ? ' active' : ''}`}
                >
                  <Zigzag />
                  <div className="lt-slide-copy">
                    <span className="lt-step-num">0{index + 1}</span>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                  <StoryPreview id={item.id} year={year} />
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features around a phone ---------- */}
        <section className="lt-section lt-features-section" id="features" aria-labelledby="features-heading">
          <div className="landing-container">
            <div className="lt-center">
              <Eyebrow>Features</Eyebrow>
              <Title id="features-heading" lead="Everything you need to" accent="show up" tail=" every day." underline />
            </div>
            <div className="lt-features">
              <ul className="lt-feature-list" role="list">{FEATURES_LEFT.map(featureCard)}</ul>
              <div className="lt-features-phone" aria-hidden="true">
                <Phone dark>
                  <div className="lt-checkin">
                    <span className="lt-close"><Icon name="close" /></span>
                    <strong>Check-in</strong>
                    <span className="lt-progress"><span /></span>
                    <span className="lt-caps">How did today go?</span>
                    <span className="lt-wave" />
                    <span className="lt-moods">{['😞', '😐', '🙂', '😄', '🤩'].map((mood, index) => <span key={mood} className={index === 3 ? 'on' : ''}>{mood}</span>)}</span>
                    <span className="lt-note"><Icon name="info" />Every check-in keeps your streak alive</span>
                  </div>
                </Phone>
              </div>
              <ul className="lt-feature-list" role="list">{FEATURES_RIGHT.map(featureCard)}</ul>
            </div>
          </div>
        </section>

        {/* ---------- Who it's for (illustrative examples, not reviews) ---------- */}
        <section className="lt-section lt-people" aria-labelledby="people-heading">
          <div className="landing-container lt-center">
            <Eyebrow>Built for</Eyebrow>
            <Title id="people-heading" lead="Every kind of" accent="goal." />
            <p className="lt-sub">A few examples of how people use Accountable. Tap a face to read their story.</p>
          </div>
          <div className="landing-container lt-people-stage">
            <div className="lt-people-picks" role="group" aria-label="Choose an example">
              {PEOPLE.map((item, index) => (
                <button key={item.name} type="button" className={`lt-person ${item.spot}${person === index ? ' on' : ''}`} onClick={() => setPerson(index)} aria-pressed={person === index} aria-label={item.role} title={item.role}>
                  <Avatar name={item.name} />
                </button>
              ))}
            </div>
            <figure className="lt-quote" aria-live="polite">
              <div className="lt-quote-art"><Avatar name={PEOPLE[person].name} /></div>
              <figcaption className="lt-quote-body">
                <span className="lt-caps">Example · {PEOPLE[person].role}</span>
                <p>{PEOPLE[person].text}</p>
              </figcaption>
              <span className="lt-quote-mark" aria-hidden="true">”</span>
            </figure>
          </div>
        </section>

        {/* ---------- Compete ---------- */}
        <section className="lt-section" id="compete" aria-labelledby="compete-heading">
          <div className="landing-container">
            <div className="lt-slide lt-tone-lavender lt-compete">
              <Zigzag />
              <div className="lt-slide-copy">
                <Eyebrow>Friends &amp; challenges</Eyebrow>
                <Title id="compete-heading" lead="A little rivalry" accent="goes a long way." />
                <p>Share goals with friends, send a nudge or a cheer, and climb the weekly leaderboard. Book a friend for a challenge of up to 30 days. Whoever shows up most wins, and the loser buys the coffee.</p>
                <ul className="lt-checks" role="list">
                  <li><Icon name="leaderboard" />Weekly, monthly and all-time XP</li>
                  <li><Icon name="event_available" />Book a challenge up to 30 days ahead</li>
                  <li><Icon name="redeem" />Rewards you agree on together</li>
                </ul>
                <Link to="/auth?mode=register" className="lt-btn lt-btn-ink">Challenge a friend<Icon name="arrow_forward" /></Link>
              </div>
              <div className="lt-mini lt-leaders" aria-hidden="true">
                <div className="lt-mini-tabs"><span className="on">This week</span><span>Month</span><span>All time</span></div>
                {LEADERS.map((item, index) => (
                  <div key={item.name} className={`lt-leader${item.me ? ' me' : ''}`}>
                    <span>{['🥇', '🥈', '🥉'][index]}</span>
                    <span className="lt-leader-name">{item.name}</span>
                    <span className="lt-leader-streak">🔥 {item.streak}</span>
                    <strong>{item.xp} XP</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="lt-section lt-faq-section" aria-labelledby="faq-heading">
          <div className="landing-container lt-faq-grid">
            <div>
              <div className="lt-center">
                <Eyebrow>Questions</Eyebrow>
                <Title id="faq-heading" lead="Good to" accent="know." />
              </div>
              <div className="lt-faq">
                {FAQ.map(item => (
                  <details key={item.q} className="lt-faq-item">
                    <summary>{item.q}<Icon name="add" /></summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
