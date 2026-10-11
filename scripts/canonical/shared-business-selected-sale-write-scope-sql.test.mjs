import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedSaleWriteHarness} from '../../apps/api/src/services/businessSelectedSaleWriteScope.test-fixture.mjs';
import {moduleHash} from './stage4-copy-sql.mjs';
import {assertPreparedBusinessSelectedSaleWriteScope} from './shared-business-selected-sale-write-scope-sql.mjs';

test('selected intent preparation emits owner read only; old begin cannot provide its protected witness',async()=>{
 const h=await selectedSaleWriteHarness(),a=h.artifact,s=a.definition;
 assert.equal(moduleHash(s),a.definitionHash);assert.equal(a.businessWrites,0);assert.equal(a.grants,0);
 assert.match(s,/WITH EXECUTE AS OWNER/);assert.match(s,/<>N'Exclusive'/);assert.match(s,/NOT BETWEEN 1 AND 200/);
 assert.match(s,/JSON_QUERY\(before_state_json,'\$\.selectedSaleIntent'\)/);assert.match(s,/SELECTED_SALE_OWNER_INTENT_REQUIRED/);assert.match(s,/SELECTED_SALE_INTENT_REVISION/);
 assert.doesNotMatch(s,/(@customer_id bigint,@currency nvarchar\(3\),@product_ids_json nvarchar\(max\)) WITH/);
 assert.doesNotMatch(s,/\b(INSERT|UPDATE|DELETE|GRANT|ALTER)\s+(?:dbo\.|ON|TABLE|PROCEDURE)/i);
 assert.throws(()=>assertPreparedBusinessSelectedSaleWriteScope(structuredClone(a),h.copy),{code:'SELECTED_SALE_SERVER_WRITE_ARTIFACT_REQUIRED'});
});
