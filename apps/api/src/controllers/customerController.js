import { mockDataService } from '../services/mockDataService.js';
import { paginateRows } from '../utils/pagination.js';
import { ok } from '../utils/response.js';

export function getCustomers(req, res) {
  const { data, meta } = paginateRows(mockDataService.getCustomers(), req.query);
  return ok(res, data, {
    ...meta,
    source: 'mock',
  });
}
