import test from 'node:test';
import assert from 'node:assert/strict';
import {errorHandler} from './errorHandler.js';
import {logger} from '../utils/logger.js';
test('only normalized CRM 429 forwards bounded numeric retry metadata',()=>{
 const log=logger.error;logger.error=()=>{};
 try{for(const [code,statusCode,retry,expected] of [['CRM_V2_CRM_RATE_LIMITED',429,17,17],['CRM_V2_CRM_RATE_LIMITED',429,900,900],['CRM_V2_CRM_RATE_LIMITED',429,901,undefined],['CRM_V2_CRM_RATE_LIMITED',429,'17',undefined],['CRM_V2_ACCESS_DENIED',403,17,undefined],['OTHER',429,17,undefined]]){
  const headers={};let payload,status;
  const res={headersSent:false,setHeader:(k,v)=>headers[k]=v,status(n){status=n;return this;},json(v){payload=v;return v;}};
  errorHandler(Object.assign(new Error(code),{code,statusCode,retryAfterSeconds:retry}),{requestId:'fixture',method:'GET',originalUrl:'/fixture'},res,()=>assert.fail('unexpected next'));
  assert.equal(status,statusCode);assert.equal(payload.error.code,code);assert.equal(payload.meta.retryAfterSeconds,expected);assert.equal(headers['Retry-After'],expected===undefined?undefined:String(expected));
 }}finally{logger.error=log;}
});
