import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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
function parentProbeEvidence(){const f=frontendEvidence(),old=new Map(f.references.map(ref=>[ref.path,ref]));f.references=crm06StaffJournalExcludedPaths(frontendSource,'parent-probe').map(path=>old.get(path)??{path,exists:true,volumeSerial:'1234ABCD',fileId:'00000000000000AA',linkCount:1,reparse:false});return rehash(f);}
test('parent-probe physical policy adds exact twelfth receipt and keeps ten/eleven defaults unchanged',()=>{
 const refs=crm06StaffJournalExcludedPaths(frontendSource,'parent-probe'),opts={...options(),source:frontendSource,profileVariant:'parent-probe',excludedPaths:[...refs]},evidence=parentProbeEvidence();assert.equal(refs.length,12);
 assert.deepEqual(refs.filter(path=>!path.endsWith('da82fc6644c1-parent-probe.json')),[...crm06StaffJournalExcludedPaths(frontendSource)]);assert.equal(crm06StaffJournalExcludedPaths().length,10);assert.equal(crm06StaffJournalExcludedPaths(frontendSource).length,11);
 assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).journal.path,target);assert.deepEqual(crm06StaffJournalPhysicalArguments({ownerSid:sid,source:frontendSource,profileVariant:'parent-probe',excludedPaths:[...refs]}).slice(-4),['-Source',frontendSource,'-ProfileVariant','parent-probe']);
 const code=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(code.includes("$hasParentProbe=$PSBoundParameters.ContainsKey('ProfileVariant')"));assert(code.includes("if($hasParentProbe -and $ProfileVariant -ceq 'parent-probe'){$expected+=($actorRoot+'\\staff-refresh-successor-da82fc6644c1-parent-probe.json')}"));
});
test('parent-probe physical policy rejects unknown/cross-source variant, wrong generation evidence and alias to twelfth reference',()=>{
 const refs=[...crm06StaffJournalExcludedPaths(frontendSource,'parent-probe')],opts={...options(),source:frontendSource,profileVariant:'parent-probe',excludedPaths:refs},evidence=parentProbeEvidence();reject(frontendEvidence(),opts);reject(evidence,{...opts,profileVariant:undefined});reject(evidence,{...opts,excludedPaths:[...crm06StaffJournalExcludedPaths(frontendSource)]});
 for(const profileVariant of ['',null,'PARENT-PROBE','other'])assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,source:frontendSource,profileVariant,excludedPaths:refs}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 assert.throws(()=>crm06StaffJournalExcludedPaths('b2985d2295c022848c769ea5f494012c1eb3fa00','parent-probe'),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 const alias=structuredClone(evidence);alias.journal.fileId=alias.references.find(ref=>ref.path.endsWith('da82fc6644c1-parent-probe.json')).fileId;reject(alias,opts);
});
const layoutSource='5ce452b01ef20fc84a09c52b78311db8eb1dd1d8';
function layoutEvidence(){const f=parentProbeEvidence(),old=new Map(f.references.map(ref=>[ref.path,ref]));f.references=crm06StaffJournalExcludedPaths(layoutSource).map(path=>old.get(path)??{path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false});return rehash(f);}
test('5ce physical base policy adds exact thirteenth receipt and preserves all three immutable predecessor policies',()=>{
 const predecessor=crm06StaffJournalExcludedPaths(frontendSource,'parent-probe'),refs=crm06StaffJournalExcludedPaths(layoutSource),opts={...options(),source:layoutSource,excludedPaths:[...refs]},evidence=layoutEvidence();
 assert.equal(refs.length,13);assert.deepEqual(refs.filter(path=>!path.endsWith('staff-refresh-successor-5ce452b01ef2.json')),[...predecessor]);assert.deepEqual([crm06StaffJournalExcludedPaths().length,crm06StaffJournalExcludedPaths(frontendSource).length,predecessor.length],[10,11,12]);
 assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).journal.path,target);assert.equal(evidence.references.find(ref=>ref.path.endsWith('5ce452b01ef2.json')).exists,false);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,source:layoutSource,excludedPaths:[...refs]});assert.deepEqual(args.slice(-2),['-Source',layoutSource]);assert.equal(args.includes('-ProfileVariant'),false);
});
test('5ce physical base policy rejects every variant, cross-generation metadata and aliases to the added receipt',()=>{
 const refs=[...crm06StaffJournalExcludedPaths(layoutSource)],opts={...options(),source:layoutSource,excludedPaths:refs},evidence=layoutEvidence();reject(parentProbeEvidence(),opts);reject(evidence,{...options(),source:frontendSource,profileVariant:'parent-probe',excludedPaths:[...crm06StaffJournalExcludedPaths(frontendSource,'parent-probe')]});
 for(const profileVariant of ['parent-probe','',null,'other']){assert.throws(()=>crm06StaffJournalExcludedPaths(layoutSource,profileVariant),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,source:layoutSource,profileVariant,excludedPaths:refs}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});}
 for(const source of [layoutSource.toUpperCase(),'5ce452b01ef2','f'.repeat(40)])assert.throws(()=>crm06StaffJournalExcludedPaths(source),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
 const alias=structuredClone(evidence),newRef=alias.references.find(ref=>ref.path.endsWith('5ce452b01ef2.json'));Object.assign(newRef,{exists:true,volumeSerial:alias.journal.volumeSerial,fileId:alias.journal.fileId,linkCount:1});reject(rehash(alias),opts);
 const foreign=structuredClone(evidence);foreign.references.at(-1).path+='-foreign';reject(rehash(foreign),opts);
});
test('5ce physical child whitelist and existing runtime profile handoff remain source bound without new environment selectors',()=>{
 const code=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(code.includes("if($Source -ceq '"+layoutSource+"'){$expected+=@(($actorRoot+'\\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\\staff-refresh-successor-5ce452b01ef2.json'))}"));
 assert(code.includes("$ProfileVariant -ceq 'parent-probe' -and $Source -ceq '"+frontendSource+"'"));
 const runtime=readFileSync(new URL('./terminal-completion-logon.mjs',import.meta.url),'utf8');assert(runtime.includes('crm06StaffSuccessorProfileForPath(settings.components.crm.sourceCommit,settings.crmPrivateFiles.crm06StaffSuccessor.path)'));assert(runtime.includes('crm06StaffJournalExcludedPaths(profile.source,profile.profileVariant)'));assert(runtime.includes('excludedPaths,source:profile.source,...variant'));
});
const finalBatchSource='5bcd5ad136ff7ca35d623d436b8724cc491641be';
function finalBatchEvidence(){const f=layoutEvidence(),old=new Map(f.references.map(ref=>[ref.path,ref]));f.references=crm06StaffJournalExcludedPaths(finalBatchSource).map(path=>old.get(path)??{path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false});return rehash(f);}
test('5bcd physical base policy adds only fourteenth receipt and leaves all four previous reference policies unchanged',()=>{
 const refs=crm06StaffJournalExcludedPaths(finalBatchSource),opts={...options(),source:finalBatchSource,excludedPaths:[...refs]},evidence=finalBatchEvidence(),old=[...crm06StaffJournalExcludedPaths(layoutSource)];assert.equal(refs.length,14);assert.deepEqual(refs.filter(path=>!path.endsWith('staff-refresh-successor-5bcd5ad136ff.json')),old);
 assert.deepEqual([crm06StaffJournalExcludedPaths().length,crm06StaffJournalExcludedPaths(frontendSource).length,crm06StaffJournalExcludedPaths(frontendSource,'parent-probe').length,crm06StaffJournalExcludedPaths(layoutSource).length],[10,11,12,13]);assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).journal.path,target);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,source:finalBatchSource,excludedPaths:[...refs]});assert.deepEqual(args.slice(-2),['-Source',finalBatchSource]);assert.equal(args.includes('-ProfileVariant'),false);
 const code=readFileSync(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url),'utf8');assert(code.includes("if($Source -ceq '"+finalBatchSource+"'){$expected+=@(($actorRoot+'\\staff-refresh-successor-da82fc6644c1.json'),($actorRoot+'\\staff-refresh-successor-da82fc6644c1-parent-probe.json'),($actorRoot+'\\staff-refresh-successor-5ce452b01ef2.json'),($actorRoot+'\\staff-refresh-successor-5bcd5ad136ff.json'))}"));
});
test('5bcd physical base policy rejects all variants, predecessor evidence and aliases to the final batch receipt',()=>{
 const refs=[...crm06StaffJournalExcludedPaths(finalBatchSource)],opts={...options(),source:finalBatchSource,excludedPaths:refs},evidence=finalBatchEvidence();reject(layoutEvidence(),opts);reject(evidence,{...options(),source:layoutSource,excludedPaths:[...crm06StaffJournalExcludedPaths(layoutSource)]});
 for(const profileVariant of ['parent-probe','',null,'other']){assert.throws(()=>crm06StaffJournalExcludedPaths(finalBatchSource,profileVariant),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,source:finalBatchSource,profileVariant,excludedPaths:refs}),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});}
 const alias=structuredClone(evidence),ref=alias.references.find(item=>item.path.endsWith('5bcd5ad136ff.json'));Object.assign(ref,{exists:true,volumeSerial:alias.journal.volumeSerial,fileId:alias.journal.fileId,linkCount:1});reject(rehash(alias),opts);
 assert.throws(()=>crm06StaffJournalExcludedPaths(finalBatchSource.toUpperCase()),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});assert.throws(()=>crm06StaffJournalExcludedPaths(finalBatchSource.slice(0,12)),{code:'CRM06_STAFF_JOURNAL_PHYSICAL_REJECTED'});
});
test('receipt-wait physical policy adds only fifteenth receipt and rejects crossed variants missing refs and journal alias',()=>{
 const refs=crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait'),base=crm06StaffJournalExcludedPaths(finalBatchSource),old=new Map(finalBatchEvidence().references.map(r=>[r.path,r]));
 assert.equal(refs.length,15);assert.deepEqual(refs.filter(p=>!p.endsWith('5bcd5ad136ff-receipt-wait.json')),[...base]);
 const evidence=finalBatchEvidence();evidence.references=refs.map(path=>old.get(path)??{path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false});rehash(evidence);
 const opts={...options(),source:finalBatchSource,profileVariant:'receipt-wait',excludedPaths:[...refs]};assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).references.length,15);
 assert.deepEqual(crm06StaffJournalPhysicalArguments({ownerSid:sid,source:finalBatchSource,profileVariant:'receipt-wait',excludedPaths:[...refs]}).slice(-4),['-Source',finalBatchSource,'-ProfileVariant','receipt-wait']);
 reject(finalBatchEvidence(),opts);reject(evidence,{...opts,profileVariant:undefined,excludedPaths:[...base]});
 for(const source of [frontendSource,layoutSource,'b2985d2295c022848c769ea5f494012c1eb3fa00'])assert.throws(()=>crm06StaffJournalExcludedPaths(source,'receipt-wait'));
 for(const variant of ['RECEIPT-WAIT','parent-probe','receipt-wait-extra','',null])assert.throws(()=>crm06StaffJournalExcludedPaths(finalBatchSource,variant));
 const alias=structuredClone(evidence),ref=alias.references.find(r=>r.path.endsWith('5bcd5ad136ff-receipt-wait.json'));Object.assign(ref,{exists:true,volumeSerial:alias.journal.volumeSerial,fileId:alias.journal.fileId,linkCount:1});reject(rehash(alias),opts);
});
test('receipt-wait WindowsPS5 AST executes only finite parameter policy with exact fifteen paths and closed cross-source variants',()=>{
 const sourcePath=fileURLToPath(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url)).replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$try=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
$statements=@($try.Body.Statements);$start=$statements|Where-Object {$_.Extent.Text.StartsWith('$phase=') -and $_.Extent.Text.Contains("'PARAMETERS'")}|Select-Object -First 1
$end=$statements|Where-Object {$_.Extent.Text.StartsWith('[Array]::Sort($expected,')}|Select-Object -First 1
if(-not $start-or-not $end){throw 'POLICY_AST_MISSING'}
$text=$ast.Extent.Text.Substring($start.Extent.StartOffset,$end.Extent.EndOffset-$start.Extent.StartOffset)
$cases=@(@('${finalBatchSource}','receipt-wait'),@('${finalBatchSource}','parent-probe'),@('${frontendSource}','receipt-wait'),@('${layoutSource}','receipt-wait'),@('${finalBatchSource}','RECEIPT-WAIT'),@('${finalBatchSource}',''),@('${frontendSource}','parent-probe'))
$policy=[scriptblock]::Create('param($Source,$ProfileVariant,$actorRoot)'+[Environment]::NewLine+$text+[Environment]::NewLine+'return ,$expected')
$results=@(foreach($case in $cases){try{$paths=& $policy -Source $case[0] -ProfileVariant $case[1] -actorRoot 'C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014';[pscustomobject]@{accepted=$true;paths=@($paths)}}catch{[pscustomobject]@{accepted=$false;paths=@()}}})
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress`;
 // Invoke only the parsed parameter-policy slice; no native/ACL/store statements.
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0);assert.equal(result.stderr,'');const rows=JSON.parse(result.stdout);assert.equal(rows.length,7);assert.equal(rows[0].accepted,true);assert.deepEqual(rows[0].paths,[...crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait')]);for(const row of rows.slice(1,6))assert.equal(row.accepted,false);assert.equal(rows[6].accepted,true);assert.deepEqual(rows[6].paths,[...crm06StaffJournalExcludedPaths(frontendSource,'parent-probe')]);
});

const readySource='bb8966c59a6cfbdc1cc83472cb331e48b720a173';
function readyEvidence(){const f=finalBatchEvidence(),old=new Map(f.references.map(r=>[r.path,r]));f.references=crm06StaffJournalExcludedPaths(readySource).map(path=>old.get(path)??{path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false});return rehash(f);}
test('bb896 physical policy adds only sixteenth receipt and retains every receipt-wait reference',()=>{
 const previous=[crm06StaffJournalExcludedPaths(),crm06StaffJournalExcludedPaths(frontendSource),crm06StaffJournalExcludedPaths(frontendSource,'parent-probe'),crm06StaffJournalExcludedPaths(layoutSource),crm06StaffJournalExcludedPaths(finalBatchSource),crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait')],before=structuredClone(previous),refs=crm06StaffJournalExcludedPaths(readySource),added=root+'\\staff-refresh-successor-bb8966c59a6c.json';
 assert.equal(refs.length,16);assert.deepEqual(refs.filter(p=>p!==added),previous[5]);assert.deepEqual(previous,before);assert.deepEqual(previous.map(p=>p.length),[10,11,12,13,14,15]);
 const opts={...options(),source:readySource,excludedPaths:[...refs]},evidence=readyEvidence();assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).references.length,16);assert.equal(evidence.references.find(r=>r.path===added).exists,false);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,source:readySource,excludedPaths:[...refs]});assert.deepEqual(args.slice(-2),['-Source',readySource]);assert.equal(args.includes('-ProfileVariant'),false);
});
test('bb896 physical policy denies variants aliases older evidence and missing receipt-wait reference',()=>{
 const refs=crm06StaffJournalExcludedPaths(readySource),opts={...options(),source:readySource,excludedPaths:[...refs]},evidence=readyEvidence();reject(finalBatchEvidence(),opts);reject(evidence,{...opts,source:finalBatchSource,profileVariant:'receipt-wait',excludedPaths:[...crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait')]});
 for(const variant of ['parent-probe','receipt-wait','',null,'other']){assert.throws(()=>crm06StaffJournalExcludedPaths(readySource,variant));assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,source:readySource,profileVariant:variant,excludedPaths:[...refs]}));}
 for(const source of [readySource.toUpperCase(),readySource.slice(0,12),'f'.repeat(40),null])assert.throws(()=>crm06StaffJournalExcludedPaths(source));
 for(const suffix of ['bb8966c59a6c.json','5bcd5ad136ff-receipt-wait.json']){const value=structuredClone(evidence),ref=value.references.find(r=>r.path.endsWith(suffix));Object.assign(ref,{exists:true,volumeSerial:value.journal.volumeSerial,fileId:value.journal.fileId,linkCount:1});reject(rehash(value),opts);}
 const missing=structuredClone(evidence);missing.references=missing.references.filter(r=>!r.path.endsWith('5bcd5ad136ff-receipt-wait.json'));reject(rehash(missing),opts);
});
test('bb896 WindowsPS5 parameter slice admits exact sixteen references and rejects source variants without native calls',()=>{
 const sourcePath=fileURLToPath(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url)).replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$try=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
$statements=@($try.Body.Statements);$start=$statements|Where-Object {$_.Extent.Text.StartsWith('$phase=') -and $_.Extent.Text.Contains("'PARAMETERS'")}|Select-Object -First 1
$end=$statements|Where-Object {$_.Extent.Text.StartsWith('[Array]::Sort($expected,')}|Select-Object -First 1
if(-not $start-or-not $end){throw 'POLICY_AST_MISSING'}
$text=$ast.Extent.Text.Substring($start.Extent.StartOffset,$end.Extent.EndOffset-$start.Extent.StartOffset)
$policy=[scriptblock]::Create('param($Source,$ProfileVariant,$actorRoot)'+[Environment]::NewLine+$text+[Environment]::NewLine+'return ,$expected')
$cases=@(@('${readySource}',$null),@('${readySource}','receipt-wait'),@('${readySource}','parent-probe'),@('${readySource}',''),@('${readySource.toUpperCase()}',$null),@('${readySource.slice(0,12)}',$null),@('${finalBatchSource}','receipt-wait'))
$results=@(foreach($case in $cases){try{$a=@{Source=$case[0];actorRoot='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014'};if($null-ne$case[1]){$a.ProfileVariant=$case[1]};$paths=& $policy @a;[pscustomobject]@{accepted=$true;paths=@($paths)}}catch{[pscustomobject]@{accepted=$false;paths=@()}}})
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress`;
 // Only the source parameter-policy AST slice executes; no Add-Type, file
 // handles, private paths, credentials or physical inspection are invoked.
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0);assert.equal(result.stderr,'');const rows=JSON.parse(result.stdout);assert.equal(rows.length,7);assert.equal(rows[0].accepted,true);assert.deepEqual(rows[0].paths,[...crm06StaffJournalExcludedPaths(readySource)]);for(const row of rows.slice(1,6))assert.equal(row.accepted,false);assert.equal(rows[6].accepted,true);assert.deepEqual(rows[6].paths,[...crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait')]);
});

