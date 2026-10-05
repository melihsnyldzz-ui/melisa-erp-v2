import {createVegaProductClient} from './vegaProductClient.js';
// A page that uses the ERP catalog must not initialize an unrelated legacy connection.
export function createLazyVegaClient(options,{create=createVegaProductClient}={}){
 let client;
 const call=(method,args)=>{client??=create(options);return client[method](...args);};
 return Object.fromEntries(['get','login','logout','hasSession'].map(method=>[method,(...args)=>call(method,args)]));
}
