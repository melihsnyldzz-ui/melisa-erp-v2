import {supplierCardDto, supplierCardError, parseSupplierCardId, parseSupplierCardQuery} from './supplierCardModel.mjs';

export function createSupplierCardService({getStore = () => import('./supplierCardReadStore.mjs')} = {}) {
  return {
    async list(query = {}) {
      const options = parseSupplierCardQuery(query);
      const store = await getStore();
      const result = await store.listSupplierCardRows(options);
      if (!Array.isArray(result?.rows) || !Number.isSafeInteger(result.total) || result.total < 0
          || result.rows.length !== Math.min(options.limit, Math.max(0, result.total - (options.page - 1) * options.limit))) {
        throw supplierCardError();
      }
      const data = result.rows.map(row => supplierCardDto(row));
      if (new Set(data.map(row => row.id)).size !== data.length) throw supplierCardError();
      return {data, meta: {total: result.total, page: options.page, limit: options.limit,
        readOnly: true, sourceAsOf: '2026-09-30', freshLive: false}};
    },
    async detail(rawId) {
      const id = parseSupplierCardId(rawId);
      const store = await getStore();
      const row = await store.readSupplierCardRows(id);
      if (row == null) throw supplierCardError('SUPPLIER_CARD_NOT_FOUND', 'Tedarikçi kartı bulunamadı.', 404);
      const data = supplierCardDto(row, {detail: true});
      if (data.id !== id) throw supplierCardError();
      return {data, meta: {readOnly: true, sourceAsOf: '2026-09-30', freshLive: false}};
    },
  };
}

export const supplierCardService = createSupplierCardService();
