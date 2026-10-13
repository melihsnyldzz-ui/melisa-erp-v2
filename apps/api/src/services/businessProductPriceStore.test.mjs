import test from 'node:test';
import assert from 'node:assert/strict';
import {createBusinessProductPriceStore,businessPriceProcedureRow} from './businessProductPriceStore.mjs';
import {businessProductPriceFixture} from './businessProductPrice.test-fixture.mjs';
import {getRegisteredBusinessProductPriceRevision} from '../../../../scripts/canonical/shared-business-product-price-bootstrap.mjs';

test('unregistered runtime fields and admin JWT cannot mint a price writer or start SQL',async()=>{
 const {copy,actor}=businessProductPriceFixture(),events=[];
 assert.equal(getRegisteredBusinessProductPriceRevision(copy),null);
 const sql={Transaction:class{constructor(){events.push('transaction');}},Request:class{constructor(){events.push('request');}},ISOLATION_LEVEL:{SERIALIZABLE:4}};
 const store=createBusinessProductPriceStore({getRuntime:async()=>({copyContext:copy,pool:{},sql,canEdit:true,registered:true,businessProductPriceRevision:{canEdit:true}})});
 await assert.rejects(()=>store.withProductPrice({productId:'444',actor:{...actor,isAdmin:true},write:true},()=>{events.push('callback');}),{statusCode:503});
 assert.deepEqual(events,[]);
});

test('foreign cloned profile and noncanonical product/operation inputs fail before SQL',async()=>{
 const {copy,actor}=businessProductPriceFixture();let starts=0;
 const runtime={copyContext:structuredClone(copy),pool:{},sql:{Transaction:class{constructor(){starts++;}}}};
 const store=createBusinessProductPriceStore({getRuntime:async()=>runtime});
 await assert.rejects(()=>store.withProductPrice({productId:'444',actor},()=>{}),{code:'ISOLATED_COPY_SERVER_CONTEXT_REQUIRED'});
 runtime.copyContext=copy;
 for(const options of [{productId:'0444',actor},{productId:'9223372036854775808',actor},{productId:444,actor},{productId:'444',actor,write:'true'}])await assert.rejects(()=>store.withProductPrice(options,()=>{}),{statusCode:503});
 assert.equal(starts,0);
});

test('procedure result locates one exact context set and rejects duplicate, unknown proof or extra columns',()=>{
 const row={context_json:'{}',actor_json:'{}',replayed:false,sessionId:91,transactionId:'92',readerDefinitionHash:'A'.repeat(64)};
 assert.equal(businessPriceProcedureRow({recordsets:[[row]]}),row);
 assert.equal(businessPriceProcedureRow({recordsets:[[],[row],[]],recordset:[]}),row);
 for(const result of [{recordsets:[]},{recordsets:[[row],[row]]},{recordsets:[[row,row]]},{recordsets:[[{proof_json:'unverified'}],[row]]},{recordsets:[[{...row,canEdit:true}]]},{recordset:[row]}])assert.throws(()=>businessPriceProcedureRow(result),{statusCode:503});
});
