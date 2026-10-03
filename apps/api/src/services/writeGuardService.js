import { env } from '../config/env.js';
import { isCanonicalTest } from '../config/database.js';
import { isTestSalesMutation } from './testSalesScope.mjs';

const MELISA_ERP_V2_DATABASE = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';

export function assertMelisaWriteEnabled() {
  if (env.sql.database !== MELISA_ERP_V2_DATABASE && !(isCanonicalTest() && isTestSalesMutation())) {
    const error = new Error('Write target must be the LIVE-3 production candidate');
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
