import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {interval,parseJobLog,reportTimings,loadInput,renderMarkdown,main} from './workflow-timing-report.mjs';

const date=seconds=>'2026-10-30T00:'+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')+'Z';
const summary=(stamp=9,{tests=3,pass=2,fail=0,cancelled=0,skipped=1,todo=0}={})=>
 ['tests '+tests,'suites 0','pass '+pass,'fail '+fail,'cancelled '+cancelled,'skipped '+skipped,'todo '+todo,'duration_ms 5000.25'].map(s=>date(stamp)+' ℹ '+s).join('\n');
const log=()=>date(4)+' ##[group]Run node --test --password PRIVATE_TEST_SENTINEL\n'+date(4)+' ##[endgroup]\n'+summary();
function sample({id=1,status='completed',conclusion='success',attempt=1}={}){
 return {run:{id,run_attempt:attempt,workflow_id:123,event:'push',head_sha:'a'.repeat(40),status,conclusion,created_at:date(0),run_started_at:date(2),updated_at:date(50)},
  jobs:[{id:10+id,run_id:id,name:'Windows tests',status,conclusion,queued_at:date(1),started_at:date(3),completed_at:date(12),log:log(),
   steps:[{number:1,name:'Slow group',status,conclusion,started_at:date(4),completed_at:date(10)}]}]};
}
const input=(...runs)=>({schemaVersion:'melisa-ci-timing-input.v1',runs});

test('separates workflow start delay, measured queue, execution and log span without summing parallel jobs',()=>{
 const s=sample();s.jobs.push({...s.jobs[0],id:99,name:'Parallel tests',started_at:date(5),completed_at:date(14)});
 const report=reportTimings(input(s)),r=report.runs[0],j=r.jobs[0];
 assert.equal(r.workflowStartDelay.durationMs,2000);assert.equal(j.queue.durationMs,2000);
 assert.equal(j.execution.durationMs,9000);assert.equal(j.triggerToJobStart.durationMs,3000);
 assert.equal(j.observedLogSpan.durationMs,5000);assert.equal(j.steps[0].execution.durationMs,6000);
 assert.equal(report.successfulBaseline.jobs.length,2);assert.equal('workflowWallMs' in report,false);
 assert.equal(report.investigationCandidates[0].parallelismProven,false);assert.equal(report.investigationCandidates[0].appliedSpeedupMs,null);
 assert(!JSON.stringify(report).includes('PRIVATE_TEST_SENTINEL'));
});

test('missing, invalid, timezone-less and reversed timestamps remain unknown; updated_at is not completion',()=>{
 for(const [a,b]of [[null,date(2)],[date(2),null],['2026-02-30T00:00:00Z',date(2)],['2026-10-30T00:00:00',date(2)],[date(3),date(2)],['bad',date(2)]])assert.equal(interval(a,b).durationMs,null);
 assert.equal(interval(date(0),date(0)).durationMs,0);
 const s=sample();delete s.jobs[0].completed_at;delete s.run.run_started_at;
 const r=reportTimings(input(s)).runs[0];assert.equal(r.workflowStartDelay.durationMs,null);
 assert.equal(r.jobs[0].execution.durationMs,null);assert.equal(r.jobs[0].steps[0].execution.durationMs,6000);
 const reported=sample();delete reported.jobs[0].started_at;delete reported.jobs[0].completed_at;
 reported.jobs[0].reported_duration_ms=13000;reported.jobs[0].reported_duration_source='public job summary';
 const j=reportTimings(input(reported)).runs[0].jobs[0];assert.equal(j.execution.durationMs,null);assert.equal(j.reportedDuration.durationMs,13000);
});

test('failed, cancelled, queued and in-progress runs retain observations but never enter successful baseline',()=>{
 const cases=[sample(),sample({id:2,conclusion:'failure'}),sample({id:3,conclusion:'cancelled'}),sample({id:4,status:'queued',conclusion:null}),sample({id:5,status:'in_progress',conclusion:null}),sample({id:6,status:'inProgress',conclusion:null})];
 const r=reportTimings(input(...cases));assert.equal(r.runs.length,6);assert.equal(r.successfulBaseline.jobs[0].samples.length,1);
 assert(r.runs.slice(1).every(r=>r.jobs[0].baselineEligible===false));
 const contradictory=sample();contradictory.jobs[0].log=summary(9,{pass:1,fail:1});
 assert.equal(reportTimings(input(contradictory)).runs[0].jobs[0].excludedReason,'FAILED_OR_CANCELLED_TESTS_IN_LOG');
 const mixed=sample();mixed.jobs.push({...mixed.jobs[0],id:99,conclusion:'failure'});
 assert.equal(reportTimings(input(mixed)).successfulBaseline.jobs.length,0);
});

