// Engineering acceptance evidence. SELECT-only; QA/Business acceptance is external.
import fs from 'node:fs';
import path from 'node:path';
import {getTestPool,root,readSource,readRun,hash,requireRule,protectedManifest} from './vega-native-migration-runtime.mjs';
import {headers,manifest,readHistory,link,key,decimal,textDecimal,ledgerEffect,currency,clean} from './vega-native-migration-adapters.mjs';
import {makePlan as openingPlan} from './vega-2026-opening-plan.mjs';
const run=process.argv[2];
requireRule(/^m11-20260917-(before|after)$/.test(run||''),'M11_READ_RUN_REQUIRED');
const dir=path.join(root,run);fs.mkdirSync(dir);
const save=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v),{flag:'wx'});
const diffFile=path.join(dir,'record-differences.jsonl');
const counters={},checks=[],details=[];
function issue(area,reason,record,expected,actual){const k=area+'/'+reason;counters[k]=(counters[k]||0)+1;fs.appendFileSync(diffFile,JSON.stringify({area,reason,record,expected,actual})+'\n');}
const nil=v=>v==null||v===''?null:String(v);
function equal(a,b){if(a==null||a==='')return b==null||b==='';if(b==null||b==='')return false;if(/^-?\d+(\.\d{1,8})?$/.test(String(a))&&/^-?\d+(\.\d{1,8})?$/.test(String(b)))return decimal(a)===decimal(b);return String(a)===String(b);}
function field(area,k,f,expected,actual){if(!equal(expected,actual))issue(area,'FIELD_'+f,k,expected,actual);}
const pool=await getTestPool();
const query=async s=>{requireRule(/^SELECT\b/.test(s),'READ_ONLY_ACCEPTANCE');return(await pool.request().query(s)).recordset;};
const metadata=await query("SELECT t.name tableName,c.name columnName,ty.name dataType FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'dbo'");
const project=(t,fields)=>fields.filter(f=>metadata.some(c=>c.tableName===t&&c.columnName===f)).map(f=>{const ty=metadata.find(c=>c.tableName===t&&c.columnName===f).dataType;return /decimal|numeric|money|bigint/.test(ty)?`CONVERT(varchar(100),[${f}]) [${f}]`:/date|time/.test(ty)?`CONVERT(varchar(40),[${f}],126) [${f}]`:`[${f}]`;}).join(',');
async function rows(t,fields,where='1=1'){return query(`SELECT ${project(t,fields)} FROM dbo.[${t}] WHERE ${where} ORDER BY id`);}
const common=['id','source_record_key','source_payload_hash','source_document_key','original_document_date'];
function addMap(map,r,t,area){if(map.has(r.source_record_key))issue(area,'DUPLICATE_SOURCE_KEY',r.source_record_key,map.get(r.source_record_key).table,t);else map.set(r.source_record_key,{...r,table:t});}
try{
 const before=await protectedManifest(()=>pool.request());
 requireRule(before.hash===readRun('protected-before.json').hash,'TERMINAL_BASELINE_CHANGED');
 const stockDetails=readSource('plan/stockDetails.json'),cards=new Map(readSource('F0102TBLSTOKLAR.json').map(r=>[String(r.IND),r]));
 const aliases=await rows('product_source_aliases',['id','source_product_id','product_id','quantity_exact','migration_scope_status']);
 const amap=new Map(aliases.map(r=>[String(r.source_product_id),r]));
 const products=new Map((await rows('products',[...common,'stock_code','name','brand','category','current_stock_qty','is_active','migration_scope_status'])).map(r=>[String(r.id),r]));
 const terminal=await query("SELECT product_id,CONVERT(varchar(100),SUM(quantity_net)) quantity FROM dbo.inventory_effective_movements m WHERE source_type=N'sales_invoice' AND EXISTS(SELECT 1 FROM dbo.sales_invoices s WHERE s.id=m.source_id AND s.is_migrated=0) GROUP BY product_id");
 const terminalQty=new Map(terminal.map(r=>[String(r.product_id),decimal(r.quantity)]));
 const effective=new Map((await query('SELECT product_id,CONVERT(varchar(100),SUM(quantity_net)) quantity FROM dbo.inventory_effective_movements GROUP BY product_id')).map(r=>[String(r.product_id),r.quantity]));
 let eligible=0,matched=0,sourceNegative=0,targetNegative=0;
 for(const d of stockDetails){const a=amap.get(d.sourceId),p=a&&products.get(String(a.product_id)),c=cards.get(d.sourceId);
  if(d.selection.include==null)issue('product','SOURCE_SCOPE_UNKNOWN',d.sourceId,d.selection.reason,null);
  if(d.quantity==null)issue('stock','SOURCE_QUANTITY_UNKNOWN',d.sourceId,d.quantityBasis,null);
  if(d.selection.include!==true)continue;eligible++;
  if(!p){issue('product','REQUIRED_PRODUCT_MISSING',d.sourceId,d.stockCode,null);continue;}matched++;
  field('product',d.sourceId,'stock_code',c.STOKKODU,p.stock_code);field('product',d.sourceId,'name',c.MALINCINSI||c.STOKKODU,p.name);field('product',d.sourceId,'brand',c.KOD1,p.brand);field('product',d.sourceId,'category',c.KOD4,p.category);field('product',d.sourceId,'scope','IN_SCOPE',p.migration_scope_status);
  if(d.quantity!=null){const expected=decimal(d.quantity)+(terminalQty.get(String(p.id))||0n);field('stock',d.sourceId,'quantity_plus_terminal',textDecimal(expected),p.current_stock_qty);field('stock',d.sourceId,'effective_ledger',p.current_stock_qty,effective.get(String(p.id))||'0');if(decimal(d.quantity)<0n)sourceNegative++;if(decimal(p.current_stock_qty)-(terminalQty.get(String(p.id))||0n)<0n)targetNegative++;}
 }
 checks.push({area:'product',eligible,matched,totalTargetProducts:products.size},{area:'stock',sourceNegative,targetNegative,terminalEffectsSeparated:true});
 const norm=s=>String(s).trim().toLocaleUpperCase('tr-TR'),bp=readSource('plan/barcodePlan.json'),barcodes=await rows('product_barcodes',['id','product_id','barcode','is_active']);
 const bm=new Map();for(const b of barcodes){const k=norm(b.barcode);if(!bm.has(k))bm.set(k,[]);bm.get(k).push(b);}
 const barcodeManual=[];for(const c of bp.conflicts){const members=c.sourceIds.map(id=>cards.get(id));barcodeManual.push({...c,status:'Manual Decision Required',stockCodes:members.map(r=>r?.STOKKODU),reason:'BARCODE_SHARED_BY_DISTINCT_SOURCE_CARDS'});issue('barcode','SOURCE_CONFLICT',c.barcode,c.sourceIds,null);}
 let safeMatched=0,scopeMappings=0;for(const b of bp.mappings){const a=amap.get(b.canonicalSourceId);if(!a)continue;scopeMappings++;const actual=(bm.get(norm(b.barcode))||[]).filter(x=>x.is_active);if(actual.length===1&&String(actual[0].product_id)===String(a.product_id))safeMatched++;else issue('barcode','NOT_UNIQUE_ACTIVE_OWNER',b.barcode,String(a.product_id),actual.map(x=>x.product_id));}
 const gaps=readSource('plan/barcodeDifferences.json').map(g=>{const a=amap.get(g.canonicalSourceId),matches=(bm.get(norm(g.barcode))||[]).filter(b=>b.is_active);return{...g,normalizedBarcode:norm(g.barcode),resolved:matches.length===1&&String(matches[0].product_id)===String(a?.product_id),matches};});
 save('barcode-original-1120.json',gaps);save('barcode-manual-decisions.json',barcodeManual);
 checks.push({area:'barcode',scopeMappings,safeMatched,originalGaps:gaps.length,resolvedOriginalGaps:gaps.filter(g=>g.resolved).length,conflicts:bp.conflicts.length});
 console.log(JSON.stringify({phase:'products-stock-barcodes',checks}));
 const hs=headers(),hm=new Map(hs.all.map(h=>[h.key,h])),inWindow=h=>h.row.TARIH?.slice(0,10)>='2020-01-01'&&h.row.TARIH.slice(0,10)<'2026-09-18'||h.period==='D0001'&&h.row.TARIH?.startsWith('2019-12-31')&&[90,103,104].includes(+h.row.BELGETIPI);
 const docMap=new Map();for(const t of ['sales_invoices','purchase_invoices','invoice_returns','inventory_documents','financial_documents'])for(const r of await rows(t,[...common,'document_no','document_date','document_currency','currency_code','source_total','total_source','source_header_discounts_json','is_return','source_notes','description'],"source_record_key IS NOT NULL"))addMap(docMap,r,t,'document');
 const f0104=[];let eligibleHeaders=0,matchedHeaders=0;
 for(const h of hs.all){const r=docMap.get(h.key);if(h.row.IPTAL===true){if(r)issue('document','CANCELLED_IMPORTED',h.key,null,r.id);continue;}if(!inWindow(h))continue;
  if(h.company==='F0104'){f0104.push({sourceKey:h.key,documentNo:h.row.BELGENO,date:h.row.TARIH,type:h.family,return:h.row.IADE,target:r?.id??null});if(!r)issue('F0104','DOCUMENT_NOT_MATERIALIZED',h.key,h.row.BELGENO,null);continue;}
  eligibleHeaders++;if(!r){issue('document','DOCUMENT_MISSING',h.key,h.row.BELGENO,null);continue;}matchedHeaders++;
  field('document',h.key,'payload_hash',hash(h.row),r.source_payload_hash);field('document',h.key,'number',h.row.BELGENO,r.document_no);field('document',h.key,'original_date',h.row.TARIH,r.original_document_date);
  field('document',h.key,'date',h.row.TARIH.slice(0,10)<'2020-01-01'?'2020-01-01':h.row.TARIH.slice(0,10),r.document_date?.slice(0,10));
 }
 save('F0104-document-review.json',f0104);checks.push({area:'document',eligibleHeaders,matchedHeaders},{area:'F0104',headers:f0104.length,materialized:f0104.filter(r=>r.target).length});
 const lineMap=new Map();for(const t of ['sales_invoice_items','purchase_invoice_items','invoice_return_items','inventory_document_items','financial_document_items'])for(const r of await rows(t,[...common,'product_id','source_product_id','quantity_exact','unit_price_source','line_total_source','discount_rates_json','is_reference_only'],"source_record_key IS NOT NULL")){if(r.is_reference_only)continue;addMap(lineMap,r,t,'document');}
 let expectedLines=0,matchedLines=0;
 for(const t of manifest.tables.filter(t=>t.kind==='line'))for(const raw of readHistory(t.table)){const l=link(t.table,raw,hs),h=hm.get(l.headerKey);if(l.status==='EXCLUDE_CANCELLED'||h?.row.IPTAL===true||h&&!inWindow(h))continue;const k=key(t.table,raw.IND);if(t.company==='F0104')continue;if(!h){issue('document','ORPHAN_SOURCE_LINE',k,l.reason,null);continue;}expectedLines++;const r=lineMap.get(k);if(!r){issue('document','LINE_MISSING',k,l.headerKey,null);continue;}matchedLines++;
  field('document',k,'line_payload_hash',hash(raw),r.source_payload_hash);field('document',k,'line_header',h.key,r.source_document_key);field('document',k,'quantity',raw.MIKTAR,r.quantity_exact);field('document',k,'source_product_id',raw.STOKNO,r.source_product_id);
  field('document',k,'source_price',h.family.startsWith('AL')?raw.AFIYATI:raw.FIYATI??raw.AFIYATI,r.unit_price_source);field('document',k,'source_total',raw.GERCEKTOPLAM??raw.TUTAR,r.line_total_source);
  field('document',k,'discounts',JSON.stringify([1,2,3,4,5,6].map(i=>raw['ISK'+i]??null)),r.discount_rates_json);
  if(raw.STOKNO!=null&&String(raw.STOKNO)!=='0'&&!r.product_id)issue('document','LINE_PRODUCT_UNRESOLVED',k,raw.STOKNO,null);
 }
 checks.push({area:'document',expectedLines,matchedLines,uniqueNativeLines:lineMap.size});lineMap.clear();
 console.log(JSON.stringify({phase:'documents-lines',checks:checks.slice(-3),counts:counters}));
 for(const [family,tables,area]of [['CARIHAREKETLERI',['customer_movements','supplier_movements'],'movement'],['KASA',['finance_account_movements'],'movement'],['STOKHAREKETLERI',['stock_movements'],'stock']]){
  const target=new Map();for(const table of tables)for(const r of await rows(table,[...common,'balance_effect_exact','currency_code','affects_balance','movement_type','document_date','quantity_in_exact','quantity_out_exact','source_income','source_expense','source_exchange_rate','product_id'],"source_record_key LIKE N'VEGA2026/%'"))addMap(target,r,table,area);
  let expected=0,matched=0;
  for(const t of manifest.tables.filter(t=>t.family===family&&t.company!=='F0104'))for(const raw of readHistory(t.table)){const l=link(t.table,raw,hs),h=hm.get(l.headerKey);if(l.status==='EXCLUDE_CANCELLED'||h?.row.IPTAL===true||h&&!inWindow(h))continue;const k=key(t.table,raw.IND);if(!h){issue(area,'ORPHAN_'+family,k,l.reason,null);continue;}expected++;const r=target.get(k);if(!r){issue(area,'MISSING_'+family,k,h.key,null);continue;}matched++;
   field(area,k,'payload_hash',hash(raw),r.source_payload_hash);field(area,k,'header',h.key,r.source_document_key);
   if(family==='CARIHAREKETLERI'){try{const m=ledgerEffect(raw,t.company==='F0102'?'customer':'supplier');field('currency',k,'code',m.currency,r.currency_code);field('movement',k,'source_effect',m.effect,r.balance_effect_exact);}catch{issue('currency','UNSUPPORTED_SOURCE_CURRENCY',k,raw.PARABIRIMI,null);}
    if(r.affects_balance===false&&Number(raw.IZAHAT)===90&&raw.TARIH&&raw.TARIH.slice(5,10)!=='01-01')issue('movement','TYPE90_OPERATING_EFFECT_DISABLED_REVIEW',k,{date:raw.TARIH,header:h.key},r.movement_type);
   }else if(family==='STOKHAREKETLERI'){field('stock',k,'quantity_in',raw.GIREN,r.quantity_in_exact);field('stock',k,'quantity_out',raw.CIKAN,r.quantity_out_exact);if(!r.product_id)issue('stock','HISTORICAL_PRODUCT_UNRESOLVED',k,raw.STOKNO,null);}
   else{field('movement',k,'source_income',raw.GELIR,r.source_income);field('movement',k,'source_expense',raw.GIDER,r.source_expense);field('movement',k,'source_rate',raw.KUR,r.source_exchange_rate);}
  }
  checks.push({area,family,expected,matched,uniqueNative:target.size});console.log(JSON.stringify({phase:family,expected,matched}));
 }
 const op=await openingPlan(()=>pool.request());save('opening-account-check.json',op);
 checks.push({area:'opening2026',...op.summary});
 if(op.summary.differenceAccounts)issue('opening2026','OPENING_MISMATCH','aggregate',0,op.summary.differenceAccounts);
 if(op.summary.noExplicitOpeningAccounts)issue('opening2026','NO_EXPLICIT_SOURCE_OPENING','aggregate',0,op.summary.noExplicitOpeningAccounts);
 if(op.summary.rejectedSourceRecords)issue('currency','UNKNOWN_OPENING_CURRENCY','aggregate',0,op.summary.rejectedSourceRecords);
 const balanceDiff=await query(`SELECT a.id,a.currency_code,CONVERT(varchar(100),a.current_balance) stored,CONVERT(varchar(100),COALESCE(x.balance,0)) calculated FROM dbo.party_currency_accounts a OUTER APPLY(SELECT SUM(effect) balance FROM(
 SELECT CASE WHEN m.affects_balance=0 THEN 0 ELSE COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) END effect FROM dbo.customer_movements m WHERE (m.party_currency_account_id=a.id OR m.party_currency_account_id IS NULL AND m.customer_id=a.customer_id AND COALESCE(m.account_currency,m.currency_code)=a.currency_code)
 UNION ALL SELECT CASE WHEN m.affects_balance=0 THEN 0 ELSE COALESCE(m.balance_effect_exact,CONVERT(decimal(28,8),m.balance_effect)) END FROM dbo.supplier_movements m WHERE (m.party_currency_account_id=a.id OR m.party_currency_account_id IS NULL AND m.supplier_id=a.supplier_id AND COALESCE(m.account_currency,m.currency_code)=a.currency_code)) effects)x WHERE a.current_balance<>COALESCE(x.balance,0)`);
 for(const r of balanceDiff)issue('party','CURRENT_BALANCE_LEDGER_MISMATCH',r.id,r.calculated,r.stored);
 const decisions=await query("SELECT id,record_type,reason,related_source_key,source_record_key FROM dbo.migration_decisions WHERE status=N'UNRESOLVED' ORDER BY id");save('manual-decision-required.json',decisions.map(d=>({...d,status:'Manual Decision Required'})));
 const dg={};for(const d of decisions)dg[d.reason]=(dg[d.reason]||0)+1;save('decision-counts.json',dg);
 const currencyAccounts=await query('SELECT currency_code,COUNT(*) accounts FROM dbo.party_currency_accounts GROUP BY currency_code');
 checks.push({area:'currency',accounts:currencyAccounts,balanceLedgerDifferences:balanceDiff.length});
 const protectedAfter=await protectedManifest(()=>pool.request());requireRule(protectedAfter.hash===before.hash,'TERMINAL_CHANGED_DURING_READ');
 const verdict={product:!Object.keys(counters).some(k=>k.startsWith('product/')),stock:!Object.keys(counters).some(k=>k.startsWith('stock/')),barcode:!Object.keys(counters).some(k=>k.startsWith('barcode/')),party:!balanceDiff.length&&!dg.PARTY_CURRENCY_UNKNOWN&&!dg.MULTICURRENCY_IDENTITY_EVIDENCE_REQUIRED,document:!Object.keys(counters).some(k=>k.startsWith('document/')),movement:!Object.keys(counters).some(k=>k.startsWith('movement/'))&&!dg.GENERAL_LEDGER_DUAL_RELATION_REVIEW,F0104:!Object.keys(counters).some(k=>k.startsWith('F0104/')),currency:!Object.keys(counters).some(k=>k.startsWith('currency/'))&&!dg.LEDGER_CURRENCY_RATE_OR_AMOUNT_UNKNOWN,opening2026:!op.summary.differenceAccounts&&!op.summary.noExplicitOpeningAccounts&&!op.summary.rejectedSourceRecords};
 const receipt={run,target:'MELISA_ERP_FULL_TEST_20260916',sourceSnapshot:'spec-20260917-01',at:new Date().toISOString(),checks,counters,decisionCounts:dg,verdict:Object.fromEntries(Object.entries(verdict).map(([k,v])=>[k,v?'PASS':'FAIL'])),migration:Object.values(verdict).every(Boolean)?'PASS':'FAIL',qaAccepted:false,businessAccepted:false,sourceWrites:0,targetWrites:0,rollback:false,terminalHash:protectedAfter.hash};
 save('acceptance-report.json',receipt);console.log(JSON.stringify(receipt));
}finally{await pool.close();}
