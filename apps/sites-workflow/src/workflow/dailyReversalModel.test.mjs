import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyDraftCanReverse,dailyDraftKindLabel,dailyDraftStateLabel} from './dailyReversalModel.mjs';
test('approved batch counts never offer the unsupported single-movement reversal',()=>{
 assert.equal(dailyDraftCanReverse({state:'approved',kind:'count',payload:{lines:[{}]},result:{lines:[{movementId:3}]}}),false);
 assert.equal(dailyDraftCanReverse({state:'approved',kind:'count',payload:{},result:{movementId:3}}),true);
 assert.equal(dailyDraftCanReverse({state:'approved',kind:'count',payload:{},result:{movementCreated:false}}),true);
 assert.equal(dailyDraftCanReverse({state:'pending',kind:'invoice-return'}),false);
 assert.equal(dailyDraftCanReverse({state:'approved',kind:'invoice-return'}),true);
 assert.equal(dailyDraftKindLabel('count'),'Sayım');assert.equal(dailyDraftStateLabel('approved'),'Tamamlandı');
});
