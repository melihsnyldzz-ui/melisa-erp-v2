// Source-only v3 extension of immutable v2 journal statements. Importing this
// file executes nothing; schema migration and grants are separate work.
import {LOCAL_MASTER_RESERVE_SQL,LOCAL_MASTER_FINISH_SQL} from './local-master-schema-proposal.mjs';
const op=(expr,name)=>`(DATALENGTH(${expr})=DATALENGTH(N'${name}') AND CONVERT(varbinary(48),${expr})=CONVERT(varbinary(48),N'${name}'))`;
const v2=expr=>`(${op(expr,'customer.create')} OR ${op(expr,'product.create')})`;
const v3=expr=>`(${op(expr,'customer.create')} OR ${op(expr,'product.create')} OR ${op(expr,'supplier.create')})`;
function extend(statement){const old=v2('@operation');if(typeof statement!=='string'||statement.split(old).length!==2)throw Error('MASTER_V3_V2_JOURNAL_DRIFT');return statement.replace(old,()=>v3('@operation'));}
export const MASTER_V3_OPERATION_CHECK_SQL=v3('operation');
export const MASTER_V3_RESERVE_SQL=extend(LOCAL_MASTER_RESERVE_SQL);
export const MASTER_V3_FINISH_SQL=extend(LOCAL_MASTER_FINISH_SQL);
