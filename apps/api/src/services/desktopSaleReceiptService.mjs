// Source-only read of the committed native invoice as the first-sale receipt.
// verifySession must support a normal, current sales.view role on this tx.
const fail=()=>{throw Error('DESKTOP_SALE_RECEIPT_UNAVAILABLE');};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,15}$/.test(v)&&BigInt(v)<=9007199254740991n;
export const DESKTOP_SALE_RECEIPT_HEADER_SQL=`SET NOCOUNT ON;
SELECT CONVERT(varchar(20),i.id) invoiceId,i.document_no documentNo,CONVERT(char(10),i.document_date,23) documentDate,c.name customerName,UPPER(i.status COLLATE Latin1_General_100_BIN2) status,i.document_currency currency,CONVERT(varchar(40),i.grand_total) totalExact4
FROM dbo.desktop_sale_requests j WITH(HOLDLOCK) JOIN dbo.sales_invoices i WITH(HOLDLOCK) ON i.id=j.invoice_id JOIN dbo.customers c WITH(HOLDLOCK) ON c.id=i.customer_id
WHERE i.id=TRY_CONVERT(bigint,@invoiceId) AND j.state=N'COMMITTED' AND i.status=N'finalized' AND (@salesAll=1 OR i.created_by=TRY_CONVERT(bigint,@actorId));`;
export const DESKTOP_SALE_RECEIPT_ITEMS_SQL=`SELECT x.stock_code_snapshot stockCode,x.product_name_snapshot productName,CONVERT(varchar(40),x.quantity) quantityExact3,CONVERT(varchar(40),x.unit_price) unitPriceExact4,CONVERT(varchar(40),x.line_total) lineTotalExact4 FROM dbo.sales_invoice_items x WITH(HOLDLOCK) WHERE x.sales_invoice_id=TRY_CONVERT(bigint,@invoiceId) AND EXISTS(SELECT 1 FROM dbo.sales_invoices i WITH(HOLDLOCK) WHERE i.id=x.sales_invoice_id AND (@salesAll=1 OR i.created_by=TRY_CONVERT(bigint,@actorId))) ORDER BY x.id;`;
export function createDesktopSaleReceiptService({pool,sql,verifySession,getSalesReadScope=()=> 'own'}={}){
 if(!pool||typeof sql?.Transaction!=='function'||typeof sql?.Request!=='function'||typeof sql?.NVarChar!=='function'||!sql?.ISOLATION_LEVEL?.SERIALIZABLE||typeof verifySession!=='function'||typeof getSalesReadScope!=='function')fail();
 return Object.freeze({async receipt(actorId,invoiceId){if(!id(actorId)||!id(invoiceId))fail();const tx=new sql.Transaction(pool);let begun=false;
  try{await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);begun=true;if(await verifySession({transaction:tx,actorId,permission:'sales.view'})!==true)fail();const mode=getSalesReadScope({transaction:tx,actorId});if(mode!=='own'&&mode!=='all')fail();const request=()=>new sql.Request(tx).input('actorId',sql.NVarChar(20),actorId).input('salesAll',sql.NVarChar(1),mode==='all'?'1':'0').input('invoiceId',sql.NVarChar(20),invoiceId);const head=await request().query(DESKTOP_SALE_RECEIPT_HEADER_SQL);if(!Array.isArray(head?.recordset)||head.recordset.length!==1||head.recordset[0].invoiceId!==invoiceId)fail();const lineResult=await request().query(DESKTOP_SALE_RECEIPT_ITEMS_SQL);if(!Array.isArray(lineResult?.recordset)||lineResult.recordset.length!==1)fail();const h=head.recordset[0],items=lineResult.recordset;if(h.invoiceId!==invoiceId||h.status!=='FINALIZED'||h.currency!=='TRY'||typeof h.documentNo!=='string'||typeof h.documentDate!=='string'||typeof h.customerName!=='string'||typeof h.totalExact4!=='string'||!/^\d+\.\d{4}$/.test(h.totalExact4))fail();
   for(const v of items)if(typeof v.stockCode!=='string'||typeof v.productName!=='string'||typeof v.quantityExact3!=='string'||!/^\d+\.\d{3}$/.test(v.quantityExact3)||typeof v.unitPriceExact4!=='string'||!/^\d+\.\d{4}$/.test(v.unitPriceExact4)||typeof v.lineTotalExact4!=='string'||!/^\d+\.\d{4}$/.test(v.lineTotalExact4))fail();
   const line=items[0];if([line.quantityExact3,line.unitPriceExact4,line.lineTotalExact4,h.totalExact4].some(v=>v.length>24))fail();
   const quantity=BigInt(line.quantityExact3.replace('.','')),price=BigInt(line.unitPriceExact4.replace('.','')),actual=BigInt(line.lineTotalExact4.replace('.',''));
   if(quantity===0n||(quantity*price+500n)/1000n!==actual||actual!==BigInt(h.totalExact4.replace('.','')))fail();
   await tx.commit();begun=false;return {...h,items};
  }catch(e){if(begun)try{await tx.rollback();}catch{}throw e;}
 }});
}
export const DESKTOP_SALE_RECEIPT_LIMITS=Object.freeze({sourceOnly:true,receiptIsNativeInvoice:true,initialSyntheticAcceptanceCurrency:'TRY',requiresSalesViewSession:true,requiresJournalInstalled:true,realSqlVerified:false});
