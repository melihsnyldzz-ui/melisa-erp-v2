// Source-only extraction of the existing private STOP_CAPTURED call.
// No process executor, persistence or CLI. The existing owner supplies execFile
// and a receipt sink. Neither the deployed helper nor its stop policy is changed.
const targets=new Set(['coreWatcher','hubWatcher','hubLauncher','coreSupervisor','erpNative','erpApi','crmNativeOrder','crmCatalog','crmOrders','crmServer','hub']);
const codes=new Set(['ETIMEDOUT','ETIMEOUT','ENOENT','EACCES','EPERM','ABORT_ERR','ERR_CHILD_PROCESS_STDIO_MAXBUFFER']);
const signals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGBREAK']);
const own=(value,key)=>{try{const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}catch{return undefined;}};
function streamKind(value,stderr=false){
 if(value===undefined||value===null)return 'UNAVAILABLE';
 if(typeof value!=='string')return 'OTHER';
 if(value.length>4096)return 'OVERSIZE';
 if(!value.length)return 'EMPTY';const text=value.trim();if(!text)return 'WHITESPACE';
 if(stderr)return text==='CRM06_EXACT_OBSERVATION_STOP_REJECTED'?'STOP_REJECTED':'OTHER';
 return ['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(text)?text:'OTHER';
}
function diagnostic(outcome,value,target){
 const code=own(value,'code'),signal=own(value,'signal'),killed=own(value,'killed');
 let errorType=null;if(outcome==='EXEC_REJECTED'){try{errorType=value instanceof TypeError?'TypeError':value instanceof Error?'Error':'OtherError';}catch{errorType='OtherError';}}
 return Object.freeze({schemaVersion:'crm06-stop-child-diagnostic.v1',phase:'STOP_CAPTURED',target:targets.has(target)?target:'UNKNOWN_TARGET',outcome,
  childExitCode:outcome==='EXEC_REJECTED'?(Number.isSafeInteger(code)&&code>=0&&code<=2147483647?code:null):0,
  staticCode:codes.has(code)?code:outcome==='EXEC_REJECTED'?'UNCLASSIFIED':null,errorType,
  stdoutKind:streamKind(own(value,'stdout')),stderrKind:streamKind(own(value,'stderr'),true),
  signal:signals.has(signal)?signal:null,killed:typeof killed==='boolean'?killed:null});
}
function report(sink,outcome,value,target){
 // A logging failure must not mask the original result, trigger a retry, or
 // alter the stop deadline. Never await the sink or expose the raw value.
 try{if(typeof sink==='function'){const result=sink(diagnostic(outcome,value,target));if(result instanceof Promise)result.catch(()=>{});}}catch{}
}
export async function crm06StopCaptured(item,{run,shell,stopper,options,onDiagnostic,target}){
 const proof={pid:item.pid,parentPid:item.parentPid,nodePath:item.nodePath,ownerSid:item.ownerSid,commandLine:item.commandLine,creationTime:item.creationTime.replace(/(\.\d{6})0Z$/,'$1Z')};
 let r;try{r=await run(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',stopper,'-ExpectedJsonBase64',Buffer.from(JSON.stringify(proof)).toString('base64')],options);}
 catch(error){report(onDiagnostic,'EXEC_REJECTED',error,target);throw error;}
 try{
  if(!(!r.stderr&&['EXACT_OBSERVED_PROCESS_STOPPED','ALREADY_GONE'].includes(r.stdout.trim())))throw Error('REJECTED');
  const result={pid:proof.pid,result:r.stdout.trim()};report(onDiagnostic,'ACCEPTED',r,target);return result;
 }catch(error){report(onDiagnostic,'RESULT_REJECTED',r,target);throw error;}
}
