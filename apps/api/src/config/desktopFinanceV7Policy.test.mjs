import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL,DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS,DESKTOP_FINANCE_V7_LIMITS,getDesktopFinanceV7GuardSql} from './desktopFinanceV7Policy.mjs';

test('V7 candidate retains V6 protection and finite finance metadata and rights',()=>{assert.equal(DESKTOP_FINANCE_V7_LIMITS.guardReady,true);assert.equal(DESKTOP_FINANCE_V7_LIMITS.sqlVerified,false);assert.equal(DESKTOP_FINANCE_V7_OPERATOR_PERMISSIONS.length,19);assert.match(DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,/schema_version=7/);assert.match(DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,/DESKTOP_FINANCE_V7_SCHEMA_REJECTED/);assert.match(DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,/DESKTOP_GOODS_V6_SCHEMA_REJECTED/);assert.match(DESKTOP_FINANCE_V7_PERMISSION_GUARD_SQL,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);assert.match(getDesktopFinanceV7GuardSql(),/sys\.identity_columns/);assert.match(getDesktopFinanceV7GuardSql(),/sys\.triggers/);});

test('temporary SQL Server metadata matches all four exact guard definitions without claiming permanent acceptance',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./test-fixtures/desktopFinanceV7ObservedChecks.json',import.meta.url),'utf8'));
 assert.equal(fixture.origin,'SQL_SERVER_LOCAL_TEMP_TABLE_METADATA_ONLY');assert.equal(fixture.permanentFinanceSchemaAccepted,false);assert.equal(fixture.proofSha256,'65352e3a558d2beb9f7a6916e180ac71262208702c5eb4d7fd48b5a9e336ddb5');assert.equal(fixture.checks.length,4);
 const sql=DESKTOP_FINANCE_V7_SCHEMA_GUARD_CANDIDATE,clauses=new Map();
 for(const row of fixture.checks){assert.equal(row.is_disabled,false);assert.equal(row.is_not_trusted,false);assert.equal(row.is_not_for_replication,false);const name='CK_desktop_finance_requests_'+row.name.slice('CK_ERP_V7_RENDER_'.length),needle=`name=N'${name}'`,at=sql.indexOf(needle);assert.notEqual(at,-1);const end=sql.indexOf('\n OR ',at),clause=sql.slice(at,end<0?undefined:end);assert.ok(clause.includes(`CONVERT(varbinary(max),N'${row.definition.replaceAll("'","''")}')`),name);clauses.set(name,clause);}
 for(const [name,old] of [['operation',"([operation]='collection' OR [operation]='payment')"],['state',"([state]='pending' OR [state]='committed')"]])assert.equal(clauses.get('CK_desktop_finance_requests_'+name).includes(`CONVERT(varbinary(max),N'${old.replaceAll("'","''")}')`),false);
});
