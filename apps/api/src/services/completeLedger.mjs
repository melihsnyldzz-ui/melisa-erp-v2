// Statements must include every matching movement, including cancellations.
// Never turn a missing/repeated or changing page into a financial total.
export async function readCompleteLedger(fetchPage, query = {}) {
  const rows = [];
  const ids = new Set();
  let expectedTotal;
  let firstMeta;
  for (let page = 1; ; page += 1) {
    const response = await fetchPage({ ...query, page, limit: 500 });
    const total = Number(response?.meta?.total);
    const data = response?.data;
    const fail = () => {
      throw Object.assign(new Error('Cari hareketleri okunurken liste değişti veya eksik geldi. Ekstreyi yenileyin.'), {
        code: 'LEDGER_SNAPSHOT_INCOMPLETE', statusCode: 409,
      });
    };
    if (!Array.isArray(data) || !Number.isSafeInteger(total) || total < 0) fail();
    if (expectedTotal !== undefined && total !== expectedTotal) fail();
    expectedTotal = total;
    firstMeta ??= response.meta;
    for (const row of data) {
      const id = String(row.id ?? '');
      if (!id || ids.has(id)) fail();
      ids.add(id);
      rows.push(row);
    }
    if (rows.length === expectedTotal) return {
      data: rows,
      meta: { ...firstMeta, page: 1, limit: rows.length, total: expectedTotal, totalPages: 1,
        hasNextPage: false, hasPreviousPage: false, complete: true, pagesRead: page },
    };
    if (!data.length || rows.length > expectedTotal) fail();
  }
}
