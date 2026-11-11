import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareDesktopSaleCancellation} from './desktopSaleCancellationPlan.mjs';
const fixture=()=>({
 invoice:{id:'13',customerId:'2',entityId:'2',accountId:'7',currency:'EUR',accountCurrency:'USD',customerCurrency:'TRY',totalExact4:'1.1640',accountAmountExact4:'1.2804',amountTryExact4:'51.2160',state:'FINALIZED',workflowState:'COMPLETED',version:'0x0000000000000013'},
 customer:{id:'2',entityId:'2',currency:'TRY',balanceExact4:'104.3200'},account:{id:'7',customerId:'2',entityId:'2',currency:'USD',balanceExact8:'2.73540000'},
 items:[{id:'21',productId:'10',quantityExact3:'1.000',stockBeforeExact3:'7.000',unitCostTryExact4:'8.0000'},{id:'22',productId:'11',quantityExact3:'1.000',stockBeforeExact3:'7.000',unitCostTryExact4:'8.0000'}],
 stockMovements:[{id:'31',invoiceId:'13',productId:'10',type:'out',quantityInExact3:'0.000',quantityOutExact3:'1.000',amountTryExact4:'25.6080',unitCostTryExact4:'8.0000'},{id:'32',invoiceId:'13',productId:'11',type:'out',quantityInExact3:'0.000',quantityOutExact3:'1.000',amountTryExact4:'25.6080',unitCostTryExact4:'8.0000'}],
 customerMovements:[{id:'8',invoiceId:'13',customerId:'2',entityId:'2',accountId:'7',type:'sales_invoice',currency:'EUR',accountCurrency:'USD',amountExact4:'1.1640',accountAmountExact4:'1.2804',balanceEffectExact4:'1.2804',amountTryExact4:'51.2160'}],
 reservations:[{itemId:'21',productId:'10',quantityExact3:'1.000',state:'DISPATCHED'},{itemId:'22',productId:'11',quantityExact3:'1.000',state:'DISPATCHED'}],linkedFinanceRows:'0',returnRows:'0',exportRows:'0',reason:'Sentetik ters etki denemesi'
});
test('discounted EUR document reverses its actual posted TRY amounts and only selected USD account',()=>{
 const raw=fixture(),before=structuredClone(raw),p=prepareDesktopSaleCancellation(raw);assert.deepEqual(raw,before);
 assert.deepEqual(p.stock.map(v=>[v.stockAfterExact3,v.amountTryExact4]),[['8.000','-25.6080'],['8.000','-25.6080']]);
 assert.equal(p.accountAfterExact8,'1.45500000');assert.equal(p.customerAfterExact4,'104.3200');assert.equal(p.preserveLegacyBalance,true);
 assert.equal(p.customerMovement.balanceEffectExact4,'-1.2804');assert.equal(p.customerMovement.amountTryExact4,'51.2160');assert.equal(p.customerCurrency,'TRY');assert(Object.isFrozen(p));assert(Object.isFrozen(p.stock[0]));
});

