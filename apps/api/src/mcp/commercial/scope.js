import { env } from '../../config/env.js';
import { catalog, dataset } from './catalog.js';
import { fail } from './policy.js';

export function configuredContext() {
  return { source: 'vega', database: env.bionicVegaSql.database || null,
    company: env.bionicVegaSql.companyCode || null, period: env.bionicVegaSql.periodCode || null,
    readAt: new Date().toISOString(), readOnly: true,
    scope: 'Configured company/period; card data is current, not a historical snapshot.' };
}
export async function resolveScope(args = {}) {
  const c = await catalog();
  const s = c.sources.find(v => v.source === 'vega');
  if (!s?.proof?.readOnlyAccountVerified) throw fail('SOURCE_UNAVAILABLE');
  const company = args.company ?? s.proof.companyCode;
  const period = args.period ?? s.proof.periodCode;
  if (typeof company !== 'string' || !s.companies.some(v => v.company === company)) throw fail('COMPANY_NOT_ALLOWED');
  const def = s.periods.find(v => v.company === company && v.period === period);
  if (!def || !c.datasets.some(d => d.company === company && d.period === period && d.readable)) throw fail('PERIOD_NOT_AVAILABLE');
  return { source:'vega', database:s.database, company, period, periodYear:def.year,
    readAt:new Date().toISOString(), readOnly:true, scope:'One registered company/period; explicit dates required for historical reports.' };
}
export function dateRange(args) {
  const valid = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
  if (!valid(args.dateFrom) || !valid(args.dateTo) || args.dateFrom >= args.dateTo || Date.parse(args.dateTo)-Date.parse(args.dateFrom) > 366*86400000) throw fail('EXPLICIT_DATE_RANGE_REQUIRED_MAX_366_DAYS');
  return {dateFrom:args.dateFrom, dateTo:args.dateTo, endExclusive:true};
}
export async function scopedDataset(scope, template, period = false) {
  const d = await dataset(`vega.dbo.${scope.company}${period ? scope.period : ''}${template}`);
  if (!d.readable) throw fail('DATASET_READ_PERMISSION_MISSING');
  return d;
}
export function requireFields(d, fields) {
  if (fields.some(name => !d.fields.some(f => f.name === name))) throw fail('SCHEMA_MAPPING_REQUIRED');
  return fields;
}
