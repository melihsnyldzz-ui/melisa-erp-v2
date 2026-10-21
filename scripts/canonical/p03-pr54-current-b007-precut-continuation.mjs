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
