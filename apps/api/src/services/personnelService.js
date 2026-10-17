import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function serviceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value, maxLength = 150) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeLoginUsername(value) {
  const username = trimText(value, 80);
  if (username && !/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
    throw serviceError('PERSONNEL_LOGIN_USERNAME_INVALID', 'Login username must be 3-80 characters and use letters, numbers, dot, dash or underscore');
  }
  return username;
}

function normalizeLoginPassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password && (password.length < 8 || password.length > 128)) {
    throw serviceError('PERSONNEL_LOGIN_PASSWORD_INVALID', 'Login password must be between 8 and 128 characters');
  }
  return password;
}

async function assertPersonnelSchema(pool) {
  const result = await pool.request().query(`
    SELECT
      CASE
        WHEN OBJECT_ID(N'dbo.employees', N'U') IS NOT NULL
         AND COL_LENGTH(N'dbo.terminal_devices', N'assigned_employee_id') IS NOT NULL
         AND COL_LENGTH(N'dbo.sales_invoices', N'employee_id') IS NOT NULL
        THEN 1 ELSE 0
      END AS is_ready;
  `);

  if (!result.recordset?.[0]?.is_ready) {
    throw serviceError(
      'PERSONNEL_SCHEMA_MISSING',
      'Personnel schema is not installed. Apply migration 0013_personnel_terminal_sales.sql.',
      503,
    );
  }
}

async function hasPersonnelRestrictionSchema(pool) {
  const result = await pool.request().query(`
    SELECT CASE
      WHEN COL_LENGTH(N'dbo.employees', N'can_terminal_sale') IS NOT NULL
       AND COL_LENGTH(N'dbo.employees', N'can_change_sale_price') IS NOT NULL
       AND COL_LENGTH(N'dbo.employees', N'max_sale_discount_percent') IS NOT NULL
      THEN 1 ELSE 0
    END AS is_ready;
  `);
  return Boolean(result.recordset?.[0]?.is_ready);
}

