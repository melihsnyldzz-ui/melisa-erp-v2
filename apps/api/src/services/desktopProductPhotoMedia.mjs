import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DESKTOP_EMPTY_V7_PROFILE_ID} from '../../../../packages/shared/src/desktopEmptyProfile.mjs';
const ROOT='C:/Users/Xaser/Desktop/ERP/product-media-v1';
const fail=()=>{throw Error('DESKTOP_PRODUCT_PHOTO_UNAVAILABLE');};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function checkDirectory(root){const absolute=path.resolve(root);let part=path.parse(absolute).root;for(const next of absolute.slice(part.length).split(path.sep).filter(Boolean)){part=path.join(part,next);const s=await fs.lstat(part);if(s.isSymbolicLink()||!s.isDirectory())fail();}const actual=await fs.realpath(absolute);if(process.platform==='win32'?actual.toLowerCase()!==absolute.toLowerCase():actual!==absolute)fail();return absolute;}
async function read(root,sha){if(!/^[a-f0-9]{64}$/.test(sha))fail();const dir=await checkDirectory(root),file=path.join(dir,sha+'.png'),link=await fs.lstat(file);if(!link.isFile()||link.isSymbolicLink()||link.nlink!==1||link.size>4194304)fail();const real=await fs.realpath(file);if(process.platform==='win32'?real.toLowerCase()!==file.toLowerCase():real!==file)fail();const handle=await fs.open(file,'r');try{const before=await handle.stat();if(!before.isFile()||before.nlink!==1||before.size!==link.size||before.ino!==link.ino||before.size>4194304)fail();const b=await handle.readFile(),after=await handle.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||hash(b)!==sha)fail();return b;}finally{await handle.close();}}
async function put(root,bytes,sha){if(!Buffer.isBuffer(bytes)||bytes.length>4194304||hash(bytes)!==sha)fail();const dir=await checkDirectory(root),file=path.join(dir,sha+'.png');let h;try{h=await fs.open(file,'wx',0o600);await h.writeFile(bytes);await h.sync();}catch(e){if(e?.code!=='EEXIST')throw e;}finally{if(h)await h.close();}const result=await read(root,sha);if(!result.equals(bytes))fail();}
export const desktopProductPhotoMedia=Object.freeze({read:sha=>read(ROOT,sha),put:(bytes,sha)=>put(ROOT,bytes,sha)});
const emptyMedia=Object.freeze({read:sha=>read('C:/Users/Xaser/Desktop/ERP/empty-profile-db9-media-v1',sha),put:(bytes,sha)=>put('C:/Users/Xaser/Desktop/ERP/empty-profile-db9-media-v1',bytes,sha)});
export function desktopProductPhotoMediaForProfile(targetProfile=null){if(targetProfile===null||targetProfile===undefined)return desktopProductPhotoMedia;if(targetProfile!==DESKTOP_EMPTY_V7_PROFILE_ID)fail();return emptyMedia;}
