// Source-only. Supply an authenticated submit function, origin-shared durable
// storage and Web Locks. This module does not connect, mount itself or write SQL.
import {desktopInitialCostParity,desktopInitialOpeningAmountParity} from '../../../api/src/services/desktopInitialCostParity.mjs';
const env='eb2888c2-51cb-4570-a933-397cf7e62806';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=()=>{throw new Error('PRODUCT_CREATE_INVALID');};
const fields=['stockCode','name','barcode','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','saleTier'];
const openingFields=['openingQuantityExact3','openingDate'];
const richFields=['brand','category','supplierId'];
const withRich=value=>richFields.some(k=>Object.hasOwn(value??{},k));
const withOpening=value=>openingFields.some(k=>Object.hasOwn(value??{},k));
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&
 Reflect.ownKeys(value).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return d&&d.enumerable&&Object.hasOwn(d,'value');});}
function text(v,max){if(typeof v!=='string'||!v||v.trim()!==v||v.length>max||/[\u0000-\u001f\u007f]/.test(v))fail();return v;}
function money(v){if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,13})\.\d{4}$/.test(v))fail();return v;}
function discount(v){if(typeof v!=='string'||!/^(?:0|[1-9]\d{0,2})\.\d{4}$/.test(v)||BigInt(v.replace('.',''))>1000000n)fail();return v;}
function validId(v){return typeof v==='string'&&/^[1-9]\d{0,18}$/.test(v)&&BigInt(v)<=9223372036854775807n;}
export function desktopProductDecimal4(value,{percentage=false}={}){
 if(typeof value!=='string')fail();const v=value.trim();const m=/^(0|[1-9]\d{0,13})(?:[.,](\d{1,4}))?$/.exec(v);if(!m)fail();
 const result=m[1]+'.'+(m[2]||'').padEnd(4,'0');return percentage?discount(result):money(result);
}
export function desktopProductDecimal3(value){if(typeof value!=='string')fail();const match=/^(0|[1-9]\d{0,12})(?:[.,](\d{1,3}))?$/.exec(value.trim());if(!match)fail();return match[1]+'.'+(match[2]??'').padEnd(3,'0');}
function body(input,requestId){
 if(!exact(input,[...fields,...(withOpening(input)?openingFields:[]),...(withRich(input)?richFields:[])])||typeof requestId!=='string'||!uuid.test(requestId)||typeof input.currency!=='string'||!/^[A-Z]{3}$/.test(input.currency))fail();
 if(input.saleTier!==null&&(!Number.isInteger(input.saleTier)||input.saleTier< -2147483648||input.saleTier>2147483647))fail();
 let opening={};if(withOpening(input)){
  if(typeof input.openingQuantityExact3!=='string'||!/^(?:0|[1-9]\d{0,12})\.\d{3}$/.test(input.openingQuantityExact3)||typeof input.openingDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.openingDate))fail();
  const [y,m,d]=input.openingDate.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));if(y<1900||y>9999||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)fail();
  if(input.openingQuantityExact3!=='0.000'&&(input.currency!=='TRY'||input.unit!=='ADET'||desktopInitialCostParity({currency:input.currency,purchasePriceExact4:input.purchasePriceExact4,purchaseDiscountRateExact4:input.purchaseDiscountRateExact4})==='0.0000'))fail();
  if(input.openingQuantityExact3!=='0.000')desktopInitialOpeningAmountParity({quantityExact3:input.openingQuantityExact3,costExact4:desktopInitialCostParity({currency:input.currency,purchasePriceExact4:input.purchasePriceExact4,purchaseDiscountRateExact4:input.purchaseDiscountRateExact4})});
  opening={openingQuantityExact3:input.openingQuantityExact3,openingDate:input.openingDate};
 }
 return Object.freeze({requestId,stockCode:text(input.stockCode,50),name:text(input.name,250),barcode:text(input.barcode,80),unit:text(input.unit,20),
  currency:input.currency,salePriceExact4:money(input.salePriceExact4),purchasePriceExact4:money(input.purchasePriceExact4),
  purchaseDiscountRateExact4:discount(input.purchaseDiscountRateExact4),saleTier:input.saleTier,...opening,...(withRich(input)?{brand:text(input.brand,120),category:text(input.category,120),supplierId:validId(input.supplierId)?input.supplierId:fail()}: {})});
}
function restored(record,actorId){
 if(!exact(record,['version','actorId','body'])||record.version!==1||record.actorId!==actorId||!exact(record.body,['requestId',...fields,...(withOpening(record.body)?openingFields:[]),...(withRich(record.body)?richFields:[])]))fail();
 const {requestId,...values}=record.body;return body(values,requestId);
}
export function isDesktopPersistedProduct(value,input){
 if(!exact(value,['kind','id','name','units','prices'])||value.kind!=='local'||!validId(value.id)||value.name!==input.name||!Array.isArray(value.units)||value.units.length!==1||!Array.isArray(value.prices)||value.prices.length!==1)return false;
 const u=value.units[0],p=value.prices[0];
 return !!(exact(u,['id','label','factorExact8','isMain'])&&validId(u.id)&&u.label===input.unit&&u.factorExact8==='1.00000000'&&u.isMain===true&&
  exact(p,['id','type','unitId','tier','currency','priceExact8'])&&validId(p.id)&&p.type==='sale'&&p.unitId===u.id&&p.tier===input.saleTier&&p.currency===input.currency&&p.priceExact8===input.salePriceExact4+'0000');
}
export function createDesktopProductCreate({actorId,storage,submit,newId,locks,richCards=false}={}){
 if(!validId(actorId)||!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'||typeof submit!=='function'||typeof newId!=='function'||!locks||typeof locks.request!=='function')fail();
 const key=`melisa-desktop-product-create:${env}:${actorId}`;let running=false;
 function read(){const raw=storage.getItem(key);if(raw===null)return null;if(typeof raw!=='string'||raw.length>8192)fail();let record;try{record=JSON.parse(raw);}catch{fail();}return restored(record,actorId);}
 async function send(payload){let result;try{result=await submit({...payload});}catch{return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});}
  if(!result||result.state!=='COMMITTED'||result.requestId!==payload.requestId||result.operation!=='product.create'||!isDesktopPersistedProduct(result.entity,payload))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
  const existing=read();if(!existing||JSON.stringify(existing)!==JSON.stringify(payload))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
  storage.removeItem(key);return Object.freeze({state:'COMMITTED',requestId:payload.requestId,entity:result.entity,replayed:result.replayed===true});}
 async function exclusive(work){if(running)throw new Error('PRODUCT_CREATE_BUSY');running=true;try{return await locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw new Error('PRODUCT_CREATE_BUSY');return work();});}finally{running=false;}}
 return Object.freeze({pending:()=>read(),async create(input){return exclusive(async()=>{if(read())throw new Error('PRODUCT_CREATE_PENDING');if(richCards&&(!withRich(input)||input.currency!=='TRY'))fail();const p=body(input,newId());
   storage.setItem(key,JSON.stringify({version:1,actorId,body:p}));if(JSON.stringify(read())!==JSON.stringify(p))fail();return send(p);});},
  async retry(){return exclusive(async()=>{const p=read();if(!p)throw new Error('PRODUCT_CREATE_NO_PENDING');return send(p);});}});
}
export const DESKTOP_PRODUCT_CREATE_LIMITS=Object.freeze({sourceOnly:true,routeIntegrated:false,writePermissionRequired:'product.edit',
 unsupportedFields:Object.freeze(['brand','category','supplierId']),requiresOriginSharedStorage:true,requiresWebLocks:true,
 storageContainsProductFields:true,requiresPinnedTediousVersion:true,requiresIndependentCostParityReview:true,realSqlVerified:false});

