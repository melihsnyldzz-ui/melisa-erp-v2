import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Emulator-only UI rehearsal. Explicit synthetic records, no database or upstream client.
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'temp/emulator');
fs.mkdirSync(output, {recursive:true});
const user = {id:9001, username:'fixture', displayName:'TEST EMULATOR', fullName:'TEST EMULATOR', employeeName:'TEST EMULATOR', role:'admin', permissions:['terminal.sync.run','terminal.sales.create','sales.view','customer.view','product.view']};
const products = [
  {id:1001, stockCode:'TEST-001', barcode:'8690000000001', barcodeMasked:'8690000000001', matchedBarcode:'8690000000001', productName:'TEST URUN - MAVİ TULUM', brand:'SENTETIK TEST', category:'TEST', currency:'TRY', salePrice:125, stockQuantity:20, source:'fixture', sourceId:1001, saleWritable:true, isPassive:false, imageUrl:null},
  {id:1002, stockCode:'TEST-002', barcode:'8690000000002', barcodeMasked:'8690000000002', matchedBarcode:'8690000000002', productName:'TEST URUN - PEMBE TAKIM', brand:'SENTETIK TEST', category:'TEST', currency:'TRY', salePrice:150, stockQuantity:8, source:'fixture', sourceId:1002, saleWritable:true, isPassive:false, imageUrl:null},
];
const customers = [{id:7001, customerCode:'TEST-CARI', customerName:'TEST EMULATOR CARISI', name:'TEST EMULATOR CARISI', city:'TEST', currency:'TRY', balance:0, discountRate:0, source:'fixture', saleWritable:true, isPassive:false}];
const list = data => ({success:true,data,meta:{source:'SYNTHETIC_UI_FIXTURE',page:1,totalPages:1,total:data.length,limit:100}});
const ok = data => ({success:true,data,meta:{source:'SYNTHETIC_UI_FIXTURE'}});
let offline = false;
const unverifiedSubmit = process.argv.includes('--unverified-submit');
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://127.0.0.1:4719');
  fs.appendFileSync(path.join(output,'requests.jsonl'),JSON.stringify({at:new Date().toISOString(),method:req.method,path:url.pathname,query:Object.fromEntries(url.searchParams)})+'\n');
  const reply = (status,body) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method==='POST' && url.pathname==='/__test/offline') {offline=url.searchParams.get('enabled')==='true';return reply(200,{offline});}
  if(offline) return reply(503,{success:false,error:{code:'FIXTURE_OFFLINE',message:'TEST API offline'}});
  if(req.method==='GET' && url.pathname==='/api/health') return reply(200,ok({status:'ok',fixture:true}));
  if(req.method==='GET' && url.pathname==='/api/auth/terminal-users') return reply(200,ok({device:{terminalCode:'TERM-V2-001',deviceName:'TEST EMULATOR',active:true},users:[user]}));
  if(req.method==='POST' && ['/api/auth/terminal-login','/api/auth/refresh'].includes(url.pathname)) {
    let body='';for await(const chunk of req) {body+=chunk;if(body.length>4096) return reply(413,{success:false});}
    let credentials;try {credentials=JSON.parse(body);}catch{return reply(400,{success:false});}
    if(url.pathname.endsWith('terminal-login') && (credentials.username!=='fixture' || credentials.password!=='test-only')) return reply(401,{success:false,error:{code:'AUTH_INVALID_CREDENTIALS',message:'TEST sifresi yanlis'}});
    return reply(200,ok({accessToken:'fixture-session-not-a-real-token',refreshToken:'fixture-refresh-not-a-real-token',user}));
  }
  if(req.method==='POST' && url.pathname==='/api/auth/logout') return reply(200,ok({loggedOut:true}));
  // Error-only rehearsal: no invoice, stock movement, database or upstream call.
  if(unverifiedSubmit && req.method==='POST' && url.pathname==='/api/terminal/sales/submit') {
    return reply(503,{success:false,error:{code:'TERMINAL_SALE_OUTCOME_UNVERIFIED',message:'TEST sonucu belirsiz; ERP kaydini kontrol edin'}});
  }
  if(req.method==='GET' && url.pathname==='/api/terminal/products/search') {
    const q=(url.searchParams.get('q')||'').toLocaleLowerCase('tr-TR');
    return reply(200,list(products.filter(p=>`${p.stockCode} ${p.productName} ${p.barcode}`.toLocaleLowerCase('tr-TR').includes(q))));
  }
  if(req.method==='GET' && url.pathname.startsWith('/api/terminal/products/barcode/')) {
    const product=products.find(p=>p.barcode===decodeURIComponent(url.pathname.split('/').at(-1)));
    return reply(product?200:404,product?ok(product):{success:false,error:{code:'BARCODE_NOT_FOUND',message:'TEST barkodu bulunamadi'}});
  }
  if(req.method==='GET' && url.pathname==='/api/terminal/customers/search') return reply(200,list(customers));
  if(req.method==='GET' && url.pathname==='/api/currency-rates') return reply(200,ok({date:new Date().toISOString().slice(0,10),source:'SYNTHETIC_UI_FIXTURE',rates:[{currency:'TRY',rateToTry:1,defined:true},{currency:'USD',rateToTry:null,defined:false},{currency:'EUR',rateToTry:null,defined:false}]}));
  if(req.method==='GET' && /^\/api\/products\/\d+$/.test(url.pathname)) {
    const product=products.find(p=>String(p.id)===url.pathname.split('/').at(-1));
    return reply(product?200:404,product?ok(product):{success:false});
  }
  return reply(403,{success:false,error:{code:'FIXTURE_ROUTE_NOT_ALLOWED',message:'Bu islem emulator UI provasi kapsaminda degil'}});
});
server.listen(4719,'127.0.0.1',()=>console.log('SYNTHETIC_UI_FIXTURE http://127.0.0.1:4719; no business database/upstream'));
