import test from 'node:test';
import assert from 'node:assert/strict';
import {splitDesktopRejectGuards as split,inspectDesktopSqlGuardStatements as inspect} from './desktopSqlGuardStatements.mjs';
const reject="THROW 51995,'DESKTOP_FIXTURE_REJECTED',1;";
const flatten=sql=>inspect(sql).flatMap(s=>s.conditions.map(condition=>({condition,throwSql:s.throwSql})));

test('only outer OR is split; AND, NOT, scalar subqueries and nested OR keep their grouping and order',()=>{
 const sql=`-- admission\nIF p=1 AND (q=1 OR r=1) OR NOT(s=1 OR t=1) OR EXISTS(SELECT 1 FROM dbo.x WHERE a=1 OR b=1) ${reject}\n-- end`;
 const expected=['p=1 AND (q=1 OR r=1)','NOT(s=1 OR t=1)','EXISTS(SELECT 1 FROM dbo.x WHERE a=1 OR b=1)'];
 assert.deepEqual(inspect(sql)[0].conditions,expected);assert.deepEqual(flatten(split(sql)),flatten(sql));assert.equal(inspect(split(sql)).length,3);assert(split(sql).startsWith('-- admission\n'));assert(split(sql).endsWith('\n-- end'));
 const adjacent=`IF(1=1)OR(2=2) ${reject}`;assert.deepEqual(flatten(split(adjacent)),flatten(adjacent));assert.equal(inspect(split(adjacent)).length,2);
});

test('quoted metadata bytes, escaped strings, bracket/double-quoted names and nested comments are opaque',()=>{
 const definition="N'([name]=N''OR IF CASE ; THROW'' OR [value]=(1))'",bracket='[OR]]IF]',quoted='"OR""IF"';
 const sql=`IF CONVERT(varbinary(max),definition)=CONVERT(varbinary(max),${definition}) OR ${bracket}=1 OR ${quoted}=2 /* outer OR /* inner IF */ ; */ ${reject}`;
 const next=split(sql);assert(next.includes(definition));assert(next.includes(bracket));assert(next.includes(quoted));assert(next.includes('/* outer OR /* inner IF */ ; */'));assert.deepEqual(flatten(next),flatten(sql));assert.equal(inspect(next).length,3);
 const commented=`IF x=1 -- OR IF ; THROW\r\n OR y=2 ${reject}\r\n/* trailing */`;assert.deepEqual(flatten(split(commented)),flatten(commented));assert(split(commented).endsWith('\r\n/* trailing */'));
});

test('single-clause batches are byte-identical and repeated/NULL-sensitive clauses are never deduplicated',()=>{
 for(const sql of [`\nIF (p=1 OR q=1) ${reject}\n`,`IF ISNULL(HAS_PERMS_BY_NAME(N'dbo.x','OBJECT',N'SELECT'),0)<>1 ${reject}`])assert.equal(split(sql),sql);
 const duplicate=`IF x IS NULL OR x=1 OR x IS NULL ${reject}`;assert.deepEqual(flatten(split(duplicate)),flatten(duplicate));assert.equal(inspect(split(duplicate)).length,3);
});

test('unsupported statements, malformed/partial input, CASE and nonconstant THROW fail closed',()=>{
 for(const sql of ['',`SELECT 1;`,`IF p=1 ${reject} SELECT 2;`,`IF p=1 ${reject} junk`,`IF CASE WHEN p=1 OR q=1 THEN 1 ELSE 0 END=1 ${reject}`,`IF EXISTS(SELECT 1;SELECT 2) ${reject}`,`IF p=1 BEGIN ${reject} END`,`IF p=1 OR ${reject}`,`IF OR p=1 ${reject}`,`IF (p=1 ${reject}`,`IF p=1) ${reject}`,`IF p=N'bad ${reject}`,`IF [bad=1 ${reject}`,`IF p=1 /* bad ${reject}`,`IF p=1 THROW 51995,@message,1;`,`IF p=1 THROW 51995,'DESKTOP_FIXTURE_REJECTED',2;`,`IF p=1 THROW 50000,'DESKTOP_FIXTURE_REJECTED',1;`,`IF p=1 ${reject.slice(0,-1)}`])assert.throws(()=>split(sql),/DESKTOP_SQL_GUARD_GRAMMAR_REJECTED/,sql);
});

test('SQL three-valued OR rejects exactly when any ordered leaf is TRUE, including UNKNOWN permutations',()=>{
 const or=(a,b)=>a===true||b===true?true:a===null||b===null?null:false;
 for(let count=1;count<=7;count++)for(let mask=0;mask<3**count;mask++){
  let n=mask;const clauses=Array.from({length:count},()=>{const x=[false,null,true][n%3];n=Math.floor(n/3);return x;});
  assert.equal(clauses.reduce(or,false)===true,clauses.some(v=>v===true));
 }
});
