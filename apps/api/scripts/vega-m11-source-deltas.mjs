import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import tedious from 'mssql/tedious.js';
import {root,readSource,hash,requireRule} from './vega-native-migration-runtime.mjs';import {readHistory} from './vega-native-migration-adapters.mjs';
import {identitySql,assertSourceIdentity,permissionsSql,assertReadOnlyPermissions,projection,identifier} from './vega-migration-spec-preflight.mjs';
const dir=path.join(root,'m11-20260917-source'),receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'))),metadata=readSource('source-metadata.json');
const file=path.join(dir,'record-deltas.jsonl');fs.writeFileSync(file,'',{flag:'wx'});
process.chdir(fileURLToPath(new URL('../',import.meta.url)));const {getVegaSqlConfig}=await import('../src/config/vegaDatabase.js');
class ReadPool extends tedious.ConnectionPool{request(){return new tedious.Request(this);}}
const pool=await new ReadPool(getVegaSqlConfig()).connect(),results=[];
const q=async(s,cursor)=>{requireRule(/^SELECT\b/.test(s),'SELECT_ONLY');const r=pool.request();if(cursor!==undefined)r.input('cursor',tedious.BigInt,cursor);return(await r.query(s)).recordset;};
try{assertSourceIdentity((await q(identitySql))[0]);
for(const t of receipt.changed){assertReadOnlyPermissions(await q(permissionsSql([t.table])),[t.table]);const master=!/D\d{4}/.test(t.table),old=master?readSource(t.table+'.json'):[...readHistory(t.table)],oldMap=new Map(old.map(r=>[String(r.IND),r]));let cursor='-9223372036854775808',rows=[];while(true){const data=await q(`SELECT TOP(2000) ${projection(metadata.filter(c=>c.tableName===t.table))} FROM dbo.${identifier(t.table)} WHERE IND>@cursor ORDER BY IND`,cursor);if(!data.length)break;for(const r of data){requireRule(BigInt(r.IND)>BigInt(cursor),'SOURCE_CURSOR');cursor=String(r.IND);rows.push(r);}}
const digest=master?hash(rows):createHash('sha256').update(rows.map(r=>JSON.stringify(r)+'\n').join('')).digest('hex');
const counts={added:0,changed:0,removed:0};for(const r of rows){const before=oldMap.get(String(r.IND));oldMap.delete(String(r.IND));if(before&&hash(before)===hash(r))continue;const kind=before?'changed':'added';counts[kind]++;fs.appendFileSync(file,JSON.stringify({table:t.table,id:String(r.IND),kind,changedFields:before?Object.keys(r).filter(k=>JSON.stringify(before[k])!==JSON.stringify(r[k])):null,before:before||null,after:r})+'\n');}
for(const [id,before]of oldMap){counts.removed++;fs.appendFileSync(file,JSON.stringify({table:t.table,id,kind:'removed',before,after:null})+'\n');}
results.push({table:t.table,...counts,stableSinceSourceCheck:digest===t.hash,hash:digest});console.log(JSON.stringify(results.at(-1)));
}fs.writeFileSync(path.join(dir,'delta-summary.json'),JSON.stringify({at:new Date().toISOString(),results,sourceWrites:0}),{flag:'wx'});
}finally{await pool.close();}
