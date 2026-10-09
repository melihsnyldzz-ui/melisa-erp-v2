import {isolatedCopyTopology} from './isolatedOperationCopyContext.mjs';
import {registeredSharedPartyContext,sharedPartyReaderDefinition,assertSharedPartyTransactionIdentity} from './isolatedPartyCardReader.mjs';
// Read-only additive proof for an amount-approved TEST batch, not a T1 cutover.
import {createHash} from 'node:crypto';
import {FINAL_PARTY_READ_SQL} from './finalPartyDeltaRead.mjs';

export const CURRENT_FINANCE_PARTY_PROC='dbo.usp_read_current_finance_deltas';
// Materialize the receipt header and effects before any page/native join.
// SQL otherwise reevaluates JSON_VALUE(receiptHash), located after the large
// full-before/after payload, for every effect/account in its nested-loop plan.
// The immutable receipt is still validated on every call in the same TX.
export const CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL=FINAL_PARTY_READ_SQL
 .replace('p.plan_hash<>r.plan_hash','r.parent_plan_hash<>r.plan_hash')
 .replace("JSON_VALUE(r.receipt_json,'$.receiptHash')",'r.parsed_receipt_hash')
 .replace("JSON_VALUE(r.receipt_json,'$.planHash')",'r.parsed_plan_hash')
 .replace("JSON_VALUE(r.receipt_json,'$.actorId')",'r.parsed_actor_id')
 .replace('FROM erp_migration.final_cutover_children r JOIN erp_migration.final_cutover_parents p ON p.cutover_id=r.cutover_id\nCROSS APPLY OPENJSON(r.receipt_json,\'$.effects\') WITH(nativeId bigint,delta decimal(28,8),movementId bigint,auditId bigint) e',
  'FROM #current_finance_receipts r JOIN #current_finance_effects e ON e.child_id=r.child_id')
 .replace('JOIN OPENJSON(@account_ids) ids ON a.id=TRY_CONVERT(bigint,ids.value)','JOIN #current_finance_ids ids ON a.id=ids.account_id')
 .replace("JSON_VALUE(r.receipt_json,'$.status')",'r.parsed_status');
