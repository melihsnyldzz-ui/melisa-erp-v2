import { getInboxOverview } from '../services/inboxService.js';
import { ok } from '../utils/response.js';

export function getInboxController(req, res) {
  return ok(res, getInboxOverview(), {
    source: 'whatsapp-crm-inbox-skeleton',
    readOnly: true,
  });
}
