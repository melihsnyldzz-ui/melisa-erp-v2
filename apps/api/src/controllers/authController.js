import {
  listTerminalLoginUsers,
  localPasswordlessAdminLogin,
  login,
  logout,
  refreshAccessToken,
  terminalLogin,
} from '../services/authService.js';
import { fail, ok } from '../utils/response.js';

function authFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Auth operation failed',
  );
}

export async function postLogin(req, res) {
  try {
    const data = await login(req.body, req.get('user-agent') || '');
    return ok(res, data, {
      source: 'sql-auth',
    });
  } catch (error) {
    return authFail(res, error, 'AUTH_LOGIN_FAILED');
  }
}

export async function getTerminalLoginUsers(req, res) {
  try {
    const data = await listTerminalLoginUsers(req.query.terminalCode);
    return ok(res, data, { source: 'sql-terminal-auth' });
  } catch (error) {
    return authFail(res, error, 'AUTH_TERMINAL_USERS_FAILED');
  }
}

export async function postTerminalLogin(req, res) {
  try {
    const data = await terminalLogin(req.body, req.get('user-agent') || '', { nativeTerminal: req.app.locals.nativeTerminalV1 === true });
    return ok(res, data, { source: 'sql-terminal-auth' });
  } catch (error) {
    return authFail(res, error, 'AUTH_TERMINAL_LOGIN_FAILED');
  }
}

export async function postLocalPasswordlessAdminLogin(req, res) {
  try {
    const data = await localPasswordlessAdminLogin();
    return ok(res, data, {
      source: 'local-passwordless-auth',
    });
  } catch (error) {
    return authFail(res, error, 'AUTH_LOCAL_PASSWORDLESS_FAILED');
  }
}

export async function postLogout(req, res) {
  try {
    const data = await logout(req.body?.refreshToken);
    return ok(res, data, {
      source: 'sql-auth',
    });
  } catch (error) {
    return authFail(res, error, 'AUTH_LOGOUT_FAILED');
  }
}

export async function postRefresh(req, res) {
  try {
    const data = await refreshAccessToken(req.body?.refreshToken, { nativeTerminal: req.app.locals.nativeTerminalV1 === true, terminalCode: req.body?.terminalCode });
    return ok(res, data, {
      source: 'sql-auth',
    });
  } catch (error) {
    return authFail(res, error, 'AUTH_REFRESH_FAILED');
  }
}

export async function getMe(req, res) {
  return ok(res, req.user, {
    source: 'jwt-auth',
  });
}
