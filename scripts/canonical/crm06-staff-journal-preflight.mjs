// Metadata-only installation preflight. This never reads journal/credential
// bytes, creates files, issues a login or grants application authority.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export const CRM06_STAFF_JOURNAL_ROOT='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';
export const CRM06_STAFF_JOURNAL_PATH=CRM06_STAFF_JOURNAL_ROOT+'\\assigned-staff-refresh.json';
export const CRM06_STAFF_JOURNAL_EXCLUDED_PATHS=Object.freeze([
 'C:\\Sirket\\CRM\\runtime\\ERP-COMPLETION01-20261011\\normal-agent-test-baseline.env',
 'C:\\Sirket\\CRM\\runtime\\ERP-COMPLETION01-20261011\\protected-normal-sessions\\refresh-journal.json',
 'C:\\Sirket\\CRM\\runtime\\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013\\customer-product-requests.json',
 'C:\\Sirket\\CRM\\runtime\\CUSTOMER-PRODUCT-REQUEST-SHARED-20261013\\request-issuer-refresh.json',
 ...['manager-first-login.dpapi','staff-first-login.dpapi','agent-test-baseline.env','provisioning-audit.json','credential-index.json','staff-refresh-successor-b2985d2295c0.json'].map(leaf=>CRM06_STAFF_JOURNAL_ROOT+'\\'+leaf),
].sort());
const originalSource='b2985d2295c022848c769ea5f494012c1eb3fa00',frontendSource='da82fc6644c1d9dba0c10eaa861773534d43c288',layoutSource='5ce452b01ef20fc84a09c52b78311db8eb1dd1d8',finalBatchSource='5bcd5ad136ff7ca35d623d436b8724cc491641be',readySource='bb8966c59a6cfbdc1cc83472cb331e48b720a173',separateBatchSource='957f98773695874ea3d101b7eb4816f9ea080880';
const frontendExcludedPaths=Object.freeze([...CRM06_STAFF_JOURNAL_EXCLUDED_PATHS,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-da82fc6644c1.json'].sort());
const parentProbeExcludedPaths=Object.freeze([...frontendExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-da82fc6644c1-parent-probe.json'].sort());
const layoutExcludedPaths=Object.freeze([...parentProbeExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-5ce452b01ef2.json'].sort());
const finalBatchExcludedPaths=Object.freeze([...layoutExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-5bcd5ad136ff.json'].sort());
const receiptWaitExcludedPaths=Object.freeze([...finalBatchExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-5bcd5ad136ff-receipt-wait.json'].sort());
const readyExcludedPaths=Object.freeze([...receiptWaitExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-bb8966c59a6c.json'].sort());
const separateBatchExcludedPaths=Object.freeze([...readyExcludedPaths,CRM06_STAFF_JOURNAL_ROOT+'\\staff-refresh-successor-957f98773695.json'].sort());
export function crm06StaffJournalExcludedPaths(source=originalSource,profileVariant){check(source===originalSource||source===frontendSource||source===layoutSource||source===finalBatchSource||source===readySource||source===separateBatchSource);check(profileVariant===undefined||source===frontendSource&&profileVariant==='parent-probe'||source===finalBatchSource&&profileVariant==='receipt-wait');return source===separateBatchSource?separateBatchExcludedPaths:source===readySource?readyExcludedPaths:profileVariant==='receipt-wait'?receiptWaitExcludedPaths:source===finalBatchSource?finalBatchExcludedPaths:source===layoutSource?layoutExcludedPaths:profileVariant==='parent-probe'?parentProbeExcludedPaths:source===frontendSource?frontendExcludedPaths:CRM06_STAFF_JOURNAL_EXCLUDED_PATHS;}
const phases=Object.freeze(['OWNER','PARAMETERS','NATIVE_INIT','ANCESTORS','PARENT_ACL','TARGET','REFERENCES','RECHECK','RESULT']);
export function crm06StaffJournalPhysicalDiagnosticPhase(value){
 if(typeof value!=='string')return null;
 const match=/^CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:([A-Z_]+)(?:\r?\n)?$/.exec(value);
 return match&&phases.includes(match[1])?match[1]:null;
}
const fail=phase=>{throw Object.assign(Error('CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED',...(phases.includes(phase)?{phase}:{})});};
const check=ok=>{if(!ok)fail();};
const own=(value,keys)=>{check(value&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).length===keys.length&&keys.every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&Object.hasOwn(d,'value');}));};
export function normalizeCrm06StaffJournalPath(value){
 check(typeof value==='string'&&/^C:\\Sirket\\CRM\\runtime\\/.test(value)&&value===path.win32.normalize(value)&&!/[\x00-\x1f\x7f"'`$%<>|?*\/]/.test(value)&&!value.slice(2).includes(':'));
 check(value.split('\\').every(segment=>segment&&segment!=='.'&&segment!=='..'&&!/[. ]$/.test(segment)));
 return value;
}
function options(value){
 own(value,['path','ownerSid','excludedPaths',...(Object.hasOwn(value,'source')?['source']:[]),...(Object.hasOwn(value,'profileVariant')?['profileVariant']:[])]);check(value.path===CRM06_STAFF_JOURNAL_PATH);normalizeCrm06StaffJournalPath(value.path);
 const source=Object.hasOwn(value,'source')?value.source:originalSource;check(typeof source==='string');if(Object.hasOwn(value,'profileVariant'))check(['parent-probe','receipt-wait'].includes(value.profileVariant));const policy=crm06StaffJournalExcludedPaths(source,value.profileVariant);
 check(typeof value.ownerSid==='string'&&/^S-1-5-21-(?:[1-9]\d*-){3}[1-9]\d*$/.test(value.ownerSid));
 check(Array.isArray(value.excludedPaths)&&value.excludedPaths.length===policy.length);
 const refs=value.excludedPaths.map(normalizeCrm06StaffJournalPath).sort();check(refs.every((ref,index)=>ref===policy[index]));return {path:value.path,ownerSid:value.ownerSid,excludedPaths:refs,source,...(Object.hasOwn(value,'profileVariant')?{profileVariant:value.profileVariant}:{})};
}
const referenceKeys=['path','exists','volumeSerial','fileId','linkCount','reparse'];
export function crm06StaffJournalReferenceHash(references){
 check(Array.isArray(references));const encoded=references.map(ref=>{own(ref,referenceKeys);return [ref.path.toLowerCase(),ref.exists?'1':'0',ref.volumeSerial??'',ref.fileId??'',ref.linkCount??''].join('\n')+'\n';}).join('');
 return createHash('sha256').update(encoded,'utf8').digest('hex');
}
const identity=record=>record.volumeSerial+':'+record.fileId;
function file(record,expectedPath,{directory,ownerSid,protectedParent=false}){
 own(record,['path','ownerSid','daclProtected','foreignWritable','foreignAllowed','volumeSerial','fileId','linkCount','reparse','directory']);
 check(record.path===expectedPath&&[ownerSid,'S-1-5-18'].includes(record.ownerSid)&&typeof record.daclProtected==='boolean'&&(!protectedParent||record.daclProtected)&&record.foreignWritable===false&&record.foreignAllowed===false&&record.reparse===false&&record.directory===directory&&record.linkCount===1&&/^[A-F0-9]{8}$/.test(record.volumeSerial)&&/^[A-F0-9]{16}$/.test(record.fileId)&&record.fileId!=='0000000000000000');
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function assertCrm06StaffJournalPhysicalEvidence(evidence,input){
 const expected=options(input);own(evidence,['schemaVersion','status','path','actorRoot','callerSid','ancestorReparse','parent','journal','references','referenceSha256']);
 check(evidence.schemaVersion==='crm06-staff-journal-physical.v1'&&['READY','PREPARE_REQUIRED'].includes(evidence.status)&&evidence.path===expected.path&&evidence.actorRoot===CRM06_STAFF_JOURNAL_ROOT&&evidence.callerSid===expected.ownerSid&&evidence.ancestorReparse===false);
 const parentPath=evidence.parent?.path;check([CRM06_STAFF_JOURNAL_ROOT,'C:\\Sirket\\CRM\\runtime'].includes(parentPath));file(evidence.parent,parentPath,{directory:true,ownerSid:expected.ownerSid,protectedParent:true});
 check(Array.isArray(evidence.references)&&evidence.references.length===expected.excludedPaths.length);
 for(const [index,ref]of evidence.references.entries()){
  own(ref,referenceKeys);check(ref.path===expected.excludedPaths[index]&&typeof ref.exists==='boolean'&&ref.reparse===false);
  if(ref.exists)check(/^[A-F0-9]{8}$/.test(ref.volumeSerial)&&/^[A-F0-9]{16}$/.test(ref.fileId)&&ref.fileId!=='0000000000000000'&&ref.linkCount===1);
  else check(ref.volumeSerial===null&&ref.fileId===null&&ref.linkCount===null);
 }
 check(typeof evidence.referenceSha256==='string'&&/^[a-f0-9]{64}$/.test(evidence.referenceSha256)&&evidence.referenceSha256===crm06StaffJournalReferenceHash(evidence.references));
 if(evidence.status==='READY'){
  check(parentPath===CRM06_STAFF_JOURNAL_ROOT);file(evidence.journal,expected.path,{directory:false,ownerSid:expected.ownerSid});
  check(identity(evidence.journal)!==identity(evidence.parent)&&evidence.references.every(ref=>!ref.exists||identity(ref)!==identity(evidence.journal)));
 }else check(evidence.journal===null);
 // Pure evidence validation is not an OS check or an application capability.
 return freeze(JSON.parse(JSON.stringify(evidence)));
}
export function crm06StaffJournalPhysicalArguments(input){
 own(input,['ownerSid','excludedPaths',...(Object.hasOwn(input,'source')?['source']:[]),...(Object.hasOwn(input,'profileVariant')?['profileVariant']:[])]);const reviewed=options({path:CRM06_STAFF_JOURNAL_PATH,...input});
 // The child has the same independent finite reference list. Do not transport
 // nested JSON through the legacy Windows PowerShell argv parser.
 return Object.freeze(['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(import.meta.dirname,'crm06-staff-journal-preflight.ps1'),'-OwnerSid',reviewed.ownerSid,...(reviewed.source===frontendSource||reviewed.source===layoutSource||reviewed.source===finalBatchSource||reviewed.source===readySource||reviewed.source===separateBatchSource?['-Source',reviewed.source]:[]),...(reviewed.profileVariant?['-ProfileVariant',reviewed.profileVariant]:[])]);
}
export async function inspectCrm06StaffJournalPhysical(input){
 own(input,['ownerSid','excludedPaths',...(Object.hasOwn(input,'source')?['source']:[]),...(Object.hasOwn(input,'profileVariant')?['profileVariant']:[])]);const reviewed=options({path:CRM06_STAFF_JOURNAL_PATH,...input});check(process.platform==='win32');
 try{
  const response=await promisify(execFile)('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',crm06StaffJournalPhysicalArguments(input),{windowsHide:true,timeout:20000,maxBuffer:32768,env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});
  check(!response.stderr);return assertCrm06StaffJournalPhysicalEvidence(JSON.parse(response.stdout),reviewed);
 }catch(error){fail(crm06StaffJournalPhysicalDiagnosticPhase(error?.stderr));}
}
