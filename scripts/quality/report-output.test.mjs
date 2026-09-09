import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createRowsWorkbook, exportRowsToExcel, printRowsReport } from '../../apps/web-admin/src/utils/exportUtils.js';
const require = createRequire(new URL('../../apps/web-admin/package.json', import.meta.url));
const XLSX = require('xlsx');

test('real xlsx round-trip preserves identifiers, typed quantities, currencies, unknowns and all rows', () => {
  const rows = Array.from({length:123}, (_,i)=>({code:`000${i}`,qty:i===0?0:i,price:i===0?null:12.5,currency:i%2?'USD':'TRY',note:i===0?'=1+1':'İğne & Çocuk <ürün>'}));
  const columns = [{key:'code',label:'Kod'}, {key:'qty',label:'Adet'}, {key:'price',label:'Fiyat'}, {key:'currency',label:'Döviz'}, {key:'note',label:'Açıklama'}];
  const workbook=createRowsWorkbook({title:'Test raporu',rows,columns});
  const bytes=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});
  assert.equal(bytes.subarray(0,2).toString(),'PK');
  const read=XLSX.read(bytes,{type:'buffer'}), sheet=read.Sheets.Rapor;
  assert.equal(sheet.A2.v,'0000');assert.equal(sheet.A2.t,'s');assert.equal(sheet.B2.v,0);assert.equal(sheet.B2.t,'n');
  assert.equal(sheet.C2,undefined);assert.equal(sheet.D3.v,'USD');assert.equal(sheet.E2.v,'=1+1');assert.equal(sheet.E2.f,undefined);
  assert.equal(sheet.C3.v,12.5);assert.equal(sheet.E3.v,'İğne & Çocuk <ürün>');assert.equal(sheet.A124.v,'000122');
  assert.equal(read.Props.Title,'Test raporu');assert.equal(sheet['!autofilter'].ref,'A1:E124');
});

test('download uses xlsx extension and releases the blob after the click', async () => {
  const original={document:global.document,window:global.window,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  let blob,filename,timer,released=false,clicked=false;
  global.window={setTimeout(fn,ms){assert.ok(ms>=1000);timer=fn;}};
  URL.createObjectURL=value=>{blob=value;return 'blob:fixture';};URL.revokeObjectURL=()=>{released=true;};
  global.document={createElement(){return {click(){clicked=true;filename=this.download;assert.equal(released,false);}};},body:{appendChild(){},removeChild(){}}};
  try { exportRowsToExcel({filename:'stok-2026',columns:[{label:'Miktar',key:'n'}],rows:[{n:0}]});assert.equal(filename,'stok-2026.xlsx');assert.ok(clicked);assert.match(blob.type,/spreadsheetml/);assert.equal(Buffer.from(await blob.arrayBuffer()).subarray(0,2).toString(),'PK');timer();assert.ok(released); }
  finally {global.document=original.document;global.window=original.window;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});

test('report prints once and retains iframe until print completion', () => {
  const original={document:global.document,localStorage:global.localStorage};
  let iframe,printed=0,removed=false,afterPrint;
  global.localStorage={getItem(){return null;}};
  global.document={createElement(){iframe={style:{},remove(){removed=true;},contentWindow:{focus(){},print(){printed++;},addEventListener(name,fn){assert.equal(name,'afterprint');afterPrint=fn;}}};return iframe;},body:{appendChild(){}}};
  try { printRowsReport({title:'İşletme <raporu>',columns:[{label:'Kod',key:'code'}],rows:[{code:'<safe>'}]});assert.doesNotMatch(iframe.srcdoc,/<script/);assert.match(iframe.srcdoc,/&lt;safe&gt;/);iframe.onload();assert.equal(printed,1);assert.equal(removed,false);afterPrint();assert.equal(removed,true); }
  finally {global.document=original.document;global.localStorage=original.localStorage;}
});
