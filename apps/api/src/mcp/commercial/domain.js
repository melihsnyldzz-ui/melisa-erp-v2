import { catalog } from './catalog.js';
import { queryDataset, aggregateDataset, bounded } from './service.js';
import { resolveScope, scopedDataset, requireFields, dateRange } from './scope.js';
import { exactKeys, fail } from './policy.js';
import { readQuery } from './sourcePools.js';
import { assertAdministrator } from './access.js';

const paging = ['limit','cursor'];
const scopeKeys = ['company','period'];
const eq = (field,value) => ({field,op:'eq',value});
const dates = (field,r) => [{field,op:'gte',value:r.dateFrom},{field,op:'lt',value:r.dateTo}];
function stockFilter(args, name='STOKNO') {
  if (args.stockId === undefined) return [];
  if (!Number.isSafeInteger(args.stockId) || args.stockId < 1) throw fail('INVALID_STOCK_ID');
  return [eq(name,args.stockId)];
}
async function rows(args, template, period, fields, filters=[]) {
  assertAdministrator();
  const scope = await resolveScope(args), d = await scopedDataset(scope,template,period);
  const result = await queryDataset({dataset:d.id,fields:requireFields(d,fields),filters,limit:args.limit,cursor:args.cursor});
  return {...result, requestedScope:scope, filters, emptyMeaning: result.items.length ? null : 'No matching rows in this filter; not proof of missing history.'};
}

export async function getCommercialInventory(args) {
  assertAdministrator(); exactKeys(args,scopeKeys);
  const scope=await resolveScope(args), c=await catalog();
  const groups = new Map();
  for(const d of c.datasets.filter(d => d.company === scope.company && (!d.period || d.period===scope.period))) {
    const g=groups.get(d.family)||{family:d.family,available:0,permissionRequired:0,mappingRequired:0};
    if(d.readable)g.available++; else if(d.registered)g.permissionRequired++; else g.mappingRequired++;
    groups.set(d.family,g);
  }
  return {...scope, catalogReadAt:c.readAt, families:[...groups.values()],
    periods:c.sources.find(s=>s.source==='vega').periods.filter(p=>p.company===scope.company),
    localObjects:c.datasets.filter(d=>d.source==='melisa').map(d=>({dataset:d.id,status:d.status})),
    unavailableData: ['Empty rows must be established by a bounded query in the requested scope.'],
    unsupportedFeatures: ['Verified profit without a transaction cost snapshot and product linkage.','Settled overdue receivables without payment allocation evidence.','Variant-level stock when the source only tracks a stock card.'],
    imageSource:{database:'MELISA_ERP_V2',object:'dbo.vega_product_images',status:c.map.get('melisa.dbo.vega_product_images')?.status,delivery:'get_product_image returns authenticated MCP image content when mapping permission and media root are configured.'}};
}
export async function getStockQuantities(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId']);
  const scope=await resolveScope(args), id=`vega.erp.${scope.company}${scope.period}_erp_stock_quantity`;
  const result=await queryDataset({dataset:id,filters:stockFilter(args,'source_id'),limit:args.limit,cursor:args.cursor});
  return {...result,requestedScope:scope,conversion:'No package/piece conversion. Mixed or missing movement units make the quantity unavailable.'};
}
export async function getProductUnits(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId']);
  if(args.stockId===undefined)throw fail('STOCK_ID_REQUIRED');
  return rows(args,'TBLBIRIMLEREX',false,['IND','STOKNO','BIRIMADI','CARPAN','BARCODE','ANABIRIM','VARSAYILAN'],stockFilter(args));
}
export async function getProductVariants(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId','kind']);
  if(args.stockId===undefined)throw fail('STOCK_ID_REQUIRED');
  const types={serial_numbers:['TBLSERINUMARALARI',true,['IND','STOKNO','SERINO','STOKTA','GIRBELGETIPI','GIRBELGEIND','CIKBELGETIPI','CIKBELGEIND']],series_1:['TBLSERITAN1',false,['IND','STOKNO','DEGER','SIRANO']],series_2:['TBLSERITAN2',false,['IND','STOKNO','DEGER','SIRANO']]};
  if(!Object.hasOwn(types,args.kind))throw fail('VARIANT_KIND_NOT_SUPPORTED');
  const [template,period,fields]=types[args.kind];
  const result=await rows(args,template,period,fields,stockFilter(args));
  return {...result,interpretation:'Source serial/series definitions only; no inferred color/size stock or package factor.'};
}
export async function getStockMovements(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId','dateFrom','dateTo']);
  const range=dateRange(args);
  const result=await rows(args,'TBLSTOKHAREKETLERI',true,['IND','STOKNO','TARIH','GIREN','CIKAN','BIRIMEX','IZAHAT','IADE','BELGENO','EVRAKNO','PARABIRIMI','KUR','TUTAR'],[...stockFilter(args),...dates('TARIH',range)]);
  return {...result,dateRange:range};
}
export async function getProductPrices(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId']);
  if(args.stockId===undefined)throw fail('STOCK_ID_REQUIRED');
  const result=await rows(args,'TBLBIRIMLEREX',false,['IND','STOKNO','BIRIMADI','CARPAN','BARCODE','SATISFIYATI','SPARABIRIMI',...Array.from({length:6},(_,i)=>[`SATISFIYATI${i+1}`,`PB${i+1}`]).flat()],stockFilter(args));
  return {...result,interpretation:'Recorded source price slots per unit and currency; not a quotation. No default currency or conversion.'};
}
export async function getProductCosts(args) {
  exactKeys(args,[...scopeKeys,...paging,'stockId','dateFrom','dateTo']);
  if(args.stockId===undefined)throw fail('STOCK_ID_REQUIRED');
  const range=dateRange(args);
  const result=await rows(args,'TBLSTOKHAREKETLERI',true,['IND','STOKNO','TARIH','BIRIMEX','BIRIMMALIYET','SATISBIRIMMALIYETI','PARABIRIMI','KUR'],[...stockFilter(args),...dates('TARIH',range)]);
  return {...result,dateRange:range,verifiedCost:null,profit:null,profitStatus:'UNSUPPORTED_UNVERIFIED_COST_SNAPSHOT',
    interpretation:'Raw recorded cost fields only. Field names/zeros do not prove usable cost. Existing ERP profitability links F0103 purchases to F0102 sales through match suggestions; this MCP does not treat those as verified transaction snapshots.'};
}
export async function listAccounts(args) {
  exactKeys(args,[...scopeKeys,...paging,'accountId']);
  const filters=args.accountId===undefined?[]:[eq('IND',args.accountId)];
  return rows(args,'TBLCARI',false,['IND','FIRMAKODU','FIRMAADI','PARABIRIMI','KOD1','STATUS','DELETED'],filters);
}
export async function getAccountLedger(args) {
  exactKeys(args,[...scopeKeys,...paging,'accountId','dateFrom','dateTo']);
  if(!Number.isSafeInteger(args.accountId)||args.accountId<1)throw fail('ACCOUNT_ID_REQUIRED');
  const range=dateRange(args), scope=await resolveScope(args);
  const result=await queryDataset({dataset:`vega.erp.${scope.company}${scope.period}_erp_account_ledger`,filters:[eq('account_id',args.accountId),...dates('transaction_date',range)],limit:args.limit,cursor:args.cursor});
  return {...result,dateRange:range};
}
export async function getAccountBalance(args) {
  exactKeys(args,[...scopeKeys,'accountId','dateFrom','dateTo']);
  if(!Number.isSafeInteger(args.accountId)||args.accountId<1)throw fail('ACCOUNT_ID_REQUIRED');
  const range=dateRange(args), scope=await resolveScope(args);
  const result=await aggregateDataset({dataset:`vega.erp.${scope.company}${scope.period}_erp_account_ledger`,filters:[eq('account_id',args.accountId),...dates('transaction_date',range)],groupBy:['currency','card_currency_matches'],metrics:[{op:'count',as:'movement_count'},{op:'sum',field:'balance_effect',as:'balance_effect'},{op:'sum',field:'debit_original',as:'debit'},{op:'sum',field:'credit_original',as:'credit'}]});
  return {...result,dateRange:range,balanceMeaning:'Net recorded effect within the explicit period/date range; not an all-history opening/closing or confirmed collectible balance.',overdueBalance:null,dueStatus:'Payment allocation has not been verified; recorded due dates are available in get_account_ledger.'};
}
export async function listCommercialDocuments(args) {
  exactKeys(args,[...scopeKeys,...paging,'kind','returns','dateFrom','dateTo']);
  const kinds={sale_stock_exit:'TBLSTKCIKBASLIK',purchase_stock_entry:'TBLSTKGIRBASLIK',sales_invoice:'TBLSATFATBASLIK',purchase_invoice:'TBLALFATBASLIK'};
  if(!Object.hasOwn(kinds,args.kind))throw fail('DOCUMENT_KIND_NOT_SUPPORTED');
  if(args.returns!==undefined&&typeof args.returns!=='boolean')throw fail('INVALID_ARGUMENTS');
  const range=dateRange(args), filters=dates('TARIH',range);
  if(args.returns!==undefined)filters.push(eq('IADE',args.returns));
  const result=await rows(args,kinds[args.kind],true,['IND','FIRMANO','BELGENO','TARIH','TUTAR','PARABIRIMI','KUR','IADE','IPTAL'],filters);
  return {...result,dateRange:range,interpretation:'Recorded documents including explicit cancellation/return state; listing is not a recognized revenue total.'};
}

