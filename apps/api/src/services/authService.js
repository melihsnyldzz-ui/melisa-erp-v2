import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { env } from '../config/env.js';
import { getSqlPool } from '../config/database.js';
import { applyRolePermissionDefaults, expandPermissions } from './permissionCatalog.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function makeAuthError(code, message, statusCode = 401) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function assertAuthSecretsConfigured() {
  if (!env.auth.jwtSecret || !env.auth.refreshSecret) {
    throw makeAuthError('AUTH_SECRET_NOT_CONFIGURED', 'Auth secrets are not configured', 503);
  }
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function getRefreshExpiresAt() {
  const match = String(env.auth.refreshExpiresIn).match(/^(\d+)([dhm])$/i);
  const amount = match ? Number(match[1]) : 7;
  const unit = match ? match[2].toLowerCase() : 'd';
  const milliseconds = unit === 'h'
    ? amount * 60 * 60 * 1000
    : unit === 'm'
      ? amount * 60 * 1000
      : amount * 24 * 60 * 60 * 1000;

  return new Date(Date.now() + milliseconds);
}

function toUserDto(row, permissions = []) {
  const expandedPermissions = applyRolePermissionDefaults(permissions, row.role_code);

  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    role: {
      id: Number(row.role_id),
      code: row.role_code,
      name: row.role_name,
    },
    permissions: expandedPermissions,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role.code,
    },
    env.auth.jwtSecret,
    { expiresIn: env.auth.accessExpiresIn },
  );
}

async function getPermissionKeys(request, roleId) {
  const result = await request
    .input('permissionRoleId', sql.BigInt, roleId)
    .query(`
      SELECT
        permission_key,
        can_view,
        can_create,
        can_update,
        can_approve
      FROM dbo.permissions
      WHERE role_id = @permissionRoleId
        AND (can_view = 1 OR can_create = 1 OR can_update = 1 OR can_approve = 1)
      ORDER BY permission_key ASC;
    `);

  return expandPermissions(result.recordset || []);
}

export async function getUserById(userId) {
  const id = Number(userId);

  if (!Number.isInteger(id) || id < 1) {
    throw makeAuthError('AUTH_USER_INVALID', 'User id is invalid', 401);
  }

  const pool = await getSqlPool();
  const userResult = await pool.request()
    .input('userId', sql.BigInt, id)
    .query(`
      SELECT TOP (1)
        u.id,
        u.username,
        u.display_name,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        u.is_active
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      WHERE u.id = @userId;
    `);

  const row = userResult.recordset?.[0];

  if (!row || !row.is_active) {
    throw makeAuthError('AUTH_USER_INACTIVE', 'User is inactive or not found', 401);
  }

  const permissions = await getPermissionKeys(pool.request(), row.role_id);
  return toUserDto(row, permissions);
}

export async function login({ username, password }, userAgent = '') {
  assertAuthSecretsConfigured();

  const normalizedUsername = trimText(username);
  const normalizedPassword = typeof password === 'string' ? password : '';

  if (!normalizedUsername || !normalizedPassword) {
    throw makeAuthError('AUTH_CREDENTIALS_REQUIRED', 'Username and password are required', 400);
  }

  const pool = await getSqlPool();
  const userResult = await pool.request()
    .input('username', sql.NVarChar(80), normalizedUsername)
    .query(`
      SELECT TOP (1)
        u.id,
        u.username,
        u.password_hash,
        u.display_name,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        u.is_active
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      WHERE u.username = @username;
    `);

  const row = userResult.recordset?.[0];
  const passwordOk = row?.password_hash
    ? await bcrypt.compare(normalizedPassword, row.password_hash)
    : false;

  if (!row || !row.is_active || !passwordOk) {
    throw makeAuthError('AUTH_INVALID_CREDENTIALS', 'Username or password is invalid', 401);
  }

  const permissions = await getPermissionKeys(pool.request(), row.role_id);
  const user = toUserDto(row, permissions);
  const accessToken = signAccessToken(user);

  if (env.sql.readOnly) {
    return {
      user,
      accessToken,
      refreshToken: null,
      tokenType: 'Bearer',
      expiresIn: env.auth.accessExpiresIn,
      readOnlySession: true,
    };
  }

  assertMelisaWriteEnabled();

  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshExpiresAt = getRefreshExpiresAt();

  await pool.request()
    .input('loginUserId', sql.BigInt, user.id)
    .input('refreshTokenHash', sql.NVarChar(255), refreshTokenHash)
    .input('refreshExpiresAt', sql.DateTime2, refreshExpiresAt)
    .input('userAgent', sql.NVarChar(300), trimText(userAgent).slice(0, 300) || null)
    .query(`
      INSERT INTO dbo.auth_refresh_tokens (
        user_id,
        token_hash,
        expires_at,
        user_agent
      )
      VALUES (
        @loginUserId,
        @refreshTokenHash,
        @refreshExpiresAt,
        @userAgent
      );

      UPDATE dbo.users
      SET last_login_at = SYSUTCDATETIME()
      WHERE id = @loginUserId;
    `);

  return {
    user,
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.auth.accessExpiresIn,
  };
}

