import test from 'node:test';
import assert from 'node:assert/strict';
import {canOperateDailyFlow} from './testDailyService.mjs';

test('named Ilker fixture keeps existing TEST access',()=>{
 assert.equal(canOperateDailyFlow({id:16},'purchase'),true);
 assert.equal(canOperateDailyFlow({id:16},'count-cancel'),true);
});

test('verified admin needs the permission for each flow',()=>{
 const admin={id:1,role:{code:'admin'},permissions:['purchase.finalize','sales.cancel','finance.collection','stock.adjust','purchase.cancel']};
 for(const flow of ['purchase','sales','fx','count','count-cancel','return-cancel'])
  assert.equal(canOperateDailyFlow(admin,flow),true,flow);
 assert.equal(canOperateDailyFlow({...admin,permissions:['purchase.finalize']},'fx'),false);
 assert.equal(canOperateDailyFlow({...admin,role:{code:'salesperson'}},'purchase'),false);
 assert.equal(canOperateDailyFlow({...admin,id:999},'purchase'),false);
 assert.equal(canOperateDailyFlow({id:15,role:{code:'salesperson'},permissions:admin.permissions},'purchase'),false);
 assert.equal(canOperateDailyFlow(null,'purchase'),false);
});
