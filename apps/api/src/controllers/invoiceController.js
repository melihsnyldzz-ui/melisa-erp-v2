import { mockDataService } from '../services/mockDataService.js';
import { paginateRows } from '../utils/pagination.js';
import { ok } from '../utils/response.js';

export function getSalesInvoices(req, res) {
  const { data, meta } = paginateRows(mockDataService.getSalesInvoices(), req.query);
  return ok(res, data, {
    ...meta,
    source: 'mock',
  });
}

export function getPurchaseInvoices(req, res) {
  const { data, meta } = paginateRows(mockDataService.getPurchaseInvoices(), req.query);
  return ok(res, data, {
    ...meta,
    source: 'mock',
  });
}
