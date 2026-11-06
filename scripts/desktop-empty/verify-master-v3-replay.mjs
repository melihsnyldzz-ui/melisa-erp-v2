// Exact already-committed synthetic requests only. No new UUIDs or bodies.
import {createLocalMasterTransactions} from '../../apps/api/src/services/localMasterTransactions.mjs';
const cases=[
 {method:'createSupplier',path:'suppliers',id:'1',body:{requestId:'28f46f62-003b-430b-a50d-61149704bdaa',supplierCode:'ERP-V3-S1',name:'ERP V3 DENEME TEDARİKÇİ',phone:'0000000000',city:'Bursa',country:'Türkiye',currency:'TRY',purchaseDiscountRateExact4:'0.0000'}},
 {method:'createProduct',path:'products',id:'3',body:{requestId:'ca4cda6b-0cb8-47d4-8840-8dea950c62d7',stockCode:'ERP-V3-P3',name:'ERP V3 DENEME ÜRÜN 3',barcode:'ERPTESTV3P3',unit:'ADET',currency:'TRY',salePriceExact4:'12.0000',purchasePriceExact4:'8.0000',purchaseDiscountRateExact4:'10.0000',saleTier:null,brand:'MELISA TEST',category:'DENEME TÜRÜ',supplierId:'1',openingQuantityExact3:'3.000',openingDate:'2026-11-06'}},
 {method:'createCustomer',path:'customers',id:'3',body:{requestId:'e33c4d09-80ce-4230-8ebc-44d7551e2957',customerCode:'ERP-V3-C1',name:'ERP V3 DENEME MÜŞTERİ',phone:'0000000000',customerType:'customer',currency:'TRY',city:'Bursa',country:'Türkiye'}},
];
let secret,token;const chunks=[];
for(const name of ['log','info','warn','error','debug'])console[name]=()=>{};
try{
 if(process.argv.length===3&&process.argv[2]==='--hashes'){
  const hashes=[];for(const c of cases){let entry;const model=createLocalMasterTransactions({richCards:true,authorize:async()=>true,store:{withTransaction:async work=>work({lockAndVerifyAuthority:async()=>true,beginRequest:async v=>{entry={requestId:v.requestId,hash:v.payloadHash};return {state:'CONFLICT'};}})}});await model[c.method]('30002',c.body);if(!entry)throw Error();hashes.push(entry);}process.stdout.write(JSON.stringify(hashes));
 }else{
  if(process.argv.length!==2)throw Error();let size=0;for await(const b of process.stdin){size+=b.length;if(size>46)throw Error();chunks.push(b);}secret=Buffer.concat(chunks);for(const b of chunks)b.fill(0);if(secret.length!==46||!/^A9![A-Za-z0-9_-]{43}$/.test(secret.toString('ascii')))throw Error();
  const post=async(path,body)=>{const r=await fetch('http://127.0.0.1:4294'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5294',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});const x=await r.json();if(r.status!==200||x?.success!==true)throw Error();return x.data;};
  const session=await post('/api/auth/login',{username:'erp_deneme',password:secret.toString('ascii')});secret.fill(0);secret=null;if(String(session.user?.id)!=='30002'||typeof session.accessToken!=='string')throw Error();token=session.accessToken;
  for(const c of cases)for(let repeat=0;repeat<2;repeat++){const x=await post('/api/desktop-local/'+c.path,c.body);if(x.state!=='COMMITTED'||x.replayed!==true||x.requestId!==c.body.requestId||x.entity?.id!==c.id)throw Error();}
  await post('/api/auth/logout',{});token=null;process.stdout.write('MASTER_V3_THREE_CARDS_REPLAYED_TWICE');
 }
}catch{process.stderr.write('MASTER_V3_REPLAY_FAILED');process.exitCode=1;}
finally{secret?.fill(0);for(const b of chunks)b.fill(0);token=null;}
