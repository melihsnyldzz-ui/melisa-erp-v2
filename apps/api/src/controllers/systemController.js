import { env } from '../config/env.js';
import { ok } from '../utils/response.js';

export function getHealth(req, res) {
  return ok(res, {
    status: 'ok',
    service: 'melisa-erp-api',
    uptimeSeconds: Math.round(process.uptime()),
  }, {
    timestamp: new Date().toISOString(),
  });
}

export function getVersion(req, res) {
  return ok(res, {
    name: '@melisa-erp/api',
    version: env.apiVersion,
    nodeEnv: env.nodeEnv,
    integrations: {
      sql: env.sql.enabled,
      vega: env.vega.enabled,
      authDatabase: false,
    },
  });
}
