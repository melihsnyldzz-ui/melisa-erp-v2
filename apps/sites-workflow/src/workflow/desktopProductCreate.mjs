// Source-only. Supply an authenticated submit function, origin-shared durable
// storage and Web Locks. This module does not connect, mount itself or write SQL.
import {desktopInitialCostParity,desktopInitialOpeningAmountParity} from '../../../api/src/services/desktopInitialCostParity.mjs';
import {isDurableProductRejection} from '../../../api/src/services/desktopProductRejection.mjs';
import {desktopAdditionalBarcodes,desktopAdditionalBarcodeText} from '../../../api/src/services/desktopProductBarcodes.mjs';
const env='eb2888c2-51cb-4570-a933-397cf7e62806';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=()=>{throw new Error('PRODUCT_CREATE_INVALID');};
const fields=['stockCode','name','barcode','unit','currency','salePriceExact4','purchasePriceExact4','purchaseDiscountRateExact4','saleTier'];
const openingFields=['openingQuantityExact3','openingDate'];
const richFields=['brand','category','supplierId'];
const withRich=value=>richFields.some(k=>Object.hasOwn(value??{},k));
const withOpening=value=>openingFields.some(k=>Object.hasOwn(value??{},k));
const additionalFields=value=>Object.hasOwn(value??{},'additionalBarcodes')?['additionalBarcodes']:[];
const rejectionMessage=reason=>reason==='PRODUCT_BARCODE_IN_USE'?'Bu barkod başka bir ürün kartında kullanılıyor. Ürün kaydedilmedi; barkodu düzeltin.':reason==='PRODUCT_BARCODE_DUPLICATE_INPUT'?'Aynı barkod formda birden çok kez yazılmış. Ana ve ek barkodları kontrol edin.':'Bu stok kodu zaten kullanılıyor. Ürün kaydedilmedi; stok kodunu düzeltin.';
const formValues=v=>({...v,sale:v.salePriceExact4,purchase:v.purchasePriceExact4,discount:v.purchaseDiscountRateExact4,openingQuantity:v.openingQuantityExact3,openingDate:v.openingDate,additionalBarcodes:(v.additionalBarcodes??[]).join('\n')});
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
 if(!exact(input,[...fields,...(withOpening(input)?openingFields:[]),...(withRich(input)?richFields:[]),...additionalFields(input)])||typeof requestId!=='string'||!uuid.test(requestId)||typeof input.currency!=='string'||!/^[A-Z]{3}$/.test(input.currency))fail();
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
  purchaseDiscountRateExact4:discount(input.purchaseDiscountRateExact4),saleTier:input.saleTier,...opening,...(withRich(input)?{brand:text(input.brand,120),category:text(input.category,120),supplierId:validId(input.supplierId)?input.supplierId:fail()}: {}),...(additionalFields(input).length?{additionalBarcodes:desktopAdditionalBarcodes(input.barcode,input.additionalBarcodes)}:{})});
}
function restored(record,actorId){
 if(!exact(record,['version','actorId','body'])||record.version!==1||record.actorId!==actorId||!exact(record.body,['requestId',...fields,...(withOpening(record.body)?openingFields:[]),...(withRich(record.body)?richFields:[]),...additionalFields(record.body)]))fail();
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
 function record(){
  const raw=storage.getItem(key);if(raw===null)return null;if(typeof raw!=='string'||raw.length>8192)fail();let value;try{value=JSON.parse(raw);}catch{fail();}
  if(value?.version===2){
   if(!richCards||!exact(value,['version','actorId','body','rejection'])||value.actorId!==actorId)fail();
   const payload=restored({version:1,actorId:value.actorId,body:value.body},actorId);
   if(!isDurableProductRejection(value.rejection,payload.requestId))fail();return {body:payload,rejection:value.rejection};
  }
  return {body:restored(value,actorId),rejection:null};
 }
 function read(){const value=record();return value?.rejection?null:value?.body??null;}
 async function send(payload){let result;try{result=await submit({...payload});}catch{return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});}
  if(richCards&&isDurableProductRejection(result,payload.requestId)){
   const existing=read();if(!existing||JSON.stringify(existing)!==JSON.stringify(payload))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
   // Replace pending with a complete rejected draft in one durable write.
   // A disposed/closed screen must not lose fields or mint a new request.
   storage.setItem(key,JSON.stringify({version:2,actorId,body:payload,rejection:result}));
   const saved=record();if(!saved||JSON.stringify(saved.body)!==JSON.stringify(payload)||JSON.stringify(saved.rejection)!==JSON.stringify(result))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
   return Object.freeze({...result});
  }
  if(!result||result.state!=='COMMITTED'||result.requestId!==payload.requestId||result.operation!=='product.create'||!isDesktopPersistedProduct(result.entity,payload))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
  const existing=read();if(!existing||JSON.stringify(existing)!==JSON.stringify(payload))return Object.freeze({state:'UNKNOWN',requestId:payload.requestId});
  storage.removeItem(key);return Object.freeze({state:'COMMITTED',requestId:payload.requestId,entity:result.entity,replayed:result.replayed===true});}
 async function exclusive(work){if(running)throw new Error('PRODUCT_CREATE_BUSY');running=true;try{return await locks.request(key,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw new Error('PRODUCT_CREATE_BUSY');return work();});}finally{running=false;}}
 return Object.freeze({pending:()=>read(),draft:()=>{const value=record();return value?.rejection?Object.freeze({...value.body}):null;},rejected:()=>record()?.rejection??null,async create(input){return exclusive(async()=>{if(read())throw new Error('PRODUCT_CREATE_PENDING');if(richCards&&(!withRich(input)||input.currency!=='TRY')||!richCards&&additionalFields(input).length)fail();const p=body(input,newId());
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
  const draft=typeof controller.draft==='function'?controller.draft():null,rejection=typeof controller.rejected==='function'?controller.rejected():null;
  if(draft?.supplierId)supplierSelected=draft.supplierId;
  if(!message&&rejection)message=rejectionMessage(rejection.reason);
  root.innerHTML=`<section class="card panel" style="padding:20px"><h2>Yeni ürün kartı</h2>${richCards?'':'<p>Marka, kategori ve tedarikçi alanları bu aşamada kaydedilemiyor.</p>'}
<form data-product-form><fieldset data-product-fields class="desktop-product-fields" ${busy?'disabled':''}>
<label class="desktop-product-field">Stok kodu<input name="stockCode" maxlength="50" required></label>
<label class="desktop-product-field">Ürün adı<input name="name" maxlength="250" required></label>
${richCards?`<label class="desktop-product-field">Marka<input name="brand" maxlength="120" required></label>
<label class="desktop-product-field">Ürün türü<input name="category" maxlength="120" required></label>
<div class="desktop-product-field desktop-product-wide"><span>Tedarikçi ara</span><div class="desktop-supplier-tools"><input aria-label="Tedarikçi ara" data-supplier-search maxlength="100"><button class="btn" type="button" data-supplier-find>Ara</button><button class="btn" type="button" data-supplier-prev>Önceki</button><span data-supplier-page></span><button class="btn" type="button" data-supplier-next>Sonraki</button></div></div>
<label class="desktop-product-field desktop-product-wide">Tedarikçi<select name="supplierId" required><option value="">Liste yükleniyor</option></select></label>`:''}
<label class="desktop-product-field">Barkod<input name="barcode" maxlength="80" required></label>
<label class="desktop-product-field">Birim<input name="unit" maxlength="20" value="ADET" required></label>
<label class="desktop-product-field">Para birimi<select name="currency"><option>TRY</option>${richCards?'':'<option>USD</option><option>EUR</option>'}</select>${richCards?'<small>Bu kurulumda ürün maliyeti TRY ile kaydediliyor.</small>':''}</label>
${richCards?'<label class="desktop-product-field desktop-product-wide">Ek barkodlar<textarea name="additionalBarcodes" rows="3" maxlength="1000" placeholder="Her satıra bir barkod"></textarea><small>En çok 10 ek barkod. Baştaki sıfırlar korunur.</small></label>':''}
<label class="desktop-product-field">Satış fiyatı<input name="sale" inputmode="decimal" required></label>
<label class="desktop-product-field">Alış fiyatı<input name="purchase" inputmode="decimal" required></label>
<label class="desktop-product-field">Alış indirimi (%)<input name="discount" inputmode="decimal" value="0" required></label>
<label class="desktop-product-field">Başlangıç stoğu (TRY / ADET)<input name="openingQuantity" inputmode="decimal" value="0" required></label>
<label class="desktop-product-field">Başlangıç stok tarihi<input name="openingDate" type="date" value="${today}" required></label>
<div class="desktop-product-actions desktop-product-wide"><button class="btn primary" type="submit" ${busy?'disabled':''}>Kaydet</button></div>
<p role="status" class="desktop-product-wide">${escape(message)}</p>
</fieldset></form></section>`;
  if(draft){const values=formValues(draft);for(const [name,value] of Object.entries(values)){const field=root.querySelector(`[name="${name}"]`);if(field&&typeof value==='string')field.value=value;}}
  if(richCards){const select=root.querySelector('[name="supplierId"]'),pageLabel=root.querySelector('[data-supplier-page]'),prev=root.querySelector('[data-supplier-prev]'),next=root.querySelector('[data-supplier-next]');let sequence=0;const refresh=async()=>{const current=++sequence;prev.disabled=true;next.disabled=true;try{const result=await loadSuppliers(supplierPage,supplierSearch);if(disposed||current!==sequence)return;if(!Array.isArray(result?.data)||typeof result?.meta?.hasNextPage!=='boolean')throw Error();const rows=result.data;if(rows.some(x=>!validId(String(x.id))||typeof x.supplierName!=='string'||typeof x.supplierCode!=='string'))throw Error();const retained=supplierSelected&&!rows.some(x=>String(x.id)===supplierSelected)?`<option value="${escape(supplierSelected)}" selected>${escape(supplierLabel)}</option>`:'';select.innerHTML='<option value="">Seçin</option>'+retained+rows.map(x=>`<option value="${escape(x.id)}" ${String(x.id)===supplierSelected?'selected':''}>${escape(x.supplierCode)} · ${escape(x.supplierName)}</option>`).join('');pageLabel.textContent='Sayfa '+supplierPage;prev.disabled=supplierPage===1;next.disabled=!result.meta.hasNextPage;}catch{if(!disposed&&current===sequence){select.innerHTML='<option value="">Tedarikçiler okunamadı</option>';pageLabel.textContent='Liste okunamadı';}}};select.addEventListener('change',()=>{supplierSelected=select.value;supplierLabel=select.selectedOptions?.[0]?.textContent??'';});root.querySelector('[data-supplier-find]').addEventListener('click',()=>{supplierSearch=root.querySelector('[data-supplier-search]').value;supplierPage=1;void refresh();});prev.addEventListener('click',()=>{if(supplierPage>1){supplierPage--;void refresh();}});next.addEventListener('click',()=>{supplierPage++;void refresh();});void refresh();}
  root.querySelector('[data-product-form]').addEventListener('submit',event=>{event.preventDefault();if(busy)return;const data=new FormData(event.currentTarget);let payload;
   try{payload={stockCode:data.get('stockCode'),name:data.get('name'),barcode:data.get('barcode'),unit:data.get('unit'),currency:data.get('currency'),salePriceExact4:desktopProductDecimal4(data.get('sale')),purchasePriceExact4:desktopProductDecimal4(data.get('purchase')),purchaseDiscountRateExact4:desktopProductDecimal4(data.get('discount'),{percentage:true}),saleTier:null};
    if(richCards){payload.brand=data.get('brand');payload.category=data.get('category');payload.supplierId=data.get('supplierId');const extra=desktopAdditionalBarcodeText(payload.barcode,String(data.get('additionalBarcodes')??''));if(extra.length)payload.additionalBarcodes=extra;}
    if(data.get('openingQuantity')!==null&&data.get('openingQuantity')!==undefined){payload.openingQuantityExact3=desktopProductDecimal3(data.get('openingQuantity'));payload.openingDate=String(data.get('openingDate')??'');}
    if(!isDesktopProductCostSupported(payload)){root.querySelector('[role="status"]').textContent='Bu alış fiyatı ve indirim için maliyet hesabı henüz doğrulanamadı.';return;}}
   catch(error){root.querySelector('[role="status"]').textContent=error?.code==='PRODUCT_BARCODES_INVALID'?'Ek barkodları ayrı satırlara yazın. En çok 10 ek barkod girilebilir; aynı barkodu tekrarlamayın.':'Fiyatları en fazla dört ondalık basamakla girin; indirim 0 ile 100 arasında olmalı.';return;}
   void act(()=>controller.create(payload),payload);});
 }
 async function act(action,fields){
  if(busy||disposed)return;busy=true;const group=root.querySelector('[data-product-fields]');if(group)group.disabled=true;try{
   const retained=fields??controller.pending(),result=await action();if(disposed)return;
   if(result.state==='COMMITTED'){try{onCommitted(result);paint('Ürün kaydı tamamlandı.');}catch{paint('Ürün kaydedildi; liste yenilenemedi.');}}
   else if(result.state==='NOT_COMMITTED'&&isDurableProductRejection(result,retained?.requestId??result.requestId)){
    if(retained?.supplierId)supplierSelected=retained.supplierId;
    paint(rejectionMessage(result.reason));
    if(retained){const values=formValues(retained);for(const [name,value] of Object.entries(values)){const field=root.querySelector(`[name="${name}"]`);if(field&&typeof value==='string')field.value=value;}}
   }else paint('Sonuç henüz doğrulanamadı.');
  }catch{if(!disposed){try{if(controller.pending())paint('Kayıt doğrulanamadı.');else {const status=root.querySelector('[role="status"]');if(status)status.textContent='Kayıt başlatılamadı; alanları kontrol edin.';}}catch{paint();}}}
  finally{busy=false;if(!disposed){const group=root.querySelector('[data-product-fields]');if(group)group.disabled=false;const button=root.querySelector('button[type="submit"], [data-product-retry]');if(button)button.disabled=false;}}
 }
 paint();return Object.freeze({dispose(){disposed=true;}});
}
