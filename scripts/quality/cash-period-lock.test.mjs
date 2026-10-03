import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const operations=[
  ['openCashSession',{drawerId:1,businessDate:'2026-09-09',counts:{}}],
  ['createCashExpense',{sessionId:1,categoryId:1,currency:'TRY',amount:5,description:'test'}],
  ['createCashTransfer',{sessionId:1,currency:'USD',amount:5,direction:'main_to_drawer'}],
  ['closeCashSession',{sessionId:1,counts:{},closingNote:'test'}],
];

async function loadService({enabled=true,through='2026-09-09'}={}) {
  const context=vm.createContext({Date,Number,Map,Set});
  const synthetic=values=>new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});
  const calls=[];
  class Transaction {async begin(){calls.push('begin');}async rollback(){calls.push('rollback');}async commit(){throw new Error('Unexpected commit');}}
  class Request {
    constructor(transaction){this.transaction=transaction;}
    input(){return this;}
    async query(statement){
      if(statement.includes('FROM dbo.system_settings')){assert.ok(this.transaction instanceof Transaction);calls.push('period-read');return {recordset:[{setting_key:'periodLockEnabled',setting_value:String(enabled)},{setting_key:'periodLockedThroughDate',setting_value:through}]};}
      if(/\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?dbo\./i.test(statement)){calls.push('write-attempt');throw Object.assign(new Error('Stop before SQL mutation'),{code:'TEST_WRITE_BOUNDARY'});}
      if(statement.includes('OBJECT_ID'))return {recordset:[{table:1}]};
      if(statement.includes('FROM dbo.finance_accounts'))return {recordset:[{id:9,current_balance:100}]};
      if(statement.includes('FROM dbo.cash_drawer_accounts cda'))return {recordset:['TRY','USD','EUR'].map((currency_code,index)=>({currency_code,finance_account_id:index+1,current_balance:0}))};
      if(statement.includes('AS expected_amount'))return {recordset:[]};
      if(statement.includes('openBusinessDate'))return {recordset:[]};
      if(statement.includes('FROM dbo.cash_sessions'))return {recordset:[{id:1,drawer_id:1,business_date:new Date('2026-09-09T00:00:00Z'),finance_account_id:1,category_name:'Test'}]};
      throw new Error('Unreviewed query');
    }
  }
  const driver={Transaction,Request,BigInt:'bigint',Date:'date',NVarChar:()=>'',Decimal:()=>''};
  const period=new vm.SourceTextModule(fs.readFileSync(new URL('../../apps/api/src/services/periodLockService.js',import.meta.url),'utf8'),{context});
  await period.link(()=>{throw new Error('Unexpected period import');});
  const service=new vm.SourceTextModule(fs.readFileSync(new URL('../../apps/api/src/services/cashRegisterService.js',import.meta.url),'utf8'),{context});
  await service.link(specifier=>{
    if(specifier==='mssql')return synthetic({default:driver});
    if(specifier.endsWith('/database.js'))return synthetic({getSqlPool:async()=>({request:()=>new Request()}),getSqlDriver:()=>driver});
    if(specifier.endsWith('/periodLockService.js'))return period;
    if(specifier.endsWith('/writeGuardService.js'))return synthetic({assertMelisaWriteEnabled(){}});
    if(specifier.endsWith('/auditService.js'))return synthetic({writeAuditLog(){throw new Error('Unexpected audit write');}});
    throw new Error('Unreviewed import '+specifier);
  });
  await service.evaluate();return {service:service.namespace,calls};
}

for(const [name,payload] of operations){
  test(`${name} rejects the locked business date within its transaction before writes`,async()=>{
    const {service,calls}=await loadService();
    await assert.rejects(service[name](payload,{id:1}),{code:'ACCOUNTING_PERIOD_LOCKED',statusCode:409});
    assert.deepEqual(calls,['begin','period-read','rollback']);
  });
  for(const config of [{enabled:false},{through:'2026-09-08'}])test(`${name} permits a date outside the effective lock ${JSON.stringify(config)}`,async()=>{
    const {service,calls}=await loadService(config);
    await assert.rejects(service[name](payload,{id:1}),{code:'TEST_WRITE_BOUNDARY'});
    assert.deepEqual(calls,['begin','period-read','write-attempt','rollback']);
  });
}