export const CURRENT_FINANCE_PARTY_PROC_SQL=`CREATE PROCEDURE ${CURRENT_FINANCE_PARTY_PROC} @account_ids nvarchar(max),@cutover_id uniqueidentifier,@plan_hash char(64),@party_hash char(64),@packet_hash char(64) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR @@SERVERNAME<>N'Semih\\MELISADEV' OR @@TRANCOUNT=0 THROW 51831,'CURRENT_FINANCE_PARTY_TARGET_TRANSACTION',1;
 IF ISJSON(@account_ids)<>1 OR(SELECT COUNT(*) FROM OPENJSON(@account_ids))>1000 OR EXISTS(SELECT 1 FROM OPENJSON(@account_ids) WHERE TRY_CONVERT(bigint,value) IS NULL OR TRY_CONVERT(bigint,value)<1) THROW 51831,'CURRENT_FINANCE_PARTY_PAGE_SCOPE',1;
 IF NOT EXISTS(SELECT 1 FROM erp_migration.final_cutover_parents WHERE cutover_id=@cutover_id AND plan_hash=@plan_hash AND party_hash=@party_hash AND JSON_VALUE(plan_json,'$.schemaVersion')=N'melisa-current-finance-test-application.v1' AND JSON_VALUE(plan_json,'$.packetHash')=@packet_hash AND JSON_VALUE(plan_json,'$.actualT1')=N'false') OR COALESCE((SELECT TOP(1) state FROM erp_migration.final_cutover_events WHERE cutover_id=@cutover_id ORDER BY id DESC),N'')<>N'CURRENT_RECONCILED' THROW 51831,'CURRENT_FINANCE_PARTY_PARENT_NOT_RECONCILED',1;
 SELECT TRY_CONVERT(bigint,value) account_id INTO #current_finance_ids FROM OPENJSON(@account_ids);
 SELECT r.child_id,r.plan_hash,r.receipt_hash,r.domain,r.inverse,p.plan_hash parent_plan_hash,
  meta.parsed_receipt_hash,meta.parsed_plan_hash,meta.parsed_actor_id,meta.parsed_status,meta.effects_json
 INTO #current_finance_receipts
 FROM erp_migration.final_cutover_children r JOIN erp_migration.final_cutover_parents p ON p.cutover_id=r.cutover_id
 CROSS APPLY OPENJSON(r.receipt_json) WITH(parsed_receipt_hash nvarchar(max) '$.receiptHash',parsed_plan_hash nvarchar(max) '$.planHash',parsed_actor_id nvarchar(max) '$.actorId',parsed_status nvarchar(max) '$.status',effects_json nvarchar(max) '$.effects' AS JSON) meta
 WHERE p.cutover_id=@cutover_id AND p.party_hash=@party_hash AND p.plan_hash=@plan_hash AND r.domain=N'account';
 IF EXISTS(SELECT 1 FROM #current_finance_receipts WHERE parsed_receipt_hash IS NULL OR parsed_plan_hash IS NULL OR parsed_actor_id IS NULL OR parsed_status IS NULL OR effects_json IS NULL OR DATALENGTH(parsed_receipt_hash)>8000 OR DATALENGTH(parsed_plan_hash)>8000 OR DATALENGTH(parsed_actor_id)>8000 OR DATALENGTH(parsed_status)>8000) THROW 51831,'CURRENT_FINANCE_PARTY_RECEIPT_METADATA',1;
 SELECT r.child_id,e.nativeId,e.delta,e.movementId,e.auditId INTO #current_finance_effects
 FROM #current_finance_receipts r CROSS APPLY OPENJSON(r.effects_json) WITH(nativeId bigint,delta decimal(28,8),movementId bigint,auditId bigint) e;
 CREATE INDEX IX_current_finance_effect_native ON #current_finance_effects(nativeId,child_id);
 SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,(SELECT * FROM(${CURRENT_FINANCE_PARTY_PROOF_QUERY_SQL}) proof FOR JSON PATH,INCLUDE_NULL_VALUES) rowsJson;END`;
