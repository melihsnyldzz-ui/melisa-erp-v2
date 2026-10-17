import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('payment account client binds exact supplier/source to GET and forwards cancellation options',async()=>{
 const calls=[],context=vm.createContext({}),module=new vm.SourceTextModule(await readFile(new URL('./financeApi.js',import.meta.url),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['get','post','patch'],function(){
  for(const method of ['get','post','patch'])this.setExport(method,(...args)=>{calls.push({method,args});return Promise.resolve({success:true});});
 },{context}));await module.evaluate();
 const options={signal:new AbortController().signal};await module.namespace.fetchSupplierPaymentAccounts('9007199254740993','SYNTHETIC',options);
 assert.equal(calls[0].method,'get');assert.equal(calls[0].args[0],'/api/supplier-payments/accounts');
 assert.equal(calls[0].args[1].supplierId,'9007199254740993');assert.equal(calls[0].args[1].source,'SYNTHETIC');assert.equal(calls[0].args[2],options);
 for(const id of [1,'0','01','9223372036854775808','1/write'])assert.throws(()=>module.namespace.fetchSupplierPaymentAccounts(id,'SYNTHETIC'));
 assert.equal(calls.length,1);
});
test('payment compensation client retains original bigint, exact legs and a single request on failure',async()=>{
 const calls=[],context=vm.createContext({structuredClone}),module=new vm.SourceTextModule(await readFile(new URL('./financeApi.js',import.meta.url),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['get','post','patch'],function(){for(const method of ['get','post','patch'])this.setExport(method,(...args)=>{calls.push(args);return Promise.reject(Error('fixture failure'));});},{context}));await module.evaluate();
 const body={source:'SYNTHETIC',supplierId:'8',requestId:'payment-inverse-1',eventDate:'2026-09-24',reason:'fixture',legs:[{paidAmount:'12345678901234.1234'}]};
 await assert.rejects(module.namespace.compensateSupplierPayment('9007199254740993',body));
 assert.equal(calls[0][0],'/api/supplier-payments/9007199254740993/compensate');assert.equal(calls[0][1].legs[0].paidAmount,body.legs[0].paidAmount);
 assert.throws(()=>module.namespace.compensateSupplierPayment('1',{...body,compensatesPaymentId:'2'}));assert.equal(calls.length,1);
});

test('compensation client preserves exact original ID and amount; excludes a second body identity and automatic retry',async()=>{
 const calls=[],context=vm.createContext({structuredClone}),module=new vm.SourceTextModule(await readFile(new URL('./financeApi.js',import.meta.url),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['get','post','patch'],function(){
  for(const method of ['get','post','patch'])this.setExport(method,(...args)=>{calls.push({method,args});return Promise.reject(Error('synthetic unavailable'));});
 },{context}));await module.evaluate();
 const body={source:'SYNTHETIC',requestId:'transfer-inverse-1',fromAccountId:'2',toAccountId:'3',currency:'TRY',amount:'12345678901234.1234',eventDate:'2026-09-24',reason:'SYNTHETIC correction'};
 await assert.rejects(module.namespace.compensateFinanceTransfer('9007199254740993',body),/synthetic unavailable/);
 assert.equal(calls.length,1);assert.equal(calls[0].method,'post');assert.equal(calls[0].args[0],'/api/finance/transfers/9007199254740993/compensate');
 assert.equal(calls[0].args[1].amount,body.amount);assert.notEqual(calls[0].args[1],body);
 for(const id of [1,'0','01','9223372036854775808','1/write'])assert.throws(()=>module.namespace.compensateFinanceTransfer(id,body));
 for(const patch of [{compensatesTransferId:'4'},{reason:''},{description:'injected'}])assert.throws(()=>module.namespace.compensateFinanceTransfer('1',{...body,...patch}));
 assert.equal(calls.length,1);
});

