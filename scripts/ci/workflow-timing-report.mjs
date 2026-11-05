import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fail=()=>{throw Error('CI_TIMING_INPUT_INVALID');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const countKeys=['tests','pass','fail','cancelled','skipped','todo'];
const summaryKeys=[...countKeys,'suites','duration_ms'];
const label=x=>typeof x==='string'?x.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300):'Unknown';
const identifier=x=>{if(Number.isSafeInteger(x)&&x>0)return String(x);if(typeof x==='string'&&/^[1-9]\d*$/.test(x))return x;return fail();};
function field(x,snake,camel){
 if(x[snake]!==undefined&&x[camel]!==undefined&&x[snake]!==x[camel])fail();
 return x[snake]??x[camel]??null;
}
// GitHub timestamps are UTC. Reject invalid dates instead of normalizing them.
function time(x){
 if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(x))return null;
 const n=Date.parse(x);return Number.isFinite(n)&&new Date(n).toISOString().slice(0,19)===x.slice(0,19)?n:null;
}
export function interval(start,end){
 const a=time(start),b=time(end);
 const reason=start===null||start===undefined?'MISSING_START':end===null||end===undefined?'MISSING_END':a===null?'INVALID_START':b===null?'INVALID_END':b<a?'REVERSED_INTERVAL':null;
 return {durationMs:reason?null:b-a,reason};
}
const blankSummary=()=>Object.fromEntries(summaryKeys.map(k=>[k,null]));
function summarize(invocations){
 const complete=invocations.filter(x=>!x.duplicateFields&&countKeys.every(k=>Number.isSafeInteger(x[k])));
 const totals=Object.fromEntries(countKeys.map(k=>[k,complete.reduce((sum,x)=>sum+x[k],0)]));
 return {invocations,completeInvocations:complete.length,partialInvocations:invocations.length-complete.length,
  totalsOverflow:!Object.values(totals).every(Number.isSafeInteger),
  totals:invocations.length&&complete.length===invocations.length&&Object.values(totals).every(Number.isSafeInteger)?totals:null};
}

