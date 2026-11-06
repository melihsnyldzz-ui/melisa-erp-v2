import sql from 'mssql';
import {getDesktopWritePool} from '../config/desktopWriteTlsConnector.mjs';
import {getDesktopWriteSessionVerifier} from './desktopWriteAuthCore.mjs';
const fail=()=>{throw Error('DESKTOP_WORKFLOW_READ_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
const dec=(v,n)=>{if(typeof v!=='string'||!new RegExp(`^(?:0|[1-9]\\d{0,13})\\.\\d{${n}}$`).test(v))fail();return BigInt(v.replace('.',''));};
export function createDesktopWorkflowReadService({connector,auth}={}){
 const pool=getDesktopWritePool(connector),verifySession=getDesktopWriteSessionVerifier(auth,pool);
 return auth.bindWorkflowReadService({async read(actorId,invoiceId){
  if(!id(actorId)||!id(invoiceId))fail();const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;if(await verifySession({transaction:tx,actorId,permission:'sales.view'})!==true)fail();
   const result=await new sql.Request(tx).input('invoiceId',sql.NVarChar(20),invoiceId).query(`SET NOCOUNT ON;
    SELECT CONVERT(varchar(20),i.id) invoiceId,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,CONVERT(varchar(20),i.customer_id) customerId,c.name customerName,UPPER(i.status COLLATE Latin1_General_100_BIN2) invoiceState,i.document_currency currency,CONVERT(varchar(40),i.grand_total) totalExact4,CONVERT(varchar(40),i.subtotal) subtotalExact4,CONVERT(varchar(40),i.discount_rate) discountRateExact4,CONVERT(varchar(40),i.discount_total) discountTotalExact4,w.state workflowState,CONVERT(varchar(18),CONVERT(binary(8),w.version),1) version,CONVERT(varchar(20),w.sent_by) sentBy,CONVERT(varchar(20),w.prepared_by) preparedBy,CONVERT(varchar(20),w.checked_by) checkedBy
    FROM dbo.desktop_sale_workflows w WITH(HOLDLOCK) JOIN dbo.sales_invoices i WITH(HOLDLOCK) ON i.id=w.invoice_id JOIN dbo.customers c WITH(HOLDLOCK) ON c.id=i.customer_id WHERE i.id=TRY_CONVERT(bigint,@invoiceId);
    SELECT CONVERT(varchar(20),id) itemId,CONVERT(varchar(20),product_id) productId,stock_code_snapshot stockCode,product_name_snapshot name,barcode_snapshot barcode,CONVERT(varchar(40),quantity) quantityExact3,CONVERT(varchar(40),unit_price) unitPriceExact4,CONVERT(varchar(40),line_total) lineTotalExact4 FROM dbo.sales_invoice_items WITH(HOLDLOCK) WHERE sales_invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY id;
    SELECT carton_no cartonNo,CONVERT(varchar(20),item_id) itemId,CONVERT(varchar(20),product_id) productId,CONVERT(varchar(40),quantity) quantityExact3 FROM dbo.desktop_sale_carton_items WITH(HOLDLOCK) WHERE invoice_id=TRY_CONVERT(bigint,@invoiceId) ORDER BY carton_no,item_id;`);
   const rs=result?.recordsets;if(!Array.isArray(rs)||rs.length!==3||rs.some(r=>!Array.isArray(r))||rs[0].length!==1||rs[0][0].invoiceId!==invoiceId||rs[1].length!==2||rs[2].length>200)fail();
   const h=rs[0][0];if(!id(h.customerId)||h.currency!=='TRY'||!['DRAFT','PREPARING','READY','CHECKED','COMPLETED','CANCELLED'].includes(h.workflowState)||!/^0x[0-9A-F]{16}$/.test(h.version)||typeof h.documentNo!=='string'||typeof h.customerName!=='string')fail();
   if((h.workflowState==='COMPLETED'?'FINALIZED':h.workflowState==='CANCELLED'?'CANCELLED':'DRAFT')!==h.invoiceState||typeof h.documentDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(h.documentDate))fail();
   const items=new Map(),products=new Set();let total=0n;
   for(const item of rs[1]){if(!id(item.itemId)||!id(item.productId)||items.has(item.itemId)||products.has(item.productId)||typeof item.name!=='string'||typeof item.stockCode!=='string')fail();const qty=dec(item.quantityExact3,3),price=dec(item.unitPriceExact4,4),line=dec(item.lineTotalExact4,4);if(qty===0n||(qty*price+500n)/1000n!==line)fail();total+=line;items.set(item.itemId,{productId:item.productId,qty,packed:0n});products.add(item.productId);}
   const rate=dec(h.discountRateExact4,4),discount=dec(h.discountTotalExact4,4),net=dec(h.totalExact4,4);if(rate>30000n||total!==dec(h.subtotalExact4,4)||total-discount!==net||discount!==(total*rate+500000n)/1000000n)fail();const packedKeys=new Set();
   for(const part of rs[2]){const item=items.get(part.itemId),key=part.cartonNo+':'+part.itemId;if(!item||item.productId!==part.productId||!Number.isSafeInteger(part.cartonNo)||part.cartonNo<1||packedKeys.has(key))fail();packedKeys.add(key);const qty=dec(part.quantityExact3,3);if(qty===0n)fail();item.packed+=qty;}
   if([...items.values()].some(item=>item.packed>item.qty||['READY','CHECKED','COMPLETED'].includes(h.workflowState)&&item.packed!==item.qty))fail();
   const data={...h,items:rs[1],cartonItems:rs[2]};await tx.commit();begun=false;return data;
  }catch(error){if(begun)try{await tx.rollback();}catch{}throw error;}
 }});
}
