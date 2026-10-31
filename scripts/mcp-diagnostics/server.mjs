import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createDiagnostics,diagnosticTools,database} from './diagnostics.mjs';
const exec=promisify(execFile);
const here=path.dirname(fileURLToPath(import.meta.url));
const read=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const requireValue=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
async function pinnedModule(entry) {
  requireValue(path.isAbsolute(entry?.path??'')&&/^[a-f0-9]{64}$/.test(entry.sha256??''),'DIAGNOSTIC_LIBRARY_BINDING_INVALID');
  requireValue(createHash('sha256').update(await fs.readFile(entry.path)).digest('hex')===entry.sha256,'DIAGNOSTIC_LIBRARY_CHANGED');
  return import(pathToFileURL(entry.path).href);
}
export async function readConfiguration(bindingFile) {
  const binding=await read(bindingFile);
  requireValue(binding.version===1&&binding.database===database&&binding.port===4213,'DIAGNOSTIC_BINDING_INVALID');
  for(const name of ['powerShell','tokenFile','runtimeConfig','legacyConfig','legacyMapping'])requireValue(path.isAbsolute(binding[name]??''),'DIAGNOSTIC_PATH_INVALID');
  requireValue(Array.isArray(binding.services)&&binding.services.length===3&&new Set(binding.services.map(s=>s.role)).size===3,'DIAGNOSTIC_SERVICE_BINDING_INVALID');
  for(const s of binding.services){
    requireValue(s.port===({erp:4144,native:4146,web:5244})[s.role]&&path.isAbsolute(s.executable)&&path.isAbsolute(s.script),'DIAGNOSTIC_SERVICE_BINDING_INVALID');
    if(s.role!=='web')requireValue(path.isAbsolute(s.runtimeConfig),'DIAGNOSTIC_SERVICE_BINDING_INVALID');
  }
  requireValue(Array.isArray(binding.logFiles)&&binding.logFiles.length<=4&&binding.logFiles.every(f=>path.isAbsolute(f)&&/\.log$/i.test(f)),'DIAGNOSTIC_LOG_BINDING_INVALID');
  return binding;
}
export function createHostAdapters(binding,bindingFile) {
  async function powershell(script,args) {
    try {
      const {stdout}=await exec(binding.powerShell,['-NoProfile','-NonInteractive','-File',path.join(here,script),...args],{windowsHide:true,timeout:12000,maxBuffer:1024*1024,encoding:'utf8'});
      return JSON.parse(stdout.replace(/^\uFEFF/,''));
    }catch(error){
      try{return JSON.parse(error.stdout.replace(/^\uFEFF/,''));}catch{throw Object.assign(new Error('DIAGNOSTIC_PROBE_UNAVAILABLE'),{code:'DIAGNOSTIC_PROBE_UNAVAILABLE'});}
    }
  }
  return {
    async readProcesses(){const result=await powershell('runtime-probe.ps1',['-BindingFile',bindingFile]);return Array.isArray(result)?result:[];},
    async readHealth(){
      return Object.fromEntries(await Promise.all(binding.services.map(async service=>{
        try{
          const response=await fetch(`http://127.0.0.1:${service.port}/${service.role==='web'?'ornek-akis.html':'test-health'}`,{redirect:'error',signal:AbortSignal.timeout(4000)});
          if(service.role==='web'){await response.body?.cancel();return [service.role,{httpOk:response.ok}];}
          requireValue(response.ok,'DIAGNOSTIC_HEALTH_UNAVAILABLE');
          const content=await response.text();requireValue(content.length<65536,'DIAGNOSTIC_HEALTH_TOO_LARGE');
          return [service.role,JSON.parse(content)];
        }catch{return [service.role,{error:'DIAGNOSTIC_HEALTH_UNAVAILABLE'}];}
      })));
    },
    readSql:requestId=>powershell('read-only-probe.ps1',['-RuntimeConfig',binding.runtimeConfig,...(requestId?['-RequestId',requestId]:[])]),
    async readLogTails(){
      return Promise.all(binding.logFiles.map(async file=>{
        let handle;try{handle=await fs.open(file,'r');const {size}=await handle.stat();const buffer=Buffer.alloc(Math.min(size,512*1024));await handle.read(buffer,0,buffer.length,Math.max(0,size-buffer.length));return buffer.toString('utf8');}catch{return '';}finally{await handle?.close();}
      }));
    },
  };
}
export function extendControl(legacyControl,tools,diagnose) {
  for(const tool of diagnosticTools){requireValue(!tools.some(existing=>existing.name===tool.name),'DIAGNOSTIC_DUPLICATE_TOOL');tools.push(tool);}
  return {...legacyControl,
    async status(){const status=await legacyControl.status();return {...status,legacyTestMapping:true,currentBusinessTest:await diagnose('get_runtime_status',{})};},
    execute(name,args,actor){return diagnosticTools.some(t=>t.name===name)?diagnose(name,args):legacyControl.execute(name,args,actor);},
  };
}
export async function startDiagnosticServer(bindingFile) {
  const binding=await readConfiguration(bindingFile);
  const [{createServer},{tools},{createObservedControl}]=await Promise.all([
    pinnedModule(binding.library.server),pinnedModule(binding.library.tools),pinnedModule(binding.library.observer),
  ]);
  const legacy=createObservedControl(await read(binding.legacyConfig),await read(binding.legacyMapping));
  const diagnose=createDiagnostics(createHostAdapters(binding,bindingFile));
  const control=extendControl(legacy,tools,diagnose);
  const token=(await fs.readFile(binding.tokenFile,'utf8')).trim();
  const server=createServer(control,{token});
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.listen(4213,'127.0.0.1',()=>console.log('MCP_DIAGNOSTICS_READY readOnly=true ERP-restarts=0'));
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  startDiagnosticServer(process.env.MELISA_MCP_BINDING_FILE).catch(()=>{console.error('MCP_DIAGNOSTICS_START_FAILED');process.exitCode=1;});
}
