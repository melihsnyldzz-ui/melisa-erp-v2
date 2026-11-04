// Actual Express/Hub child. No shared bootstrap, credentials, database or timers.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const need=(v,c)=>{if(!v)throw Error('P03_LIGHT_'+c);},sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const file=process.argv[2];need(process.argv.length===3&&path.isAbsolute(file),'ARGUMENTS');
function pinnedFile(f,expected){for(let p=path.resolve(f);;p=path.dirname(p)){need(!fs.lstatSync(p).isSymbolicLink(),'REPARSE');if(path.dirname(p)===p)break;}const stat=fs.statSync(f);need(stat.isFile()&&stat.nlink===1&&sha(fs.readFileSync(f))===expected,'FILE_PIN');}
const cfg=JSON.parse(fs.readFileSync(file));
need(cfg.schemaVersion==='melisa-p03-light-hub-child.v1'&&cfg.environment==='P03_LIGHT_REHEARSAL'&&cfg.port===5354&&cfg.host==='127.0.0.1'&&cfg.sqlFree===true&&cfg.actualT1===false,'CONFIG');
const exact=['app/melisaHubReadiness.mjs','launcher/sharedCopyWebApplication.mjs','launcher/start-hub-light-rehearsal.ps1','launcher/p03-light-hub-child.mjs',...['index.html','hub.css','hub.mjs','catalog.mjs'].map(n=>'web/melisa-hub/'+n)];need(cfg.files.length===exact.length&&exact.every(n=>cfg.files.filter(f=>f.path===n).length===1),'FILE_SET');
for(const pin of cfg.files){const f=path.resolve(cfg.packageRoot,pin.path);need(f.startsWith(cfg.packageRoot+path.sep),'SOURCE_PIN');pinnedFile(f,pin.sha256);}
for(const pin of cfg.dependencies.files){need(pin.path.startsWith(cfg.dependencies.root+path.sep),'DEPENDENCY_ROOT');pinnedFile(pin.path,pin.sha256);}
const express=createRequire(path.join(cfg.dependencies.root,'apps/api/package.json'))('express');
const {createSharedCopyWebApplication}=await import(pathToFileURL(path.join(cfg.packageRoot,'launcher/sharedCopyWebApplication.mjs')));
const {createHubMiddleware,HUB_CSP}=await import(pathToFileURL(path.join(cfg.packageRoot,'app/melisaHubReadiness.mjs')));
globalThis.fetch=async()=>{throw Error('P03_LIGHT_OUTBOUND_DENIED');};
const health={ok:true,environment:'P03_LIGHT_REHEARSAL',sqlFree:true,port:5354,actualT1:false,applicationSource:cfg.applicationSource,launcherSource:cfg.launcherSource,generation:cfg.generation,dailyFlowReady:false};
const app=createSharedCopyWebApplication({expressImpl:express,root:path.join(cfg.packageRoot,'web'),publicScope:{environment:'P03_LIGHT_REHEARSAL',synthetic:true},health,csp:HUB_CSP,hosts:['127.0.0.1:5354'],remoteAllowed:a=>a==='127.0.0.1'||a==='::ffff:127.0.0.1',hub:createHubMiddleware({root:path.join(cfg.packageRoot,'web'),context:null,pin:null}),hubLanding:true});
// Finite synthetic reads only; these are not normal ERP identities or roles.
app.get('/__p03-light/synthetic/:kind',(req,res)=>{if(req.get('x-p03-role')!=='reader')return res.sendStatus(403);const rows={customers:[{id:'fixture-c1'}],suppliers:[{id:'fixture-s1'}],products:[{id:'fixture-p1',quantity:'0'},{id:'fixture-p2',quantity:null}]};if(!Object.hasOwn(rows,req.params.kind))return res.sendStatus(404);res.json({environment:'P03_LIGHT_REHEARSAL',synthetic:true,rows:rows[req.params.kind]});});
app.use((_req,res)=>res.sendStatus(404));
const server=await new Promise((resolve,reject)=>{const s=app.listen(5354,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
process.stdout.write(JSON.stringify({event:'P03_LIGHT_READY',pid:process.pid,...health})+'\n');
function lightCloseCode(text){return text==='P03_LIGHT_CLOSE\n'||text==='P03_LIGHT_CLOSE\r\n'?0:1;}
process.stdin.setEncoding('utf8');let input='',closing=false;
function close(code){if(closing)return;closing=true;server.close(()=>process.exit(code));}
process.stdin.on('data',chunk=>{input+=chunk;if(input.length>64||input.includes('\n'))close(lightCloseCode(input));});
process.stdin.on('end',()=>close(lightCloseCode(input)));
