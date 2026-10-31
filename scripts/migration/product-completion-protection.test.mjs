import test from 'node:test';import assert from 'node:assert/strict';
import {protectedRowCaseClauses} from './product-completion-protection.mjs';
test('only identical approved row projections share a CASE branch',()=>{
 const columns=['id','name','current_stock_qty','sales_price','row_version'];
 const byId=new Map([['1',new Set(['current_stock_qty','row_version'])],['2',new Set(['current_stock_qty','row_version'])],['3',new Set(['sales_price','row_version'])]]);
 const sql=protectedRowCaseClauses(columns,byId);
 assert.equal((sql.match(/WHEN /g)??[]).length,2);
 assert.match(sql,/WHEN x.id IN\(1,2\) THEN \(SELECT x\.\[id\],x\.\[name\],x\.\[sales_price\] FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES\)/);
 assert.match(sql,/WHEN x.id IN\(3\) THEN \(SELECT x\.\[id\],x\.\[name\],x\.\[current_stock_qty\] FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES\)/);
});
test('different stock/price omissions remain separate and field order is retained',()=>{
 const columns=['id','sales_price','nullable_value','current_stock_qty','row_version'];
 const sql=protectedRowCaseClauses(columns,new Map([['1',new Set(['sales_price','row_version'])],['2',new Set(['sales_price','current_stock_qty','row_version'])]]));
 assert.match(sql,/IN\(1\).*x\.\[nullable_value\],x\.\[current_stock_qty\]/);assert.match(sql,/IN\(2\) THEN \(SELECT x\.\[id\],x\.\[nullable_value\] FOR JSON/);
 assert.equal((sql.match(/WHEN /g)??[]).length,2);
});
test('empty scope preserves full-row branch; invalid IDs or column names reject',()=>{
 assert.equal(protectedRowCaseClauses(['id'],new Map()),null);
 assert.throws(()=>protectedRowCaseClauses(['id'],new Map([['1;DROP',new Set()]])),/PROTECTED_IDS/);
 assert.throws(()=>protectedRowCaseClauses(['id;DROP'],new Map([['1',new Set()]])),/PROTECTED_IDENTIFIER/);
});
test('large approved scope grows the ID list rather than repeating JSON projection per row',()=>{
 const rows=new Map(Array.from({length:1500},(_,i)=>[String(i+1),new Set(i%2?['sales_price','row_version']:['current_stock_qty','row_version'])]));
 const sql=protectedRowCaseClauses(['id','current_stock_qty','sales_price','row_version'],rows);
 assert.equal((sql.match(/WHEN /g)??[]).length,2);assert.equal((sql.match(/FOR JSON PATH/g)??[]).length,2);assert(sql.length<10000);
});
