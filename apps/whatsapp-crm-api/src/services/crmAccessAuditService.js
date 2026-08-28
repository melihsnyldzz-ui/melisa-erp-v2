import crypto from 'node:crypto';
import { isPostgresConfigured, query } from './db.js';
import { logger } from '../utils/logger.js';

export async function recordCrmAccessAudit({ success, user, requestId, ipAddress, reason = '' }) {
  const payload = {
    success: Boolean(success),
    userId: user?.id || null,
    username: user?.username || '',
    requestId: requestId || '',
    ipAddress: ipAddress || '',
    reason: reason || '',
  };

  logger.info('WhatsApp CRM access attempt', payload);
  if (!isPostgresConfigured()) return { persistent: false };

  await query(`
    INSERT INTO crm_events (provider, event_id, event_type, instance_key, payload, processed_at)
    VALUES ('system', $1, $2, NULL, $3::jsonb, NOW())
  `, [
    `crm-access:${crypto.randomUUID()}`,
    success ? 'crm.access.unlocked' : 'crm.access.denied',
    JSON.stringify(payload),
  ]);

  return { persistent: true };
}
