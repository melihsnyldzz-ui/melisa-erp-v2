import { mockDataService } from '../services/mockDataService.js';
import { ok } from '../utils/response.js';

export function getDashboardSummary(req, res) {
  return ok(res, mockDataService.getDashboardSummary(), {
    source: 'mock',
    refreshPolicySeconds: 30,
  });
}
