import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui';

const COLORS = ['var(--lime)', '#ff6a1a', '#ffb340', '#4fb3ff', '#ff5fa2', '#111111'];

/** "Congratulations, you achieved your goal" card with a confetti burst, shown on Today. */
export default function GoalCelebration({ goal, name, onDismiss }) {
  // Fixed per goal so re-renders don't reshuffle the confetti.
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, index) => ({
    left: (index * 37) % 100,
    delay: ((index * 53) % 900) / 1000,
    duration: 1.6 + ((index * 29) % 120) / 100,
    rotate: (index * 47) % 360,
    color: COLORS[index % COLORS.length],
    round: index % 3 === 0
  })), []);

  const target = goal.target || goal.completedCheckIns;
  return (
    <section className="goal-celebration" aria-labelledby={`celebrate-${goal._id}`} role="status">
      <div className="confetti" aria-hidden="true">
        {pieces.map((piece, index) => (
          <span
            key={index}
            className={piece.round ? 'round' : ''}
            style={{ left: `${piece.left}%`, background: piece.color, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`, '--r': `${piece.rotate}deg` }}
          />
        ))}
      </div>
      <span className="celebration-trophy" aria-hidden="true">🏆</span>
      <div className="celebration-text">
        <p className="label-medium celebration-kicker">Goal achieved</p>
        <h2 id={`celebrate-${goal._id}`} className="title-large">Congratulations{name ? `, ${name}` : ''}! You achieved your goal.</h2>
        <p className="body-medium">
          <strong>{goal.emoji || '🎯'} {goal.title}</strong> — {goal.completedCheckIns} of {target} {goal.frequency === 'weekly' ? 'weekly ' : ''}check-ins done. You showed up, and it paid off.
        </p>
        <div className="celebration-actions">
          <Link to="/goals?new=1" className="btn btn-filled state-layer"><Icon name="flag" />Set your next goal</Link>
          <button type="button" className="btn btn-text state-layer" onClick={onDismiss}>Done</button>
        </div>
      </div>
      <button type="button" className="icon-btn state-layer celebration-close" onClick={onDismiss} aria-label="Dismiss celebration"><Icon name="close" /></button>
    </section>
  );
}