test('one-product cancellation reverses exactly its saved stock and selected-account posting',()=>{
 const s=fixture();s.items.pop();s.stockMovements.pop();s.reservations.pop();
 Object.assign(s.invoice,{totalExact4:'0.5820',accountAmountExact4:'0.6402',amountTryExact4:'25.6080'});
 Object.assign(s.customerMovements[0],{amountExact4:'0.5820',accountAmountExact4:'0.6402',balanceEffectExact4:'0.6402',amountTryExact4:'25.6080'});
 const before=structuredClone(s),p=prepareDesktopSaleCancellation(s);
 assert.deepEqual(s,before);assert.equal(p.stock.length,1);assert.equal(p.stock[0].stockAfterExact3,'8.000');
 assert.equal(p.stock[0].amountTryExact4,'-25.6080');assert.equal(p.accountAfterExact8,'2.09520000');assert.equal(p.customerAfterExact4,'104.3200');
 for(const alter of [v=>v.items=[],v=>v.stockMovements=[],v=>v.reservations=[],v=>v.items.push(structuredClone(v.items[0]),structuredClone(v.items[0]))]){const invalid=structuredClone(s);alter(invalid);assert.throws(()=>prepareDesktopSaleCancellation(invalid));}
});
test('TRY account reverses legacy and account balances by identical net document amount',()=>{
 const s=fixture();Object.assign(s.invoice,{currency:'TRY',accountCurrency:'TRY',accountId:'2',totalExact4:'23.2800',accountAmountExact4:'23.2800',amountTryExact4:'23.2800'});Object.assign(s.account,{id:'2',currency:'TRY',balanceExact8:'104.32000000'});Object.assign(s.customerMovements[0],{accountId:'2',currency:'TRY',accountCurrency:'TRY',amountExact4:'23.2800',accountAmountExact4:'23.2800',balanceEffectExact4:'23.2800',amountTryExact4:'23.2800'});for(const m of s.stockMovements)m.amountTryExact4='11.6400';
 const p=prepareDesktopSaleCancellation(s);assert.equal(p.accountAfterExact8,'81.04000000');assert.equal(p.customerAfterExact4,'81.0400');assert.equal(p.preserveLegacyBalance,false);
});
test('same USD document/account and TRY document/EUR account use saved amounts without repricing',()=>{
 for(const mode of ['same-usd','try-eur']){const s=fixture(),same=mode==='same-usd';Object.assign(s.invoice,{currency:same?'USD':'TRY',accountCurrency:same?'USD':'EUR',totalExact4:same?'1.4550':'23.2800',accountAmountExact4:same?'1.4550':'0.5291',amountTryExact4:same?'58.2000':'23.2800'});s.account.currency=s.invoice.accountCurrency;for(const m of s.stockMovements)m.amountTryExact4=same?'29.1000':'11.6400';Object.assign(s.customerMovements[0],{currency:s.invoice.currency,accountCurrency:s.invoice.accountCurrency,amountExact4:s.invoice.totalExact4,accountAmountExact4:s.invoice.accountAmountExact4,balanceEffectExact4:s.invoice.accountAmountExact4,amountTryExact4:s.invoice.amountTryExact4});const p=prepareDesktopSaleCancellation(s);assert.equal(p.customerAfterExact4,'104.3200');assert.equal(p.accountAfterExact8,same?'1.28040000':'2.20630000');}
});
test('stored rounded per-line posting vector is preserved exactly, including a zero rounded line',()=>{
 const s=fixture();s.stockMovements[0].amountTryExact4='0.0000';s.stockMovements[1].amountTryExact4='51.2160';const p=prepareDesktopSaleCancellation(s);assert.deepEqual(p.stock.map(v=>v.amountTryExact4),['0.0000','-51.2160']);
});
test('rejects missing, duplicate, changed, foreign or already reversed posting evidence',()=>{
 const changes=[s=>s.stockMovements.pop(),s=>s.stockMovements[1].id='31',s=>s.stockMovements[1].productId='10',s=>s.stockMovements[0].invoiceId='12',s=>s.stockMovements[0].amountTryExact4='26.4000',s=>s.stockMovements[0].quantityOutExact3='2.000',s=>s.stockMovements[0].unitCostTryExact4='9.0000',s=>s.customerMovements.push(structuredClone(s.customerMovements[0])),s=>s.customerMovements[0].balanceEffectExact4='1.1640',s=>s.customerMovements[0].accountId='6',s=>s.customerMovements[0].type='sales_invoice_cancel',s=>s.reservations[0].state='ACTIVE',s=>s.reservations[1].itemId='21',s=>s.account.currency='EUR',s=>s.customer.entityId='9',s=>s.invoice.state='CANCELLED',s=>s.invoice.workflowState='DRAFT',s=>s.invoice.version='0x13',s=>s.items[1].productId='10',s=>s.invoice.totalExact4='0.0000',s=>s.linkedFinanceRows='1',s=>s.returnRows='1',s=>s.exportRows='1'];
 for(const change of changes){const s=fixture();change(s);assert.throws(()=>prepareDesktopSaleCancellation(s),/UNVERIFIED/);}
});
test('enforces canonical decimals, required reason, own data fields and SQL overflow limits',()=>{
 for(const reason of ['', '  x','Valid\nreason','x'.repeat(251)]){const s=fixture();s.reason=reason;assert.throws(()=>prepareDesktopSaleCancellation(s));}
 const one=fixture();one.reason='x';assert.equal(prepareDesktopSaleCancellation(one).reason,'x');
 for(const value of ['7','07.000','7e0','NaN','-0.000',7,null,'999999999999999.999']){const s=fixture();s.items[0].stockBeforeExact3=value;assert.throws(()=>prepareDesktopSaleCancellation(s));}
 const extra=fixture();extra.canCancel=true;assert.throws(()=>prepareDesktopSaleCancellation(extra));
 const accessor=fixture();Object.defineProperty(accessor.account,'balanceExact8',{enumerable:true,get(){throw Error('GETTER_CALLED');}});assert.throws(()=>prepareDesktopSaleCancellation(accessor),/UNVERIFIED/);
 const sparse=fixture();delete sparse.items[0];assert.throws(()=>prepareDesktopSaleCancellation(sparse),/UNVERIFIED/);
 const inherited=fixture();Object.setPrototypeOf(inherited.items,{map(){throw Error('INHERITED_MAP_CALLED');}});assert.throws(()=>prepareDesktopSaleCancellation(inherited),/UNVERIFIED/);
 const wrongMirror=fixture();wrongMirror.invoice.customerCurrency='USD';wrongMirror.customer.currency='USD';assert.throws(()=>prepareDesktopSaleCancellation(wrongMirror),/UNVERIFIED/);
});
test('supports negative current balances and exact sub-cent account balances without floating-point loss',()=>{
 const s=fixture();s.account.balanceExact8='-0.00000001';s.customer.balanceExact4='-0.0001';s.items[0].stockBeforeExact3='-0.001';const p=prepareDesktopSaleCancellation(s);assert.equal(p.accountAfterExact8,'-1.28040001');assert.equal(p.customerAfterExact4,'-0.0001');assert.equal(p.stock[0].stockAfterExact3,'0.999');
});
