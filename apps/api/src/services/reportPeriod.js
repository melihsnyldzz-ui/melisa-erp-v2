function invalidPeriod() {
  return Object.assign(new Error('Geçerli ve sıralı bir tarih aralığı seçin.'), { statusCode: 400, code: 'REPORT_PERIOD_INVALID' });
}

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') throw invalidPeriod();
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw invalidPeriod();
  return value;
}

export function reportPeriod(query = {}, defaults) {
  const dateFrom = calendarDate(query.dateFrom === undefined ? defaults.dateFrom : query.dateFrom);
  const dateTo = calendarDate(query.dateTo === undefined ? defaults.dateTo : query.dateTo);
  if (dateFrom > dateTo) throw invalidPeriod();
  return { dateFrom, dateTo };
}
