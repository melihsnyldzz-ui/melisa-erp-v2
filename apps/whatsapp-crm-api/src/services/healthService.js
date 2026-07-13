import { env, getStartupWarnings } from '../config/env.js';
import { getDbStatus } from './db.js';
import { getIdempotencyStoreStatus } from './idempotencyStore.js';

export function getHealth() {
  return {
    status: 'ok',
    appName: env.appName,
    provider: env.whatsapp.provider,
    erpApiBaseUrl: env.erpApi.baseUrl,
    sendEnabled: env.whatsapp.sendEnabled,
    testNumberOnly: env.whatsapp.testNumberOnly,
    postgres: getDbStatus(),
    idempotency: getIdempotencyStoreStatus(),
    warnings: getStartupWarnings(),
  };
}
