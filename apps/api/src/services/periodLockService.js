function makePeriodLockError(message, meta = {}) {
  const error = new Error(message);
  error.code = 'ACCOUNTING_PERIOD_LOCKED';
  error.statusCode = 409;
  error.meta = meta;
  return error;
}

function parseBoolean(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === 'on';
}

function normalizeDateText(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

export async function getAccountingPeriodLock(request) {
  const result = await request.query(`
    SELECT setting_key, setting_value
    FROM dbo.system_settings
    WHERE setting_group = N'accounting'
      AND setting_key IN (N'periodLockEnabled', N'periodLockedThroughDate');
  `);

  const settings = new Map((result.recordset || []).map((row) => [row.setting_key, row.setting_value]));
  const enabled = parseBoolean(settings.get('periodLockEnabled'));
  const lockedThroughDate = normalizeDateText(settings.get('periodLockedThroughDate'));

  return {
    enabled,
    lockedThroughDate,
    isLocked: Boolean(enabled && lockedThroughDate),
  };
}

export async function assertAccountingPeriodOpen(request, documentDate, operationLabel = 'Bu işlem') {
  const normalizedDocumentDate = normalizeDateText(documentDate);
  if (!normalizedDocumentDate) return;

  const lock = await getAccountingPeriodLock(request);
  if (!lock.isLocked) return;

  if (normalizedDocumentDate <= lock.lockedThroughDate) {
    throw makePeriodLockError(
      `${operationLabel} kapalı muhasebe dönemine ait. Kilit tarihi: ${lock.lockedThroughDate}`,
      {
        documentDate: normalizedDocumentDate,
        lockedThroughDate: lock.lockedThroughDate,
        operationLabel,
      },
    );
  }
}
