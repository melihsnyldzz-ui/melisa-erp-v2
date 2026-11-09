import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileWarehouseLifecycle} from './lifecycle-sql.mjs';
import {getDesktopFinanceV7GuardSql} from '../../../apps/api/src/config/desktopFinanceV7Policy.mjs';
import {WAREHOUSE_TABLE_KEYS,WAREHOUSE_GUARD_SOURCE_FILES,WAREHOUSE_LIFECYCLE_PARAMETER_TYPES as TYPES} from './lifecycle-contract.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
test('the complete current V7 schema/effective-permission guard is reused without changes',()=>{
 const guard=getDesktopFinanceV7GuardSql();for(const action of ['observe','activate','deactivate']){const p=compileWarehouseLifecycle({action});assert.equal(p.executionAuthorized,false);assert.equal(p.preparationOnly,true);assert.equal(p.sqlSha256,sha(p.sql));assert.equal(p.guardSqlSha256,sha(guard));assert.equal(p.sql.split(guard).length,2);assert.ok(p.sql.indexOf('EXECUTE AS LOGIN=')<p.sql.indexOf(guard));assert.ok(p.sql.indexOf('REVERT;SET @impersonating=0;',p.sql.indexOf(guard))>0);assert.match(p.sql,/COUNT_BIG\(\*\) FROM sys.database_permissions\)<>404/);assert.doesNotMatch(p.sql,/<>400|00111ED1/);}
});
test('43 schema-known tables and exact primary-key order cover both pre/post inventories',()=>{
 assert.equal(Object.keys(WAREHOUSE_TABLE_KEYS).length,43);assert.equal(WAREHOUSE_GUARD_SOURCE_FILES.length,12);
 for(const action of ['activate','deactivate']){const p=compileWarehouseLifecycle({action});assert.deepEqual(p.parameterTypes,TYPES);for(const [name,keys] of Object.entries(WAREHOUSE_TABLE_KEYS)){assert.ok(keys.length>0);const ordered='FROM dbo.['+name+'] WITH(TABLOCKX,HOLDLOCK) ORDER BY '+keys.map(k=>'['+k+']').join(',');assert.equal(p.sql.split(ordered).length,3);}assert.match(p.sql,/name NOT IN\(N'users',N'audit_logs'\)/);assert.match(p.sql,/WH_OLD_AUDITS/);assert.match(p.sql,/WH_OTHER_USERS/);}
});
test('CAS and audit are minimal, typed, same-transaction, and exact approved plan source/reason',()=>{
 for(const [action,to,suffix] of [['activate',1,'ACTIVATE'],['deactivate',0,'DEACTIVATE']]){const s=compileWarehouseLifecycle({action}).sql;assert.equal((s.match(/UPDATE dbo\.users SET/g)||[]).length,1);assert.match(s,new RegExp('UPDATE dbo\\.users SET is_active='+to+' OUTPUT'));assert.match(s,/WHERE id=@userId AND role_id=@roleId AND is_active=[01] AND row_version=@expectedUserVersion/);assert.match(s,/@userId<>30007 OR @roleId<>10/);assert.ok(s.includes('K10-WH-CONT-20261109-01:'+suffix));assert.ok(s.includes("N'desktop-role-test-setup'"));assert.equal((s.match(/INSERT dbo\.audit_logs/g)||[]).length,1);assert.ok(s.indexOf('UPDATE dbo.users SET')<s.indexOf('INSERT dbo.audit_logs'));assert.ok(s.indexOf('WH_OTHER_TABLES')<s.indexOf('COMMIT TRANSACTION'));assert.doesNotMatch(s,/UPDATE dbo\.(roles|permissions|system_settings)|ALTER LOGIN|CREATE LOGIN|DELETE dbo\.|DROP TABLE/i);assert.match(s,/WH_LIFECYCLE_ALREADY_SENT/);assert.match(s,/IF XACT_STATE\(\)<>0 ROLLBACK TRANSACTION/);}
 assert.match(compileWarehouseLifecycle({action:'activate'}).sql,/@expectedUserVersion<>0x000000000011BB11/);assert.doesNotMatch(compileWarehouseLifecycle({action:'deactivate'}).sql,/@expectedUserVersion<>0x000000000011BB11/);
});
test('read-only rendering cannot issue business writes; unsupported action fails closed',()=>{
 const p=compileWarehouseLifecycle();assert.deepEqual(p.parameterTypes,{});assert.doesNotMatch(p.sql,/(?:INSERT|UPDATE|DELETE) dbo\./);assert.doesNotMatch(p.sql,/COMMIT TRANSACTION/);assert.match(p.sql,/ROLLBACK TRANSACTION/);assert.match(p.sql,/observedAtMs/);assert.throws(()=>compileWarehouseLifecycle({action:'enable-any-user'}));
});
