import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getSqlDriver, getSqlPool, closeSqlPool } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { assertMelisaWriteEnabled } from '../src/services/writeGuardService.js';
import { writeAuditLog } from '../src/services/auditService.js';

const USERNAME = 'melisa_ai_readonly';
const ROLE_CODE = 'melisa_ai_readonly';
const ROLE_NAME = 'Melisa AI Read Only';
const DISPLAY_NAME = 'Melisa AI Read Only';
const ALLOWED_PERMISSIONS = ['product.view', 'customer.view', 'sales.view', 'finance.view'];
const REQUIRED_COLUMNS = {
  roles: ['id','code','name','description','is_system_role','is_active'],
  users: ['id','username','password_hash','display_name','role_id','is_active','created_by','updated_by'],
  permissions: ['id','role_id','permission_key','can_view','can_create','can_update','can_delete','can_approve']
};

if (process.env.PROVISION_MELISA_AI_READONLY !== 'true') throw new Error('PROVISION_NOT_ARMED');
if (env.sql.database !== 'MELISA_ERP_V2') throw new Error('PROVISION_TARGET_INVALID');
if (env.sql.readOnly) throw new Error('PROVISION_REQUIRES_EXPLICIT_SQL_WRITE_MODE');
assertMelisaWriteEnabled();

const generatedPassword = crypto.randomBytes(36).toString('base64url');
const passwordHash = await bcrypt.hash(generatedPassword, 12);
const driver = getSqlDriver();
const pool = await getSqlPool();

async function columns(table) {
  const result = await pool.request().input('tableName', sql.NVarChar(128), table).query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tableName;
  `);
  return new Set(result.recordset.map((row) => String(row.COLUMN_NAME)));
}

for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
  const actual = await columns(table);
  const missing = required.filter((column) => !actual.has(column));
  if (missing.length) throw new Error(`PROVISION_SCHEMA_MISMATCH:${table}:${missing.join(',')}`);
}

const transaction = new driver.Transaction(pool);
await transaction.begin();
let roleId;
let userId;
try {
  const roleRequest = new driver.Request(transaction);
  const roleResult = await roleRequest.input('roleCode', sql.NVarChar(80), ROLE_CODE).query(`
    SELECT TOP 1 id, is_active FROM dbo.roles WHERE code = @roleCode;
  `);
  if (roleResult.recordset[0]) {
    roleId = Number(roleResult.recordset[0].id);
    await new driver.Request(transaction)
      .input('roleId', sql.BigInt, roleId)
      .input('roleName', sql.NVarChar(150), ROLE_NAME)
      .query(`UPDATE dbo.roles SET name=@roleName, description='Dedicated read-only API role for Melisa AI', is_system_role=0, is_active=1 WHERE id=@roleId;`);
  } else {
    const inserted = await new driver.Request(transaction)
      .input('roleCode', sql.NVarChar(80), ROLE_CODE)
      .input('roleName', sql.NVarChar(150), ROLE_NAME)
      .query(`
        INSERT INTO dbo.roles (code, name, description, is_system_role, is_active)
        OUTPUT INSERTED.id
        VALUES (@roleCode, @roleName, 'Dedicated read-only API role for Melisa AI', 0, 1);
      `);
    roleId = Number(inserted.recordset[0].id);
  }

  await new driver.Request(transaction).input('roleId', sql.BigInt, roleId).query(`DELETE FROM dbo.permissions WHERE role_id=@roleId;`);
  for (const permission of ALLOWED_PERMISSIONS) {
    await new driver.Request(transaction)
      .input('roleId', sql.BigInt, roleId)
      .input('permissionKey', sql.NVarChar(150), permission)
      .query(`
        INSERT INTO dbo.permissions (role_id, permission_key, can_view, can_create, can_update, can_delete, can_approve)
        VALUES (@roleId, @permissionKey, 1, 0, 0, 0, 0);
      `);
  }

  const existing = await new driver.Request(transaction)
    .input('username', sql.NVarChar(80), USERNAME)
    .query(`SELECT TOP 1 id FROM dbo.users WHERE username=@username;`);
  if (existing.recordset[0]) {
    userId = Number(existing.recordset[0].id);
    await new driver.Request(transaction)
      .input('userId', sql.BigInt, userId)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('roleId', sql.BigInt, roleId)
      .query(`
        UPDATE dbo.users SET password_hash=@passwordHash, display_name='Melisa AI Read Only', role_id=@roleId,
          is_active=1, updated_at=SYSUTCDATETIME(), updated_by=NULL WHERE id=@userId;
        UPDATE dbo.auth_refresh_tokens SET revoked_at=SYSUTCDATETIME() WHERE user_id=@userId AND revoked_at IS NULL;
      `);
  } else {
    const insertedUser = await new driver.Request(transaction)
      .input('username', sql.NVarChar(80), USERNAME)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('displayName', sql.NVarChar(150), DISPLAY_NAME)
      .input('roleId', sql.BigInt, roleId)
      .query(`
        INSERT INTO dbo.users (username,password_hash,display_name,role_id,is_active,created_by,updated_by)
        OUTPUT INSERTED.id VALUES (@username,@passwordHash,@displayName,@roleId,1,NULL,NULL);
      `);
    userId = Number(insertedUser.recordset[0].id);
  }

  await writeAuditLog(new driver.Request(transaction), {
    action: 'melisa_ai_readonly_provisioned', entityType: 'user', entityId: userId,
    afterSnapshot: { username: USERNAME, roleCode: ROLE_CODE, permissions: ALLOWED_PERMISSIONS, isActive: true },
    actor: null, reason: 'Dedicated Melisa AI read-only service account provisioning', source: 'provision-melisa-ai-readonly'
  });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}

const targetEnv = process.env.MELISA_AI_PRIVATE_ENV_FILE?.trim();
if (!targetEnv) throw new Error('MELISA_AI_PRIVATE_ENV_FILE_REQUIRED_AFTER_DB_COMMIT');
const absoluteEnv = path.resolve(targetEnv);
let envText = '';
try { envText = await fs.readFile(absoluteEnv, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
function upsert(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, '')}\n${line}\n`;
}
envText = upsert(envText, 'ERP_ENABLED', 'true');
envText = upsert(envText, 'ERP_USERNAME', USERNAME);
envText = upsert(envText, 'ERP_PASSWORD', generatedPassword);
await fs.mkdir(path.dirname(absoluteEnv), { recursive: true });
await fs.writeFile(absoluteEnv, envText, { encoding: 'utf8', mode: 0o600 });

console.log(JSON.stringify({ status: 'PROVISIONED', username: USERNAME, role: ROLE_CODE, permissions: ALLOWED_PERMISSIONS, passwordPrinted: false, envUpdated: true }, null, 2));
await closeSqlPool();
