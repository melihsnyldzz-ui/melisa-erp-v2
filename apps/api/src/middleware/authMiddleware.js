import { getUserById, verifyAccessToken,verifyNormalTestAccessSession } from '../services/authService.js';
import { resolveTestAdminUser } from '../services/canonicalTestAdminSession.mjs';

function authError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw authError('AUTH_TOKEN_REQUIRED', 'Access token is required', 401);
    }

    const payload = verifyAccessToken(token);
    const currentUser=await getUserById(payload.sub);
    verifyNormalTestAccessSession(payload,currentUser);
    req.user = resolveTestAdminUser(req, payload, currentUser);
    req.authContext = Object.freeze({ nativeTerminalCode: typeof payload.nativeTerminalCode === 'string' ? payload.nativeTerminalCode : null });
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];

    if (!permissions.includes(permissionKey)) {
      return next(authError('AUTH_PERMISSION_DENIED', `Permission required: ${permissionKey}`, 403));
    }

    return next();
  };
}

export function requireAnyPermission(permissionKeys = []) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];
    const allowed = permissionKeys.some((permissionKey) => permissions.includes(permissionKey));

    if (!allowed) {
      return next(authError('AUTH_PERMISSION_DENIED', `Permission required: ${permissionKeys.join(' or ')}`, 403));
    }

    return next();
  };
}
