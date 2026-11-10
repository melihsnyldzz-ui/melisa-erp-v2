// Offline compiler-contract regressions. Actual SQL empty/nonempty behavior is
// separately checked by the root's reviewed two-table read-only rollback probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compileWarehouseLifecycle} from './lifecycle-sql.mjs';
import {WAREHOUSE_TABLE_KEYS as TABLES} from './lifecycle-contract.mjs';
const sha=s=>createHash('sha256').update(s,'utf8').digest('hex');
const acceptedNonCapture={observe:'bb78a983fa606d9070ae2320ebbdfb13c1695045620c099b79ce2b84cf557dae',activate:'4f5a4aaa9d908bfacab75e46e567a300bbaaf2e63da4ddff475f3a80fd90857a',deactivate:'d937b6dbbf68437595d22df8568d0564d574161ede53b72bc22203e449e862ad'};
function chunks(sql){const result=[];const pattern=/-- WH_CAPTURE_BEGIN (before|after) ([a-z_]+)\n([\s\S]*?)\n-- WH_CAPTURE_END \1 \2/g;for(const m of sql.matchAll(pattern))result.push({text:m[0],phase:m[1],name:m[2],body:m[3]});return result;}
test('every byte outside the private capture chunks remains accepted 55d87 SQL for all three actions',()=>{
 for(const action of ['observe','activate','deactivate']){let sql=compileWarehouseLifecycle({action}).sql;const entries=chunks(sql);assert.equal(entries.length,action==='observe'?43:86);for(const c of entries)sql=sql.replace(c.text,'-- WH_CAPTURE_TOKEN '+c.phase+' '+c.name);assert.equal(sha(sql),acceptedNonCapture[action]);}
});
test('all 43 tables retain locked COUNT and byte-identical full ordered nonempty JSON; both phases use the same renderer',()=>{
 const sql=compileWarehouseLifecycle({action:'activate'}).sql,entries=chunks(sql);assert.equal(new Set(entries.map(c=>c.name)).size,43);
 for(const c of entries){const n='@wh_'+c.phase+'_'+c.name+'_n',j='@wh_'+c.phase+'_'+c.name+'_json';assert.ok(c.body.includes('SELECT '+n+'=COUNT_BIG(*) FROM dbo.['+c.name+'] WITH(TABLOCKX,HOLDLOCK);'));assert.ok(c.body.includes('SET '+j+'=(SELECT * FROM dbo.['+c.name+'] WITH(TABLOCKX,HOLDLOCK) ORDER BY '+TABLES[c.name].map(k=>'['+k+']').join(',')+' FOR JSON PATH,INCLUDE_NULL_VALUES);'));assert.ok(c.body.includes("HASHBYTES('SHA2_256',CONVERT(varbinary(max),"+j+'))'));assert.doesNotMatch(c.body,/COALESCE|ISNULL\(|JSON_MODIFY|JSON_QUERY|STRING_ESCAPE|TRIM|REPLACE\(/i);const peer=entries.find(p=>p.name===c.name&&p.phase!==c.phase);assert.equal(c.body.replaceAll('wh_'+c.phase+'_','wh_PHASE_').replace('@'+c.phase+'(','@PHASE('),peer.body.replaceAll('wh_'+peer.phase+'_','wh_PHASE_').replace('@'+peer.phase+'(','@PHASE('));}
});
test('only verified zero-count NULL or exact UTF16 empty-array bytes can reach empty normalization',()=>{
 for(const c of chunks(compileWarehouseLifecycle({action:'observe'}).sql)){const n='@wh_'+c.phase+'_'+c.name+'_n',j='@wh_'+c.phase+'_'+c.name+'_json',empty="DATALENGTH("+j+")=DATALENGTH(N'[]') AND CONVERT(varbinary(max),"+j+")=CONVERT(varbinary(max),N'[]')";
  assert.ok(c.body.includes("IF "+n+" IS NULL OR "+n+"<0 THROW 51995,'WH_CAPTURE_COUNT',1;"));
  assert.ok(c.body.includes("IF "+n+">0 AND ("+j+" IS NULL OR ("+empty+")) THROW 51995,'WH_CAPTURE_NONEMPTY_JSON',1;"));
  assert.ok(c.body.includes("IF "+n+"=0 BEGIN\n IF "+j+" IS NOT NULL AND NOT("+empty+") THROW 51995,'WH_CAPTURE_EMPTY_JSON',1;\n SET "+j+"=N'[]';\nEND;"));
  assert.equal(c.body.split("SET "+j+"=N'[]';").length,2);assert.doesNotMatch(c.body,/0x[a-f0-9]{64}/i);
 }
});
test('root regression can extract exactly two self-contained before chunks; production hashes remain NOT NULL',()=>{
 const sql=compileWarehouseLifecycle({action:'observe'}).sql,entries=chunks(sql),selected=entries.filter(c=>['audit_logs','auth_refresh_tokens'].includes(c.name));assert.equal(selected.length,2);for(const c of selected){assert.equal(c.phase,'before');assert.ok(c.body.startsWith('DECLARE @wh_before_'+c.name+'_n bigint;DECLARE @wh_before_'+c.name+'_json nvarchar(max);'));assert.ok(c.body.includes('INSERT @before(name,n,h) VALUES('));}
 assert.match(sql,/DECLARE @before TABLE\(name sysname PRIMARY KEY,n bigint NOT NULL,h varbinary\(32\) NOT NULL\)/);assert.match(compileWarehouseLifecycle({action:'deactivate'}).sql,/DECLARE @after TABLE\(name sysname PRIMARY KEY,n bigint NOT NULL,h varbinary\(32\) NOT NULL\)/);
});
