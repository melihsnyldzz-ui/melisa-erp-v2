import { getHealth } from '../services/healthService.js';
import { ok } from '../utils/response.js';

export function getHealthController(req, res) {
  return ok(res, getHealth(), {
    source: 'whatsapp-crm-health',
  });
}
