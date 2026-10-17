// Additive FINAL card proof; importing has no SQL, config or writer effects.
import {createHash} from 'node:crypto';
export const FINAL_PARTY_READ_PROC='dbo.usp_read_final_currency_deltas';
export const FINAL_PARTY_READ_SQL=`SELECT CONVERT(varchar(20),a.id) accountId,CONVERT(varchar(100),SUM(e.delta)) sourceDeltaExact,
 CONVERT(bit,CASE WHEN SUM(CASE WHEN p.plan_hash<>r.plan_hash OR r.receipt_hash<>JSON_VALUE(r.receipt_json,'$.receiptHash') OR r.plan_hash<>JSON_VALUE(r.receipt_json,'$.planHash')
 OR(e.delta=0 AND(e.movementId IS NOT NULL OR e.auditId IS NOT NULL))
 OR(e.delta<>0 AND(au.id IS NULL OR au.actor_user_id IS NULL OR au.reason IS NULL OR au.entity_id IS NULL OR au.entity_type IS NULL OR au.action IS NULL OR au.action<>CASE WHEN r.inverse=1 THEN N'final_cutover_inverse' ELSE N'final_cutover_delta' END OR CONVERT(varchar(20),au.actor_user_id)<>JSON_VALUE(r.receipt_json,'$.actorId') OR au.reason<>r.child_id OR au.entity_id<>a.id OR au.entity_type<>N'party_currency_account'
 OR(a.customer_id IS NOT NULL AND(cm.id IS NULL OR cm.party_currency_account_id IS NULL OR cm.account_currency IS NULL OR cm.balance_effect_exact IS NULL OR cm.affects_balance IS NULL OR cm.migration_run_id IS NULL OR cm.source_payload_hash IS NULL OR cm.customer_id<>a.customer_id OR cm.party_currency_account_id<>a.id OR cm.account_currency<>a.currency_code OR cm.balance_effect_exact<>e.delta OR cm.affects_balance<>1 OR cm.migration_run_id<>r.child_id OR cm.source_payload_hash<>r.plan_hash OR cm.movement_type<>N'vega_journal'))
 OR(a.supplier_id IS NOT NULL AND(sm.id IS NULL OR sm.party_currency_account_id IS NULL OR sm.account_currency IS NULL OR sm.balance_effect_exact IS NULL OR sm.affects_balance IS NULL OR sm.migration_run_id IS NULL OR sm.source_payload_hash IS NULL OR sm.supplier_id<>a.supplier_id OR sm.party_currency_account_id<>a.id OR sm.account_currency<>a.currency_code OR sm.balance_effect_exact<>e.delta OR sm.affects_balance<>1 OR sm.migration_run_id<>r.child_id OR sm.source_payload_hash<>r.plan_hash OR sm.movement_type<>N'vega_journal')))) THEN 1 ELSE 0 END)=0 THEN 1 ELSE 0 END) verified
FROM erp_migration.final_cutover_children r JOIN erp_migration.final_cutover_parents p ON p.cutover_id=r.cutover_id
CROSS APPLY OPENJSON(r.receipt_json,'$.effects') WITH(nativeId bigint,delta decimal(28,8),movementId bigint,auditId bigint) e
JOIN dbo.party_currency_accounts a ON a.id=e.nativeId JOIN OPENJSON(@account_ids) ids ON a.id=TRY_CONVERT(bigint,ids.value)
LEFT JOIN dbo.customer_movements cm ON cm.id=e.movementId AND a.customer_id IS NOT NULL LEFT JOIN dbo.supplier_movements sm ON sm.id=e.movementId AND a.supplier_id IS NOT NULL LEFT JOIN dbo.audit_logs au ON au.id=e.auditId
WHERE r.domain=N'account' AND JSON_VALUE(r.receipt_json,'$.status')=N'COMMITTED' GROUP BY a.id`;
const filtered=FINAL_PARTY_READ_SQL.replace("WHERE r.domain=N'account'", "WHERE p.cutover_id=@cutover_id AND p.party_hash=@party_hash AND p.plan_hash=@plan_hash AND r.domain=N'account'");
export const FINAL_PARTY_READ_PROC_SQL=`CREATE PROCEDURE ${FINAL_PARTY_READ_PROC} @account_ids nvarchar(max),@cutover_id uniqueidentifier,@plan_hash char(64),@party_hash char(64),@inverse bit WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR @@SERVERNAME<>N'Semih\\MELISADEV' OR @@TRANCOUNT=0 THROW 51808,'FINAL_PARTY_TARGET_TRANSACTION',1;
 IF ISJSON(@account_ids)<>1 OR(SELECT COUNT(*) FROM OPENJSON(@account_ids))>1000 OR EXISTS(SELECT 1 FROM OPENJSON(@account_ids) WHERE TRY_CONVERT(bigint,value) IS NULL OR TRY_CONVERT(bigint,value)<1) THROW 51808,'FINAL_PARTY_PAGE_SCOPE',1;
 IF NOT EXISTS(SELECT 1 FROM erp_migration.final_cutover_parents WHERE cutover_id=@cutover_id AND plan_hash=@plan_hash AND party_hash=@party_hash) OR COALESCE((SELECT TOP(1) state FROM erp_migration.final_cutover_events WHERE cutover_id=@cutover_id ORDER BY id DESC),N'')<>CASE WHEN @inverse=1 THEN N'INVERSED' ELSE N'RECONCILED' END THROW 51808,'FINAL_PARTY_PARENT_NOT_RECONCILED',1;
 SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,(SELECT * FROM(${filtered}) proof FOR JSON PATH,INCLUDE_NULL_VALUES) rowsJson;END`;
