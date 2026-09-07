import { dataset } from './catalog.js';
import { resolveScope, scopedDataset, requireFields, dateRange } from './scope.js';
import { exactKeys, fail } from './policy.js';
import { readQuery, sql } from './sourcePools.js';
import { fingerprint, sealCursor, openCursor } from './cursor.js';
import { pageLimit } from './compiler.js';
import { bounded } from './service.js';
import { assertAdministrator } from './access.js';

function reportPage(args, scope, kind, schema) {
  const range=dateRange(args),limit=pageLimit(args.limit);
  const binding=fingerprint({kind,company:scope.company,period:scope.period,range,dimension:args.dimension,schema});
  const after=args.cursor===undefined?0:openCursor(args.cursor,binding);
  if(!Number.isSafeInteger(after)||after<0||after>10000000)throw fail('INVALID_OR_EXPIRED_CURSOR');
  return {range,limit,binding,parameters:[{name:'from',type:sql.Date,value:range.dateFrom},{name:'to',type:sql.Date,value:range.dateTo},{name:'after',type:sql.Int,value:after}]};
}
async function finish(scope, page, objects, statement, interpretation) {
  const result=await readQuery('vega',objects,statement,page.parameters),items=result.slice(0,page.limit);
  const hasMore=result.length>page.limit;
  return bounded({...scope,dateRange:page.range,items,hasMore,nextCursor:hasMore?sealCursor(page.binding,Number(items.at(-1).row_no)):null,
    interpretation,scope:'Complete matching SQL filter before report pagination; one company/period and explicit dates. Live pages are not a snapshot.',
    warnings:['Null values are unknown. No package or currency conversion is inferred.','Absent earlier periods are not zero activity. Current card labels may differ from historical labels.','These are operational source measures, not statutory revenue or accounting profit.']});
}

