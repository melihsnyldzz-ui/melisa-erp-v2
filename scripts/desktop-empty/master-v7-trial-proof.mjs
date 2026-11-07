// Pure, non-authorizing preparation. A caller must establish independent
// process/target provenance and user authorization before any actual apply.
import {createHash} from 'node:crypto';
import {compareDesktopFinanceV6Observations,assertDesktopFinanceV6Baseline} from './master-v7-snapshot-verify.mjs';
import {compileDesktopFinanceV7Trial} from './master-v7-trial.mjs';
import {compareDesktopFinanceV7OldMetadata} from './master-v7-metadata-compare.mjs';
import {compareDesktopFinanceV7Security} from './master-v7-security-compare.mjs';
import {verifyDesktopFinanceV7Semantics} from './master-v7-semantic-verify.mjs';
const fail=()=>{throw Error('MASTER_V7_TRIAL_PROOF_INVALID');};
const sha=(v,encoding)=>createHash('sha256').update(v,encoding).digest('hex');
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const prepared=new WeakSet();
export function assertDesktopFinanceV7TrialProof(value){if(!prepared.has(value)||value.state!=='MASTER_V7_TRIAL_CONTENTS_MATCH_SOURCE_ONLY'||value.admissionAllowed!==false||value.independentOriginVerified!==false||value.userAuthorizationVerified!==false)fail();return value;}
function decode(bytes,expected){if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>8000000||!hash(expected)||sha(bytes)!==expected)fail();try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail();}}
export function prepareDesktopFinanceV7TrialProof({baseline,observed,baselineBytes,trialBytes,trialProofSha256,trialSqlSha256,grantorPrincipalId}={}){
 if(arguments.length!==1||Object.keys(arguments[0]??{}).sort().join(',')!=='baseline,baselineBytes,grantorPrincipalId,observed,trialBytes,trialProofSha256,trialSqlSha256')fail();assertDesktopFinanceV6Baseline(baseline);assertDesktopFinanceV6Baseline(observed);compareDesktopFinanceV6Observations({baseline,observed});if(baseline.proofSha256===observed.proofSha256)fail();
 const source=decode(baselineBytes,baseline.proofSha256),b=source?.state==='V6_RUNTIME_READ_ONLY_SNAPSHOT_BATCH_COMPLETED'?source.result:source,trial=decode(trialBytes,trialProofSha256),r=trial?.result??trial;
 if(!hash(trialSqlSha256)||trialSqlSha256!==compileDesktopFinanceV7Trial({baseline}).sha256||r?.state!=='MASTER_V7_ROLLED_BACK_SOURCE_TRIAL'||![r.candidateMetadataJson,r.candidateSecurityJson,r.candidateMetadataSemanticJson,r.candidateSecuritySemanticJson,r.oldBusinessJson,r.oldIdentitiesJson,r.oldObjectIdsJson,r.newObjectIdsJson].every(v=>typeof v==='string'&&v.length>0&&v.length<2000000)||sha(r.oldBusinessJson,'utf16le')!==baseline.businessRowsSha256||sha(r.oldIdentitiesJson,'utf16le')!==baseline.identitiesSha256||sha(r.oldObjectIdsJson,'utf16le')!==baseline.objectIdsSha256)fail();
 let newTables,oldTables;try{newTables=JSON.parse(r.newObjectIdsJson);oldTables=JSON.parse(b.objectIdsJson);}catch{fail();}if(!Array.isArray(newTables)||!Array.isArray(oldTables)||oldTables.length!==40||newTables.some(n=>oldTables.some(o=>o.objectId===n.objectId)))fail();
 compareDesktopFinanceV7OldMetadata({baselineJson:b.metadataJson,candidateJson:r.candidateMetadataJson,newTables});compareDesktopFinanceV7Security({baselineJson:b.securityJson,candidateJson:r.candidateSecurityJson,newTables,grantorPrincipalId});const semantic=verifyDesktopFinanceV7Semantics({metadataJson:r.candidateMetadataJson,securityJson:r.candidateSecurityJson,metadataSemanticJson:r.candidateMetadataSemanticJson,securitySemanticJson:r.candidateSecuritySemanticJson,newTables});
 const result=Object.freeze({state:'MASTER_V7_TRIAL_CONTENTS_MATCH_SOURCE_ONLY',baselineProofSha256:baseline.proofSha256,independentProofSha256:observed.proofSha256,trialProofSha256,trialSqlSha256,candidateMetadataSha256:sha(r.candidateMetadataJson,'utf16le'),candidateSecuritySha256:sha(r.candidateSecurityJson,'utf16le'),candidateMetadataSemanticSha256:semantic.metadataSemanticSha256,candidateSecuritySemanticSha256:semantic.securitySemanticSha256,independentOriginVerified:false,userAuthorizationVerified:false,admissionAllowed:false});prepared.add(result);return result;
}
