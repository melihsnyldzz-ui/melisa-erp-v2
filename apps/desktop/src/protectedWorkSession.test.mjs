import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {worktest,worktestMode,approvedWorktestPage,approvedWorktestNavigation,assertWorktestSender,assertWorktestHealth,validateWorktestSession,validateWorktestCall} from './protectedWorkSessionPolicy.mjs';
import {createProtectedWorkSessionStore,prepareWorktestUserData} from './protectedWorkSessionStore.mjs';
const session={accessToken:'PRIVATE_ACCESS',refreshToken:'PRIVATE_REFRESH',userId:'15',username:'normal-personnel',expiresAt:123456789};
const source='a'.repeat(40);
const records=()=>[5234,4184,4186].map((port,i)=>({ok:true,environment:'ISOLATED_TEST_COPY',port,databaseName:worktest.database,copyId:worktest.copyId,sourceCommit:source,actualT1:false,...(i?{serverName:worktest.server,sysadmin:0,databaseControl:0,liveDatabaseAccess:0,originalDatabaseAccess:0,externalOperations:false,automaticJobs:false,writes:i===1,sqlReadOnly:i===2}:{})}));
test('explicit Windows mode fails closed; default mode has no new behavior',()=>{
 assert.equal(worktestMode({},'win32'),null);
 assert.deepEqual(worktestMode({MELISA_DESKTOP_ISOLATED_WORKTEST:'true',MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT:source},'win32'),{sourceCommit:source});
 for(const env of [{MELISA_DESKTOP_ISOLATED_WORKTEST:'false'},{MELISA_DESKTOP_ISOLATED_WORKTEST:'true'},{MELISA_DESKTOP_ISOLATED_WORKTEST:'true',MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT:'../x'}])assert.throws(()=>worktestMode(env,'win32'));
 assert.throws(()=>worktestMode({MELISA_DESKTOP_ISOLATED_WORKTEST:'true',MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT:source},'linux'));
});
test('all three fixed runtime identities and low privilege proofs precede vault access',()=>{
 assertWorktestHealth(records(),source);
 for(const [i,key,value] of [[0,'sourceCommit','b'.repeat(40)],[0,'actualT1',true],[1,'databaseName','LIVE'],[1,'sysadmin',1],[1,'databaseControl',null],[2,'writes',true],[2,'sqlReadOnly',false],[1,'originalDatabaseAccess',1],[1,'copyId','other'],[2,'serverName','other']]){const h=records();h[i][key]=value;assert.throws(()=>assertWorktestHealth(h,source));}
});
test('IPC rejects another window, subframe, CRM, redirect, or destroyed sender',()=>{
 assert(approvedWorktestPage(worktest.erpUrl));assert(approvedWorktestPage('http://127.0.0.1:5234/ornek-akis.html#suppliers'));
 const frame={url:worktest.url},wc={mainFrame:frame,isDestroyed:()=>false,getURL:()=>worktest.url},window={webContents:wc,isDestroyed:()=>false},event={sender:wc,senderFrame:frame};assertWorktestSender(event,window);
 for(const raw of ['http://localhost:5234/terminal.html?worktest=1','http://127.0.0.1:5234/ornek-akis.html#admin','http://127.0.0.1:62700/','file:///x','http://127.0.0.1:5234/terminal.html?worktest=1&other=1','http://x@127.0.0.1:5234/terminal.html?worktest=1'])assert.equal(approvedWorktestPage(raw),false);
 assert.throws(()=>assertWorktestSender({...event,senderFrame:{url:worktest.url}},window));assert.throws(()=>assertWorktestSender({...event,sender:{...wc}},window));frame.url='http://127.0.0.1:62700/';assert.throws(()=>assertWorktestSender(event,window));frame.url=worktest.url;wc.isDestroyed=()=>true;assert.throws(()=>assertWorktestSender(event,window));
});
test('only the exact direct CRM iframe can navigate; it never gains ERP vault access',()=>{
 const mainFrame={},url='http://127.0.0.1:62700/?terminal=1&erpOrigin=http%3A%2F%2F127.0.0.1%3A5234';
 assert(approvedWorktestNavigation({url,isMainFrame:false,frame:{parent:mainFrame}},mainFrame));
 for(const detail of [{url,isMainFrame:true},{url,isMainFrame:false,frame:{parent:{}}},{url:url+'&other=1',isMainFrame:false,frame:{parent:mainFrame}},{url:'http://127.0.0.1:62700/other',isMainFrame:false,frame:{parent:mainFrame}}])assert(!approvedWorktestNavigation(detail,mainFrame));
});
test('vault schema cannot carry role, password, arbitrary actor, path or caller actions',()=>{
 assert.deepEqual(validateWorktestSession(session),session);
 for(const bad of [{...session,userId:'1'},{...session,role:'admin'},{...session,password:'secret'},{...session,refreshToken:''},{...session,username:'a\n'},{...session,expiresAt:1.5}])assert.throws(()=>validateWorktestSession(bad));
 assert.throws(()=>validateWorktestCall('readFile','x'));assert.throws(()=>validateWorktestCall('get',session));assert.throws(()=>validateWorktestCall('clear',{}));
});
async function fixture(t){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'melisa-vault-test-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const key=crypto.randomBytes(32);let available=true;const safeStorage={isEncryptionAvailable:()=>available,encryptString:v=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(v),c.final(),c.getAuthTag()]);},decryptString:v=>{const d=crypto.createDecipheriv('aes-256-gcm',key,v.subarray(0,12));d.setAuthTag(v.subarray(-16));return Buffer.concat([d.update(v.subarray(12,-16)),d.final()]).toString();}};const root=path.join(directory,'vault');return{directory,root,safeStorage,setAvailable:v=>available=v,store:()=>createProtectedWorkSessionStore({root,safeStorage,platform:'win32'})};}
test('atomic ciphertext store reopens and rotates without plaintext or leftover temporary files',async t=>{
 const f=await fixture(t),store=f.store();assert.equal(await store.get(),null);await store.put(session);const raw=await fs.readFile(path.join(f.root,'erp-session.json'),'utf8');for(const s of [session.accessToken,session.refreshToken,session.username])assert(!raw.includes(s));assert.deepEqual(await f.store().get(),session);
 await Promise.all([store.put({...session,accessToken:'ROTATED'}),store.clear()]);assert.equal(await store.get(),null);assert.deepEqual(await fs.readdir(f.root),[]);
});
test('failed atomic replacement retains previous ciphertext and removes temporary output',async t=>{
 const f=await fixture(t);await f.store().put(session);const before=await fs.readFile(path.join(f.root,'erp-session.json'));
 const store=createProtectedWorkSessionStore({root:f.root,safeStorage:f.safeStorage,platform:'win32',io:{...fs,rename:async()=>{throw Error('PRIVATE_PATH');}}});
 await assert.rejects(()=>store.put({...session,refreshToken:'new'}),e=>e.message==='WORKTEST_PROTECTED_SESSION_UNAVAILABLE');assert.deepEqual(await fs.readFile(path.join(f.root,'erp-session.json')),before);assert.deepEqual(await fs.readdir(f.root),['erp-session.json']);
});
test('unavailable encryption never writes plaintext and logout can clear while offline',async t=>{
 const f=await fixture(t),store=f.store();await store.put(session);f.setAvailable(false);await assert.rejects(()=>store.get());await assert.rejects(()=>store.put(session));await store.clear();assert.deepEqual(await fs.readdir(f.root),[]);assert.throws(()=>createProtectedWorkSessionStore({root:f.root,safeStorage:f.safeStorage,platform:'linux'}));
});
test('foreign realm, tampered ciphertext and linked filesystem paths fail closed',async t=>{
 const f=await fixture(t),store=f.store();await store.put(session);const target=path.join(f.root,'erp-session.json'),foreign=f.safeStorage.encryptString(JSON.stringify({copyId:worktest.copyId,origin:'http://127.0.0.1:62700',realm:'crm',session}));await fs.writeFile(target,JSON.stringify({schemaVersion:'melisa-windows-worktest-session.v1',ciphertext:foreign.toString('base64')}));await assert.rejects(()=>store.get());
 await fs.writeFile(target,'{"schemaVersion":"melisa-windows-worktest-session.v1","ciphertext":"AAAA"}');await assert.rejects(()=>store.get());await fs.unlink(target);const external=path.join(f.directory,'external');await fs.mkdir(external);await fs.rmdir(f.root);await fs.symlink(external,f.root,process.platform==='win32'?'junction':'dir');await assert.rejects(()=>store.put(session));assert.deepEqual(await fs.readdir(external),[]);
});
test('sandboxed preload exposes named frozen promise methods, never generic IPC',async()=>{
 const source=await fs.readFile(new URL('./preload.cjs',import.meta.url),'utf8'),exposed={},calls=[];
 vm.runInNewContext(source,{require:()=>({contextBridge:{exposeInMainWorld:(k,v)=>exposed[k]=v},ipcRenderer:{invoke:(...a)=>{calls.push(a);return Promise.resolve(null);}}}),process:{argv:['--melisa-isolated-worktest=true'],platform:'win32',versions:{electron:'39.8.10'}}});
 assert(Object.isFrozen(exposed.MelisaWindowsProtectedSession));assert.deepEqual(Object.keys(exposed.MelisaWindowsProtectedSession),['get','put','clear']);await exposed.MelisaWindowsProtectedSession.put(session);await exposed.MelisaWindowsProtectedSession.clear();assert.deepEqual(calls,[['worktest:protected-session','put',session],['worktest:protected-session','clear']]);
 const legacy={};vm.runInNewContext(source,{require:()=>({contextBridge:{exposeInMainWorld:(k,v)=>legacy[k]=v},ipcRenderer:{}}),process:{argv:[],platform:'win32',versions:{electron:'39.8.10'}}});assert(!legacy.MelisaWindowsProtectedSession);assert.equal(legacy.melisaDesktop.apiBaseUrl,'http://localhost:4100');
});
async function mainFixture({enabled=true,badHealth=false}={}) {
 let diagnosticDirectoryFailure=false;
 let sourceText=await fs.readFile(new URL('./main.mjs',import.meta.url),'utf8');sourceText=sourceText.replace(/^import .*;\r?\n/gm,'').replace('import.meta.url',JSON.stringify(new URL('./main.mjs',import.meta.url).href));
 const calls={spawn:0,http:0,fetch:[],vault:[],external:0},handlers=new Map(),windows=[],appEvents={},paths={},env=enabled?{MELISA_DESKTOP_ISOLATED_WORKTEST:'true',MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT:source}:{};let menu,healthGate=null;
 const app={isPackaged:false,getPath:k=>paths[k]??path.join(os.tmpdir(),k),setPath:(k,v)=>paths[k]=v,requestSingleInstanceLock:()=>true,setAppUserModelId(){},whenReady:()=>Promise.resolve(),on:(k,v)=>appEvents[k]=v,quit(){calls.quitAttempts=(calls.quitAttempts??0)+1;let prevented=false;appEvents['before-quit']?.({preventDefault(){prevented=true;}});if(!prevented){calls.quitApproved=(calls.quitApproved??0)+1;for(const w of windows)if(!w.isDestroyed())w.close();}}};
 class Window {
  static getAllWindows(){return windows;}
  constructor(options){this.options=options;this.events={};this.loaded=[];const frame={url:''};this.webContents={mainFrame:frame,session:{setPermissionRequestHandler(fn){this.requestPermission=fn;},setPermissionCheckHandler(fn){this.checkPermission=fn;},on(){}},events:{},getUserAgent:()=>'',setUserAgent(){},setWindowOpenHandler(fn){this.windowOpen=fn;},on(k,fn){this.events[k]=fn;},isDestroyed:()=>false,getURL:()=>frame.url,executeJavaScript:async()=>true};windows.push(this);}
  on(k,v){this.events[k]=v;}once(k,v){this.events[k]=v;}isDestroyed(){return !!this.destroyed;}close(){let prevented=false;this.events.close?.({preventDefault(){prevented=true;}});calls.closeAttempts=(calls.closeAttempts??0)+1;if(!prevented){this.destroyed=true;calls.closed=(calls.closed??0)+1;}}async loadURL(url){this.loaded.push(url);this.webContents.mainFrame.url=url;}
 }
 const fetchImpl=async url=>{calls.fetch.push(url);if(healthGate)await healthGate;const i=[worktest.origin,worktest.api,worktest.native].findIndex(o=>url===o+'/test-health');const h=records()[i];if(badHealth)h.actualT1=true;return{ok:true,body:(async function*(){yield Buffer.from(JSON.stringify(h));})()};};
 const store={get:async()=>{calls.vault.push('get');return session;},put:async()=>{calls.vault.push('put');return null;},clear:async()=>{calls.vault.push('clear');return null;}};
 calls.diagnostics=[];calls.diagnosticFiles=[];
 const context=vm.createContext({app,BrowserWindow:Window,ipcMain:{handle:(k,v)=>handlers.set(k,v)},Menu:{buildFromTemplate:v=>v,setApplicationMenu:v=>menu=v},shell:{openExternal:()=>calls.external++},safeStorage:{isEncryptionAvailable:()=>true},spawn:()=>{calls.spawn++;throw Error('unexpected spawn');},mkdir:async()=>{},readFile:async()=>'{"apiBaseUrl":"http://localhost:4100"}',stat:async()=>({isFile:()=>true}),writeFile:async()=>{},open:async(file,flag,mode)=>{calls.diagnosticFiles.push({file,flag,mode});return{writeFile:async raw=>calls.diagnostics.push(JSON.parse(raw)),sync:async()=>{},close:async()=>{}};},randomUUID:()=>crypto.randomUUID(),http:{get(_url,_options,fn){calls.http++;fn({resume(){},statusCode:200});return{on(){}};}},path,fileURLToPath:u=>new URL(u).pathname,worktest,worktestMode,approvedWorktestPage,approvedWorktestNavigation,assertWorktestSender,assertWorktestHealth,validateWorktestCall,createProtectedWorkSessionStore:()=>store,prepareWorktestUserData:v=>{if(diagnosticDirectoryFailure&&v.endsWith('protected-session-diagnostics'))throw Error('PRIVATE_REPARSE_PATH');return v;},process:{env,platform:'win32',resourcesPath:os.tmpdir()},fetch:fetchImpl,AbortSignal,Buffer,URL,setTimeout,clearTimeout});
 vm.runInContext(sourceText,context);await new Promise(r=>setTimeout(r,20));return{calls,handlers,window:windows[0],menu,app,appEvents,store,setHealthGate:p=>healthGate=p,setDiagnosticDirectoryFailure:v=>diagnosticDirectoryFailure=v};
}
test('actual main mode branch never starts a stack and gates vault on fresh proof plus current frame',async()=>{
 const f=await mainFixture();assert.equal(f.calls.spawn,0);assert.equal(f.calls.http,0);assert.equal(f.window.loaded[0],worktest.url);assert.equal(f.window.options.webPreferences.sandbox,true);assert.equal(f.window.options.webPreferences.devTools,false);assert.equal(f.window.options.webPreferences.nodeIntegration,false);assert.equal(f.window.webContents.windowOpen({url:'https://example.com'}).action,'deny');assert.equal(f.calls.external,0);
 const event={sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};await f.handlers.get('worktest:protected-session')(event,'get');assert.deepEqual(f.calls.vault,['get']);assert.equal(f.calls.fetch.length,6);
 const old=f.window.webContents.mainFrame;f.window.webContents.mainFrame={url:worktest.url};await assert.rejects(()=>f.handlers.get('worktest:protected-session')(event,'put',session));assert.deepEqual(f.calls.vault,['get']);f.window.webContents.mainFrame=old;
 const blocked=await mainFixture({badHealth:true});assert(blocked.window.loaded[0].startsWith('data:text/html'));await assert.rejects(()=>blocked.handlers.get('worktest:protected-session')({sender:blocked.window.webContents,senderFrame:blocked.window.webContents.mainFrame},'get'));assert.deepEqual(blocked.calls.vault,[]);
});
test('actual legacy main branch retains its previous startup and URL configuration',async()=>{
 const f=await mainFixture({enabled:false});assert.equal(f.window.loaded[0],'http://localhost:5173/');assert(f.calls.http>0);assert.equal(f.calls.fetch.length,0);assert.equal(f.window.options.webPreferences.sandbox,false);assert(!f.handlers.has('worktest:protected-session'));assert(f.handlers.has('desktop:save-api-base-url'));
});
test('fixed ERP/task menu uses existing pending guard and reload preserves the current accepted surface',async()=>{
 const f=await mainFixture(),submenu=f.menu[0].submenu,erp=submenu.find(x=>x.label==='ERP çalışma ekranı'),tasks=submenu.find(x=>x.label==='Personel görevleri'),reload=submenu.find(x=>x.label==='Yenile');
 assert(!submenu.some(x=>x.label==='Sunucu / IP Ayari'));await erp.click();assert.equal(f.window.loaded.at(-1),worktest.erpUrl);await reload.click();assert.equal(f.window.loaded.at(-1),worktest.erpUrl);
 const before=f.window.loaded.length;f.window.webContents.executeJavaScript=async()=>false;await tasks.click();assert.equal(f.window.loaded.length,before);f.window.webContents.executeJavaScript=async()=>true;await tasks.click();assert.equal(f.window.loaded.at(-1),worktest.url);
 let blocked=false;f.window.webContents.events['will-frame-navigate']({url:'https://outside.example',isMainFrame:true,preventDefault:()=>blocked=true});assert(blocked);
});

test('first-run private userData is created before Electron setPath and rejects reparse parents',async t=>{
 const f=await fixture(t),root=path.join(f.directory,'first','userData');assert.equal(prepareWorktestUserData(root),root);assert((await fs.stat(root)).isDirectory());assert.equal(prepareWorktestUserData(root),root);
 const external=path.join(f.directory,'outside');await fs.mkdir(external);const linked=path.join(f.directory,'linked');await fs.symlink(external,linked,process.platform==='win32'?'junction':'dir');assert.throws(()=>prepareWorktestUserData(path.join(linked,'userData')));assert.deepEqual(await fs.readdir(external),[]);
});

const turn=()=>new Promise(r=>setImmediate(r));
const delayed=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('actual main IPC arrival FIFO spans deferred health and vault put so later logout cannot resurrect ciphertext',async()=>{
 const f=await mainFixture(),health=delayed(),put=delayed(),handler=f.handlers.get('worktest:protected-session'),event={sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};let ciphertext=null;
 f.setHealthGate(health.promise);f.store.put=async value=>{f.calls.vault.push('put-start');await put.promise;ciphertext=JSON.stringify(value);f.calls.vault.push('put-end');};f.store.clear=async()=>{f.calls.vault.push('clear');ciphertext=null;};
 const write=handler(event,'put',session),logout=handler(event,'clear');await turn();assert.deepEqual(f.calls.vault,[]);health.resolve();await turn();assert.deepEqual(f.calls.vault,['put-start']);assert.equal(ciphertext,null);put.resolve();await Promise.all([write,logout]);assert.deepEqual(f.calls.vault,['put-start','put-end','clear']);assert.equal(ciphertext,null);
});
test('queued invalid original sender rejects independently while a following valid clear still runs',async()=>{
 const f=await mainFixture(),health=delayed(),handler=f.handlers.get('worktest:protected-session'),oldFrame=f.window.webContents.mainFrame,event={sender:f.window.webContents,senderFrame:oldFrame};f.setHealthGate(health.promise);const first=handler(event,'put',session),rejected=assert.rejects(first,/WORKTEST_PROTECTED_SESSION_UNAVAILABLE/);await turn();f.window.webContents.mainFrame={url:worktest.url};const clear=handler({sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame},'clear');health.resolve();await rejected;await clear;assert.deepEqual(f.calls.vault,['clear']);
});
test('actual window X close and AltF4/menu app quit fail closed for pending, absent, or rejected hook and coalesce double close',async()=>{
 for(const value of [false,undefined,'true']){const f=await mainFixture();f.window.webContents.executeJavaScript=async()=>value;f.window.close();f.app.quit();await turn();await turn();assert.equal(f.window.isDestroyed(),false);assert.equal(f.calls.closed??0,0);assert.equal(f.calls.quitApproved??0,0);}
 const failed=await mainFixture();failed.window.webContents.executeJavaScript=async()=>{throw Error('renderer unavailable');};failed.app.quit();await turn();await turn();assert.equal(failed.window.isDestroyed(),false);assert.equal(failed.calls.quitApproved??0,0);
 const f=await mainFixture(),answer=delayed();let checks=0;f.window.webContents.executeJavaScript=async script=>{checks++;assert.match(script,/typeof window.MelisaWorkingBeforeNavigate === "function"/);assert.match(script,/MelisaWorkingBeforeNavigate\(\) === true/);return answer.promise;};f.window.close();f.window.close();await turn();assert.equal(checks,1);assert.equal(f.window.isDestroyed(),false);answer.resolve(true);await turn();await turn();assert.equal(f.calls.closed,1);assert.equal(f.calls.closeAttempts,3);assert.equal(checks,1);
});
test('pending native close upgraded to app quit succeeds once after its one hook acknowledgement without recursive checks',async()=>{
 const f=await mainFixture(),answer=delayed();let checks=0;f.window.webContents.executeJavaScript=async()=>{checks++;return answer.promise;};assert.equal(f.menu[0].submenu.find(i=>i.label==='Cikis').role,'quit');f.window.close();f.app.quit();f.app.quit();await turn();assert.equal(checks,1);assert.equal(f.calls.quitApproved??0,0);answer.resolve(true);await turn();await turn();assert.equal(f.calls.quitApproved,1);assert.equal(f.calls.closed,1);assert.equal(checks,1);
});
test('isolated persistent draft partition stays separate while protected Windows auth never writes tokens there and missing bridge fails closed',async()=>{
 const f=await mainFixture();assert.equal(f.window.options.webPreferences.partition,'persist:melisa-isolated-worktest');assert.equal(f.window.options.webPreferences.nodeIntegration,false);assert(!f.window.options.webPreferences.nodeIntegrationInSubFrames);
 const {createProtectedDeviceSession}=await import('../../sites-workflow/src/workflow/protectedDeviceSession.mjs'),{createWorkingCatalogSession,workingCatalogTokenKey}=await import('../../sites-workflow/src/workflow/workingCatalogSession.mjs');const location={origin:worktest.origin,protocol:'http:',hostname:'127.0.0.1',port:'5234'},user={id:15,username:'test-personel',role:{code:'isolated_test_sales'},permissions:['sales.view']};let record=null;const map=new Map([['carton-draft','{"quantityExact3":"2.500"}']]),writes=[],storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>{writes.push(k);map.set(k,v);},removeItem:k=>map.delete(k)},native=Object.freeze({get:async()=>record,put:async s=>record=s,clear:async()=>record=null}),host={location,navigator:{userAgent:'Electron MelisaProtectedWork/1'},MelisaWindowsProtectedSession:native},reply=data=>({ok:true,status:200,json:async()=>({success:true,data})});
 const normal=createWorkingCatalogSession({location,apiBase:worktest.api,storage,protectedDevice:createProtectedDeviceSession({host}),fetchImpl:async url=>reply(url.endsWith('/auth/me')?user:{user,accessToken:'private-access',refreshToken:'private-refresh',expiresAt:Date.now()+900000})});await normal.login({username:user.username,password:'fixture'});assert.equal(record.userId,'15');assert.equal(map.has(workingCatalogTokenKey),false);assert(!writes.includes(workingCatalogTokenKey));assert.equal(map.get('carton-draft'),'{"quantityExact3":"2.500"}');await normal.logout();assert.equal(record,null);assert.equal(map.get('carton-draft'),'{"quantityExact3":"2.500"}');normal.dispose();
 const missing=createProtectedDeviceSession({host:{location,navigator:host.navigator}});assert(missing);const denied=createWorkingCatalogSession({location,apiBase:worktest.api,storage,protectedDevice:missing,fetchImpl:async()=>reply({user,accessToken:'forbidden-access',refreshToken:'forbidden-refresh',expiresAt:Date.now()+900000})});await assert.rejects(()=>denied.start());await assert.rejects(()=>denied.login({username:user.username,password:'fixture'}));assert.equal(map.has(workingCatalogTokenKey),false);assert(!writes.includes(workingCatalogTokenKey));denied.dispose();
});

