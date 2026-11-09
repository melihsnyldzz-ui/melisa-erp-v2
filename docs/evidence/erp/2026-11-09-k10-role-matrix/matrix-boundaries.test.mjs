// Offline composition check for the documented matrix. No SQL/auth fixture,
// account setup, runtime configuration, network or credential access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SALES_LIMIT_ROLE_KEYS} from '../../../../scripts/desktop-empty/sales-limit-persona-plan.mjs';
import {desktopSalesReadMode} from '../../../../packages/shared/src/desktopSalesReadScope.mjs';
import {desktopWarehousePermissionForOperation} from '../../../../packages/shared/src/desktopWarehouse.mjs';
import {desktopSalesPolicyForUser,desktopCreditAccessForUser} from '../../../../apps/api/src/services/desktopSalesPolicy.mjs';

const user=(code,permissions)=>({id:'101',role:{id:11,code},permissions:[...permissions],userVersion:'0x0000000000000001',roleVersion:'0x0000000000000002'});
const row=(u,kind,limit=null)=>({id:'8',value:JSON.stringify({version:1,people:[{actorId:u.id,roleId:String(u.role.id),roleCode:u.role.code,kind,canChangeSalePrice:false,maxDiscountRateExact4:limit}]}),valueType:'json',active:true,version:'0x0000000000000003'});

test('the current two persona plans provide personal sales, not company approval',()=>{
 for(const [kind,rate] of [['sales','3.0000'],['manager','5.0000']]){
  const u=user(`desktop_${kind}_test`,SALES_LIMIT_ROLE_KEYS[kind]),r=row(u,'sales',rate),p=desktopSalesPolicyForUser(u,r),c=desktopCreditAccessForUser(u,r);
  assert.equal(desktopSalesReadMode(u.permissions),'own');
  assert.equal(p.maxDiscountRateExact4,rate);
  assert.deepEqual([p.canChangeSalePrice,p.canApproveAboveFive,c.canManage,c.canApprove],[false,false,false,false]);
 }
});

test('warehouse-only quantities/cartons have no personal sales or credit authority',()=>{
 const u=user('synthetic_warehouse',['warehouse.view','warehouse.prepare','warehouse.pack']);
 assert.equal(desktopSalesReadMode(u.permissions),null);
 const p=desktopSalesPolicyForUser(u),c=desktopCreditAccessForUser(u);
 assert.deepEqual([p.canChangeSalePrice,p.canApproveAboveFive,c.canManage,c.canApprove],[false,false,false,false]);
 for(const op of ['CHECK','CANCEL','DISPATCH','CREATE_DRAFT'])assert.equal(desktopWarehousePermissionForOperation(op),null);
 assert.deepEqual(['PREPARE','SAVE_CARTONS','READY'].map(desktopWarehousePermissionForOperation),['warehouse.prepare','warehouse.pack','warehouse.pack']);
});

test('an accounting-shaped permission example gives all-sale reads without inferred approval',()=>{
 // A synthetic capability combination, not an approved accounting role grant.
 const u=user('synthetic_accounting',['sales.view','finance.collection','finance.payment','customer.view']);
 assert.equal(desktopSalesReadMode(u.permissions),'all');
 const c=desktopCreditAccessForUser(u);
 assert.deepEqual([c.canManage,c.canApprove],[false,false]);
 assert.equal(desktopSalesPolicyForUser(u).canApproveAboveFive,false);
});

test('explicit company manager and boss policy kinds remain distinct from personal 5%',()=>{
 const u=user('synthetic_company_role',[...SALES_LIMIT_ROLE_KEYS.manager,'customer.edit']);
 const personal=row(u,'sales','5.0000'),manager=row(u,'manager'),boss=row(u,'boss');
 assert.deepEqual([desktopCreditAccessForUser(u,personal).canManage,desktopCreditAccessForUser(u,personal).canApprove],[false,false]);
 assert.deepEqual([desktopCreditAccessForUser(u,manager).canManage,desktopCreditAccessForUser(u,manager).canApprove],[true,true]);
 assert.equal(desktopSalesPolicyForUser(u,manager).canApproveAboveFive,false);
 assert.equal(desktopSalesPolicyForUser(u,boss).canApproveAboveFive,true);
 // Canonical company policy still does not supply the separate all-sale key.
 assert.equal(desktopSalesReadMode(u.permissions),'own');
 assert.throws(()=>desktopSalesPolicyForUser({...u,role:{...u.role,id:12}},manager));
});
