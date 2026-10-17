import {assertIsolatedCopyContext,BUSINESS_COPY_DATABASE,copyAssert,isolatedCopyHash,isolatedCopyUUID} from './isolatedOperationCopyContext.mjs';

export const BUSINESS_DAILY_NATIVE_CHECK='CK_stock_movements_source_type_native';
export const BUSINESS_DAILY_NATIVE_CHECK_BEFORE='AE140C5E1B05307F9FD6AB25E1CAB5278F95AC58F4F5174217AC1351A6D3F398';
const registry='dbo.stage4_copy_business_daily_owned_count_check',trigger='dbo.immutable_business_daily_owned_count_check',helper='dbo.usp_business_daily_count_check_apply_once';
const registered=new WeakMap();
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.toSorted().join(',');
const hash=v=>typeof v==='string'&&/^[A-F0-9]{64}$/.test(v);
const configKeys=['schemaVersion','copyId','baseSealHash','dailyRevisionHash','profitRevisionHash','dailyScopeHash','name','beforeHash','afterHash','failureProofHash','countId','proofHash','helperHash','immutableTriggerHash','revisionHash'];
const proofBody=r=>Object.fromEntries(['copyId','baseSealHash','dailyRevisionHash','profitRevisionHash','dailyScopeHash','name','beforeHash','afterHash','failureProofHash','countId'].map(k=>[k,r[k]]).concat([['revision',1]]));
export function validateBusinessDailyNativeCheckRevision(daily,profit,input){
 copyAssert(exact(input,configKeys)&&input.schemaVersion==='melisa-business-daily-native-check.v1'&&daily?.version===4&&profit?.version===5&&input.copyId===daily.copyId&&input.copyId===profit.copyId&&input.baseSealHash===daily.baseSealHash&&input.baseSealHash===profit.baseSealHash&&input.dailyRevisionHash===daily.revisionHash&&input.profitRevisionHash===profit.revisionHash&&input.dailyScopeHash===daily.dailyScopeHash&&input.dailyScopeHash===profit.dailyScopeHash&&input.name===BUSINESS_DAILY_NATIVE_CHECK&&input.beforeHash===BUSINESS_DAILY_NATIVE_CHECK_BEFORE&&Number.isSafeInteger(input.countId)&&input.countId>0,'BUSINESS_DAILY_NATIVE_CHECK_REVISION');
 for(const k of ['baseSealHash','dailyRevisionHash','profitRevisionHash','dailyScopeHash','beforeHash','afterHash','failureProofHash','proofHash','helperHash','immutableTriggerHash','revisionHash'])copyAssert(hash(input[k]),'BUSINESS_DAILY_NATIVE_CHECK_HASH');
 copyAssert(input.afterHash!==input.beforeHash&&input.proofHash===isolatedCopyHash(proofBody(input)),'BUSINESS_DAILY_NATIVE_CHECK_PROOF_SEAL');
 const {revisionHash,...body}=input;copyAssert(revisionHash===isolatedCopyHash(body),'BUSINESS_DAILY_NATIVE_CHECK_REVISION_SEAL');return input;
}
export function businessDailyNativeCheckReadSQL(){return `SELECT DB_NAME() databaseName,CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) serverName,CONVERT(varchar(64),HASHBYTES('SHA2_256',c.definition),2) currentHash,c.is_disabled isDisabled,c.is_not_trusted isNotTrusted,CONVERT(bit,CASE WHEN OBJECT_ID(N'${registry}',N'U') IS NULL THEN 0 ELSE 1 END) registryExists,CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'${trigger}'))),2) triggerHash,ISNULL(CONVERT(int,OBJECTPROPERTY(OBJECT_ID(N'${trigger}'),'ExecIsTriggerDisabled')),1) triggerDisabled,CONVERT(bit,CASE WHEN OBJECT_ID(N'${helper}') IS NULL THEN 0 ELSE 1 END) helperExists FROM sys.check_constraints c WHERE c.parent_object_id=OBJECT_ID(N'dbo.stock_movements') AND c.name=N'${BUSINESS_DAILY_NATIVE_CHECK}';
IF OBJECT_ID(N'${registry}',N'U') IS NOT NULL EXEC(N'SELECT copy_id,revision,base_seal_hash,daily_revision_hash,profit_revision_hash,daily_scope_hash,name,before_hash,after_hash,failure_proof_hash,CONVERT(varchar(20),count_id) count_id,proof_hash,helper_hash,created_at FROM ${registry} WITH(HOLDLOCK) ORDER BY copy_id;'); ELSE SELECT CAST(NULL AS uniqueidentifier) copy_id WHERE 1=0;`;}
export function assertBusinessDailyNativeCheckProof(context,input,result){
 assertIsolatedCopyContext(context);
 copyAssert(context.target.database===BUSINESS_COPY_DATABASE&&Array.isArray(result?.recordsets)&&result.recordsets.length===2&&result.recordsets[0]?.length===1&&Array.isArray(result.recordsets[1]),'BUSINESS_DAILY_NATIVE_CHECK_DB_PROOF');
 const r=result.recordsets[0][0],rows=result.recordsets[1];
 copyAssert(exact(r,['databaseName','serverName','currentHash','isDisabled','isNotTrusted','registryExists','triggerHash','triggerDisabled','helperExists'])&&r.databaseName===context.target.database&&r.serverName===context.target.server&&[0,false].includes(r.isDisabled)&&[0,false].includes(r.isNotTrusted)&&[0,false].includes(r.helperExists),'BUSINESS_DAILY_NATIVE_CHECK_CURRENT');
 if(input===undefined){copyAssert(r.currentHash===BUSINESS_DAILY_NATIVE_CHECK_BEFORE&&[0,false].includes(r.registryExists)&&r.triggerHash===null&&r.triggerDisabled===1&&rows.length===0,'BUSINESS_DAILY_NATIVE_CHECK_UNCONFIGURED');return true;}
 copyAssert(input.copyId===context.copyId&&input.baseSealHash===context.sealHash&&r.currentHash===input.afterHash&&[1,true].includes(r.registryExists)&&r.triggerHash===input.immutableTriggerHash&&r.triggerDisabled===0&&rows.length===1,'BUSINESS_DAILY_NATIVE_CHECK_ADJUNCT');
 const row=rows[0],expected={copy_id:input.copyId,revision:1,base_seal_hash:input.baseSealHash,daily_revision_hash:input.dailyRevisionHash,profit_revision_hash:input.profitRevisionHash,daily_scope_hash:input.dailyScopeHash,name:input.name,before_hash:input.beforeHash,after_hash:input.afterHash,failure_proof_hash:input.failureProofHash,count_id:input.countId,proof_hash:input.proofHash,helper_hash:input.helperHash};
 copyAssert(exact(row,[...Object.keys(expected),'created_at'])&&(typeof row.created_at==='string'||row.created_at instanceof Date),'BUSINESS_DAILY_NATIVE_CHECK_ROW');
 for(const[k,v]of Object.entries(expected))copyAssert(k==='copy_id'?typeof row[k]==='string'&&isolatedCopyUUID(row[k].toLowerCase())&&row[k].toLowerCase()===v:k==='count_id'?row[k]===String(v):row[k]===v,'BUSINESS_DAILY_NATIVE_CHECK_PIN');return true;
}
export function registerBusinessDailyNativeCheck(context,daily,profit,input,result){
 assertIsolatedCopyContext(context);if(input!==undefined)validateBusinessDailyNativeCheckRevision(daily,profit,input);assertBusinessDailyNativeCheckProof(context,input,result);registered.set(context,input===undefined?null:Object.freeze(structuredClone(input)));return true;
}
export async function verifyBusinessDailyNativeCheck(context,request){
 assertIsolatedCopyContext(context);if(context.target.database!==BUSINESS_COPY_DATABASE)return true;
 copyAssert(registered.has(context)&&typeof request?.query==='function','BUSINESS_DAILY_NATIVE_CHECK_SERVER_REGISTRATION');
 return assertBusinessDailyNativeCheckProof(context,registered.get(context)??undefined,await request.query(businessDailyNativeCheckReadSQL()));
}
