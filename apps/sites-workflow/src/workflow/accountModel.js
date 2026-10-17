import { normalizePage } from '../modules/vega/vegaReadModel.js';
export const normalizeSearch = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ı/g, 'i');
export function matchesAccount(row, query, selectedCurrency) {
  return (!selectedCurrency || String(row.currency) === selectedCurrency) && normalizeSearch(`${row.accountCode ?? ''} ${row.name ?? ''}`).includes(normalizeSearch(query));
}
export async function loadAccountPage(client, cursor, options, seen) {
  const response = await client.get('/api/vega-read/accounts', { limit: 50, cursor }, options);
  const result = normalizePage(response, 'account-card', { cursor });
  const pagination = result.meta.pagination;
  if (!pagination || typeof pagination.hasMore !== 'boolean') throw new Error('Cari sayfalama bilgisi doğrulanamadı.');
  const nextCursor = pagination.nextCursor;
  if (pagination.hasMore && seen.has(nextCursor)) throw new Error('Cari listesinde tekrar eden sayfa algılandı. Listeyi yenileyin.');
  if (pagination.hasMore) seen.add(nextCursor);
  return { rows: result.rows, nextCursor, complete: !pagination.hasMore, readAt: Number.isFinite(Date.parse(result.meta.readAt)) ? result.meta.readAt : null };
}
