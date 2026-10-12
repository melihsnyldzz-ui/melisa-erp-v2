import * as fs from 'node:fs/promises';
import * as syncFs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {worktest,validateWorktestSession} from './protectedWorkSessionPolicy.mjs';

const fail = () => { throw new Error('WORKTEST_PROTECTED_SESSION_UNAVAILABLE'); };
// Electron 39 requires an existing directory before app.setPath('userData').
export function prepareWorktestUserData(root,io=syncFs) {
  if(!path.isAbsolute(root))fail();
  const parsed=path.parse(root);let current=parsed.root;
  try {
    for(const part of path.relative(parsed.root,root).split(path.sep).filter(Boolean)) {
      current=path.join(current,part);
      let details;try{details=io.lstatSync(current);}catch(e){if(e.code!=='ENOENT')throw e;io.mkdirSync(current,{mode:0o700});details=io.lstatSync(current);}
      if(!details.isDirectory()||details.isSymbolicLink())fail();
    }
    if(io.realpathSync(root)!==path.resolve(root))fail();
    return root;
  } catch { fail(); }
}
export function createProtectedWorkSessionStore({root,safeStorage,platform=process.platform,io=fs,identity=null}) {
  if (platform !== 'win32' || !path.isAbsolute(root)) fail();
  const target = path.join(root,'erp-session.json');
  let queue = Promise.resolve();
  const available = () => { if (safeStorage?.isEncryptionAvailable() !== true) fail(); };
  async function checkedDirectory() {
    const parsed=path.parse(root); let current=parsed.root;
    for (const part of path.relative(parsed.root,root).split(path.sep).filter(Boolean)) {
      current=path.join(current,part);
      try { const s=await io.lstat(current); if (!s.isDirectory() || s.isSymbolicLink()) fail(); }
      catch(e) { if(e.code !== 'ENOENT') throw e; await io.mkdir(current,{mode:0o700}); const s=await io.lstat(current); if(!s.isDirectory() || s.isSymbolicLink()) fail(); }
    }
    if (await io.realpath(root) !== path.resolve(root)) fail();
    try { const s=await io.lstat(target); if(!s.isFile() || s.isSymbolicLink() || s.size > 65536 || s.nlink !== 1) fail(); } catch(e) {if(e.code !== 'ENOENT') throw e;}
  }
  const run=fn=>{const p=queue.then(async()=>{try{return await fn();}catch{fail();}});queue=p.catch(()=>{});return p;};
  return Object.freeze({
    get:()=>run(async()=>{
      available(); await checkedDirectory(); let raw;
      try {raw=await io.readFile(target,'utf8');} catch(e){if(e.code==='ENOENT')return null;throw e;}
      const envelope=JSON.parse(raw);
      if (Object.keys(envelope).sort().join(',') !== 'ciphertext,schemaVersion' || envelope.schemaVersion !== 'melisa-windows-worktest-session.v1' || typeof envelope.ciphertext !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(envelope.ciphertext) || !envelope.ciphertext.length) fail();
      const inner=JSON.parse(safeStorage.decryptString(Buffer.from(envelope.ciphertext,'base64')));
      if(Object.keys(inner).sort().join(',')!=='copyId,origin,realm,session' || inner.copyId!==worktest.copyId || inner.origin!==worktest.origin || inner.realm!=='erp')fail();
      return validateWorktestSession(inner.session,identity);
    }),
    put:value=>run(async()=>{
      const session=validateWorktestSession(value,identity);available();await checkedDirectory();
      const ciphertext=safeStorage.encryptString(JSON.stringify({copyId:worktest.copyId,origin:worktest.origin,realm:'erp',session}));
      if(!Buffer.isBuffer(ciphertext)||!ciphertext.length)fail();
      const temporary=path.join(root,`.session-${randomUUID()}.tmp`);let handle;
      try {handle=await io.open(temporary,'wx',0o600);await handle.writeFile(JSON.stringify({schemaVersion:'melisa-windows-worktest-session.v1',ciphertext:ciphertext.toString('base64')}),'utf8');await handle.sync();await handle.close();handle=null;await checkedDirectory();await io.rename(temporary,target);}
      finally{await handle?.close();await io.unlink(temporary).catch(()=>{});}
      return null;
    }),
    clear:()=>run(async()=>{await checkedDirectory();try{await io.unlink(target);}catch(e){if(e.code!=='ENOENT')throw e;}return null;}),
  });
}
