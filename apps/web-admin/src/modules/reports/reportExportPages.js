export async function fetchAllExportPages(fetchPage, params, { pageSize = 100, maxRows = 20000 } = {}) {
  const rows = [];
  let page = 1;
  let lastMeta = {};
  let hasMore = false;
  while (rows.length < maxRows) {
    const response = await fetchPage({ ...params, page, limit: pageSize });
    const pageRows = response.data;
    if (!Array.isArray(pageRows)) throw new Error('Rapor satırları okunamadı.');
    lastMeta = response.meta || {};
    const total = lastMeta.total == null ? null : Number(lastMeta.total);
    const effectiveLimit = Number(lastMeta.limit || pageSize);
    if (Number(lastMeta.page || page) !== page) throw new Error('Rapor sayfası ilerlemedi.');
    rows.push(...pageRows);
    hasMore = total !== null && Number.isFinite(total)
      ? rows.length < total
      : typeof lastMeta.hasNext === 'boolean' ? lastMeta.hasNext
        : pageRows.length >= effectiveLimit;
    if (!pageRows.length && hasMore) throw new Error('Raporun tüm satırları alınamadı. Filtreyi yeniden çalıştırın.');
    if (!hasMore) break;
    page += 1;
  }
  return { data: rows.slice(0, maxRows), meta: { ...lastMeta, total: lastMeta.total ?? rows.length, loaded: Math.min(rows.length, maxRows), truncated: hasMore || rows.length > maxRows } };
}
