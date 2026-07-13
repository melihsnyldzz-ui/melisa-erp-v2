import { env, getStartupWarnings } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info('Melisa WhatsApp CRM API listening', {
    port: env.port,
    appName: env.appName,
    provider: env.whatsapp.provider,
    erpApiBaseUrl: env.erpApi.baseUrl,
    sendEnabled: env.whatsapp.sendEnabled,
    testNumberOnly: env.whatsapp.testNumberOnly,
  });

  for (const warning of getStartupWarnings()) {
    logger.warn('WhatsApp CRM startup readiness warning', {
      category: 'startup_warning',
      warning,
    });
  }
});

function shutdown(signal) {
  logger.warn('WhatsApp CRM API shutdown requested', { signal });
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
