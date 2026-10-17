import test from 'node:test';
import assert from 'node:assert/strict';
import {businessInboundFixture} from './businessInbound.test-fixture.mjs';
import {validateIsolatedOperationCopyContext,isolatedCopyHash} from './isolatedOperationCopyContext.mjs';
import {BUSINESS_DAILY_NATIVE_CHECK,BUSINESS_DAILY_NATIVE_CHECK_BEFORE,validateBusinessDailyNativeCheckRevision,assertBusinessDailyNativeCheckProof,registerBusinessDailyNativeCheck,verifyBusinessDailyNativeCheck,businessDailyNativeCheckReadSQL} from './businessDailyNativeCheck.mjs';
function fixture(){
 const c=validateIsolatedOperationCopyContext(structuredClone(businessInboundFixture().copy));
 const daily={version:4,copyId:c.copyId,baseSealHash:c.sealHash,revisionHash:'A'.repeat(64),dailyScopeHash:'B'.repeat(64)},profit={version:5,copyId:c.copyId,baseSealHash:c.sealHash,revisionHash:'C'.repeat(64),dailyScopeHash:daily.dailyScopeHash};
 const body={schemaVersion:'melisa-business-daily-native-check.v1',copyId:c.copyId,baseSealHash:c.sealHash,dailyRevisionHash:daily.revisionHash,profitRevisionHash:profit.revisionHash,dailyScopeHash:daily.dailyScopeHash,name:BUSINESS_DAILY_NATIVE_CHECK,beforeHash:BUSINESS_DAILY_NATIVE_CHECK_BEFORE,afterHash:'D'.repeat(64),failureProofHash:'E'.repeat(64),countId:111,helperHash:'F'.repeat(64),immutableTriggerHash:'9'.repeat(64)};
 body.proofHash=isolatedCopyHash(Object.fromEntries(['copyId','baseSealHash','dailyRevisionHash','profitRevisionHash','dailyScopeHash','name','beforeHash','afterHash','failureProofHash','countId'].map(k=>[k,body[k]]).concat([['revision',1]])));
 const input={...body,revisionHash:isolatedCopyHash(body)};
 const meta={databaseName:c.target.database,serverName:c.target.server,currentHash:BUSINESS_DAILY_NATIVE_CHECK_BEFORE,isDisabled:false,isNotTrusted:false,registryExists:false,triggerHash:null,triggerDisabled:1,helperExists:false};
 const old={recordsets:[[meta],[]]};
 const installed={recordsets:[[{...meta,currentHash:input.afterHash,registryExists:true,triggerHash:input.immutableTriggerHash,triggerDisabled:0}],[{copy_id:c.copyId,revision:1,base_seal_hash:c.sealHash,daily_revision_hash:daily.revisionHash,profit_revision_hash:profit.revisionHash,daily_scope_hash:daily.dailyScopeHash,name:input.name,before_hash:input.beforeHash,after_hash:input.afterHash,failure_proof_hash:input.failureProofHash,count_id:String(input.countId),proof_hash:input.proofHash,helper_hash:input.helperHash,created_at:new Date('2026-01-01T00:00:00Z')}]]};
 return {c,daily,profit,input,old,installed};
}
test('unextended DB02 requires exact old enabled trusted CHECK and absent adjunct',()=>{
 const f=fixture();assert.equal(assertBusinessDailyNativeCheckProof(f.c,undefined,f.old),true);
 for(const [key,value]of Object.entries({currentHash:'0'.repeat(64),isDisabled:true,isNotTrusted:true,registryExists:true,triggerHash:'1'.repeat(64),helperExists:true})){const p=structuredClone(f.old);p.recordsets[0][0][key]=value;assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,undefined,p));}
 assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,undefined,f.installed));
});
test('configured one-row adjunct pins v4/v5/scope, trusted current check, immutable trigger and removed helper',()=>{
 const f=fixture();validateBusinessDailyNativeCheckRevision(f.daily,f.profit,f.input);assert.equal(assertBusinessDailyNativeCheckProof(f.c,f.input,f.installed),true);
 const upper=structuredClone(f.installed);upper.recordsets[1][0].copy_id=f.c.copyId.toUpperCase();assert.equal(assertBusinessDailyNativeCheckProof(f.c,f.input,upper),true);
 for(const [key,value]of Object.entries({currentHash:'0'.repeat(64),isDisabled:true,isNotTrusted:true,triggerHash:null,triggerDisabled:1,helperExists:true})){const p=structuredClone(f.installed);p.recordsets[0][0][key]=value;assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,f.input,p));}
 for(const key of Object.keys(f.installed.recordsets[1][0])){const p=structuredClone(f.installed);p.recordsets[1][0][key]=null;assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,f.input,p));}
 const extra=structuredClone(f.installed);extra.recordsets[1][0].extra=true;assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,f.input,extra));
 const dup=structuredClone(f.installed);dup.recordsets[1].push(dup.recordsets[1][0]);assert.throws(()=>assertBusinessDailyNativeCheckProof(f.c,f.input,dup));
});
test('resealing cannot detach the exact historical chain and missing profit revision fails',()=>{
 const f=fixture();for(const key of ['copyId','baseSealHash','dailyRevisionHash','profitRevisionHash','dailyScopeHash','beforeHash','name']){const b={...f.input,[key]:'0'.repeat(64)};const{revisionHash,...rest}=b;b.revisionHash=isolatedCopyHash(rest);assert.throws(()=>validateBusinessDailyNativeCheckRevision(f.daily,f.profit,b));}
 assert.throws(()=>validateBusinessDailyNativeCheckRevision(f.daily,undefined,f.input));
 assert.throws(()=>validateBusinessDailyNativeCheckRevision(f.daily,f.profit,{...f.input,extra:true}));
});
test('server registration verifies every request freshly and cannot be supplied by a cloned context',async()=>{
 const f=fixture();registerBusinessDailyNativeCheck(f.c,f.daily,f.profit,f.input,f.installed);let count=0;
 const request={query:async sql=>{count++;assert.equal(sql,businessDailyNativeCheckReadSQL());return f.installed;}};
 await verifyBusinessDailyNativeCheck(f.c,request);await verifyBusinessDailyNativeCheck(f.c,request);assert.equal(count,2);
 f.installed.recordsets[0][0].currentHash='0'.repeat(64);await assert.rejects(verifyBusinessDailyNativeCheck(f.c,request));
 await assert.rejects(verifyBusinessDailyNativeCheck(structuredClone(f.c),request));
 assert.doesNotMatch(businessDailyNativeCheckReadSQL(),/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bALTER\b|\bGRANT\b/i);
});
