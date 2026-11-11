import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDesktopDispatchReadiness} from './desktopDispatchReadiness.mjs';
const snapshot=()=>({invoiceId:'12',invoiceState:'draft',workflowState:'CHECKED',lines:[
 {itemId:'1',productId:'5',quantityExact3:'2.000',stockExact3:'4.000',otherReservedExact3:'1.000'},
 {itemId:'2',productId:'9',quantityExact3:'1.000',stockExact3:'3.000',otherReservedExact3:'0.000'}],
 reservations:[{itemId:'1',productId:'5',state:'ACTIVE',quantityExact3:'2.000'},{itemId:'2',productId:'9',state:'ACTIVE',quantityExact3:'1.000'}],
 cartonItems:[{cartonNo:1,itemId:'1',productId:'5',quantityExact3:'1.000'},{cartonNo:2,itemId:'1',productId:'5',quantityExact3:'1.000'},{cartonNo:2,itemId:'2',productId:'9',quantityExact3:'1.000'}]});
test('checked two-line draft requires exactly reserved and packed amounts',()=>assert.equal(assertDesktopDispatchReadiness(snapshot()),true));
test('rejects premature dispatch, inactive reservations, incomplete or excess cartons',()=>{
 for(const change of [s=>{s.workflowState='READY';},s=>{s.invoiceState='finalized';},s=>{s.reservations[0].state='RELEASED';},s=>{s.cartonItems.pop();},s=>{s.cartonItems[0].quantityExact3='2.000';},s=>{s.cartonItems[1].cartonNo=1;}]){const s=snapshot();change(s);assert.throws(()=>assertDesktopDispatchReadiness(s));}
});
test('rejects product substitution and stock reserved by another draft',()=>{
 const a=snapshot();a.cartonItems[0].productId='9';assert.throws(()=>assertDesktopDispatchReadiness(a));
 const b=snapshot();b.lines[0].otherReservedExact3='2.001';assert.throws(()=>assertDesktopDispatchReadiness(b));
 const c=snapshot();delete c.lines[0].otherReservedExact3;assert.throws(()=>assertDesktopDispatchReadiness(c));
});

test('one-line dispatch requires its exact reservation and packed amount',()=>{
 const s=snapshot();s.lines=s.lines.slice(0,1);s.reservations=s.reservations.slice(0,1);s.cartonItems=s.cartonItems.filter(x=>x.itemId==='1');
 assert.equal(assertDesktopDispatchReadiness(s),true);
 for(const change of [v=>v.reservations.push({...v.reservations[0]}),v=>v.cartonItems.pop(),v=>v.lines.push({...v.lines[0],itemId:'3'}),v=>v.lines=[]]){
  const invalid=structuredClone(s);change(invalid);assert.throws(()=>assertDesktopDispatchReadiness(invalid));
 }
 const three=snapshot();three.lines.push({itemId:'3',productId:'10',quantityExact3:'1.000',stockExact3:'3.000',otherReservedExact3:'0.000'});three.reservations.push({itemId:'3',productId:'10',quantityExact3:'1.000',state:'ACTIVE'});three.cartonItems.push({cartonNo:3,itemId:'3',productId:'10',quantityExact3:'1.000'});assert.throws(()=>assertDesktopDispatchReadiness(three));
});
