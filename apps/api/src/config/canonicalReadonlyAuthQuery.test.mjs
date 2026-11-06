import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guardCanonicalReadonlyAuthQuery as guard} from './canonicalReadonlyAuthQuery.mjs';
const authSource=readFileSync(new URL('../services/authService.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const actualQuery=name=>authSource.slice(authSource.indexOf(`function ${name}(`)).match(/\.query\(`([\s\S]*?)`\)/)[1];
const userQuery=actualQuery('getUserById'),permissionQuery=actualQuery('getPermissionKeys');

test('same-batch target/login guard precedes permission enumeration and original auth SELECT',()=>{
  const original=userQuery;
  const batch=guard(original), auth=batch.indexOf(original);
  assert.ok(batch.startsWith('IF ISNULL(DB_ID(),-1)<>18\n'));
  for(const condition of [
    "ISNULL(DB_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'MELISA_ERP_SIRKET_TEST_20260929_01'",
    "SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih\\MELISADEV'",
    "SERVERPROPERTY('MachineName')),N'') COLLATE Latin1_General_100_BIN2<>N'Semih'",
    "SERVERPROPERTY('InstanceName')),N'') COLLATE Latin1_General_100_BIN2<>N'MELISADEV'",
    "ISNULL(SUSER_SNAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'",
    "ISNULL(USER_NAME(),N'') COLLATE Latin1_General_100_BIN2<>N'melisa_sirket_test_20260929_01'"
  ]) assert.ok(batch.indexOf(condition)>=0&&batch.indexOf(condition)<batch.indexOf('IS_SRVROLEMEMBER'));
  for(const condition of ["ISNULL(IS_SRVROLEMEMBER('sysadmin'),-1)<>0",
    "ISNULL(HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL'),-1)<>0",
    "ISNULL(HAS_PERMS_BY_NAME('dbo.sales_invoices','OBJECT','INSERT'),-1)<>0",
    "ISNULL(HAS_DBACCESS('MELISA_ERP_PROD_CANDIDATE_20260917_01'),-1)<>0"])
    assert.ok(batch.indexOf(condition)>=0&&batch.indexOf(condition)<batch.indexOf('sys.fn_my_permissions'));
  assert.equal((batch.match(/BEGIN ;THROW 50000,N'CANONICAL_EXISTING_POOL_UNAVAILABLE',1; END/g)||[]).length,3);
  assert.ok(batch.indexOf('sys.fn_my_permissions')<auth);
  assert.ok(batch.indexOf('sys.tables')<auth);assert.ok(batch.indexOf('sys.procedures')<auth);
  assert.ok(batch.endsWith(original+'\nEND;'));assert.equal(batch.split(original).length-1,1);
  assert.doesNotMatch(batch,/\b(?:EXEC(?:UTE)?|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|GRANT|REVOKE)\s+(?:dbo\.|sys\.)/i);
  assert.doesNotMatch(batch,/SELECT N'OK'|BEGIN TRAN|COMMIT TRAN|ROLLBACK TRAN/);
});

test('existing typed SELECT bytes remain unchanged and non-query APIs cannot be substituted',()=>{
  for(const original of [userQuery,permissionQuery])
    assert.ok(guard(original).endsWith(original+'\nEND;'));
  for(const invalid of [null,{},['SELECT 1'],()=>{},'EXEC dbo.anything','UPDATE dbo.users SET id=1','',
    'SELECT 1',userQuery+'EXEC dbo.anything;',userQuery+' SELECT 2;',userQuery+'--comment',
    '/*comment*/'+userQuery,userQuery.replace('u.id = @userId','1=1'),userQuery.trim(),
    permissionQuery.replace('can_view = 1','can_view = 0')])
    assert.throws(()=>guard(invalid),/CANONICAL_EXISTING_POOL_UNAVAILABLE/);
});
