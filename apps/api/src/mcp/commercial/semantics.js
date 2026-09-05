import { fingerprint } from './cursor.js';

// Expressions below are server-owned, reviewed ERP formulas. No caller can
// supply an expression, relation, table name or database name.
export function currencyExpression(column) {
  return `CASE WHEN ${column} IN (N'$',N'USD') THEN N'USD' WHEN ${column} IN (N'€',N'EUR') THEN N'EUR' WHEN ${column} IN (N'TL',N'TRY',N'₺') THEN N'TRY' ELSE NULL END`;
}

function f(name, dataType, meaning, options = {}) {
  return { name, dataType, nullable: true, precision: 38, scale: 8, personal: false,
    meaning, meaningStatus: 'erp-mapped', aggregate: [], ...options };
}
const numeric = (name, meaning, requiredGroups) => f(name, 'decimal', meaning, { aggregate: ['sum', 'min', 'max'], requiredGroups });

function virtual(base, name, fields, from, objects, description, evidence, extraWarnings) {
  return { ...base, id: `vega.erp.${base.company}${base.period}_${name}`, objectId: undefined,
    objectName: name, template: name, from: `(${from}) AS [verified_source]`, objects,
    description, evidence, fields, primaryKey: ['source_id'], defaultFields: fields.filter(v => !v.personal).map(v => v.name).slice(0,12),
    schemaVersion: fingerprint([from,fields]).slice(0,16), rowReadBlocked: undefined,
    status: 'available', registered: true, readable: true, permission: 'allowed', virtual: true, extraWarnings };
}

