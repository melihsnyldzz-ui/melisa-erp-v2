// Node-only static source checks and a synthetic semantic oracle. These tests
// do not execute PowerShell or prove its runtime behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./readmit-master-v5-runtime.ps1',import.meta.url),'utf8');
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const h=c=>c.repeat(64),sql='SELECT 1;',snapshot=sha(sql);
const fixture=()=>({context:{contextKey:h('a'),packageSha256:h('b')},pkg:{snapshotSqlSha256:snapshot},plan:{mode:'snapshot',sql,sha256:snapshot},proof:{state:'MASTER_V5_APPLY_INDEPENDENTLY_VERIFIED',contextKey:h('a'),packageSha256:h('b'),observerProcessCompleted:true,writerProcessCompleted:true,businessRowsPreserved:true,permissionIdentityCurrent:'31',baseline:{metadataSha256:h('c'),securitySha256:h('d'),businessRowsSha256:h('e')},candidate:{metadataSha256:h('f'),securitySha256:h('1')},observed:{state:'MASTER_V5_BATCH_COMPLETED',operation:'observe',contextKey:h('a'),packageSha256:h('b'),planSha256:h('2'),sqlSha256:snapshot,result:{schemaVersion:5,permissionIdentityCurrent:'31',metadataSha256:h('f'),securitySha256:h('1'),businessRowsSha256:h('e')}}}});
// Independent test oracle expresses intended binding, not production code.
function intended({proof,plan,pkg,context}){const o=proof?.observed,r=o?.result,b=proof?.baseline,c=proof?.candidate;return proof?.state==='MASTER_V5_APPLY_INDEPENDENTLY_VERIFIED'&&proof.contextKey===context.contextKey&&proof.packageSha256===context.packageSha256&&proof.observerProcessCompleted===true&&proof.writerProcessCompleted===true&&proof.businessRowsPreserved===true&&o?.state==='MASTER_V5_BATCH_COMPLETED'&&o.operation==='observe'&&o.contextKey===context.contextKey&&typeof o.packageSha256==='string'&&/^[a-f0-9]{64}$/i.test(o.packageSha256)&&o.packageSha256.toLowerCase()===context.packageSha256&&/^[a-f0-9]{64}$/i.test(o.planSha256)&&r?.schemaVersion===5&&/^[1-9]\d{0,18}$/.test(r.permissionIdentityCurrent)&&proof.permissionIdentityCurrent===r.permissionIdentityCurrent&&['metadataSha256','securitySha256'].every(k=>/^[a-f0-9]{64}$/.test(b?.[k])&&/^[a-f0-9]{64}$/.test(c?.[k])&&r[k]===c[k])&&/^[a-f0-9]{64}$/.test(b?.businessRowsSha256)&&r.businessRowsSha256===b.businessRowsSha256&&/^[a-f0-9]{64}$/.test(pkg.snapshotSqlSha256)&&plan.mode==='snapshot'&&plan.sha256===pkg.snapshotSqlSha256&&o.sqlSha256===pkg.snapshotSqlSha256&&sha(plan.sql)===pkg.snapshotSqlSha256;}
test('caller must pin proof and hold both files before read, and check exact SQL hash before connecting',()=>{
 assert.match(source,/\[Parameter\(Mandatory\)\]\[ValidatePattern\('\^\[A-F0-9\]\{64\}\$'\)\]\[string\]\$ExpectedApplyVerificationSha256/);
 const hold=source.indexOf('Hold-V5File $proofFile $ExpectedApplyVerificationSha256'),read=source.indexOf('Get-Content -Raw -LiteralPath $proofFile'),holdPlan=source.indexOf('Hold-V5File $planFile $proof.observed.planSha256'),check=source.indexOf('Assert-V5AdmissionEvidence $proof $plan $pkg $context'),connect=source.indexOf('$connection=Open-MasterV3Admin');
 assert(hold>=0&&hold<read&&read<holdPlan&&holdPlan<check&&check<connect);
 assert.match(source,/FileMode\]::Open,\[IO\.FileAccess\]::Read,\[IO\.FileShare\]::Read/);assert.match(source,/HashData\(\[Text\.Encoding\]::UTF8\.GetBytes\(\$plan\.sql\)\)/);
 for(const text of ["$plan.mode -cne 'snapshot'",'$plan.sha256 -cne $pkg.snapshotSqlSha256','$actualSqlHash -cne $pkg.snapshotSqlSha256','$proof.observed.sqlSha256 -cne $pkg.snapshotSqlSha256','$proof.observed.planSha256 -cnotmatch','$proof.observed.result.businessRowsSha256 -cne $proof.baseline.businessRowsSha256','$proof.observed.result[$k] -cne $proof.candidate[$k]'])assert.ok(source.includes(text),text);
 assert.ok(source.includes('$proof.observed.packageSha256 -isnot [string]'));assert.ok(source.includes("$proof.observed.packageSha256 -cnotmatch '^[A-Fa-f0-9]{64}$'"));assert.ok(source.includes('$proof.observed.packageSha256.ToLowerInvariant() -cne $context.packageSha256'));
 assert.match(source,/foreach\(\$k in @\('metadataSha256','securitySha256','businessRowsSha256','schemaVersion','permissionIdentityCurrent'\)\)\{if\(\$after\[\$k\] -cne \$before\[\$k\]\)/);
});
test('synthetic oracle rejects altered SQL, plan, proof, baseline, candidate and package binding',()=>{
 assert.equal(intended(fixture()),true);
 const actualProducer=fixture();actualProducer.proof.observed.packageSha256=actualProducer.proof.observed.packageSha256.toUpperCase();assert.equal(intended(actualProducer),true);
 for(const edit of [x=>x.plan.sql+=' SELECT 2;',x=>x.plan.sha256=h('3'),x=>x.plan.mode='apply',x=>x.pkg.snapshotSqlSha256=h('3'),x=>x.proof.observed.sqlSha256=h('3'),x=>x.proof.observed.planSha256='bad',x=>x.proof.contextKey=h('3'),x=>x.proof.observed.contextKey=h('3'),x=>x.proof.observed.packageSha256=h('3'),x=>x.proof.observed.packageSha256='Z'.repeat(64),x=>x.proof.baseline.businessRowsSha256=h('3'),x=>x.proof.candidate.metadataSha256=h('3'),x=>x.proof.observed.result.schemaVersion=4,x=>x.proof.businessRowsPreserved=false]){const f=fixture();edit(f);assert.equal(intended(f),false);}
});
test('proof digest changes when its bytes change or expected hash is missing',()=>{const bytes=JSON.stringify(fixture().proof),expected=sha(bytes);assert.notEqual(sha(bytes+' '),expected);assert.equal(/^[A-F0-9]{64}$/.test(''),false);assert.equal(/^[A-F0-9]{64}$/.test(expected.toUpperCase()),true);});

// Synthetic admission check; this does not execute the PowerShell validator.
test('admission binds business rows to proof and caller before TLS and preserves them after TLS',()=>{
 assert.match(source,/foreach\(\$k in @\('metadataSha256','securitySha256','businessRowsSha256','schemaVersion','permissionIdentityCurrent'\)\)\{if\(\$before\[\$k\] -cne \$proof\.observed\.result\[\$k\]\)/);
 assert.match(source,/\$before\.businessRowsSha256 -cne \$ExpectedBusinessRowsSha256/);
 assert.match(source,/foreach\(\$k in @\('metadataSha256','securitySha256','businessRowsSha256','schemaVersion','permissionIdentityCurrent'\)\)\{if\(\$after\[\$k\] -cne \$before\[\$k\]\)/);
 const admitted=(before,expected,proof)=>before===expected&&before===proof.observed.result.businessRowsSha256;
 const proof=fixture().proof;assert.equal(admitted(h('e'),h('e'),proof),true);
 assert.equal(admitted(h('3'),h('3'),proof),false);
 assert.equal(admitted(h('e'),h('3'),proof),false);
});
