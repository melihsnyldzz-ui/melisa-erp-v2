import fs from 'node:fs';import path from 'node:path';import express from 'express';
import {validateSharedCopyBootstrap,assertSharedBootstrapRelease,publicSharedCopyScope} from './src/services/sharedCopyBootstrap.mjs';
import {sharedWebCspFor} from './src/services/sharedCopyWebPolicy.mjs';
import {createHubMiddleware,readHubRuntimePin} from './src/services/melisaHubReadiness.mjs';
import {validateIsolatedOperationCopyContext,copyAssert} from './src/services/isolatedOperationCopyContext.mjs';
import {initializePersistentTerminalSupport,isPersistentTerminalApiPath} from '../../scripts/canonical/terminal-persistent-web-support.mjs';
import {createSharedCopyWebApplication} from './src/services/sharedCopyWebApplication.mjs';
const [configPath]=process.argv.slice(2);copyAssert(path.isAbsolute(configPath??''),'STAGE4_WEB_CONFIG');
const config=JSON.parse(fs.readFileSync(configPath,'utf8')),{context:c,topology,business}=validateSharedCopyBootstrap(config);
const root=path.resolve(business?'../sites-workflow/dist-business':'../sites-workflow/dist-shared'),release=JSON.parse(fs.readFileSync(path.resolve('../../release-manifest.json'),'utf8'));
assertSharedBootstrapRelease(release,c);
copyAssert(fs.existsSync(path.join(root,'ornek-akis.html'))&&!fs.lstatSync(root).isSymbolicLink(),'STAGE4_WEB_BUILD_REQUIRED');
const publicScope=publicSharedCopyScope(c);
const terminal=business?await initializePersistentTerminalSupport({config,context:c,csp:sharedWebCspFor(c)}):null;
const app=createSharedCopyWebApplication({expressImpl:express,root,publicScope,csp:sharedWebCspFor(c),
 hosts:['127.0.0.1','localhost','192.168.1.46'].map(host=>`${host}:${topology.webPort}`),
 remoteAllowed:address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||/^192\.168\.1\.[0-9]{1,3}$/.test(address),
 health:{ok:true,environment:'ISOLATED_TEST_COPY',port:topology.webPort,databaseName:c.target.database,copyId:c.copyId,sourceCommit:release.sourceCommit,packageId:release.packageId,actualT1:false},
 terminal:terminal?{handler:terminal.handler,homeRuntime:terminal.homeRuntime,isApiPath:isPersistentTerminalApiPath}:null,
 hub:business?createHubMiddleware({root,context:c,pin:readHubRuntimePin(process.env.MELISA_HUB_CONFIG_PATH)}):null});
const server=await new Promise((resolve,reject)=>{const s=app.listen(topology.webPort,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
const lanServer=await new Promise((resolve,reject)=>{const s=app.listen(topology.webPort,'192.168.1.46',()=>resolve(s));s.once('error',reject);});
console.log(JSON.stringify({event:'SHARED_WEB_READY',port:topology.webPort,copyId:c.copyId,sourceCommit:release.sourceCommit,packageId:release.packageId}));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>Promise.all([server,lanServer].map(s=>new Promise(resolve=>s.close(resolve)))).then(()=>terminal?.close()).then(()=>process.exit(0)));
