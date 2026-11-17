import React from 'react';
import PublicShell from '../components/PublicShell';

const RELEASES = [
  {
    date: '2026-11-15',
    title: 'Board, Compete & Community',
    tag: 'Major',
    items: [
      'Your vision board is now home — imagine your future, get inspired and act.',
      'Inspiration gallery: browse featured Pinterest boards or your own, and add pins in one go.',
      'Compete: weekly, monthly and all-time leaderboards, plus friendly challenges you can book with a friend.',
      'Community: request a mentor, coach, counsellor, therapist or accountability buddy.',
      'Sponsored subscriptions for members who invite three or more people.',
      'Duolingo-style streaks — finishing a single step now keeps your streak alive.',
      'Theme colours: make the dashboard yours with seven presets or any custom colour.',
      'A new landing page, changelog, privacy policy and consent preferences.'
    ]
  },
  {
    date: '2026-11-14',
    title: 'Vision boards & editable profiles',
    tag: 'New',
    items: [
      'Vision boards for a year, a half or a quarter — with Pinterest pins, uploads and words.',
      'Download your board as a 300 dpi A4/Letter print or a 4K, iPhone and iPad wallpaper.',
      'Edit your profile photo, name, bio and email, and change your password.',
      'A collapsible sidebar that shrinks to icons.'
    ]
  },
  {
    date: '2026-11-14',
    title: 'A fresh design',
    tag: 'Design',
    items: [
      'A brand-new look with light and dark mode that follows your device.',
      'Today page with a check-in calendar, monthly progress and your plan for the day.',
      'Bottom sheets, menus and controls that feel at home on phones.'
    ]
  },
  {
    date: '2026-11-14',
    title: 'Goals, friends & reminders rebuilt',
    tag: 'Improved',
    items: [
      'Goals in three steps, with weekly goals, steps you can tick off and accurate streaks in your timezone.',
      'Friend requests you can cancel, shared goals you can cheer, and friendly nudges.',
      'An inbox with filters, read/unread and quick actions; daily reminders at your local time.',
      'Security fixes for goal editing, reminder spam and private stats.'
    ]
  }
];

const formatDay = key => new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${key}T12:00:00`));

export default function Changelog() {
  return (
    <PublicShell title="Changelog">
      <p className="landing-eyebrow">Changelog</p>
      <h1 className="landing-h2">What’s <span className="italic-accent">new</span> in doerstab</h1>
      <ol className="changelog" role="list">
        {RELEASES.map(release => (
          <li key={`${release.date}-${release.title}`} className="changelog-entry">
            <time className="changelog-date body-small" dateTime={release.date}>{formatDay(release.date)}</time>
            <div className="changelog-body">
              <h2 className="title-large">{release.title} <span className="tag tag-primary">{release.tag}</span></h2>
              <ul>{release.items.map(item => <li key={item} className="body-medium">{item}</li>)}</ul>
            </div>
          </li>
        ))}
      </ol>
    </PublicShell>
  );
}