function toEmployeeDto(row) {
  return {
    id: Number(row.id),
    employeeCode: row.employee_code,
    fullName: row.full_name,
    phone: row.phone || '',
    department: row.department || '',
    jobTitle: row.job_title || '',
    userId: row.user_id ? Number(row.user_id) : null,
    username: row.username || '',
    userRoleId: row.user_role_id ? Number(row.user_role_id) : null,
    userRoleCode: row.user_role_code || '',
    userRoleName: row.user_role_name || '',
    isActive: Boolean(row.is_active),
    canTerminalSale: row.can_terminal_sale === undefined ? true : Boolean(row.can_terminal_sale),
    canChangeSalePrice: Boolean(row.can_change_sale_price),
    maxSaleDiscountPercent: Number(row.max_sale_discount_percent || 0),
    terminalCount: Number(row.terminal_count || 0),
    saleCount: Number(row.sale_count || 0),
    saleTotalTry: Number(row.sale_total_try || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDeviceDto(row) {
  return {
    id: Number(row.id),
    deviceCode: row.device_code,
    deviceName: row.device_name,
    assignedEmployeeId: row.assigned_employee_id ? Number(row.assigned_employee_id) : null,
    assignedEmployeeName: row.employee_name || '',
    isActive: Boolean(row.is_active),
    lastSeenAt: row.last_seen_at,
  };
}

export async function getPersonnelOverview() {
  const pool = await getSqlPool();
  await assertPersonnelSchema(pool);
  const restrictionSchemaReady = await hasPersonnelRestrictionSchema(pool);
  const restrictionColumns = restrictionSchemaReady
    ? `e.can_terminal_sale,
       e.can_change_sale_price,
       e.max_sale_discount_percent,`
    : `CAST(1 AS BIT) AS can_terminal_sale,
       CAST(0 AS BIT) AS can_change_sale_price,
       CAST(0 AS DECIMAL(5,2)) AS max_sale_discount_percent,`;

  const [employeesResult, usersResult, rolesResult, devicesResult] = await Promise.all([
    pool.request().query(`
      SELECT
        e.id,
        e.employee_code,
        e.full_name,
        e.phone,
        e.department,
        e.job_title,
        ${restrictionColumns}
        e.user_id,
        u.username,
        u.role_id AS user_role_id,
        r.code AS user_role_code,
        r.name AS user_role_name,
        e.is_active,
        e.created_at,
        e.updated_at,
        terminal_summary.terminal_count,
        sales_summary.sale_count,
        sales_summary.sale_total_try
      FROM dbo.employees e
      LEFT JOIN dbo.users u ON u.id = e.user_id
      LEFT JOIN dbo.roles r ON r.id = u.role_id
      OUTER APPLY (
        SELECT COUNT_BIG(1) AS terminal_count
        FROM dbo.terminal_devices d
        WHERE d.assigned_employee_id = e.id
      ) terminal_summary
      OUTER APPLY (
        SELECT
          COUNT_BIG(1) AS sale_count,
          COALESCE(SUM(si.amount_try), 0) AS sale_total_try
        FROM dbo.sales_invoices si
        WHERE si.employee_id = e.id
          AND si.status = N'finalized'
      ) sales_summary
      ORDER BY e.is_active DESC, e.full_name ASC, e.id ASC;
    `),
    pool.request().query(`
      SELECT u.id, u.username, u.display_name, u.role_id, r.code AS role_code, r.name AS role_name, u.is_active
      FROM dbo.users u
      INNER JOIN dbo.roles r ON r.id = u.role_id
      ORDER BY u.is_active DESC, u.display_name ASC, u.username ASC;
    `),
    pool.request().query(`
      SELECT id, code, name, description
      FROM dbo.roles
      WHERE is_active = 1
      ORDER BY is_system_role DESC, name ASC;
    `),
    pool.request().query(`
      SELECT
        d.id,
        d.device_code,
        d.device_name,
        d.assigned_employee_id,
        e.full_name AS employee_name,
        d.is_active,
        d.last_seen_at
      FROM dbo.terminal_devices d
      LEFT JOIN dbo.employees e ON e.id = d.assigned_employee_id
      ORDER BY d.is_active DESC, d.device_name ASC, d.id ASC;
    `),
  ]);

  return {
    restrictionSchemaReady,
    employees: employeesResult.recordset.map(toEmployeeDto),
    users: usersResult.recordset.map((row) => ({
      id: Number(row.id),
      username: row.username,
      displayName: row.display_name,
      roleId: Number(row.role_id),
      roleCode: row.role_code,
      roleName: row.role_name,
      isActive: Boolean(row.is_active),
    })),
    roles: rolesResult.recordset.map((row) => ({
      id: Number(row.id),
      code: row.code,
      name: row.name,
      description: row.description || '',
    })),
    devices: devicesResult.recordset.map(toDeviceDto),
  };
}

function normalizeEmployeePayload(payload = {}) {
  const employeeCode = trimText(payload.employeeCode, 50);
  const fullName = trimText(payload.fullName);
  const userId = payload.userId ? Number(payload.userId) : null;
  const maxSaleDiscountPercent = Number(payload.maxSaleDiscountPercent ?? 0);

  if (!employeeCode) {
    throw serviceError('PERSONNEL_CODE_REQUIRED', 'Employee code is required');
  }
  if (!fullName) {
    throw serviceError('PERSONNEL_NAME_REQUIRED', 'Employee full name is required');
  }
  if (userId !== null && (!Number.isInteger(userId) || userId < 1)) {
    throw serviceError('PERSONNEL_USER_INVALID', 'Linked user is invalid');
  }
  if (!Number.isFinite(maxSaleDiscountPercent) || maxSaleDiscountPercent < 0 || maxSaleDiscountPercent > 100) {
    throw serviceError('PERSONNEL_DISCOUNT_LIMIT_INVALID', 'Maximum sale discount must be between 0 and 100');
  }

  return {
    employeeCode,
    fullName,
    phone: trimText(payload.phone, 40),
    department: trimText(payload.department, 100),
    jobTitle: trimText(payload.jobTitle, 100),
    userId,
    canTerminalSale: payload.canTerminalSale === undefined ? true : Boolean(payload.canTerminalSale),
    canChangeSalePrice: Boolean(payload.canChangeSalePrice),
    maxSaleDiscountPercent,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
  };
}

export async function createEmployee(payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  const employee = normalizeEmployeePayload(payload);
  const loginUsername = normalizeLoginUsername(payload.loginUsername);
  const loginPassword = normalizeLoginPassword(payload.loginPassword);
  if (Boolean(loginUsername) !== Boolean(loginPassword)) {
    throw serviceError('PERSONNEL_LOGIN_CREDENTIALS_REQUIRED', 'Username and password must be entered together');
  }
  if (employee.userId && loginUsername) {
    throw serviceError('PERSONNEL_LOGIN_SOURCE_CONFLICT', 'Select an existing login account or create a new one, not both');
  }
  if (employee.canTerminalSale && !employee.userId && !loginUsername) {
    throw serviceError('PERSONNEL_TERMINAL_LOGIN_REQUIRED', 'Terminal personnel must have a login username and password');
  }
  const loginPasswordHash = loginPassword ? await bcrypt.hash(loginPassword, 12) : null;
  const pool = await getSqlPool();
  await assertPersonnelSchema(pool);
  const restrictionSchemaReady = await hasPersonnelRestrictionSchema(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    let linkedUserId = employee.userId;
    if (loginUsername) {
      const roleResult = await new sqlDriver.Request(transaction)
        .query("SELECT TOP (1) id, code, name FROM dbo.roles WHERE code = N'terminal_user' AND is_active = 1;");
      const terminalRole = roleResult.recordset?.[0];
      if (!terminalRole) {
        throw serviceError('PERSONNEL_TERMINAL_ROLE_MISSING', 'Active terminal user role was not found', 503);
      }

      const userResult = await new sqlDriver.Request(transaction)
        .input('loginUsername', sql.NVarChar(80), loginUsername)
        .input('loginPasswordHash', sql.NVarChar(255), loginPasswordHash)
        .input('loginDisplayName', sql.NVarChar(150), employee.fullName)
        .input('loginRoleId', sql.BigInt, Number(terminalRole.id))
        .input('loginActorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          INSERT INTO dbo.users (
            username, password_hash, display_name, role_id, is_active, created_by, updated_by
          )
          OUTPUT INSERTED.id
          VALUES (
            @loginUsername, @loginPasswordHash, @loginDisplayName, @loginRoleId, 1, @loginActorId, @loginActorId
          );
        `);
      linkedUserId = Number(userResult.recordset[0].id);
      await writeAuditLog(new sqlDriver.Request(transaction), {
        action: 'user_created',
        entityType: 'user',
        entityId: linkedUserId,
        afterSnapshot: {
          username: loginUsername,
          displayName: employee.fullName,
          roleCode: terminalRole.code,
          isActive: true,
          passwordConfigured: true,
        },
        actor,
      });
    }

    const result = await new sqlDriver.Request(transaction)
      .input('employeeCode', sql.NVarChar(50), employee.employeeCode)
      .input('fullName', sql.NVarChar(150), employee.fullName)
      .input('phone', sql.NVarChar(40), employee.phone || null)
      .input('department', sql.NVarChar(100), employee.department || null)
      .input('jobTitle', sql.NVarChar(100), employee.jobTitle || null)
      .input('userId', sql.BigInt, linkedUserId)
      .input('canTerminalSale', sql.Bit, employee.canTerminalSale)
      .input('canChangeSalePrice', sql.Bit, employee.canChangeSalePrice)
      .input('maxSaleDiscountPercent', sql.Decimal(5, 2), employee.maxSaleDiscountPercent)
      .input('isActive', sql.Bit, employee.isActive)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        INSERT INTO dbo.employees (
          employee_code, full_name, phone, department, job_title, user_id,
          ${restrictionSchemaReady ? 'can_terminal_sale, can_change_sale_price, max_sale_discount_percent,' : ''}
          is_active, created_by, updated_by
        )
        OUTPUT INSERTED.id
        VALUES (
          @employeeCode, @fullName, @phone, @department, @jobTitle, @userId,
          ${restrictionSchemaReady ? '@canTerminalSale, @canChangeSalePrice, @maxSaleDiscountPercent,' : ''}
          @isActive, @actorId, @actorId
        );
      `);
    const employeeId = Number(result.recordset[0].id);
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'employee_created',
      entityType: 'employee',
      entityId: employeeId,
      afterSnapshot: { ...employee, userId: linkedUserId, loginAccountCreated: Boolean(loginUsername) },
      actor,
    });
    await transaction.commit();
    return getPersonnelOverview();
  } catch (error) {
    await transaction.rollback();
    if (error.number === 2601 || error.number === 2627) {
      throw serviceError('PERSONNEL_DUPLICATE', 'Employee code, username or linked user already exists', 409);
    }
    throw error;
  }
}

export async function updateEmployee(employeeId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  const id = Number(employeeId);
  if (!Number.isInteger(id) || id < 1) {
    throw serviceError('PERSONNEL_ID_INVALID', 'Employee id is invalid');
  }
  const employee = normalizeEmployeePayload(payload);
  const pool = await getSqlPool();
  await assertPersonnelSchema(pool);
  const restrictionSchemaReady = await hasPersonnelRestrictionSchema(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const beforeResult = await new sqlDriver.Request(transaction)
      .input('beforeId', sql.BigInt, id)
      .query('SELECT TOP (1) * FROM dbo.employees WHERE id = @beforeId;');
    if (!beforeResult.recordset[0]) {
      throw serviceError('PERSONNEL_NOT_FOUND', 'Employee not found', 404);
    }

    await new sqlDriver.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('employeeCode', sql.NVarChar(50), employee.employeeCode)
      .input('fullName', sql.NVarChar(150), employee.fullName)
      .input('phone', sql.NVarChar(40), employee.phone || null)
      .input('department', sql.NVarChar(100), employee.department || null)
      .input('jobTitle', sql.NVarChar(100), employee.jobTitle || null)
      .input('userId', sql.BigInt, employee.userId)
      .input('canTerminalSale', sql.Bit, employee.canTerminalSale)
      .input('canChangeSalePrice', sql.Bit, employee.canChangeSalePrice)
      .input('maxSaleDiscountPercent', sql.Decimal(5, 2), employee.maxSaleDiscountPercent)
      .input('isActive', sql.Bit, employee.isActive)
      .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
      .query(`
        UPDATE dbo.employees
        SET employee_code = @employeeCode,
            full_name = @fullName,
            phone = @phone,
            department = @department,
            job_title = @jobTitle,
            user_id = @userId,
            ${restrictionSchemaReady ? `can_terminal_sale = @canTerminalSale,
            can_change_sale_price = @canChangeSalePrice,
            max_sale_discount_percent = @maxSaleDiscountPercent,` : ''}
            is_active = @isActive,
            updated_at = SYSUTCDATETIME(),
            updated_by = @actorId
        WHERE id = @id;
      `);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'employee_updated',
      entityType: 'employee',
      entityId: id,
      beforeSnapshot: beforeResult.recordset[0],
      afterSnapshot: employee,
      actor,
    });
    await transaction.commit();
    return getPersonnelOverview();
  } catch (error) {
    await transaction.rollback();
    if (error.number === 2601 || error.number === 2627) {
      throw serviceError('PERSONNEL_DUPLICATE', 'Employee code or linked user already exists', 409);
    }
    throw error;
  }
}

