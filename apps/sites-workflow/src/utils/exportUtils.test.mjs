import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {exportRowsToExcel,exportRowsToCsv} from './exportUtils.js';

async function capture(action){
 const previous={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 const blobs=[],links=[],events=[];
 globalThis.document={createElement(tag){assert.equal(tag,'a');const link={click(){events.push('click');}};links.push(link);return link;},
  body:{appendChild(){events.push('append');},removeChild(){events.push('remove');}}};
 URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:synthetic-export';};
 URL.revokeObjectURL=url=>{assert.equal(url,'blob:synthetic-export');events.push('revoke');};
 try{await action();return {blobs,links,events};}
 finally{if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document;URL.createObjectURL=previous.create;URL.revokeObjectURL=previous.revoke;}
}
async function workbook(options){
 const c=await capture(()=>exportRowsToExcel(options));assert.equal(c.blobs.length,1);
 const bytes=new Uint8Array(await c.blobs[0].arrayBuffer());assert.equal(String.fromCharCode(...bytes.slice(0,2)),'PK');
 return {...c,book:XLSX.read(bytes,{type:'array',cellFormula:true}),bytes};
}
test('actual Excel export roundtrip preserves leading zeros, bigint and 28,8 decimal text as literal typed cells',async()=>{
 const columns=['barcode','id','amount','currency'].map(key=>({key,label:key}));
 const rows=[{barcode:'00001234',id:'9223372036854775806',amount:'12345678901234.12345678',currency:'USD'},
  {barcode:'00000001',id:9223372036854775806n,amount:'0.00000000',currency:'TRY'}];
 const r=await workbook({filename:'Sabit rapor',title:'Kaynak TEST / yalnız seçili satırlar',columns,rows});
 const sheet=r.book.Sheets.Rapor;
 assert.equal(sheet.A3.t,'s');assert.equal(sheet.A3.v,'00001234');assert.equal(sheet.B3.v,'9223372036854775806');
 assert.equal(sheet.B4.v,'9223372036854775806');assert.equal(sheet.C3.v,'12345678901234.12345678');assert.equal(sheet.C4.v,'0.00000000');
 assert.equal(sheet.D3.v,'USD');assert.equal(sheet.D4.v,'TRY');assert.equal(sheet['!autofilter'].ref,'A2:D4');
 assert.equal(r.links[0].download,'sabit-rapor.xlsx');assert.deepEqual(r.events,['append','click','remove','revoke']);
 assert.equal(r.blobs[0].type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
test('Excel title/header/user formula and HTML strings never become formulas, hyperlinks or markup',async()=>{
 const values=['=1+1','+SUM(A1:A2)','-1+2','@SUM(A1)','\t=HYPERLINK("bad")','<script>alert(1)</script>','https://example.invalid'];
 const r=await workbook({filename:'formula',title:'=HYPERLINK("bad")',columns:[{key:'v',label:'=1+1'}],rows:values.map(v=>({v}))});
 const sheet=r.book.Sheets.Rapor;assert.equal(sheet.A1.v,'=HYPERLINK("bad")');assert.equal(sheet.A2.v,'=1+1');
 values.forEach((value,i)=>{const cell=sheet['A'+(i+3)];assert.equal(cell.t,'s');assert.equal(cell.v,value);assert.equal(cell.f,undefined);assert.equal(cell.l,undefined);});
 assert.ok(Object.entries(sheet).filter(([k])=>!k.startsWith('!')).every(([,c])=>c.f===undefined));
});
test('Excel null and missing stay blank, real zero stays explicit, callbacks and empty export preserve row scope',async()=>{
 const r=await workbook({filename:'scope',columns:[{key:'a',label:'A'},{key:'b',label:'B'},{label:'C',value:r=>r.c}],rows:[{a:null,b:0,c:'0'},{a:undefined,b:'',c:'bilinmiyor'}]});
 const sheet=r.book.Sheets.Rapor;assert.equal(sheet.A3,undefined);assert.equal(sheet.A4,undefined);assert.equal(sheet.B3.v,'0');assert.equal(sheet.C3.v,'0');
 assert.equal(sheet.B4.v,'');assert.equal(sheet.C4.v,'bilinmiyor');assert.equal(sheet['!ref'],'A1:C4');
 const empty=await workbook({filename:'empty',columns:[{key:'x',label:'X'}],rows:[]});
 assert.equal(empty.book.Sheets.Rapor['!ref'],'A1:A2');assert.equal(empty.book.Sheets.Rapor.A3,undefined);
});
test('Excel refuses already unsafe numeric identifiers and non-finite values instead of claiming exact recovery',async()=>{
 for(const value of [9007199254740992,Infinity,-Infinity,NaN]){
  const r=await capture(()=>assert.throws(()=>exportRowsToExcel({filename:'unsafe',columns:[{key:'x',label:'X'}],rows:[{x:value}]}),/kaynak değeri metin/));
  assert.equal(r.blobs.length,0);assert.equal(r.events.length,0);
 }
});
test('actual CSV export neutralizes formula text after whitespace, escapes separators/quotes, keeps null and zero distinct',async()=>{
 const dangerous=['=1+1','  =1+1','+1','-1','@x','\ttext','\r=1','\n=1'];
 const r=await capture(()=>exportRowsToCsv({filename:'csv',columns:[{key:'v',label:'=header'}],rows:[...dangerous.map(v=>({v})),{v:-12},{v:0},{v:null},{v:'0000123'},{v:'a;"b"'}]}));
 const text=await r.blobs[0].text();
 assert.ok(text.includes('"\'=header"'));dangerous.forEach(v=>assert.ok(text.includes('"\''+v.replaceAll('"','""')+'"')));
 assert.ok(text.includes('\r\n"-12"\r\n"0"\r\n""\r\n"0000123"\r\n"a;""b"""'));
 assert.equal(r.links[0].download,'csv.csv');
});

