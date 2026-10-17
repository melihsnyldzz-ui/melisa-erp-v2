import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import tedious from 'mssql/tedious.js';
import {readSource,root,hash,requireRule} from './vega-native-migration-runtime.mjs';
import {manifest} from './vega-native-migration-adapters.mjs';
import {identitySql,assertSourceIdentity,permissionsSql,assertReadOnlyPermissions,projection,identifier} from './vega-migration-spec-preflight.mjs';
const directory=path.join(root,'m11-20260917-source');fs.mkdirSync(directory);
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const {getVegaSqlConfig}=await import('../src/config/vegaDatabase.js');
class ReadPool extends tedious.ConnectionPool{request(){return new tedious.Request(this);}}
const pool=await new ReadPool(getVegaSqlConfig()).connect(),results=[];
const q=async(s,cursor)=>{requireRule(/^SELECT\b/.test(s),'SOURCE_SELECT_ONLY');const r=pool.request();if(cursor!==undefined)r.input('cursor',tedious.BigInt,cursor);return(await r.query(s)).recordset;};
try{
 assertSourceIdentity((await q(identitySql))[0]);
 const metadata=readSource('source-metadata.json'),masters=readSource('source-captures.json');
 const tables=[...masters,...manifest.tables];
 for(let i=0;i<tables.length;i+=40){const names=tables.slice(i,i+40).map(t=>t.table);assertReadOnlyPermissions(await q(permissionsSql(names)),names);}
 for(const t of tables){const cols=projection(metadata.filter(c=>c.tableName===t.table));let count=0,digest;
  if(masters.some(m=>m.table===t.table)){const data=await q(`SELECT ${cols} FROM dbo.${identifier(t.table)} ORDER BY IND`);count=data.length;digest=hash(data);}
  else{let cursor='-9223372036854775808';const h=createHash('sha256');while(true){const data=await q(`SELECT TOP (2000) ${cols} FROM dbo.${identifier(t.table)} WHERE IND>@cursor ORDER BY IND`,cursor);if(!data.length)break;for(const r of data){requireRule(BigInt(r.IND)>BigInt(cursor),'SOURCE_CURSOR');cursor=String(r.IND);h.update(JSON.stringify(r)+'\n');count++;}}digest=h.digest('hex');}
  const result={table:t.table,count,hash:digest,matchesFrozen:count===t.count&&digest===t.hash,expectedCount:t.count,expectedHash:t.hash};results.push(result);fs.appendFileSync(path.join(directory,'table-checks.jsonl'),JSON.stringify(result)+'\n');
  if(results.length%40===0)console.log(JSON.stringify({tables:results.length,total:tables.length,changed:results.filter(r=>!r.matchesFrozen).length}));
 }
 const receipt={at:new Date().toISOString(),database:'VEGA2026',mode:'SELECT_ONLY',writes:0,tables:results.length,changed:results.filter(r=>!r.matchesFrozen),matched:results.filter(r=>r.matchesFrozen).length,atomicSnapshot:false};
 fs.writeFileSync(path.join(directory,'receipt.json'),JSON.stringify(receipt),{flag:'wx'});console.log(JSON.stringify(receipt));
}finally{await pool.close();}
