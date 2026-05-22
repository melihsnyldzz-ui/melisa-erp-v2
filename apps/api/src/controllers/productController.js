import { mockDataService } from '../services/mockDataService.js';
import { paginateRows } from '../utils/pagination.js';
import { ok } from '../utils/response.js';

export function getProducts(req, res) {
  const { data, meta } = paginateRows(mockDataService.getProducts(), req.query);
  return ok(res, data, {
    ...meta,
    source: 'mock',
  });
}
