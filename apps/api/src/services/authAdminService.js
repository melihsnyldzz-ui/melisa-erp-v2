import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';
import { createManagedAuthUserCore, normalizeManagedAuthUser } from './createManagedAuthUserCore.mjs';

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeUsername(value) {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
    throw makeServiceError('AUTH_ADMIN_USERNAME_INVALID', 'Username must be 3-80 characters and use letters, numbers, dot, dash or underscore');
  }
  return username;
}

function normalizeDisplayName(value) {
  const displayName = typeof value === 'string' ? value.trim().slice(0, 150) : '';
  if (!displayName) {
    throw makeServiceError('AUTH_ADMIN_DISPLAY_NAME_REQUIRED', 'Display name is required');
  }
  return displayName;
}

function normalizePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8 || password.length > 128) {
    throw makeServiceError('AUTH_ADMIN_PASSWORD_INVALID', 'Password must be between 8 and 128 characters');
  }
  return password;
}

function toUserDto(row) {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    roleId: Number(row.role_id),
    roleCode: row.role_code,
    roleName: row.role_name,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRoleDto(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description || '',
    isSystemRole: Boolean(row.is_system_role),
    isActive: Boolean(row.is_active),
    userCount: Number(row.user_count || 0),
  };
}

function toPermissionDto(row) {
  return {
    id: Number(row.id),
    roleId: Number(row.role_id),
    roleCode: row.role_code,
    roleName: row.role_name,
    permissionKey: row.permission_key,
    canView: Boolean(row.can_view),
    canCreate: Boolean(row.can_create),
    canUpdate: Boolean(row.can_update),
    canDelete: Boolean(row.can_delete),
    canApprove: Boolean(row.can_approve),
  };
}

function toAuditDto(row) {
  return {
    id: Number(row.id),
    actorUserId: row.actor_user_id ? Number(row.actor_user_id) : null,
    actorName: row.actor_name || 'SYSTEM',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ? Number(row.entity_id) : null,
    reason: row.reason || '',
    source: row.source || '',
    createdAt: row.created_at,
  };
}

export async function getAuthAdminOverview() {
  const pool = await getSqlPool();
  const [usersResult, rolesResult, permissionsResult, auditResult] = await Promise.all([
    pool.request().query(`
      SELECT
        u.id,
        u.username,
        u.display_name,
        u.role_id,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        r.code AS role_code,
        r.name AS role_name
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      ORDER BY u.is_active DESC, u.username ASC;
    `),
    pool.request().query(`
      SELECT
        r.id,
        r.code,
        r.name,
        r.description,
        r.is_system_role,
        r.is_active,
        COUNT(u.id) AS user_count
      FROM dbo.roles r
      LEFT JOIN dbo.users u ON u.role_id = r.id
      GROUP BY r.id, r.code, r.name, r.description, r.is_system_role, r.is_active
      ORDER BY r.is_active DESC, r.code ASC;
    `),
    pool.request().query(`
      SELECT
        p.id,
        p.role_id,
        r.code AS role_code,
        r.name AS role_name,
        p.permission_key,
        p.can_view,
        p.can_create,
        p.can_update,
        p.can_delete,
        p.can_approve
      FROM dbo.permissions p
      INNER JOIN dbo.roles r ON r.id = p.role_id
      ORDER BY r.code ASC, p.permission_key ASC;
    `),
    pool.request().query(`
      SELECT TOP 80
        a.id,
        a.actor_user_id,
        u.username AS actor_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.reason,
        a.source,
        a.created_at
      FROM dbo.audit_logs a
      LEFT JOIN dbo.users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC, a.id DESC;
    `),
  ]);

  return {
    users: usersResult.recordset.map(toUserDto),
    roles: rolesResult.recordset.map(toRoleDto),
    permissions: permissionsResult.recordset.map(toPermissionDto),
    auditLogs: auditResult.recordset.map(toAuditDto),
  };
}

export async function createAuthAdminUser(payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  // Keep target authorization and transaction lifecycle on the normal API path.
  normalizeManagedAuthUser(payload);
  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  const createUser = createManagedAuthUserCore({sql, request: tx => new sqlDriver.Request(tx),
    hashPassword: (password, rounds) => bcrypt.hash(password, rounds), writeAudit: writeAuditLog});
  await transaction.begin();
  try {
    await createUser(transaction, payload, actor);

    await transaction.commit();
    return getAuthAdminOverview();
  } catch (error) {
    await transaction.rollback();
    if (error.number === 2601 || error.number === 2627) {
      throw makeServiceError('AUTH_ADMIN_USERNAME_DUPLICATE', 'Username already exists', 409);
    }
    throw error;
  }
}

