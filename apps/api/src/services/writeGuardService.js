import { env } from '../config/env.js';

const MELISA_ERP_V2_DATABASE = 'MELISA_ERP_V2';

export function assertMelisaWriteEnabled() {
  if (env.sql.database !== MELISA_ERP_V2_DATABASE) {
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
