// Call after locking the original invoice header, before changing its commercial effects.
export async function assertInvoiceHasNoReturns(requestFactory, kind, invoiceId, options = {}) {
  if (!['sales','purchase'].includes(kind) || !Number.isSafeInteger(Number(invoiceId)) || Number(invoiceId)<=0) throw new TypeError('Invalid invoice return guard arguments');
  const schema=await requestFactory().query("SELECT CASE WHEN OBJECT_ID(N'dbo.invoice_returns',N'U') IS NULL THEN 0 ELSE 1 END AS ready;");
  if (!schema.recordset?.[0]?.ready) return;
  const column=kind==='sales'?'source_sales_invoice_id':'source_purchase_invoice_id';
  const correction=options.mutation==='correction';
  const result=await requestFactory().input('returnGuardInvoiceId',Number(invoiceId)).query(`SELECT TOP(1) id FROM dbo.invoice_returns WITH(HOLDLOCK) WHERE ${column}=@returnGuardInvoiceId${correction?'':" AND status=N'finalized'"};`);
  if (correction && result.recordset?.length) throw Object.assign(new Error('Bu fişin iade geçmişi var. İade geçmişini korumak için kaynak fiş düzeltilemez; iadeler iptal edildikten sonra fiş iptali kullanılabilir.'),{code:'INVOICE_RETURN_HISTORY_LOCKED',statusCode:409});
  if (result.recordset?.length) throw Object.assign(new Error('Bu fişe bağlı iade var. Önce iadeyi inceleyin; kaynak fiş doğrudan değiştirilemez veya iptal edilemez.'),{code:'INVOICE_HAS_RETURNS',statusCode:409});
}
