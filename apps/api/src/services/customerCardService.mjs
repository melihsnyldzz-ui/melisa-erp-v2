import {customerCardDto, customerCardError, parseCustomerCardId, parseCustomerCardQuery} from './customerCardModel.mjs';

export function createCustomerCardService({getStore = () => import('./customerCardReadStore.mjs')} = {}) {
  return {
    async list(query = {}) {
      const options = parseCustomerCardQuery(query);
      const store = await getStore();
      const result = await store.listCustomerCardRows(options);
      if (!Array.isArray(result?.rows) || !Number.isSafeInteger(result.total) || result.total < 0
          || result.rows.length !== Math.min(options.limit, Math.max(0, result.total - (options.page - 1) * options.limit))) {
        throw customerCardError();
      }
      const data = result.rows.map(row => customerCardDto(row));
      if (new Set(data.map(row => row.id)).size !== data.length) throw customerCardError();
      return {data, meta: {total: result.total, page: options.page, limit: options.limit,
        readOnly: true, sourceAsOf: '2026-09-30', freshLive: false}};
    },
    async detail(rawId) {
      const id = parseCustomerCardId(rawId);
      const store = await getStore();
      const row = await store.readCustomerCardRows(id);
      if (row == null) throw customerCardError('CUSTOMER_CARD_NOT_FOUND', 'Müşteri kartı bulunamadı.', 404);
      const data = customerCardDto(row, {detail: true});
      if (data.id !== id) throw customerCardError();
      return {data, meta: {readOnly: true, sourceAsOf: '2026-09-30', freshLive: false}};
    },
  };
}

export const customerCardService = createCustomerCardService();