export async function createTerminalDevice(payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  const deviceCode = trimText(payload.deviceCode, 80);
  const deviceName = trimText(payload.deviceName);
  const employeeId = payload.employeeId ? Number(payload.employeeId) : null;

  if (!deviceCode) {
    throw serviceError('TERMINAL_DEVICE_CODE_REQUIRED', 'Terminal device code is required');
  }
  if (!deviceName) {
    throw serviceError('TERMINAL_DEVICE_NAME_REQUIRED', 'Terminal device name is required');
  }
  if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId < 1)) {
    throw serviceError('TERMINAL_EMPLOYEE_INVALID', 'Selected employee is invalid');
  }

  const pool = await getSqlPool();
  await assertPersonnelSchema(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    let employee = null;
    if (employeeId) {
      const employeeResult = await new sqlDriver.Request(transaction)
        .input('employeeId', sql.BigInt, employeeId)
        .query('SELECT TOP (1) id, employee_code, full_name FROM dbo.employees WHERE id = @employeeId AND is_active = 1;');
      employee = employeeResult.recordset[0];
      if (!employee) {
        throw serviceError('TERMINAL_EMPLOYEE_NOT_ACTIVE', 'Active employee not found', 409);
      }
    }

    const insertResult = await new sqlDriver.Request(transaction)
      .input('deviceCode', sql.NVarChar(80), deviceCode)
      .input('deviceName', sql.NVarChar(150), deviceName)
      .input('assignedEmployeeId', sql.BigInt, employeeId)
      .query(`
        INSERT INTO dbo.terminal_devices (
          device_code, device_name, assigned_employee_id, is_active
        )
        OUTPUT INSERTED.id
        VALUES (
          @deviceCode, @deviceName, @assignedEmployeeId, 1
        );
      `);
    const deviceId = Number(insertResult.recordset[0].id);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'terminal_device_created',
      entityType: 'terminal_device',
      entityId: deviceId,
      afterSnapshot: {
        deviceCode,
        deviceName,
        assignedEmployeeId: employeeId,
        employee,
      },
      actor,
    });
    await transaction.commit();
    return getPersonnelOverview();
  } catch (error) {
    await transaction.rollback();
    if (error.number === 2601 || error.number === 2627) {
      throw serviceError('TERMINAL_DEVICE_DUPLICATE', 'Terminal device code already exists', 409);
    }
    throw error;
  }
}