export function applySemantics(datasets) {
  const map = new Map(datasets.map(d => [d.objectName, d]));
  const added = [];
  for (const d of datasets) {
    if (!d.readable) continue;
    if (d.template === 'TBLFIRMA' && !d.company) d.basePredicate = '[IND] IN (102,103,104)';
    if (d.template === 'TBLDONEM' && !d.company) d.basePredicate = '[FIND] IN (102,103,104)';
    for (const field of d.fields) {
      if (['date','datetime','datetime2','smalldatetime','datetimeoffset'].includes(field.dataType)) field.aggregate = ['min','max'];
      if (d.template === 'TBLSTOKHAREKETLERI' && ['GIREN','CIKAN'].includes(field.name)) {
        field.aggregate = ['sum','min','max'];
        field.requiredGroups = ['STOKNO','BIRIMEX'];
        field.meaning += ' Aggregate requires a single stock and source unit, or grouping by both.';
      }
    }
    if (d.source !== 'vega' || !d.company || !d.period || !d.year) continue;
    if (d.template === 'TBLSTOKHAREKETLERI') {
      const stock = map.get(d.company + 'TBLSTOKLAR');
      const units = map.get(d.company + 'TBLBIRIMLEREX');
      if (!stock?.readable || !units?.readable || !['IND','STOKKODU','MALINCINSI','KALAN','ANABIRIM','STATUS','DELETED'].every(n=>stock.fields.some(v=>v.name===n))) continue;
      const fields = [f('source_id','int','Stock-card IND.',{nullable:false}), f('stock_code','nvarchar','Source stock code.'), f('product_name','nvarchar','Source product name.'),
        f('source_unit','nvarchar','Main unit name resolved as in vegaProductService.'),
        f('erp_quantity','decimal','ERP quantity: all period GIREN minus CIKAN; card KALAN only when no period movement exists.'),
        f('quantity_basis','nvarchar','period_movements or stock_card_fallback; fallback is not proof of historical closing stock.'),
        f('active_status','int','Raw STATUS. ERP active convention is STATUS=1 and DELETED=0.'), f('deleted','bit','Raw source deletion marker.')];
      const query = `SELECT s.IND AS source_id,s.STOKKODU AS stock_code,s.MALINCINSI AS product_name,u.BIRIMADI AS source_unit,
        CASE WHEN m.movement_count>0 THEN m.quantity ELSE s.KALAN END AS erp_quantity,
        CASE WHEN m.movement_count>0 THEN N'period_movements' ELSE N'stock_card_fallback' END AS quantity_basis,
        s.STATUS AS active_status,s.DELETED AS deleted
        FROM ${stock.from} s OUTER APPLY (SELECT COUNT_BIG(*) AS movement_count,SUM(ISNULL(h.GIREN,0)-ISNULL(h.CIKAN,0)) AS quantity FROM ${d.from} h WHERE h.STOKNO=s.IND) m
        OUTER APPLY (SELECT TOP (1) b.BIRIMADI FROM ${units.from} b WHERE b.STOKNO=s.IND ORDER BY CASE WHEN ISNULL(b.VARSAYILAN,0)=1 THEN 0 ELSE 1 END,CASE WHEN ISNULL(b.ANABIRIM,0)=1 THEN 0 ELSE 1 END,b.IND) u`;
      added.push(virtual(d,'erp_stock_quantity',fields,query,[...stock.objects,...units.objects,...d.objects],
        'ERP stock quantity formula in one explicit company and period. Raw movements remain separately queryable.',
        ['apps/api/src/services/vegaProductService.js: period movement sum and card fallback'],
        ['Historical stock-card fallback is not a historical closing balance. Movement units have not been independently reconciled; do not sum different products.']));
      const outgoing=map.get(d.company+d.period+'TBLSTKCIKBASLIK');
      const incoming=map.get(d.company+d.period+'TBLSTKGIRBASLIK');
      if(d.company==='F0102'&&outgoing?.readable&&incoming?.readable){
        const linked=`COALESCE(o.IND,i.IND) IS NOT NULL AND COALESCE(o.FIRMANO,i.FIRMANO)=m.FIRMANO AND LTRIM(RTRIM(COALESCE(o.BELGENO,i.BELGENO)))=LTRIM(RTRIM(m.EVRAKNO))`;
        const sale=`LTRIM(RTRIM(m.IZAHAT))=N'33' AND ISNULL(m.IADE,0)=0 AND ISNULL(m.CIKAN,0)>0 AND ISNULL(m.TUTAR,0)>0`;
        const returned=`LTRIM(RTRIM(m.IZAHAT))=N'34' AND ISNULL(m.IADE,0)=1 AND ISNULL(m.GIREN,0)>0 AND ISNULL(m.TUTAR,0)>0`;
        const complete=`(${linked}) AND COALESCE(o.IPTAL,i.IPTAL)=0`;
        const postedFields=[f('source_id','int','Source stock movement IND.',{nullable:false}),f('stock_id','int','Source STOKNO.'),f('source_unit_id','int','Source BIRIMEX; no inferred package/series conversion.'),
          f('transaction_date','datetime','Source TARIH; constrain both period and dates.'),f('event_kind','nvarchar','ERP profitability mapping: 33/non-return/positive outgoing = sale basis; 34/return/positive incoming = sales-return basis; all others unclassified.'),
          f('erp_currency','nvarchar','TRY basis used by existing vegaProductProfitabilityService for stock movement TUTAR; matched current-period ledger documents confirm local amount before recorded KUR division.'),
          numeric('net_sales_basis_try','Signed source TUTAR, sale positive / return negative. Null if header/cancellation/ERP event mapping is incomplete. Not profit.',['erp_currency']),
          numeric('signed_quantity','Source quantity with return sign; requires one stock and unit or grouping by both.',['stock_id','source_unit_id']),
          f('recorded_currency','nvarchar','Raw movement currency; related original-currency amount requires validated recorded KUR.'),f('recorded_rate','decimal','Raw movement KUR.'),
          f('header_id','int','Same-period source header IND.'),f('document_no','nvarchar','Recorded document number; not globally unique.'),
          f('header_verified','bit','Header identity, account and document number match the posting.'),
          f('cancellation_state','nvarchar','not_cancelled/cancelled/not_recorded/unverified. Missing state is never treated as certain non-cancellation.')];
        const postedQuery=`SELECT m.IND AS source_id,m.STOKNO AS stock_id,m.BIRIMEX AS source_unit_id,m.TARIH AS transaction_date,
          CASE WHEN ${sale} THEN N'erp_sale' WHEN ${returned} THEN N'erp_sales_return' ELSE N'unclassified' END AS event_kind,
          N'TRY' AS erp_currency,
          CAST(CASE WHEN ${complete} THEN CASE WHEN ${sale} THEN m.TUTAR WHEN ${returned} THEN -m.TUTAR END END AS decimal(38,8)) AS net_sales_basis_try,
          CAST(CASE WHEN ${complete} THEN CASE WHEN ${sale} THEN m.CIKAN WHEN ${returned} THEN -m.GIREN END END AS decimal(38,8)) AS signed_quantity,
          m.PARABIRIMI AS recorded_currency,m.KUR AS recorded_rate,COALESCE(o.IND,i.IND) AS header_id,m.EVRAKNO AS document_no,
          CONVERT(bit,CASE WHEN ${linked} THEN 1 ELSE 0 END) AS header_verified,
          CASE WHEN (CASE WHEN ${linked} THEN 1 ELSE 0 END)=0 THEN N'unverified' WHEN COALESCE(o.IPTAL,i.IPTAL)=1 THEN N'cancelled' WHEN COALESCE(o.IPTAL,i.IPTAL)=0 THEN N'not_cancelled' ELSE N'not_recorded' END AS cancellation_state
          FROM ${d.from} m LEFT JOIN ${outgoing.from} o ON m.IZAHAT=N'33' AND o.IND=m.BELGENO LEFT JOIN ${incoming.from} i ON m.IZAHAT=N'34' AND i.IND=m.BELGENO
          WHERE LTRIM(RTRIM(m.IZAHAT)) IN (N'33',N'34')`;
        added.push(virtual(d,'erp_posted_sales_basis',postedFields,postedQuery,[...d.objects,...outgoing.objects,...incoming.objects],
          'ERP sales/return posting basis with verified same-period header identity and explicit cancellation completeness. Other exits, transfers and opening balances are not classified as sales.',
          ['vegaProductProfitabilityService.js: salesUnionSql','Live F0102 D0007: 31,556 posting/header links, zero missing/conflicting headers; return posting matches recorded credit.'],
          ['This is the ERP stock-posting sales basis, not all invoice families or recognized statutory revenue. Unknown header/cancellation state yields null monetary totals. No cost or profit is computed.']));
      }
    }
    if (d.template === 'TBLCARIHAREKETLERI') {
      const account = map.get(d.company + 'TBLCARI');
      if (!account?.readable) continue;
      const currency = currencyExpression('h.PARABIRIMI'), cardCurrency = currencyExpression('c.PARABIRIMI');
      const fields = [f('source_id','int','Source movement IND.',{nullable:false}), f('account_id','int','Account IND, joined by FIRMANO.'),
        f('account_code','nvarchar','Source account code.'),f('account_name','nvarchar','Source account name.'),f('transaction_date','datetime','Source TARIH.'),
        f('currency','nvarchar','USD/EUR/TRY aliases normalized; unsupported source currency stays unavailable.'),
        numeric('debit_original','BORC / KUR in recorded transaction currency. Null/zero rate is unavailable.',['currency']),
        numeric('credit_original','ALACAK / KUR in recorded transaction currency. Null/zero rate is unavailable.',['currency']),
        numeric('balance_effect','(ISNULL(BORC,0)-ISNULL(ALACAK,0))/NULLIF(KUR,0), ERP balance convention.',['currency']),
        f('rate_valid','bit','Whether recorded rate is nonzero; negative source rates are retained and must be investigated.'),
        f('movement_code','nvarchar','Raw IZAHAT; 33 is stock exit, not an independently verified sale.'), f('is_return','bit','Raw source IADE flag.'),
        f('document_no','nvarchar','Recorded document number; not a unique document identity.'),f('due_date','datetime','Source ODEMETARIHI.'),
        f('card_currency_matches','bit','Whether normalized card and movement currencies match.')];
      const query = `SELECT h.IND AS source_id,h.FIRMANO AS account_id,c.FIRMAKODU AS account_code,c.FIRMAADI AS account_name,h.TARIH AS transaction_date,
        ${currency} AS currency,CAST(h.BORC/NULLIF(h.KUR,0) AS decimal(38,8)) AS debit_original,CAST(h.ALACAK/NULLIF(h.KUR,0) AS decimal(38,8)) AS credit_original,
        CAST((ISNULL(h.BORC,0)-ISNULL(h.ALACAK,0))/NULLIF(h.KUR,0) AS decimal(38,8)) AS balance_effect,
        CONVERT(bit,CASE WHEN h.KUR IS NOT NULL AND h.KUR<>0 THEN 1 ELSE 0 END) AS rate_valid,
        h.IZAHAT AS movement_code,h.IADE AS is_return,h.EVRAKNO AS document_no,h.ODEMETARIHI AS due_date,
        CONVERT(bit,CASE WHEN ${currency}=${cardCurrency} THEN 1 ELSE 0 END) AS card_currency_matches
        FROM ${d.from} h LEFT JOIN ${account.from} c ON c.IND=h.FIRMANO
        WHERE ISNULL(h.IZAHAT,N'') NOT IN (N'30',N'31')`;
      const ledger = virtual(d,'erp_account_ledger',fields,query,[...d.objects,...account.objects],
        'ERP account balance basis, excluding codes 30 and 31. For the existing card report use card_currency_matches=true and the same card/status filters. Group by currency.',
        ['apps/api/src/services/vegaCustomerService.js','apps/api/src/services/vegaSupplierService.js'],
        ['No cross-currency total. Unsupported currencies, missing rates and cancelled-document semantics require review. This is recorded ledger effect, not confirmed collectible debt.']);
      added.push(ledger);
      if(d.company==='F0102') {
        const reportFields=[f('source_id','int','Source account movement IND.',{nullable:false}),f('account_id','int','Source FIRMANO.'),
          f('transaction_date','datetime','Source transaction date.'),f('currency','nvarchar','ERP USD/EUR/TRY currency aliases.'),
          {...numeric('report_amount','ERP sales comparison amount: positive BORC / positive KUR, rounded to decimal(19,4).',['currency']),precision:19,scale:4},
          f('is_return','bit','Raw IADE; the existing comparison report does not independently reconcile returns.')];
        const reportQuery=`SELECT h.IND AS source_id,h.FIRMANO AS account_id,h.TARIH AS transaction_date,${currency} AS currency,
          CAST(ISNULL(h.BORC,0)/NULLIF(h.KUR,0) AS decimal(19,4)) AS report_amount,h.IADE AS is_return
          FROM ${d.from} h WHERE h.TARIH>='${d.year}-01-01' AND h.TARIH<'${Number(d.year)+1}-01-01'
          AND LTRIM(RTRIM(h.IZAHAT))=N'33' AND ISNULL(h.BORC,0)>0 AND ISNULL(h.KUR,0)>0 AND ${currency} IS NOT NULL`;
        added.push(virtual(d,'erp_sales_comparison_basis',reportFields,reportQuery,d.objects,
          'Existing ERP sales-comparison basis: code 33 account postings, not a general definition of every sale. Date and currency scoped; returns/net sales require separate reconciliation.',
          ['apps/api/src/services/vegaSalesComparisonService.js: buildSalesUnion'],
          ['This reproduces the ERP comparison report only. It must not be described as independently verified net sales or invoice revenue.']));
      }
    }
  }
  return [...datasets,...added];
}
