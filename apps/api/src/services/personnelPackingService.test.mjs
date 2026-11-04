// Actual personnel service; only SQL I/O and audit admission are in-memory.
import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
let supported,calls,binds,audits,employee,transactions;
class Request{
 constructor(){this.params={};}
 input(k,t,v){this.params[k]=v;return this;}
 async query(sql){calls.push({sql,params:this.params});
  if(sql.includes('AS is_ready'))return {recordset:[{is_ready:1}]};
  if(sql.includes('SELECT TOP (1) * FROM dbo.employees'))return {recordset:[{...employee}]};
  if(sql.includes('INSERT INTO dbo.employees')){if(sql.includes('@canTerminalPacking,'))employee.can_terminal_packing=this.params.canTerminalPacking;return {recordset:[{id:60101}]};}
  if(sql.includes('UPDATE dbo.employees')){if(sql.includes('can_terminal_packing = @canTerminalPacking'))employee.can_terminal_packing=this.params.canTerminalPacking;return {recordset:[]};}
  if(sql.includes('FROM dbo.employees e'))return {recordset:[{...employee}]};
  return {recordset:[]};
 }
}
class Transaction{async begin(){transactions++;}async commit(){}async rollback(){}}
const pool={request:()=>new Request()};
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>pool,getSqlDriver:()=>({Request,Transaction})}});
mock.module('./cleanPersonnelManagement.mjs',{namedExports:{assertCleanPersonnelWrite:()=>true,bindCleanPersonnelWrite:async(tx,q,a,op,payload)=>{binds.push({op,payload});return async()=>{};},cleanPersonnelOptions:async()=>({ready:true,packingTaskSupported:supported})}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async(req,input)=>audits.push(input)}});
mock.module('./writeGuardService.js',{namedExports:{assertMelisaWriteEnabled:()=>{throw Error('No legacy writes allowed in fixture');}}});
const service=await import('./personnelService.js');
beforeEach(()=>{supported=false;calls=[];binds=[];audits=[];transactions=0;employee={id:60101,employee_code:'FIXTURE-1',full_name:'Fixture',user_id:50101,is_active:true,can_terminal_sale:true,can_terminal_packing:true,can_change_sale_price:false,max_sale_discount_percent:0};});
const payload=()=>({employeeCode:'FIXTURE-1',fullName:'Fixture',userId:50101,canTerminalSale:true,canChangeSalePrice:false,maxSaleDiscountPercent:0,isActive:true});
test('task payload cannot reach a transaction when the installed native support is absent',async()=>{
 for(const value of [true,false])await assert.rejects(service.updateEmployee(60101,{...payload(),canTerminalPacking:value},{}),{code:'PERSONNEL_PACKING_UNAVAILABLE'});
 assert.equal(transactions,0);assert.equal(binds.length,0);assert.equal(audits.length,0);
});
test('ordinary personnel payload remains compatible and creates no packing column write',async()=>{
 await service.createEmployee(payload(),{});assert.equal(transactions,1);assert.equal(Object.hasOwn(binds[0].payload,'canTerminalPacking'),false);
 const insert=calls.find(c=>c.sql.includes('INSERT INTO dbo.employees'));assert.doesNotMatch(insert.sql,/can_terminal_packing/);
});
test('omitted task keeps its old value instead of clearing it during another employee edit',async()=>{
 supported=true;const result=await service.updateEmployee(60101,payload(),{});
 assert.doesNotMatch(calls.find(c=>c.sql.includes('UPDATE dbo.employees')).sql,/can_terminal_packing/);
 assert.equal(result.employees[0].canTerminalPacking,true);assert.equal(Object.hasOwn(binds[0].payload,'canTerminalPacking'),false);
});
test('explicit task revocation uses the same employee update and audit with a real boolean',async()=>{
 supported=true;const result=await service.updateEmployee(60101,{...payload(),canTerminalPacking:false},{});
 const update=calls.find(c=>c.sql.includes('UPDATE dbo.employees'));assert.equal(update.params.canTerminalPacking,false);assert.match(update.sql,/can_terminal_packing = @canTerminalPacking/);
 assert.equal(result.employees[0].canTerminalPacking,false);assert.equal(binds[0].payload.canTerminalPacking,false);
 assert.equal(audits[0].beforeSnapshot.can_terminal_packing,true);assert.equal(audits[0].afterSnapshot.canTerminalPacking,false);
});
test('task values are never coerced from string, number or null',async()=>{
 for(const value of ['false','true',0,1,null])await assert.rejects(service.updateEmployee(60101,{...payload(),canTerminalPacking:value},{}),{code:'PERSONNEL_PACKING_INVALID'});
 assert.equal(calls.length,0);assert.equal(transactions,0);
});