export async function assignTerminalEmployee(deviceId, payload = {}, actor = null) {
  assertMelisaWriteEnabled();
  const id = Number(deviceId);
  const employeeId = Number(payload.employeeId);
  if (!Number.isInteger(id) || id < 1) {
    throw serviceError('TERMINAL_DEVICE_ID_INVALID', 'Terminal device id is invalid');
  }
  if (!Number.isInteger(employeeId) || employeeId < 1) {
    throw serviceError('TERMINAL_EMPLOYEE_REQUIRED', 'An active employee must be selected');
  }

  const pool = await getSqlPool();
  await assertPersonnelSchema(pool);
  const sqlDriver = getSqlDriver();
  const transaction = new sqlDriver.Transaction(pool);
  await transaction.begin();

  try {
    const beforeResult = await new sqlDriver.Request(transaction)
      .input('deviceId', sql.BigInt, id)
      .query(`
        SELECT TOP (1)
          d.id, d.device_code, d.device_name, d.assigned_employee_id
        FROM dbo.terminal_devices d
        WHERE d.id = @deviceId AND d.is_active = 1;
      `);
    if (!beforeResult.recordset[0]) {
      throw serviceError('TERMINAL_DEVICE_NOT_FOUND', 'Active terminal device not found', 404);
    }

    const employeeResult = await new sqlDriver.Request(transaction)
      .input('employeeId', sql.BigInt, employeeId)
      .query('SELECT TOP (1) id, employee_code, full_name FROM dbo.employees WHERE id = @employeeId AND is_active = 1;');
    if (!employeeResult.recordset[0]) {
      throw serviceError('TERMINAL_EMPLOYEE_NOT_ACTIVE', 'Active employee not found', 409);
    }

    await new sqlDriver.Request(transaction)
      .input('updateDeviceId', sql.BigInt, id)
      .input('updateEmployeeId', sql.BigInt, employeeId)
      .query(`
        UPDATE dbo.terminal_devices
        SET assigned_employee_id = @updateEmployeeId,
            updated_at = SYSUTCDATETIME()
        WHERE id = @updateDeviceId;
      `);

    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'terminal_employee_assigned',
      entityType: 'terminal_device',
      entityId: id,
      beforeSnapshot: beforeResult.recordset[0],
      afterSnapshot: {
        ...beforeResult.recordset[0],
        assigned_employee_id: employeeId,
        employee: employeeResult.recordset[0],
      },
      actor,
    });
    await transaction.commit();
    return getPersonnelOverview();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
