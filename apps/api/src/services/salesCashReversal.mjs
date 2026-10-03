import {writeFinanceAccountMovement} from './financeService.js';
import {writeAuditLog} from './auditService.js';
import {settlementFromInvoice} from './currencySettlement.mjs';
import {writeMovementCurrencySnapshot} from './currencySettlementStore.mjs';

const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:409});};
export async function assertOpenSaleCashCollection(sql,transaction,invoice){
 const rows=(await new sql.Request(transaction).input('invoice',sql.BigInt,invoice.id).query(`
  SELECT cm.id AS movementId,cm.customer_id,cm.amount,cm.currency_code,fam.account_id,fam.created_at,fam.payment_method,fam.amount AS financeAmount,fam.direction
  FROM dbo.customer_movements cm WITH(UPDLOCK,HOLDLOCK)
  JOIN dbo.finance_account_movements fam WITH(UPDLOCK,HOLDLOCK) ON fam.party_movement_id=cm.id AND fam.party_type=N'customer' AND fam.source_type=N'collection'
  WHERE cm.sales_invoice_id=@invoice AND cm.movement_type=N'collection';`)).recordset;
 if(rows.length!==1||Number(rows[0].amount)!==Number(invoice.grandTotal)||Number(rows[0].financeAmount)!==Number(invoice.grandTotal)||rows[0].direction!=='in'||rows[0].currency_code!==invoice.documentCurrency||Number(rows[0].customer_id)!==Number(invoice.customerId))fail('SALES_CASH_COLLECTION_UNVERIFIED','Peşin fişin tahsilat bağlantısı doğrulanamadı.');
 const row=rows[0];
 const sessions=(await new sql.Request(transaction).input('account',sql.BigInt,row.account_id).input('at',sql.DateTime2,row.created_at).query(`
  IF OBJECT_ID(N'dbo.cash_sessions',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.cash_drawer_accounts',N'U') IS NOT NULL
  SELECT cs.session_status FROM dbo.cash_sessions cs WITH(UPDLOCK,HOLDLOCK) JOIN dbo.cash_drawer_accounts a ON a.drawer_id=cs.drawer_id
  WHERE a.finance_account_id=@account AND cs.opened_at<=@at AND (cs.closed_at IS NULL OR cs.closed_at>=@at);`)).recordset;
 if(sessions?.some(s=>s.session_status==='closed'))fail('SALES_CASH_SESSION_CLOSED','Tahsilatı kapanmış kasaya ait fişin tutarı değiştirilemez veya fiş iptal edilemez.');
 return row;
}
export async function reverseSaleCashCollection(sql,transaction,invoice,actor,reason){
 const settlement=settlementFromInvoice(invoice);
 if(settlement.accountCurrency!==invoice.documentCurrency)fail('SALES_CASH_COLLECTION_UNVERIFIED','Peşin fiş ve cari dövizi eşleşmelidir.');
 const original=await assertOpenSaleCashCollection(sql,transaction,invoice);
 const amount=Number(original.amount);
 // Signed reversal retains the original collection and feeds the existing
 // net-collection/ledger reports without deleting accounting history.
 const inserted=(await new sql.Request(transaction).input('customer',sql.BigInt,invoice.customerId).input('invoice',sql.BigInt,invoice.id).input('amount',sql.Decimal(18,4),amount).input('currency',sql.NVarChar(3),invoice.documentCurrency).input('date',sql.Date,invoice.documentDate).input('actor',sql.BigInt,actor?.id||null).query(`
  INSERT dbo.customer_movements(customer_id,sales_invoice_id,movement_type,amount,currency_code,balance_effect,document_date,created_by)
  OUTPUT inserted.id VALUES(@customer,@invoice,N'collection',-@amount,@currency,@amount,@date,@actor);
  UPDATE dbo.customers SET balance=balance+@amount,updated_at=SYSUTCDATETIME() WHERE id=@customer;`)).recordset[0];
 await writeMovementCurrencySnapshot(new sql.Request(transaction),'customer',inserted.id,{...settlement,accountAmount:-settlement.accountAmount,amountTry:-settlement.amountTry},settlement.accountAmount);
 await writeFinanceAccountMovement(transaction,sql,{account:{id:Number(original.account_id)},sourceType:'collection',partyType:'customer',partyMovementId:Number(inserted.id),amount:-amount,currency:invoice.documentCurrency,paymentMethod:original.payment_method,documentNo:`IPTAL-${invoice.documentNo}`,documentDate:invoice.documentDate,description:`Peşin satış iptal tahsilat ters kaydı: ${reason}`.slice(0,500),actor});
 await writeAuditLog(new sql.Request(transaction),{action:'sales_cash_collection_reversed',entityType:'sales_invoice',entityId:Number(invoice.id),actor,beforeSnapshot:{movementId:Number(original.movementId),accountId:Number(original.account_id),amount},afterSnapshot:{reversalMovementId:Number(inserted.id),collectionAmount:-amount,customerBalanceEffect:amount,cashBalanceEffect:-amount,currency:invoice.documentCurrency,reason}});
}
