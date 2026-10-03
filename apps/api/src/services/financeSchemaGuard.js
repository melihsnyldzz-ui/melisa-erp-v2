const FINANCE_SCHEMA_MIGRATION = '0012_multi_currency_cash_sessions.sql';

export const FINANCE_ACCOUNT_SCHEMA_CHECK_SQL = `
  SELECT
    OBJECT_ID(N'dbo.finance_accounts', N'U') AS finance_accounts,
    OBJECT_ID(N'dbo.finance_account_movements', N'U') AS finance_account_movements;
`;

function makeSchemaError() {
  const error = new Error(`Finance account migration ${FINANCE_SCHEMA_MIGRATION} must be applied`);
  error.code = 'FINANCE_ACCOUNT_SCHEMA_MISSING';
  error.statusCode = 503;
  return error;
}

export async function assertFinanceAccountSchema(poolOrRequest) {
  const request = typeof poolOrRequest?.request === 'function'
    ? poolOrRequest.request()
    : poolOrRequest;
  const result = await request.query(FINANCE_ACCOUNT_SCHEMA_CHECK_SQL);
  const row = result.recordset?.[0] || {};

  if (!row.finance_accounts || !row.finance_account_movements) {
    throw makeSchemaError();
  }
}
