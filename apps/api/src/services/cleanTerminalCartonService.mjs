// Packing metadata only; the existing native actor proof and carton journal
// stay authoritative. No invoice, stock or finance mutation is performed here.
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assertRegisteredCleanContext,assertCleanIdentity,CLEAN_IDENTITY_SQL} from './cleanSyntheticContext.mjs';
import {isCleanPersonalWorkCandidate,proveCleanPersonalWorkActor} from './cleanPersonnelManagement.mjs';
import {createTerminalCartonService} from './terminalCartonService.mjs';
import {createTerminalCartonFileStore,CARTON_CLEAN_DIRECTORY} from './terminalCartonStore.mjs';
const fail=(code,message,statusCode=503)=>{throw Object.assign(new Error(message),{code,statusCode});};
const defaults=async()=>import('../config/database.js');
export function cleanCartonRequestAllowed(req,environment=process.env){
 return environment.MELISA_CLEAN_TEST==='20261022'&&environment.API_PORT==='4194'&&
  (req?.method==='GET'&&/^\/api\/terminal-cartons\/receipts(?:\/[1-9]\d{0,18})?$/.test(req.path)||req?.method==='POST'&&/^\/api\/terminal-cartons\/receipts\/[1-9]\d{0,18}$/.test(req.path));
}
export async function assertCleanCartonDirectory(){
 try{await promisify(execFile)('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('./cleanTerminalCartonDirectory.ps1',import.meta.url))],{windowsHide:true,timeout:8000,maxBuffer:1024});}
 catch{fail('CARTON_DIRECTORY','Koli kayıt alanının koruması doğrulanamadı.');}
}
export function cleanCartonInvoice(rows){
 const [headers,items,barcodes,holds]=rows,head=headers?.[0];
 if(headers?.length!==1)fail('CARTON_NOT_FOUND','Toplanabilecek satış fişi bulunamadı.',404);
 if(head.status!=='finalized'||holds.length)fail('CARTON_SOURCE_CHANGED','Satış fişi toplama için doğrulanamadı.',409);
 let preview;try{preview=JSON.parse(head.previewJson);}catch{fail('CARTON_SOURCE_CHANGED','Satış fişi kaynağı okunamadı.',409);}
 if(!Array.isArray(preview?.items)||preview.items.length!==items.length||!items.length)fail('CARTON_SOURCE_CHANGED','Satış fişi satırları doğrulanamadı.',409);
 return {...head,items:items.map((row,index)=>{
  const saved=preview.items[index];
  if(!saved||['productId','stockCode','name','quantityExact3'].some(k=>saved[k]!==row[k])||saved.unit?.label!=='ADET'||saved.unit.factorExact8!=='1.00000000'||row.currentUnit!==saved.unit.label)fail('CARTON_SOURCE_CHANGED','Satış fişi birim veya ürün bilgisi değişmiş.',409);
  return {...row,unit:{label:saved.unit.label,factorExact8:saved.unit.factorExact8,verified:true},barcodes:barcodes.filter(b=>b.productId===row.productId).map(b=>b.barcode)};
 })};
}
export function createCleanTerminalCartonService({dependencies=defaults,store=createTerminalCartonFileStore({directory:CARTON_CLEAN_DIRECTORY,assertDirectory:assertCleanCartonDirectory})}={}){
 async function run(actor,work){
  assertRegisteredCleanContext();
  if(process.env.API_PORT!=='4194'||!isCleanPersonalWorkCandidate(actor,'packing'))fail('CARTON_FORBIDDEN','Toplama göreviniz doğrulanamadı.',403);
  let tx;try{
   const db=await dependencies(),pool=await db.getSqlPool(),q=db.getSqlDriver();
   assertCleanIdentity((await pool.request().query(CLEAN_IDENTITY_SQL)).recordset[0]);
   tx=new q.Transaction(pool);await tx.begin(q.ISOLATION_LEVEL.SERIALIZABLE);const req=()=>new q.Request(tx);
   await req().query("DECLARE @n int;EXEC @n=sys.sp_getapplock @Resource=N'CLEAN_STORE_DAY_20261022',@LockMode=N'Shared',@LockOwner=N'Transaction',@LockTimeout=5000;IF @n<0 THROW 51966,'CLEAN_DIRECT_SALE_BUSY',1;");
   const proof=await proveCleanPersonalWorkActor(tx,q,actor,'packing');
   const invoice=async id=>cleanCartonInvoice((await req().input('id',q.BigInt,id).input('actor',q.BigInt,Number(actor.id)).query("SELECT CONVERT(varchar(20),i.id) id,i.document_no documentNo,i.status,c.name customerName,l.preview_json previewJson FROM dbo.clean_direct_sale_links l JOIN dbo.sales_invoices i ON i.id=l.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE l.invoice_id=@id AND l.actor_id=@actor;SELECT CONVERT(varchar(20),i.id) itemId,CONVERT(varchar(20),i.product_id) productId,i.stock_code_snapshot stockCode,i.product_name_snapshot name,CONVERT(varchar(40),i.quantity) quantityExact3,p.unit currentUnit FROM dbo.sales_invoice_items i JOIN dbo.products p ON p.id=i.product_id WHERE i.sales_invoice_id=@id ORDER BY i.id;SELECT CONVERT(varchar(20),b.product_id) productId,b.barcode FROM dbo.product_barcodes b WHERE b.is_active=1 AND b.product_id IN(SELECT product_id FROM dbo.sales_invoice_items WHERE sales_invoice_id=@id) ORDER BY b.id;SELECT h.native_id FROM erp_migration.operation_quarantine_holds h WHERE h.entity=N'product' AND h.native_id IN(SELECT product_id FROM dbo.sales_invoice_items WHERE sales_invoice_id=@id);")).recordsets);
   const service=createTerminalCartonService({store,assertContext:async()=>proof,readSource:invoice});
   const value=await work({req,q,service});await tx.commit();return value;
  }catch(error){if(tx)try{await tx.rollback();}catch{}if(error.statusCode)throw error;fail('CARTON_UNAVAILABLE','Toplama bilgileri şu anda doğrulanamıyor.');}
 }
 return {
  list:actor=>run(actor,async({req,q})=>(await req().input('actor',q.BigInt,Number(actor.id)).query("SELECT TOP(50) CONVERT(varchar(20),i.id) id,i.document_no documentNo,c.name customerName FROM dbo.clean_direct_sale_links l JOIN dbo.sales_invoices i ON i.id=l.invoice_id JOIN dbo.customers c ON c.id=i.customer_id WHERE l.actor_id=@actor AND i.status=N'finalized' ORDER BY i.id DESC;")).recordset),
  load:(id,actor)=>run(actor,({service})=>service.load(id,actor)),
  save:(id,input,actor)=>run(actor,({service})=>service.save(id,input,actor))
 };
}
