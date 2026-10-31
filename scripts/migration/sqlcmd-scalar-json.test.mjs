import test from 'node:test';import assert from 'node:assert/strict';
import {parseSqlcmdScalarJson} from './sqlcmd-scalar-json.mjs';
const wrap=(v,width)=>v.match(new RegExp('.{1,'+width+'}','gu')).join('\r\n')+'\r\n';
test('physical wrapping inside a source identity property cannot become a false missing card',()=>{
 const row={sourceId:'141699',id:31999,name:'Örnek ürün',source_record_key:['VEGA2026','F0102TBLSTOKLAR','141699'].join('/')},text=JSON.stringify({products:[row]});
 for(const width of [1,2,11,21,37,65535])assert.deepEqual(parseSqlcmdScalarJson('\uFEFF'+wrap(text,width),{width}),{products:[row]});
});
test('escaped source newlines, leading-zero barcode, quotes and precision survive unchanged',()=>{
 const value={name:'İlk satır\nİkinci satır\r\n"Ürün"',barcode:'000123',amount:'12.34567890'},text=JSON.stringify(value);
 assert.deepEqual(parseSqlcmdScalarJson(wrap(text,17),{width:17}),value);
});
test('unexpected headers, rows, partial output and arbitrary raw newlines fail closed',()=>{
 for(const text of ['(1 rows affected)\r\n{}','{"id":1}\r\n{"id":2}','{"id":','{"i\r\nd":1}','null','"literal"'])assert.throws(()=>parseSqlcmdScalarJson(text,{width:65535}),/^Error: SQLCMD_JSON_/);
});
