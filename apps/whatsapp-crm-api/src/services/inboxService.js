import { listInboxOverview } from '../repositories/crmRepository.js';
import { env } from '../config/env.js';
import { listChatwootInboxOverview } from './chatwootInboxService.js';

export async function getInboxOverview(options = {}) {
  if (!env.chatwoot.inboxReadEnabled) {
    return listInboxOverview(options);
  }

  try {
    return await listChatwootInboxOverview(options);
  } catch (error) {
    if (!env.chatwoot.inboxFallbackEnabled) throw error;

    const fallback = await listInboxOverview(options);
    return {
      ...fallback,
      integration: {
        requestedSource: 'chatwoot-crm',
        activeSource: fallback.summary?.source || 'postgres',
        fallback: true,
        errorCode: error.code || 'WHATSAPP_CRM_CHATWOOT_READ_FAILED',
      },
      boundaries: [
        ...(fallback.boundaries || []),
        'Chatwoot could not be read; the existing local inbox fallback is active.',
      ],
    };
  }
}
