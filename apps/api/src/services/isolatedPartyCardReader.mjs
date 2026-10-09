// Finite adaptation of the existing C06/C07 owner readers. No connection,
// installation, role changes, or alternative projections are made here.
import {createHash} from 'node:crypto';
import {isIsolatedOperationCopyRuntime,getIsolatedOperationCopyConfig,isIsolatedCopyReadonlyRuntime,getIsolatedCopyReadonlyRuntime} from '../config/isolatedOperationCopyRuntime.mjs';
import {assertIsolatedCopyContext,SHARED_COPY_DATABASE,ISOLATED_COPY_SERVER,isolatedCopyTopology} from './isolatedOperationCopyContext.mjs';
const originalDatabase='MELISA_ERP_SIRKET_TEST_20260929_01';
const originalGuardHash='9AE41CA1AB25EE165019AD04DBD9A6FB4E5B7190F027E0A07A87FB03D698379E';
const normalHashes={customer:'7FE6BEE7728312D666FF3B68151CA60A08B84E4A6D5B33B36F300A48381E6C8E',supplier:'D750DDCD6B3F4AEDBDC9A38C5347DED081961A6018505559D2F7D50014404C0B',currentFinance:'874A0A2BF6CCB1955938A080E255555201134E91463469DA4C28D9BB1CFF7340'};
const hash=s=>createHash('sha256').update(s,'utf16le').digest('hex').toUpperCase();
const assert=(ok)=>{if(!ok)throw Error('ISOLATED_PARTY_READER_UNAVAILABLE');};
const q=s=>"N'"+s.replaceAll("'","''")+"'";
export function assertSharedPartyContext(c){
 assertIsolatedCopyContext(c);
 assert(c.target.database===SHARED_COPY_DATABASE&&c.target.server===ISOLATED_COPY_SERVER&&c.target.login==='melisa_shared_test_rw_20261009_01'&&/^[A-F0-9]{64}$/.test(c.catalogProof?.preservedGuardHash??''));
 return c;
}
export function registeredSharedPartyContext(){
 const c=isIsolatedOperationCopyRuntime()?getIsolatedOperationCopyConfig():isIsolatedCopyReadonlyRuntime()?getIsolatedCopyReadonlyRuntime().context:null;
 return c?assertSharedPartyContext(c):null;
}
export const SHARED_PARTY_IDENTITY_SQL="SELECT DB_NAME() db,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) server,SUSER_SNAME() login,USER_NAME() databaseUser,IS_SRVROLEMEMBER('sysadmin') sysadmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL') control,HAS_DBACCESS('MELISA_ERP_SIRKET_TEST_20260929_01') originalDatabaseAccess,HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01') live";
export function assertSharedPartyIdentity(c,i){
 assertSharedPartyContext(c);const users=[c.target.login,isolatedCopyTopology(c).reader];
 assert(i?.db===c.target.database&&i.server===c.target.server&&users.includes(i.login)&&i.databaseUser===i.login&&i.sysadmin===0&&i.control===0&&i.originalDatabaseAccess===0&&i.live===0);return i;
}
export function sharedPartyReaderDefinition(c,{role,sourceSQL,customerReaderHash=null}){
 assertSharedPartyContext(c);assert(Object.hasOwn(normalHashes,role)&&hash(sourceSQL)===normalHashes[role]);
 const name=role==='currentFinance'?'dbo.usp_read_current_finance_deltas':`dbo.usp_read_${role}_cards`;
 assert(sourceSQL.startsWith(`CREATE PROCEDURE ${name}`));
 const param=role==='currentFinance'?'@packet_hash char(64)':"@quarantine nvarchar(12)=N'all'";assert(sourceSQL.split(param).length===2);
 assert(sourceSQL.split(q(originalDatabase)).length===2&&(role==='currentFinance'||sourceSQL.split(originalGuardHash).length===2));
 let definition=sourceSQL.replace(param,param+',@copy_id uniqueidentifier=NULL').replace(q(originalDatabase),q(c.target.database)).replace(originalGuardHash,c.catalogProof.preservedGuardHash);
 if(role==='supplier'){
  assert(/^[A-F0-9]{64}$/.test(customerReaderHash??''));assert(definition.split(normalHashes.customer).length===2);definition=definition.replace(normalHashes.customer,customerReaderHash);
  // Immutable legacy receipts stay unchanged. A substitution requires the
  // same module name and its exact original hash in the sealed copy registry.
  definition=definition.replace(/m\.(after_hash|definition_hash)(?=<>CONVERT\(varchar\(64\),HASHBYTES\('SHA2_256',OBJECT_DEFINITION)/g,(_match,column)=>`COALESCE((SELECT p.after_hash FROM dbo.stage4_copy_module_manifest p WHERE p.name=N'dbo.'+m.name AND p.before_hash=m.${column}),m.${column})`);
  assert(definition.includes('p.before_hash=m.after_hash')&&definition.includes('p.before_hash=m.definition_hash'));
 }
 const opening=role==='currentFinance'?'AS BEGIN SET NOCOUNT ON;':'AS BEGIN\n SET NOCOUNT ON;';assert(definition.split(opening).length===2);
 const ready=`\n IF @copy_id IS NULL OR @copy_id<>CONVERT(uniqueidentifier,${q(c.copyId)}) OR ORIGINAL_LOGIN() COLLATE Latin1_General_100_BIN2 NOT IN(${q(c.target.login)},${q(isolatedCopyTopology(c).reader)}) OR NOT EXISTS(SELECT 1 FROM dbo.stage4_copy_manifest WHERE copy_id=@copy_id AND seal_hash=${q(c.sealHash)} AND backup_sha=${q(c.backupSHA)} AND sealed=1) THROW 51904,'ISOLATED_PARTY_READER_COPY_SCOPE',1;\n EXEC dbo.usp_stage4_copy_ready @copy_id;`;
 definition=definition.replace(opening,opening+ready);
 const sql=definition.replace(/^CREATE PROCEDURE /,'ALTER PROCEDURE ');
 // The copy rehearsal proves SQL Server persists CREATE for this exact ALTER
 // body. Only this complete literal definition is accepted at runtime.
 return {name,beforeHash:normalHashes[role],beforeHashes:role==='currentFinance'?[normalHashes[role],'636A719A34C35A16D18CDCD7472337AD7A1AFD83C6685EE3E3C7927BF8CE4A9B']:[normalHashes[role]],afterHash:hash(definition),definition,sql};
}

export async function assertSharedPartyTransactionIdentity({sql,tx,context}){const i=(await new sql.Request(tx).query(SHARED_PARTY_IDENTITY_SQL)).recordset?.[0];return assertSharedPartyIdentity(context,i);}
