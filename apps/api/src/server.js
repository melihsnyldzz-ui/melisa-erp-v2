import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Melisa ERP API listening on http://127.0.0.1:${env.port}`);
  console.log(`API version: ${env.apiVersion}`);
  console.log(`SQL integration: ${env.sql.enabled ? 'configured' : 'disabled'}`);
  console.log('Vega integration: disabled');
  console.log('Auth integration: enabled');
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down API server`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
