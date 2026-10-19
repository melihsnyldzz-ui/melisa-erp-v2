// Pure, offline source inventory and INERT plan. Never imports a migration,
// emits executable SQL, connects to a database, or grants runtime authority.
import {createHash} from 'node:crypto';

export const SOURCE_SHA='691f889aa9e87f1c0b840963621add48387699f9';
export const SYNTHETIC_TARGET=Object.freeze({server:'erp-sql',database:'MELISA_CLOUD_FULL_TEST_20261019',applicationLogin:'melisa_cloud_full_app',readerLogin:'melisa_cloud_full_reader',apiPort:4810,nativePort:4811,webPort:5810});
const check=(ok,code)=>{if(!ok)throw new Error(code);};
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const preparationDigest=value=>createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
export const sourceFileAllowed=path=>typeof path==='string'&&!path.split('/').some(p=>p.startsWith('.')||p==='..')
  && /^(?:infra\/sql\/.*\.sql|scripts\/.*\.(?:mjs|sql)|apps\/api\/(?:src|scripts)\/.*\.(?:js|mjs))$/.test(path)
  && !/(?:\.test\.|(?:^|\/)test-|(?:^|\/)smoke|^scripts\/ci\/)/i.test(path)
  && (!/fixture/i.test(path)||/^scripts\/canonical\/enable-test-work-finops-fixture\.(?:mjs|sql)$/.test(path));
