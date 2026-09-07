import fs from 'node:fs';
import path from 'node:path';
import {sourcePool,readQuery,sql} from '../src/mcp/commercial/sourcePools.js';
import {catalog} from '../src/mcp/commercial/catalog.js';
const target=new URL(process.env.MCP_READ_ONLY_VERIFY_URL||'http://127.0.0.1:4115/mcp');
if(process.env.MCP_READ_ONLY_LIVE_TESTS!=='true'||!['127.0.0.1','localhost'].includes(target.hostname)||target.protocol!=='http:'||target.pathname!=='/mcp'||target.username||target.password||target.search||target.hash)throw new Error('Explicit read-only opt-in and local review URL required');
if(!process.env.MCP_READ_ONLY_TOKEN)throw new Error('Protected MCP token required');
const rpc=async(name,args)=>{
 const response=await fetch(target,{method:'POST',headers:{Authorization:'Bearer '+process.env.MCP_READ_ONLY_TOKEN,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(95000)});
 return response.json();
};
const save=(_name,data)=>{if(process.env.MCP_READ_ONLY_RECONCILE_REPORT)fs.writeFileSync(path.resolve(process.env.MCP_READ_ONLY_RECONCILE_REPORT),JSON.stringify(data,null,2));};
let company,period;

import assert from 'node:assert/strict';
const evidence=[];
const range={dateFrom:process.env.MCP_READ_ONLY_VERIFY_DATE_FROM,dateTo:process.env.MCP_READ_ONLY_VERIFY_DATE_TO};
if(!range.dateFrom||!range.dateTo)throw new Error('Explicit date range required');
const read=async(name,args)=>(await rpc(name,args,4115)).result.structuredContent;
const canonical=v=>v==null?null:String(v).replace(/\.0+$/,'').replace(/(\.\d*?[1-9])0+$/,'$1');
async function check(label,fn){try{await fn();evidence.push({label,status:'PASS_LIVE_RECONCILIATION'});}catch(e){evidence.push({label,status:'FAIL',code:e.code||'ASSERTION_FAILED'});}console.log(JSON.stringify(evidence.at(-1)));save('reconciliation.json',{at:new Date().toISOString(),source:'VEGA2026',company,period,range,evidence});}
try{
 const c=await catalog(), proof=c.sources.find(s=>s.source==='vega')?.proof;
 if(!proof?.readOnlyAccountVerified)throw new Error('Read-only source unavailable');
 company=proof.companyCode;period=proof.periodCode;
 const d=name=>c.map.get('vega.dbo.'+company+name);
 await check('Stock quantities agree with independent raw sums for complete units',async()=>{
  const report=await read('get_inventory_report',{...range,kind:'decreasing',limit:3});assert.equal(report.items.length,3);
  for(const row of report.items){
    const table=d(period+'TBLSTOKHAREKETLERI');
    const actual=(await readQuery('vega',table.objects,`SELECT COUNT_BIG(*) AS n,COUNT_BIG(GIREN) AS incoming_known,COUNT_BIG(CIKAN) AS outgoing_known,COUNT(DISTINCT BIRIMEX) AS units,CONVERT(varchar(100),SUM(GIREN-CIKAN)) AS quantity FROM ${table.from} WHERE STOKNO=@id OPTION (MAXDOP 1)`,[{name:'id',type:sql.Int,value:row.source_id}]))[0];
    assert.equal(actual.n,actual.incoming_known);assert.equal(actual.n,actual.outgoing_known);assert.equal(actual.units,1);assert.equal(canonical(row.current_quantity),canonical(actual.quantity));
  }
 });
 await check('Ledger balances agree with independent per-currency source formula',async()=>{
  const sample=await read('query_dataset',{dataset:d(period+'TBLCARIHAREKETLERI').id,fields:['FIRMANO'],limit:1});const accountId=sample.items[0].FIRMANO;
  const result=await read('get_account_balance',{...range,accountId});assert.ok(result.items.length);
  const table=d(period+'TBLCARIHAREKETLERI');
  const raw=await readQuery('vega',table.objects,`SELECT PARABIRIMI,CONVERT(varchar(100),SUM((BORC-ALACAK)/NULLIF(KUR,0))) AS amount,COUNT_BIG(*) AS n,COUNT_BIG(BORC-ALACAK) AS known FROM ${table.from} WHERE FIRMANO=@id AND IZAHAT NOT IN(N'30',N'31') AND TARIH>=@from AND TARIH<@to AND KUR>0 GROUP BY PARABIRIMI OPTION (MAXDOP 1)`,[{name:'id',type:sql.Int,value:accountId},{name:'from',type:sql.Date,value:range.dateFrom},{name:'to',type:sql.Date,value:range.dateTo}]);
  assert.equal(raw.length,1);assert.equal(raw[0].n,raw[0].known);assert.equal(result.items.length,1);assert.equal(canonical(raw[0].amount),canonical(result.items[0].balance_effect));
 });
 await check('Posted header identity checked over all current-period 33/34 movements',async()=>{
  const movement=d(period+'TBLSTOKHAREKETLERI'),out=d(period+'TBLSTKCIKBASLIK'),inc=d(period+'TBLSTKGIRBASLIK');
  const row=(await readQuery('vega',[...movement.objects,...out.objects,...inc.objects],`SELECT COUNT_BIG(*) AS n,SUM(CASE WHEN COALESCE(o.IND,i.IND) IS NULL OR COALESCE(o.FIRMANO,i.FIRMANO)<>m.FIRMANO OR LTRIM(RTRIM(COALESCE(o.BELGENO,i.BELGENO)))<>LTRIM(RTRIM(m.EVRAKNO)) THEN 1 ELSE 0 END) AS broken FROM ${movement.from} m LEFT JOIN ${out.from} o ON m.IZAHAT=N'33' AND o.IND=m.BELGENO LEFT JOIN ${inc.from} i ON m.IZAHAT=N'34' AND i.IND=m.BELGENO WHERE m.IZAHAT IN(N'33',N'34') AND m.TARIH>=@from AND m.TARIH<@to OPTION (MAXDOP 1)`,[{name:'from',type:sql.Date,value:range.dateFrom},{name:'to',type:sql.Date,value:range.dateTo}]))[0];
  assert.ok(Number(row.n)>0);assert.equal(row.broken,0);
 });
 await check('Country grouping reconciles source posting count, preserving incomplete groups',async()=>{
  const result=await read('get_sales_report',{...range,dimension:'country',limit:50});assert.equal(result.hasMore,false);
  const total=result.items.reduce((a,r)=>a+BigInt(r.source_rows),0n);
  const movement=d(period+'TBLSTOKHAREKETLERI');
  const row=(await readQuery('vega',movement.objects,`SELECT COUNT_BIG(*) AS n FROM ${movement.from} WHERE LTRIM(RTRIM(IZAHAT)) IN(N'33',N'34') AND TARIH>=@from AND TARIH<@to OPTION (MAXDOP 1)`,[{name:'from',type:sql.Date,value:range.dateFrom},{name:'to',type:sql.Date,value:range.dateTo}]))[0];assert.equal(total,BigInt(row.n));
  for(const group of result.items)if(BigInt(group.incomplete_rows)>0n)assert.equal(group.net_sales_basis_try,null);
  const missing=result.items.reduce((a,r)=>a+BigInt(r.incomplete_rows),0n);
  assert.equal(result.coverage.sourceRows,total.toString());assert.equal(result.coverage.incompleteRows,missing.toString());assert.equal(result.coverage.rankingComplete,missing===0n);
 });
}finally{for(const source of ['vega','melisa'])try{await(await sourcePool(source)).close();}catch{}}

if(evidence.some(c=>c.status==='FAIL'))process.exitCode=1;
