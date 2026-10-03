import { fetchAllPages } from './fetchAllPages.js';

export async function fetchCompleteLedger(fetchPage, query = {}) {
  let firstMeta;
  const data = await fetchAllPages(async params => {
    const response = await fetchPage(params);
    firstMeta ??= response.meta;
    return response;
  }, { ...query, limit: 500 });
  return { data, meta: { ...firstMeta, page: 1, limit: data.length, total: data.length,
    totalPages: 1, hasNextPage: false, hasPreviousPage: false, complete: true } };
}
