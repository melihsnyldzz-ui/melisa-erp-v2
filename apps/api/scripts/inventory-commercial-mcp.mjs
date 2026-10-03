import fs from 'node:fs';
import path from 'node:path';
import { catalog } from '../src/mcp/commercial/catalog.js';
import { readQuery, sourcePool } from '../src/mcp/commercial/sourcePools.js';

if(process.env.MCP_READ_ONLY_LIVE_TESTS!=='true'||!process.env.MCP_READ_ONLY_INVENTORY_DIR)throw new Error('Explicit read-only audit opt-in and output directory are required');
const output=path.resolve(process.env.MCP_READ_ONLY_INVENTORY_DIR);
fs.mkdirSync(output,{recursive:true});
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
try{
 const c=await catalog();
 fs.writeFileSync(path.join(output,'commercial-datasets.csv'),csv([['dataset','source','company','period','registered_year','family','status','permission','safe_key','allowed_field_count'],...c.datasets.map(d=>[d.id,d.source,d.company,d.period,d.year,d.family,d.status,d.permission,d.primaryKey.join('|'),d.fields.length])]));
 fs.writeFileSync(path.join(output,'commercial-fields.csv'),csv([['dataset','field','type','nullable','meaning_status','personal','aggregate'],...c.datasets.flatMap(d=>d.fields.map(f=>[d.id,f.name,f.dataType,f.nullable,f.meaningStatus,f.personal,f.aggregate?.join('|')]))]));
 const history=[];
 // Audit only reviewed date-bearing commercial families, with bounded SELECTs.
 for(const d of c.datasets.filter(d=>d.readable&&!d.virtual&&d.period&&['TBLSTOKHAREKETLERI','TBLCARIHAREKETLERI','TBLALFATBASLIK','TBLSATFATBASLIK'].includes(d.template)&&d.fields.some(f=>f.name==='TARIH'))){
   try{const [counts]=await readQuery(d.source,d.objects,`SELECT COUNT_BIG(*) AS records,CONVERT(varchar(40),MIN(TARIH),126) AS earliest,CONVERT(varchar(40),MAX(TARIH),126) AS latest FROM ${d.from} OPTION (MAXDOP 1)`);
    history.push({dataset:d.id,company:d.company,period:d.period,registeredYear:d.year,...counts,status:Number(counts.records)?'OBSERVED_DATA':'OBSERVED_EMPTY'});
   }catch(e){history.push({dataset:d.id,status:'BLOCKED',code:e.code||'READ_FAILED'});}
 }
 const result={readAt:new Date().toISOString(),sources:c.sources.map(s=>({source:s.source,database:s.database,objectsVisible:s.objectsVisible,proof:s.proof,status:s.status||'available',code:s.code,companies:s.companies,periods:s.periods})),history,missingPermissionOrSchema:c.datasets.filter(d=>d.status==='permission-or-schema-required').map(d=>d.id),warning:'Metadata invisibility is not proof of absent data. No customer rows or financial amounts are exported.'};
 fs.writeFileSync(path.join(output,'commercial-history.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({readAt:result.readAt,datasets:c.datasets.length,historyScopes:history.length,blockedScopes:history.filter(h=>h.status==='BLOCKED').length,localPermissionOrSchemaGaps:result.missingPermissionOrSchema.length}));
}finally{for(const source of ['vega','melisa'])try{await(await sourcePool(source)).close();}catch{}}
