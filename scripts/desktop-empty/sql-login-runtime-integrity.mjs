// Read-only digest of the exact local dependency tree. No network or secrets.
// This binds bytes and names; it does not establish publisher authenticity or
// protect against a concurrent privileged actor changing files after checking.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT='C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\apps\\api\\node_modules';
const FALLBACKS=Object.freeze(['C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\apps\\node_modules',
 'C:\\Users\\Xaser\\Desktop\\ERP\\kaynak\\node_modules','C:\\Users\\Xaser\\Desktop\\ERP\\node_modules',
 'C:\\Users\\Xaser\\Desktop\\node_modules','C:\\Users\\Xaser\\node_modules','C:\\Users\\node_modules','C:\\node_modules',
 'C:\\Users\\Xaser\\.node_modules','C:\\Users\\Xaser\\.node_libraries','C:\\Program Files\\nodejs\\lib\\node']);
const fail=()=>{throw new Error('DESKTOP_RUNTIME_INTEGRITY_REJECTED');};
export function digestRuntimeRecords(records){
 if(!Array.isArray(records))fail();
 const h=createHash('sha256');let previous='';
 for(const r of records){
  if(!r||typeof r!=='object'||typeof r.path!=='string'||r.path.length<1||r.path.includes('\0')||r.path.includes('\n')
   ||r.path<=previous||!['D','F'].includes(r.kind)||!Number.isSafeInteger(r.size)||r.size<0
   ||(r.kind==='D'&&(r.size!==0||r.hash!==''))||(r.kind==='F'&&!/^[0-9a-f]{64}$/.test(r.hash)))fail();
  previous=r.path;h.update(`${r.kind}\0${r.path}\0${r.size}\0${r.hash}\n`,'utf8');
 }
 return h.digest('hex');
}
export function inspectDesktopRuntimeTree(){
 if(process.platform!=='win32'||path.resolve(ROOT)!==ROOT)fail();
 if(FALLBACKS.some(existsSync))fail();
 const rootReal=realpathSync(ROOT);if(rootReal.toLowerCase()!==ROOT.toLowerCase())fail();
 const rows=[];
 function walk(dir,rel){
  const entries=readdirSync(dir,{withFileTypes:true});
  for(const entry of entries){
   const name=entry.name;if(name.includes('\0')||name.includes('\n'))fail();
   const file=path.join(dir,name),relative=rel?`${rel}/${name}`:name,st=lstatSync(file);
   if(st.isSymbolicLink()||(!st.isDirectory()&&!st.isFile()))fail();
   if(realpathSync(file).toLowerCase()!==file.toLowerCase())fail();
   if(st.isDirectory()){rows.push({kind:'D',path:relative,size:0,hash:''});walk(file,relative);}
   else{const contents=readFileSync(file);if(contents.length!==st.size)fail();rows.push({kind:'F',path:relative,size:st.size,hash:createHash('sha256').update(contents).digest('hex')});}
  }
 }
 walk(ROOT,'');rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return Object.freeze({sha256:digestRuntimeRecords(rows),entryCount:rows.length});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{process.stdout.write(JSON.stringify(inspectDesktopRuntimeTree()));}
 catch{process.stderr.write('DESKTOP_RUNTIME_INTEGRITY_REJECTED\n');process.exitCode=1;}
}
