const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';

export function businessDateInIstanbul(value = new Date()) {
  const instant = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
