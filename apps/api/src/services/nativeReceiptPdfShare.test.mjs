import test,{mock,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {request as httpRequest} from 'node:http';

const forbidden=()=>{throw Error('Unexpected live database, print or write boundary');};
mock.module('./nativeTerminalSale.mjs',{namedExports:{nativeOwnedInvoice:forbidden}});
mock.module('./invoiceDraftService.js',{namedExports:{getSalesDraft:forbidden}});
mock.module('./authService.js',{namedExports:{getUserById:forbidden}});
const {createNativeReceiptPdfShare}=await import('./nativeReceiptPdfShare.mjs');
const {createNativeReceiptPdfRoutes}=await import('../routes/nativeReceiptPdfRoutes.mjs');
let instant,sequence,actor,invoice,calls,rendered,share,options;
const tokenFrom=result=>new URL(result.url).pathname.split('/').at(-1).slice(0,-4);
const linkError={code:'NATIVE_PDF_LINK_UNAVAILABLE',statusCode:404};
beforeEach(()=>{
 instant=Date.parse('2026-09-15T12:00:00Z');sequence=0;calls=[];rendered=[];
 actor={id:8,permissions:['terminal.sales.create']};
 invoice={id:3,documentNo:'SAT-3',status:'FINALIZED',grandTotal:12,customerName:'Test customer'};
 options={baseUrl:'http://192.168.1.46:4116',now:()=>instant,
  randomToken:()=>Buffer.alloc(32,++sequence).toString('base64url'),
  ownedInvoice:async(...args)=>{calls.push(['owned',...args]);},
  readInvoice:async id=>{calls.push(['invoice',id]);return {...invoice};},
  readActor:async id=>{calls.push(['actor',id]);return {...actor};},
  renderPdf:async doc=>{rendered.push(doc);return Buffer.from('%PDF-1.7\nTest fixture');}};
 share=createNativeReceiptPdfShare(options);
});

test('mint grants only an owned finalized native invoice and returns a ten minute opaque URL',async()=>{
 const result=await share.mint('3','TC21-test',actor);
 assert.deepEqual(calls,[['owned',3,'TC21-test',actor],['invoice',3]]);
 assert.equal(result.expiresAt,'2026-09-15T12:10:00.000Z');
 assert.equal(result.documentNumber,'SAT-3');
 assert.match(result.url,/^http:\/\/192\.168\.1\.46:4116\/native-receipts\/[A-Za-z0-9_-]{43}\.pdf$/);
 assert.deepEqual(Object.keys(result).sort(),['documentNumber','expiresAt','url']);
 assert.equal(rendered.length,0);
});

test('missing personnel or sales permission fails before ownership or invoice reads',async()=>{
 for(const user of [null,{}, {id:0},{id:'bad'}])await assert.rejects(share.mint(3,'TC21-test',user),{statusCode:401});
 await assert.rejects(share.mint(3,'TC21-test',{id:8,permissions:[]}),{code:'AUTH_PERMISSION_DENIED'});
 assert.equal(calls.length,0);
});

test('invalid invoice and terminal identifiers cannot reach data reads',async()=>{
 for(const id of [0,-1,'bad',1.1,Number.MAX_SAFE_INTEGER+1])await assert.rejects(share.mint(id,'TC21-test',actor),{statusCode:400});
 for(const code of ['',null,'.. /other','x'.repeat(81),['TC21-test']])await assert.rejects(share.mint(3,code,actor),{statusCode:400});
 assert.equal(calls.length,0);
});

test('ownership, device and actor denial cannot mint a grant',async()=>{
 const denied=createNativeReceiptPdfShare({...options,ownedInvoice:async()=>{throw Object.assign(Error('denied'),{statusCode:403});}});
 await assert.rejects(denied.mint(3,'other-device',actor),{statusCode:403});
 assert.equal(calls.length,0);assert.equal(rendered.length,0);
});

test('draft, cancelled, archived and a mismatched invoice cannot be shared',async()=>{
 for(const status of ['DRAFT','CANCELLED','ARCHIVED_TEST',null]){
  invoice.status=status;await assert.rejects(share.mint(3,'TC21-test',actor),{code:'NATIVE_PDF_RECEIPT_UNAVAILABLE'});
 }
 invoice.status='FINALIZED';invoice.id=4;
 await assert.rejects(share.mint(3,'TC21-test',actor),{code:'NATIVE_PDF_RECEIPT_UNAVAILABLE'});
 assert.equal(rendered.length,0);
});

test('download rechecks current user and exactly the stored invoice, personnel and terminal',async()=>{
 const grant=await share.mint(3,'TC21-test',actor),token=tokenFrom(grant);
 calls=[];
 const pdf=await share.download(token);
 assert.deepEqual(calls,[['actor',8],['owned',3,'TC21-test',actor],['invoice',3]]);
 assert.deepEqual(pdf.bytes,Buffer.from('%PDF-1.7\nTest fixture'));
 assert.equal(pdf.documentNumber,'SAT-3');
 assert.equal(rendered.length,1);
 await share.download(token);
 assert.equal(rendered.length,2,'opening and saving the PDF can reuse the short-lived grant');
});

test('unknown, malformed and tampered tokens disclose no invoice and perform no reads',async()=>{
 const grant=await share.mint(3,'TC21-test',actor),token=tokenFrom(grant);calls=[];
 for(const invalid of [null,'',token.slice(1),token+'x','../'+token,'Z'+token.slice(1),Buffer.alloc(32,99).toString('base64url')])
  await assert.rejects(share.download(invalid),linkError);
 assert.equal(calls.length,0);assert.equal(rendered.length,0);
});

test('expiry is enforced at the exact deadline and after rendering',async()=>{
 const grant=await share.mint(3,'TC21-test',actor);instant+=600000;
 await assert.rejects(share.download(tokenFrom(grant)),linkError);
 const expiring=createNativeReceiptPdfShare({...options,renderPdf:async()=>{instant+=600000;return Buffer.from('%PDF-test');}});
 const second=await expiring.mint(3,'TC21-test',actor);
 await assert.rejects(expiring.download(tokenFrom(second)),linkError);
});

test('cancellation and ownership revocation invalidate an existing grant without rendering',async()=>{
 const grant=await share.mint(3,'TC21-test',actor);invoice.status='CANCELLED';
 await assert.rejects(share.download(tokenFrom(grant)),linkError);
 invoice.status='FINALIZED';
 await assert.rejects(share.download(tokenFrom(grant)),linkError);
 const revoked=createNativeReceiptPdfShare({...options,ownedInvoice:async()=>{
  if(calls.length)throw Object.assign(Error('other owner'),{statusCode:403});calls.push('mint');}});
 calls=[];const second=await revoked.mint(3,'TC21-test',actor);
 await assert.rejects(revoked.download(tokenFrom(second)),linkError);
 assert.equal(rendered.length,0);
});

test('inactive user, permission loss or an inconsistent user lookup fail closed',async()=>{
 for(const mutate of [()=>{actor.permissions=[];},()=>{actor.id=9;}]){
  actor={id:8,permissions:['terminal.sales.create']};const grant=await share.mint(3,'TC21-test',actor);mutate();
  await assert.rejects(share.download(tokenFrom(grant)),linkError);
 }
 actor={id:8,permissions:['terminal.sales.create']};
 const inactive=createNativeReceiptPdfShare({...options,readActor:async()=>{throw Object.assign(Error('inactive'),{statusCode:401});}});
 const grant=await inactive.mint(3,'TC21-test',actor);
 await assert.rejects(inactive.download(tokenFrom(grant)),linkError);
 assert.equal(rendered.length,0);
});

test('grants have bounded capacity, prune expired entries and never overwrite on token collision',async()=>{
 const bounded=createNativeReceiptPdfShare({...options,maxGrants:2});
 const first=await bounded.mint(3,'TC21-test',actor);
 const second=await bounded.mint(3,'TC21-test',actor);
 const third=await bounded.mint(3,'TC21-test',actor);
 await assert.rejects(bounded.download(tokenFrom(first)),linkError);
 await bounded.download(tokenFrom(second));await bounded.download(tokenFrom(third));
 instant+=600000;
 const next=await bounded.mint(3,'TC21-test',actor);
 await assert.rejects(bounded.download(tokenFrom(third)),linkError);
 await bounded.download(tokenFrom(next));
 const colliding=createNativeReceiptPdfShare({...options,randomToken:()=>Buffer.alloc(32,1).toString('base64url')});
 const original=await colliding.mint(3,'TC21-test',actor);
 await assert.rejects(colliding.mint(3,'TC21-test',actor),{code:'NATIVE_PDF_LINK_FAILED'});
 await colliding.download(tokenFrom(original));
});

test('trusted origin is mandatory and cannot contain credentials, a path, query or fragment',()=>{
 for(const baseUrl of [undefined,'javascript:alert(1)','http://user:password@example.com','http://example.com/path','http://example.com/?next=other','http://example.com/#other'])
  assert.throws(()=>createNativeReceiptPdfShare({...options,baseUrl}));
 for(const limits of [{ttlMs:600001},{maxGrants:501},{maxGrants:0},{ttlMs:0}])
  assert.throws(()=>createNativeReceiptPdfShare({...options,...limits}));
});

test('render failures do not produce a fake PDF or destroy a valid grant',async()=>{
 let fail=true;
 const retryable=createNativeReceiptPdfShare({...options,renderPdf:async()=>fail?Buffer.from('<html>error</html>'):Buffer.from('%PDF-recovered')});
 const grant=await retryable.mint(3,'TC21-test',actor);
 await assert.rejects(retryable.download(tokenFrom(grant)),{code:'NATIVE_PDF_RENDER_FAILED'});
 fail=false;assert.equal((await retryable.download(tokenFrom(grant))).bytes.toString(),'%PDF-recovered');
});

async function serve(t,service,options,onUnscopedError=()=>{}){
 const app=express();app.disable('x-powered-by');app.use('/native-receipts',createNativeReceiptPdfRoutes(service,options));
 // Match native startup: capability route must terminate before JSON parsing
 // and before the generic ERP logger, which records originalUrl.
 app.use(express.json());
 app.use((error,req,res,_next)=>{onUnscopedError(error,req);res.status(500).json({error:'generic-error-handler'});});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return `http://127.0.0.1:${server.address().port}`;
}

test('public download streams only the scoped PDF, with safe filename and noncacheable headers',async t=>{
 const token=Buffer.alloc(32,1).toString('base64url'),seen=[];
 const base=await serve(t,{download:async value=>{seen.push(value);return {bytes:Buffer.from('%PDF-test'),documentNumber:'SAT/3\r\nInjected: value'};}});
 const response=await fetch(`${base}/native-receipts/${token}.pdf?invoiceId=999&terminalCode=other`,{headers:{Host:'untrusted.invalid'}});
 assert.equal(response.status,200);assert.equal(await response.text(),'%PDF-test');
 assert.equal(response.headers.get('content-type'),'application/pdf');
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.match(response.headers.get('content-disposition'),/^inline; filename="Melisa-Fis-SAT_3__Injected__value.pdf"$/);
 assert.deepEqual(seen,[token]);assert.equal(response.headers.get('injected'),null);
});

test('public errors reveal no database/owner details and retain security headers',async t=>{
 let missing=true;
 const base=await serve(t,{download:async()=>{throw missing?Object.assign(Error('Link expired'),linkError):Error('private SQL connection value');}});
 let response=await fetch(`${base}/native-receipts/invalid.pdf`);
 assert.equal(response.status,404);assert.equal((await response.json()).error.code,linkError.code);
 assert.match(response.headers.get('cache-control'),/no-store/);
 missing=false;response=await fetch(`${base}/native-receipts/invalid.pdf`);
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private SQL'));
});

test('public downloads are rate limited independently of ERP authentication',async t=>{
 let downloads=0;
 const base=await serve(t,{download:async()=>{downloads++;return {bytes:Buffer.from('%PDF-test'),documentNumber:'3'};}},{limit:2});
 for(let i=0;i<2;i++)assert.equal((await fetch(`${base}/native-receipts/test.pdf`)).status,200);
 const rejected=await fetch(`${base}/native-receipts/test.pdf`);
 assert.equal(rejected.status,429);assert.equal(downloads,2);
 assert.equal((await rejected.json()).error.code,'NATIVE_PDF_RATE_LIMITED');
 assert.match(rejected.headers.get('cache-control'),/no-store/);
});


function getWithJsonBody(url,body){
 return new Promise((resolve,reject)=>{
  const request=httpRequest(url,{method:'GET',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{
   const chunks=[];
   response.on('data',chunk=>chunks.push(chunk));
   response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString()}));
  });
  request.on('error',reject);request.end(body);
 });
}

