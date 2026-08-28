import { env, getStartupWarnings } from '../config/env.js';
import { getDbStatus } from './db.js';
import { getIdempotencyStoreStatus } from './idempotencyStore.js';

export function getHealth() {
  return {
    status: 'ok',
    appName: env.appName,
    secondaryLockEnabled: env.crmAccess.enabled,
    provider: env.whatsapp.provider,
    erpApiBaseUrl: env.erpApi.baseUrl,
    sendEnabled: env.whatsapp.sendEnabled && (env.whatsapp.testNumberOnly || env.whatsapp.liveSendApproved),
    testNumberOnly: env.whatsapp.testNumberOnly,
    liveSendApproved: env.whatsapp.liveSendApproved,
    inboxSource: env.chatwoot.inboxReadEnabled ? 'chatwoot-crm' : 'postgres',
    chatwootInboxFallbackEnabled: env.chatwoot.inboxFallbackEnabled,
    chatwootPersonnelMappingCount: env.chatwoot.agentPersonnelMap.size,
    chatwootGroupsVisible: env.chatwoot.includeGroups,
    postgres: getDbStatus(),
    idempotency: getIdempotencyStoreStatus(),
    warnings: getStartupWarnings(),
  };
}
