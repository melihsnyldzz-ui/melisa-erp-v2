import test from 'node:test';
import assert from 'node:assert/strict';
import {isDesktopSupplierCard,desktopSupplierCardId} from './desktopSupplierCard.mjs';
const fixture=()=>({id:'3',supplierCode:'000SUP-TEST',name:'Örnek tedarikçi',phone:'0000000000',city:'TEST',country:'Türkiye',currency:'USD',purchaseDiscountRateExact4:'7.5000',isActive:true,entityId:'4',accounts:[{id:'9',supplierId:'3',entityId:'4',currency:'USD',currentBalanceExact8:'0.00000000'}]});
test('literal supplier identity, agreement discount and separate signed account balances remain exact',()=>{
 const card=fixture();card.accounts.push({id:'10',supplierId:'3',entityId:'4',currency:'TRY',currentBalanceExact8:'-9.00000001'});assert.equal(isDesktopSupplierCard(card,'3'),true);assert.equal(card.phone,'0000000000');assert.equal(card.supplierCode,'000SUP-TEST');assert.equal(card.accounts[1].currentBalanceExact8,'-9.00000001');
 for(const rate of ['0.0000','100.0000'])assert.equal(isDesktopSupplierCard({...fixture(),purchaseDiscountRateExact4:rate},'3'),true);
 assert.equal(isDesktopSupplierCard({...fixture(),phone:null,city:'',country:null,isActive:false},'3'),true);
});
test('unknown or malformed agreement and balance never become zero',()=>{
 for(const rate of [null,0,'7.5','07.5000','100.0001','101.0000','-0.0000','1e1'])assert.equal(isDesktopSupplierCard({...fixture(),purchaseDiscountRateExact4:rate},'3'),false,String(rate));
 for(const amount of [null,0,'0.0000','-0.00000000','01.00000000','1e8','100000000000000000000.00000000']){const card=fixture();card.accounts[0].currentBalanceExact8=amount;assert.equal(isDesktopSupplierCard(card,'3'),false,String(amount));}
 assert.equal(isDesktopSupplierCard({...fixture(),accounts:[]},'3'),false);assert.equal(isDesktopSupplierCard({...fixture(),currency:'EUR'},'3'),false);
});
test('currency accounts must belong to the exact supplier entity and cannot duplicate or hide a customer link',()=>{
 for(const patch of [{supplierId:'8'},{entityId:'5'},{currency:'GBP'},{customerId:'2'}]){const card=fixture();Object.assign(card.accounts[0],patch);assert.equal(isDesktopSupplierCard(card,'3'),false);}
 const duplicate=fixture();duplicate.accounts.push({...duplicate.accounts[0],id:'10'});assert.equal(isDesktopSupplierCard(duplicate,'3'),false);
 const sameId=fixture();sameId.accounts.push({...sameId.accounts[0],currency:'TRY'});assert.equal(isDesktopSupplierCard(sameId,'3'),false);
 assert.equal(isDesktopSupplierCard(fixture(),'4'),false);assert.equal(desktopSupplierCardId('9223372036854775807'),true);assert.equal(desktopSupplierCardId('9223372036854775808'),false);
});
test('strict data objects reject accessors, sparse arrays and undisclosed fields',()=>{
 const card=fixture();Object.defineProperty(card,'purchaseDiscountRateExact4',{get(){throw Error('do not invoke');}});assert.equal(isDesktopSupplierCard(card,'3'),false);
 for(const value of [{...fixture(),extra:true},Object.assign(Object.create({}),fixture()),{...fixture(),name:'\nTedarikçi'},{...fixture(),supplierCode:' '}])assert.equal(isDesktopSupplierCard(value,'3'),false);
 const sparse=fixture();sparse.accounts.length=2;assert.equal(isDesktopSupplierCard(sparse,'3'),false);
 const symbol=fixture();symbol.accounts[0][Symbol('extra')]=true;assert.equal(isDesktopSupplierCard(symbol,'3'),false);
});