const cleanComments=text=>text.replace(/\/\*[\s\S]*?\*\//g,s=>s.replace(/[^\n]/g,' ')).replace(/^\s*(?:\/\/|--).*$/gm,s=>s.replace(/[^\n]/g,' '));
const lineAt=(s,i)=>s.slice(0,i).split('\n').length;
const qualified=String.raw`(?:\[dbo\]|dbo)\s*\.\s*(?:\[[a-zA-Z_][\w]*\]|[a-zA-Z_][\w]*)`;
const normalize=s=>s.replace(/[\[\]\s]/g,'').toLowerCase();
const literalConstants=text=>{
  const values=new Map();
  for(const m of text.matchAll(/(?:\b(?:export\s+)?const\s+|[,;]\s*)([A-Z][A-Z0-9_]*)\s*=\s*(['"`])([^'"`\r\n]*)\2/g)) {
    if(!m[3].includes('${'))values.set(m[1],m[3]);
  }
  return values;
};
const exactMissingBases=[
  'invoice_returns','invoice_return_items',
  'test_daily_accounts','test_daily_drafts','test_daily_requests','test_daily_scope',
  'test_purchase_warehouses','test_purchase_scope','test_purchase_links','test_purchase_requests',
  'test_goods_receipts','test_sales_scope','test_sales_requests',
  'test_finance_accounts','test_finance_requests',
  'test_payment_accounts','test_payment_invoices','test_payment_requests','test_payment_suppliers',
  'test_refund_scope','test_refund_requests','test_stock_reversals',
  'customer_routes','customer_route_assignments','terminal_device_customer_routes',
].map(x=>'dbo.'+x).sort();

export function buildSourceInventory(input) {
  check(Array.isArray(input)&&input.length>0,'SOURCE_FILES_REQUIRED');
  const paths=new Set();
  const files=[...input].sort((a,b)=>a.path.localeCompare(b.path,'en')).map(f=>{
    check(sourceFileAllowed(f.path)&&typeof f.text==='string'&&!paths.has(f.path),'SOURCE_PATH_REJECTED');paths.add(f.path);
    return {...f,clean:cleanComments(f.text),constants:literalConstants(cleanComments(f.text))};
  });
  // Unique literal constants may be imported by another source file. Ambiguous
  // names stay unresolved; no JS evaluation or runtime module import occurs.
  const constants=new Map();
  for(const f of files)for(const [k,v]of f.constants){const values=constants.get(k)||new Set();values.add(v);constants.set(k,values);}
  const objects=new Map(),unresolvedTemplates=[],foreignKeyReferences=[],indexes=[];
  const object=name=>{if(!objects.has(name))objects.set(name,{name,scope:/^dbo\.(?:f0\d|tbl|backupset)/.test(name)?'HISTORICAL_OR_SYSTEM_REFERENCE':'APPLICATION_OR_UNCLASSIFIED',declarations:[],references:[]});return objects.get(name);};
  for(const f of files) {
    const text=f.clean.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g,(whole,k)=>f.constants.get(k)??(constants.get(k)?.size===1?[...constants.get(k)][0]:whole));
    const valid=(m,end)=>!text.slice(end).startsWith('${')&&!m.endsWith('_');
    for(const m of text.matchAll(new RegExp(qualified,'gi'))) {
      if(!valid(m[0],m.index+m[0].length))continue;
      const o=object(normalize(m[0]));
      if(!o.references.some(x=>x.path===f.path))o.references.push({path:f.path,line:lineAt(text,m.index)});
    }
    for(const m of text.matchAll(new RegExp(String.raw`\b(CREATE(?:\s+OR\s+ALTER)?|ALTER)\s+(TABLE|PROCEDURE|PROC|FUNCTION|VIEW|TRIGGER)\s+(${qualified})`,'gi'))) {
      if(!valid(m[3],m.index+m[0].length))continue;
      object(normalize(m[3])).declarations.push({path:f.path,line:lineAt(text,m.index),kind:m[2].toUpperCase().replace(/^PROC$/,'PROCEDURE'),form:m[1].toUpperCase().startsWith('CREATE')?'CREATE':'ALTER',capture:'LITERAL_SQL_TEXT'});
    }
    for(const m of text.matchAll(new RegExp(String.raw`\bREFERENCES\s+(${qualified})\s*\(([^)\r\n]{1,150})\)`,'gi'))) {
      if(valid(m[1],m.index+m[0].indexOf(m[1])+m[1].length))foreignKeyReferences.push({path:f.path,line:lineAt(text,m.index),referencedObject:normalize(m[1]),referencedColumns:m[2].replace(/[\[\]\s]/g,'').toLowerCase()});
    }
    for(const m of text.matchAll(new RegExp(String.raw`\bCREATE\s+(UNIQUE\s+)?(?:(?:NON)?CLUSTERED\s+)?INDEX\s+(\[?[\w]+\]?)\s+ON\s+(${qualified})`,'gi'))) {
      if(valid(m[3],m.index+m[0].length))indexes.push({path:f.path,line:lineAt(text,m.index),name:normalize(m[2]),table:normalize(m[3]),unique:!!m[1]});
    }
    // This specific source helper is reviewed: create(name,cols) adds an id PK,
    // supplied nullable columns and six common provenance columns. Its full
    // migration module also reads source data; it MUST NOT be imported/replayed.
    if(f.path==='apps/api/scripts/vega-native-migration-store.mjs')for(const m of text.matchAll(/\bawait\s+create\(\s*['"]([a-z][a-z0-9_]+)['"]\s*,/g)) {
      object('dbo.'+m[1]).declarations.push({path:f.path,line:lineAt(text,m.index),kind:'TABLE',form:'CREATE',capture:'REVIEWED_STATIC_HELPER_CALL'});
    }
    for(const m of text.matchAll(/\b(?:CREATE|ALTER)\s+(?:OR\s+ALTER\s+)?(?:TABLE|PROCEDURE|PROC|FUNCTION|VIEW|TRIGGER)\s+[^\r\n;]{0,100}?\$\{/gi))unresolvedTemplates.push({path:f.path,line:lineAt(text,m.index)});
  }
  const inventory=[...objects.values()].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(o=>({...o,
    state:o.declarations.some(d=>d.form==='CREATE'&&d.capture==='LITERAL_SQL_TEXT')?'SOURCE_CREATE_FOUND':o.declarations.some(d=>d.form==='CREATE')?'SOURCE_HELPER_CREATE_FOUND':o.declarations.length?'ALTER_ONLY_NO_BASE_CREATE':'NO_CREATE_CAPTURED',
    freshInstallValidated:false,
  }));
  return {schemaVersion:'melisa-full-erp-source-inventory.v1',sourceSha:SOURCE_SHA,
    scanMethod:'CONSERVATIVE_TEXT_AND_LITERAL_CONSTANTS_NOT_A_TSQL_OR_JAVASCRIPT_COMPILER',
    sqlApplied:false,sqlSyntaxValidated:false,completeSchemaProven:false,
    files:files.map(f=>({path:f.path,sha256:createHash('sha256').update(f.text).digest('hex'),bytes:Buffer.byteLength(f.text)})),
    objects:inventory,unresolvedTemplates,foreignKeyReferences,indexes,
    reviewedMissingBaseDDL:exactMissingBases.filter(n=>inventory.some(o=>o.name===n&&!o.declarations.some(d=>d.form==='CREATE'))),
    limitations:['Captured CREATE text is not a complete executable definition or deployment order','Generated names, loops, helper additions, constraints, grants and body dependencies require semantic review','Historical/system references and unclassified mentions are not missing application objects','Missing base list is separately reviewed; NO_CREATE_CAPTURED alone is not proof of absence','Existing restored-copy SQL/proof builders are provenance candidates, not clean synthetic installers'],
  };
}

export function compileSyntheticPreparation(manifest,profile) {
  check(manifest?.schemaVersion==='melisa-full-erp-source-inventory.v1'&&manifest.sourceSha===SOURCE_SHA&&Array.isArray(manifest.objects),'INVENTORY_REJECTED');
  check(profile&&Object.keys(profile).sort().join(',')==='externalProvidersDisabled,inventoryDigest,origin,schemaVersion,sourceSha,target','PROFILE_KEYS_REJECTED');
  check(profile.schemaVersion==='melisa-full-synthetic-profile.v1'&&profile.sourceSha===SOURCE_SHA&&profile.inventoryDigest===preparationDigest(manifest),'PROFILE_PROVENANCE_REJECTED');
  check(JSON.stringify(ordered(profile.target))===JSON.stringify(ordered(SYNTHETIC_TARGET)),'SYNTHETIC_TARGET_REJECTED');
  check(JSON.stringify(ordered(profile.origin))===JSON.stringify(ordered({kind:'FRESH_SYNTHETIC',backupUsed:false,businessDataUsed:false}))&&profile.externalProvidersDisabled===true,'SYNTHETIC_ORIGIN_REJECTED');
  return {schemaVersion:'melisa-full-synthetic-bootstrap-plan.v1',sourceSha:SOURCE_SHA,inventoryDigest:preparationDigest(manifest),target:{...SYNTHETIC_TARGET},
    state:'SOURCE_PREPARATION_BLOCKED_NOT_A_RUNTIME_GRANT',canApply:false,canStart:false,runtimeGrant:null,sqlApplied:false,sqlSyntaxValidated:false,
    availableSchemaSources:manifest.files.filter(f=>/^infra\/sql\/migrations\//.test(f.path)||f.path==='apps/api/scripts/vega-native-migration-store.mjs'),
    originalSeedSources:manifest.files.filter(f=>/^infra\/sql\/seeds\//.test(f.path)),
    missingCreateCaptures:manifest.objects.filter(o=>o.scope==='APPLICATION_OR_UNCLASSIFIED'&&!o.declarations.some(d=>d.form==='CREATE')).map(o=>o.name),
    reviewedMissingBaseDDL:manifest.reviewedMissingBaseDDL,
    blockers:['FULL_SCHEMA_AND_BUSINESS_MODULES_NOT_PROVEN','RESTORED_COPY_PROOF_NOT_VALID_FOR_FRESH_SYNTHETIC_ORIGIN','FRESH_SYNTHETIC_RUNTIME_INTEGRATION_NOT_IMPLEMENTED','SQL_AND_ODBC_LICENSE_ACCEPTANCE_PENDING','SQL_APPLY_READBACK_AND_NORMAL_AUTH_ACCEPTANCE_NOT_RUN','PERSISTENT_HOST_AND_PRIVATE_BROWSER_PUBLICATION_UNVERIFIED'],
    proofRequirements:['Fresh dedicated DB/server and setup/app/reader identities, never original TEST or production','Complete schema/module/FK/index/grant manifest and deterministic build hashes','Normal role/permission auth, SERIALIZABLE mutations and existing journal/replay/effect proofs','Same UUID replay exactly once, changed body rejection and cross-personnel isolation','Synthetic scope proof generated from new objects/rows; no historical backup/seal/count substitution','Source/release/DB readback identity binding before any separately authorized startup'],
    seed:{state:'LOGICAL_SPEC_ONLY_NO_SQL_OR_ID_MAPPING',replayOriginalSeed:false,reason:'Original foundation seed contains negative stock and package/unit edge cases; not a clean full-runtime seed',
      products:[{businessKey:'SYN-P101',unit:'ADET',seriesFactor:1,stockExact3:'10.000',priceTryExact4:'25.0000'},{businessKey:'SYN-P102',unit:'ADET',seriesFactor:1,stockExact3:'8.000',priceTryExact4:'40.0000'}],
      customers:['SYN-C501','SYN-C502'],suppliers:['SYN-S601'],roles:['sales','manager','crm-assigned','other-personnel'],currencies:['TRY','USD','EUR'],realContacts:false,credentialsIncluded:false,businessDocumentRows:0},
  };
}