export const CURRENT_FINANCE_PARTY_PROC_HASH=createHash('sha256').update(CURRENT_FINANCE_PARTY_PROC_SQL,'utf16le').digest('hex').toUpperCase();
// SQL Server can persist either the explicit CREATE or explicit ALTER header
// in OBJECT_DEFINITION. Both complete bodies are pinned, with no normalization
// or acceptance of arbitrary alternative procedure text.
export const CURRENT_FINANCE_PARTY_PROC_ALTER_SQL=CURRENT_FINANCE_PARTY_PROC_SQL.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ');
export const CURRENT_FINANCE_PARTY_PROC_ALTER_HASH=createHash('sha256').update(CURRENT_FINANCE_PARTY_PROC_ALTER_SQL,'utf16le').digest('hex').toUpperCase();
export const CURRENT_FINANCE_PARTY_DEFINITION_HASHES=Object.freeze([CURRENT_FINANCE_PARTY_PROC_HASH,CURRENT_FINANCE_PARTY_PROC_ALTER_HASH]);
let configured=null;
export function currentFinanceContext(context){
 if(context===null||context===undefined)return null;
 if(context.schemaVersion!=='melisa-current-finance-read-context.v1'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.cutoverId??'')||['planHash','partyBindingsHash','packetHash'].some(k=>!/^[a-f0-9]{64}$/i.test(context[k]??''))||!Array.isArray(context.accountIds)||context.accountIds.length>283||context.accountIds.some(id=>! /^[1-9]\d*$/.test(id))||new Set(context.accountIds).size!==context.accountIds.length)throw Error('CURRENT_FINANCE_PARTY_CONTEXT');
 return {cutoverId:context.cutoverId,planHash:context.planHash,partyHash:context.partyBindingsHash,packetHash:context.packetHash,accountIds:[...context.accountIds]};
}
export function configureCurrentFinanceContext(context,{identity,mode,port,writes}={}){
 if(!context){configured=null;return;}
 const copy=registeredSharedPartyContext();
 if(copy){if(identity?.serverName!==copy.target.server||identity?.databaseName!==copy.target.database||identity?.sysadmin!==0||identity?.loginName!==copy.target.login||identity?.databaseControl!==0||identity?.originalDatabaseAccess!==0||identity?.liveDatabaseAccess!==0||mode!=='erp'||port!==isolatedCopyTopology(copy).apiPort||writes!==true)throw Error('CURRENT_FINANCE_PARTY_RUNTIME');}
 else if(identity?.serverName!=='Semih\\MELISADEV'||identity?.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity?.sysadmin!==0||mode!=='erp'||port!==4144||writes!==true)throw Error('CURRENT_FINANCE_PARTY_RUNTIME');
 currentFinanceContext(context);configured=Object.freeze({...context,accountIds:Object.freeze([...context.accountIds])});
}
export const configuredCurrentFinanceContext=()=>configured;
export async function readCurrentFinanceProof({sql,tx,ids,context}){
 const c=currentFinanceContext(context);if(!c)return null;
 if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>! /^[1-9]\d*$/.test(id))||new Set(ids).size!==ids.length)throw Error('CURRENT_FINANCE_PARTY_PAGE_SCOPE');
 const copy=registeredSharedPartyContext();let hashes=CURRENT_FINANCE_PARTY_DEFINITION_HASHES,procedure=CURRENT_FINANCE_PARTY_PROC;
 if(copy){await assertSharedPartyTransactionIdentity({sql,tx,context:copy});const recipe=sharedPartyReaderDefinition(copy,{role:'currentFinance',sourceSQL:CURRENT_FINANCE_PARTY_PROC_SQL});hashes=[recipe.afterHash];procedure=recipe.name;}
 const req=new sql.Request(tx).input('account_ids',sql.NVarChar(sql.MAX),JSON.stringify(ids)).input('cutover_id',sql.NVarChar(36),c.cutoverId).input('plan_hash',sql.Char(64),c.planHash).input('party_hash',sql.Char(64),c.partyHash).input('packet_hash',sql.Char(64),c.packetHash);
 if(copy)req.input('copy_id',sql.UniqueIdentifier,copy.copyId);
 const result=await req.execute(procedure),row=result.recordset?.[0];
 if(!hashes.includes(row?.readerDefinitionHash))throw Error('CURRENT_FINANCE_PARTY_READER_DRIFT');
 const proof=JSON.parse(row.rowsJson??'[]');
 if(!Array.isArray(proof)||proof.some(p=>!ids.includes(p.accountId)||!c.accountIds.includes(p.accountId))||new Set(proof.map(p=>p.accountId)).size!==proof.length)throw Error('CURRENT_FINANCE_PARTY_READBACK');
 const byId=new Map(proof.map(p=>[p.accountId,p]));
 for(const id of ids)if(c.accountIds.includes(id)&&!byId.has(id))throw Error('CURRENT_FINANCE_PARTY_MISSING_PROOF');
 return proof;
}
const units=value=>{if(typeof value!=='string'||! /^-?\d+\.\d{8}$/.test(value))throw Error('CURRENT_FINANCE_PARTY_EXACT');return BigInt(value.replace('.',''));};
const exact=n=>(n<0n?'-':'')+(n<0n?-n:n)/100000000n+'.'+((n<0n?-n:n)%100000000n).toString().padStart(8,'0');
export function attachCurrentFinanceProof(rows,proof){
 const byId=new Map(proof.map(p=>[p.accountId,p]));if(byId.size!==proof.length)throw Error('CURRENT_FINANCE_PARTY_DUPLICATE');
 for(const row of rows)for(const account of row.nativeAccounts??[]){
  const p=byId.get(account.id);if(!p)continue;
  const previous=account.finalSourceDeltaExact===undefined?'0.00000000':account.finalSourceDeltaExact;
  const verified=p.verified===true&&account.finalSourceDeltaVerified!==false;
  account.finalSourceDeltaVerified=verified;account.finalSourceDeltaExact=verified?exact(units(previous)+units(p.sourceDeltaExact)):null;
 }
 return rows;
}
