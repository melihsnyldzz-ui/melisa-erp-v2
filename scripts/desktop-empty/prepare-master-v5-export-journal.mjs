// Explicit fixed-path public binding preparation. No SQL or credentials. Never
// clears a journal/fence, replaces a binding or changes an ACL.
import {lstat,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {parse,resolve,join,dirname} from 'node:path';import {createHash} from 'node:crypto';
import {DESKTOP_FINAL_CANCELLATION_EXPORT_DIRECTORY as directory,DESKTOP_FINAL_CANCELLATION_EXPORT_BINDING_TEXT as text} from '../../apps/api/src/services/desktopFinalCancellationExportFence.mjs';
const hash=createHash('sha256').update(text).digest('hex'),fail=()=>{throw Error('MASTER_V5_EXPORT_BINDING_REJECTED');};
async function directories(path){let part=parse(path).root;for(const name of path.slice(part.length).split(/[\\/]/)){part=join(part,name);const s=await lstat(part);if(s.isSymbolicLink()||!s.isDirectory())fail();}}
try{
 if(process.argv.length!==4||process.argv[2]!=='--expected-binding-sha256'||process.argv[3]!==hash)fail();
 const root=resolve(directory);await directories(dirname(root));
 try{await mkdir(root);}catch(error){if(error.code!=='EEXIST')throw error;}
 await directories(root);const file=join(root,'desktop-target.json');
 try{const s=await lstat(file);if(s.isSymbolicLink()||!s.isFile()||s.size>2048||await readFile(file,'utf8')!==text)fail();}
 catch(error){if(error.code!=='ENOENT')throw error;if((await readdir(root)).length!==0)fail();await writeFile(file,text,{flag:'wx',mode:0o600});}
 if(await readFile(file,'utf8')!==text)fail();
 process.stdout.write(JSON.stringify({state:'MASTER_V5_EXPORT_BINDING_PREPARED',sha256:hash,existingJournalPreserved:true}));
}catch{process.stderr.write('MASTER_V5_EXPORT_BINDING_REJECTED');process.exitCode=1;}
