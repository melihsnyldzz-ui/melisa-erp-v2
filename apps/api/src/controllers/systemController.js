import { env } from '../config/env.js';
import { getMonitoringSummaryData } from '../services/monitoringService.js';
import { fail, ok } from '../utils/response.js';

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
      authDatabase: true,
    },
  });
}

export async function getMonitoringSummary(req, res) {
  try {
    const data = await getMonitoringSummaryData();
    return ok(res, data, {
      source: 'sql-monitoring-aggregate',
      readOnly: true,
      requestId: req.requestId,
    });
  } catch (error) {
    return fail(res, error.statusCode || 503, error.code || 'MONITORING_SUMMARY_FAILED', 'Monitoring summary query failed', {
      requestId: req.requestId,
    });
  }
}