export async function getSalesReport(args) {
  assertAdministrator();
  exactKeys(args,['company','period','dateFrom','dateTo','dimension','limit','cursor']);
  if(!['product','brand','customer','country'].includes(args.dimension))throw fail('REPORT_DIMENSION_NOT_SUPPORTED');
  const scope=await resolveScope(args);
  const posted=await dataset(`vega.erp.${scope.company}${scope.period}_erp_posted_sales_basis`);
  const stock=await scopedDataset(scope,'TBLSTOKLAR'),accounts=await scopedDataset(scope,'TBLCARI'),movements=await scopedDataset(scope,'TBLSTOKHAREKETLERI',true);
  requireFields(stock,['IND','STOKKODU','KOD1']); requireFields(accounts,['IND','KOD1']); requireFields(movements,['IND','FIRMANO']);
  const page=reportPage(args,scope,'sales', [posted.schemaVersion,stock.schemaVersion,accounts.schemaVersion]);
  const dimension={product:'CONVERT(nvarchar(120),p.stock_id)',brand:'NULLIF(LTRIM(RTRIM(s.KOD1)),N\'\')',customer:'CONVERT(nvarchar(120),m.FIRMANO)',country:'NULLIF(LTRIM(RTRIM(c.KOD1)),N\'\')'}[args.dimension];
  const product=args.dimension==='product';
  const unit=product?'p.source_unit_id':'CAST(NULL AS int)';
  const quantity=product?'CASE WHEN COUNT_BIG(p.signed_quantity)=COUNT_BIG(*) AND COUNT_BIG(p.source_unit_id)=COUNT_BIG(*) THEN SUM(p.signed_quantity) END':'CAST(NULL AS decimal(38,8))';
  const grouped=`SELECT ${dimension} AS entity, ${unit} AS unit_id,
    ${product?'MAX(s.STOKKODU)':'CAST(NULL AS nvarchar(120))'} AS stock_code,
    COUNT_BIG(*) AS source_rows,
    COUNT_BIG(*)-COUNT_BIG(p.net_sales_basis_try) AS incomplete_rows,
    CASE WHEN COUNT_BIG(p.net_sales_basis_try)=COUNT_BIG(*) THEN SUM(p.net_sales_basis_try) END AS amount_try,
    ${quantity} AS signed_quantity,
    SUM(CASE WHEN p.event_kind=N'erp_sale' THEN 1 ELSE 0 END) AS sale_rows,
    SUM(CASE WHEN p.event_kind=N'erp_sales_return' THEN 1 ELSE 0 END) AS return_rows
    FROM ${posted.from.replace(/ AS \[verified_source\]$/, '')} p LEFT JOIN ${stock.from} s ON s.IND=p.stock_id
    LEFT JOIN ${movements.from} m ON m.IND=p.source_id LEFT JOIN ${accounts.from} c ON c.IND=m.FIRMANO
    WHERE p.transaction_date>=@from AND p.transaction_date<@to
    GROUP BY ${dimension}${product?',p.source_unit_id':''}`;
  const statement=`SELECT TOP (${page.limit+1}) CONVERT(int,row_no) AS row_no,entity,unit_id,stock_code,
    CONVERT(varchar(100),source_rows) AS source_rows,CONVERT(varchar(100),incomplete_rows) AS incomplete_rows,
    CONVERT(varchar(100),amount_try) AS net_sales_basis_try,N'TRY' AS amount_currency,
    CONVERT(varchar(100),signed_quantity) AS signed_quantity,sale_rows,return_rows,
    CONVERT(varchar(100),scope_source_rows) AS scope_source_rows,CONVERT(varchar(100),scope_incomplete_rows) AS scope_incomplete_rows
    FROM (SELECT ROW_NUMBER() OVER (ORDER BY CASE WHEN amount_try IS NULL THEN 1 ELSE 0 END,amount_try DESC,entity,unit_id) AS row_no,
      SUM(source_rows) OVER () AS scope_source_rows,SUM(incomplete_rows) OVER () AS scope_incomplete_rows,g.* FROM (${grouped}) g) ranked
    WHERE row_no>@after ORDER BY row_no OPTION (MAXDOP 1)`;
  const result=await finish(scope,page,[...posted.objects,...stock.objects,...accounts.objects,...movements.objects],statement,
    'Ranked ERP posted sales basis, including signed returns; unknown classification/header/cancellation gives a null group total. Product ranks retain stock-specific units. Brand/customer/country quantities are not combined. Country is recorded TBLCARI.KOD1 as in vegaCustomerService; no country is inferred from phone/address.');
  const first=result.items[0];
  return {...result,coverage:{sourceRows:first?.scope_source_rows??null,incompleteRows:first?.scope_incomplete_rows??null,
    rankingComplete:first?first.scope_incomplete_rows==='0':null,
    warning:'Any incomplete source row makes the overall ranking partial, even if this page contains only complete groups. Empty pages do not imply zero source history.'}};
}

