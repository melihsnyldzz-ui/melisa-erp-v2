import { normalizeSearchText } from '../utils/searchText.js';

export function demoMeta(extra = {}) {
  return { synthetic: true, readOnly: true, writePerformed: false,
    source: 'synthetic-demo', readAt: new Date().toISOString(),
    sourceContext: { environment: 'DEMO', server: 'Örnek veriler', database: 'Gerçek veri değil' }, ...extra };
}
export function demoList(rows, params = {}, extra = {}) {
  const positive = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
  const page = positive(params.page, 1), limit = Math.min(500, positive(params.limit ?? params.pageSize, 100));
  const totalPages = Math.max(1, Math.ceil(rows.length / limit));
  return { success: true, data: structuredClone(rows.slice((page - 1) * limit, page * limit)),
    meta: demoMeta({ page, limit, pageSize: limit, total: rows.length, totalPages,
      hasPreviousPage: page > 1, hasNextPage: page < totalPages, outOfRange: page > totalPages,
      pageState: page > totalPages ? 'PAGE_OUT_OF_RANGE' : 'OK', ...extra }) };
}
export function demoDetail(rows, id) {
  const row = rows.find(item => String(item.id) === String(id));
  if (!row) throw Object.assign(new Error('Örnek kayıt bulunamadı.'), { code: 'NOT_FOUND', status: 404 });
  return { success: true, data: structuredClone(row), meta: demoMeta() };
}
export function matchesDemoRow(row, params = {}, searchFields = []) {
  const query = normalizeSearchText(params.search || '');
  return (!query || searchFields.some(key => normalizeSearchText(row[key]).includes(query)))
    && (!params.currency || params.currency === 'ALL' || row.currency === params.currency)
    && (!params.dateFrom || row.documentDate >= params.dateFrom)
    && (!params.dateTo || row.documentDate <= params.dateTo)
    && (!params.status || params.status === 'ALL' || row.status === params.status);
}
