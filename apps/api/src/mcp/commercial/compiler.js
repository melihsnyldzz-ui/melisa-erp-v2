import { sql, quote } from './sourcePools.js';
import { decimalTypes, integerTypes, dateTypes, exactKeys, fail, contextNames } from './policy.js';
import { fingerprint, openCursor } from './cursor.js';

export function pageLimit(value = 50) {
  if (!Number.isInteger(value) || value < 1 || value > 50) throw fail('INVALID_PAGE_LIMIT');
  return value;
}

export function field(dataset, name) {
  const result = typeof name === 'string' && dataset.fields.find(f => f.name === name);
  if (!result) throw fail('FIELD_NOT_ALLOWED');
  return result;
}

function normalizedValue(f, value) {
  if(['float','real'].includes(f.dataType)){
    if(typeof value!=='string'||value.length>100||!/^[-+]?\d+(\.\d+)?([eE][-+]?\d{1,3})?$/.test(value)||!Number.isFinite(Number(value)))throw fail('INVALID_FLOAT');
    return value;
  }
  if (integerTypes.has(f.dataType)) {
    const text = String(value);
    if (!/^-?\d{1,19}$/.test(text) || (typeof value === 'number' && !Number.isSafeInteger(value))) throw fail('INVALID_INTEGER');
    const n = BigInt(text);
    const ranges = { bigint: [-9223372036854775808n, 9223372036854775807n], int: [-2147483648n, 2147483647n], smallint: [-32768n, 32767n], tinyint: [0n, 255n] };
    if (n < ranges[f.dataType][0] || n > ranges[f.dataType][1]) throw fail('INVALID_INTEGER');
    return text;
  }
  if (decimalTypes.has(f.dataType)) {
    // Bind decimal text and convert in SQL: JavaScript Number must not round money.
    if (typeof value !== 'string' || !/^-?\d{1,38}(\.\d{1,18})?$/.test(value)) throw fail('DECIMAL_REQUIRES_STRING');
    return value;
  }
  if (f.dataType === 'bit') {
    if (typeof value !== 'boolean') throw fail('INVALID_BOOLEAN');
    return value;
  }
  if (dateTypes.has(f.dataType)) {
    if(f.dataType==='time'){
      if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,7})?$/.test(value))throw fail('INVALID_TIME');
      return value;
    }
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2})?)?$/.test(value) || !Number.isFinite(Date.parse(value))) throw fail('INVALID_DATE');
    if(new Date(value.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==value.slice(0,10))throw fail('INVALID_DATE');
    return value;
  }
  if (f.dataType === 'uniqueidentifier') {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw fail('INVALID_GUID');
    return value;
  }
  if (typeof value !== 'string' || value.length > 500 || value.includes('\0')) throw fail('INVALID_TEXT');
  return value;
}

export function parameter(parameters, f, value) {
  const name = 'p' + parameters.length;
  const normalized = normalizedValue(f, value);
  parameters.push({ name, type: f.dataType === 'bit' ? sql.Bit : sql.NVarChar(600), value: normalized });
  if (integerTypes.has(f.dataType)) return `CONVERT(${f.dataType},@${name})`;
  if (decimalTypes.has(f.dataType)) {
    const type = ['decimal', 'numeric'].includes(f.dataType) ? `decimal(${Number(f.precision)},${Number(f.scale)})` : f.dataType;
    return `CONVERT(${type},@${name})`;
  }
  if (dateTypes.has(f.dataType)) return `CONVERT(${f.dataType},@${name},126)`;
  if (f.dataType === 'uniqueidentifier') return `CONVERT(uniqueidentifier,@${name})`;
  return '@' + name;
}

export function outputExpression(f, expression = quote(f.name)) {
  if(['float','real'].includes(f.dataType))return `CONVERT(varchar(100),${expression},3)`;
  if (decimalTypes.has(f.dataType) || f.dataType === 'bigint') return `CONVERT(varchar(100),${expression})`;
  if (dateTypes.has(f.dataType)) return `CONVERT(varchar(40),${expression},126)`;
  if (['nvarchar','varchar','nchar','char'].includes(f.dataType)) return `LEFT(${expression},4001)`;
  return expression;
}

