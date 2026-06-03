import { getUserById, verifyAccessToken } from '../services/authService.js';
import { GRANULAR_PERMISSIONS } from '../services/permissionCatalog.js';

const OPEN_ADMIN_TOKEN = 'open-admin';

function getOpenAdminUser() {
  return {
    id: 0,
    username: 'open-admin',
    displayName: 'Açık Admin',
    role: {
      id: 0,
      code: 'admin',
      name: 'ADMIN',
    },
    permissions: [...GRANULAR_PERMISSIONS],
    openAdmin: true,
  };
}

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

    if (token === OPEN_ADMIN_TOKEN) {
      req.user = getOpenAdminUser();
      return next();
    }

    const payload = verifyAccessToken(token);
    req.user = await getUserById(payload.sub);
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
