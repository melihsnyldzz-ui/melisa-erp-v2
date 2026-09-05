import { catalog, dataset, datasetSummary } from './catalog.js';
import { compileQuery, compileAggregate, field, pageLimit } from './compiler.js';
import { readQuery } from './sourcePools.js';
import { fingerprint, sealCursor, openCursor } from './cursor.js';
import { exactKeys, plainObject, fail, warnings } from './policy.js';

export function bounded(value) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 192000) throw fail('OUTPUT_LIMIT_USE_FEWER_FIELDS_OR_SMALLER_PAGE');
  return value;
}

function envelope(d) {
  return { source: d.source, database: d.source === 'vega' ? 'VEGA2026' : 'MELISA_ERP_V2',
    dataset: d.id, objects: d.objects, company: d.company, period: d.period, periodYear: d.year,
    scope: d.period ? 'one company and period' : d.company ? 'company card/reference data; not a historical snapshot' : 'configured source; company/period may be row fields',
    readAt: new Date().toISOString(), unitsAndCurrencies: {
      fields: d.fields.filter(f => /BIRIM|PARABIRIMI|currency|source_unit|^unit$|^APB$|^PB\d*$|^SPARABIRIMI$/.test(f.name)).map(f=>f.name),
      warning: 'Raw price/amount currency and quantity units must be read from the related source fields. Missing metadata does not imply TRY or pieces.',
    }, warnings: [...warnings,...(d.extraWarnings || [])] };
}

async function executePage(d, compiled) {
  const rows = await readQuery(d.source, d.objects, compiled.statement, compiled.parameters);
  const page = rows.slice(0, compiled.limit);
  if (page.some(row => Object.values(row).some(v => typeof v === 'string' && v.length > 4000))) throw fail('FIELD_OUTPUT_TOO_LARGE_SELECT_FEWER_FIELDS');
  const hasMore = rows.length > compiled.limit;
  const nextCursor = hasMore ? sealCursor(compiled.binding, compiled.keys.map(k => page.at(-1)[k])) : null;
  const items = page.map(row => Object.fromEntries(compiled.requested.map(k => [k,row[k] ?? null])));
  return bounded({ ...envelope(d), items, pageSize: items.length, hasMore, nextCursor });
}

export async function queryDataset(args) {
  const d = await dataset(args?.dataset);
  return executePage(d, compileQuery(d,args));
}

export async function aggregateDataset(args) {
  const d = await dataset(args?.dataset);
  const page = await executePage(d,compileAggregate(d,args));
  return { ...page, aggregationScope: 'Entire matching database filter, before result pagination. Decimal amounts and counts are exact strings; null totals signal incomplete source values.' };
}

export async function listDatasets(args = {}) {
  exactKeys(args,['source','family','company','period','status','search','limit','cursor']);
  for (const k of ['source','family','company','period','status','search']) if (args[k] !== undefined && (typeof args[k] !== 'string' || args[k].length > 120)) throw fail('INVALID_CATALOG_FILTER');
  const c = await catalog(), limit = pageLimit(args.limit);
  let rows = c.datasets.filter(d => ['source','family','company','period','status'].every(k => args[k] === undefined || d[k] === args[k]));
  if (args.search) rows = rows.filter(d => `${d.id} ${d.description}`.toLocaleLowerCase('tr').includes(args.search.toLocaleLowerCase('tr')));
  const total = rows.length;
  const binding = fingerprint({ type:'catalog', version:c.readAt, ...Object.fromEntries(Object.entries(args).filter(([k])=>!['cursor','limit'].includes(k))) });
  if (args.cursor !== undefined) {
    const id = openCursor(args.cursor,binding);
    const index = rows.findIndex(d=>d.id===id);
    if (index < 0) throw fail('INVALID_OR_EXPIRED_CURSOR');
    rows = rows.slice(index+1);
  }
  const page = rows.slice(0,limit),hasMore=rows.length>limit;
  return bounded({ readAt:new Date().toISOString(), catalogReadAt:c.readAt, source:args.source||'configured sources, separately identified',
    company:args.company||null,period:args.period||null,unitsAndCurrencies:'Dataset-specific; not combined.',
    sources:c.sources.map(s=>({source:s.source,database:s.database,status:s.status||'available',code:s.code,objectsVisible:s.objectsVisible,securityObjectsExcluded:s.excludedObjects,
      rowQueryable:s.datasets.filter(d=>d.readable&&!d.rowReadBlocked).length,aggregateQueryable:s.datasets.filter(d=>d.readable).length,
      noSafeUniqueKey:s.datasets.filter(d=>d.rowReadBlocked).length,permissionOrSchemaRequired:s.datasets.filter(d=>d.status==='permission-or-schema-required').length,
      virtualDatasets:s.datasets.filter(d=>d.virtual).length,companies:s.companies,periods:s.periods})),
    matchingDatasets:total,items:page.map(datasetSummary),hasMore,nextCursor:hasMore?sealCursor(binding,page.at(-1).id):null,
    warnings:[...warnings,'Catalog cursors expire when schema metadata refreshes. Security/configuration objects are excluded. No metadata visibility is not proof of absence.'] });
}

