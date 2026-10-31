import {assertCleanEnvironment} from './cleanSyntheticContext.mjs';
import {normalTestRefreshTarget} from './normalTestRefreshSession.mjs';
import {createTerminalHandoffProvider} from './terminalHandoffProvider.mjs';

const disabled=()=>Object.assign(Error('Terminal handoff is unavailable'),{code:'TERMINAL_HANDOFF_INVALID',statusCode:403});
const fields=['erpUserId','crmUserId','chatwootAgentId','bindingRevision','active'];
export function terminalHandoffConfiguration(context,config=process.env){
 if(config.MELISA_TERMINAL_LINK_ENABLED!=='true')throw disabled();
 assertCleanEnvironment(config);
 if(String(config.API_PORT)!=='4194'||!normalTestRefreshTarget({clean:context,config}))throw disabled();
 const peerKey=config.MELISA_TERMINAL_LINK_PEER_KEY;
 if(typeof peerKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(peerKey)||Buffer.from(peerKey,'base64url').toString('base64url')!==peerKey||[config.JWT_ACCESS_SECRET,config.JWT_SECRET,config.JWT_REFRESH_SECRET].filter(Boolean).includes(peerKey))throw disabled();
 let relations;try{relations=JSON.parse(config.MELISA_TERMINAL_LINK_RELATIONS);}catch{throw disabled();}
 if(!Array.isArray(relations)||relations.length>32)throw disabled();
 const seen=new Set();
 for(const row of relations){
  if(!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).length!==fields.length||fields.some(f=>!Object.hasOwn(row,f))||!Number.isSafeInteger(row.erpUserId)||row.erpUserId<1||typeof row.crmUserId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(row.crmUserId)||!Number.isSafeInteger(row.chatwootAgentId)||row.chatwootAgentId<1||typeof row.bindingRevision!=='string'||!/^[a-f0-9]{64}$/.test(row.bindingRevision)||typeof row.active!=='boolean')throw disabled();
  for(const [name,id]of [['erp',row.erpUserId],['crm',row.crmUserId],['agent',row.chatwootAgentId]]){const key=`${name}:${id}`;if(seen.has(key))throw disabled();seen.add(key);}
 }
 return {peerKey,relations};
}
export function terminalHandoffRequestAllowed(req,{context,config=process.env}={}){
 if(req?.method!=='POST'||!/^\/api\/auth\/terminal-handoff\/(?:prepare|redeem|verify|revoke)$/.test(req.path)||Object.keys(req.query||{}).length)return false;
 try{terminalHandoffConfiguration(context,config);return true;}catch{return false;}
}

/** Existing normal session store supplies authority; configuration supplies only
 * explicit relations, never an alternative login or a caller-selected actor. */
export function createTerminalHandoffRuntime({getContext,config=process.env,confirmErpPair,readErpFamily}){
 const initial=terminalHandoffConfiguration(getContext(),config);
 const current=()=>{
  const value=terminalHandoffConfiguration(getContext(),config);
  if(value.peerKey!==initial.peerKey)throw disabled();
  return value;
 };
 return createTerminalHandoffProvider({context:getContext(),peerKey:initial.peerKey,confirmErpPair,readErpFamily,
  enabled:()=>{try{current();return true;}catch{return false;}},
  relationFor:async userId=>current().relations.find(r=>r.erpUserId===userId),
 });
}
