import { getAuditCoverage, listAuditLogs, listAuditMetadataEvents, listVegaProductMetadata } from '../services/auditService.js';
import { fail, ok } from '../utils/response.js';

function auditFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Audit query failed',
  );
}

export async function getAuditLogs(req, res) {
  try {
    const { data, meta } = await listAuditLogs(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return auditFail(res, error, 'AUDIT_LOGS_FAILED');
  }
}

export async function getAuditCoverageReport(req, res) {
  try {
    const data = await getAuditCoverage();
    return ok(res, data, {
      source: 'sql-audit-coverage',
      readOnly: true,
    });
  } catch (error) {
    return auditFail(res, error, 'AUDIT_COVERAGE_FAILED');
  }
}

export async function getAuditMetadataEvents(req, res) {
  try {
    const { data, meta } = await listAuditMetadataEvents(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return auditFail(res, error, 'AUDIT_METADATA_EVENTS_FAILED');
  }
}

export async function getVegaProductMetadata(req, res) {
  try {
    const { data, meta } = await listVegaProductMetadata(req.query);
    return ok(res, data, meta);
  } catch (error) {
    return auditFail(res, error, 'VEGA_PRODUCT_METADATA_FAILED');
  }
}
