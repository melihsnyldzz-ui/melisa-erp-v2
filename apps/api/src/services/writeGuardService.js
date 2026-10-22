import { env } from '../config/env.js';
import { isCanonicalTest } from '../config/database.js';
import { isTestSalesMutation } from './testSalesScope.mjs';
import {getCrmOrderCurrentContext} from './crmOrderCurrentContext.mjs';
import {isCleanOrderSaleMutation} from './cleanOrderSaleScope.mjs';
import {isCleanStoreDayMutation} from './cleanStoreDayScope.mjs';
const isIsolatedOperationCopyMutation=getCrmOrderCurrentContext()?null:(await import('./isolatedOperationCopyScope.mjs')).isIsolatedOperationCopyMutation;

const MELISA_ERP_V2_DATABASE = 'MELISA_ERP_PROD_CANDIDATE_20260917_01';

export function assertMelisaWriteEnabled() {
  if(isCleanOrderSaleMutation())return;
  if(isCleanStoreDayMutation())return;
  // CRM writes use their separate proven draft procedures, never a generic ERP
  // write capability, including if process environment is changed afterwards.
  if(!isIsolatedOperationCopyMutation)throw Object.assign(new Error('Write target must be the LIVE-3 production candidate'),{code:'SQL_WRITE_TARGET_INVALID',statusCode:403});
  if (env.sql.database !== MELISA_ERP_V2_DATABASE && !(isCanonicalTest() && isTestSalesMutation())
    && !isIsolatedOperationCopyMutation(env.sql)) {
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