export function parseJobLog(log=''){
 if(typeof log!=='string')fail();
 const groups=[];let group=null,summary=null,first=null,last=null;
 const newGroup=startedAt=>({index:groups.length+1,startedAt,lastSummaryAt:null,summaryStartAt:null,summaryEndAt:null,untimedSummary:false,summaries:[]});
 const finishSummary=()=>{if(summary){group.summaries.push(summary);summary=null;}};
 const finishGroup=()=>{if(group){finishSummary();group.counts=summarize(group.summaries);delete group.summaries;groups.push(group);group=null;}};
 for(const raw of log.replace(/^\uFEFF/,'').split(/\r?\n/)){
  const line=raw.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,''),match=/^(\S+) (.*)$/.exec(line);
  const stamp=match&&time(match[1])!==null?match[1]:null,text=stamp?match[2]:line;
  if(stamp){first??=stamp;last=stamp;}
  if(text.startsWith('##[group]Run ')){
   finishGroup();group=newGroup(stamp);
  }else if(text.startsWith('##[group]Post job cleanup')||text==='Cleaning up orphan processes')finishGroup();
  // endgroup only ends the displayed command/env block, before the test runs.
  const counter=/^(?:ℹ|#) (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)\s*$/.exec(text);
  const duration=/^(?:ℹ|#) duration_ms (\d+(?:\.\d+)?)\s*$/.exec(text);
  if(!counter&&!duration)continue;
  group??=newGroup(null);
  const key=counter?counter[1]:'duration_ms',value=Number(counter?counter[2]:duration[1]);
  if(!Number.isFinite(value)||counter&&!Number.isSafeInteger(value))continue;
  if(key==='tests'&&summary?.tests!==null&&summary?.tests!==undefined)finishSummary();
  summary??=blankSummary();if(summary[key]!==null){summary.duplicateFields??=[];summary.duplicateFields.push({field:key,previous:summary[key],next:value});}
  summary[key]=value;group.lastSummaryAt=stamp??group.lastSummaryAt;
  if(stamp){
   if(group.summaryStartAt===null||time(stamp)<time(group.summaryStartAt))group.summaryStartAt=stamp;
   if(group.summaryEndAt===null||time(stamp)>time(group.summaryEndAt))group.summaryEndAt=stamp;
  }else group.untimedSummary=true;
 }
 finishGroup();
 return {observedSpan:interval(first,last),groups};
}
const success=x=>x?.status==='completed'&&x?.conclusion==='success';
const contradictory=groups=>groups.some(g=>g.counts.invocations.some(c=>(c.fail??0)>0||(c.cancelled??0)>0||
 c.duplicateFields?.some(d=>['fail','cancelled'].includes(d.field)&&(d.previous>0||d.next>0))));
const stats=values=>{
 const known=values.filter(x=>typeof x==='number').sort((a,b)=>a-b),n=known.length;
 return {knownSamples:n,unknownSamples:values.length-n,minMs:n?known[0]:null,maxMs:n?known[n-1]:null,
  medianMs:n?(known[Math.floor((n-1)/2)]+known[Math.floor(n/2)])/2:null};
};
const compare=(a,b)=>a<b?-1:a>b?1:0;
function attempt(x){const n=field(x,'run_attempt','attempt');if(n!==null&&(!Number.isSafeInteger(n)||n<1))fail();return n;}

export function reportTimings(input){
 if(!object(input)||input.schemaVersion!=='melisa-ci-timing-input.v1'||!Array.isArray(input.runs))fail();
 const seenRuns=new Map(),seenJobs=new Set(),runs=[];
 for(const item of input.runs){
  if(!object(item)||!object(item.run)||!Array.isArray(item.jobs))fail();
  const r=item.run,runId=identifier(r.id),runAttempt=attempt(r),previous=seenRuns.get(runId)??[];
  if(previous.includes(runAttempt)||previous.includes(null)||previous.length&&runAttempt===null)fail();
  seenRuns.set(runId,[...previous,runAttempt]);
  const startDelay=interval(field(r,'created_at','createdAt'),field(r,'run_started_at','startedAt')),sha=field(r,'head_sha','headSha');
  const run={runId,attempt:runAttempt,workflow:r.workflow_id===undefined?label(r.name):identifier(r.workflow_id),event:label(r.event),
   headSha:typeof sha==='string'&&/^[a-f0-9]{40}$/i.test(sha)?sha:null,
   status:label(r.status),conclusion:r.conclusion===null?null:label(r.conclusion),
   successful:success(r)&&item.jobs.every(success),workflowStartDelay:startDelay,jobs:[]};
  const jobIds=new Set();
  for(const j of item.jobs){
   if(!object(j))fail();const jobId=identifier(j.id);
   const jobRunId=field(j,'run_id','runId');
   if(jobIds.has(jobId)||seenJobs.has(jobId)||jobRunId!==null&&identifier(jobRunId)!==runId||attempt(j)!==null&&attempt(j)!==runAttempt)fail();
   jobIds.add(jobId);seenJobs.add(jobId);
   if(j.steps!==undefined&&!Array.isArray(j.steps))fail();
   const parsed=parseJobLog(j.log??''),steps=(j.steps??[]).map(s=>{
    if(!object(s)||!Number.isSafeInteger(s.number)||s.number<1)fail();
    const startedAt=field(s,'started_at','startedAt'),completedAt=field(s,'completed_at','completedAt');
    return {number:s.number,name:label(s.name),status:label(s.status),conclusion:s.conclusion===null?null:label(s.conclusion),
     startedAt,completedAt,execution:s.status==='completed'?interval(startedAt,completedAt):{durationMs:null,reason:'NOT_COMPLETED'},logGroups:[]};
   }).sort((a,b)=>a.number-b.number);
   if(new Set(steps.map(s=>s.number)).size!==steps.length)fail();
   const unassignedLogGroups=[];
   for(const g of parsed.groups){
    const stamp=time(g.startedAt),matches=steps.filter(s=>{
     const start=time(s.startedAt),end=time(s.completedAt);
     // API timestamps can have whole-second precision; never use this margin
     // to change a reported duration. Prefer the latest start at boundaries.
     const margin=typeof s.completedAt==='string'&&!s.completedAt.includes('.')?999:0;
     return stamp!==null&&start!==null&&end!==null&&end>=start&&stamp>=start&&stamp<=end+margin;
    }).sort((a,b)=>time(b.startedAt)-time(a.startedAt));
    const mapped=matches[0];
    if(mapped&&(!matches[1]||time(mapped.startedAt)!==time(matches[1].startedAt))){
     const margin=!mapped.completedAt.includes('.')?999:0;
     if(g.counts.invocations.length&&(g.untimedSummary||time(g.summaryStartAt)<time(mapped.startedAt)||time(g.summaryEndAt)>time(mapped.completedAt)+margin)){
      unassignedLogGroups.push({...g,unassignedReason:g.untimedSummary?'SUMMARY_TIMESTAMPS_MISSING':'SUMMARY_OUTSIDE_STEP_INTERVAL'});
     }else mapped.logGroups.push(g);
    }else unassignedLogGroups.push({...g,unassignedReason:'NO_UNIQUE_STEP_MATCH'});
   }
   const countConflict=contradictory(parsed.groups),eligible=run.successful&&success(j)&&!countConflict;
   const reported=j.reported_duration_ms;
   if(reported!==undefined&&(!Number.isSafeInteger(reported)||reported<0||typeof j.reported_duration_source!=='string'||!j.reported_duration_source))fail();
   run.jobs.push({jobId,name:label(j.name),status:label(j.status),conclusion:j.conclusion===null?null:label(j.conclusion),
    baselineEligible:eligible,excludedReason:!run.successful?'RUN_NOT_COMPLETED_SUCCESS':!success(j)?'JOB_NOT_COMPLETED_SUCCESS':countConflict?'FAILED_OR_CANCELLED_TESTS_IN_LOG':null,
    queue:interval(field(j,'queued_at','queuedAt'),field(j,'started_at','startedAt')),
    triggerToJobStart:interval(field(r,'created_at','createdAt'),field(j,'started_at','startedAt')),
    execution:j.status==='completed'?interval(field(j,'started_at','startedAt'),field(j,'completed_at','completedAt')):{durationMs:null,reason:'NOT_COMPLETED'},
    reportedDuration:reported===undefined?null:{durationMs:reported,source:label(j.reported_duration_source)},
    observedLogSpan:parsed.observedSpan,counts:summarize(parsed.groups.flatMap(g=>g.counts.invocations)),steps,unassignedLogGroups});
  }
  run.jobs.sort((a,b)=>compare(a.jobId,b.jobId));runs.push(run);
 }
 runs.sort((a,b)=>compare(a.runId,b.runId)||(a.attempt??0)-(b.attempt??0));
 const jobs=new Map(),groups=new Map();
 for(const r of runs)for(const j of r.jobs){
  if(!j.baselineEligible)continue;
  const key=r.workflow+'\0'+j.name;
  if(!jobs.has(key))jobs.set(key,{workflow:r.workflow,name:j.name,samples:[]});
  jobs.get(key).samples.push({runId:r.runId,attempt:r.attempt,jobId:j.jobId,executionMs:j.execution.durationMs,
   reportedMs:j.reportedDuration?.durationMs??null,startDelayMs:r.workflowStartDelay.durationMs,queueMs:j.queue.durationMs,counts:j.counts});
  for(const s of j.steps){
   if(!success(s)||s.execution.durationMs===null)continue;
   const gkey=key+'\0'+s.name;
   if(!groups.has(gkey))groups.set(gkey,{workflow:r.workflow,jobName:j.name,name:s.name,samples:[]});
   groups.get(gkey).samples.push({runId:r.runId,attempt:r.attempt,jobId:j.jobId,number:s.number,durationMs:s.execution.durationMs,
    counts:summarize(s.logGroups.flatMap(g=>g.counts.invocations))});
  }
 }
 const baselineJobs=[...jobs.values()].sort((a,b)=>compare(a.workflow+'\0'+a.name,b.workflow+'\0'+b.name)).map(j=>({...j,
  execution:stats(j.samples.map(s=>s.executionMs)),reported:stats(j.samples.map(s=>s.reportedMs)),
  startDelay:stats(j.samples.map(s=>s.startDelayMs)),queue:stats(j.samples.map(s=>s.queueMs))}));
 const baselineGroups=[...groups.values()].map(g=>({...g,duration:stats(g.samples.map(s=>s.durationMs))}))
  .sort((a,b)=>(b.duration.maxMs-a.duration.maxMs)||compare(a.workflow+'\0'+a.jobName+'\0'+a.name,b.workflow+'\0'+b.jobName+'\0'+b.name));
 const candidates=baselineGroups.filter(g=>g.samples.some(s=>s.counts.invocations.length)).slice(0,3).map(g=>({
  workflow:g.workflow,jobName:g.jobName,name:g.name,duration:g.duration,samples:g.samples.length,
  parallelismProven:false,appliedSpeedupMs:null,missingEvidence:[
   'Test groups must not share files, ports, processes, mutexes, environment or temporary directories.',
   'Ordering and cleanup dependencies must be inspected before parallel execution.',
   'Pass/fail/cancelled/skip counts must match in repeated isolated measurements.'
  ]}));
 return {schemaVersion:'melisa-ci-timing-report.v1',runs,successfulBaseline:{jobs:baselineJobs,groups:baselineGroups},investigationCandidates:candidates,
  limitations:[
   'Workflow start delay and trigger-to-job delay are not a measured runner queue; queue needs queued_at.',
   'Missing or invalid endpoints remain unknown. updated_at and Date.now are never completion evidence.',
   'Job execution, explicitly reported duration, log span and Node duration_ms are distinct measurements.',
   'Successful samples are exploratory observations, not proof of independent groups or applied speedup.',
   'Counts are reported top-level invocations, not deduplicated unique test identities across runs.'
  ]};
}

const markdown=x=>String(x).replace(/[|`<>]/g,c=>({'|':'\\|','`':'\\`','<':'&lt;','>':'&gt;'}[c])).replace(/[\r\n]/g,' ');
const seconds=x=>x===null?'unknown':(x/1000).toFixed(3)+' s';
export function renderMarkdown(report){
 const lines=['# Offline CI timing report','','| Run / attempt | Job | Baseline | Workflow start delay | Job queue | Execution | Reported | Tests / pass / fail / cancelled / skip / todo |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |'];
 for(const r of report.runs)for(const j of r.jobs){const c=j.counts.totals;
  lines.push(`| ${r.runId} / ${r.attempt??'unknown'} | ${markdown(j.name)} | ${j.baselineEligible?'included':j.excludedReason} | ${seconds(r.workflowStartDelay.durationMs)} | ${seconds(j.queue.durationMs)} | ${seconds(j.execution.durationMs)} | ${seconds(j.reportedDuration?.durationMs??null)} | ${c?countKeys.map(k=>c[k]).join(' / '):'unknown / partial'} |`);
 }
 lines.push('','## Successful step durations','','| Job / step | Min | Max | Samples | Reported count variants (tests / pass / fail / cancelled / skip / todo) |',
  '| --- | --- | --- | --- | --- |');
 for(const g of report.successfulBaseline.groups){
  const variants=[...new Set(g.samples.map(s=>s.counts.totals?countKeys.map(k=>s.counts.totals[k]).join(' / '):'unknown / partial'))].sort();
  lines.push(`| ${markdown(g.jobName)} / ${markdown(g.name)} | ${seconds(g.duration.minMs)} | ${seconds(g.duration.maxMs)} | ${g.samples.length} | ${variants.join('; ')} |`);
 }
 lines.push('','## Long successful test groups to investigate','');
 for(const c of report.investigationCandidates)lines.push(`- ${markdown(c.jobName)} / ${markdown(c.name)}: ${seconds(c.duration.minMs)}–${seconds(c.duration.maxMs)} (${c.samples} samples). Parallelism NOT PROVEN; applied speedup unknown.`,...c.missingEvidence.map(x=>'  - '+x));
 lines.push('','## Evidence gaps','',...report.limitations.map(x=>'- '+x));return lines.join('\n')+'\n';
}

export function loadInput(filename){
 const local=p=>typeof p==='string'&&p.length>0&&!p.includes('\0')&&!/^[\\/]{2}/.test(p)&&!(/^[a-z][a-z0-9+.-]*:/i.test(p)&&!path.isAbsolute(p));
 if(!local(filename))fail();
 const input=JSON.parse(readFileSync(filename,'utf8').replace(/^\uFEFF/,''));
 if(!object(input)||!Array.isArray(input.runs))fail();
 for(const item of input.runs){if(!Array.isArray(item.jobs))fail();for(const job of item.jobs){
  if(job.logPath!==undefined){if(!local(job.logPath)||job.log!==undefined)fail();
   job.log=readFileSync(path.resolve(path.dirname(filename),job.logPath),'utf8');}
 }}return input;
}
export function main(argv,{out=s=>process.stdout.write(s),err=s=>process.stderr.write(s)}={}){
 try{
  if(argv.length===1&&argv[0]==='--help'){out('Usage: node workflow-timing-report.mjs --input local.json [--format json|markdown]\n');return 0;}
  if(![2,4].includes(argv.length)||argv[0]!=='--input'||argv.length===4&&(argv[2]!=='--format'||!['json','markdown'].includes(argv[3])))fail();
  const report=reportTimings(loadInput(argv[1]));out(argv[3]==='markdown'?renderMarkdown(report):JSON.stringify(report,null,2)+'\n');return 0;
 }catch{err('CI_TIMING_INPUT_INVALID: supply local metadata/log files with valid identities.\n');return 1;}
}
if(path.resolve(process.argv[1]??'')===fileURLToPath(import.meta.url))process.exitCode=main(process.argv.slice(2));
