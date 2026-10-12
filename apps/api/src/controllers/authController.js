import {
  listTerminalLoginUsers,
  localPasswordlessAdminLogin,
  login,
  logout,
  refreshAccessToken,
  terminalLogin,
  confirmProtectedNormalSession,
} from '../services/authService.js';
import { fail, ok } from '../utils/response.js';
import * as semihBrowserAuth from '../services/authService.js';
import {createSemihBrowserSessionHandlers} from '../services/semihBrowserSession.mjs';

export const semihBrowserSessionHandlers=createSemihBrowserSessionHandlers({auth:semihBrowserAuth,ok,fail});

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

export async function postProtectedSessionConfirm(req,res) {
  try {
    if(!req.body||Object.getPrototypeOf(req.body)!==Object.prototype||Object.keys(req.body).join(',')!=='refreshToken') {
      throw Object.assign(new Error('Only refreshToken is accepted'),{code:'AUTH_SESSION_CONFIRM_BODY_INVALID',statusCode:400});
    }
    const [type,accessToken]=String(req.get('authorization')||'').split(' ');
    if(type!=='Bearer'||!accessToken)throw Object.assign(new Error('Access token is required'),{code:'AUTH_TOKEN_REQUIRED',statusCode:401});
    return ok(res,await confirmProtectedNormalSession(accessToken,req.body.refreshToken),{source:'protected-normal-auth'});
  }catch(error){return authFail(res,error,'AUTH_SESSION_CONFIRM_FAILED');}
}
