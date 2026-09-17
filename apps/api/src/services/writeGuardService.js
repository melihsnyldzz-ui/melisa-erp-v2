import { env } from '../config/env.js';

const MELISA_ERP_V2_DATABASE = 'MELISA_ERP_V2';
const TEST_DATABASE = 'MELISA_ERP_FULL_TEST_20260916';

export function assertMelisaWriteEnabled() {
  const testWriteEnabled = process.env.MELISA_TEST_WRITE_ENABLED === 'true';
  const allowed = env.sql.database === MELISA_ERP_V2_DATABASE
    || (env.sql.database === TEST_DATABASE && testWriteEnabled);
  if (!allowed) {
    const error = new Error('Write target must be MELISA_ERP_V2');
    error.code = 'SQL_WRITE_TARGET_INVALID';
    error.statusCode = 403;
    throw error;
  }

  if (env.sql.readOnly) {
    const error = new Error('SQL write mode is disabled');
    error.code = 'SQL_WRITE_DISABLED';
    error.statusCode = 503;
    throw error;
  }
}
