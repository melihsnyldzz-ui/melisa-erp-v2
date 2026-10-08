// Read-only additive proof for an amount-approved TEST batch, not a T1 cutover.
import {createHash} from 'node:crypto';
import {FINAL_PARTY_READ_SQL} from './finalPartyDeltaRead.mjs';

export const CURRENT_FINANCE_PARTY_PROC='dbo.usp_read_current_finance_deltas';
const query=FINAL_PARTY_READ_SQL.replace("WHERE r.domain=N'account'", "WHERE p.cutover_id=@cutover_id AND p.party_hash=@party_hash AND p.plan_hash=@plan_hash AND r.domain=N'account'");
export const CURRENT_FINANCE_PARTY_PROC_SQL=`CREATE PROCEDURE ${CURRENT_FINANCE_PARTY_PROC} @account_ids nvarchar(max),@cutover_id uniqueidentifier,@plan_hash char(64),@party_hash char(64),@packet_hash char(64) WITH EXECUTE AS OWNER AS BEGIN SET NOCOUNT ON;
 IF DB_NAME()<>N'MELISA_ERP_SIRKET_TEST_20260929_01' OR @@SERVERNAME<>N'Semih\\MELISADEV' OR @@TRANCOUNT=0 THROW 51831,'CURRENT_FINANCE_PARTY_TARGET_TRANSACTION',1;
 IF ISJSON(@account_ids)<>1 OR(SELECT COUNT(*) FROM OPENJSON(@account_ids))>1000 OR EXISTS(SELECT 1 FROM OPENJSON(@account_ids) WHERE TRY_CONVERT(bigint,value) IS NULL OR TRY_CONVERT(bigint,value)<1) THROW 51831,'CURRENT_FINANCE_PARTY_PAGE_SCOPE',1;
 IF NOT EXISTS(SELECT 1 FROM erp_migration.final_cutover_parents WHERE cutover_id=@cutover_id AND plan_hash=@plan_hash AND party_hash=@party_hash AND JSON_VALUE(plan_json,'$.schemaVersion')=N'melisa-current-finance-test-application.v1' AND JSON_VALUE(plan_json,'$.packetHash')=@packet_hash AND JSON_VALUE(plan_json,'$.actualT1')=N'false') OR COALESCE((SELECT TOP(1) state FROM erp_migration.final_cutover_events WHERE cutover_id=@cutover_id ORDER BY id DESC),N'')<>N'CURRENT_RECONCILED' THROW 51831,'CURRENT_FINANCE_PARTY_PARENT_NOT_RECONCILED',1;
 SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@@PROCID)),2) readerDefinitionHash,(SELECT * FROM(${query}) proof FOR JSON PATH,INCLUDE_NULL_VALUES) rowsJson;END`;
export const CURRENT_FINANCE_PARTY_PROC_HASH=createHash('sha256').update(CURRENT_FINANCE_PARTY_PROC_SQL,'utf16le').digest('hex').toUpperCase();
let configured=null;
export function currentFinanceContext(context){
 if(context===null||context===undefined)return null;
 if(context.schemaVersion!=='melisa-current-finance-read-context.v1'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(context.cutoverId??'')||['planHash','partyBindingsHash','packetHash'].some(k=>!/^[a-f0-9]{64}$/i.test(context[k]??''))||!Array.isArray(context.accountIds)||context.accountIds.length>283||context.accountIds.some(id=>! /^[1-9]\d*$/.test(id))||new Set(context.accountIds).size!==context.accountIds.length)throw Error('CURRENT_FINANCE_PARTY_CONTEXT');
 return {cutoverId:context.cutoverId,planHash:context.planHash,partyHash:context.partyBindingsHash,packetHash:context.packetHash,accountIds:[...context.accountIds]};
}
export function configureCurrentFinanceContext(context,{identity,mode,port,writes}={}){
 if(!context){configured=null;return;}
 if(identity?.serverName!=='Semih\\MELISADEV'||identity?.databaseName!=='MELISA_ERP_SIRKET_TEST_20260929_01'||identity?.sysadmin!==0||mode!=='erp'||port!==4144||writes!==true)throw Error('CURRENT_FINANCE_PARTY_RUNTIME');
 currentFinanceContext(context);configured=Object.freeze({...context,accountIds:Object.freeze([...context.accountIds])});
}
export const configuredCurrentFinanceContext=()=>configured;
export async function readCurrentFinanceProof({sql,tx,ids,context}){
 const c=currentFinanceContext(context);if(!c)return null;
 if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>! /^[1-9]\d*$/.test(id))||new Set(ids).size!==ids.length)throw Error('CURRENT_FINANCE_PARTY_PAGE_SCOPE');
 const result=await new sql.Request(tx).input('account_ids',sql.NVarChar(sql.MAX),JSON.stringify(ids)).input('cutover_id',sql.NVarChar(36),c.cutoverId).input('plan_hash',sql.Char(64),c.planHash).input('party_hash',sql.Char(64),c.partyHash).input('packet_hash',sql.Char(64),c.packetHash).execute(CURRENT_FINANCE_PARTY_PROC),row=result.recordset?.[0];
 if(row?.readerDefinitionHash!==CURRENT_FINANCE_PARTY_PROC_HASH)throw Error('CURRENT_FINANCE_PARTY_READER_DRIFT');
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
