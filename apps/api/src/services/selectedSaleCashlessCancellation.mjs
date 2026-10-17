const reject=()=>{throw Object.assign(new Error('Fişe bağlı tahsilat veya finans hareketi önce ayrı incelenmelidir.'),{code:'SALES_CASH_COLLECTION_UNVERIFIED',statusCode:409});};
// Called only after the same-transaction selected SOURCE owner scope is proved.
// Any linked finance evidence blocks this cashless cancellation, even a reversal.
export async function assertSelectedSaleCashlessCancellation(sql,transaction,invoice){
 if(!transaction||!Number.isSafeInteger(Number(invoice?.id))||Number(invoice.id)<1||typeof invoice.documentNo!=='string'||!invoice.documentNo)reject();
 const rows=(await new sql.Request(transaction).input('cashlessCancelInvoiceId',sql.BigInt,invoice.id).input('cashlessCancelDocumentNo',sql.NVarChar(60),invoice.documentNo).query(`
 SELECT
  (SELECT COUNT_BIG(*) FROM dbo.customer_movements cm WITH(UPDLOCK,HOLDLOCK)
   WHERE cm.sales_invoice_id=@cashlessCancelInvoiceId
    AND (cm.movement_type IS NULL OR cm.movement_type NOT IN(N'sales_invoice',N'sales_invoice_cancel'))) AS collectionRows,
  (SELECT COUNT_BIG(*) FROM dbo.finance_account_movements fam WITH(UPDLOCK,HOLDLOCK)
   WHERE ((fam.party_type IS NULL OR CONVERT(varbinary(max),fam.party_type)<>CONVERT(varbinary(max),N'supplier')) AND EXISTS(
    SELECT 1 FROM dbo.customer_movements linked WITH(UPDLOCK,HOLDLOCK)
    WHERE linked.id=fam.party_movement_id AND linked.sales_invoice_id=@cashlessCancelInvoiceId))
   OR (fam.party_type=N'customer' AND fam.source_type LIKE N'collection%'
    AND CONVERT(varbinary(max),fam.document_no)=CONVERT(varbinary(max),@cashlessCancelDocumentNo))) AS financeRows;
 `)).recordset;
 if(!Array.isArray(rows)||rows.length!==1||![0,'0'].includes(rows[0]?.collectionRows)||![0,'0'].includes(rows[0]?.financeRows))reject();
 return true;
}