test('only the exact app-owned connection error face may exit or retry; unknown pages cannot use reload to bypass the guard',async()=>{
 const failed=await mainFixture({badHealth:true}),errorUrl=failed.window.loaded[0],reload=failed.menu[0].submenu.find(i=>i.label==='Yenile');
 assert(errorUrl.startsWith('data:text/html'));failed.window.webContents.executeJavaScript=async()=>{throw Error('not an operational renderer');};
 await failed.menu[0].submenu.find(i=>i.label==='ERP çalışma ekranı').click();assert.equal(failed.window.loaded.length,1);
 await assert.rejects(()=>failed.handlers.get('worktest:protected-session')({sender:failed.window.webContents,senderFrame:failed.window.webContents.mainFrame},'get'));assert.deepEqual(failed.calls.vault,[]);
 await reload.click();assert.equal(failed.window.loaded.at(-1),errorUrl);failed.window.close();await turn();await turn();assert.equal(failed.calls.closed,1);
 const unknown=await mainFixture();unknown.window.webContents.mainFrame.url='data:text/html,unowned';const before=unknown.window.loaded.length;await unknown.menu[0].submenu.find(i=>i.label==='Yenile').click();unknown.window.close();await turn();await turn();assert.equal(unknown.window.loaded.length,before);assert.equal(unknown.calls.closed??0,0);
 const changed=await mainFixture({badHealth:true});changed.window.webContents.mainFrame.url=errorUrl+'#changed';changed.window.close();await turn();await turn();assert.equal(changed.calls.closed??0,0);
});

