import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseStatusMutationSucceeded} from './invoiceDraftService.js';

test('purchase header OUTPUT count succeeds despite trigger zero/multiple row-count messages or NOCOUNT',()=>{
 for(const rowsAffected of [[0,1],[2,1],[],undefined]){
  assert.equal(purchaseStatusMutationSucceeded({rowsAffected,recordset:[{purchaseStatusRows:1}]}),true);
 }
 assert.equal(purchaseStatusMutationSucceeded({rowsAffected:[0],recordset:[{purchaseStatusRows:'1'}]}),true);
});
test('lost header UPDATE or missing explicit count cannot be mistaken for trigger success',()=>{
 for(const result of [{rowsAffected:[1],recordset:[{purchaseStatusRows:0}]},{rowsAffected:[1]},null,{recordset:[]},{recordset:[{purchaseStatusRows:2}]},{recordset:[{purchaseStatusRows:null}]},{recordset:[{purchaseStatusRows:true}]},{recordset:[{purchaseStatusRows:'1.0'}]},{recordset:[{purchaseStatusRows:1},{purchaseStatusRows:1}]}]){
  assert.equal(purchaseStatusMutationSucceeded(result),false);
 }
});