test('rejects duplicate runs/attempts and mismatched job identities, while keeping distinct attempts separate',()=>{
 assert.throws(()=>reportTimings(input(sample(),sample())));
 const second=sample({attempt:2});second.jobs[0].id=99;
 const r=reportTimings(input(sample(),second));assert.deepEqual(r.runs.map(x=>x.attempt),[1,2]);
 const repeatedJob=sample({id:2});repeatedJob.jobs[0].id=11;assert.throws(()=>reportTimings(input(sample(),repeatedJob)));
 for(const change of [s=>s.jobs[0].run_id=999,s=>s.jobs[0].run_attempt=2,s=>s.jobs.push({...s.jobs[0]}),s=>s.jobs[0].steps.push({...s.jobs[0].steps[0]})]){
  const s=sample();change(s);assert.throws(()=>reportTimings(input(s)));
 }
 const unknown=sample();delete unknown.run.run_attempt;assert.throws(()=>reportTimings(input(unknown,sample())));
 const conflict=sample();conflict.run.createdAt=date(1);assert.throws(()=>reportTimings(input(conflict)));
});

test('spec and TAP top-level invocations preserve tests/pass/fail/skip; nested summaries and plans are not added twice',()=>{
 const first=log(),nested=date(9)+'     # tests 999\n'+date(9)+'     # pass 999\n'+date(9)+' 1..999\n';
 const second=summary(10,{tests:2,pass:1,skipped:0,todo:1}).replaceAll('ℹ ','# ');
 const p=parseJobLog(first+'\n'+nested+second),c=p.groups[0].counts;
 assert.equal(c.invocations.length,2);assert.deepEqual(c.totals,{tests:5,pass:3,fail:0,cancelled:0,skipped:1,todo:1});
 assert.equal(c.invocations[0].suites,0);assert.equal(c.invocations[0].duration_ms,5000.25);
 const failed=parseJobLog(date(4)+' ##[group]Run test\n'+summary(9,{tests:4,pass:1,fail:1,cancelled:1,skipped:1}));
 assert.equal(failed.groups[0].counts.totals.cancelled,1);
 const duplicate=summary(9,{fail:1})+'\n'+date(9)+' ℹ fail 0';
 const d=parseJobLog(duplicate).groups[0].counts;assert.equal(d.totals,null);
 assert.deepEqual(d.invocations[0].duplicateFields,[{field:'fail',previous:1,next:0}]);
 const s=sample();s.jobs[0].log=duplicate;assert.equal(reportTimings(input(s)).runs[0].jobs[0].baselineEligible,false);
});

test('early GHA endgroup does not truncate execution; metadata intervals win over observed log span',()=>{
 const s=sample();s.jobs[0].log=log()+'\n'+date(11)+' ##[group]Post job cleanup.\n'+date(40)+' Cleanup done';
 const j=reportTimings(input(s)).runs[0].jobs[0];
 assert.equal(j.steps[0].logGroups.length,1);assert.equal(j.steps[0].logGroups[0].counts.totals.tests,3);
 assert.equal(j.steps[0].execution.durationMs,6000);assert.equal(j.observedLogSpan.durationMs,36000);
 // Seconds-resolution boundaries: 10.200 belongs to the newer step, not both.
 s.jobs[0].steps.push({number:2,name:'Next',status:'completed',conclusion:'success',started_at:date(10),completed_at:date(12)});
 s.jobs[0].log=log()+'\n2026-10-30T00:00:10.2000000Z ##[group]Run next\n'+summary(11);
 const steps=reportTimings(input(s)).runs[0].jobs[0].steps;assert.deepEqual(steps.map(x=>x.logGroups.length),[1,1]);
});

test('a missing command boundary never assigns a later step summary to an earlier step',()=>{
 const s=sample();s.jobs[0].completed_at=date(17);
 s.jobs[0].steps.push({number:2,name:'Later group',status:'completed',conclusion:'success',started_at:date(11),completed_at:date(16)});
 s.jobs[0].log=log()+'\n'+summary(14);
 const j=reportTimings(input(s)).runs[0].jobs[0];
 assert.equal(j.counts.totals.tests,6,'Job totals still preserve both invocations');
 assert.deepEqual(j.steps.map(s=>s.logGroups.length),[0,0]);
 assert.equal(j.unassignedLogGroups.length,1);
 assert.equal(j.unassignedLogGroups[0].unassignedReason,'SUMMARY_OUTSIDE_STEP_INTERVAL');
});

