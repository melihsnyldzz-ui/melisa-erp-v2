import {readFile,lstat} from 'node:fs/promises';
import {worktest} from './protectedWorkSessionPolicy.mjs';
import {validateSemihEntryPin} from './semihHostEntry.mjs';

export const worktestPackageSchema='melisa-windows-worktest-package.v1';
const fail=()=>{throw new Error('WORKTEST_PACKAGE_PIN_INVALID');};
export function validateWorktestPackage(value) {
  const fields=Object.keys(value??{}).sort().join(',');
  if(!value || Object.getPrototypeOf(value)!==Object.prototype || !['copyId,databaseName,schemaVersion,serverName,sourceCommit','copyId,databaseName,schemaVersion,semihTestEntry,serverName,sourceCommit'].includes(fields) || value.schemaVersion!==worktestPackageSchema || !/^[a-f0-9]{40}$/.test(value.sourceCommit??'') || value.copyId!==worktest.copyId || value.databaseName!==worktest.database || value.serverName!==worktest.server)fail();
  try{return Object.freeze({...value,...(Object.hasOwn(value,'semihTestEntry')?{semihTestEntry:validateSemihEntryPin(value.semihTestEntry)}:{})});}catch{fail();}
}
export async function readWorktestPackage() {
  try {
    const file=new URL('./worktest-package.json',import.meta.url),details=await lstat(file);
    if(!details.isFile() || details.isSymbolicLink() || details.size>4096)fail();
    return validateWorktestPackage(JSON.parse(await readFile(file,'utf8')));
  } catch { fail(); }
}
export async function startWorktestEntry({env=process.env,platform=process.platform,electronVersion=process.versions.electron,readPin=readWorktestPackage,loadMain=()=>import('./main.mjs')}={}) {
  if(platform!=='win32'||electronVersion!=='39.8.10')fail();
  const pin=validateWorktestPackage(await readPin());
  // The immutable colocated public pin, never an environment override, chooses
  // the already-running runtime. No credentials, session or server are created.
  env.MELISA_DESKTOP_ISOLATED_WORKTEST='true';
  env.MELISA_DESKTOP_WORKTEST_SOURCE_COMMIT=pin.sourceCommit;
  if(pin.semihTestEntry)env.MELISA_DESKTOP_SEMIH_ENTRY_PIN=JSON.stringify(pin.semihTestEntry);
  else delete env.MELISA_DESKTOP_SEMIH_ENTRY_PIN;
  return loadMain();
}
// Importing the validator in ordinary Node staging/tests cannot launch Electron.
if(process.versions.electron!==undefined)await startWorktestEntry();
