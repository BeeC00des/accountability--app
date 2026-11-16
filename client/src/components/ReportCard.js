import React, { useCallback, useEffect, useState } from 'react';
import { API } from '../context/AuthContext';
import { apiError, plural } from '../lib/format';
import { Icon, LinearProgress, Spinner } from './ui';

export const REPORT_RANGES = [
  { value: 'week', label: 'Week', previous: 'previous week' },
  { value: 'biweekly', label: '2 weeks', previous: 'previous 2 weeks' },
  { value: 'month', label: 'Month', previous: 'previous 30 days' },
  { value: 'quarter', label: 'Quarter', previous: 'previous quarter' },
  { value: 'half', label: 'Half year', previous: 'previous 6 months' },
  { value: 'year', label: 'Year', previous: 'previous year' }
];
const MOODS = { great: '😄', good: '🙂', okay: '😐', tough: '😣' };
const RANGE_KEY = 'accountable-report-range';
const readRange = () => { try { return window.localStorage.getItem(RANGE_KEY) || 'week'; } catch { return 'week'; } };
const shortDate = key => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function Delta({ now, before, unit = '', previous }) {
  const diff = now - before;
  if (!before && !now) return <span className="report-delta flat">No activity in the {previous}</span>;
  if (diff === 0) return <span className="report-delta flat"><Icon name="trending_flat" size="16" />Same as the {previous}</span>;
  const up = diff > 0;
  return (
    <span className={`report-delta ${up ? 'up' : 'down'}`}>
      <Icon name={up ? 'trending_up' : 'trending_down'} size="16" />
      {up ? '+' : '−'}{Math.abs(diff)}{unit} vs the {previous}
    </span>
  );
}