test('all UNC separator combinations are rejected before opening a manifest or log path',t=>{
 const paths=[String.raw`\\server.invalid\share\input.json`,String.raw`//server.invalid/share/input.json`,
  String.raw`\/server.invalid/share/input.json`,String.raw`/\server.invalid/share/input.json`];
 const dir=mkdtempSync(path.join(tmpdir(),'ci-timing-local-path-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const remote of paths){
  assert.throws(()=>loadInput(remote),{message:'CI_TIMING_INPUT_INVALID'});
  const s=sample();delete s.jobs[0].log;s.jobs[0].logPath=remote;
  const manifest=path.join(dir,'input.json');writeFileSync(manifest,JSON.stringify(input(s)));
  assert.throws(()=>loadInput(manifest),{message:'CI_TIMING_INPUT_INVALID'});
 }
});

test('missing and truncated logs keep counts unknown rather than zero; unassigned timestamp-less summaries survive',()=>{
 for(const text of ['',date(4)+' test output',date(9)+' ℹ tests 3\n'+date(9)+' ℹ pass 2']){
  const s=sample();s.jobs[0].log=text;const j=reportTimings(input(s)).runs[0].jobs[0];
  assert.equal(j.execution.durationMs,9000);assert.equal(j.counts.totals,null);
 }
 const partial=parseJobLog('ℹ tests 3\nℹ pass 2');assert.equal(partial.groups[0].counts.partialInvocations,1);
 assert.equal(partial.groups[0].counts.invocations[0].fail,null);
 const s=sample();s.jobs[0].log=summary().replaceAll(/2026-\S+ /g,'');
 const j=reportTimings(input(s)).runs[0].jobs[0];assert.equal(j.unassignedLogGroups.length,1);assert.equal(j.counts.totals.tests,3);
 const active=sample({status:'in_progress',conclusion:null});assert.equal(reportTimings(input(active)).runs[0].jobs[0].execution.durationMs,null);
 const huge=summary(9,{tests:Number.MAX_SAFE_INTEGER,pass:Number.MAX_SAFE_INTEGER,skipped:0});
 const overflow=parseJobLog(huge+'\n'+huge).groups[0].counts;assert.equal(overflow.totals,null);assert.equal(overflow.totalsOverflow,true);
});

test('report and CLI output are deterministic; JSON/log paths are local and malformed data never leaks',t=>{
 const a=sample(),b=sample({id:2});const left=reportTimings(input(a,b)),right=reportTimings(input(b,a));
 assert.deepEqual(left,right);assert.equal(renderMarkdown(left),renderMarkdown(right));
 const dir=mkdtempSync(path.join(tmpdir(),'ci-timing-fixture-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const manifest=path.join(dir,'input.json');const local=sample();delete local.jobs[0].log;local.jobs[0].logPath='local.log';
 writeFileSync(path.join(dir,'local.log'),log());writeFileSync(manifest,JSON.stringify(input(local)));
 let output='',error='';const sinks={out:s=>output+=s,err:s=>error+=s};
 assert.equal(main(['--input',manifest],sinks),0);assert.equal(JSON.parse(output).runs[0].jobs[0].counts.totals.tests,3);assert.equal(error,'');
 output='';assert.equal(main(['--input',manifest,'--format','markdown'],sinks),0);assert.match(output,/Workflow start delay/);
 assert.equal(main(['--token','PRIVATE_TEST_SENTINEL'],sinks),1);assert(!error.includes('PRIVATE_TEST_SENTINEL'));
 local.jobs[0].logPath='https://example.invalid/log';writeFileSync(manifest,JSON.stringify(input(local)));assert.throws(()=>loadInput(manifest));
 assert.throws(()=>loadInput('//remote.invalid/shared/input.json'));assert.throws(()=>loadInput('https://example.invalid/input.json'));
 writeFileSync(manifest,'PRIVATE_TEST_SENTINEL');assert.equal(main(['--input',manifest],sinks),1);assert(!error.includes('PRIVATE_TEST_SENTINEL'));
});

test('real exported step clocks reproduce the observed B6 and Business5244 groups without inventing missing queue clocks',()=>{
 const filename=fileURLToPath(new URL('./fixtures/workflow-timing-report/real-20261030.json',import.meta.url));
 const r=reportTimings(loadInput(filename));
 const windows=r.successfulBaseline.jobs.find(j=>j.name==='windows-startup-test');
 assert.deepEqual(windows.reported,{knownSamples:2,unknownSamples:0,minMs:796000,maxMs:1162000,medianMs:979000});
 assert.equal(windows.execution.knownSamples,0);assert.equal(windows.queue.knownSamples,0);
 const b6=r.successfulBaseline.groups.find(g=>g.name.startsWith('B6 finite'));
 const business=r.successfulBaseline.groups.find(g=>g.name.startsWith('Business 5244'));
 assert.equal(b6.duration.minMs,176000);assert.equal(b6.duration.maxMs,291000);
 assert.equal(business.duration.minMs,319000);assert.equal(business.duration.maxMs,415000);
 const build=r.successfulBaseline.groups.find(g=>g.name==='Build web admin and Sites workflow');assert.equal(build.duration.minMs,6000);
 const pr=b6.samples.find(s=>s.runId==='41022751790');assert.equal(pr.counts.totals.tests,235);
 assert.equal(business.samples.find(s=>s.runId==='41022751790').counts.totals.tests,303);
 assert(r.investigationCandidates.every(c=>c.parallelismProven===false&&c.appliedSpeedupMs===null));
});
