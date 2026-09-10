import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import ts from '../../node_modules/typescript/lib/typescript.js';import React from '../../apps/web-admin/node_modules/react/index.js';import {createRequire} from 'node:module';import {createRowsWorkbook} from '../../apps/web-admin/src/utils/exportUtils.js';
const require=createRequire(new URL('../../apps/web-admin/package.json',import.meta.url)),XLSX=require('xlsx');
function screen({loading=false,error=''}={}){
 const dailyCash=Array.from({length:93},(_,i)=>({date:`2099-01-${String(Math.floor(i/3)+1).padStart(2,'0')}`,currency:['TRY','USD','EUR'][i%3],collections:i===0?null:10.1234,payments:3.1,net:i===0?null:7.0234}));
 const states=[{}, {dateFrom:'2099-01-01',dateTo:'2099-01-31',dailyCash}, {}, loading,error];let index=0,excel,printed;
 const mockReact={...React,useState:()=>[states[index++],()=>{}],useEffect:()=>{},useMemo:f=>f()};
 const exports={};const src=fs.readFileSync(new URL('../../apps/web-admin/src/modules/reports/ManagementReportsScreen.jsx',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require(id){if(id==='react')return mockReact;if(id.endsWith('dashboardApi.js'))return{};if(id.endsWith('exportUtils.js'))return{exportRowsToExcel:v=>excel=v,printRowsReport:v=>printed=v};throw Error(id);}});
 const tree=exports.ManagementReportsScreen();const buttons=[];function walk(node){if(!node||typeof node!=='object')return;if(node.type==='button')buttons.push(node);React.Children.forEach(node.props?.children,walk);}walk(tree);
 return {buttons,get excel(){return excel;},get printed(){return printed;}};
}
test('management screen exports all 93 daily cash groups with numeric precision and explicit unknowns',()=>{
 const s=screen();s.buttons.find(b=>b.props.children==='Excel').props.onClick();
 const bytes=XLSX.write(createRowsWorkbook(s.excel),{type:'buffer',bookType:'xlsx'}),book=XLSX.read(bytes,{type:'buffer'});
 const rows=XLSX.utils.sheet_to_json(book.Sheets.Rapor).filter(r=>r['Bölüm']==='Günlük Kasa');
 assert.equal(rows.length,93);assert.equal(rows[0]['Değer'],'Hesaplanamadı');assert.equal(rows[1]['Değer'],7.0234);assert.match(rows[1]['Detay'],/10\.1234 USD/);assert.match(rows[92]['Metrik'],/31.*EUR/);
 const print=s.buttons.find(b=>String(b.props.children).includes('Yazdır'));assert.ok(print);print.props.onClick();assert.equal(s.printed.rows.filter(r=>r.section==='Günlük Kasa').length,93);
});
for(const state of [{loading:true},{error:'REPORT_PERIOD_INVALID'}])test('report output buttons disabled while loading or invalid period '+JSON.stringify(state),()=>{const s=screen(state);assert.equal(s.buttons.find(b=>b.props.children==='Excel').props.disabled,true);assert.equal(s.buttons.find(b=>String(b.props.children).includes('Yazdır')).props.disabled,true);});