// Prevent a known, deterministic cost restriction before a durable request is
// created. The server remains authoritative for every write and validation.
export function isDesktopProductCostSupported(input){
 if(!input||typeof input!=='object')return false;try{desktopInitialCostParity({currency:input.currency,purchasePriceExact4:input.purchasePriceExact4,purchaseDiscountRateExact4:input.purchaseDiscountRateExact4});return true;}catch{return false;}
}
// The parent screen must check product.edit before mounting.
export function mountDesktopProductCreate({root,controller,onCommitted=()=>{},richCards=false,loadSuppliers}={}){
 if(!root||typeof root.querySelector!=='function'||!controller||typeof controller.pending!=='function'||typeof controller.create!=='function'||typeof controller.retry!=='function'||typeof onCommitted!=='function')fail();
 if(richCards&&typeof loadSuppliers!=='function')fail();let disposed=false,busy=false,supplierPage=1,supplierSearch='',supplierSelected='',supplierLabel='';const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 function paint(message=''){
  if(disposed)return;let pending;try{pending=controller.pending();}catch{root.innerHTML='<p role="alert">Bekleyen işlem okunamadı. Yeni kayıt başlatılmadı.</p>';return;}
  if(pending){root.innerHTML=`<section class="card panel" style="padding:20px"><h2>Ürün kaydı doğrulanıyor</h2><p>${escape(pending.stockCode)} kodlu kaydın sonucu henüz kesin değil. Aynı istekle yeniden doğrulayın.</p><button type="button" data-product-retry ${busy?'disabled':''}>Kaydı doğrula</button><p role="status">${escape(message)}</p></section>`;
   root.querySelector('[data-product-retry]').addEventListener('click',()=>act(()=>controller.retry()));return;}
  root.innerHTML=`<section class="card panel" style="padding:20px"><h2>Yeni ürün kartı</h2>${richCards?'':'<p>Marka, kategori ve tedarikçi alanları bu aşamada kaydedilemiyor.</p>'}<form data-product-form><label>Stok kodu <input name="stockCode" maxlength="50" required></label><label>Ürün adı <input name="name" maxlength="250" required></label>${richCards?'<label>Marka <input name="brand" maxlength="120" required></label><label>Ürün türü <input name="category" maxlength="120" required></label><label>Tedarikçi ara <input data-supplier-search maxlength="100"></label><button type="button" data-supplier-find>Ara</button><button type="button" data-supplier-prev>Önceki</button><span data-supplier-page></span><button type="button" data-supplier-next>Sonraki</button><label>Tedarikçi <select name="supplierId" required><option value="">Liste yükleniyor</option></select></label>':''}<label>Barkod <input name="barcode" maxlength="80" required></label><label>Birim <input name="unit" maxlength="20" value="ADET" required></label><label>Para birimi <select name="currency"><option>TRY</option>${richCards?'':'<option>USD</option><option>EUR</option>'}</select>${richCards?'<small>Bu kurulumda ürün maliyeti TRY ile kaydediliyor.</small>':''}</label><label>Satış fiyatı <input name="sale" inputmode="decimal" required></label><label>Alış fiyatı <input name="purchase" inputmode="decimal" required></label><label>Alış indirimi (%) <input name="discount" inputmode="decimal" value="0" required></label><label>Başlangıç stoğu (TRY / ADET) <input name="openingQuantity" inputmode="decimal" value="0" required></label><label>Başlangıç stok tarihi <input name="openingDate" type="date" value="${today}" required></label><button type="submit" ${busy?'disabled':''}>Kaydet</button><p role="status">${escape(message)}</p></form></section>`;
  if(richCards){const select=root.querySelector('[name="supplierId"]'),pageLabel=root.querySelector('[data-supplier-page]'),prev=root.querySelector('[data-supplier-prev]'),next=root.querySelector('[data-supplier-next]');let sequence=0;const refresh=async()=>{const current=++sequence;prev.disabled=true;next.disabled=true;try{const result=await loadSuppliers(supplierPage,supplierSearch);if(disposed||current!==sequence)return;if(!Array.isArray(result?.data)||typeof result?.meta?.hasNextPage!=='boolean')throw Error();const rows=result.data;if(rows.some(x=>!validId(String(x.id))||typeof x.supplierName!=='string'||typeof x.supplierCode!=='string'))throw Error();const retained=supplierSelected&&!rows.some(x=>String(x.id)===supplierSelected)?`<option value="${escape(supplierSelected)}" selected>${escape(supplierLabel)}</option>`:'';select.innerHTML='<option value="">Seçin</option>'+retained+rows.map(x=>`<option value="${escape(x.id)}" ${String(x.id)===supplierSelected?'selected':''}>${escape(x.supplierCode)} · ${escape(x.supplierName)}</option>`).join('');pageLabel.textContent='Sayfa '+supplierPage;prev.disabled=supplierPage===1;next.disabled=!result.meta.hasNextPage;}catch{if(!disposed&&current===sequence){select.innerHTML='<option value="">Tedarikçiler okunamadı</option>';pageLabel.textContent='Liste okunamadı';}}};select.addEventListener('change',()=>{supplierSelected=select.value;supplierLabel=select.selectedOptions?.[0]?.textContent??'';});root.querySelector('[data-supplier-find]').addEventListener('click',()=>{supplierSearch=root.querySelector('[data-supplier-search]').value;supplierPage=1;void refresh();});prev.addEventListener('click',()=>{if(supplierPage>1){supplierPage--;void refresh();}});next.addEventListener('click',()=>{supplierPage++;void refresh();});void refresh();}
  root.querySelector('[data-product-form]').addEventListener('submit',event=>{event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);let payload;
   try{payload={stockCode:data.get('stockCode'),name:data.get('name'),barcode:data.get('barcode'),unit:data.get('unit'),currency:data.get('currency'),salePriceExact4:desktopProductDecimal4(data.get('sale')),purchasePriceExact4:desktopProductDecimal4(data.get('purchase')),purchaseDiscountRateExact4:desktopProductDecimal4(data.get('discount'),{percentage:true}),saleTier:null};
    if(richCards){payload.brand=data.get('brand');payload.category=data.get('category');payload.supplierId=data.get('supplierId');}
    if(data.get('openingQuantity')!==null&&data.get('openingQuantity')!==undefined){payload.openingQuantityExact3=desktopProductDecimal3(data.get('openingQuantity'));payload.openingDate=String(data.get('openingDate')??'');}
    if(!isDesktopProductCostSupported(payload)){root.querySelector('[role="status"]').textContent='Bu alış fiyatı ve indirim için maliyet hesabı henüz doğrulanamadı.';return;}}
   catch{root.querySelector('[role="status"]').textContent='Fiyatları en fazla dört ondalık basamakla girin; indirim 0 ile 100 arasında olmalı.';return;}
   void act(()=>controller.create(payload));});
 }
 async function act(action){if(busy||disposed)return;busy=true;try{const result=await action();if(disposed)return;if(result.state==='COMMITTED'){try{onCommitted(result);paint('Ürün kaydı tamamlandı.');}catch{paint('Ürün kaydedildi; liste yenilenemedi.');}}else paint('Sonuç henüz doğrulanamadı.');}catch{if(!disposed){try{if(controller.pending())paint('Kayıt doğrulanamadı.');else {const status=root.querySelector('[role="status"]');if(status)status.textContent='Kayıt başlatılamadı; alanları kontrol edin.';}}catch{paint();}}}finally{busy=false;if(!disposed){const button=root.querySelector('button[type="submit"], [data-product-retry]');if(button)button.disabled=false;}}}
 paint();return Object.freeze({dispose(){disposed=true;}});
}
