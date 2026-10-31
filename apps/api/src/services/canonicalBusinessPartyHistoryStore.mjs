// Native account-linked rows only. No schema initialization, posting or balance
// calculation. The caller separately verifies actor, card and result semantics.
const roles=Object.freeze({
 customer:Object.freeze({table:'customer_movements',party:'customer_id',opposite:'supplier_id',invoiceTable:'sales_invoices',invoice:'sales_invoice_id'}),
 supplier:Object.freeze({table:'supplier_movements',party:'supplier_id',opposite:'customer_id',invoiceTable:'purchase_invoices',invoice:'purchase_invoice_id'}),
});
const error=(code,statusCode)=>Object.assign(new Error('Cari hareketleri okunamadı.'),{code,statusCode});
const invalid=()=>{throw error('BUSINESS_PARTY_HISTORY_QUERY_INVALID',400);};
const id=v=>typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;
const date=v=>v===null||typeof v==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00.000Z'))&&new Date(v+'T00:00:00.000Z').toISOString().slice(0,10)===v;
function validate(options){
 const keys=['kind','partyId','accountId','currency','page','limit','offset','dateFrom','dateTo'];
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).sort().join(',')!==keys.sort().join(',')||typeof options.kind!=='string'||!Object.hasOwn(roles,options.kind)||!id(options.partyId)||!id(options.accountId)||!['TRY','USD','EUR'].includes(options.currency)||!Number.isSafeInteger(options.page)||options.page<1||options.limit!==25||!Number.isSafeInteger(options.offset)||options.offset<0||options.offset>2147483647||options.offset!==(options.page-1)*25||!date(options.dateFrom)||!date(options.dateTo)||options.dateFrom!==null&&options.dateTo!==null&&options.dateFrom>options.dateTo)invalid();
 return {...options};
}
function selectSQL(kind){
 const r=roles[kind];
 const membership='a.id=CONVERT(bigint,@accountId) AND a.'+r.party+'=CONVERT(bigint,@partyId)';
 const linked='m.party_currency_account_id=a.id';
 const conflict=`(m.${r.party} IS NULL OR m.${r.party}<>CONVERT(bigint,@partyId)
    OR (m.account_currency IS NOT NULL AND m.account_currency<>@currency)
    OR (m.party_entity_id IS NOT NULL AND a.party_entity_id IS NOT NULL AND m.party_entity_id<>a.party_entity_id))`;
 const dates='(@dateFrom IS NULL OR m.document_date>=@dateFrom) AND (@dateTo IS NULL OR m.document_date<=@dateTo)';
 const visible=`${linked} AND m.${r.party}=CONVERT(bigint,@partyId) AND NOT ${conflict} AND ${dates}`;
 // Three independent SELECT results deliberately make no atomic-snapshot claim.
 // Unassigned/conflict counts cover ALL recorded dates, even for a date page.
 return `SELECT CONVERT(varchar(20),a.id) id,CONVERT(varchar(20),a.${r.party}) partyId,
 CONVERT(varchar(20),a.${r.opposite}) oppositePartyId,CONVERT(varchar(20),a.party_entity_id) partyEntityId,a.currency_code currency
 FROM dbo.party_currency_accounts a WHERE ${membership};
 SELECT
 CONVERT(varchar(20),(SELECT COUNT_BIG(*) FROM dbo.${r.table} m JOIN dbo.party_currency_accounts a ON ${membership} WHERE ${visible})) total,
 CONVERT(varchar(20),(SELECT COUNT_BIG(*) FROM dbo.${r.table} m WHERE m.${r.party}=CONVERT(bigint,@partyId) AND m.party_currency_account_id IS NULL)) unassignedCount,
 CONVERT(varchar(20),(SELECT COUNT_BIG(*) FROM dbo.${r.table} m JOIN dbo.party_currency_accounts a ON ${membership} WHERE ${linked} AND ${conflict})) conflictCount;
 SELECT CONVERT(varchar(20),m.id) id,m.movement_type kind,CONVERT(char(10),m.document_date,23) documentDate,
 CONVERT(varchar(60),m.amount) documentAmountExact,m.currency_code documentCurrencyRaw,
 CONVERT(varchar(60),m.account_amount) accountAmountExact,m.account_currency accountCurrency,
 CONVERT(varchar(60),m.balance_effect_exact) balanceEffectExact,CONVERT(varchar(60),m.balance_effect) legacyBalanceEffectExact,
 m.affects_balance affectsBalance,CONVERT(varchar(20),m.${r.invoice}) invoiceId,i.document_no invoiceNumber,
 CONVERT(varchar(20),m.invoice_return_id) returnId
 FROM dbo.${r.table} m JOIN dbo.party_currency_accounts a ON ${membership}
 LEFT JOIN dbo.${r.invoiceTable} i ON i.id=m.${r.invoice} AND i.${r.party}=m.${r.party}
 WHERE ${visible}
 ORDER BY m.document_date DESC,m.id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;`;
}
async function defaultRuntime(){const db=await import('../config/database.js');return {pool:await db.getSqlPool(),sql:db.getSqlDriver()};}
export function createCanonicalBusinessPartyHistoryStore({getRuntime=defaultRuntime}={}){
 return {async read(options){
  const o=validate(options);
  try{
   const {pool,sql}=await getRuntime();
   const result=await pool.request()
    .input('partyId',sql.NVarChar(20),o.partyId).input('accountId',sql.NVarChar(20),o.accountId)
    .input('currency',sql.NVarChar(3),o.currency).input('dateFrom',sql.Date,o.dateFrom).input('dateTo',sql.Date,o.dateTo)
    .input('offset',sql.Int,o.offset).input('limit',sql.Int,o.limit).query(selectSQL(o.kind));
   const sets=result?.recordsets;
   if(!Array.isArray(sets)||sets.length!==3||sets.some(s=>!Array.isArray(s))||sets[0].length>1||sets[1].length!==1)throw Error();
   const counts=sets[1][0];
   if(!counts||!['total','unassignedCount','conflictCount'].every(k=>typeof counts[k]==='string'&&/^(?:0|[1-9]\d*)$/.test(counts[k])&&BigInt(counts[k])<=9223372036854775807n)||sets[2].length>o.limit)throw Error();
   return {account:sets[0][0]??null,total:counts.total,unassignedCount:counts.unassignedCount,conflictCount:counts.conflictCount,rows:sets[2]};
  }catch{throw error('BUSINESS_PARTY_HISTORY_UNAVAILABLE',503);}
 }};
}
export const canonicalBusinessPartyHistoryStore=createCanonicalBusinessPartyHistoryStore();
export default canonicalBusinessPartyHistoryStore;
