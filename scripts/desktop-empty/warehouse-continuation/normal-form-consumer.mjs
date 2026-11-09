// Reviewed root-only normal-form consumer. Import/definition performs no I/O or secret use.
import {NORMAL_FORM_PUBLIC_BASE,NORMAL_FORM_SOURCE_BASE,NORMAL_FORM_BROKER,NORMAL_FORM_BROKER_SHA256,NORMAL_FORM_HOST,NORMAL_FORM_HOST_SHA256,NORMAL_FORM_KINDS,normalFormDigest,assertWarehouseNormalFormEvidence} from './normal-form-contract.mjs';
export async function normalWarehouseFormLogin(context){
 const {fs,crypto,childProcess,tab,expectedBindingsSha256,expectedConsumerFileSha256,expectedTabId}=context??{};
 const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
 const fail=()=>{throw Error('WAREHOUSE_NORMAL_FORM_NOT_VERIFIED');};
 let clear=null,passwordText=null,passwordTouched=false,binding=null;
 try{
  if(!normalFormDigest(expectedBindingsSha256)||!normalFormDigest(expectedConsumerFileSha256)||typeof expectedTabId!=='string'||tab?.id!==expectedTabId)fail();
  const readPublic=(file)=>{const bytes=fs.readFileSync(file);if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>1024*1024)fail();return bytes;};
  const loadEvidence=()=>{
   const bytes=readPublic(NORMAL_FORM_PUBLIC_BASE+'/normal-form-live-bindings.json');if(sha(bytes)!==expectedBindingsSha256)fail();const b=JSON.parse(bytes.toString('utf8'));
   if(b.tabId!==expectedTabId||b.consumerFunctionSha256!==sha(normalWarehouseFormLogin.toString())||b.moduleSha256?.['normal-form-consumer.mjs']!==expectedConsumerFileSha256)fail();
   for(const name of ['normal-form-contract.mjs','normal-form-consumer.mjs','normal-form-bindings.mjs'])if(!normalFormDigest(b.moduleSha256?.[name])||sha(readPublic(NORMAL_FORM_SOURCE_BASE+'/'+name))!==b.moduleSha256[name])fail();
   const p={},s={};for(const kind of NORMAL_FORM_KINDS){const ref=b.proofs?.[kind];if(ref?.fileName!=='normal-form-'+kind+'.json'||!normalFormDigest(ref.sha256))fail();const pb=readPublic(NORMAL_FORM_PUBLIC_BASE+'/'+ref.fileName);if(sha(pb)!==ref.sha256)fail();p[kind]=JSON.parse(pb.toString('utf8'));if(p[kind].actualSourceFile!=='normal-form-source-'+kind+'.json'||!normalFormDigest(p[kind].actualSourceSha256))fail();const sb=readPublic(NORMAL_FORM_PUBLIC_BASE+'/'+p[kind].actualSourceFile);if(sha(sb)!==p[kind].actualSourceSha256)fail();s[kind]=JSON.parse(sb.toString('utf8'));}
   assertWarehouseNormalFormEvidence(b,p,s,Date.now());binding=b;return b;
  };
  const origin=async()=>{loadEvidence();if(tab.id!==expectedTabId)fail();const currentUrl=await tab.url();if(tab.id!==expectedTabId||currentUrl!=='http://127.0.0.1:5294/')fail();loadEvidence();};
  const check=async fn=>{await origin();const value=await fn();await origin();return value;};
  const formReady=async()=>{
   if(!await check(()=>tab.playwright.getByRole('heading',{name:'Giri\u015f yap',exact:true}).isVisible())||!await check(()=>tab.playwright.getByRole('textbox',{name:'Kullan\u0131c\u0131 ad\u0131',exact:true}).isVisible())||!await check(()=>tab.playwright.getByLabel('Parola',{exact:true}).isVisible())||await check(()=>tab.playwright.getByLabel('Parola',{exact:true}).getAttribute('type'))!=='password'||!await check(()=>tab.playwright.getByRole('button',{name:'Giri\u015f yap',exact:true}).isVisible()))fail();
   if(await check(()=>tab.playwright.getByLabel('Parola',{exact:true}).getAttribute('type'))!=='password')fail();await origin();
  };
  loadEvidence();await formReady();
  if(sha(readPublic(NORMAL_FORM_BROKER))!==NORMAL_FORM_BROKER_SHA256||sha(fs.readFileSync(NORMAL_FORM_HOST))!==NORMAL_FORM_HOST_SHA256)fail();
  await formReady();
  // Only the original dedicated warehouse broker, private pipes and normal masked form.
  loadEvidence();const remainingMs=binding.expiresAtMs-Date.now();if(remainingMs<=0)fail();
  fs.writeFileSync(NORMAL_FORM_PUBLIC_BASE+'/normal-form-login-'+expectedBindingsSha256+'.attempt.json',JSON.stringify({state:'WAREHOUSE_NORMAL_FORM_BROKER_PULL_ATTEMPTED',bindingSha256:expectedBindingsSha256,tabId:expectedTabId}),{flag:'wx',encoding:'utf8'});
  loadEvidence();if(binding.expiresAtMs<=Date.now())fail();
  try{clear=childProcess.execFileSync(NORMAL_FORM_HOST,['-NoProfile','-NonInteractive','-File',NORMAL_FORM_BROKER,'-Mode','Pipe'],{stdio:['pipe','pipe','pipe'],windowsHide:true,timeout:Math.min(15000,remainingMs),maxBuffer:46});}
  catch(error){if(Buffer.isBuffer(error?.stdout))error.stdout.fill(0);if(Buffer.isBuffer(error?.stderr))error.stderr.fill(0);fail();}
  if(!Buffer.isBuffer(clear)||clear.length!==46)fail();passwordText=clear.toString('ascii');if(!/^A9![A-Za-z0-9_-]{43}$/.test(passwordText)||!clear.equals(Buffer.from(passwordText,'ascii')))fail();
  await formReady();await tab.playwright.getByRole('textbox',{name:'Kullan\u0131c\u0131 ad\u0131',exact:true}).fill('erp_depo_deneme');await formReady();
  passwordTouched=true;await tab.playwright.getByLabel('Parola',{exact:true}).fill(passwordText);passwordText=null;clear.fill(0);await formReady();
  await tab.playwright.getByRole('button',{name:'Giri\u015f yap',exact:true}).click();
  return {normalLoginSubmitted:true,authenticatedSessionVerified:false,expectedUserId:'30007',username:'erp_depo_deneme',secretPrinted:false};
 }catch{
  if(passwordTouched){try{if(tab.id===expectedTabId&&await tab.url()==='http://127.0.0.1:5294/'&&tab.id===expectedTabId&&await tab.playwright.getByLabel('Parola',{exact:true}).getAttribute('type')==='password'&&await tab.url()==='http://127.0.0.1:5294/'&&tab.id===expectedTabId)await tab.playwright.getByLabel('Parola',{exact:true}).fill('');}catch{}}
  throw Error('WAREHOUSE_NORMAL_FORM_NOT_VERIFIED');
 }finally{passwordText=null;if(Buffer.isBuffer(clear))clear.fill(0);clear=null;}
}