export async function getInventoryReport(args) {
  assertAdministrator();
  exactKeys(args,['company','period','dateFrom','dateTo','kind','limit','cursor']);
  if(!['no_sales','decreasing','below_recorded_threshold'].includes(args.kind))throw fail('REPORT_KIND_NOT_SUPPORTED');
  const scope=await resolveScope(args),stock=await scopedDataset(scope,'TBLSTOKLAR'),movements=await scopedDataset(scope,'TBLSTOKHAREKETLERI',true);
  const quantity=await dataset(`vega.erp.${scope.company}${scope.period}_erp_stock_quantity`);
  const posted=await dataset(`vega.erp.${scope.company}${scope.period}_erp_posted_sales_basis`);
  requireFields(stock,['IND','BIRIMEX','KRITIKSEVIYE','STATUS','DELETED','IPTAL']);
  const page=reportPage(args,scope,args.kind,[quantity.schemaVersion,posted.schemaVersion,stock.schemaVersion]);
  const delta=`CASE WHEN COUNT_BIG(m.GIREN)=COUNT_BIG(*) AND COUNT_BIG(m.CIKAN)=COUNT_BIG(*) AND COUNT_BIG(m.BIRIMEX)=COUNT_BIG(*) AND COUNT(DISTINCT m.BIRIMEX)=1 THEN SUM(m.GIREN-m.CIKAN) END`;
  const window=`SELECT m.STOKNO,${delta} AS quantity_delta,MIN(m.BIRIMEX) AS unit_id,COUNT_BIG(*) AS movement_rows
    FROM ${movements.from} m WHERE m.TARIH>=@from AND m.TARIH<@to GROUP BY m.STOKNO`;
  const sales=`SELECT p.stock_id,COUNT_BIG(*) AS posted_rows,
    SUM(CASE WHEN p.net_sales_basis_try IS NULL THEN 1 ELSE 0 END) AS incomplete_rows,
    SUM(CASE WHEN p.event_kind=N'erp_sale' AND p.net_sales_basis_try IS NOT NULL THEN 1 ELSE 0 END) AS sales_rows
    FROM ${posted.from.replace(/ AS \[verified_source\]$/, '')} p WHERE p.transaction_date>=@from AND p.transaction_date<@to GROUP BY p.stock_id`;
  // Absence is established by a successful complete anti-join in this exact
  // window, not by treating an unknown scalar from a source row as zero.
  const conditions={
    no_sales:'q.erp_quantity>0 AND (a.stock_id IS NULL OR (a.sales_rows=0 AND a.incomplete_rows=0))',
    decreasing:'w.quantity_delta<0 AND w.unit_id=q.source_unit_id',
    below_recorded_threshold:'q.erp_quantity<s.KRITIKSEVIYE AND s.KRITIKSEVIYE IS NOT NULL AND q.source_unit_id=s.BIRIMEX',
  };
  const inner=`SELECT q.source_id,q.stock_code,q.source_unit,q.source_unit_id,q.erp_quantity,q.quantity_basis,
    w.quantity_delta,w.unit_id AS delta_unit_id,w.movement_rows,s.KRITIKSEVIYE AS recorded_threshold,
    a.sales_rows,a.incomplete_rows,
    ROW_NUMBER() OVER (ORDER BY q.source_id) AS row_no
    FROM ${quantity.from.replace(/ AS \[verified_source\]$/, '')} q JOIN ${stock.from} s ON s.IND=q.source_id
    LEFT JOIN (${window}) w ON w.STOKNO=q.source_id LEFT JOIN (${sales}) a ON a.stock_id=q.source_id
    WHERE s.STATUS=1 AND s.DELETED=0 AND s.IPTAL=0 AND ${conditions[args.kind]}`;
  const statement=`SELECT TOP (${page.limit+1}) CONVERT(int,row_no) AS row_no,source_id,stock_code,source_unit,source_unit_id,
    CONVERT(varchar(100),erp_quantity) AS current_quantity,quantity_basis,CONVERT(varchar(100),quantity_delta) AS window_quantity_delta,
    delta_unit_id,CONVERT(varchar(100),movement_rows) AS window_movement_rows,
    CONVERT(varchar(100),recorded_threshold) AS recorded_threshold,sales_rows,incomplete_rows
    FROM (${inner}) ranked WHERE row_no>@after ORDER BY row_no OPTION (MAXDOP 1)`;
  const result=await finish(scope,page,[...quantity.objects,...posted.objects,...stock.objects],statement,
    args.kind==='no_sales'?'Dead-stock candidates: positive current recorded stock with no verified sales and no ambiguous 33/34 postings in the requested window. Not lifetime dead stock; new receipts and unavailable earlier history require review.':args.kind==='decreasing'?'Negative net movement in the requested window, retaining one recorded stock unit; not a future stock forecast.':'Below recorded stock-card threshold; not the one-series business threshold, because a package/series conversion is not established.');
  return {...result,historyCompleteness:'Only the requested period/date window was examined; no assertion of complete lifetime history.',
    excludedScope:'Inactive/deleted/cancelled cards are excluded. Conditions requiring unknown quantities, mixed units or an unverified threshold unit cannot produce a candidate; this is not an exhaustive stock-risk list.'};
}
