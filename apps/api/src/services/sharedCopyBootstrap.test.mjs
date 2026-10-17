import test from 'node:test';
import assert from 'node:assert/strict';
import {fixtureContext} from './isolatedOperationCopyContext.test.mjs';
import {isolatedCopyHash,validateIsolatedOperationCopyContext,BUSINESS_COPY_DATABASE,SHARED_COPY_DATABASE} from './isolatedOperationCopyContext.mjs';
import {validateSharedCopyBootstrap,publicSharedCopyScope,assertSharedBootstrapRelease} from './sharedCopyBootstrap.mjs';
import {sharedWebCspFor} from './sharedCopyWebPolicy.mjs';
import {copyRecoveryProjection} from './workSystemService.mjs';
import {resolveCopyBuildTarget,copyBuildReleaseFields} from '../../../../scripts/canonical/copy-build-target.mjs';
function raw(business=true){const c=fixtureContext();c.date='2026-10-09';c.target.database=business?BUSINESS_COPY_DATABASE:SHARED_COPY_DATABASE;c.target.login=c.target.databaseUser=business?'melisa_shared_test_rw_20261009_02':'melisa_shared_test_rw_20261009_01';c.suppliers[0].currency='TRY';c.products=[{...c.products[0],id:'29980'},{...c.products[0],id:'30003'}];if(business){Object.assign(c,{scopeKind:'VERIFIED_BUSINESS_TEST',businessScopeHash:'d'.repeat(64),businessInvoiceMaxExact4:'20000.0000',currencyRates:[{currency:'TRY',rateExact8:'1.00000000',source:'IDENTITY_TRY',date:c.date,id:null},{currency:'USD',rateExact8:'47.80000000',source:'dated-fixture',date:'2026-09-12',id:'2'}],externalOperations:false,humanAccepted:false});for(const kind of ['customers','suppliers'])c[kind].forEach(p=>Object.assign(p,{sourceKnown:true,sourceWitnessHash:'e'.repeat(64)}));}else {c.customers[0].id='210';c.suppliers[0].id='10162';c.financeAccounts=[{...c.financeAccounts[0],id:'20043'}];}return seal(c);}
function seal(c){const {sealHash,...body}=c;return {...body,sealHash:isolatedCopyHash(body)};}
function config(business=true){const c=raw(business);return {copyContext:c,host:'127.0.0.1',lanHost:'192.168.1.46',erpPort:business?4184:4174,nativePort:business?4186:4176,webPort:business?5234:5224,database:c.target.database,server:c.target.server,sqlUser:business?'melisa_shared_test_ro_20261009_02':'melisa_shared_test_ro_20261009_01',salesSqlUser:c.target.login,jwtAccessSecret:'s'.repeat(48),jwtRefreshSecret:'t'.repeat(48)};}
test('bootstrap validates both finite shared topologies and refuses old reader port or database on new context before SQL',()=>{
 for(const business of [true,false])assert.equal(validateSharedCopyBootstrap(config(business)).business,business);
 for(const patch of [{erpPort:4174},{nativePort:4176},{webPort:5224},{sqlUser:'melisa_shared_test_ro_20261009_01'},{database:SHARED_COPY_DATABASE},{host:'0.0.0.0'},{lanHost:'192.168.1.47'}])assert.throws(()=>validateSharedCopyBootstrap({...config(),...patch}));
});
test('customer contact descriptor cannot enter shared bootstrap without its sealed predecessors',async()=>{
 const {customerContactFixture}=await import('../../../../scripts/canonical/shared-business-customer-contact-test-fixture.mjs');const f=await customerContactFixture(),base=config();
 base.copyContext=f.copy;base.database=f.copy.target.database;base.server=f.copy.target.server;base.salesSqlUser=f.copy.target.login;base.customerContactRevision=f.bundle.revision;
 assert.throws(()=>validateSharedCopyBootstrap(base));
});
test('business build flag produces exact immutable nested target pins; mixed flags and opposite release never activate',()=>{
 const target=resolveCopyBuildTarget(['--business-test-copy']);assert.equal(target.dist,'dist-business');assert.equal(target.apiPort,4184);const c=validateSharedCopyBootstrap(config()).context;
 const release={sourceCommit:'a'.repeat(40),packageId:'CANONICAL-TEST-synthetic',...copyBuildReleaseFields(target)};assert.equal(assertSharedBootstrapRelease(release,c),release);
 assert.throws(()=>assertSharedBootstrapRelease({...release,...copyBuildReleaseFields(resolveCopyBuildTarget(['--shared-test-copy']))},c));
 for(const args of [['--business-test-copy','--shared-test-copy'],['--business-test-copy','--stage4-copy'],['--business-test-copy','--business-test-copy']])assert.throws(()=>resolveCopyBuildTarget(args));
});
test('public business scope excludes credential costs hashes and private names outside declared fields while CSP forbids old runtime targets',()=>{
 const rawContext=raw();rawContext.products[0].purchasePriceExact8='secret-cost';rawContext.suppliers[0].sqlPassword='secret-credential';rawContext.suppliers[0].name='Synthetic supplier';const c=validateIsolatedOperationCopyContext(seal(rawContext)),scope=publicSharedCopyScope(c),text=JSON.stringify(scope);
 assert.equal(scope.scopeKind,'VERIFIED_BUSINESS_TEST');assert.equal(scope.suppliers[0].name,'Synthetic supplier');assert.ok(!text.includes('secret-cost'));assert.ok(!text.includes('secret-credential'));assert.ok(!text.includes('beforeHash'));assert.ok(!text.includes('sourceWitnessHash'));
 const csp=sharedWebCspFor(c);assert.ok(csp.includes(':4184'));assert.ok(csp.includes(':4186'));assert.ok(csp.includes(':62700'));assert.ok(!csp.includes(':4174'));assert.ok(!csp.includes(':62600'));assert.ok(csp.includes("script-src 'self'"));
});
test('DB02 restore projection accepts only the declared completed shared-copy comparison, not inherited stage4 proof',()=>{
 const c=raw();c.recoveryProof={schemaVersion:'melisa-shared-test.recovery-comparison.v1',status:'PASS',comparedAt:new Date().toISOString(),tablesCompared:51,moduleDefinitionsCompared:177,sourceBeforeAfterEqual:true,rawCopyMatchesSource:true,changed:[],hashBasis:'SQL_FULL_ROW_JSON_UTF16_SHA256_SORTED_MULTISET',actualRestorePerformed:true,activeDatabaseOverwritten:false,coverage:'51 critical tables; not all database rows'};assert.equal(copyRecoveryProjection(validateIsolatedOperationCopyContext(seal(c))).restore.status,'success');c.recoveryProof.rawCopyMatchesSource=false;assert.equal(copyRecoveryProjection(validateIsolatedOperationCopyContext(seal(c))).restore.status,'unknown');
});
