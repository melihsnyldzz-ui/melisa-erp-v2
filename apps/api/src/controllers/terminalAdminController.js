import { getTerminalAdminOverview } from '../services/terminalAdminService.js';
import { fail, ok } from '../utils/response.js';

function terminalAdminFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Terminal admin request failed',
  );
}

export async function getTerminalAdmin(req, res) {
  try {
    const data = await getTerminalAdminOverview(req.query);
    return ok(res, data, { source: 'sql-terminal-admin' });
  } catch (error) {
    return terminalAdminFail(res, error, 'TERMINAL_ADMIN_OVERVIEW_FAILED');
  }
}
