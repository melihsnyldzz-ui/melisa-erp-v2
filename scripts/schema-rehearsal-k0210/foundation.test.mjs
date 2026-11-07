import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRehearsalFoundation,compileRehearsalEmptyObserver,compileRehearsalBootstrap} from './foundation.mjs';
import {REHEARSAL_SERVER,REHEARSAL_DATABASE} from './identity.mjs';
import {compileDesktopEmptySchema} from '../desktop-empty/schema.mjs';
import {compileDesktopNativeCatalogSchema} from '../desktop-empty/native-catalog-schema.mjs';
const m={server:REHEARSAL_SERVER,database:REHEARSAL_DATABASE,databaseId:11,databaseGuid:'e2a89d24-3984-4bbf-8a3f-d1485c667234',databaseCreateTime:'2026-11-07T10:00:00.000',environmentId:'ab621184-82bf-4d09-8257-d2d9b0657372',adminPid:12000,adminProcessBirth:'2026-11-07T09:00:00.000000Z',adminSid:'0x0102030405060708',sqlProcessId:5240,sqlProcessBirth:'2026-11-05T14:17:00.247024Z'};
test('pinned foundation and catalog generate guarded source previews only',()=>{
 const p=compileRehearsalFoundation(m);assert.equal(p.executionAuthorized,false);assert.equal(p.sqlTested,false);assert.equal(p.bodies.length,41);
 for(const b of p.bodies){assert.match(b.sha256,/^[a-f0-9]{64}$/);assert.equal(Object.hasOwn(b,'sql'),false);}
 for(const t of ['party_entities','party_currency_accounts','product_prices','desktop_empty_installation'])assert.equal(p.bodies.filter(b=>b.tableNames.includes(t)).length,1,t);
 assert.throws(()=>compileDesktopEmptySchema({database:REHEARSAL_DATABASE}));assert.throws(()=>compileDesktopNativeCatalogSchema({database:REHEARSAL_DATABASE}));
});
test('bootstrap requires distinct observed empty-target security and metadata hashes',()=>{
 const baseline={metadataSha256:'a'.repeat(64),securitySha256:'b'.repeat(64)},o=compileRehearsalEmptyObserver(m),p=compileRehearsalBootstrap(m,baseline);
 for(const x of [o,p]){assert.equal(x.executionAuthorized,false);assert.equal(x.sqlTested,false);assert.match(x.sql,/K0210_EMPTY_DATABASE_REJECTED/);assert.match(x.sql,/SEMIH\\Xaser/);assert.match(x.sql,/user_access_desc=N'RESTRICTED_USER'/);assert.match(x.sql,/is_trustworthy_on=0/);assert.match(x.sql,/is_db_chaining_on=0/);assert.match(x.sql,/sys\.database_files/);assert.doesNotMatch(x.sql,/MELISA_ERP_DESKTOP_TEST_20261105|eb2888c2-51cb-4570-a933-397cf7e62806|\bUSE\s+/i);}
 assert.match(p.sql,/K0210_EMPTY_BASELINE_CHANGED/);assert.match(p.sql,/K0210_BOOTSTRAP_SECURITY_CHANGED/);assert.match(p.sql,/K0210_FOUNDATION_RESULT_REJECTED/);assert.ok(p.sql.includes(baseline.metadataSha256));assert.ok(p.sql.includes(baseline.securitySha256));assert.throws(()=>compileRehearsalBootstrap(m,{...baseline,extra:'x'}));assert.throws(()=>compileRehearsalBootstrap({...m,databaseId:5},baseline));
});
