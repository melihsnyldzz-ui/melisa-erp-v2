// Read-only projections. No service probes, credentials, timers or operational state writes.
export const TIME_ZONE = 'Europe/Istanbul';
export function safeEvidenceUrl(value) {
  if (typeof value !== 'string' || /[\s\\%]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search) return null;
    if (!/^\/melihsnyldzz-ui\/melisa-(erp-v2|crm)\/(blob|commit|pull|actions\/runs)\/[a-zA-Z0-9._/-]+$/u.test(url.pathname)) return null;
    if (url.hash && !/^#[a-zA-Z0-9_-]+$/u.test(url.hash)) return null;
    return url.href;
  } catch { return null; }
}
export function localDay(time) {
  const parts = new Intl.DateTimeFormat('en', {timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(time));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function periodBounds(period, now) {
  if (![1, 7, 30].includes(period) || !Number.isFinite(now)) throw Error('INVALID_PERIOD');
  const today = Date.parse(localDay(now) + 'T00:00:00+03:00');
  return {start: today - (period - 1) * 86400000, end: today + 86400000};
}
const epoch = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/u.test(value) ? Date.parse(value) : NaN;
export function validateSnapshot(input) {
  if (input?.schemaVersion !== 1 || !Number.isFinite(epoch(input.observedAt)) || input.timeZone !== TIME_ZONE || !Array.isArray(input.projects) || input.projects.length !== 2 || !Array.isArray(input.observations) || input.observations.length > 500) throw Error('INVALID_SNAPSHOT');
  const projects = input.projects.map(p => {
    if (!['ERP', 'CRM'].includes(p?.id) || !['total', 'complete', 'partial', 'open'].every(k => Number.isSafeInteger(p[k]) && p[k] >= 0 && p[k] <= 1000) || p.total < 1 || p.complete + p.partial + p.open !== p.total || !safeEvidenceUrl(p.sourceUrl) || !safeEvidenceUrl(p.deliveryUrl)) throw Error('INVALID_PROJECT');
    return {...p, percent: p.complete / p.total * 100};
  });
  if (new Set(projects.map(p => p.id)).size !== 2) throw Error('DUPLICATE_PROJECT');
  const unique = new Map(), conflicts = new Set();
  let rejected = 0;
  for (const o of input.observations) {
    const start = epoch(o?.startedAt), end = epoch(o?.completedAt);
    if (!/^[a-z0-9-]{1,80}$/u.test(o?.key ?? '') || !['ERP', 'CRM'].includes(o?.project) || typeof o?.title !== 'string' || o.title.length > 160 || o.role !== 'main' || o.status !== 'completed' || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > epoch(input.observedAt) || end - start > 86400000 || !safeEvidenceUrl(o.sourceUrl)) { rejected++; continue; }
    const row = {key: o.key, project: o.project, title: o.title, startedAt: o.startedAt, completedAt: o.completedAt, start, end, seconds: (end - start) / 1000, sourceUrl: safeEvidenceUrl(o.sourceUrl)};
    const previous = unique.get(o.key);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) conflicts.add(o.key);
    else unique.set(o.key, row);
  }
  for (const key of conflicts) unique.delete(key);
  const identities = new Set();
  const observations = [...unique.values()].filter(({key, ...row}) => {
    const identity = JSON.stringify(row);
    if (identities.has(identity)) return false;
    identities.add(identity); return true;
  });
  const sum = key => projects.reduce((n, p) => n + p[key], 0);
  const totals = Object.fromEntries(['total', 'complete', 'partial', 'open'].map(k => [k, sum(k)]));
  totals.percent = totals.complete / totals.total * 100;
  const sourceErrors = Array.isArray(input.sourceErrors) ? input.sourceErrors.filter(e => ['AUTH', 'RATE_LIMIT', 'UNAVAILABLE'].includes(e)) : [];
  return {observedAt: input.observedAt, observedMs: epoch(input.observedAt), projects, totals, observations, rejected: rejected + conflicts.size, sourceErrors};
}
export function projectPerformance(snapshot, period, now = Date.now()) {
  const bounds = periodBounds(period, now);
  const futureSnapshot = snapshot.observedMs > now + 60000;
  const unavailable = futureSnapshot || snapshot.sourceErrors.length > 0;
  const stale = !unavailable && now - snapshot.observedMs > 6 * 3600000;
  const rows = unavailable ? [] : snapshot.observations.filter(o => o.end >= bounds.start && o.end < bounds.end && o.end <= now);
  const average = list => list.length ? list.reduce((n, o) => n + o.seconds, 0) / list.length : null;
  const byProject = Object.fromEntries(['ERP', 'CRM'].map(id => { const list = rows.filter(o => o.project === id); return [id, {observedCount: list.length || null, averageSeconds: average(list)}]; }));
  const hours = new Map();
  for (const o of rows) {
    for (let start = Math.floor(Math.max(o.start, bounds.start) / 3600000) * 3600000; start < Math.min(o.end, bounds.end); start += 3600000) {
      const seconds = Math.max(0, Math.min(o.end, start + 3600000, bounds.end) - Math.max(o.start, start, bounds.start)) / 1000;
      if (!seconds) continue;
      const bucket = hours.get(start) ?? {start, ERP: 0, CRM: 0};
      bucket[o.project] += seconds; hours.set(start, bucket);
    }
  }
  return {period, bounds, rows: rows.sort((a,b) => a.start - b.start), byProject, observedCount: rows.length || null, averageSeconds: average(rows), fullPeriodCount: null, activeSeconds: null, waitingSeconds: null, callbackDelaySeconds: null, dispatchDelaySeconds: null, hourly: [...hours.values()].sort((a,b) => a.start - b.start), state: unavailable ? 'unknown' : stale ? 'stale' : 'snapshot', rejected: snapshot.rejected};
}
export function duration(value) {
  if (!Number.isFinite(value) || value < 0) return 'Ölçülemiyor';
  const seconds = Math.round(value), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = seconds % 60;
  return [hours ? `${hours} sa` : '', minutes ? `${minutes} dk` : '', rest || !seconds ? `${rest} sn` : ''].filter(Boolean).join(' ');
}