async function getTerminalLoginContext(terminalCode) {
  const normalizedTerminalCode = trimText(terminalCode);
  if (!normalizedTerminalCode) {
    throw makeAuthError('TERMINAL_CODE_REQUIRED', 'Terminal code is required', 400);
  }

  const pool = await getSqlPool();
  const schemaResult = await pool.request().query(`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.employees', N'U') IS NOT NULL
       AND COL_LENGTH(N'dbo.employees', N'user_id') IS NOT NULL
      THEN 1 ELSE 0
    END AS is_ready;
  `);

  if (!schemaResult.recordset?.[0]?.is_ready) {
    throw makeAuthError('TERMINAL_PERSONNEL_SCHEMA_MISSING', 'Terminal personnel schema is not installed', 503);
  }

  const deviceResult = await pool.request()
    .input('terminalCode', sql.NVarChar(80), normalizedTerminalCode)
    .query(`
      SELECT TOP (1) id, device_code, device_name, is_active
      FROM dbo.terminal_devices
      WHERE device_code = @terminalCode;
    `);
  const device = deviceResult.recordset?.[0];

  if (!device || !device.is_active) {
    throw makeAuthError('TERMINAL_DEVICE_NOT_ACTIVE', 'Terminal device is inactive or not registered', 403);
  }

  const usersResult = await pool.request().query(`
    SELECT DISTINCT
      u.id,
      u.username,
      u.display_name,
      e.full_name AS employee_name,
      r.code AS role_code,
      r.name AS role_name
    FROM dbo.users u
    INNER JOIN dbo.roles r ON r.id = u.role_id AND r.is_active = 1
    INNER JOIN dbo.employees e ON e.user_id = u.id
    WHERE u.is_active = 1
      AND e.is_active = 1
    ORDER BY u.display_name ASC, u.username ASC;
  `);

  return {
    device: {
      code: device.device_code,
      name: device.device_name,
    },
    users: usersResult.recordset.map((row) => ({
      id: Number(row.id),
      username: row.username,
      displayName: row.employee_name || row.display_name,
    })),
  };
}

export async function listTerminalLoginUsers(terminalCode) {
  return getTerminalLoginContext(terminalCode);
}

export async function terminalLogin({ username, password, terminalCode }, userAgent = '') {
  const context = await getTerminalLoginContext(terminalCode);
  const normalizedUsername = trimText(username);
  const normalizedUsernameKey = normalizedUsername.toLocaleLowerCase('tr-TR');
  const allowed = context.users.some(
    (user) => String(user.username || '').toLocaleLowerCase('tr-TR') === normalizedUsernameKey,
  );

  if (!allowed) {
    throw makeAuthError('TERMINAL_USER_NOT_ALLOWED', 'User is not enabled for terminal login', 403);
  }

  const session = await login({ username: normalizedUsername, password }, userAgent);
  return {
    ...session,
    terminal: context.device,
  };
}

export async function localPasswordlessAdminLogin() {
  assertAuthSecretsConfigured();

  if (env.nodeEnv === 'production' || !env.auth.localPasswordlessLogin) {
    throw makeAuthError('AUTH_LOCAL_PASSWORDLESS_DISABLED', 'Local passwordless login is disabled', 403);
  }

  const pool = await getSqlPool();
  const userResult = await pool.request()
    .input('username', sql.NVarChar(80), 'admin')
    .query(`
      SELECT TOP (1)
        u.id,
        u.username,
        u.display_name,
        u.role_id,
        r.code AS role_code,
        r.name AS role_name,
        u.is_active
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      WHERE u.username = @username;
    `);

  const row = userResult.recordset?.[0];

  if (!row || !row.is_active) {
    throw makeAuthError('AUTH_USER_INACTIVE', 'Admin user is inactive or not found', 401);
  }

  const permissions = await getPermissionKeys(pool.request(), row.role_id);
  const user = toUserDto(row, permissions);

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken: null,
    tokenType: 'Bearer',
    expiresIn: env.auth.accessExpiresIn,
    localPasswordlessSession: true,
  };
}

export async function logout(refreshToken) {
  if (!refreshToken) {
    return { revoked: false };
  }

  assertMelisaWriteEnabled();

  const pool = await getSqlPool();
  const result = await pool.request()
    .input('refreshTokenHashForLogout', sql.NVarChar(255), hashRefreshToken(refreshToken))
    .query(`
      UPDATE dbo.auth_refresh_tokens
      SET revoked_at = SYSUTCDATETIME()
      WHERE token_hash = @refreshTokenHashForLogout
        AND revoked_at IS NULL;
    `);

  return {
    revoked: Number(result.rowsAffected?.[0] || 0) > 0,
  };
}

export async function refreshAccessToken(refreshToken) {
  assertMelisaWriteEnabled();
  assertAuthSecretsConfigured();

  if (!refreshToken) {
    throw makeAuthError('AUTH_REFRESH_REQUIRED', 'Refresh token is required', 401);
  }

  const pool = await getSqlPool();
  const tokenResult = await pool.request()
    .input('refreshTokenHashForRefresh', sql.NVarChar(255), hashRefreshToken(refreshToken))
    .query(`
      SELECT TOP (1)
        user_id
      FROM dbo.auth_refresh_tokens
      WHERE token_hash = @refreshTokenHashForRefresh
        AND revoked_at IS NULL
        AND expires_at > SYSUTCDATETIME();
    `);

  const tokenRow = tokenResult.recordset?.[0];

  if (!tokenRow) {
    throw makeAuthError('AUTH_REFRESH_INVALID', 'Refresh token is invalid or expired', 401);
  }

  const user = await getUserById(tokenRow.user_id);
  const accessToken = signAccessToken(user);

  return {
    user,
    accessToken,
    tokenType: 'Bearer',
    expiresIn: env.auth.accessExpiresIn,
  };
}

export function verifyAccessToken(token) {
  assertAuthSecretsConfigured();

  try {
    return jwt.verify(token, env.auth.jwtSecret);
  } catch (error) {
    throw makeAuthError(
      error.name === 'TokenExpiredError' ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      'Access token is invalid or expired',
      401,
    );
  }
}
