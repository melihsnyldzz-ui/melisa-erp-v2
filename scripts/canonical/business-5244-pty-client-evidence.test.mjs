import test from 'node:test';import assert from 'node:assert/strict';
import {validateClientSelfProbe,validateClientExitObservation} from './business-5244-pty-client-evidence.mjs';
const expected={pid:12345,birth:'134380210844076945',exeSha256:'a'.repeat(64),pwdSha256:'b'.repeat(64)};
const lines=['P1656_PID=12345','P1656_BIRTH='+expected.birth,'P1656_RUNSPACE=1','P1656_EXE='+expected.exeSha256,'P1656_PWD='+expected.pwdSha256,'P1656_END'];
const output=(xs=lines,tail='PS C:\\OwnTemp> ')=>(xs.join('\r\n')+'\r\n'+tail);
test('short exact fields match fresh native context without historical continuity or authority',()=>{const r=validateClientSelfProbe(output(),expected);assert.equal(r.freshSessionProofMatched,true);assert.equal(r.originalBirthKnown,false);assert.equal(r.runtimeGo,false);assert(lines.every(l=>l.length<=75));});
for(const [name,edit,code] of [
 ['missing',a=>a.slice(1),'FIELD_SET'],['extra',a=>[...a,'P1656_OTHER=1'],'FIELD_SET'],['duplicate',a=>[...a.slice(0,4),a[3],a[5]],'FIELD_ORDER'],
 ['wrongPID',a=>['P1656_PID=12346',...a.slice(1)],'PID'],['wrongbirth',a=>a.map((x,i)=>i===1?'P1656_BIRTH=134380210844076946':x),'BIRTH'],
 ['wrongrunspace',a=>a.map((x,i)=>i===2?'P1656_RUNSPACE=2':x),'RUNSPACE'],['wrongexe',a=>a.map((x,i)=>i===3?'P1656_EXE='+'c'.repeat(64):x),'EXE'],
 ['wrappedhash',a=>a.map((x,i)=>i===4?x.slice(0,50)+'\n'+x.slice(50):x),'FIELD_SET']])test('ambiguous self output blocks: '+name,()=>assert.throws(()=>validateClientSelfProbe(output(edit(lines)),expected),new RegExp('CLIENT_PROBE_'+code)));
for(const tail of ['[DBG]: PS C:\\OwnTemp>> ','[Process:12345]: PS C:\\OwnTemp> ','PS C:\\OwnTemp>> '])test('non-normal client context blocks: '+tail,()=>assert.throws(()=>validateClientSelfProbe(output(lines,tail),expected),/CLIENT_PROBE_NORMAL_PROMPT/));
test('changing the expected native birth blocks even if recorded output parses',()=>assert.throws(()=>validateClientSelfProbe(output(),{...expected,birth:'134380210844076946'}),/CLIENT_PROBE_BIRTH/));
test('ConPTY ASCII right padding does not alter an exact hash or repair any payload',()=>{assert.equal(validateClientSelfProbe(output(lines.map(l=>l+'      ')),expected).freshSessionProofMatched,true);for(const bad of ['P1656_EXE='+expected.exeSha256+'0      ','P1656_EXE='+expected.exeSha256+'\t','P1656_EXE='+expected.exeSha256.slice(0,32)+' '+expected.exeSha256.slice(32)])assert.throws(()=>validateClientSelfProbe(output(lines.map((l,i)=>i===3?bad:l)),expected));});
test('observation helper success alone never proves a normal client exit',()=>{
 const a={schema:'melisa-b6-pty-client-readback-admission.v1',clientPid:12345,nativeBirth:expected.birth,fixtureRoot:'own',nonce:'nonce',auditRoot:'audit',auditNonce:'auditnonce',clientSourceSha256:'a',observerSourceSha256:'b',helperSourceSha256:'c',originalBirthKnown:false};
 const r={...a,schema:'melisa-b6-pty-client-readback-result.v1',clientBirth:a.nativeBirth,status:'EXIT_OBSERVED',exitObserved:true,captureVerified:true,nativeExitCode:0,controlCalls:0,waitMilliseconds:60000,runtimeGo:false};
 assert.equal(validateClientExitObservation(r,a).normalExitVerified,true);
 for(const patch of [{nativeExitCode:1},{nativeExitCode:'0'},{exitObserved:false},{clientBirth:'134380210844076946'},{nonce:'foreign'},{originalBirthKnown:true},{controlCalls:1}])assert.throws(()=>validateClientExitObservation({...r,...patch},a));
});
for(const i of [3,4])test('an overlong hash split exactly after 64 hex bytes is not silently truncated: '+i,()=>assert.throws(()=>validateClientSelfProbe(output(lines.map((l,n)=>n===i?l+'\n0':l)),expected),/CLIENT_PROBE_FIELD_SET/));
