import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {supplierContactCaptureQueries,assertSupplierContactCaptureIdentity,SUPPLIER_CONTACT_CAPTURE_SERVER as server,SUPPLIER_CONTACT_CAPTURE_DATABASE as database} from './shared-business-supplier-contact-capture.mjs';
test('metadata capture never reads business rows or executes native procedures',()=>{
 const queries=supplierContactCaptureQueries();assert(Object.isFrozen(queries));
 assert.deepEqual(Object.keys(queries),['identity','columns','indexes','checks','foreignKeys','modules','dependencies']);
 for(const sql of Object.values(queries)){
  assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|MERGE|EXEC|ALTER|CREATE|DROP|TRUNCATE|BACKUP|RESTORE|DBCC)\b/i);
  assert.doesNotMatch(sql,/\b(?:FROM|JOIN)\s+(?:dbo|erp_migration)\./i);
 }
});
test('capture retains schema detail and all owner/hash/dependency metadata rather than inventing a supplier graph',()=>{
 const q=supplierContactCaptureQueries();
 for(const field of ['ordinal','maxLength','precision','scale','nullable','computedDefinition','defaultDefinition','identityColumn','collationName'])assert(q.columns.includes(field));
 for(const field of ['isUnique','isPrimaryKey','filterDefinition','keyOrdinal','includedColumn'])assert(q.indexes.includes(field));
 for(const field of ['executeAsPrincipalId','definitionHash','parentName','isDisabled','firstInsert','firstUpdate','firstDelete'])assert(q.modules.includes(field));
 assert(q.modules.includes('o.is_ms_shipped=0'));assert(!q.modules.includes("o.name LIKE"));
 assert(q.dependencies.includes('referencedDatabase'));assert(q.foreignKeys.includes('referencedColumn'));
});
test('wrong target, hidden definition permission or open transaction fails closed',()=>{
 const valid={server,database,openTransactions:0,sessionId:53,canViewDefinition:1};assert.equal(assertSupplierContactCaptureIdentity([valid]),valid);
 for(const patch of [{server:'other'},{database:'VEGA2026'},{database:'MELISA_ERP_PROD_CANDIDATE_20260917_01'},{openTransactions:1},{canViewDefinition:0},{sessionId:0},{sessionId:'53'}])assert.throws(()=>assertSupplierContactCaptureIdentity([{...valid,...patch}]));
 for(const rows of [[],[valid,valid],null])assert.throws(()=>assertSupplierContactCaptureIdentity(rows));
});
test('owner wrapper keeps capture private, refuses overwrites and detects observed metadata drift',()=>{
 const source=readFileSync(new URL('./capture-shared-business-supplier-contact.ps1',import.meta.url),'utf8');
 for(const guard of ['PRIVATE_NEW_OUTPUT_REQUIRED','FileMode]::CreateNew','METADATA_INCOMPLETE','METADATA_CHANGED','SESSION_CHANGED','Integrated Security=True'])assert(source.includes(guard));
 assert(!source.includes('ConvertFrom-Json -AsHashtable'));assert(!source.includes('Password='));assert(!source.includes('User ID='));
 assert(source.includes("foreach($name in $names){$again=@(Rows $queries.$name)"));
 assert(source.includes('nativeActivated=$false'));assert(source.includes('containsBusinessRows=$false'));
});