test('isolated IPC rejection records only the exact failed stage/action/time, never input or error fields',async()=>{
 const cases=[['FIRST_SENDER',async f=>({sender:{},senderFrame:{url:'PRIVATE_PATH'}})],['HEALTH',async f=>{f.setHealthGate(Promise.reject(Object.assign(new Error('PRIVATE_SQL_MESSAGE'),{stack:'PRIVATE_STACK',params:{password:'PRIVATE_SECRET'}})));return{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};}],['SECOND_SENDER',async f=>{const wait=delayed();f.setHealthGate(wait.promise);const frame=f.window.webContents.mainFrame;setImmediate(()=>{f.window.webContents.mainFrame={url:worktest.url};wait.resolve();});return{sender:f.window.webContents,senderFrame:frame};}],['VAULT',async f=>{f.store.get=async()=>{throw Object.assign(new Error('PRIVATE_CIPHERTEXT'),{password:'PRIVATE_SECRET'});};return{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};}],['THIRD_SENDER',async f=>{f.store.get=async()=>{f.window.webContents.mainFrame={url:'file:///PRIVATE_PATH'};return session;};return{sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};}]];
 for(const[stage,setup]of cases){const f=await mainFixture(),event=await setup(f);await assert.rejects(()=>f.handlers.get('worktest:protected-session')(event,'get'),/WORKTEST_PROTECTED_SESSION_UNAVAILABLE/);assert.equal(f.calls.diagnostics.length,1);const r=f.calls.diagnostics[0];assert.deepEqual(Object.keys(r).sort(),['action','recordedAt','schemaVersion','stage']);assert.equal(r.stage,stage);assert.equal(r.action,'get');assert.equal(r.schemaVersion,'melisa-windows-worktest-ipc-failure.v1');assert(Number.isFinite(Date.parse(r.recordedAt)));assert(!JSON.stringify(r).includes('PRIVATE'));assert(f.calls.diagnosticFiles.every(d=>d.flag==='wx'&&d.mode===0o600&&d.file.includes('protected-session-diagnostics')&&/ipc-failure-[a-f0-9-]+\.json$/.test(d.file)));}
});
test('reparse/diagnostic failure is best effort and never hides vault errors or leaks the supplied value',async()=>{
 const f=await mainFixture(),event={sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame};f.setDiagnosticDirectoryFailure(true);f.store.put=async()=>{throw Error('PRIVATE_SECRET');};await assert.rejects(()=>f.handlers.get('worktest:protected-session')(event,'put',{...session,accessToken:'PRIVATE_SECRET'}),/WORKTEST_PROTECTED_SESSION_UNAVAILABLE/);assert.deepEqual(f.calls.diagnostics,[]);assert.deepEqual(f.calls.diagnosticFiles,[]);
 f.setDiagnosticDirectoryFailure(false);await assert.rejects(()=>f.handlers.get('worktest:protected-session')(event,'PRIVATE_ACTION',{password:'PRIVATE_SECRET'}));assert.deepEqual(f.calls.diagnostics,[]);assert.deepEqual(f.calls.diagnosticFiles,[]);
 f.store.clear=async()=>{throw Error('PRIVATE_CLEAR');};await assert.rejects(()=>f.handlers.get('worktest:protected-session')(event,'clear'));assert.equal(f.calls.diagnostics[0].action,'clear');assert.equal(f.calls.diagnostics[0].stage,'VAULT');assert(!JSON.stringify(f.calls.diagnostics).includes('PRIVATE'));
});
