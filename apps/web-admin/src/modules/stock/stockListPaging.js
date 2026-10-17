// The stock API searches one phrase across its indexed fields. Other column
// filters narrow the displayed page; joining them would lose valid matches.
export function buildStockSearch(filters) {
  return [filters.quickSearch, filters.stockCode, filters.name, filters.brand, filters.category, filters.supplier]
    .map(value => String(value || '').trim()).find(Boolean) || '';
}

export async function readStockPage(fetchPage, options) {
  const response = await fetchPage(options);
  const data = response?.data;
  const raw = response?.meta;
  const page = Number(raw?.page);
  const total = Number(raw?.total);
  const limit = Number(raw?.limit) || (total === 0 ? options.limit : 0);
  const fail = () => { throw new Error('Stok sayfası eksik veya tutarsız geldi. Listeyi yenileyin.'); };
  if (response?.success === false || !Array.isArray(data) || raw?.total == null || raw?.page == null
    || !Number.isSafeInteger(total) || total < 0 || page !== options.page
    || !Number.isSafeInteger(limit) || limit < 1 || limit > options.limit || data.length > limit) fail();
  const ids = new Set();
  for (const row of data) {
    const id = String(row?.id ?? '');
    if (!id || ids.has(id)) fail();
    ids.add(id);
  }
  // SQL's window-count query returns no total when a deleted last page is empty.
  if (page > 1 && data.length === 0) return { resetToFirst: true };
  const expectedCount = Math.min(limit, Math.max(total - ((page - 1) * limit), 0));
  if (data.length !== expectedCount) fail();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { data, meta: { ...raw, page, total, limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
}

export function stockPageRange(meta, rowCount) {
  if (!meta) return null;
  return { first: rowCount ? (meta.page - 1) * meta.limit + 1 : 0, last: rowCount ? (meta.page - 1) * meta.limit + rowCount : 0 };
}
