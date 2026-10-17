import test from 'node:test';
import assert from 'node:assert/strict';
import {moneyDisplay} from './moneyDisplay.mjs';
import {accountPresentation,currencyAccountsHtml,accountExact} from './currencyAccountPresentation.mjs';

test('decimal display rounds cents exactly, including carry and values beyond Number precision',()=>{
 for(const [source,shown] of [['0','0,00'],['1.234999999999999999','1,23'],['1.235000000000000000','1,24'],['-1.235','−1,24'],['999.999','1.000,00'],['9007199254740993.125','9.007.199.254.740.993,13'],['9999999999999999999999999999.99999999','10.000.000.000.000.000.000.000.000.000,00']])assert.equal(moneyDisplay(source),shown);
 for(const source of [null,undefined,0,NaN,'1e3','<img>','1,25','1.1234567890123456789'])assert.equal(moneyDisplay(source),'Bilinmiyor');
});
test('sub-cent balances retain exact known direction for both roles while zero and unknown remain distinct',()=>{
 for(const [balance,role,direction] of [['0.00201007','customer','B'],['-0.00201007','customer','A'],['0.00201007','supplier','A'],['-0.00201007','supplier','B']]){
  const row={currency:'USD',balanceExact:balance,amountExact:balance.replace('-',''),debitCreditDirection:direction,reconciled:true,confidence:'source-matched',sourceOpeningBalanceExact:balance,localDeltaExact:'0.00000000'};
  const before=structuredClone(row),p=accountPresentation(row,{role});
  assert.equal(p.known,true);assert.equal(p.amount,'0,00');assert.equal(p.direction,direction);assert.notEqual(p.label,'Borç / alacak yok');
  assert.match(currencyAccountsHtml([row],{role,detail:true}),new RegExp('0,00 USD · '+direction));assert.deepEqual(row,before);
 }
 assert.equal(accountExact('-0.00201007'),'−0,00');assert.equal(accountExact('-0.00000000'),'0,00');
 assert.equal(moneyDisplay('-0.00201007',{absolute:true}),'0,00');
 const row={currency:'USD',balanceExact:'0.00000000',reconciled:true,confidence:'source-matched'};
 assert.equal(accountPresentation(row,{role:'customer'}).direction,'ZERO');
 assert.equal(accountPresentation({...row,balanceExact:null},{role:'customer'}).amount,'Bilinmiyor');
});