export async function resetAuthAdminUserPassword(userId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('AUTH_ADMIN_USER_ID_INVALID', 'User id is invalid');
  }
  const passwordHash = await bcrypt.hash(normalizePassword(payload.password), 12);
  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const beforeResult = await new sqlDriver.Request(transaction)
      .input('userId', sql.BigInt, id)
      .query('SELECT TOP (1) id, username, display_name, is_active FROM dbo.users WHERE id = @userId;');
    const user = beforeResult.recordset?.[0];
    if (!user) {
      throw makeServiceError('AUTH_ADMIN_USER_NOT_FOUND', 'User not found', 404);
    }

    await new sqlDriver.Request(transaction)
      .input('userId', sql.BigInt, id)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.users
        SET password_hash = @passwordHash,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE id = @userId;

        UPDATE dbo.auth_refresh_tokens
        SET revoked_at = SYSUTCDATETIME()
        WHERE user_id = @userId AND revoked_at IS NULL;
      `);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'user_password_reset',
      entityType: 'user',
      entityId: id,
      beforeSnapshot: { username: user.username, passwordConfigured: true },
      afterSnapshot: { username: user.username, passwordConfigured: true, sessionsRevoked: true },
      actor,
    });

    await transaction.commit();
    return getAuthAdminOverview();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateUserAccess(userId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const id = Number(userId);
  if (!Number.isInteger(id) || id < 1) {
    throw makeServiceError('AUTH_ADMIN_USER_ID_INVALID', 'User id is invalid');
  }

  const roleId = payload.roleId ? Number(payload.roleId) : null;
  const hasActive = payload.isActive !== undefined;
  const isActive = Boolean(payload.isActive);
  const username = payload.username !== undefined ? normalizeUsername(payload.username) : null;
  const displayName = payload.displayName !== undefined ? normalizeDisplayName(payload.displayName) : null;
  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const before = await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .query(`
        SELECT TOP 1 u.id, u.username, u.display_name, u.role_id, u.is_active, r.code AS role_code, r.name AS role_name
        FROM dbo.users u
        INNER JOIN dbo.roles r ON r.id = u.role_id
        WHERE u.id = @id;
      `);

    const beforeRow = before.recordset[0];
    if (!beforeRow) {
      throw makeServiceError('AUTH_ADMIN_USER_NOT_FOUND', 'User not found', 404);
    }

    if (roleId) {
      const role = await new sqlDriver.Request(transaction)
        .input('roleId', sql.BigInt, roleId)
        .query('SELECT TOP 1 id FROM dbo.roles WHERE id = @roleId AND is_active = 1;');
      if (!role.recordset[0]) {
        throw makeServiceError('AUTH_ADMIN_ROLE_NOT_FOUND', 'Role not found', 404);
      }
    }

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('username', sql.NVarChar(80), username || beforeRow.username)
      .input('displayName', sql.NVarChar(150), displayName || beforeRow.display_name)
      .input('roleId', sql.BigInt, roleId || beforeRow.role_id)
      .input('isActive', sql.Bit, hasActive ? isActive : Boolean(beforeRow.is_active))
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.users
        SET username = @username,
            display_name = @displayName,
            role_id = @roleId,
            is_active = @isActive,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE id = @id;
      `);

    const after = await new sqlDriver.Request(transaction)
      .input('afterId', sql.BigInt, id)
      .query(`
        SELECT TOP 1 u.id, u.username, u.display_name, u.role_id, u.is_active, r.code AS role_code, r.name AS role_name
        FROM dbo.users u
        INNER JOIN dbo.roles r ON r.id = u.role_id
        WHERE u.id = @afterId;
      `);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'user_access_updated',
      entityType: 'user',
      entityId: id,
      beforeSnapshot: beforeRow,
      afterSnapshot: after.recordset[0],
      actor,
    });

    await transaction.commit();
    return getAuthAdminOverview();
  } catch (error) {
    await transaction.rollback();
    if (error.number === 2601 || error.number === 2627) {
      throw makeServiceError('AUTH_ADMIN_USERNAME_DUPLICATE', 'Username already exists', 409);
    }
    throw error;
  }
}
