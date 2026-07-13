import { getWhatsAppProvider } from '../providers/index.js';
import { markEventOnce } from '../services/idempotencyStore.js';
import { created, ok } from '../utils/response.js';

export async function postEvolutionWebhook(req, res, next) {
  try {
    const provider = getWhatsAppProvider();
    const normalizedEvent = provider.normalizeWebhook(req.body, req.headers);
    const idempotency = await markEventOnce(normalizedEvent.eventId);

    if (!idempotency.firstSeen) {
      return ok(res, {
        accepted: true,
        duplicate: true,
        eventId: normalizedEvent.eventId,
      }, {
        source: 'whatsapp-crm-webhook',
        idempotent: true,
      });
    }

    return created(res, {
      accepted: true,
      duplicate: false,
      event: normalizedEvent,
    }, {
      source: 'whatsapp-crm-webhook',
      idempotent: true,
      persistence: 'pending-postgres-implementation',
    });
  } catch (error) {
    return next(error);
  }
}
