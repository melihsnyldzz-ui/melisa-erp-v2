const prefix='/api/cloud-test';
const invalid=()=>Error('Sentetik TEST yanıtı doğrulanamadı.');
export function validateCloudSession(value){
  if(value?.synthetic!==true||typeof value.csrfToken!=='string'||!value.csrfToken||value.user!==null&&
    (!value.user||value.user.synthetic!==true||![15,16,17,18].includes(Number(value.user.id))||!Array.isArray(value.user.permissions)||typeof value.accessToken!=='string'||!value.accessToken))throw invalid();
  return value;
}
export function createCloudSession(fetcher=globalThis.fetch){
  async function request(path,{method='GET',body,csrfToken,accessToken}={}){
    if(!path.startsWith('/')||path.startsWith('//')||path.includes('..'))throw invalid();
    const response=await fetcher(prefix+path,{method,cache:'no-store',credentials:'same-origin',redirect:'error',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(csrfToken?{'X-Cloud-CSRF':csrfToken}:{}),...(accessToken?{Authorization:'Bearer '+accessToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    let payload;try{payload=await response.json();}catch{throw Object.assign(invalid(),{status:response.status});}
    if(!response.ok||payload?.success!==true)throw Object.assign(Error(payload?.error?.message||'Sentetik işlem reddedildi.'),{status:response.status,code:payload?.error?.code||''});
    if(!Object.hasOwn(payload,'data'))throw invalid();return payload.data;
  }
  const inspect=async()=>validateCloudSession(await request('/session'));
  async function select(actorId){if(![15,16,17,18].includes(Number(actorId)))throw invalid();const value=await inspect();return validateCloudSession(await request('/session',{method:'POST',body:{actorId:Number(actorId)},csrfToken:value.csrfToken}));}
  function bind(selected){
    validateCloudSession(selected);if(!selected.user)throw invalid();
    async function work(path,options={}){
      if(!/^\/api\/(?:work-(?:receiving|sales|collections)(?:[/?]|$)|cloud-test\/)/.test(path))throw invalid();
      const current=await inspect();
      if(current.accessToken!==selected.accessToken||current.user?.id!==selected.user.id)throw Object.assign(Error('Sentetik oturum değişti. Ekranı yeniden açın.'),{status:401});
      const route=path.startsWith(prefix)?path.slice(prefix.length):path.slice('/api'.length);
      const value=await request(route,{...options,csrfToken:current.csrfToken,accessToken:current.accessToken});
      if(/^\/erp\/orders\/[1-9]\d*\/sale$/.test(route))return {invoice:value,requestId:options.body.requestId,replayed:false};
      return value;
    }
    return {work,inbound:work,
      supplierPayments:async()=>{throw Object.assign(Error('Sentetik tedarikçi ödeme hareketleri bağlı değil.'),{status:501});},
      // Source catalog/media services are deliberately unavailable in this
      // synthetic entry. Real scoped products remain in controller contexts.
      api:async()=>{throw Object.assign(Error('Sentetik katalog dışı kaynak bağlı değil.'),{status:404});},
      media:async()=>{throw Object.assign(Error('Sentetik ürün fotoğrafı bağlı değil.'),{status:404});},
    };
  }
  return {inspect,select,bind};
}
