import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import express from '../../apps/api/node_modules/express/index.js';
import {applyRolePermissionDefaults, expandPermissions} from '../../apps/api/src/services/permissionCatalog.js';
import {applyStockCountAdjustment} from '../../apps/api/src/services/movementService.js';

test('product management never implies a stock adjustment grant', () => {
  for (const key of ['products.manage', 'product.update', 'product.edit']) {
    const permissions=expandPermissions([{permission_key:key,can_view:true,can_create:true,can_update:true,can_approve:true}]);
    assert.ok(!permissions.includes('stock.adjust'));
  }
});

test('stock adjustment requires update or approve on its own permission row', () => {
  for (const flags of [{}, {can_view:true}, {can_create:true}, {can_delete:true}]) {
    assert.ok(!expandPermissions([{permission_key:'stock.adjust',...flags}]).includes('stock.adjust'));
  }
  for (const flags of [{can_update:true}, {can_approve:true}]) {
    assert.ok(expandPermissions([{permission_key:'stock.adjust',...flags}]).includes('stock.adjust'));
  }
});

test('full-access role defaults cannot manufacture the explicit stock permission', () => {
  for(const role of ['admin','owner_manager','owner_partner','accounting']) {
    assert.ok(!applyRolePermissionDefaults(['product.view','product.edit'],role).includes('stock.adjust'));
    assert.ok(applyRolePermissionDefaults(['stock.adjust'],role).includes('stock.adjust'));
  }
});

test('direct service calls reject missing or partial permissions before database access', async () => {
  for(const actor of [null,{}, {permissions:[]}, {permissions:['product.view','product.edit']}, {permissions:['stock.adjust']}, {permissions:'product.view,stock.adjust'}]) {
    await assert.rejects(applyStockCountAdjustment({},actor),{code:'AUTH_PERMISSION_DENIED',statusCode:403});
  }
});

async function registeredRoute(permissions, token='valid') {
  const routeSource=fs.readFileSync(new URL('../../apps/api/src/routes/movementRoutes.js',import.meta.url),'utf8');
  const authSource=fs.readFileSync(new URL('../../apps/api/src/middleware/authMiddleware.js',import.meta.url),'utf8');
  const context=vm.createContext({});
  const synthetic=values=>new vm.SyntheticModule(Object.keys(values),function(){for(const [name,value] of Object.entries(values))this.setExport(name,value);},{context});
  let reached=0;
  const controllerNames=routeSource.match(/import\s*\{([^}]+)\}\s*from '\.\.\/controllers\/movementController.js'/)[1].split(',').map(n=>n.trim()).filter(Boolean);
  const auth=new vm.SourceTextModule(authSource,{context});
  await auth.link(()=>synthetic({verifyAccessToken(value){if(value!==token)throw Object.assign(new Error('Invalid token'),{statusCode:401});return {sub:'synthetic'};},async getUserById(){return {id:1,permissions};}}));
  const route=new vm.SourceTextModule(routeSource,{context});
  await route.link(specifier=>{
    if(specifier==='express')return synthetic({Router:express.Router});
    if(specifier.endsWith('authMiddleware.js'))return auth;
    if(specifier.endsWith('movementController.js'))return synthetic(Object.fromEntries(controllerNames.map(name=>[name,()=>{reached++;}])));
    throw new Error('Unreviewed import: '+specifier);
  });
  await route.evaluate();
  const handlers=route.namespace.movementRoutes.stack.find(layer=>layer.route?.path==='/stock-count/adjust').route.stack.map(layer=>layer.handle);
  return {async invoke(header){let error;let cursor=0;const req={get:()=>header};const next=async failure=>{if(failure){error=failure;return;}const handler=handlers[cursor++];if(handler)await handler(req,{},next);};await next();return {reached,status:error?.statusCode||200,code:error?.code};}};
}

for(const [name,permissions,status] of [
  ['view-only',['product.view'],403],
  ['product-editor',['product.view','product.edit'],403],
  ['adjust-without-view',['stock.adjust'],403],
  ['explicit-counter',['product.view','stock.adjust'],200],
])test(`registered stock route enforces ${name} permission set`,async()=>{
  const route=await registeredRoute(permissions);const result=await route.invoke('Bearer valid');
  assert.equal(result.status,status);assert.equal(result.reached,status===200?1:0);
});

test('registered stock route rejects missing and invalid authentication',async()=>{
  const route=await registeredRoute(['product.view','stock.adjust']);
  for(const header of [undefined,'Bearer invalid']) {const result=await route.invoke(header);assert.equal(result.status,401);assert.equal(result.reached,0);}
});
