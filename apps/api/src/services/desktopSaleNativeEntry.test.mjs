import test from 'node:test';import assert from 'node:assert/strict';import {createSalesDraft,finalizeSalesInvoice} from './invoiceDraftService.js';
test('a caller-supplied desktop flag cannot open either native invoice entry',async()=>{
 let requests=0;const context={desktopNativeV1:true,transaction:{},pool:{},sqlDriver:{Request:class{constructor(){requests++;}}}};
 await assert.rejects(createSalesDraft({customerId:2,items:[{productId:5,quantity:1,unitPrice:1}]},{id:'8'},context),e=>['SQL_WRITE_TARGET_INVALID','SQL_WRITE_DISABLED'].includes(e.code));
 await assert.rejects(finalizeSalesInvoice(12,{id:'8'},context),e=>['SQL_WRITE_TARGET_INVALID','SQL_WRITE_DISABLED'].includes(e.code));assert.equal(requests,0);
 context.desktopPrivateSale=true;
 await assert.rejects(createSalesDraft({customerId:2,items:[{productId:5,quantity:1,unitPrice:1}]},{id:'8'},context),/DESKTOP_PRIVATE_SALE_REJECTED/);
 await assert.rejects(finalizeSalesInvoice(12,{id:'8'},context),/DESKTOP_PRIVATE_SALE_REJECTED/);assert.equal(requests,0);
});
