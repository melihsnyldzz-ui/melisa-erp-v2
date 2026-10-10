// Pure review/verification contract. No network, Windows, SQL or task mutation.
import {createHash} from 'node:crypto';
export const STABLE_SERVE_HOST='semih.tail295701.ts.net:8443';
const fail=()=>{throw Error('HUB_STABLE_ACCESS_SCOPE_REJECTED');};
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
export const stableAccessHash=value=>createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');
export function assertStableServeBefore(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 function conflicts(node){if(!node||typeof node!=='object')return false;return Object.entries(node).some(([key,item])=>key==='8443'||key.endsWith(':8443')||conflicts(item));}
 if(conflicts(value))fail();return value;
}
export function proposedStableServe(before){
 assertStableServeBefore(before);
 return {...structuredClone(before),TCP:{...structuredClone(before.TCP??{}),'8443':{HTTPS:true}},Web:{...structuredClone(before.Web??{}),[STABLE_SERVE_HOST]:{Handlers:{'/':{Proxy:'http://127.0.0.1:5244'}}}}};
}
export function assertOnlyStableServeAdded(before,after){
 const expected=proposedStableServe(before);if(stableAccessHash(expected)!==stableAccessHash(after))fail();return true;
}
export function stableAccessCommands({forceDaemonBefore=false}={}){
 if(forceDaemonBefore!==false)fail();
 return Object.freeze({apply:[['set','--unattended=true'],['serve','--bg','--https=8443','http://127.0.0.1:5244']],rollback:[['serve','--https=8443','--set-path=/','off'],['set','--unattended=false']],noReset:true,rebootApproved:false,deviceAclChanged:false});
}
