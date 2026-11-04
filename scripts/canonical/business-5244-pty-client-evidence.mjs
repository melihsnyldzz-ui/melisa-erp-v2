// Read-only client output validation. No process control or runtime authority.
export function validateClientSelfProbe(raw,expected){
 const need=(x,c)=>{if(!x)throw new Error(c);};
 need(typeof raw==='string','CLIENT_PROBE_OUTPUT_TYPE');
 const text=raw.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\x1b\][^\x07]*\x07/g,'').replace(/\r/g,'');
 // ConPTY may pad a short row to the right edge. Only ASCII end-of-row
 // padding is ignored; payload bytes, wrapped hashes and tabs are not repaired.
 const all=text.split('\n').map(l=>l.replace(/ +$/,''));
 const start=all.findIndex(l=>l.startsWith('P1656_PID=')),end=all.findIndex(l=>l==='P1656_END');
 need(start>=0&&end>start,'CLIENT_PROBE_FIELD_SET');
 const lines=all.slice(start,end+1).filter(l=>l!=='');
 need(all.filter(l=>l.startsWith('P1656_')).length===6,'CLIENT_PROBE_FIELD_SET');
 const names=['PID','BIRTH','RUNSPACE','EXE','PWD'];
 need(lines.length===6&&lines[5]==='P1656_END','CLIENT_PROBE_FIELD_SET');
 const values={};
 for(let i=0;i<names.length;i++){const match=lines[i].match(/^P1656_([A-Z]+)=(\S+)$/);need(match&&match[1]===names[i]&&!Object.hasOwn(values,match[1]),'CLIENT_PROBE_FIELD_ORDER');values[match[1]]=match[2];}
 need(/^[1-9][0-9]{0,9}$/.test(values.PID)&&Number.isSafeInteger(expected?.pid)&&expected.pid>0&&Number(values.PID)===expected.pid,'CLIENT_PROBE_PID');
 need(/^[1-9][0-9]{15,19}$/.test(values.BIRTH)&&values.BIRTH===expected.birth,'CLIENT_PROBE_BIRTH');
 need(values.RUNSPACE==='1','CLIENT_PROBE_RUNSPACE');
 for(const [field,key] of [['EXE','exeSha256'],['PWD','pwdSha256']])need(/^[a-f0-9]{64}$/.test(values[field])&&/^[a-f0-9]{64}$/.test(expected[key]??'')&&values[field]===expected[key],'CLIENT_PROBE_'+field);
 const tail=text.slice(text.lastIndexOf('P1656_END')+'P1656_END'.length).trim();
 need(tail.startsWith('PS ')&&tail.endsWith('>')&&!tail.endsWith('>>')&&!tail.includes('[DBG]')&&!tail.includes('[Process:'),'CLIENT_PROBE_NORMAL_PROMPT');
 return Object.freeze({pid:expected.pid,birth:expected.birth,freshSessionProofMatched:true,originalBirthKnown:false,runtimeGo:false});
}
export function validateClientExitObservation(result,admission){
 const need=(x,c)=>{if(!x)throw new Error(c);};
 need(admission?.schema==='melisa-b6-pty-client-readback-admission.v1'&&result?.schema==='melisa-b6-pty-client-readback-result.v1','CLIENT_EXIT_SCHEMA');
 need(result.status==='EXIT_OBSERVED'&&result.exitObserved===true&&result.captureVerified===true&&result.nativeExitCode===0,'CLIENT_EXIT_NOT_NORMAL');
 need(Number.isSafeInteger(admission.clientPid)&&admission.clientPid>0&&result.clientPid===admission.clientPid&&/^[1-9][0-9]{15,19}$/.test(admission.nativeBirth??'')&&result.clientBirth===admission.nativeBirth,'CLIENT_EXIT_IDENTITY');
 for(const key of ['fixtureRoot','nonce','auditRoot','auditNonce','clientSourceSha256','observerSourceSha256','helperSourceSha256'])need(typeof admission[key]==='string'&&admission[key].length>0&&result[key]===admission[key],'CLIENT_EXIT_BINDING');
 need(result.originalBirthKnown===false&&admission.originalBirthKnown===false&&result.controlCalls===0&&result.waitMilliseconds===60000&&result.runtimeGo===false,'CLIENT_EXIT_AUTHORITY');
 return Object.freeze({normalExitVerified:true,clientPid:admission.clientPid,clientBirth:admission.nativeBirth,originalBirthKnown:false,runtimeGo:false});
}
