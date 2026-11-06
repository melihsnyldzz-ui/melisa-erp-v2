import test from 'node:test';import assert from 'node:assert/strict';import {desktopMasterSchema,DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from './desktopMasterVersion.mjs';
test('old profiles remain exact and V4 is explicit; guard checks ordered customer/currency key and exact filter',()=>{
 assert.equal(desktopMasterSchema(false),2);assert.equal(desktopMasterSchema(true),3);assert.equal(desktopMasterSchema(true,4),4);
 for(const [rich,v]of [[false,3],[false,4],[true,2],[true,5],[true,'4'],['true',4]])assert.throws(()=>desktopMasterSchema(rich,v));
 assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal=1 AND c.name=N'customer_id'/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal=2 AND c.name=N'currency_code'/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal>0\)=2/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/CONVERT\(varbinary\(max\),i.filter_definition\)/);
});