export function compileFilters(dataset, filters = [], parameters = []) {
  if (!Array.isArray(filters) || filters.length > 12) throw fail('INVALID_FILTERS');
  const terms = [];
  for (const filter of filters) {
    exactKeys(filter, ['field', 'op', 'value']);
    const f = field(dataset, filter.field), column = quote(f.name);
    if (f.personal) throw fail('PERSONAL_DATA_FILTER_NOT_ALLOWED');
    if (filter.op === 'is_null') {
      if (typeof filter.value !== 'boolean') throw fail('INVALID_FILTER_VALUE');
      terms.push(`${column} IS ${filter.value ? '' : 'NOT '}NULL`);
    } else if (filter.op === 'in') {
      if (!Array.isArray(filter.value) || !filter.value.length || filter.value.length > 25) throw fail('INVALID_IN_FILTER');
      terms.push(`${column} IN (${filter.value.map(v => parameter(parameters, f, v)).join(',')})`);
    } else if (filter.op === 'contains') {
      if (!['nvarchar', 'varchar', 'nchar', 'char'].includes(f.dataType) || typeof filter.value !== 'string' || !filter.value.trim() || filter.value.length > 120) throw fail('INVALID_CONTAINS_FILTER');
      const escaped = filter.value.replace(/[~%_\[]/g, c => '~' + c);
      terms.push(`${column} LIKE ${parameter(parameters, f, '%' + escaped + '%')} ESCAPE '~'`);
    } else {
      const operators = { eq: '=', ne: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' };
      const operator = Object.hasOwn(operators,filter.op) ? operators[filter.op] : undefined;
      if (!operator || filter.value === null || filter.value === undefined) throw fail('INVALID_FILTER_OPERATOR');
      terms.push(`${column} ${operator} ${parameter(parameters, f, filter.value)}`);
    }
  }
  return terms;
}

export function keyset(dataset, keys, values, parameters, allowNull = false) {
  if (!Array.isArray(values) || values.length !== keys.length) throw fail('INVALID_OR_EXPIRED_CURSOR');
  return '(' + keys.map((name, index) => {
    const prefix = keys.slice(0, index).map((prior, i) => values[i] === null ? `${quote(prior)} IS NULL` : `${quote(prior)} = ${parameter(parameters, field(dataset, prior), values[i])}`);
    const next = values[index] === null && allowNull ? `${quote(name)} IS NOT NULL` : `${quote(name)} > ${parameter(parameters, field(dataset, name), values[index])}`;
    return '(' + [...prefix, next].join(' AND ') + ')';
  }).join(' OR ') + ')';
}

function selectedFields(dataset, args) {
  if(args.includePersonalData!==undefined&&typeof args.includePersonalData!=='boolean')throw fail('INVALID_ARGUMENTS');
  if(args.purpose!==undefined&&(typeof args.purpose!=='string'||args.purpose.length>300))throw fail('INVALID_ARGUMENTS');
  const names = args.fields ?? dataset.defaultFields;
  if (!Array.isArray(names) || !names.length || names.length > 40 || new Set(names).size !== names.length) throw fail('INVALID_FIELDS');
  const fields = names.map(n => field(dataset, n));
  if (fields.some(f => f.personal)) {
    const exactIdentity = dataset.primaryKey.every(k => args.filters?.some(f => f.field === k && f.op === 'eq'));
    if (args.includePersonalData !== true || typeof args.purpose !== 'string' || args.purpose.trim().length < 10 || args.purpose.length > 300 || !exactIdentity) throw fail('PERSONAL_DATA_REQUIRES_SINGLE_RECORD_AND_PURPOSE');
  }
  return fields;
}

export function assertReadable(dataset) {
  if (!dataset.readable) throw fail(dataset.registered ? 'DATASET_READ_PERMISSION_MISSING' : 'DATASET_MAPPING_REQUIRED');
}

export function compileQuery(dataset, args) {
  exactKeys(args, ['dataset', 'fields', 'filters', 'limit', 'cursor', 'includePersonalData', 'purpose']);
  assertReadable(dataset);
  if (!dataset.primaryKey.length) throw fail('NO_SAFE_UNIQUE_KEY');
  const limit = pageLimit(args.limit);
  const fields = selectedFields(dataset, args), parameters = [];
  const terms = compileFilters(dataset, args.filters, parameters);
  if (dataset.basePredicate) terms.unshift(dataset.basePredicate);
  const binding = fingerprint({ type: 'rows', dataset: dataset.id, schema: dataset.schemaVersion, fields: fields.map(f => f.name), filters: args.filters || [], personal: args.includePersonalData === true });
  if (args.cursor !== undefined) terms.push(keyset(dataset, dataset.primaryKey, openCursor(args.cursor, binding), parameters));
  const requested = fields.map(f => f.name);
  const contextFields=contextNames.filter(n=>dataset.fields.some(f=>f.name===n&&!f.personal));
  const selected = [...new Set([...requested, ...dataset.primaryKey,...contextFields])].map(n => field(dataset, n));
  const statement = `SELECT TOP (${limit + 1}) ${selected.map(f => outputExpression(f) + ' AS ' + quote(f.name)).join(',')} FROM ${dataset.from}${terms.length ? ' WHERE ' + terms.join(' AND ') : ''} ORDER BY ${dataset.primaryKey.map(quote).join(',')} OPTION (MAXDOP 1)`;
  return { statement, parameters, binding, limit, requested, keys: dataset.primaryKey,contextFields };
}

export function compileAggregate(dataset, args) {
  exactKeys(args, ['dataset', 'filters', 'groupBy', 'metrics', 'limit', 'cursor']);
  assertReadable(dataset);
  const groups = args.groupBy ?? [];
  if (!Array.isArray(groups) || groups.length > 6 || new Set(groups).size !== groups.length) throw fail('INVALID_GROUPS');
  for (const name of groups) { if (field(dataset, name).personal) throw fail('PERSONAL_DATA_GROUP_NOT_ALLOWED'); }
  if (!Array.isArray(args.metrics) || !args.metrics.length || args.metrics.length > 8) throw fail('INVALID_METRICS');
  const names = new Set(groups), measures = [];
  for (const metric of args.metrics) {
    exactKeys(metric, ['op', 'field', 'as']);
    if (typeof metric.as !== 'string' || !/^[a-z][a-z0-9_]{0,30}$/.test(metric.as) || names.has(metric.as)) throw fail('INVALID_METRIC_ALIAS');
    names.add(metric.as);
    let expression;
    if (metric.op === 'count' && metric.field === undefined) expression = 'COUNT_BIG(*)';
    else {
      const f = field(dataset, metric.field);
      if (f.personal) throw fail('PERSONAL_DATA_AGGREGATE_NOT_ALLOWED');
      if (metric.op === 'count_distinct') expression = `COUNT_BIG(DISTINCT ${quote(f.name)})`;
      else {
        if (!['sum', 'min', 'max'].includes(metric.op) || !f.aggregate?.includes(metric.op)) throw fail('MEASURE_NOT_VERIFIED');
        if ((f.requiredGroups || []).some(g => !groups.includes(g) && !args.filters?.some(v => v.field === g && v.op === 'eq'))) throw fail('CURRENCY_OR_UNIT_SCOPE_REQUIRED');
        // An incomplete source value must not turn into a definite total.
        expression = `CASE WHEN COUNT_BIG(${quote(f.name)}) = COUNT_BIG(*) THEN ${metric.op.toUpperCase()}(${quote(f.name)}) END`;
      }
    }
    measures.push(`CONVERT(varchar(100),${expression},126) AS ${quote(metric.as)}`);
  }
  const parameters = [], terms = compileFilters(dataset, args.filters, parameters);
  if (dataset.basePredicate) terms.unshift(dataset.basePredicate);
  const binding = fingerprint({ type: 'aggregate', dataset: dataset.id, schema: dataset.schemaVersion, groups, metrics: args.metrics, filters: args.filters || [] });
  const limit = pageLimit(args.limit);
  const grouped = groups.map(quote).join(',');
  const inner = `SELECT ${[grouped, ...measures].filter(Boolean).join(',')} FROM ${dataset.from}${terms.length ? ' WHERE ' + terms.join(' AND ') : ''}${groups.length ? ' GROUP BY ' + grouped : ''}`;
  let after = '';
  if (args.cursor !== undefined) {
    if (!groups.length) throw fail('INVALID_OR_EXPIRED_CURSOR');
    after = ' WHERE ' + keyset(dataset, groups, openCursor(args.cursor, binding), parameters, true);
  }
  const columns = [...groups.map(n => outputExpression(field(dataset, n)) + ' AS ' + quote(n)), ...args.metrics.map(m => quote(m.as))];
  const statement = `SELECT TOP (${limit + 1}) ${columns.join(',')} FROM (${inner}) AS [aggregate_result]${after}${groups.length ? ' ORDER BY ' + grouped : ''} OPTION (MAXDOP 1)`;
  return { statement, parameters, binding, limit, keys: groups, requested: [...groups, ...args.metrics.map(m => m.as)] };
}