const separateBatchSource='957f98773695874ea3d101b7eb4816f9ea080880';
function separateBatchEvidence(){const f=readyEvidence(),old=new Map(f.references.map(r=>[r.path,r]));f.references=crm06StaffJournalExcludedPaths(separateBatchSource).map(path=>old.get(path)??{path,exists:false,volumeSerial:null,fileId:null,linkCount:null,reparse:false});return rehash(f);}
test('957 physical policy adds only seventeenth receipt and retains every receipt-wait reference',()=>{
 const previous=[crm06StaffJournalExcludedPaths(),crm06StaffJournalExcludedPaths(frontendSource),crm06StaffJournalExcludedPaths(frontendSource,'parent-probe'),crm06StaffJournalExcludedPaths(layoutSource),crm06StaffJournalExcludedPaths(finalBatchSource),crm06StaffJournalExcludedPaths(finalBatchSource,'receipt-wait'),crm06StaffJournalExcludedPaths(readySource)],before=structuredClone(previous),refs=crm06StaffJournalExcludedPaths(separateBatchSource),added=root+'\\staff-refresh-successor-957f98773695.json';
 assert.equal(refs.length,17);assert.deepEqual(refs.filter(p=>p!==added),previous[6]);assert.deepEqual(previous,before);assert.deepEqual(previous.map(p=>p.length),[10,11,12,13,14,15,16]);
 const opts={...options(),source:separateBatchSource,excludedPaths:[...refs]},evidence=separateBatchEvidence();assert.equal(assertCrm06StaffJournalPhysicalEvidence(evidence,opts).references.length,17);assert.equal(evidence.references.find(r=>r.path===added).exists,false);
 const args=crm06StaffJournalPhysicalArguments({ownerSid:sid,source:separateBatchSource,excludedPaths:[...refs]});assert.deepEqual(args.slice(-2),['-Source',separateBatchSource]);assert.equal(args.includes('-ProfileVariant'),false);
});
test('957 physical policy denies variants aliases older evidence and missing receipt-wait reference',()=>{
 const refs=crm06StaffJournalExcludedPaths(separateBatchSource),opts={...options(),source:separateBatchSource,excludedPaths:[...refs]},evidence=separateBatchEvidence();reject(readyEvidence(),opts);reject(evidence,{...opts,source:readySource,excludedPaths:[...crm06StaffJournalExcludedPaths(readySource)]});
 for(const variant of ['parent-probe','receipt-wait','',null,'other']){assert.throws(()=>crm06StaffJournalExcludedPaths(separateBatchSource,variant));assert.throws(()=>crm06StaffJournalPhysicalArguments({ownerSid:sid,source:separateBatchSource,profileVariant:variant,excludedPaths:[...refs]}));}
 for(const source of [separateBatchSource.toUpperCase(),separateBatchSource.slice(0,12),'f'.repeat(40),null])assert.throws(()=>crm06StaffJournalExcludedPaths(source));
 for(const suffix of ['957f98773695.json','bb8966c59a6c.json','5bcd5ad136ff-receipt-wait.json']){const value=structuredClone(evidence),ref=value.references.find(r=>r.path.endsWith(suffix));Object.assign(ref,{exists:true,volumeSerial:value.journal.volumeSerial,fileId:value.journal.fileId,linkCount:1});reject(rehash(value),opts);}
 const missing=structuredClone(evidence);missing.references=missing.references.filter(r=>!r.path.endsWith('5bcd5ad136ff-receipt-wait.json'));reject(rehash(missing),opts);
});
test('957 WindowsPS5 parameter slice admits exact seventeen references and rejects source variants without native calls',()=>{
 const sourcePath=fileURLToPath(new URL('./crm06-staff-journal-preflight.ps1',import.meta.url)).replaceAll("'","''");
 const script=`$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue'
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile('${sourcePath}',[ref]$tokens,[ref]$errors)
if($errors.Count-ne0){throw 'PARSE_FAILED'}
$try=$ast.EndBlock.Statements|Where-Object {$_ -is [Management.Automation.Language.TryStatementAst]}|Select-Object -First 1
$statements=@($try.Body.Statements);$start=$statements|Where-Object {$_.Extent.Text.StartsWith('$phase=') -and $_.Extent.Text.Contains("'PARAMETERS'")}|Select-Object -First 1
$end=$statements|Where-Object {$_.Extent.Text.StartsWith('[Array]::Sort($expected,')}|Select-Object -First 1
if(-not $start-or-not $end){throw 'POLICY_AST_MISSING'}
$text=$ast.Extent.Text.Substring($start.Extent.StartOffset,$end.Extent.EndOffset-$start.Extent.StartOffset)
$policy=[scriptblock]::Create('param($Source,$ProfileVariant,$actorRoot)'+[Environment]::NewLine+$text+[Environment]::NewLine+'return ,$expected')
$cases=@(@('${separateBatchSource}',$null),@('${separateBatchSource}','receipt-wait'),@('${separateBatchSource}','parent-probe'),@('${separateBatchSource}',''),@('${separateBatchSource.toUpperCase()}',$null),@('${separateBatchSource.slice(0,12)}',$null),@('${readySource}',$null))
$results=@(foreach($case in $cases){try{$a=@{Source=$case[0];actorRoot='C:\\Sirket\\CRM\\runtime\\CRM06-TEST-ACTORS-20261014'};if($null-ne$case[1]){$a.ProfileVariant=$case[1]};$paths=& $policy @a;[pscustomobject]@{accepted=$true;paths=@($paths)}}catch{[pscustomobject]@{accepted=$false;paths=@()}}})
ConvertTo-Json -InputObject @($results) -Depth 5 -Compress`;
 // Only the source parameter-policy AST slice executes; no Add-Type, file
 // handles, private paths, credentials or physical inspection are invoked.
 const result=spawnSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0);assert.equal(result.stderr,'');const rows=JSON.parse(result.stdout);assert.equal(rows.length,7);assert.equal(rows[0].accepted,true);assert.deepEqual(rows[0].paths,[...crm06StaffJournalExcludedPaths(separateBatchSource)]);for(const row of rows.slice(1,6))assert.equal(row.accepted,false);assert.equal(rows[6].accepted,true);assert.deepEqual(rows[6].paths,[...crm06StaffJournalExcludedPaths(readySource)]);
});
