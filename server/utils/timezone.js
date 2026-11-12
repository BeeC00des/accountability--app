const partsForDate = (date, timeZone, options) => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
};

const isValidTimeZone = timeZone => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const getLocalDateKey = (date, timeZone = 'UTC') => {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = partsForDate(new Date(date), zone, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getLocalTimeKey = (date, timeZone = 'UTC') => {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = partsForDate(new Date(date), zone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${parts.hour}:${parts.minute}`;
};

const getPeriodKey = (date, timeZone = 'UTC', frequency = 'daily') => {
  const dateKey = getLocalDateKey(date, timeZone);
  if (frequency !== 'weekly') return dateKey;
  const localDate = new Date(`${dateKey}T00:00:00.000Z`);
  localDate.setUTCDate(localDate.getUTCDate() - ((localDate.getUTCDay() + 6) % 7));
  return localDate.toISOString().slice(0, 10);
};

module.exports = { getLocalDateKey, getLocalTimeKey, getPeriodKey, isValidTimeZone };
