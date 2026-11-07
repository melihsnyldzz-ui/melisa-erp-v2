import test from 'node:test';import assert from 'node:assert/strict';import {desktopMasterSchema,desktopMasterV5Schema,desktopMasterV6Schema,DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL} from './desktopMasterVersion.mjs';
import {getDesktopMasterV6GuardSql} from './desktopGoodsV6Guard.mjs';
test('old profiles remain exact and V4 is explicit; guard checks ordered customer/currency key and exact filter',()=>{
 assert.equal(desktopMasterSchema(false),2);assert.equal(desktopMasterSchema(true),3);assert.equal(desktopMasterSchema(true,4),4);
 for(const [rich,v]of [[false,3],[false,4],[true,2],[true,5],[true,'4'],['true',4]])assert.throws(()=>desktopMasterSchema(rich,v));
 assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal=1 AND c.name=N'customer_id'/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal=2 AND c.name=N'currency_code'/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/k.key_ordinal>0\)=2/);assert.match(DESKTOP_MASTER_V4_SCHEMA_GUARD_SQL,/CONVERT\(varbinary\(max\),i.filter_definition\)/);
});
test('V6 is an explicit rich profile and cannot alter older selectors',()=>{assert.equal(desktopMasterV5Schema(true,5),5);assert.equal(desktopMasterV6Schema(true,6),6);for(const [rich,version] of [[false,6],[true,'6'],[true,5.1]])assert.throws(()=>desktopMasterV6Schema(rich,version));assert.throws(()=>desktopMasterSchema(true,6));assert.throws(()=>desktopMasterV5Schema(true,6));});
test('V6 fixed fragment checks candidate schema and effective permissions without exposing a success result',()=>{const sql=getDesktopMasterV6GuardSql();assert.match(sql,/DESKTOP_GOODS_V6_SCHEMA_REJECTED/);assert.match(sql,/DESKTOP_WRITE_OBJECT_PERMISSION_REJECTED/);assert.match(sql,/schema_version=6/);assert.doesNotMatch(sql,/SELECT 1 AS ok/i);});
