export function localDate(timezone = 'Europe/Moscow') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function localTime(timezone = 'Europe/Moscow') {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date());
}

export function normalizePrayerTime(value) {
  return String(value || '').match(/\d{1,2}:\d{2}/)?.[0] || '';
}
