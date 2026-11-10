// Public startup admission only. No SQL, protected store or credential access.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertDesktopV7ProfileBindings,EMPTY_V7_PROFILE_ID,EMPTY_V7_PUBLIC_PATH,LEGACY_V7_PUBLIC_PATH,EMPTY_V7_RECEIPT_PATH,EMPTY_V7_PACKAGE_PATH,EMPTY_V7_ADMISSION_DIRECTORY} from '../../apps/api/src/config/desktopEmptyV7Profile.mjs';
const root='C:/Users/Xaser/Desktop/ERP',hash=b=>createHash('sha256').update(b).digest('hex');
const reject=()=>{throw Error('MASTER_V7_PUBLIC_PROFILE_REJECTED');};
function read(relative){
 if(!/^[A-Za-z0-9_./-]+$/.test(relative)||relative.split('/').includes('..'))reject();
 const file=root+'/'+relative;let p=path.resolve(file);
 for(;;){if(fs.lstatSync(p).isSymbolicLink())reject();const up=path.dirname(p);if(up===p)break;p=up;}
 const fd=fs.openSync(file,'r');try{const s=fs.fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.size>2000000)reject();return fs.readFileSync(fd);}finally{fs.closeSync(fd);}
}
export function readMasterV7Profile(packageHash,expectedAdmissionSha256,targetProfile=null){
 if(typeof packageHash!=='string'||!/^[A-F0-9]{64}$/.test(packageHash))reject();
 if(targetProfile!==null&&targetProfile!==EMPTY_V7_PROFILE_ID)reject();const empty=targetProfile===EMPTY_V7_PROFILE_ID;
 const packageBytes=read(empty?EMPTY_V7_PACKAGE_PATH:'kurulum/master-v7-package.json');if(hash(packageBytes)!==packageHash.toLowerCase())reject();
 const pkg=JSON.parse(packageBytes);if((pkg.targetProfile??null)!==targetProfile)reject();
 // A DB9 manifest without the finite key is rejected by the legacy binding
 // comparison below, before any protected file is selected.
 const admissionBytes=read((empty?EMPTY_V7_ADMISSION_DIRECTORY:'kurulum/master-v7-runtime-admissions')+'/'+packageHash+'.json');
 if(empty&&(typeof expectedAdmissionSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedAdmissionSha256)||hash(admissionBytes)!==expectedAdmissionSha256))reject();
 if(expectedAdmissionSha256!==undefined&&hash(admissionBytes)!==expectedAdmissionSha256)reject();
 const publicBindingBytes=read(empty?EMPTY_V7_PUBLIC_PATH:LEGACY_V7_PUBLIC_PATH);
 const setupReceiptBytes=empty?read(EMPTY_V7_RECEIPT_PATH):undefined;
 return assertDesktopV7ProfileBindings({packageHash:packageHash.toLowerCase(),packageBytes,admissionBytes,publicBindingBytes,setupReceiptBytes});
}
