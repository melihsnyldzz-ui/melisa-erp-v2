import { env, getStartupWarnings } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info('Melisa ERP API listening', {
    port: env.port,
    apiVersion: env.apiVersion,
    nodeEnv: env.nodeEnv,
    sqlConfigured: env.sql.enabled,
    vegaEnabled: env.vega.enabled,
    authEnabled: true,
  });

  for (const warning of getStartupWarnings()) {
    logger.warn('Startup readiness warning', {
      category: 'startup_warning',
      warning,
    });
  }
});

function shutdown(signal) {
  logger.warn('API server shutdown requested', {
    signal,
  });
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
