import { checkSqlHealth, getTablesPreview } from '../services/sqlHealthService.js';
import { ok } from '../utils/response.js';

function sqlConnectionFailed(res, result) {
  return res.status(503).json({
    success: false,
    error: result.error,
    data: result.data,
    meta: {
      ...result.meta,
      connectionOk: false,
    },
  });
}

export async function getSqlHealth(req, res) {
  const result = await checkSqlHealth();

  if (!result.connected) {
    return sqlConnectionFailed(res, result);
  }

  return ok(res, result.data, {
    ...result.meta,
    connectionOk: result.connected,
  });
}

export async function getSqlTablesPreview(req, res) {
  const result = await getTablesPreview();

  if (!result.connected) {
    return sqlConnectionFailed(res, result);
  }

  return ok(res, result.data, {
    ...result.meta,
    connectionOk: result.connected,
  });
}
