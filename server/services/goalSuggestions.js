/*
 * Turns what's on a vision board (gallery topics, words cards, captions) into suggested goals,
 * each with dated steps spread across the board's period.
 */

// Each plan: keywords that trigger it, the goal, and steps placed at a share (0–1) of the timeframe.
const PLANS = [
  { key: 'travel', match: /\b(travel|trip|world|abroad|paris|london|dubai|beach|holiday|vacation|adventure|explore|passport|visa|flight|city|island)\b/i,
    title: 'Take the trip on your board', emoji: '✈️', category: 'personal', frequency: 'weekly',
    steps: [[0.03, 'Pick the destination and travel dates'], [0.1, 'Set a trip budget and open a travel savings pot'], [0.25, 'Check passport and visa requirements'], [0.45, 'Book flights while prices are low'], [0.6, 'Book where you’ll stay'], [0.85, 'Plan a rough day-by-day itinerary'], [0.97, 'Pack, print documents and go']] },
  { key: 'education', match: /\b(education|learn|learning|study|school|degree|course|class|exam|university|college|graduat\w*|book|books|read|reading|skill|certificat\w*)\b/i,
    title: 'Finish the course or qualification you’re picturing', emoji: '🎓', category: 'learning', frequency: 'daily',
    steps: [[0.03, 'Choose the course, book or qualification'], [0.08, 'Block a daily study slot in your calendar'], [0.25, 'Complete the first module'], [0.5, 'Reach the halfway point and review your notes'], [0.75, 'Practise with past questions or a project'], [0.95, 'Sit the exam or finish the final project']] },
  { key: 'fitness', match: /\b(fitness|fit|gym|run|running|marathon|5k|10k|workout|exercise|strong|strength|yoga|weight|muscle|healthy body|sport)\b/i,
    title: 'Build a fitness habit that sticks', emoji: '🏃', category: 'fitness', frequency: 'daily',
    steps: [[0.02, 'Write down your starting point (time, weight or reps)'], [0.05, 'Plan 3 workouts a week in your calendar'], [0.25, 'Complete 4 weeks without missing a planned session'], [0.5, 'Raise the challenge: longer, heavier or faster'], [0.75, 'Sign up for an event or set a test day'], [0.98, 'Re-test and compare with your starting point']] },
  { key: 'career', match: /\b(career|job|work|office|promotion|business|startup|entrepreneur\w*|boss|ceo|interview|hire|hired|salary|portfolio|clients?)\b/i,
    title: 'Take the next big step in your career', emoji: '💼', category: 'career', frequency: 'weekly',
    steps: [[0.03, 'Define the role, promotion or business milestone you want'], [0.1, 'Update your CV, portfolio or LinkedIn'], [0.25, 'Have 3 conversations with people already doing it'], [0.45, 'Apply, pitch or ask for the opportunity'], [0.7, 'Prepare and practise for interviews or pitches'], [0.95, 'Review progress and set the next milestone']] },
  { key: 'money', match: /\b(money|savings?|save|saving|invest\w*|wealth|rich|financ\w*|debt|budget|income|naira|cash|house fund)\b/i,
    title: 'Hit a savings goal', emoji: '💰', category: 'finance', frequency: 'weekly',
    steps: [[0.02, 'Set your savings target and why it matters'], [0.05, 'Track a month of spending'], [0.1, 'Set up an automatic transfer on payday'], [0.4, 'Cut or cancel one regular expense'], [0.6, 'Reach the halfway mark'], [0.98, 'Hit the target and decide what’s next']] },
  { key: 'home', match: /\b(home|house|apartment|interior|room|decor|garden|kitchen|move|moving|flat)\b/i,
    title: 'Create the home you’re picturing', emoji: '🏡', category: 'personal', frequency: 'weekly',
    steps: [[0.03, 'Choose the room or project to start with'], [0.1, 'Make a budget and a shopping list'], [0.3, 'Declutter and clear the space'], [0.6, 'Buy or make the key pieces'], [0.95, 'Finish the details and enjoy it']] },
  { key: 'wellness', match: /\b(wellness|well-being|wellbeing|calm|peace|meditat\w*|mindful\w*|mindset|stress|sleep|rest|self-care|spa|mental|positive|grateful|gratitude|happy|joy)\b/i,
    title: 'Make calm a daily habit', emoji: '🧘', category: 'health', frequency: 'daily',
    steps: [[0.02, 'Choose your daily calm practice (meditation, journaling or a walk)'], [0.05, 'Set a fixed time and a reminder'], [0.25, 'Keep it up for 3 weeks in a row'], [0.5, 'Add a weekly screen-free evening'], [0.9, 'Reflect on how you feel and adjust']] },
  { key: 'food', match: /\b(healthy food|food|eat|eating|nutrition|diet|cook|cooking|meal|vegan|salad|smoothie)\b/i,
    title: 'Eat well most days', emoji: '🥗', category: 'health', frequency: 'daily',
    steps: [[0.02, 'Plan this week’s meals'], [0.05, 'Stock the kitchen with healthy staples'], [0.25, 'Cook at home 5 days a week'], [0.5, 'Learn 3 new healthy recipes'], [0.9, 'Review what worked and keep it going']] },
  { key: 'family', match: /\b(family|kids|children|parents|mum|mom|dad|love|relationship|marriage|wedding|partner|friends?)\b/i,
    title: 'Make time for the people you love', emoji: '❤️', category: 'personal', frequency: 'weekly',
    steps: [[0.03, 'Decide who you want more time with'], [0.08, 'Put a weekly time together in the calendar'], [0.3, 'Plan one special day out'], [0.6, 'Start a small tradition'], [0.95, 'Look back on the moments you made']] },
  { key: 'style', match: /\b(style|fashion|outfit|wardrobe|clothes|look|beauty|skincare)\b/i,
    title: 'Refresh your style', emoji: '👗', category: 'personal', frequency: 'weekly',
    steps: [[0.03, 'Collect looks you love'], [0.1, 'Clear out what you don’t wear'], [0.3, 'Buy a few key pieces that mix and match'], [0.6, 'Try one new look each week'], [0.95, 'Finish your capsule wardrobe']] },
  { key: 'nature', match: /\b(nature|outdoors?|hike|hiking|mountain|forest|park|camping|sea|ocean)\b/i,
    title: 'Spend more time outdoors', emoji: '🌿', category: 'health', frequency: 'weekly',
    steps: [[0.03, 'List 5 outdoor places near you'], [0.1, 'Do a weekly walk or hike'], [0.4, 'Plan a day trip somewhere new'], [0.8, 'Try an overnight trip or camping'], [0.97, 'Look back at the places you explored']] }
];

