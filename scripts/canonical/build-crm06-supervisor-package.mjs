// Immutable supervisor-only source bundle. No npm/build, application deployment,
// service/config/SQL operation, dependency copy, restore or deletion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'../..'),fail=()=>{throw Error('CRM06_SUPERVISOR_PACKAGE_REJECTED');};
if(process.platform!=='win32'||process.argv.length!==3)fail();
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(commit)||execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim())fail();
const target=path.resolve(process.argv[2]),expected=['20261014','20261015','20261017'].map(day=>path.join('C:\\Sirket\\ERP\\releases','CANONICAL-CRM06-SUPERVISOR-TEST-'+day+'-'+commit.slice(0,12)));
if(!expected.some(value=>target.toLowerCase()===value.toLowerCase())||fs.existsSync(target))fail();
for(let p=path.dirname(target);;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())fail();if(p===path.dirname(p))break;}
fs.mkdirSync(target);
// Stream the committed Git archive directly to tar; no temporary source copy.
const archive=execFileSync('git',['archive','--format=tar',commit,'scripts/canonical'],{cwd:repo,maxBuffer:32*1024*1024});
execFileSync('tar.exe',['-xf','-','-C',target],{input:archive,windowsHide:true,maxBuffer:65536});
const files=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isSymbolicLink())fail();if(entry.isDirectory())walk(full);else if(entry.isFile()){const relative=path.relative(target,full).replaceAll('\\','/');if(!relative.startsWith('scripts/canonical/')||!/^[-_a-zA-Z0-9./]+$/.test(relative)||/\.(env|dpapi|bak)$/i.test(relative))fail();files.push({path:relative,sha256:crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')});}else fail();}}
walk(target);files.sort((a,b)=>a.path.localeCompare(b.path,'en'));
if(!['scripts/canonical/terminal-completion-logon.mjs','scripts/canonical/watch-terminal-completion-logon.ps1','scripts/canonical/hub-stack-driver.mjs','scripts/canonical/crm06-owner-projection.mjs','scripts/canonical/crm06-staff-refresh-successor.mjs','scripts/canonical/crm06-staff-journal-preflight.mjs','scripts/canonical/crm06-staff-journal-preflight.ps1'].every(name=>files.some(file=>file.path===name)))fail();
const manifest={packageId:'CRM06-SUPERVISOR-TEST-'+commit.slice(0,12),sourceCommit:commit,packageRole:'SUPERVISOR_ONLY',database:'MELISA_ERP_CRM_SHARED_TEST_20261009_02',actualT1:false,externalOperations:false,writes:false,applicationDeployment:false,builtAt:new Date().toISOString(),files};
fs.writeFileSync(path.join(target,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({packageRoot:target,sourceCommit:commit,files:files.length,packageRole:'SUPERVISOR_ONLY',manifestSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(target,'release-manifest.json'))).digest('hex')}));