export async function searchCatalog(args) {
  exactKeys(args,['query','limit','cursor']);
  const scope=await resolveScope({}), d=await scopedDataset(scope,'TBLSTOKLAR');
  const {compileQuery}=await import('./compiler.js');
  const {sealCursor}=await import('./cursor.js');
  const filters=[eq('STATUS',1),eq('DELETED',false),eq('IPTAL',false)];
  if(args.query!==undefined)filters.push({field:'STOKKODU',op:'contains',value:args.query});
  const fields=requireFields(d,['STOKKODU','MALINCINSI','KOD1','KOD4']);
  const compiled=compileQuery({...d,fields:d.fields.filter(f=>[...fields,'IND','STATUS','DELETED','IPTAL'].includes(f.name))},{dataset:d.id,fields,filters,limit:args.limit,cursor:args.cursor});
  const result=await readQuery('vega',d.objects,compiled.statement,compiled.parameters), page=result.slice(0,compiled.limit);
  return bounded({...scope,items:page.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]??null]))),hasMore:result.length>compiled.limit,nextCursor:result.length>compiled.limit?sealCursor(compiled.binding,compiled.keys.map(k=>page.at(-1)[k])):null,
    scope:'Public-safe current product labels only; no prices, exact stock, costs or account information.'});
}

export const domainHandlers={get_commercial_inventory:getCommercialInventory,get_stock_quantities:getStockQuantities,get_product_units:getProductUnits,get_product_variants:getProductVariants,get_stock_movements:getStockMovements,get_product_prices:getProductPrices,get_product_costs:getProductCosts,list_accounts:listAccounts,get_account_ledger:getAccountLedger,get_account_balance:getAccountBalance,list_commercial_documents:listCommercialDocuments,search_catalog:searchCatalog};