const GENERIC_STEPS = [[0.03, 'Write down what success looks like'], [0.1, 'Break it into 3 smaller milestones'], [0.35, 'Reach the first milestone'], [0.65, 'Reach the second milestone'], [0.95, 'Reach the final milestone and celebrate']];

const PERIOD_MONTHS = { year: [0, 11], h1: [0, 5], h2: [6, 11], q1: [0, 2], q2: [3, 5], q3: [6, 8], q4: [9, 11], 'q1-q3': [0, 8], 'q2-q4': [3, 11] };
const DAY_MS = 86400000;
const startOfDay = date => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
// Plain calendar dates (YYYY-MM-DD), so the member's own time zone decides the day.
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The period's date range, starting today if it's already under way (or 90 days from today if it's over). */
const rangeFor = (year, period) => {
  const [from, to] = PERIOD_MONTHS[period] || PERIOD_MONTHS.year;
  const periodStart = new Date(year, from, 1);
  const periodEnd = new Date(year, to + 1, 0);
  const today = startOfDay(new Date());
  if (periodEnd < today) return { start: today, end: new Date(today.getTime() + 90 * DAY_MS) };
  const start = periodStart > today ? periodStart : today;
  const end = periodEnd.getTime() - start.getTime() < 14 * DAY_MS ? new Date(start.getTime() + 30 * DAY_MS) : periodEnd;
  return { start, end };
};

const datedSteps = (steps, start, end) => {
  const span = end.getTime() - start.getTime();
  return steps.map(([share, title]) => ({ title, dueDate: dayKey(startOfDay(new Date(start.getTime() + span * share))) }));
};

const quote = text => (text.length > 40 ? `${text.slice(0, 38)}…` : text);

/**
 * Suggestions for a board: one per matched plan (strongest signals first), plus words cards that
 * matched nothing become their own goal. Skips goals the user already has.
 */
const suggestGoals = ({ board, existingTitles = [] }) => {
  const items = board?.items || [];
  const { start, end } = rangeFor(board?.year || new Date().getFullYear(), board?.period || 'year');
  const existing = new Set(existingTitles.map(title => title.trim().toLowerCase()));
  const hits = new Map(); // plan key -> { plan, score, sources }
  const unmatchedWords = [];

  items.forEach(item => {
    const signals = [item.topic, item.caption, item.type === 'text' ? item.text : ''].filter(Boolean);
    let matched = false;
    signals.forEach(signal => {
      PLANS.forEach(plan => {
        if (!plan.match.test(signal)) return;
        matched = true;
        const hit = hits.get(plan.key) || { plan, score: 0, sources: new Set() };
        hit.score += item.type === 'text' ? 3 : 1; // your own words count most
        hit.sources.add(item.type === 'text' ? `“${quote(item.text)}”` : item.topic || item.caption);
        hits.set(plan.key, hit);
      });
    });
    if (!matched && item.type === 'text' && item.text.trim().length >= 3) unmatchedWords.push(item.text.trim());
  });

  const suggestions = [...hits.values()].sort((a, b) => b.score - a.score).map(({ plan, sources }) => ({
    id: `plan-${plan.key}`,
    title: plan.title,
    emoji: plan.emoji,
    category: plan.category,
    frequency: plan.frequency,
    reason: `From ${[...sources].slice(0, 3).join(', ')} on your board`,
    startDate: dayKey(start),
    endDate: dayKey(end),
    steps: datedSteps(plan.steps, start, end)
  }));

  unmatchedWords.slice(0, 3).forEach(text => {
    suggestions.push({
      id: `words-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      title: text.length > 90 ? `${text.slice(0, 88)}…` : text,
      emoji: '🎯',
      category: 'personal',
      frequency: 'weekly',
      reason: `From your words “${quote(text)}”`,
      startDate: dayKey(start),
      endDate: dayKey(end),
      steps: datedSteps(GENERIC_STEPS, start, end)
    });
  });

  return suggestions.filter(suggestion => !existing.has(suggestion.title.toLowerCase())).slice(0, 6);
};

module.exports = { suggestGoals, rangeFor };
