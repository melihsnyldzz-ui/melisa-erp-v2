// Reference selectors must not silently stop at the API's first page.
// Return only a complete list; a missing/repeated page leaves the form unready.
export async function fetchAllPages(fetchPage, { limit = 200, ...filters } = {}) {
  const rows = [];
  const seen = new Set();
  let expectedTotal;

  for (let page = 1; ; page += 1) {
    const response = await fetchPage({ ...filters, page, limit });
    const data = response?.data;
    const rawTotal = response?.meta?.total;
    // Missing totals are unknown, not an explicit empty list. Validate the
    // primitive before Number() can turn null, blanks or booleans into counts.
    const hasTotal = typeof rawTotal === 'number'
      || (typeof rawTotal === 'string' && rawTotal.trim() !== '');
    const total = hasTotal ? Number(rawTotal) : NaN;
    if (!Array.isArray(data) || !Number.isSafeInteger(total) || total < 0) {
      throw new Error('Cari listesinin toplam kayıt bilgisi okunamadı. Yenileyin.');
    }
    if (expectedTotal !== undefined && total !== expectedTotal) {
      throw new Error('Cari listesi yüklenirken değişti. Tam liste için yenileyin.');
    }
    expectedTotal = total;

    for (const row of data) {
      const key = String(row.id ?? '');
      if (!key || seen.has(key)) {
        throw new Error('Cari listesi eksik veya tekrarlı geldi. Yenileyin.');
      }
      seen.add(key);
      rows.push(row);
    }
    if (rows.length === expectedTotal) return rows;
    if (data.length === 0 || rows.length > expectedTotal) {
      throw new Error('Cari listesinin bütün sayfaları alınamadı. Yenileyin.');
    }
  }
}
