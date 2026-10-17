import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
let invoice,audits,jobs,failPrint;
const env={receiptPrinting:{enabled:true,mode:'windows',printerName:'Synthetic A4 printer',timeoutMs:20000}};
function reset(){
 invoice={id:1,status:'FINALIZED',documentNo:'TEST-A4',documentDate:'2026-09-14',customerName:'Fixture',documentCurrency:'USD',subtotal:10,discountTotal:0,grandTotal:10,
 items:[{stockCode:'P1',productName:'Ürün',quantity:2,unitPrice:5,lineTotal:10,currency:'USD'}]};
 audits=[];jobs=[];failPrint=false;env.receiptPrinting.mode='windows';
}
mock.module('../config/env.js',{namedExports:{env}});
mock.module('../config/database.js',{namedExports:{getSqlPool:async()=>({request:()=>({})})}});
mock.module('./auditService.js',{namedExports:{writeAuditLog:async(_req,entry)=>audits.push(entry)}});
mock.module('./invoiceDraftService.js',{namedExports:{getSalesDraft:async()=>structuredClone(invoice)}});
mock.module('node:child_process',{namedExports:{execFile:(_exe,args,options,callback)=>{
 const modelPath=args[args.indexOf('-ModelPath')+1];
 jobs.push({args,options,model:JSON.parse(readFileSync(modelPath,'utf8'))});
 callback(failPrint?Error('Synthetic spool failure'):null,'','');
}}});
const {printTerminalSaleReceipt}=await import('./terminalReceiptPrintService.js');
test('preview exposes A4 model without submitting a printer job',async()=>{
 reset();env.receiptPrinting.mode='preview';
 const result=await printTerminalSaleReceipt(1);
 assert.equal(result.paperFormat,'A4');assert.equal(result.receiptModel.rows.length,1);assert.equal(jobs.length,0);
});
test('unfinalized receipt is rejected before audit or output',async()=>{
 reset();invoice.status='DRAFT';
 await assert.rejects(printTerminalSaleReceipt(1),e=>e.code==='TERMINAL_RECEIPT_FINALIZED_REQUIRED');
 assert.equal(audits.length,0);assert.equal(jobs.length,0);
});
test('Windows job receives structured A4 data, fixed script and selected printer',{skip:process.platform!=='win32'},async()=>{
 reset();const result=await printTerminalSaleReceipt(1);
 assert.equal(jobs.length,1);assert.equal(jobs[0].model.grandTotal,'10,00 $');
 assert.ok(jobs[0].args.some(a=>a.endsWith('print-terminal-a4.ps1')));
 assert.equal(jobs[0].args.at(-1),'Synthetic A4 printer');assert.equal(jobs[0].options.windowsHide,true);
 assert.equal(result.paperFormat,'A4');assert.deepEqual(audits.map(a=>a.action),['terminal_receipt_print_requested','terminal_receipt_print_completed']);
});
test('failed printer call remains uncertain, is not retried and has no completed audit',{skip:process.platform!=='win32'},async()=>{
 reset();failPrint=true;
 await assert.rejects(printTerminalSaleReceipt(1),e=>e.code==='TERMINAL_RECEIPT_PRINT_FAILED');
 assert.equal(jobs.length,1);assert.equal(audits.at(-1).action,'terminal_receipt_print_failed');
 assert.equal(audits.at(-1).afterSnapshot.physicalOutputConfirmed,false);
});
