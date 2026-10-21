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
