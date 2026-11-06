// Explicit V4 extension. V2/V3 statements and historical hashes stay unchanged.
import {MASTER_V3_OPERATION_CHECK_SQL,MASTER_V3_RESERVE_SQL,MASTER_V3_FINISH_SQL} from './master-v3-journal-sql.mjs';
import {CUSTOMER_ACCOUNT_OPERATION} from '../../packages/shared/src/desktopCustomerAccount.mjs';
function extended(expr){const old=MASTER_V3_OPERATION_CHECK_SQL.replaceAll('operation',expr);return `(${old} OR (DATALENGTH(${expr})=DATALENGTH(N'${CUSTOMER_ACCOUNT_OPERATION}') AND CONVERT(varbinary(48),${expr})=CONVERT(varbinary(48),N'${CUSTOMER_ACCOUNT_OPERATION}')))`;}
function extend(sql){const old=MASTER_V3_OPERATION_CHECK_SQL.replaceAll('operation','@operation');if(sql.split(old).length!==2)throw Error('MASTER_V4_JOURNAL_DRIFT');return sql.replace(old,()=>extended('@operation'));}
export const MASTER_V4_OPERATION_CHECK_SQL=extended('operation');
export const MASTER_V4_RESERVE_SQL=extend(MASTER_V3_RESERVE_SQL);
export const MASTER_V4_FINISH_SQL=extend(MASTER_V3_FINISH_SQL);
