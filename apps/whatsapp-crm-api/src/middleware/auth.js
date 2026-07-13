import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

function authError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function fetchErpUser(accessToken) {
  const response = await fetch(`${env.erpApi.baseUrl}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw authError(
      payload?.error?.code || 'WHATSAPP_CRM_ERP_AUTH_FAILED',
      payload?.error?.message || 'ERP auth verification failed',
      response.status || 401,
    );
  }

  return payload.data;
}

export async function requireCrmAuth(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      throw authError('WHATSAPP_CRM_AUTH_TOKEN_REQUIRED', 'Access token is required', 401);
    }

    if (!env.auth.jwtSecret) {
      throw authError('WHATSAPP_CRM_AUTH_SECRET_MISSING', 'CRM auth secret is not configured', 503);
    }

    jwt.verify(token, env.auth.jwtSecret);
    req.user = await fetchErpUser(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireCrmPermission(permissionKey) {
  return (req, res, next) => {
    const permissions = req.user?.permissions || [];

    if (!permissions.includes(permissionKey)) {
      return next(authError('WHATSAPP_CRM_PERMISSION_DENIED', `Permission required: ${permissionKey}`, 403));
    }

    return next();
  };
}
