import {
  createAuthAdminUser,
  getAuthAdminOverview,
  resetAuthAdminUserPassword,
  updateUserAccess,
} from '../services/authAdminService.js';
import { created, fail, ok } from '../utils/response.js';

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

export async function postAuthAdminUser(req, res) {
  try {
    const data = await createAuthAdminUser(req.body, req.user);
    return created(res, data, { source: 'sql-auth-admin' });
  } catch (error) {
    return authAdminFail(res, error, 'AUTH_ADMIN_USER_CREATE_FAILED');
  }
}

export async function patchAuthAdminUserPassword(req, res) {
  try {
    const data = await resetAuthAdminUserPassword(req.params.id, req.body, req.user);
    return ok(res, data, { source: 'sql-auth-admin' });
  } catch (error) {
    return authAdminFail(res, error, 'AUTH_ADMIN_PASSWORD_RESET_FAILED');
  }
}