export async function describeDataset(args) {
  exactKeys(args,['dataset','limit','cursor']);
  const d=await dataset(args.dataset),limit=pageLimit(args.limit);
  const binding=fingerprint({type:'fields',id:d.id,schema:d.schemaVersion});
  const offset=args.cursor===undefined?0:openCursor(args.cursor,binding);
  if(!Number.isInteger(offset)||offset<0||offset>d.fields.length)throw fail('INVALID_OR_EXPIRED_CURSOR');
  const fields=d.fields.slice(offset,offset+limit).map(({objectId,ordinal,...f})=>f);
  const hasMore=offset+limit<d.fields.length;
  return bounded({...envelope(d),...datasetSummary(d),evidence:d.evidence,primaryKey:d.primaryKey,defaultFields:d.defaultFields,
    relationships:d.relationships||[],relationshipWarning:'Only verified SQL foreign keys or explicitly described ERP document relations are provided. An empty list is not proof that no business relationship exists.',
    allowedFields:d.fields.length,fields,hasMore,nextCursor:hasMore?sealCursor(binding,offset+limit):null,
    operations:{filters:['eq','ne','lt','lte','gt','gte','in','contains','is_null'],rowsPerPage:50,fieldLimit:40,filterLimit:12,timeoutMs:12000,
      aggregates:'count/count_distinct; sum/min/max only when listed on the field, with required currency/unit scope.',
      personalData:'Explicitly select personal fields with includePersonalData=true, a purpose, and equality on every primary-key field.'},
    documentRelation:['TBLALFATBASLIK','TBLSATFATBASLIK'].includes(d.template)?'Header IND -> same-scope invoice line EVRAKNO; vendor description, ERP purchase mapping and live sales relation checks.':null });
}

export async function getRecord(args) {
  exactKeys(args,['dataset','key','fields','includePersonalData','purpose']);
  const d=await dataset(args.dataset);
  if(!d.primaryKey.length||!plainObject(args.key)||Object.keys(args.key).length!==d.primaryKey.length||d.primaryKey.some(k=>args.key[k]===undefined))throw fail('EXACT_PRIMARY_KEY_REQUIRED');
  const filters=d.primaryKey.map(k=>({field:k,op:'eq',value:args.key[k]}));
  const result=await queryDataset({dataset:d.id,fields:args.fields,filters,limit:1,includePersonalData:args.includePersonalData,purpose:args.purpose});
  return {...result,record:result.items[0]||null};
}

export async function getDocument(args) {
  exactKeys(args,['dataset','key','headerFields','lineFields','limit','cursor']);
  const head=await dataset(args.dataset);
  if(head.source!=='vega'||!['TBLALFATBASLIK','TBLSATFATBASLIK'].includes(head.template)||!head.company||!head.period||head.primaryKey.join(',')!=='IND')throw fail('DOCUMENT_RELATION_NOT_VERIFIED');
  const line=await dataset(`vega.dbo.${head.company}${head.period}${head.template.replace('BASLIK','HAREKET')}`);
  if(field(line,'EVRAKNO').dataType!=='int')throw fail('DOCUMENT_RELATION_NOT_VERIFIED');
  const header=await getRecord({dataset:head.id,key:args.key,fields:args.headerFields});
  if(!header.record)throw fail('DOCUMENT_NOT_FOUND');
  const filters=[{field:'EVRAKNO',op:'eq',value:args.key.IND}];
  const lines=await queryDataset({dataset:line.id,fields:args.lineFields,filters,limit:args.limit,cursor:args.cursor});
  const count=await aggregateDataset({dataset:line.id,filters,metrics:[{op:'count',as:'line_count'}]});
  return bounded({...envelope(head),record:header.record,lines:lines.items,lineDataset:line.id,totalLines:count.items[0].line_count,
    hasMore:lines.hasMore,nextCursor:lines.nextCursor,relation:{headerKey:'IND',lineForeignKey:'EVRAKNO',evidence:head.template==='TBLALFATBASLIK'?'vegaSupplierLedgerService.js':'Vendor invoice descriptions + live F0104 D0007 full line/header integrity check'},
    warnings:[...header.warnings,'Header and lines are separate live SELECT reads; concurrent edits can change them. Recorded totals, returns and cancellation flags are not a calculated invoice audit.']});
}

export const commercialHandlers={list_datasets:listDatasets,describe_dataset:describeDataset,query_dataset:queryDataset,aggregate_dataset:aggregateDataset,get_record:getRecord,get_document:getDocument};
