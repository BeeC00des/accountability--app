// `tile` maps to a gradient icon tile in App.css (.tile-*).
export const CATEGORIES = [
  { value: 'fitness', label: 'Fitness', icon: 'fitness_center', tile: 'green' },
  { value: 'health', label: 'Health', icon: 'favorite', tile: 'pink' },
  { value: 'learning', label: 'Learning', icon: 'school', tile: 'blue' },
  { value: 'career', label: 'Career', icon: 'work', tile: 'purple' },
  { value: 'finance', label: 'Finance', icon: 'savings', tile: 'yellow' },
  { value: 'personal', label: 'Personal', icon: 'self_improvement', tile: 'lime' },
  { value: 'other', label: 'Other', icon: 'category', tile: 'teal' }
];
export const categoryOf = value => CATEGORIES.find(category => category.value === value) || CATEGORIES[5];

export const EMOJIS = ['🎯', '💪', '📚', '🏃', '🧘', '💼', '💰', '🌱', '✍️', '🎨', '🎵', '🍎', '💧', '😴', '🧠', '🙏'];

export const MOODS = [
  { value: 'great', label: 'Great', emoji: '🚀' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'okay', label: 'Okay', emoji: '😐' },
  { value: 'tough', label: 'Tough', emoji: '😮‍💨' }
];

export const DURATIONS = [
  { value: 7, label: '1 week' },
  { value: 30, label: '1 month' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' }
];
export const durationLabel = days => DURATIONS.find(item => item.value === Number(days))?.label || `${days} days`;

export const periodWord = goal => (goal.frequency === 'weekly' ? 'week' : 'day');
export const periodLabel = goal => (goal.frequency === 'weekly' ? 'this week' : 'today');

export const NUDGE_TEMPLATES = [
  "You've got this! 💪",
  "Don't break the streak! 🔥",
  'One small step today 🚶',
  'Your future self will thank you ✨'
];
export const CHEER_TEMPLATES = [
  'Proud of you! 🎉',
  'Keep that momentum going 🚀',
  'Inspiring consistency 👏',
  'Thanks for the nudge — on it! 🙌'
];

export const tileClass = goal => `tile-${categoryOf(goal?.category).tile}`;
