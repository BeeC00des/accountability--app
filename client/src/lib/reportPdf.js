/*
 * Builds the Today dashboard PDF: a snapshot of today plus the progress report for the chosen period.
 * Drawn with jsPDF primitives (real text, crisp at any zoom), loaded only when someone downloads.
 */

const MOOD_WORDS = { great: 'Great', good: 'Good', okay: 'Okay', tough: 'Tough' };

/** jsPDF's built-in fonts only cover Latin-1, so drop emoji and swap typographic punctuation. */
const clean = text => String(text ?? '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/·/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const hexToRgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const mix = (hex, target, weight) => {
  const [a, b] = [hexToRgb(hex), hexToRgb(target)];
  return a.map((value, index) => Math.round(value * weight + b[index] * (1 - weight)));
};
const luminance = ([r, g, b]) => [r, g, b].map(v => v / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const shortDate = key => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const signed = (value, unit = '') => (value > 0 ? `+${value}${unit}` : value < 0 ? `-${Math.abs(value)}${unit}` : `no change`);

export async function downloadReportPdf({ report, rangeMeta, snapshot, accent = '#d8f36a' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 16; const CW = W - M * 2;
  const ink = [17, 17, 17]; const muted = [110, 110, 115]; const line = [228, 228, 222];
  const accentRgb = /^#[0-9a-f]{6}$/i.test(accent) ? hexToRgb(accent) : hexToRgb('#d8f36a');
  const onAccent = luminance(accentRgb) > 0.18 ? ink : [255, 255, 255];
  const barRgb = luminance(accentRgb) > 0.5 ? mix(accent, '#000000', 0.78) : accentRgb; // keep bars visible on white
  const soft = mix(accent, '#ffffff', 0.18);
  let y = 0;

  const text = (value, x, top, { size = 10, style = 'normal', color = ink, align = 'left', max } = {}) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(clean(value), x, top, { align, maxWidth: max, baseline: 'top' });
  };
  const ensure = height => { if (y + height > 297 - 18) { doc.addPage(); y = M; } };

  /* ---------- Header band ---------- */
  doc.setFillColor(...accentRgb); doc.rect(0, 0, W, 46, 'F');
  text('doerstab', M, 12, { size: 12, style: 'bold', color: onAccent });
  text('Progress report', M, 20, { size: 22, style: 'bold', color: onAccent });
  text(`${snapshot.name}  -  ${report.label} (${shortDate(report.start)} - ${shortDate(report.end)})`, M, 31, { size: 10.5, color: onAccent });
  text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, W - M, 12, { size: 8.5, color: onAccent, align: 'right' });
  y = 56;

  /* ---------- Today snapshot ---------- */
  text('Today', M, y, { size: 13, style: 'bold' }); y += 8;
  const snap = [
    ['Streak', `${snapshot.streak} day${snapshot.streak === 1 ? '' : 's'}`, snapshot.streakToday ? 'Extended today' : 'Check in to keep it'],
    ["Today's plan", `${snapshot.planDone}/${snapshot.planTotal}`, 'goals checked in'],
    ['This month', `${snapshot.monthRate}%`, `${snapshot.monthAchieved}/${snapshot.monthExpected} check-ins`]
  ];
  const sw = (CW - 8) / 3;
  snap.forEach(([label, value, sub], index) => {
    const x = M + index * (sw + 4);
    doc.setFillColor(...soft); doc.roundedRect(x, y, sw, 24, 3, 3, 'F');
    text(label, x + 5, y + 4, { size: 8.5, color: muted });
    text(value, x + 5, y + 9, { size: 16, style: 'bold' });
    text(sub, x + 5, y + 18, { size: 8, color: muted, max: sw - 10 });
  });
  y += 34;

  /* ---------- Report headline numbers ---------- */
  const t = report.totals; const p = report.previousTotals;
  text(`${rangeMeta.label} report`, M, y, { size: 13, style: 'bold' });
  text(`Compared with the ${rangeMeta.previous}`, W - M, y + 1, { size: 8.5, color: muted, align: 'right' }); y += 8;
  const stats = [
    ['Check-ins', `${t.checkins}/${t.expected}`, signed(t.checkins - p.checkins)],
    ['Completion', `${t.rate}%`, signed(t.rate - p.rate, ' pts')],
    ['Active days', `${t.activeDays}/${t.days}`, signed(t.activeDays - p.activeDays)],
    ['XP earned', `${t.xp}`, signed(t.xp - p.xp)]
  ];
  const bw = (CW - 12) / 4;
  stats.forEach(([label, value, delta], index) => {
    const x = M + index * (bw + 4);
    doc.setDrawColor(...line); doc.setLineWidth(0.3); doc.roundedRect(x, y, bw, 24, 3, 3, 'S');
    text(label, x + 4, y + 4, { size: 8.5, color: muted });
    text(value, x + 4, y + 9, { size: 15, style: 'bold' });
    const positive = delta.startsWith('+'); const negative = delta.startsWith('-');
    text(`${delta}${delta === 'no change' ? '' : ' vs before'}`, x + 4, y + 18, { size: 7.5, color: positive ? [31, 138, 76] : negative ? [196, 49, 75] : muted, max: bw - 8 });
  });
  y += 30;
  const moods = Object.entries(report.moods || {}).sort((a, b) => b[1] - a[1]).map(([mood, count]) => `${MOOD_WORDS[mood] || mood} ${count}`).join(', ');
  text(`Best run: ${t.bestStreak} day${t.bestStreak === 1 ? '' : 's'}    Steps done: ${t.steps}    Challenges won: ${t.wins}${moods ? `    Mood: ${moods}` : ''}`, M, y, { size: 9, color: muted, max: CW });
  y += 12;

  /* ---------- Bar chart ---------- */
  const series = report.series || [];
  const unit = report.range === 'quarter' ? 'week' : ['half', 'year'].includes(report.range) ? 'month' : 'day';
  text(`Check-ins per ${unit}`, M, y, { size: 11, style: 'bold' }); y += 7;
  const chartH = 52; const axisW = 8; const plotW = CW - axisW; const base = y + chartH;
  const max = Math.max(1, ...series.map(item => item.checkins));
  doc.setLineWidth(0.2);
  [max, Math.round(max / 2)].filter((v, i, all) => v > 0 && all.indexOf(v) === i).forEach(tick => {
    const ty = base - (tick / max) * chartH;
    doc.setDrawColor(...line); doc.setLineDashPattern([1, 1], 0); doc.line(M + axisW, ty, W - M, ty); doc.setLineDashPattern([], 0);
    text(String(tick), M + axisW - 2, ty - 1.6, { size: 7, color: muted, align: 'right' });
  });
  text('0', M + axisW - 2, base - 1.6, { size: 7, color: muted, align: 'right' });
  doc.setDrawColor(200, 200, 195); doc.line(M + axisW, base, W - M, base);
  const slot = plotW / Math.max(1, series.length);
  const barW = Math.min(9, slot * 0.7);
  const every = series.length > 20 ? 5 : series.length > 14 ? 2 : 1;
  series.forEach((item, index) => {
    const h = (item.checkins / max) * chartH;
    const x = M + axisW + index * slot + (slot - barW) / 2;
    if (h > 0) { doc.setFillColor(...barRgb); doc.roundedRect(x, base - h, barW, h, Math.min(1, barW / 3), Math.min(1, barW / 3), 'F'); if (h > 1.2) doc.rect(x, base - Math.min(1.2, h), barW, Math.min(1.2, h), 'F'); }
    if (index % every === 0 || index === series.length - 1) text(item.short, x + barW / 2, base + 2, { size: 6.5, color: muted, align: 'center' });
  });
  y = base + 12;

  /* ---------- By goal ---------- */
  ensure(20);
  text('By goal', M, y, { size: 11, style: 'bold' }); y += 7;
  if (!report.goals.length) {
    text('No active goals in this period yet.', M, y, { size: 9.5, color: muted }); y += 8;
  }
  report.goals.forEach(goal => {
    ensure(13);
    text(goal.title, M, y, { size: 10, max: CW - 60 });
    text(`${goal.frequency === 'weekly' ? 'Weekly' : 'Daily'}  -  ${goal.done}/${goal.expected}  -  ${goal.rate}%`, W - M, y, { size: 9, color: muted, align: 'right' });
    doc.setFillColor(...soft); doc.roundedRect(M, y + 6, CW, 2.4, 1.2, 1.2, 'F');
    if (goal.rate > 0) { doc.setFillColor(...barRgb); doc.roundedRect(M, y + 6, Math.max(2.4, (CW * Math.min(100, goal.rate)) / 100), 2.4, 1.2, 1.2, 'F'); }
    y += 13;
  });

  /* ---------- Footer on every page ---------- */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    text(`doerstab  -  ${snapshot.name}  -  page ${page} of ${pages}`, W / 2, 287, { size: 7.5, color: muted, align: 'center' });
  }

  const filename = `doerstab-report-${report.range}-${report.end}.pdf`;
  doc.save(filename);
  return filename;
}
