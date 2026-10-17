import sql from 'mssql';
import { getSqlDriver, getSqlPool } from '../config/database.js';
import { writeAuditLog } from './auditService.js';
import { assertMelisaWriteEnabled } from './writeGuardService.js';

function makeServiceError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseValue(row) {
  const raw = row.setting_value ?? '';
  if (row.value_type === 'number') return Number(raw || 0);
  if (row.value_type === 'boolean') return String(raw).toLowerCase() === 'true' || raw === '1';
  if (row.value_type === 'json') {
    try {
      return JSON.parse(raw || 'null');
    } catch {
      return raw;
    }
  }
  return raw;
}

function serializeValue(value, valueType) {
  if (valueType === 'json') return JSON.stringify(Array.isArray(value) || typeof value === 'object' ? value : []);
  if (valueType === 'boolean') return value ? 'true' : 'false';
  if (valueType === 'number') return String(Number(value || 0));
  return trimText(value);
}

function toSettingDto(row) {
  return {
    id: Number(row.id),
    group: row.setting_group,
    key: row.setting_key,
    value: parseValue(row),
    rawValue: row.setting_value ?? '',
    valueType: row.value_type,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    updatedAt: row.updated_at,
  };
}

function groupSettings(settings) {
  return settings.reduce((acc, setting) => {
    acc[setting.group] = acc[setting.group] || {};
    acc[setting.group][setting.key] = setting.value;
    return acc;
  }, {});
}

export async function getSettingsOverview() {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT id, setting_group, setting_key, setting_value, value_type, description, is_active, updated_at
    FROM dbo.system_settings
    ORDER BY setting_group ASC, setting_key ASC;
  `);

  const settings = result.recordset.map(toSettingDto);
  return {
    settings,
    grouped: groupSettings(settings),
  };
}

export async function updateSettings(payload = {}, actor = null) {
  assertMelisaWriteEnabled();

  const settings = Array.isArray(payload.settings) ? payload.settings : [];
  if (settings.length < 1) {
    throw makeServiceError('SETTINGS_PAYLOAD_EMPTY', 'settings cannot be empty');
  }

  const sqlDriver = getSqlDriver();
  const pool = await getSqlPool();
  const transaction = new sqlDriver.Transaction(pool);

  await transaction.begin();
  try {
    const before = await new sqlDriver.Request(transaction).query(`
      SELECT setting_group, setting_key, setting_value, value_type
      FROM dbo.system_settings;
    `);

    for (const item of settings) {
      const group = trimText(item.group);
      const key = trimText(item.key);
      const valueType = trimText(item.valueType || 'string') || 'string';

      if (!group || !key) {
        throw makeServiceError('SETTINGS_KEY_REQUIRED', 'group and key are required');
      }

      if (!['string', 'number', 'boolean', 'json'].includes(valueType)) {
        throw makeServiceError('SETTINGS_VALUE_TYPE_INVALID', 'valueType is invalid');
      }

      await new sqlDriver.Request(transaction)
        .input('group', sql.NVarChar(80), group)
        .input('key', sql.NVarChar(120), key)
        .input('value', sql.NVarChar(sql.MAX), serializeValue(item.value, valueType))
        .input('valueType', sql.NVarChar(20), valueType)
        .input('description', sql.NVarChar(250), trimText(item.description) || null)
        .input('actorId', sql.BigInt, actor?.id ? Number(actor.id) : null)
        .query(`
          MERGE dbo.system_settings AS target
          USING (SELECT @group AS setting_group, @key AS setting_key) AS source
          ON target.setting_group = source.setting_group AND target.setting_key = source.setting_key
          WHEN MATCHED THEN
            UPDATE SET setting_value = @value,
                       value_type = @valueType,
                       description = COALESCE(@description, description),
                       updated_at = SYSUTCDATETIME(),
                       updated_by = @actorId
          WHEN NOT MATCHED THEN
            INSERT (setting_group, setting_key, setting_value, value_type, description, created_by)
            VALUES (@group, @key, @value, @valueType, @description, @actorId);
        `);
    }

    const after = await getSettingsOverviewFromRequest(new sqlDriver.Request(transaction));
    await writeAuditLog(new sqlDriver.Request(transaction), {
      action: 'system_settings_updated',
      entityType: 'system_settings',
      entityId: null,
      beforeSnapshot: before.recordset,
      afterSnapshot: after.settings,
      actor,
    });

    await transaction.commit();
    return getSettingsOverview();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getSettingsOverviewFromRequest(request) {
  const result = await request.query(`
    SELECT id, setting_group, setting_key, setting_value, value_type, description, is_active, updated_at
    FROM dbo.system_settings
    ORDER BY setting_group ASC, setting_key ASC;
  `);
  const settings = result.recordset.map(toSettingDto);
  return { settings, grouped: groupSettings(settings) };
}
