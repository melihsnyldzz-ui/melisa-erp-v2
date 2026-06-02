import { getAuthAdminOverview, updateUserAccess } from '../services/authAdminService.js';
import { fail, ok } from '../utils/response.js';

function authAdminFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Auth admin request failed',
  );
}

export async function getAuthAdmin(req, res) {
  try {
    const data = await getAuthAdminOverview();
    return ok(res, data, { source: 'sql-auth-admin' });
  } catch (error) {
    return authAdminFail(res, error, 'AUTH_ADMIN_OVERVIEW_FAILED');
  }
}

export async function patchAuthAdminUser(req, res) {
  try {
    const data = await updateUserAccess(req.params.id, req.body, req.user);
    return ok(res, data, { source: 'sql-auth-admin' });
  } catch (error) {
    return authAdminFail(res, error, 'AUTH_ADMIN_USER_UPDATE_FAILED');
  }
}
