import test from 'node:test';import assert from 'node:assert/strict';
import {desktopCompanyRateDate,desktopCompanyRates,isDesktopCompanyRates,selectDesktopCompanyRate} from '../../../../packages/shared/src/desktopCompanyRates.mjs';
import {createDesktopWriteListService} from './desktopWriteListService.mjs';
const date='2026-11-06',usd={id:'1',currency:'USD',date,rateExact8:'40.00000000',source:'company'};
test('company suggestions require exact Gregorian date and never substitute a missing or earlier foreign rate',()=>{
 assert.equal(desktopCompanyRateDate('2024-02-29'),'2024-02-29');for(const bad of ['2026-02-29','2026-04-31','2026-13-01','1899-12-31','2026-11-06T00:00:00Z','2026-11-06 '])assert.throws(()=>desktopCompanyRateDate(bad));
 const empty=desktopCompanyRates(date,[]);assert.equal(empty.rates[0].rateExact8,'1.00000000');assert.deepEqual(empty.rates.slice(1).map(r=>[r.defined,r.rateExact8,r.source,r.rateId]),[[false,null,null,null],[false,null,null,null]]);assert.equal(isDesktopCompanyRates(empty,date),true);
 for(const rows of [[{...usd,date:'2026-11-05'}],[usd,usd],[{...usd,currency:'TRY'}],[{...usd,rateExact8:'0.00000000'}],[{...usd,rateExact8:40}],[{...usd,rateExact8:'40.000000001'}],new Array(1),[{...usd,source:'\nprivate'}]])assert.throws(()=>desktopCompanyRates(date,rows));
 assert.equal(isDesktopCompanyRates({...empty,rates:empty.rates.map(r=>r.currency==='USD'?{...r,rateExact8:'1.00000000'}:r)},date),false);
});
test('company suggestion and explicit transaction override freeze distinct exact selections without repricing an old snapshot',()=>{
 const suggestions=desktopCompanyRates(date,[usd]),selected=selectDesktopCompanyRate({date,currency:'USD',suggestions});assert.deepEqual(selected,{date,currency:'USD',rateExact8:'40.00000000',source:'company-daily',companyRateId:'1',companyRateSource:'company'});assert(Object.isFrozen(selected));
 const changed=desktopCompanyRates(date,[{...usd,rateExact8:'41.00000000'}]);assert.equal(selected.rateExact8,'40.00000000');assert.equal(selectDesktopCompanyRate({date,currency:'USD',suggestions:changed,overrideExact8:'39.50000000'}).rateExact8,'39.50000000');assert.equal(selectDesktopCompanyRate({date,currency:'EUR',suggestions,overrideExact8:'43.00000000'}).companyRateId,null);
 assert.throws(()=>selectDesktopCompanyRate({date,currency:'EUR',suggestions}),/DESKTOP_COMPANY_RATE_REQUIRED/);assert.throws(()=>selectDesktopCompanyRate({date,currency:'TRY',suggestions,overrideExact8:'2.00000000'}));assert.throws(()=>selectDesktopCompanyRate({date:'2026-11-05',currency:'USD',suggestions}));
});
test('native nullable/empty rate source stays explicit without inventing a provider or changing a valid value',()=>{
 for(const source of [null,'']){const result=desktopCompanyRates(date,[{...usd,source}]);assert.equal(isDesktopCompanyRates(result,date),true);assert.equal(result.rates[1].rateExact8,'40.00000000');assert.equal(result.rates[1].source,source);assert.equal(selectDesktopCompanyRate({date,currency:'USD',suggestions:result}).companyRateSource,source);}
 assert.throws(()=>desktopCompanyRates(date,[usd,{...usd,currency:'EUR'}]));
});
function fixture({rows=[usd],target=true,allowed=true}={}){const calls=[];class Transaction{async begin(level){calls.push({kind:'begin',tx:this,level});}async commit(){calls.push({kind:'commit'});}async rollback(){calls.push({kind:'rollback'});}}
 class Request{constructor(tx){this.tx=tx;this.params={};}input(k,t,v){this.params[k]=v;return this;}async query(q){calls.push({q,tx:this.tx,params:this.params});if(q.includes('FROM dbo.currency_rates WITH(HOLDLOCK)'))return {recordset:rows};throw Error('Unexpected SQL');}}
 const service=createDesktopWriteListService({pool:{},sql:{Transaction,Request,NVarChar:()=>({}),Int:{},ISOLATION_LEVEL:{SERIALIZABLE:4}},richCards:true,schemaVersion:4,verifySession:async ctx=>{calls.push(ctx);return allowed&&target;}});return {service,calls};}
test('rate read uses fixed target, held current normal authority and exact-date bound SQL in one serializable readonly transaction',async()=>{
 const f=fixture();assert.deepEqual(await f.service.readCompanyRates('7',date),desktopCompanyRates(date,[usd]));assert.equal(f.calls.at(-1).kind,'commit');const sql=f.calls.filter(x=>x.q);assert.equal(new Set(sql.map(x=>x.tx)).size,1);const auth=f.calls.find(x=>x.permission);assert.equal(auth.permission,'sales.view');assert.equal(auth.transaction,sql[0].tx);const bound=sql.find(x=>x.q.includes('FROM dbo.currency_rates WITH(HOLDLOCK)'));assert(f.calls.indexOf(auth)<f.calls.indexOf(bound));assert.equal(bound.params.companyRateDate,date);assert.match(bound.q,/rate_date=CONVERT\(date,@companyRateDate,23\)/);assert.match(bound.q,/TOP\(3\)/);assert.doesNotMatch(bound.q,/<=|INSERT|UPDATE|DELETE|MERGE/);
 for(const options of [{target:false},{allowed:false},{rows:[{...usd,date:'2026-11-05'}]},{rows:[usd,usd]}]){const x=fixture(options);await assert.rejects(x.service.readCompanyRates('7',date));assert.equal(x.calls.at(-1).kind,'rollback');assert.equal(x.calls.some(c=>c.kind==='commit'),false);}
 const invalid=fixture();await assert.rejects(invalid.service.readCompanyRates('7','2026-02-30'));assert.equal(invalid.calls.length,0);
});
