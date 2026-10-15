import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateSnapshot, projectPerformance, periodBounds, localDay, duration, safeEvidenceUrl} from '../public/melisa-hub/progress/model.mjs';
const fixture = JSON.parse(fs.readFileSync(new URL('../public/melisa-hub/progress/evidence.json', import.meta.url),'utf8'));
const now = Date.parse('2026-10-15T22:30:00.000Z');
const copy = () => structuredClone(fixture);
test('progress uses only full closure and preserves all seventy-four original leaves', () => {
 const p=validateSnapshot(fixture); assert.deepEqual(p.totals,{total:74,complete:21,partial:52,open:1,percent:21/74*100});
 assert.equal(p.projects[0].percent,9/49*100); assert.equal(p.projects[1].percent,48);
});
test('selected native main-turn sample is six jobs and excludes current unfinished work', () => {
 const p=validateSnapshot(fixture), all=projectPerformance(p,7,now);
 assert.equal(all.observedCount,6);assert.equal(all.byProject.ERP.observedCount,3);assert.equal(all.byProject.CRM.observedCount,3);
 assert.equal(all.averageSeconds,(660+286+588+853+461+878)/6); assert.equal(all.fullPeriodCount,null);
});
test('today uses Istanbul completion day including a task crossing midnight', () => {
 const p=projectPerformance(validateSnapshot(fixture),1,now);
 assert.equal(localDay('2026-10-15T21:00:00Z'),'2026-10-16');assert.equal(localDay('2026-10-15T20:59:59Z'),'2026-10-15');
 assert.equal(p.observedCount,4);assert.equal(p.byProject.ERP.observedCount,1);assert.equal(p.byProject.CRM.observedCount,3);
 assert.equal(p.averageSeconds,(660+853+461+878)/4);assert.equal(p.hourly.reduce((n,h)=>n+h.CRM,0),445+461+853);
});
test('7 and 30 day views stay sample coverage rather than fabricated full-period performance', () => {
 const p=validateSnapshot(fixture);for(const period of [7,30]) {const x=projectPerformance(p,period,now);assert.equal(x.observedCount,6);assert.equal(x.fullPeriodCount,null);assert.equal(x.activeSeconds,null);assert.equal(x.waitingSeconds,null);assert.equal(x.callbackDelaySeconds,null);assert.equal(x.dispatchDelaySeconds,null);}
});
test('identical duplicate observations never inflate job counts or hours', () => {
 const d=copy();d.observations.push(structuredClone(d.observations[0]));const p=projectPerformance(validateSnapshot(d),7,now);assert.equal(p.observedCount,6);assert.equal(p.byProject.ERP.observedCount,3);
});
test('same verified observation under a different key is still one main job', () => {
 const d=copy();d.observations.push({...d.observations[0],key:'different-public-alias'});const p=projectPerformance(validateSnapshot(d),7,now);assert.equal(p.observedCount,6);assert.equal(p.byProject.ERP.observedCount,3);
});
test('malformed network-path or non-origin targets return a bounded refusal without throwing', async () => {
 const server=await import('../../../scripts/hub-progress-server.mjs');
 assert.equal(typeof server.progressRequestPath,'function');
 for(const target of ['//[','//foreign.example/','http://foreign.example/','/\\bad','/%2e%2e/private','/../private','/with space',null,'/'+ 'a'.repeat(2048)]) assert.equal(server.progressRequestPath(target),null);
 assert.equal(server.progressRequestPath('/melisa-hub/progress/'),'/melisa-hub/progress/');
});
test('conflicting duplicate is excluded instead of arbitrarily selected', () => {
 const d=copy();d.observations.push({...d.observations[0],title:'Conflicting'});const s=validateSnapshot(d);assert.equal(s.rejected,1);assert.equal(s.observations.length,5);
});
test('reviewer helper unfinished missing-time and reversed-time records cannot become main jobs', () => {
 for(const edit of [{role:'reviewer'},{role:'helper'},{status:'inProgress'},{completedAt:null},{startedAt:'unknown'},{startedAt:'2026-10-15T22:29:00Z'}]) {const d=copy();d.observations[0]={...d.observations[0],...edit};const s=validateSnapshot(d);assert.equal(s.rejected,1);assert.equal(s.observations.length,5);}
});
test('events newer than the evidence snapshot are not accepted', () => {
 const d=copy();d.observations[0].completedAt='2026-10-16T00:00:00.000Z';assert.equal(validateSnapshot(d).rejected,1);
});
test('empty evidence and days outside coverage are null rather than zero', () => {
 const d=copy();d.observations=[];const p=projectPerformance(validateSnapshot(d),1,now);assert.equal(p.observedCount,null);assert.equal(p.averageSeconds,null);assert.equal(p.byProject.ERP.observedCount,null);assert.deepEqual(p.hourly,[]);
 const other=projectPerformance(validateSnapshot(fixture),1,Date.parse('2026-10-17T08:00:00Z'));assert.equal(other.observedCount,null);
});
test('snapshot freshness never implies service health and future source times become unknown', () => {
 const p=validateSnapshot(fixture);assert.equal(projectPerformance(p,1,now).state,'snapshot');assert.equal(projectPerformance(p,1,now+7*3600000).state,'stale');
 const x=projectPerformance(p,1,p.observedMs-61000);assert.equal(x.state,'unknown');assert.equal(x.observedCount,null);
});
test('GitHub auth rate-limit and source-unavailable records cannot manufacture fresh performance', () => {
 for(const error of ['AUTH','RATE_LIMIT','UNAVAILABLE']) {const d=copy();d.sourceErrors=[error];const p=projectPerformance(validateSnapshot(d),7,now);assert.equal(p.state,'unknown');assert.equal(p.observedCount,null);assert.equal(p.averageSeconds,null);}
});
test('period boundaries are inclusive start and exclusive end at Istanbul midnight', () => {
 assert.deepEqual(periodBounds(1,now),{start:Date.parse('2026-10-15T21:00:00Z'),end:Date.parse('2026-10-16T21:00:00Z')});
 assert.equal(periodBounds(7,now).end-periodBounds(7,now).start,7*86400000);assert.throws(()=>periodBounds(2,now));
});
test('hour rows split at hour boundaries without inventing unobserved hours', () => {
 const d=copy();d.observations=[{...d.observations[0],startedAt:'2026-10-15T20:59:00.000Z',completedAt:'2026-10-15T21:01:00.000Z'}];
 const p=projectPerformance(validateSnapshot(d),7,now);assert.deepEqual(p.hourly.map(h=>h.ERP),[60,60]);assert.equal(p.hourly.length,2);
});
test('duration labels do not turn unknown into zero',()=>{assert.equal(duration(null),'Ölçülemiyor');assert.equal(duration(NaN),'Ölçülemiyor');assert.equal(duration(660),'11 dk');assert.equal(duration(853),'14 dk 13 sn');assert.equal(duration(0),'0 sn');});
test('only public source evidence URLs are eligible for clickable links',()=>{
 assert.ok(safeEvidenceUrl(fixture.projects[0].sourceUrl));assert.ok(safeEvidenceUrl(fixture.observations[0].sourceUrl));
 for(const s of ['javascript:alert(1)','data:text/html,x','file:///C:/private','http://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23','https://github.com.evil.example/melihsnyldzz-ui/melisa-erp-v2/pull/23','https://user:pass@github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23','https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23?token=x','https://github.com/melihsnyldzz-ui/other/pull/23','//github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23','https://github.com/melihsnyldzz-ui/melisa-erp-v2/blob/%2e%2e/private']) assert.equal(safeEvidenceUrl(s),null,s);
});
test('bad plan arithmetic duplicate projects and unsafe links reject the source',()=>{
 for(const mutate of [d=>d.projects[0].complete++,d=>d.projects[0].total=0,d=>d.projects[0].complete=-1,d=>d.projects[1].id='ERP',d=>d.projects[0].sourceUrl='javascript:alert(1)',d=>d.timeZone='UTC']) {const d=copy();mutate(d);assert.throws(()=>validateSnapshot(d));}
});
test('browser renderer has no HTML injection or operational requests and retains missing-state labels',()=>{
 const js=fs.readFileSync(new URL('../public/melisa-hub/progress/progress.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(js,/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|setInterval|\/api\//u);
 assert.match(js,/\.textContent\s*=/u);assert.match(js,/safeEvidenceUrl\(url\)/u);assert.match(js,/credentials:'omit'/u);assert.match(js,/redirect:'error'/u);
 const html=fs.readFileSync(new URL('../public/melisa-hub/progress/index.html',import.meta.url),'utf8');assert.match(html,/aria-pressed="true"/u);assert.match(html,/role="status"/u);assert.match(html,/Europe\/Istanbul/u);
});
