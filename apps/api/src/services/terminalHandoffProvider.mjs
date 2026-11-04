import crypto from 'node:crypto';

export const TERMINAL_HANDOFF_VERSION=1;
export const TERMINAL_HANDOFF_PEER_HEADER='x-melisa-terminal-peer';
export const TERMINAL_HANDOFF_TTL_MS=30000;
export const TERMINAL_IDENTITY_FIELDS=Object.freeze(['version','environmentId','database','erpOrigin','crmOrigin','erpUserId','erpNormalSessionId','crmUserId','chatwootAgentId','bindingRevision','expiresAt']);
const ENVIRONMENT='e662fd94-d797-4b3b-938a-d143ad758b67',DATABASE='MELISA_ERP_CLEAN_TEST_20261022';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hex=/^[a-f0-9]{64}$/,opaque=/^[A-Za-z0-9_-]{43}$/;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const challenge=value=>crypto.createHash('sha256').update(value).digest('base64url');
const invalid=()=>Object.assign(Error('Terminal handoff is unavailable'),{code:'TERMINAL_HANDOFF_INVALID',statusCode:403});
function exact(value,keys){if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))throw invalid();}
function secret(value){if(typeof value!=='string'||!opaque.test(value)||Buffer.from(value,'base64url').length!==32||Buffer.from(value,'base64url').toString('base64url')!==value)throw invalid();return value;}
function equal(left,right){return typeof left==='string'&&typeof right==='string'&&left.length===right.length&&crypto.timingSafeEqual(Buffer.from(left),Buffer.from(right));}
function audience(erp,crm){if(!['http://127.0.0.1:5244','http://192.168.1.46:5244'].includes(erp)||crm!==erp.replace(':5244',':62800'))throw invalid();}
function request(value){if(typeof value.requestId!=='string'||typeof value.deviceBinding!=='string'||!uuid.test(value.requestId)||!hex.test(value.deviceBinding))throw invalid();audience(value.erpOrigin,value.crmOrigin);}
function binding(value,userId){
 exact(value,['erpUserId','crmUserId','chatwootAgentId','bindingRevision','active']);
 if(value.active!==true||value.erpUserId!==userId||typeof value.crmUserId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.crmUserId)||!Number.isSafeInteger(value.chatwootAgentId)||value.chatwootAgentId<1||typeof value.bindingRevision!=='string'||!hex.test(value.bindingRevision))throw invalid();
 return {erpUserId:userId,crmUserId:value.crmUserId,chatwootAgentId:value.chatwootAgentId,bindingRevision:value.bindingRevision};
}

/** Narrow process-local delegation adapter; it never issues an ERP/CRM login.
 * Restart loses all codes/links and therefore closes linked CRM authorization.
 * Only server-composed callbacks may supply current family and explicit relation.
 */
