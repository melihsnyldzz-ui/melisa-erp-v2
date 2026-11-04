import test from 'node:test';import assert from 'node:assert/strict';
import {cleanContactInput,cleanContactContext,createCleanContactService} from './cleanContactService.mjs';
const uuid='c8cd6b99-652f-4ec1-a8fd-f92bd7122442',body={requestId:uuid,expectedRevision:'a'.repeat(64),phone:null,city:'Örnek Şehir',country:''};
test('B7 shared contact validator keeps null/empty distinct and rejects commercial fields',()=>{
 const p=cleanContactInput('supplier','1',body);assert.equal(p.kind,'supplier');assert.equal(p.entityId,'1');assert.equal(p.phone,null);assert.equal(p.country,'');assert.equal(p.expectedRevision,'A'.repeat(64));
 for(const change of [{balance:0},{name:'other'},{phone:'0**7'},{city:'A\nB'},{phone:'1'.repeat(41)},{requestId:'bad'}])assert.throws(()=>cleanContactInput('customer','1',{...body,...change}));
 for(const [kind,id]of [['party','1'],['customer','5'],['supplier','13373']])assert.throws(()=>cleanContactInput(kind,id,body));
});
test('B7 native context keeps customer and supplier identity namespaces separate',()=>{
 const raw={schemaVersion:'melisa-supplier-contact-context.v1',entityId:'1',code:'ORNEK-T01',name:'Örnek Tedarikçi',revision:'B'.repeat(64),copyId:'e662fd94-d797-4b3b-938a-d143ad758b67',sealHash:'C'.repeat(64),contact:{phone:null,city:null,country:''}};
 const c=cleanContactContext(raw,'supplier','1');assert.equal(c.supplierCode,'ORNEK-T01');assert.equal(c.supplierId,'1');assert.equal(c.customerId,undefined);
 assert.throws(()=>cleanContactContext(raw,'customer','1'));assert.throws(()=>cleanContactContext({...raw,entityId:'2'},'supplier','1'));assert.throws(()=>cleanContactContext({...raw,copyId:'00000000-0000-4000-8000-000000000000'},'supplier','1'));
});
test('B7 unsupported actor, scope or missing edit permission never resolves SQL dependencies',async()=>{
 let opened=0;const s=createCleanContactService({dependencies:async()=>{opened++;throw Error('Must not run');}}),a={id:10018,username:'semih',role:{id:28,code:'clean_test_administrator'},permissions:['customer.view','customer.edit','supplier.view','supplier.edit']};
 await assert.rejects(()=>s.update('customer','1',body,{...a,id:18}),{statusCode:403});await assert.rejects(()=>s.context('supplier','1',{...a,permissions:['supplier.view']}),{statusCode:403});await assert.rejects(()=>s.update('supplier','5',body,a),{statusCode:403});assert.equal(opened,0);
});
