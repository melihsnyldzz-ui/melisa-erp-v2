export async function assertPurchaseReturnClear(request,sql,invoiceId){
 const result=await request.input('invoice',sql.BigInt,invoiceId).query("SELECT COUNT(*) n FROM dbo.invoice_returns WITH(UPDLOCK,HOLDLOCK) WHERE source_purchase_invoice_id=@invoice AND kind=N'purchase' AND status=N'finalized'");
 if(Number(result.recordset[0].n)>0)throw Object.assign(new Error('Bu alış faturasının onaylı mal iadesi var. Faturayı iptal etmeden önce bağlı mal iadesini ters kayıtla iptal edin.'),{code:'ACTIVE_RETURN',statusCode:409});
}