export function createTerminalHandoffProvider({context,peerKey,confirmErpPair,readErpFamily,relationFor,enabled=()=>true,now=Date.now,random=()=>crypto.randomBytes(32).toString('base64url'),maxEntries=512}){
 const key=secret(peerKey),tickets=new Map(),links=new Map(),requests=new Map();let closed=false;
 if(typeof confirmErpPair!=='function'||typeof readErpFamily!=='function'||typeof relationFor!=='function'||typeof enabled!=='function'||!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>4096)throw invalid();
 function scope(){if(closed||!enabled()||context?.environment!=='CLEAN_SYNTHETIC_TEST'||context.environmentId!==ENVIRONMENT||context.database!==DATABASE||context.synthetic!==true||context.actualT1!==false||context.externalOperations!==false)throw invalid();}
 scope();
 function peer(value){scope();if(!equal(value,key))throw invalid();}
 function family(value,id,sid){if(!value||value.user?.id!==id||value.normalTestSessionId!==sid||!uuid.test(sid)||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now())throw invalid();return value;}
 function sameRelation(row,value){const next=binding(value,row.erpUserId);if(['erpUserId','crmUserId','chatwootAgentId','bindingRevision'].some(field=>next[field]!==row[field]))throw invalid();}
 async function current(row){
  scope();if(row.closed||row.familyExpiresAt<=now())throw invalid();
  const live=family(await readErpFamily(row.erpUserId,row.erpNormalSessionId),row.erpUserId,row.erpNormalSessionId);
  sameRelation(row,await relationFor(row.erpUserId));
  // Re-read the family after asynchronous relation validation. CRM still must
  // verify immediately before publication and on every protected use.
  const fresh=family(await readErpFamily(row.erpUserId,row.erpNormalSessionId),row.erpUserId,row.erpNormalSessionId);
  sameRelation(row,await relationFor(row.erpUserId));
  const final=family(await readErpFamily(row.erpUserId,row.erpNormalSessionId),row.erpUserId,row.erpNormalSessionId);
  scope();if(row.closed||row.familyExpiresAt<=now())throw invalid();
  return Math.min(live.expiresAt,fresh.expiresAt,final.expiresAt,row.familyExpiresAt);
 }
 function identity(row,expires){return Object.freeze({version:1,environmentId:ENVIRONMENT,database:DATABASE,erpOrigin:row.erpOrigin,crmOrigin:row.crmOrigin,erpUserId:row.erpUserId,erpNormalSessionId:row.erpNormalSessionId,crmUserId:row.crmUserId,chatwootAgentId:row.chatwootAgentId,bindingRevision:row.bindingRevision,expiresAt:Math.min(now()+TERMINAL_HANDOFF_TTL_MS,expires)});}
 function sweep(){for(const [id,row]of tickets)if(row.expiresAt<=now())tickets.delete(id);for(const [id,row]of links)if(row.closed||row.familyExpiresAt<=now())links.delete(id);for(const [id,row]of requests)if(row.expiresAt<=now())requests.delete(id);}
 function allocate(map){for(let tries=0;tries<5;tries++){const value=secret(random()),id=hash(value);if(!map.has(id))return {value,id};}throw invalid();}
 function match(row,input){if(!row||['requestId','deviceBinding','erpOrigin','crmOrigin'].some(field=>row[field]!==input[field]))throw invalid();}
 return {
  async prepare(input){
   scope();exact(input,['accessToken','refreshToken','requestId','deviceBinding','codeChallenge','erpOrigin','crmOrigin']);request(input);secret(input.codeChallenge);
   if(typeof input.accessToken!=='string'||!input.accessToken||typeof input.refreshToken!=='string'||!input.refreshToken)throw invalid();
   const confirmed=await confirmErpPair(input.accessToken,input.refreshToken);
   if(confirmed?.confirmed!==true||!Number.isSafeInteger(confirmed.user?.id)||confirmed.user.id<1||!uuid.test(confirmed.normalTestSessionId)||!Number.isSafeInteger(confirmed.expiresAt)||confirmed.expiresAt<=now())throw invalid();
   scope();sweep();const requestKey=hash(JSON.stringify([input.requestId,input.deviceBinding,input.erpOrigin,input.crmOrigin]));
   if(requests.has(requestKey)||requests.size>=maxEntries)throw invalid();
   const reservation={expiresAt:Math.min(now()+TERMINAL_HANDOFF_TTL_MS,confirmed.expiresAt)};requests.set(requestKey,reservation);
   const relation=binding(await relationFor(confirmed.user.id),confirmed.user.id);
   const live=family(await readErpFamily(confirmed.user.id,confirmed.normalTestSessionId),confirmed.user.id,confirmed.normalTestSessionId);
   const row={...relation,erpNormalSessionId:confirmed.normalTestSessionId,erpOrigin:input.erpOrigin,crmOrigin:input.crmOrigin,requestId:input.requestId,deviceBinding:input.deviceBinding,codeChallenge:input.codeChallenge,familyExpiresAt:live.expiresAt,closed:false};
   await current(row);scope();sweep();if(tickets.size+links.size>=maxEntries||requests.get(requestKey)!==reservation)throw invalid();
   const expiresAt=Math.min(reservation.expiresAt,confirmed.expiresAt,live.expiresAt);if(expiresAt<=now())throw invalid();reservation.expiresAt=live.expiresAt;
   const token=allocate(tickets);tickets.set(token.id,{...row,expiresAt});
   return {version:1,code:token.value,requestId:input.requestId,expiresAt};
  },
  async redeem(input,authorization){
   peer(authorization);exact(input,['code','requestId','deviceBinding','codeVerifier','erpOrigin','crmOrigin']);request(input);secret(input.code);secret(input.codeVerifier);
   const id=hash(input.code),row=tickets.get(id);tickets.delete(id); // synchronous atomic take, before any await
   match(row,input);if(row.expiresAt<=now()||!equal(row.codeChallenge,challenge(input.codeVerifier)))throw invalid();
   const expires=await current(row);scope();if(row.closed||row.expiresAt<=now())throw invalid();
   sweep();if(tickets.size+links.size>=maxEntries)throw invalid();
   const link=allocate(links);links.set(link.id,row);
   return {version:1,linkId:link.value,linkExpiresAt:expires,terminalIdentity:identity(row,expires)};
  },
  async verify(input,authorization){
   peer(authorization);exact(input,['linkId','requestId','deviceBinding','erpOrigin','crmOrigin']);request(input);secret(input.linkId);
   const row=links.get(hash(input.linkId));match(row,input);
   try{const expires=await current(row);scope();return {version:1,linkExpiresAt:expires,terminalIdentity:identity(row,expires)};}
   catch{row.closed=true;links.delete(hash(input.linkId));throw invalid();}
  },
  revoke(input,authorization){
   peer(authorization);exact(input,['linkId','requestId','deviceBinding','erpOrigin','crmOrigin']);request(input);secret(input.linkId);
   const id=hash(input.linkId),row=links.get(id);if(!row)return {revoked:true};match(row,input);row.closed=true;links.delete(id);return {revoked:true};
  },
  close(){closed=true;for(const row of links.values())row.closed=true;tickets.clear();links.clear();requests.clear();},
 };
}
