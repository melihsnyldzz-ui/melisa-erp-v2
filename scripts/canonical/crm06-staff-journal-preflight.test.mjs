import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertCrm06StaffJournalPhysicalEvidence,normalizeCrm06StaffJournalPath,crm06StaffJournalReferenceHash,inspectCrm06StaffJournalPhysical,crm06StaffJournalPhysicalDiagnosticPhase,crm06StaffJournalPhysicalArguments,crm06StaffJournalExcludedPaths,CRM06_STAFF_JOURNAL_ROOT as root,CRM06_STAFF_JOURNAL_PATH as target,CRM06_STAFF_JOURNAL_EXCLUDED_PATHS as paths} from './crm06-staff-journal-preflight.mjs';
const sid='S-1-5-21-2170750028-1005938530-2568122015-1001';
const options=()=>({path:target,ownerSid:sid,excludedPaths:[...paths]});
function fixture(){
 const meta=(path,directory,fileId)=>({path,ownerSid:sid,daclProtected:true,foreignWritable:false,foreignAllowed:false,volumeSerial:'1234ABCD',fileId,linkCount:1,reparse:false,directory});
 const references=paths.map((path,index)=>({path,exists:index%2===0,volumeSerial:index%2===0?'1234ABCD':null,fileId:index%2===0?(index+10).toString(16).padStart(16,'0').toUpperCase():null,linkCount:index%2===0?1:null,reparse:false}));
 return {schemaVersion:'crm06-staff-journal-physical.v1',status:'READY',path:target,actorRoot:root,callerSid:sid,ancestorReparse:false,parent:meta(root,true,'0000000000000001'),journal:meta(target,false,'0000000000000002'),references,referenceSha256:crm06StaffJournalReferenceHash(references)};
}
const reject=(evidence,opts=options())=>assert.throws(()=>assertCrm06StaffJournalPhysicalEvidence(evidence,opts),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
const rehash=evidence=>{evidence.referenceSha256=crm06StaffJournalReferenceHash(evidence.references);return evidence;};

test('synthetic READY validates one protected owner-bound file, all ten distinct references and metadata-only digest',()=>{
 const f=fixture(),before=structuredClone(f),result=assertCrm06StaffJournalPhysicalEvidence(f,options());assert.deepEqual(result,f);assert.deepEqual(f,before);assert.equal(result.references.length,10);assert(Object.isFrozen(result)&&Object.isFrozen(result.parent)&&Object.isFrozen(result.references[0]));
 const serialized=JSON.stringify(result);assert(!/token|password|grants|fileContent/i.test(serialized));assert.equal(result.referenceSha256.length,64);
});
test('absent target is PREPARE_REQUIRED only, with verified protected actual parent and explicit absent-reference metadata',()=>{
 const f=fixture();f.status='PREPARE_REQUIRED';f.journal=null;assert.equal(assertCrm06StaffJournalPhysicalEvidence(f,options()).status,'PREPARE_REQUIRED');
 f.parent.path='C:\\Sirket\\CRM\\runtime';assert.equal(assertCrm06StaffJournalPhysicalEvidence(f,options()).parent.path,f.parent.path);
 f.status='READY';reject(f);f.status='PREPARE_REQUIRED';f.parent.daclProtected=false;reject(f);
});
test('target and reference paths reject ADS, UNC/device aliases, normalization changes, trailing dots/spaces and foreign leaves',()=>{
 for(const value of [target+':stream',target+'::$DATA',target+'.',target+' ',target.replace('CRM06-TEST-ACTORS-20261014','CRM06-TEST-ACTORS-20261014.'),target.replace('\\assigned','\\x\\..\\assigned'),target.replaceAll('\\','/'),'\\\\?\\'+target,target.replace('C:','D:'),target.toLowerCase()])assert.throws(()=>normalizeCrm06StaffJournalPath(value),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 for(const change of [opts=>opts.path=target+'-other',opts=>opts.excludedPaths.pop(),opts=>opts.excludedPaths[0]=target,opts=>opts.excludedPaths[0]=opts.excludedPaths[1],opts=>opts.excludedPaths[0]=root+'\\unknown.json',opts=>opts.ownerSid='S-1-5-18']){const opts=options();change(opts);reject(fixture(),opts);}
 assert.equal(normalizeCrm06StaffJournalPath(target),target);
});
test('ancestor or target reparse, hard links, forged/missing identity and aliases to any existing reference reject even under recomputed hashes',()=>{
 for(const change of [f=>f.ancestorReparse=true,f=>f.journal.reparse=true,f=>f.parent.reparse=true,f=>f.journal.linkCount=2,f=>f.references[0].linkCount=2,f=>f.references[0].reparse=true,f=>f.journal.fileId='0000000000000000',f=>f.journal.volumeSerial='bad',f=>f.journal.fileId=f.parent.fileId,f=>{f.journal.fileId=f.references[0].fileId;},f=>f.references[1].fileId='0000000000000009']){const f=fixture();change(f);reject(rehash(f));}
});
test('wrong caller/owner or writable foreign ACE evidence fails; owner and SYSTEM identities remain finite',()=>{
 for(const change of [f=>f.callerSid='S-1-5-21-1-2-3-4',f=>f.parent.ownerSid='S-1-5-32-544',f=>f.journal.ownerSid='S-1-1-0',f=>f.parent.foreignWritable=true,f=>f.journal.foreignWritable=true,f=>f.parent.foreignAllowed=true,f=>f.journal.foreignAllowed=true,f=>f.parent.daclProtected=false]){const f=fixture();change(f);reject(f);}
 const system=fixture();system.parent.ownerSid='S-1-5-18';system.journal.ownerSid='S-1-5-18';assert.equal(assertCrm06StaffJournalPhysicalEvidence(system,options()).journal.ownerSid,'S-1-5-18');
 const inherited=fixture();inherited.journal.daclProtected=false;assert.equal(assertCrm06StaffJournalPhysicalEvidence(inherited,options()).journal.daclProtected,false);
});
test('stale reference digest, changed reference order, added content/authority fields and getters cannot become accepted physical evidence',()=>{
 for(const change of [f=>f.referenceSha256='a'.repeat(64),f=>f.references.reverse(),f=>f.references[0].password='should-not-return',f=>f.canWrite=true,f=>f.parent.token='should-not-return',f=>f.status='PASS']){const f=fixture();change(f);reject(f);}
 const f=fixture();Object.defineProperty(f.journal,'foreignWritable',{get(){throw Error('getter must not run');},enumerable:true});reject(f);
});
test('inspection rejects malformed arguments before any OS path, child process or private-file access',async()=>{
 await assert.rejects(inspectCrm06StaffJournalPhysical({ownerSid:sid,excludedPaths:[]}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 await assert.rejects(inspectCrm06StaffJournalPhysical({ownerSid:'foreign',excludedPaths:[...paths]}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 await assert.rejects(inspectCrm06StaffJournalPhysical({ownerSid:sid,excludedPaths:[...paths],path:target}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
});
test('bundled PS5.1 checker uses metadata-only official handles, descriptor inspection and fixed safe output; no journal/credential content reader or writer',()=>{
 const source=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');
 assert(source.includes('CreateFileW($value,0x20080,1'));assert(source.includes('GetFileInformationByHandle'));assert(source.includes('GetSecurityInfo'));assert(source.includes('0x500D0156'));assert(source.includes('DiscretionaryAclProtected'));assert(source.includes('Check-Ancestors'));assert(source.includes('staff-refresh-successor-b2985d2295c0.json'));
 assert(!/Get-Content|ReadAllBytes|ReadAllText|ReadFile\(|Set-Acl|Set-Content|WriteAll|New-Item|ProtectedData|CreateHardLink|SetFile/i.test(source));
 assert(source.includes("[Console]::Error.Write('CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:'+$phase)"));
 assert(source.includes("if($status -eq 'PREPARE_REQUIRED' -and $null -ne (Attributes $target)){throw 'REJECT'}"));
});
test('physical diagnostic retains only exact finite phase codes and drops native text, paths and near matches',()=>{
 for(const phase of ['OWNER','PARAMETERS','NATIVE_INIT','ANCESTORS','PARENT_ACL','TARGET','REFERENCES','RECHECK','RESULT'])assert.equal(crm06StaffJournalPhysicalDiagnosticPhase('CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:'+phase),phase);
 for(const value of [null,{},'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED','CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:UNKNOWN','CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:PARAMETERS_PRIVATE','prefix CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:OWNER','CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:OWNER\nprivate native detail','CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:'+target])assert.equal(crm06StaffJournalPhysicalDiagnosticPhase(value),null);
 assert.equal(crm06StaffJournalPhysicalDiagnosticPhase('CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED:PARAMETERS\r\n'),'PARAMETERS');
});
test('legacy PS5 command transport carries only validated owner SID while the child independently inspects every finite reference',()=>{
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,excludedPaths:[...paths]});assert(Object.isFrozen(args));assert.deepEqual(args.slice(-2),['-OwnerSid',sid]);assert.equal(args.length,8);assert.equal(args.includes('-ExcludedPathsJson'),false);assert.equal(args.some(arg=>arg.startsWith('[')),false);
 for(const refs of [paths.slice(1),[...paths.slice(0,9),target]])assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,excludedPaths:refs}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 const source=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(source.includes('$excluded=$expected'));assert(!source.includes('ExcludedPathsJson'));assert(!source.includes('ConvertFrom-Json'));assert(source.includes('foreach($value in $excluded)'));assert(source.includes('staff-refresh-successor-b2985d2295c0.json'));
});
const frontendSource='da82fc6644c1d9dba0c10eaa861773534d43c288';
function frontendEvidence(){const f=fixture(),old=new Map(f.references.map(ref=>[ref.path,ref]));f.references=crm06StaffJournalExcludedPaths(frontendSource).map(path=>old.get(path)??{path,exists:true,volumeSerial:'1234ABCD',fileId:'0000000000000099',linkCount:1,reparse:false});return rehash(f);}
test('frontend physical policy keeps exact old ten metadata references and adds only da82 receipt, with no journal reset or authority grant',()=>{
 const old=fixture(),oldBefore=structuredClone(old),newPaths=crm06StaffJournalExcludedPaths(frontendSource),opts={...options(),source:frontendSource,excludedPaths:[...newPaths]},f=frontendEvidence();
 assert.equal(newPaths.length,11);assert.deepEqual(newPaths.filter(path=>path!==root+'\\staff-refresh-successor-da82fc6644c1.json'),[...paths]);assert.equal(crm06StaffJournalExcludedPaths(),paths);
 assert.equal(assertCrm06StaffJournalPhysicalEvidence(f,opts).journal.path,target);assert.equal(assertCrm06StaffJournalPhysicalEvidence(old,options()).references.length,10);assert.deepEqual(old,oldBefore);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,excludedPaths:[...newPaths],source:frontendSource});assert.deepEqual(args.slice(-2),['-Source',frontendSource]);
 const source=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(source.includes("if($Source -ceq '"+frontendSource+"'){$expected+=($actorRoot+'\\staff-refresh-successor-da82fc6644c1.json')}"));
});
test('frontend physical policy rejects cross-profile evidence, unknown sources and alias to the newly added receipt',()=>{
 const refs=[...crm06StaffJournalExcludedPaths(frontendSource)],opts={...options(),source:frontendSource,excludedPaths:refs},evidence=frontendEvidence();
 reject(fixture(),opts);reject(evidence,options());reject(evidence,{...opts,excludedPaths:[...paths]});
 for(const source of ['f'.repeat(40),frontendSource.toUpperCase(),null]){assert.throws(()=>crm06StaffJournalExcludedPaths(source),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,excludedPaths:refs,source}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});}
 const alias=structuredClone(evidence),receipt=alias.references.find(ref=>ref.path.endsWith('staff-refresh-successor-da82fc6644c1.json'));alias.journal.fileId=receipt.fileId;reject(alias,opts);
});