/** Check-ins per bucket, one series in the theme colour, with a hover tooltip and a table for screen readers. */
function ReportChart({ series, title }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...series.map(item => item.checkins));
  const every = series.length > 20 ? 5 : series.length > 14 ? 2 : 1;
  const ticks = [max, Math.round(max / 2), 0].filter((value, index, all) => all.indexOf(value) === index);
  return (
    <figure className="report-chart">
      <figcaption className="title-small">{title}</figcaption>
      <div className="report-plot" onMouseLeave={() => setHover(null)}>
        <div className="report-axis" aria-hidden="true">{ticks.map(tick => <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>{tick}</span>)}</div>
        <div className="report-bars" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {ticks.filter(tick => tick > 0).map(tick => <span key={tick} className="report-grid" style={{ bottom: `${(tick / max) * 100}%` }} />)}
          {series.map((item, index) => (
            <button
              key={item.from}
              type="button"
              tabIndex={-1}
              className={`report-bar-hit${hover === index ? ' active' : ''}`}
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              onClick={() => setHover(index)}
            >
              <span className="report-bar" style={{ height: item.checkins ? `max(4px, ${(item.checkins / max) * 100}%)` : 0 }} />
              <span className="report-tick">{index % every === 0 || index === series.length - 1 ? item.short : ''}</span>
            </button>
          ))}
          {hover !== null && series[hover] && (
            <div
              className="report-tooltip"
              style={{ left: `${((hover + 0.5) / series.length) * 100}%`, transform: `translateX(${hover / series.length < 0.15 ? '-15%' : hover / series.length > 0.85 ? '-85%' : '-50%'})` }}
              role="status"
            >
              <strong>{series[hover].label}</strong>
              <span>{plural(series[hover].checkins, 'check-in')}</span>
              <span>{plural(series[hover].steps, 'step')} · {series[hover].xp} XP</span>
            </div>
          )}
        </div>
      </div>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Check-ins</th><th scope="col">Steps</th><th scope="col">XP</th></tr></thead>
        <tbody>{series.map(item => <tr key={item.from}><th scope="row">{item.label}</th><td>{item.checkins}</td><td>{item.steps}</td><td>{item.xp}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Progress report on Today: week, 2 weeks, month, quarter, half year or full year, compared with the period before. */
export default function ReportCard() {
  const [range, setRange] = useState(readRange);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const meta = REPORT_RANGES.find(item => item.value === range) || REPORT_RANGES[0];

  const load = useCallback(async value => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/reports', { params: { range: value } });
      setReport(response.data);
    } catch (loadError) {
      setError(apiError(loadError, 'Could not load your report.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(range); }, [range, load]);

  const choose = value => {
    setRange(value);
    try { window.localStorage.setItem(RANGE_KEY, value); } catch { /* not remembered */ }
  };

  const t = report?.totals;
  const p = report?.previousTotals;
  const bucketWord = range === 'quarter' ? 'week' : ['half', 'year'].includes(range) ? 'month' : 'day';
  const moods = Object.entries(report?.moods || {}).sort((a, b) => b[1] - a[1]);

  return (
    <section className="card report-card" aria-labelledby="report-title" aria-busy={loading}>
      <div className="report-head">
        <div>
          <h2 id="report-title" className="title-large">Your report</h2>
          <p className="body-small text-variant">{report ? `${report.label} · ${shortDate(report.start)} – ${shortDate(report.end)}` : 'How you’ve been showing up'}</p>
        </div>
        <div className="segmented report-ranges" role="radiogroup" aria-label="Report period">
          {REPORT_RANGES.map(item => (
            <button key={item.value} type="button" role="radio" aria-checked={range === item.value} className="state-layer" onClick={() => choose(item.value)}>{item.label}</button>
          ))}
        </div>
      </div>

      {error && <p className="inline-error" role="alert"><Icon name="error" />{error} <button type="button" className="link-btn" onClick={() => load(range)}>Try again</button></p>}
      {!report && loading && <Spinner label="Building your report" />}

      {report && (
        <div className={`report-body${loading ? ' is-loading' : ''}`}>
          <div className="report-stats">
            <div className="report-stat">
              <span className="label-medium text-variant"><Icon name="check_circle" size="18" />Check-ins</span>
              <strong className="report-figure">{t.checkins}<span>/{t.expected}</span></strong>
              <Delta now={t.checkins} before={p.checkins} previous={meta.previous} />
            </div>
            <div className="report-stat">
              <span className="label-medium text-variant"><Icon name="donut_large" size="18" />Completion</span>
              <strong className="report-figure">{t.rate}<span>%</span></strong>
              <Delta now={t.rate} before={p.rate} unit=" pts" previous={meta.previous} />
            </div>
            <div className="report-stat">
              <span className="label-medium text-variant"><Icon name="calendar_month" size="18" />Active days</span>
              <strong className="report-figure">{t.activeDays}<span>/{t.days}</span></strong>
              <Delta now={t.activeDays} before={p.activeDays} previous={meta.previous} />
            </div>
            <div className="report-stat">
              <span className="label-medium text-variant"><Icon name="bolt" size="18" />XP earned</span>
              <strong className="report-figure">{t.xp}</strong>
              <Delta now={t.xp} before={p.xp} previous={meta.previous} />
            </div>
          </div>

          <ul className="report-chips" role="list">
            <li><Icon name="local_fire_department" size="18" />Best run: <strong>{plural(t.bestStreak, 'day')}</strong></li>
            <li><Icon name="checklist" size="18" />Steps done: <strong>{t.steps}</strong></li>
            <li><Icon name="emoji_events" size="18" />Challenges won: <strong>{t.wins}</strong></li>
            {moods.length > 0 && <li><Icon name="mood" size="18" />Mood: {moods.map(([mood, count]) => <span key={mood} className="report-mood" title={mood}>{MOODS[mood]} {count}</span>)}</li>}
          </ul>

          <ReportChart series={report.series} title={`Check-ins per ${bucketWord}`} />

          <div className="report-goals">
            <h3 className="title-small">By goal</h3>
            {!report.goals.length ? (
              <p className="body-medium text-variant">No active goals in this period yet. Set a goal to start your report.</p>
            ) : (
              <ul className="report-goal-list" role="list">
                {report.goals.map(goal => (
                  <li key={goal._id}>
                    <span className="report-goal-emoji" aria-hidden="true">{goal.emoji || '🎯'}</span>
                    <span className="report-goal-main">
                      <span className="report-goal-row"><span className="body-medium report-goal-title">{goal.title}</span><span className="label-medium">{goal.done}/{goal.expected} · {goal.rate}%</span></span>
                      <LinearProgress value={goal.rate} label={`${goal.title}: ${goal.rate}% of ${goal.frequency} check-ins`} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
