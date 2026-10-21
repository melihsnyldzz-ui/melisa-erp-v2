// Pure finite history/profile binding only. This is not native admission or a
// resume dispatcher. Caller must independently prove no cut/NEW witnesses,
// unused continuation claim, fresh physical OLD10/COM and protected TEST state.
import {createHash} from 'node:crypto';
const root='C:\\Sirket\\ERP\\runtime\\P03-OWNER-20261018',failedRun='cffba2988afcb49502ae73ddd797e966',dir=root+'\\MelisaERP-P03-transition-'+failedRun;
const pin=(path,sha256)=>Object.freeze({path,sha256});
export const PR54_CURRENT_B007_PRECUT_REFS=Object.freeze({
 claim:pin(root+'\\p03-pr54-current-b007-successor-of-b264594b6f93d560d807c8decc4e6699.lock.json','3493a3538f95b72a5fa23823748b6dd947a5111f5dc4ba9b15015d6a91b9c408'),
 profile:pin(root+'\\MelisaERP-P03-profile-'+failedRun+'.json','7c3788d9dc97ae182adddec1b3b5f1106a6c408cc542ef00f8f6bc146ec4df8c'),
 before:pin(root+'\\MelisaERP-P03-before-'+failedRun+'.json','d6aec6a904ca36bccccc2d295a770d8fae53ca3190b0b763e43788d2e3294f5c'),
 transitionLock:pin(dir+'\\transition.lock','c66baf42ea82b2e29c1dfb3fb8b1982589742a64785449277a9584a0283c0f6d'),
 event0:pin(dir+'\\event-0000.json','df690bbe9df721b806c4fd907a033f2a2e9809cf3c31d7f90b1d5150dedb7bb6'),
 event1:pin(dir+'\\event-0001.json','5d3003c47091d8cb36438c28c4b9a56e6f86875f4d7c5740385934bef7a32bc6'),
 failureTail:pin(dir+'\\event-0002.json','87b537deb4eca741203055c35efb13ad6531e556d8c77a875d1e45d128583d82'),
 diagnostic:pin(dir+'\\io-failure-diagnostic.json','0b2b9a7d4697903957b8a5bb119fccfab1d929e6669195e899cb90d6ff4b8769'),
});
export const PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH=root+'\\p03-pr54-current-b007-continuation-of-'+failedRun+'.lock.json';
const hash=b=>createHash('sha256').update(b).digest('hex');
const reject=()=>{throw Error('P03_CURRENT_B007_PRECUT_CONTINUATION_REJECTED');};
const need=x=>{if(!x)reject();};
const record=x=>x&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>record(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
const ref=x=>exact(x,['path','sha256'])&&typeof x.path==='string'&&/^[a-f0-9]{64}$/.test(x.sha256);
// Reject accessor/prototype tricks before serialization. Array order is binding.
function data(x){if(x===null||['string','boolean','number'].includes(typeof x))return x;if(Array.isArray(x))return x.map(data);need(record(x));const out={};for(const k of Object.keys(x).sort()){const d=Object.getOwnPropertyDescriptor(x,k);need(d&&Object.hasOwn(d,'value'));out[k]=data(d.value);}return out;}
const same=(a,b)=>JSON.stringify(data(a))===JSON.stringify(data(b));
const omit=(x,keys)=>Object.fromEntries(Object.entries(x).filter(([key])=>!keys.includes(key)));
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const encoded=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
// Structural revalidation is also used after claim. It grants no freshness,
// native admission or execution authority and must not add a recovery clock.
export function validatePr54CurrentB007PrecutContinuationBinding({raw,profileRef,beforeRef,profile,before}){
 need(exact(raw,Object.keys(PR54_CURRENT_B007_PRECUT_REFS)));const old={};
 for(const [key,fixed]of Object.entries(PR54_CURRENT_B007_PRECUT_REFS)){const row=raw[key];need(exact(row,['ref','bytes'])&&ref(row.ref)&&same(row.ref,fixed)&&row.bytes instanceof Uint8Array&&row.bytes.byteLength>0&&row.bytes.byteLength<=16777216&&hash(row.bytes)===fixed.sha256);try{old[key]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(row.bytes));}catch{reject();}}
 const claim=old.claim,prior=old.before,priorProfile=old.profile;
 need(claim.schemaVersion==='melisa-p03-current-b007-epoch-claim.v1'&&claim.successorRunId===failedRun&&claim.transitionAuthority===true&&claim.applyExecuted===false&&same(claim.successorProfile,PR54_CURRENT_B007_PRECUT_REFS.profile)&&same(claim.successorBefore,PR54_CURRENT_B007_PRECUT_REFS.before)&&same(claim.newSettings,priorProfile.newSettings));
 need(exact(old.transitionLock,['profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir'])&&same(old.transitionLock.profileRef,claim.successorProfile)&&same(old.transitionLock.beforeRef,claim.successorBefore)&&same(old.transitionLock.successorClaimRef,PR54_CURRENT_B007_PRECUT_REFS.claim));
 let previous=PR54_CURRENT_B007_PRECUT_REFS.before.sha256;
 for(const [i,event]of ['TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED'].entries()){const v=old[i===2?'failureTail':'event'+i];need(exact(v,['sequence','digest','event','stopOrderDigest',...(i?['target']:[]),'previousSha256','profileSha256','beforeSha256'])&&v.sequence===i&&v.event===event&&v.digest===prior.plan.digest&&v.stopOrderDigest===claim.stopOrderDigest&&v.previousSha256===previous&&v.profileSha256===PR54_CURRENT_B007_PRECUT_REFS.profile.sha256&&v.beforeSha256===PR54_CURRENT_B007_PRECUT_REFS.before.sha256&&(i===0||v.target===(i===1?'coreSupervisor':'HELD_CORE_CUT')));previous=PR54_CURRENT_B007_PRECUT_REFS[i===2?'failureTail':'event'+i].sha256;}
 need(exact(old.diagnostic,['phase','reason','profileSha256','beforeSha256'])&&old.diagnostic.phase==='HELD_CORE_CUT'&&old.diagnostic.reason==='P03_OWNER_TRANSITION_STOPPED'&&old.diagnostic.profileSha256===claim.successorProfile.sha256&&old.diagnostic.beforeSha256===claim.successorBefore.sha256);
 data(profile);data(before);need(record(profile)&&record(before)&&ref(profileRef)&&ref(beforeRef));
 need(typeof before.runId==='string'&&/^[a-f0-9]{32}$/.test(before.runId)&&before.runId!==failedRun&&profileRef.path===root+'\\MelisaERP-P03-profile-'+before.runId+'.json'&&beforeRef.path===root+'\\MelisaERP-P03-before-'+before.runId+'.json'&&hash(encoded(profile))===profileRef.sha256&&hash(encoded(before))===beforeRef.sha256&&same(profile.beforeImage,beforeRef));
 need(time(before.startedAt)&&time(before.observedAt)&&Date.parse(before.startedAt)<=Date.parse(before.observedAt)&&Date.parse(before.startedAt)>=Date.parse(prior.observedAt));
 need(same(omit(before,['runId','startedAt','observedAt']),omit(prior,['runId','startedAt','observedAt'])));
 need(ref(profile.businessDigest)&&/^C:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json$/.test(profile.businessDigest.path)&&profile.businessDigest.path!==priorProfile.businessDigest.path&&profile.businessDigest.path.slice(0,profile.businessDigest.path.lastIndexOf('\\'))===priorProfile.businessDigest.path.slice(0,priorProfile.businessDigest.path.lastIndexOf('\\')));
 need(profile.journalDirectory===root+'\\MelisaERP-P03-recovery-'+before.runId&&ref(profile.stopper)&&profile.stopper.path===root+'\\MelisaERP-P03-stopper-'+before.runId+'.ps1'&&profile.stopper.sha256===priorProfile.stopper.sha256);
 need(same(omit(profile,['beforeImage','businessDigest','journalDirectory','stopper']),omit(priorProfile,['beforeImage','businessDigest','journalDirectory','stopper'])));
 return Object.freeze({schemaVersion:'melisa-p03-current-b007-precut-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_REFS.failureTail,profileRef:pin(profileRef.path,profileRef.sha256),beforeRef:pin(beforeRef.path,beforeRef.sha256),claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH});
}
export function preparePr54CurrentB007PrecutContinuation({raw,profileRef,beforeRef,profile,before,now=Date.now()}){
 const receipt=validatePr54CurrentB007PrecutContinuationBinding({raw,profileRef,beforeRef,profile,before});
 need(Number.isFinite(now)&&now-Date.parse(before.observedAt)>=0&&now-Date.parse(before.observedAt)<900000);
 return receipt;
}

// Same immutable 452 claim: finite supplemental binding within this module.
const resumeFailedRun='452054204a1857ff618b0dd30a59caea',resumeDir=root+'\\MelisaERP-P03-transition-'+resumeFailedRun;
export const PR54_CURRENT_B007_PRECUT_RESUME_REFS=Object.freeze({
 claim:pin(PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH,'a5990db676c6308e0899d81a2f6efdde539544109762802d62137d9ec853e544'),
 profile:pin(root+'\\MelisaERP-P03-profile-'+resumeFailedRun+'.json','4b808868f23ced8015aad4395a7c390017b374d3c23fe23d48fc6bf7f0397c39'),
 before:pin(root+'\\MelisaERP-P03-before-'+resumeFailedRun+'.json','23ae28bc8d01f644c9f56404c6b358bc57afec336bb82bb3ad19158f2bd11d3f'),
 event0:pin(resumeDir+'\\event-0000.json','18a78709172e036d3d9f452438af4cf9e21f39c89679271094447f44463da02a'),
 event1:pin(resumeDir+'\\event-0001.json','741ea2a53a304ba27aff7bcade2548effa22a63e72ccbcf920189e4c6718330c'),
 failureTail:pin(resumeDir+'\\event-0002.json','778f22864dcbfaf536f5465a255f8d94826f0d16ebfa09cc8927a1fc42f71777'),
 diagnostic:pin(resumeDir+'\\io-failure-diagnostic.json','444e65abd6ed614f7e1d1e9dfc1b0c86427f4abcc2879541850fa0631b8855db'),
 context:pin(resumeDir+'\\precut-continuation.json','edd1499034512d99153cff12d787a041571195cc59e3a1b01f94bc00dea6b7c1'),
 transitionLock:pin(resumeDir+'\\transition.lock','349cf763daa3c4cca0856640d48d82ed3c034325d0ad476b4019a31d7374eb73'),
 snapshot:pin(resumeDir+'\\successor-precut-admission.json','592332cd1f45756d7994f90767384465c1fe8c42c81529ce21ff1d2d90718635'),
 intent:pin(resumeDir+'\\b264-old-owner-cut-intent.json','b5bd07f0b74a8c0c99091668333d7ac0b3494a4e94e3dbd744f1aa1061f47d25'),
});
export function validatePr54CurrentB007PrecutResumeBinding({raw,profileRef,beforeRef,profile,before}){
 need(exact(raw,['original','resume'])&&exact(raw.resume,Object.keys(PR54_CURRENT_B007_PRECUT_RESUME_REFS)));const old={};
 for(const [key,fixed]of Object.entries(PR54_CURRENT_B007_PRECUT_RESUME_REFS)){const row=raw.resume[key];need(exact(row,['ref','bytes'])&&same(row.ref,fixed)&&row.bytes instanceof Uint8Array&&row.bytes.byteLength>0&&row.bytes.byteLength<=16777216&&hash(row.bytes)===fixed.sha256);try{old[key]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(row.bytes));}catch{need(false);}}
 const retained=validatePr54CurrentB007PrecutContinuationBinding({raw:raw.original,profileRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile,beforeRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.before,profile:old.profile,before:old.before});
 need(same(old.context,retained));const claim=old.claim;
 need(claim.schemaVersion==='melisa-p03-current-b007-epoch-claim.v1'&&claim.transitionAuthority===true&&claim.applyExecuted===false&&claim.successorRunId===resumeFailedRun&&same(claim.successorProfile,PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile)&&same(claim.successorBefore,PR54_CURRENT_B007_PRECUT_RESUME_REFS.before)&&same(claim.newSettings,old.profile.newSettings));
 const lock=old.transitionLock;need(exact(lock,['profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir','continuationRef'])&&same(lock.profileRef,claim.successorProfile)&&same(lock.beforeRef,claim.successorBefore)&&same(lock.successorClaimRef,PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim)&&same(lock.continuationRef,PR54_CURRENT_B007_PRECUT_RESUME_REFS.context));
 let previous=PR54_CURRENT_B007_PRECUT_RESUME_REFS.before.sha256;
 for(const [i,event]of ['TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED'].entries()){const v=old[i===2?'failureTail':'event'+i];need(exact(v,['sequence','digest','event','stopOrderDigest',...(i?['target']:[]),'previousSha256','profileSha256','beforeSha256'])&&v.sequence===i&&v.event===event&&v.digest===old.before.plan.digest&&v.stopOrderDigest===claim.stopOrderDigest&&v.previousSha256===previous&&v.profileSha256===claim.successorProfile.sha256&&v.beforeSha256===claim.successorBefore.sha256&&(i===0||v.target===(i===1?'coreSupervisor':'HELD_CORE_CUT')));previous=PR54_CURRENT_B007_PRECUT_RESUME_REFS[i===2?'failureTail':'event'+i].sha256;}
 need(exact(old.diagnostic,['phase','reason','failureDiagnostic','profileSha256','beforeSha256'])&&old.diagnostic.phase==='HELD_CORE_CUT'&&old.diagnostic.reason==='P03_OWNER_TRANSITION_STOPPED'&&same(old.diagnostic.failureDiagnostic,{stage:'DRAIN',reason:'UNCLASSIFIED_IO_FAILURE'})&&old.diagnostic.profileSha256===claim.successorProfile.sha256&&old.diagnostic.beforeSha256===claim.successorBefore.sha256);
 const snapshot=old.snapshot,intent=old.intent;
 need(snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&snapshot.profileSha256===claim.successorProfile.sha256&&snapshot.beforeSha256===claim.successorBefore.sha256&&snapshot.oldIdentities.length===8&&snapshot.oldWatchers.length===2);
 need(exact(intent,['event','claimSha256','stopOrderDigest','profileSha256','beforeSha256','observedAt'])&&intent.event==='B264_OLD_CUT_INTENT'&&intent.claimSha256===PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim.sha256&&intent.stopOrderDigest===claim.stopOrderDigest&&intent.profileSha256===claim.successorProfile.sha256&&intent.beforeSha256===claim.successorBefore.sha256);
 validatePr54CurrentB007PrecutContinuationBinding({raw:raw.original,profileRef,beforeRef,profile,before});
 need(before.runId!==resumeFailedRun&&Date.parse(before.startedAt)>=Date.parse(old.before.observedAt)&&profile.businessDigest.path!==old.profile.businessDigest.path);
 // The original binding already requires identical business/OLD10/task/plan
 // fields and the same backup directory; only supplemental run/time refs vary.
 return Object.freeze({schemaVersion:'melisa-p03-current-b007-precut-resume.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.failureTail,retainedProfileRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.profile,retainedBeforeRef:PR54_CURRENT_B007_PRECUT_RESUME_REFS.before,profileRef:pin(profileRef.path,profileRef.sha256),beforeRef:pin(beforeRef.path,beforeRef.sha256),claimPath:PR54_CURRENT_B007_CONTINUATION_CLAIM_PATH});
}
export function preparePr54CurrentB007PrecutResume({raw,profileRef,beforeRef,profile,before,now=Date.now()}){
 const receipt=validatePr54CurrentB007PrecutResumeBinding({raw,profileRef,beforeRef,profile,before});need(Number.isFinite(now)&&now-Date.parse(before.observedAt)>=0&&now-Date.parse(before.observedAt)<900000);return receipt;
}

// Exact failed9d2 no-cut continuation in the same dispatcher. This is not a
// recursive retry policy: the452 claim and its consumed attempt stay immutable.
const retryFailedRun='9d2e00d572acc83391a0a2e5ac28d046',retryDir=root+'\\MelisaERP-P03-transition-'+retryFailedRun;
export const PR54_CURRENT_B007_PRECUT_RETRY_REFS=Object.freeze({
 profile:pin(root+'\\MelisaERP-P03-profile-'+retryFailedRun+'.json','ed2c3ad7a253f749bf284ccc6aabe34535a28e3f2f0b71484583387082674c12'),
 before:pin(root+'\\MelisaERP-P03-before-'+retryFailedRun+'.json','97252544d7ff98c0ed3d908bcf785f89cb2bb65dd3f6c79587653f433e740c04'),
 event0:pin(retryDir+'\\event-0000.json','3c25d1da4017da7576cc15dd4a7cb603718cc1a4674897a52048bc56dc703b1f'),
 event1:pin(retryDir+'\\event-0001.json','58741b0f6db3a7596d35d04089d178090412c6f722f9a59a9f09f54d51d519bc'),
 failureTail:pin(retryDir+'\\event-0002.json','74d1c6dcdd5597935a9a8f2b814aef4e8167880bbc2c9ebea469d07f8f85af26'),
 diagnostic:pin(retryDir+'\\io-failure-diagnostic.json','f65e6e001f7c936d4577b45d70de97565f603eef8900d18227315d2388148cea'),
 context:pin(retryDir+'\\precut-continuation.json','7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c'),
 transitionLock:pin(retryDir+'\\transition.lock','a125f57f3d97993ede102504faf379a373be67a1178d53770fb2f3f2916b4255'),
 snapshot:pin(retryDir+'\\successor-precut-admission.json','9207fb109e6b2cfe03b9791ed5f1b2e88b100c052094e86350819d83b1550584'),
 intent:pin(retryDir+'\\b264-old-owner-cut-intent.json','33535a3f165c03892bfb3a225d6ec2ae91b96f47fd2a949b9cf1afa7e2576ee9'),
 priorAttempt:pin(resumeDir+'\\resume-attempt.json','7f07000256ed4b1289f36fe5a2290bdfa71e125ff976276f1135b42f0ba4012c'),
});
export function validatePr54CurrentB007PrecutRetryBinding({raw,profileRef,beforeRef,profile,before}){
 need(exact(raw,['original','resume','retry'])&&exact(raw.retry,Object.keys(PR54_CURRENT_B007_PRECUT_RETRY_REFS)));const prior={};
 for(const [key,fixed]of Object.entries(PR54_CURRENT_B007_PRECUT_RETRY_REFS)){const row=raw.retry[key];need(exact(row,['ref','bytes'])&&same(row.ref,fixed)&&row.bytes instanceof Uint8Array&&row.bytes.byteLength>0&&row.bytes.byteLength<=16777216&&hash(row.bytes)===fixed.sha256);try{prior[key]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(row.bytes));}catch{need(false);}}
 const earlier={original:raw.original,resume:raw.resume};
 const oldReceipt=validatePr54CurrentB007PrecutResumeBinding({raw:earlier,profileRef:PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile,beforeRef:PR54_CURRENT_B007_PRECUT_RETRY_REFS.before,profile:prior.profile,before:prior.before});
 need(same(prior.context,oldReceipt)&&same(prior.priorAttempt,oldReceipt));
 const receipt=validatePr54CurrentB007PrecutResumeBinding({raw:earlier,profileRef,beforeRef,profile,before});
 need(before.runId!==retryFailedRun&&Date.parse(before.startedAt)>=Date.parse(prior.before.observedAt)&&profile.businessDigest.path!==prior.profile.businessDigest.path);
 const claim=JSON.parse(new TextDecoder().decode(raw.resume.claim.bytes));
 const lock=prior.transitionLock;
 need(exact(lock,['profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir','continuationRef'])&&same(lock.profileRef,PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile)&&same(lock.beforeRef,PR54_CURRENT_B007_PRECUT_RETRY_REFS.before)&&same(lock.successorClaimRef,PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim)&&same(lock.continuationRef,PR54_CURRENT_B007_PRECUT_RETRY_REFS.context));
 let previous=PR54_CURRENT_B007_PRECUT_RETRY_REFS.before.sha256;
 for(const [i,event]of ['TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED'].entries()){const v=prior[i===2?'failureTail':'event'+i];need(exact(v,['sequence','digest','event','stopOrderDigest',...(i?['target']:[]),'previousSha256','profileSha256','beforeSha256'])&&v.sequence===i&&v.event===event&&v.digest===prior.before.plan.digest&&v.stopOrderDigest===claim.stopOrderDigest&&v.previousSha256===previous&&v.profileSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.sha256&&v.beforeSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.before.sha256&&(i===0||v.target===(i===1?'coreSupervisor':'HELD_CORE_CUT')));previous=PR54_CURRENT_B007_PRECUT_RETRY_REFS[i===2?'failureTail':'event'+i].sha256;}
 need(exact(prior.diagnostic,['phase','reason','failureDiagnostic','profileSha256','beforeSha256'])&&prior.diagnostic.phase==='HELD_CORE_CUT'&&prior.diagnostic.reason==='P03_OWNER_TRANSITION_STOPPED'&&same(prior.diagnostic.failureDiagnostic,{stage:'DRAIN',reason:'P03_PHYSICAL_B264_CUT_OWNER_DIGEST'})&&prior.diagnostic.profileSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.sha256&&prior.diagnostic.beforeSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.before.sha256);
 need(prior.snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&prior.snapshot.profileSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.sha256&&prior.snapshot.beforeSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.before.sha256&&prior.snapshot.oldIdentities.length===8&&prior.snapshot.oldWatchers.length===2);
 need(exact(prior.intent,['event','claimSha256','stopOrderDigest','profileSha256','beforeSha256','observedAt'])&&prior.intent.event==='B264_OLD_CUT_INTENT'&&prior.intent.claimSha256===PR54_CURRENT_B007_PRECUT_RESUME_REFS.claim.sha256&&prior.intent.stopOrderDigest===claim.stopOrderDigest&&prior.intent.profileSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.profile.sha256&&prior.intent.beforeSha256===PR54_CURRENT_B007_PRECUT_RETRY_REFS.before.sha256);
 return Object.freeze({...receipt,schemaVersion:'melisa-p03-current-b007-precut-retry.v1',failureTailRef:PR54_CURRENT_B007_PRECUT_RETRY_REFS.failureTail});
}
export function preparePr54CurrentB007PrecutRetry(input){const receipt=validatePr54CurrentB007PrecutRetryBinding(input),now=input.now??Date.now();need(Number.isFinite(now)&&now-Date.parse(input.before.observedAt)>=0&&now-Date.parse(input.before.observedAt)<900000);return receipt;}

// Exact974d failed Inspect, before any native cut witness. This pure binding
// does not prove directory/journal absence or authorize a native continuation.
const failed974d='974d73c7d84b9ea43e1397b0fdf44c01',dir974d=root+'\\MelisaERP-P03-transition-'+failed974d;
export const PR54_CURRENT_B007_PRECUT974D_REFS=Object.freeze({
 claim:pin(root+'\\p03-pr54-current-b007-generation-1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381.lock.json','fb736269cb81c53a164f35f2c348dff7c32ec574b46a1b7b00666f9d9f0a5332'),
 profile:pin(root+'\\MelisaERP-P03-profile-'+failed974d+'.json','68dcb12d3ed557f1ffe48bf99961b24daaa62cf387d1265ac0ad28e608690f3a'),
 before:pin(root+'\\MelisaERP-P03-before-'+failed974d+'.json','ff97a87aa6caf59ae934d07b055bc4d7f8470677a70f30e0b5a12b3a36e5349f'),
 transitionLock:pin(dir974d+'\\transition.lock','657702fcb5b1a9255ec65fe6fe012f584c797e87f881f68223394215f24c575c'),
 event0:pin(dir974d+'\\event-0000.json','ae88c07259811eb76dcaefc52655f3605af89e99be5e87203d5cb8b0bc67d67c'),
 event1:pin(dir974d+'\\event-0001.json','7452b31c398f56bfea1dbbadf7df1ff295c5bd7673ed04ea4de60c65eb593832'),
 failureTail:pin(dir974d+'\\event-0002.json','327528179fdbed252553f06c7b8e3ba812cfd3c0a4d96419298ba94163c09706'),
 diagnostic:pin(dir974d+'\\io-failure-diagnostic.json','a571e5dfdb1e0f00c9102733c0a054827d1230f343351805ed515389f93e8aa8'),
});
export const PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH=root+'\\p03-pr54-current-b007-continuation-of-'+failed974d+'.lock.json';
export function validatePr54CurrentB007Precut974dContinuationBinding({raw,profileRef,beforeRef,profile,before}){
 need(exact(raw,Object.keys(PR54_CURRENT_B007_PRECUT974D_REFS)));const old={};
 for(const [key,fixed]of Object.entries(PR54_CURRENT_B007_PRECUT974D_REFS)){
  const descriptor=Object.getOwnPropertyDescriptor(raw,key);need(descriptor&&Object.hasOwn(descriptor,'value'));const row=descriptor.value;
  need(exact(row,['ref','bytes']));const rd=Object.getOwnPropertyDescriptors(row);need(Object.values(rd).every(d=>Object.hasOwn(d,'value')));
  data(row.ref);need(ref(row.ref)&&same(row.ref,fixed)&&row.bytes instanceof Uint8Array&&row.bytes.byteLength>0&&row.bytes.byteLength<=16777216&&hash(row.bytes)===fixed.sha256);
  try{old[key]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(row.bytes));}catch{reject();}
 }
 const claim=old.claim,prior=old.before,priorProfile=old.profile,lock=old.transitionLock;
 need(claim.schemaVersion==='melisa-p03-current-b007-epoch-claim.v1'&&claim.successorRunId===failed974d&&claim.transitionAuthority===true&&claim.applyExecuted===false&&claim.currentOwnerDigest==='1e076283424add7936fd9979b64edb524e18d12c073be76c2a91545464b7e381'&&same(claim.successorProfile,PR54_CURRENT_B007_PRECUT974D_REFS.profile)&&same(claim.successorBefore,PR54_CURRENT_B007_PRECUT974D_REFS.before)&&same(claim.newSettings,priorProfile.newSettings));
 need(exact(lock,['profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir'])&&same(lock.profileRef,claim.successorProfile)&&same(lock.beforeRef,claim.successorBefore)&&same(lock.successorClaimRef,PR54_CURRENT_B007_PRECUT974D_REFS.claim)&&same(lock.currentPreCapture.snapshotRef,priorProfile.businessDigest));
 let previous=PR54_CURRENT_B007_PRECUT974D_REFS.before.sha256;
 for(const [i,event]of ['TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED'].entries()){
  const v=old[i===2?'failureTail':'event'+i];need(exact(v,['sequence','digest','event','stopOrderDigest',...(i?['target']:[]),'previousSha256','profileSha256','beforeSha256'])&&v.sequence===i&&v.event===event&&v.digest===prior.plan.digest&&v.stopOrderDigest===claim.stopOrderDigest&&v.previousSha256===previous&&v.profileSha256===PR54_CURRENT_B007_PRECUT974D_REFS.profile.sha256&&v.beforeSha256===PR54_CURRENT_B007_PRECUT974D_REFS.before.sha256&&(i===0||v.target===(i===1?'coreSupervisor':'HELD_CORE_CUT')));previous=PR54_CURRENT_B007_PRECUT974D_REFS[i===2?'failureTail':'event'+i].sha256;
 }
 need(exact(old.diagnostic,['phase','reason','failureDiagnostic','profileSha256','beforeSha256'])&&old.diagnostic.phase==='HELD_CORE_CUT'&&old.diagnostic.reason==='P03_OWNER_TRANSITION_STOPPED'&&exact(old.diagnostic.failureDiagnostic,['stage','reason'])&&old.diagnostic.failureDiagnostic.stage==='INSPECT'&&old.diagnostic.failureDiagnostic.reason==='UNCLASSIFIED_IO_FAILURE'&&old.diagnostic.profileSha256===claim.successorProfile.sha256&&old.diagnostic.beforeSha256===claim.successorBefore.sha256);
 data(profile);data(before);data(profileRef);data(beforeRef);need(record(profile)&&record(before)&&ref(profileRef)&&ref(beforeRef));
 need(typeof before.runId==='string'&&/^[a-f0-9]{32}$/.test(before.runId)&&before.runId!==failed974d&&profileRef.path===root+'\\MelisaERP-P03-profile-'+before.runId+'.json'&&beforeRef.path===root+'\\MelisaERP-P03-before-'+before.runId+'.json'&&hash(encoded(profile))===profileRef.sha256&&hash(encoded(before))===beforeRef.sha256&&same(profile.beforeImage,beforeRef));
 need(time(before.startedAt)&&time(before.observedAt)&&Date.parse(before.startedAt)<=Date.parse(before.observedAt)&&Date.parse(before.startedAt)>=Date.parse(prior.observedAt));
 need(same(omit(before,['runId','startedAt','observedAt']),omit(prior,['runId','startedAt','observedAt'])));
 need(ref(profile.businessDigest)&&/^C:\\Sirket\\ERP\\backups\\P03-20261021-\d{6}\\source-pre-snapshot-[a-f0-9]{32}\.json$/.test(profile.businessDigest.path)&&profile.businessDigest.path!==priorProfile.businessDigest.path&&profile.businessDigest.path.slice(0,profile.businessDigest.path.lastIndexOf('\\'))===priorProfile.businessDigest.path.slice(0,priorProfile.businessDigest.path.lastIndexOf('\\')));
 need(profile.journalDirectory===root+'\\MelisaERP-P03-recovery-'+before.runId&&ref(profile.stopper)&&profile.stopper.path===root+'\\MelisaERP-P03-stopper-'+before.runId+'.ps1'&&profile.stopper.sha256===priorProfile.stopper.sha256);
 need(same(omit(profile,['beforeImage','businessDigest','journalDirectory','stopper']),omit(priorProfile,['beforeImage','businessDigest','journalDirectory','stopper'])));
 return Object.freeze({schemaVersion:'melisa-p03-current-b007-precut974d-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUT974D_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUT974D_REFS.failureTail,profileRef:pin(profileRef.path,profileRef.sha256),beforeRef:pin(beforeRef.path,beforeRef.sha256),claimPath:PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH,correctedSourceCommit:'82e741af59cb59f27a4008ded83ca889238fb5c7'});
}
export function preparePr54CurrentB007Precut974dContinuation(input){const receipt=validatePr54CurrentB007Precut974dContinuationBinding(input),now=input.now??Date.now();need(Number.isFinite(now)&&now-Date.parse(input.before.observedAt)>=0&&now-Date.parse(input.before.observedAt)<900000);return receipt;}

// Exactb142 failed native DRAIN freshness gate; no journal or filesystem proof
// is granted here. The original974d lineage remains independently immutable.
const failedB142='b14266ad30507bb10d78ae76e2546221',dirB142=root+'\\MelisaERP-P03-transition-'+failedB142;
export const PR54_CURRENT_B007_PRECUTB142_REFS=Object.freeze({
 claim:pin(PR54_CURRENT_B007_PRECUT974D_CLAIM_PATH,'442f7d953c6e75512c36a259611d6d3f2275e9073d030991e1f87c177cd461a5'),
 profile:pin(root+'\\MelisaERP-P03-profile-'+failedB142+'.json','8e34643bd8fb360e8ad7e94fcf5bca1e3b9b438a4d19ca1dce01d21b375d8bb2'),
 before:pin(root+'\\MelisaERP-P03-before-'+failedB142+'.json','360b5f6551fda107d2f556f1230cdc2812dcc44b0818bf5b8c35d5b453e7f9d1'),
 transitionLock:pin(dirB142+'\\transition.lock','de02d0c1d1caa26f95c6c22497aa738a2b2905e9e15c1d6dcd6f71d199d57f6b'),
 event0:pin(dirB142+'\\event-0000.json','457c86fe6db487b490f1d8db50bf69d90a5090c498f8c00cea121aad1660bef9'),
 event1:pin(dirB142+'\\event-0001.json','dfe8cf9b4be4189ce17aa3482fdcb6d3fa20ba05cf678074f0c2d750ffd43b56'),
 failureTail:pin(dirB142+'\\event-0002.json','abfbe25fb456df145857d10e96f366d3aacfd91b0cfe14440b0ab51b1c04d77c'),
 diagnostic:pin(dirB142+'\\io-failure-diagnostic.json','588065c6d36a65563869698586765ee838cb739a70c263ebde454fa9a761a72a'),
 context:pin(dirB142+'\\precut-continuation.json','cc3adf31b7e0bf9fda138093c2fd2c6c892cae09884e443bd1a06cee52605e3a'),
 snapshot:pin(dirB142+'\\successor-precut-admission.json','25bbcfd0dcb027c7acbd7e78437e55e1bf47bc46c37904474d03e3010665bf32'),
 intent:pin(dirB142+'\\b264-old-owner-cut-intent.json','81051359805fa84cc44ddad4586161e084055572d08b1d2df214ade7dc6e9e0a'),
});
export const PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH=root+'\\p03-pr54-current-b007-continuation-of-'+failedB142+'.lock.json';
export function validatePr54CurrentB007PrecutB142ContinuationBinding({raw,profileRef,beforeRef,profile,before}){
 need(exact(raw,['original','failed'])&&Object.values(Object.getOwnPropertyDescriptors(raw)).every(d=>Object.hasOwn(d,'value'))&&exact(raw.failed,Object.keys(PR54_CURRENT_B007_PRECUTB142_REFS)));const old={};
 for(const [key,fixed]of Object.entries(PR54_CURRENT_B007_PRECUTB142_REFS)){
  const d=Object.getOwnPropertyDescriptor(raw.failed,key);need(d&&Object.hasOwn(d,'value'));const row=d.value;need(exact(row,['ref','bytes'])&&Object.values(Object.getOwnPropertyDescriptors(row)).every(d=>Object.hasOwn(d,'value')));data(row.ref);
  need(ref(row.ref)&&same(row.ref,fixed)&&row.bytes instanceof Uint8Array&&row.bytes.byteLength>0&&row.bytes.byteLength<=16777216&&hash(row.bytes)===fixed.sha256);try{old[key]=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(row.bytes));}catch{reject();}
 }
 const retainedContext=validatePr54CurrentB007Precut974dContinuationBinding({raw:raw.original,profileRef:PR54_CURRENT_B007_PRECUTB142_REFS.profile,beforeRef:PR54_CURRENT_B007_PRECUTB142_REFS.before,profile:old.profile,before:old.before});need(same(old.context,retainedContext));
 const claim=old.claim,prior=old.before,priorProfile=old.profile,lock=old.transitionLock,originalClaim=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw.original.claim.bytes));
 need(claim.schemaVersion==='melisa-p03-current-b007-epoch-claim.v1'&&claim.successorRunId===failedB142&&claim.transitionAuthority===true&&claim.applyExecuted===false&&same(claim.successorProfile,PR54_CURRENT_B007_PRECUTB142_REFS.profile)&&same(claim.successorBefore,PR54_CURRENT_B007_PRECUTB142_REFS.before)&&same(omit(claim,['ownerObservedAt','successorRunId','successorProfile','successorBefore']),omit(originalClaim,['ownerObservedAt','successorRunId','successorProfile','successorBefore'])));
 need(exact(lock,['profileRef','beforeRef','currentPreCapture','rehearsalProofRef','successorClaimRef','sourceControlDir','continuationRef'])&&same(lock.profileRef,claim.successorProfile)&&same(lock.beforeRef,claim.successorBefore)&&same(lock.successorClaimRef,PR54_CURRENT_B007_PRECUTB142_REFS.claim)&&same(lock.continuationRef,PR54_CURRENT_B007_PRECUTB142_REFS.context)&&same(lock.currentPreCapture.snapshotRef,priorProfile.businessDigest));
 let previous=PR54_CURRENT_B007_PRECUTB142_REFS.before.sha256;
 for(const [i,event]of ['TASK_STOP_INTENT','EXACT_STOP_INTENT','FAILED'].entries()){const v=old[i===2?'failureTail':'event'+i];need(exact(v,['sequence','digest','event','stopOrderDigest',...(i?['target']:[]),'previousSha256','profileSha256','beforeSha256'])&&v.sequence===i&&v.event===event&&v.digest===prior.plan.digest&&v.stopOrderDigest===claim.stopOrderDigest&&v.previousSha256===previous&&v.profileSha256===PR54_CURRENT_B007_PRECUTB142_REFS.profile.sha256&&v.beforeSha256===PR54_CURRENT_B007_PRECUTB142_REFS.before.sha256&&(i===0||v.target===(i===1?'coreSupervisor':'HELD_CORE_CUT')));previous=PR54_CURRENT_B007_PRECUTB142_REFS[i===2?'failureTail':'event'+i].sha256;}
 need(exact(old.diagnostic,['phase','reason','failureDiagnostic','profileSha256','beforeSha256'])&&old.diagnostic.phase==='HELD_CORE_CUT'&&old.diagnostic.reason==='P03_OWNER_TRANSITION_STOPPED'&&exact(old.diagnostic.failureDiagnostic,['stage','reason'])&&old.diagnostic.failureDiagnostic.stage==='DRAIN'&&old.diagnostic.failureDiagnostic.reason==='P03_PHYSICAL_B264_CUT_OWNER_FRESH'&&old.diagnostic.profileSha256===claim.successorProfile.sha256&&old.diagnostic.beforeSha256===claim.successorBefore.sha256);
 const snapshot=old.snapshot,intent=old.intent;need(exact(snapshot,['schemaVersion','profileSha256','beforeSha256','engineSha256','recoveryHelperSha256','observedAt','oldIdentities','oldWatchers','consolePins','probePins','protectedConsolePins'])&&snapshot.schemaVersion==='melisa-p03-successor-precut-admission.v1'&&snapshot.profileSha256===claim.successorProfile.sha256&&snapshot.beforeSha256===claim.successorBefore.sha256&&snapshot.engineSha256==='b33d82ca1866fb859be3be1fa005d65f64d337402d6f98c2bf574fd73aef427f'&&snapshot.recoveryHelperSha256==='e8ec0a37d8dc0c620beedcdd8ed2bc175817599b18070a93ce6881ff7c287fc5'&&Array.isArray(snapshot.oldIdentities)&&snapshot.oldIdentities.length===8&&Object.values(prior.identities).every(p=>snapshot.oldIdentities.filter(q=>same(q,p)).length===1)&&same(snapshot.oldWatchers,priorProfile.oldWatchers)&&['consolePins','probePins','protectedConsolePins'].every(k=>Array.isArray(snapshot[k]))&&time(snapshot.observedAt));
 need(exact(intent,['event','claimSha256','stopOrderDigest','profileSha256','beforeSha256','observedAt'])&&intent.event==='B264_OLD_CUT_INTENT'&&intent.claimSha256===PR54_CURRENT_B007_PRECUTB142_REFS.claim.sha256&&intent.stopOrderDigest===claim.stopOrderDigest&&intent.profileSha256===claim.successorProfile.sha256&&intent.beforeSha256===claim.successorBefore.sha256&&time(intent.observedAt)&&Date.parse(intent.observedAt)>=Date.parse(snapshot.observedAt));
 validatePr54CurrentB007Precut974dContinuationBinding({raw:raw.original,profileRef,beforeRef,profile,before});
 need(before.runId!==failedB142&&Date.parse(before.startedAt)>=Date.parse(prior.observedAt)&&same(omit(before,['runId','startedAt','observedAt']),omit(prior,['runId','startedAt','observedAt']))&&profile.businessDigest.path!==priorProfile.businessDigest.path&&same(omit(profile,['beforeImage','businessDigest','journalDirectory','stopper']),omit(priorProfile,['beforeImage','businessDigest','journalDirectory','stopper'])));
 return Object.freeze({schemaVersion:'melisa-p03-current-b007-precutb142-continuation.v1',retainedClaimRef:PR54_CURRENT_B007_PRECUTB142_REFS.claim,failureTailRef:PR54_CURRENT_B007_PRECUTB142_REFS.failureTail,profileRef:pin(profileRef.path,profileRef.sha256),beforeRef:pin(beforeRef.path,beforeRef.sha256),claimPath:PR54_CURRENT_B007_PRECUTB142_CLAIM_PATH,correctedSourceCommit:'82e741af59cb59f27a4008ded83ca889238fb5c7'});
}
export function preparePr54CurrentB007PrecutB142Continuation(input){const receipt=validatePr54CurrentB007PrecutB142ContinuationBinding(input),now=input.now??Date.now();need(Number.isFinite(now)&&now-Date.parse(input.before.observedAt)>=0&&now-Date.parse(input.before.observedAt)<900000);return receipt;}
