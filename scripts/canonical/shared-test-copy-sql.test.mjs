import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedActorPermissions,buildSharedCopyBundle,preservedAggregate,changedFirstOrders} from './shared-test-copy-sql.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {applyRolePermissionDefaults,expandPermissions} from '../../apps/api/src/services/permissionCatalog.js';
test('copy profile permissions match ordinary authenticated user expansion, including non-view writes',()=>{
 const rows=[{permission_key:'sales.draft.write',can_view:0,can_create:1,can_update:1,can_approve:0},{permission_key:'purchase_invoices.manage',can_view:1,can_create:1,can_update:1,can_approve:1}];
 for(const actor of [{id:'15',role:'isolated_test_sales'},{id:'16',role:'isolated_test_ilker'}])assert.deepEqual(sharedActorPermissions(actor,rows),applyRolePermissionDefaults(expandPermissions(rows),actor.role));
 assert.ok(sharedActorPermissions({id:'15',role:'isolated_test_sales'},rows).includes('sales.create'));
 assert.throws(()=>sharedActorPermissions({id:'1',role:'admin'},rows));assert.throws(()=>sharedActorPermissions({id:'15',role:'isolated_test_sales'},[{...rows[0],can_create:'true'}]));
});
test('an unproved or original target cannot produce credentials or SQL install artifacts',()=>{
 assert.throws(()=>buildSharedCopyBundle({identity:{server:'Semih\\MELISADEV',database:'MELISA_ERP_SIRKET_TEST_20260929_01'}}),/SHARED_BUNDLE_IDENTITY/);
 assert.throws(()=>buildSharedCopyBundle({identity:{server:'Semih\\MELISADEV',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_01'},recoveryProof:{status:'FAIL'}}),/SHARED_RAW_RESTORE_PROOF/);
});
test('preserved SQL aggregate includes all 37 FIRST quarantine plus five immutable migration guards',()=>{
 const rows=Array.from({length:37},(_,i)=>({schemaName:'dbo',name:'operation_quarantine_'+String(i).padStart(2,'0'),type_desc:'SQL_TRIGGER',definition:'guard'+i,isDisabled:0,firstInsert:1,firstUpdate:1,firstDelete:1}));
 for(const name of ['immutable_accepted_price_manifest','immutable_accepted_price_products','immutable_accepted_price_values','immutable_operation_quarantine_manifest','immutable_operation_quarantine_holds'])rows.push({schemaName:'erp_migration',name,type_desc:'SQL_TRIGGER',definition:name,isDisabled:0,firstInsert:0,firstUpdate:0,firstDelete:0});
 const mapped='A'.repeat(64),replacements=[{name:'dbo.operation_quarantine_00',afterHash:mapped}];
 const expected=moduleHash([...rows].sort((a,b)=>a.name<b.name?-1:1).map(m=>[m.name,m.name==='operation_quarantine_00'?mapped:moduleHash(m.definition),0,m.firstInsert,m.firstUpdate,m.firstDelete].join('|')).join(';'));
 assert.equal(preservedAggregate(rows,replacements),expected);assert.throws(()=>preservedAggregate(rows.slice(0,37),replacements));
 const changed=structuredClone(rows);changed[0].firstUpdate=0;assert.throws(()=>preservedAggregate(changed,replacements));
});
test('FIRST restoration includes only replaced exact-schema triggers, leaving eight fixture orders untouched',()=>{
 const first={type_desc:'SQL_TRIGGER',firstInsert:1,firstUpdate:1,firstDelete:1};
 const modules=[{...first,schemaName:'dbo',name:'operation_quarantine_products'},...Array.from({length:8},(_,i)=>({...first,schemaName:'final_cutover_fixture_'+i,name:'fixture_quarantine_products'}))];
 assert.deepEqual(changedFirstOrders(modules,[{name:'dbo.operation_quarantine_products'}]),[{name:'dbo.operation_quarantine_products',insert:1,update:1,delete:1}]);
 assert.deepEqual(changedFirstOrders(modules,[{name:'dbo.fixture_quarantine_products'}]),[]);
});
