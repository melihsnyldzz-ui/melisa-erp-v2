import sql from 'mssql';

export async function writeAuditLog(request, {
  action,
  entityType,
  entityId,
  beforeSnapshot = null,
  afterSnapshot = null,
}) {
  await request
    .input('auditAction', sql.NVarChar(80), action)
    .input('auditEntityType', sql.NVarChar(80), entityType)
    .input('auditEntityId', sql.BigInt, entityId)
    .input('auditBeforeJson', sql.NVarChar(sql.MAX), beforeSnapshot ? JSON.stringify(beforeSnapshot) : null)
    .input('auditAfterJson', sql.NVarChar(sql.MAX), afterSnapshot ? JSON.stringify(afterSnapshot) : null)
    .input('auditReason', sql.NVarChar(500), 'actor:SYSTEM')
    .input('auditSource', sql.NVarChar(80), 'SYSTEM')
    .query(`
      INSERT INTO dbo.audit_logs (
        action,
        entity_type,
        entity_id,
        before_json,
        after_json,
        reason,
        source,
        created_at
      )
      VALUES (
        @auditAction,
        @auditEntityType,
        @auditEntityId,
        @auditBeforeJson,
        @auditAfterJson,
        @auditReason,
        @auditSource,
        SYSUTCDATETIME()
      );
    `);
}
