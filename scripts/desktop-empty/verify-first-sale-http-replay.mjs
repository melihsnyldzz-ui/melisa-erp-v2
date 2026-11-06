// Dedicated fixture only. Existing operator password arrives over private stdin.
// Never emits credentials/tokens/bodies. This is HTTP, not GUI acceptance.
import {createHash} from 'node:crypto';
let secret,token;
const body={requestId:'62f30223-56e9-4152-94e3-90a693293703',customerId:'2',invoiceId:'5',expectedVersion:'0x000000000002981B',productIds:['1','2']};
export const firstSaleReplayHash=()=>createHash('sha256').update(JSON.stringify({actorId:'30002',c:body})).digest('hex');
if(process.argv[2]==='--hash')process.stdout.write(firstSaleReplayHash());
else{
 const request=async(path,data)=>{const response=await fetch('http://127.0.0.1:4294'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5294',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(15000)});const result=await response.json();if(response.status!==200||result?.success!==true)throw Error('HTTP_REJECTED');return result.data;};
 try{
  const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>46)throw Error('INPUT_REJECTED');chunks.push(chunk);}secret=Buffer.concat(chunks);for(const chunk of chunks)chunk.fill(0);if(secret.length!==46)throw Error('INPUT_REJECTED');
  const session=await request('/api/auth/login',{username:'erp_deneme',password:secret.toString('ascii')});secret.fill(0);secret=null;
  if(String(session.user?.id)!=='30002'||typeof session.accessToken!=='string')throw Error('ACTOR_REJECTED');token=session.accessToken;
  for(let attempt=0;attempt<2;attempt++){const result=await request('/api/desktop-sale/workflows/5/dispatch',body);if(result.state!=='COMMITTED'||result.requestId!==body.requestId||result.invoiceId!=='5'||result.workflowState!=='COMPLETED'||result.replayed!==true)throw Error('REPLAY_REJECTED');}
  await request('/api/auth/logout',{});token=null;process.stdout.write('FIRST_SALE_EXACT_HTTP_REPLAY_TWICE_VERIFIED');
 }catch{process.stderr.write('FIRST_SALE_HTTP_REPLAY_FAILED');process.exitCode=1;}
 finally{secret?.fill(0);token=null;}
}