test('PDF GET does not parse JSON and capability paths never reach the generic error logger',async t=>{
 const token=Buffer.alloc(32,1).toString('base64url');let logged=0,downloads=0;
 const base=await serve(t,{download:async value=>{
  assert.equal(value,token);downloads++;return {bytes:Buffer.from('%PDF-safe'),documentNumber:'3'};
 }},undefined,()=>{logged++;});
 const malformedBody=await getWithJsonBody(`${base}/native-receipts/${token}.pdf`,'{"broken":');
 assert.equal(malformedBody.status,200);assert.equal(malformedBody.body,'%PDF-safe');
 assert.equal(malformedBody.headers['content-type'],'application/pdf');
 const unmatched=await fetch(`${base}/native-receipts/${token}.pdf/extra`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"broken":'});
 assert.equal(unmatched.status,404);
 assert.equal((await unmatched.json()).error.code,'NATIVE_PDF_LINK_UNAVAILABLE');
 assert.equal(logged,0);assert.equal(downloads,1);
});

test('malformed URL encoding stays in the PDF error boundary without reflecting or logging its token',async t=>{
 const token=Buffer.alloc(32,1).toString('base64url');let logged=0,downloads=0;
 const base=await serve(t,{download:async()=>{downloads++;throw Error('must not run');}},undefined,()=>{logged++;});
 const malformed=await fetch(`${base}/native-receipts/${token}%ZZ.pdf`);
 assert.equal(malformed.status,400);
 const body=await malformed.text();
 assert.equal(JSON.parse(body).error.code,'NATIVE_PDF_REQUEST_INVALID');
 assert.ok(!body.includes(token));assert.ok(!body.includes('%ZZ'));
 assert.match(malformed.headers.get('cache-control'),/no-store/);
 assert.equal(logged,0);assert.equal(downloads,0);
});
