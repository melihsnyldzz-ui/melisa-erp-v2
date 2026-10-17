import test from 'node:test';
import assert from 'node:assert/strict';
import {createCustomerContactEditor,customerContactContext,customerContactHtml} from './workCustomerContact.mjs';
import {tradeUuid} from './workTradeModel.mjs';
const card={id:'1',customerCode:'SYNTHETIC-CUSTOMER',customerName:'Sentetik müşteri',fields:{phoneMasked:'00****01'}};
const context=()=>({schemaVersion:'melisa-customer-contact-context.v1',customerId:'1',customerCode:card.customerCode,customerName:card.customerName,revision:'A'.repeat(64),contact:{phone:'0016100000000',city:'İstanbul',country:null}});
const requestId='11111111-1111-4111-8111-111111111111';

test('LAN secure entropy fallback prepares a V4 request and missing entropy sends no POST',async()=>{
 let calls=0;const lanCrypto={getRandomValues:bytes=>bytes.fill(7)};
 const editor=createCustomerContactEditor({read:async()=>context(),requestId:()=>tradeUuid(lanCrypto),write:async(id,body)=>{calls++;assert.match(body.requestId,/^[a-f0-9-]{14}4[a-f0-9-]{3}-[89ab]/);return{context:context(),replayed:false};}});editor.select(card);await editor.open();editor.edit('city','Ankara');await editor.save();assert.equal(calls,1);
 const blocked=createCustomerContactEditor({read:async()=>context(),requestId:()=>tradeUuid({}),write:async()=>{calls++;}});blocked.select(card);await blocked.open();blocked.edit('city','Ankara');await blocked.save();assert.equal(calls,1);assert.equal(blocked.state().status,'ready');assert.equal(blocked.state().pending,null);assert.match(blocked.state().message,/gönderilmedi/);
});

test('editor starts with authorized actual contact values, never the card masked phone',async()=>{
 const editor=createCustomerContactEditor({read:async()=>context(),write:async()=>assert.fail()});editor.select(card);await editor.open();assert.equal(editor.state().draft.phone,'0016100000000');assert.equal(editor.state().draft.country,null);assert.equal(editor.state().changed,false);await editor.save();
 assert.throws(()=>customerContactContext({...context(),contact:{...context().contact,phone:card.fields.phoneMasked}},card));assert.throws(()=>customerContactContext({...context(),customerId:'2'},card));editor.dispose();
});
test('one contact change submits only the three contact fields and original CAS token',async()=>{
 const calls=[],editor=createCustomerContactEditor({requestId:()=>requestId,read:async()=>context(),write:async(id,body)=>{calls.push({id,body});return{context:{...context(),revision:'B'.repeat(64),contact:{phone:body.phone,city:body.city,country:body.country}},replayed:false};}});
 editor.select(card);await editor.open();editor.edit('city','Ankara');await editor.save();assert.equal(calls.length,1);assert.deepEqual(calls[0],{id:'1',body:{requestId,expectedRevision:'A'.repeat(64),phone:'0016100000000',city:'Ankara',country:null}});assert.equal(editor.state().changed,false);assert.match(editor.state().message,/kaydedildi/);await editor.save();assert.equal(calls.length,1);
});
test('double click sends once while a native result is pending',async()=>{
 let finish,calls=0;const editor=createCustomerContactEditor({requestId:()=>requestId,read:async()=>context(),write:async()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});editor.select(card);await editor.open();editor.edit('phone','0016000000001');const saving=editor.save();await editor.save();assert.equal(calls,1);editor.edit('phone','other');assert.equal(editor.state().draft.phone,'0016000000001');finish({context:context(),replayed:false});await saving;
});
test('lost response preserves an immutable exact request for deliberate replay without an automatic second POST',async()=>{
 const calls=[];let generated=0;const editor=createCustomerContactEditor({requestId:()=>{generated++;return requestId;},read:async()=>context(),write:async(id,body)=>{calls.push(body);if(calls.length===1)throw Error('simulated lost response');return{context:{...context(),contact:{...context().contact,city:body.city}},replayed:true};}});editor.select(card);await editor.open();editor.edit('city','Ankara');await editor.save();assert.equal(calls.length,1);assert.equal(editor.state().status,'uncertain');assert(Object.isFrozen(calls[0]));editor.edit('city','İzmir');await editor.save();assert.equal(generated,1);assert.equal(calls.length,2);assert.strictEqual(calls[0],calls[1]);assert.equal(calls[1].city,'Ankara');assert.equal(editor.state().status,'ready');
});
test('stale or unauthorized results do not silently refresh CAS or retry a write',async()=>{
 for(const status of [403,409]){let calls=0;const editor=createCustomerContactEditor({requestId:()=>requestId,read:async()=>context(),write:async()=>{calls++;throw{status};}});editor.select(card);await editor.open();editor.edit('country','Türkiye');await editor.save();assert.equal(editor.state().status,status===409?'stale':'error');assert.equal(editor.state().draft.country,'Türkiye');await editor.save();assert.equal(calls,1);}
});
test('changing the selected card or disposing invalidates late reads and completed write presentation',async()=>{
 let finish;const editor=createCustomerContactEditor({read:async()=>new Promise(resolve=>{finish=resolve;}),write:async()=>assert.fail()});editor.select(card);const loading=editor.open();editor.select({...card,id:'2'});finish(context());await loading;assert.equal(editor.state().context,null);assert.equal(editor.state().card.id,'2');editor.dispose();assert.equal(editor.state().context,null);
});
test('a late POST response never paints another customer or a disposed workspace',async()=>{
 for(const dispose of [false,true]){let finish,notifications=0;const editor=createCustomerContactEditor({requestId:()=>requestId,read:async()=>context(),onChange:()=>notifications++,write:async()=>new Promise(resolve=>{finish=resolve;})});editor.select(card);await editor.open();editor.edit('city','Ankara');const pending=editor.save();const prior=notifications;if(dispose)editor.dispose();else editor.select({...card,id:'2'});finish({context:{...context(),contact:{...context().contact,city:'Ankara'}},replayed:false});await pending;assert.equal(notifications,prior);assert.equal(editor.state().context,null);}
});
test('contact form escapes actual contact text and stays absent for unauthorized viewers',async()=>{
 const editor=createCustomerContactEditor({read:async()=>({...context(),contact:{...context().contact,city:'<şehir> "'} }),write:async()=>assert.fail()});editor.select(card);await editor.open();assert.equal(customerContactHtml(editor,{allowed:false}),'');const html=customerContactHtml(editor,{allowed:true});assert.match(html,/&lt;şehir&gt; &quot;/);assert.doesNotMatch(html,/00\*\*\*\*01|TEST|SQL|migration|PASS/);assert.match(html,/0016100000000/);
});
