const partsForDate = (date, timeZone, options) => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
};

const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const getLocalDateKey = (date, timeZone = 'UTC') => {
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = partsForDate(new Date(date), safeTimeZone, {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getLocalTimeKey = (date, timeZone = 'UTC') => {
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = partsForDate(new Date(date), safeTimeZone, {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  return `${parts.hour}:${parts.minute}`;
};

const getPeriodKey = (date, timeZone = 'UTC', frequency = 'daily') => {
  const dateKey = getLocalDateKey(date, timeZone);
  if (frequency !== 'weekly') return dateKey;

  const localDate = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = localDate.getUTCDay();
  localDate.setUTCDate(localDate.getUTCDate() - ((dayOfWeek + 6) % 7));
  return localDate.toISOString().slice(0, 10);
};

/** The UTC instant of local midnight at the start of `dateKey` (YYYY-MM-DD) in `timeZone`. */
const zonedMidnight = (dateKey, timeZone = 'UTC') => {
  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const [year, month, day] = dateKey.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = partsForDate(new Date(guess), safeTimeZone, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const wallClock = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess -= wallClock - target;
  }
  return new Date(guess);
};

module.exports = { getLocalDateKey, getLocalTimeKey, getPeriodKey, isValidTimeZone, zonedMidnight };
