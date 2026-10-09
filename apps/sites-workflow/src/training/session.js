// This entry never reads VITE_API_BASE_URL or the ordinary ERP authentication.
export function createTrainingSession({fetcher=globalThis.fetch,location=globalThis.location,onWrite=()=>{}}={}) {
  let bootstrap=null;
  function endpoint(path) {
    if(typeof path!=='string'||!path.startsWith('/api/')||path.startsWith('//'))throw new Error('Eğitim dışı bağlantı kapalı.');
    const url=new URL(path,location.origin);
    if(url.origin!==location.origin||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Eğitim yalnız bağımsız yerel ortamda açılır.');
    return url;
  }
  async function request(path,options={}) {
    const method=options.method??'GET',writing=method!=='GET';
    if(writing&&!bootstrap)throw new Error('Eğitim oturumu doğrulanamadı.');
    const body=writing?{...options.body,requestId:options.body?.requestId??crypto.randomUUID()}:undefined;
    const response=await fetcher(endpoint(path),{method,credentials:'same-origin',redirect:'error',signal:options.signal,headers:{Accept:'application/json',...(bootstrap?{'X-Training-Exercise':bootstrap.exerciseId}:{}),...(writing?{'Content-Type':'application/json','X-Training-CSRF':bootstrap.csrfToken}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json();
    if(!response.ok||value?.success===false){const error=new Error(value?.error?.message??value?.message??'İşlem tamamlanamadı. Tekrar deneyin.');error.status=response.status;throw error;}
    if(writing&&!path.startsWith('/api/training/'))onWrite(path,value);
    return value;
  }
  const unwrap=value=>value?.success===true&&value.data!==undefined?value.data:value;
  return {
    async bootstrap(){const value=unwrap(await request('/api/training/session'));if(value?.trainingDatabase!==true||typeof value.csrfToken!=='string'||!value.exerciseId||!value.user)throw new Error('Bağımsız eğitim veritabanı doğrulanamadı.');bootstrap=value;return value;},
    async state(){return unwrap(await request('/api/training/state'));},
    async progress(body){return unwrap(await request('/api/training/progress',{method:'POST',body}));},
    async repeat(){return unwrap(await request('/api/training/repeat',{method:'POST',body:{}}));},
    inbound:request,
    api:request,
    suppliers:async(path,options)=>{const value=await request(path,options);return options?.envelope?value:unwrap(value);},
    supplierPayments:request,
    async media(path,{signal}={}){const response=await fetcher(endpoint(path),{signal,credentials:'same-origin',redirect:'error',headers:bootstrap?{'X-Training-Exercise':bootstrap.exerciseId}:{}});if(!response.ok)throw new Error('Ürün fotoğrafı açılamadı.');return response.blob();}
  };
}
