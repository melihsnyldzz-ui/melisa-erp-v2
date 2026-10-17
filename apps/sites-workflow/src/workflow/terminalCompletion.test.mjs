import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {webcrypto} from 'node:crypto';
import {initialOperations,validateSaleStock,stockQuantity} from './demoOperationsModel.js';
const script=readFileSync(new URL('../../public/workflow-terminal.js',import.meta.url),'utf8');
function terminal(storage=new Map(),receipts=[]){const listeners={};const c={crypto:webcrypto,structuredClone,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},basket:[],saleCustomer:'cash',saleFxRate:'',saleStage:'edit',saleMessage:'',current:'home',render(){},document:{addEventListener:(e,f)=>listeners[e]=f},addEventListener(){},MelisaDemoReceipts:{list:()=>receipts}};c.window=c;vm.createContext(c);vm.runInContext(script,c);return c}
test('terminal draft retains customer, quantities, currency rate, discount and review after restart; completed receipt recovers as done',()=>{
 const storage=new Map(),a=terminal(storage);a.basket=[{code:'M-100',qty:6,price:10.5}];a.saleCustomer='eur';a.saleFxRate='0.9';a.MelisaSaleDiscountBps=300;a.saleStage='review';const id=a.MelisaTerminal.save();const b=terminal(storage);assert.equal(b.saleCustomer,'eur');assert.equal(b.basket[0].qty,6);assert.equal(b.saleFxRate,'0.9');assert.equal(b.MelisaSaleDiscountBps,300);assert.equal(b.saleStage,'review');assert.equal(b.MelisaTerminal.id(),id);
 const recovered=terminal(storage,[{id:'SF-1',terminalDraftId:id}]);assert.equal(recovered.saleStage,'done');assert.equal(recovered.MelisaTerminal.last().id,'SF-1');
});
test('another tab changing draft and a failed storage write never silently replace saved work',()=>{
 const storage=new Map(),a=terminal(storage);a.MelisaTerminal.save();const b=terminal(storage);b.basket=[{code:'M-100',qty:2,price:10}];b.MelisaTerminal.save();assert.throws(()=>a.MelisaTerminal.save(),/başka sekmede/);assert.equal(terminal(storage).basket[0].qty,2);
 const c=terminal(storage);c.localStorage.setItem=()=>{throw Error('storage full')};assert.throws(()=>c.MelisaTerminal.save(),/storage full/);
});
test('sale finalization checks current stock including concurrent receipts and duplicate product rows',()=>{
 const s=initialOperations([['M-100','Triko','6',5,10,'Aktif','Takım']]),items=[{code:'M-100',qty:3}];assert.doesNotThrow(()=>validateSaleStock(s,items));const sold=[{items:[{code:'M-100',qty:3}]}];assert.equal(stockQuantity(s,'M-100',sold),2);assert.throws(()=>validateSaleStock(s,items,sold),/yetersiz/);assert.throws(()=>validateSaleStock(s,[...items,...items]),/yetersiz/);assert.throws(()=>validateSaleStock(s,[{code:'M-100',qty:0}]));assert.throws(()=>validateSaleStock(s,[]));
});
import '../../public/workflow-settlement.js';
const ui=readFileSync(new URL('../../public/workflow-settlement-ui.js',import.meta.url),'utf8');
function checkout(fail=false){const storage=new Map(),api=globalThis.MelisaReceiptPreview;const c={structuredClone,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('disk full');storage.set(k,v)}},role:'Satış ekibi',saleStage:'review',saleCustomer:'cash',saleFxRate:'',basket:[{code:'M-100',qty:2,price:10}],navigator:{},render(){},toast(m){c.error=m},document:{addEventListener(){}},addEventListener(){},MelisaReceiptPreview:api,MelisaDemoCustomers:{list:()=>[{id:'cash',name:'Peşin',currency:'USD',active:true}]},MelisaTerminal:{save:()=> 'stable-draft'},MelisaDemoOperations:{validateSale(items,docs){validateSaleStock(initialOperations([['M-100','Triko','6',10,10,'Aktif','Takım']]),items,docs)}}};c.window=c;vm.createContext(c);vm.runInContext(ui,c);return c}
test('retry after receipt write creates one receipt and one stock movement',async()=>{const c=checkout();await c.completePreviewSale();assert.equal(c.saleStage,'done');const first=c.MelisaDemoReceipts.list().filter(r=>r.terminalDraftId==='stable-draft');assert.equal(first.length,1);c.saleStage='review';await c.completePreviewSale();const after=c.MelisaDemoReceipts.list().filter(r=>r.terminalDraftId==='stable-draft');assert.equal(after.length,1);assert.equal(after[0].id,first[0].id)});
test('failed receipt persistence leaves checkout open without a posted receipt',async()=>{const c=checkout(true);await c.completePreviewSale();assert.equal(c.saleStage,'review');assert.equal(c.error,'disk full');assert.equal(c.MelisaDemoReceipts.list().filter(r=>r.terminalDraftId).length,0)});

test('terminal cancellation survives restart and retry without a second sale or stock reversal',async()=>{
 const c=checkout(),api=globalThis.MelisaReceiptPreview;
 const stock=initialOperations([['M-100','Triko','6',10,10,'Aktif','Takım']]);
 await c.completePreviewSale();
 const receipt=c.MelisaDemoReceipts.list().find(r=>r.terminalDraftId==='stable-draft');
 const terminalReceipts=()=>c.MelisaDemoReceipts.list().filter(r=>r.terminalDraftId);
 assert.equal(stockQuantity(stock,'M-100',terminalReceipts()),8);
 c.MelisaDemoReceipts.update(receipt.id,r=>api.collect(r,500,'Nakit','İlker'));
 c.MelisaDemoReceipts.update(receipt.id,r=>api.cancel(r,'Terminal kabul denemesi','İlker'));
 assert.equal(stockQuantity(stock,'M-100',terminalReceipts()),10);
 // Reload the actual receipt persistence script against the same storage.
 vm.runInContext(ui,c);
 const restored=terminalReceipts()[0];
 assert.ok(restored.cancelled);
 assert.equal(api.credit(restored),500);
 assert.equal(restored.payments.length,1);
 assert.throws(()=>c.MelisaDemoReceipts.update(receipt.id,r=>api.cancel(r,'Tekrar iptal','İlker')));
 c.saleStage='review';await c.completePreviewSale();
 assert.equal(c.saleStage,'done');
 assert.equal(terminalReceipts().length,1);
 assert.ok(terminalReceipts()[0].cancelled);
 assert.equal(stockQuantity(stock,'M-100',terminalReceipts()),10);
 assert.equal(api.credit(terminalReceipts()[0]),500);
});
