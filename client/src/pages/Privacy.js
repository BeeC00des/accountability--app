import React from 'react';
import PublicShell from '../components/PublicShell';

const UPDATED = '2026-11-15';

const SECTIONS = [
  ['What we collect', [
    'Account details: your name, email address, password (stored only as a secure hash), timezone and reminder time.',
    'Profile details you choose to add: a photo and a short bio.',
    'What you create: goals, steps, check-ins (including moods and private notes), vision boards and the images you add to them.',
    'Social activity: friends, friend requests, nudges, cheers, challenges and leaderboard points.',
    'Support requests and feedback you send us, including an email address if you give one.'
  ]],
  ['How we use it', [
    'To run the app: save your progress, calculate streaks and points, and send the daily reminders you ask for.',
    'To connect you with friends you add — they see your name, photo, streak and the goals you choose to share. Private notes are never shared.',
    'To respond to your support requests and feedback.',
    'We don’t sell your data and we don’t show ads.'
  ]],
  ['Services we rely on', [
    'Your data is stored in our database provider (MongoDB Atlas).',
    'When you add inspiration from Pinterest, our server fetches the public pin or board on your behalf. Pinterest images are shown from Pinterest’s image servers.',
    'Fonts and icons are loaded from Google Fonts, which may receive your IP address.'
  ]],
  ['Storage in your browser', [
    'Essential: a sign-in token so you stay logged in.',
    'Preferences (optional): light/dark mode, theme colour, sidebar layout and dismissed tips. You can turn these off any time in Consent Preferences in the footer.',
    'We don’t use advertising or third-party tracking cookies.'
  ]],
  ['Your choices', [
    'You can edit your profile, change your email or password, and delete goals and board items at any time.',
    'To request a copy of your data or to delete your account, send us a message through Share feedback and we’ll take care of it.'
  ]],
  ['Children', [
    'accounTable isn’t intended for children under 13.'
  ]]
];

export default function Privacy() {
  return (
    <PublicShell title="Privacy Policy">
      <p className="landing-eyebrow">Privacy Policy</p>
      <h1 className="landing-h2">Your data, <span className="italic-accent">plainly explained</span>.</h1>
      <p className="landing-lead">Last updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(`${UPDATED}T12:00:00`))}.</p>
      <div className="legal">
        {SECTIONS.map(([heading, points]) => (
          <section key={heading} className="legal-section">
            <h2 className="title-large">{heading}</h2>
            <ul>{points.map(point => <li key={point} className="body-medium">{point}</li>)}</ul>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