export const FINAL_PARTY_READ_PROC_HASH=createHash('sha256').update(FINAL_PARTY_READ_PROC_SQL,'utf16le').digest('hex').toUpperCase();
export function finalPartyContext(context){
 if(context?.schemaVersion!=='melisa-final-catalog-context.v1')return null;
 if(!/^FINAL-(?:INVERSE-)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.runId??'')||['planHash','partyBindingsHash'].some(k=>! /^[a-f0-9]{64}$/i.test(context[k]??'')))throw Error('FINAL_PARTY_CONTEXT');
 return {cutoverId:context.runId.replace(/^FINAL-(?:INVERSE-)?/,''),planHash:context.planHash,partyHash:context.partyBindingsHash,inverse:context.runId.startsWith('FINAL-INVERSE-')};
}
export async function readFinalPartyProof({sql,tx,ids,context}){
 const c=finalPartyContext(context);if(!c)return null;
 if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>! /^[1-9]\d*$/.test(id)))throw Error('FINAL_PARTY_PAGE_SCOPE');
 const result=await new sql.Request(tx).input('account_ids',sql.NVarChar(sql.MAX),JSON.stringify(ids)).input('cutover_id',sql.NVarChar(36),c.cutoverId).input('plan_hash',sql.Char(64),c.planHash).input('party_hash',sql.Char(64),c.partyHash).input('inverse',sql.Bit,c.inverse).execute(FINAL_PARTY_READ_PROC),row=result.recordset?.[0];
 if(row?.readerDefinitionHash!==FINAL_PARTY_READ_PROC_HASH)throw Error('FINAL_PARTY_READER_DRIFT');
 const proof=JSON.parse(row.rowsJson??'[]');if(!Array.isArray(proof))throw Error('FINAL_PARTY_READBACK');return proof;
}
export function attachFinalPartyProof(rows,proof){
 const byId=new Map(proof.map(p=>[p.accountId,p]));if(byId.size!==proof.length)throw Error('FINAL_PARTY_DUPLICATE_PROOF');
 for(const row of rows)for(const account of row.nativeAccounts??[]){const p=byId.get(account.id);account.finalSourceDeltaVerified=!p||p.verified===true;account.finalSourceDeltaExact=p?(p.verified===true?p.sourceDeltaExact:null):'0.00000000';}
 return rows;
}
