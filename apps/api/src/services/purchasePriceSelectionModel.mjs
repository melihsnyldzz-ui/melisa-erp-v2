import {createHash} from 'node:crypto';

// Pure core for the next native bridge. Reader rows and expected bindings must
// come from server-owned, verified sources, never from the HTTP request itself.
const OPENING=Object.freeze({runId:'VEGA-OPENING-TEST-20261004-06',sourceHash:'36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400',planHash:'18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a',sourceAsOf:'2026-09-30'});
const CURRENCIES=new Set(['TRY','USD','EUR']);
const MAX_NATIVE_PRICE=999999999999999999n; // decimal(18,4), scaled4
const MAX_QUANTITY=999999999999999999n; // decimal(18,3), scaled3
const MAX_RATE=999999999999999999n; // decimal(18,8), scaled8
const SAFE_INTEGER=BigInt(Number.MAX_SAFE_INTEGER);
const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:409});};
function object(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('PURCHASE_PRICE_INPUT_INVALID',`${label} alanları geçersiz.`);}
function text(value,label,max=250){if(typeof value!=='string'||!value.trim()||value.length>max)fail('PURCHASE_PRICE_INPUT_INVALID',`${label} gerekli.`);return value;}
function id(value,label){if(typeof value!=='string'||!/^[1-9]\d*$/.test(value)||BigInt(value)>9223372036854775807n)fail('PURCHASE_PRICE_INPUT_INVALID',`${label} geçersiz.`);return value;}
function hash(value,label){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail('PURCHASE_PRICE_BINDING_INVALID',`${label} geçersiz.`);return value;}
function currency(value){if(!CURRENCIES.has(value))fail('PURCHASE_PRICE_CURRENCY_INVALID','TRY, USD veya EUR gerekli.');return value;}
function decimal(value,scale,label,max){
 if(typeof value!=='string'||value.length>50||!new RegExp(`^(0|[1-9]\\d*)\\.\\d{${scale}}$`).test(value))fail('PURCHASE_PRICE_DECIMAL_INVALID',`${label} kesin ${scale} ondalıklı metin olmalı.`);
 const units=BigInt(value.replace('.',''));if(max!=null&&units>max)fail('PURCHASE_PRICE_OVERFLOW',`${label} SQL hassasiyet sınırını aşıyor.`);return units;
}
function formatted(units,scale){const negative=units<0n,abs=negative?-units:units,s=abs.toString().padStart(scale+1,'0');return `${negative?'-':''}${s.slice(0,-scale)}.${s.slice(-scale)}`;}
const halfUp=(numerator,denominator)=>(numerator+denominator/2n)/denominator;
function validDate(value,label='Belge tarihi'){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00Z`))||new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)fail('PURCHASE_PRICE_DATE_INVALID',`${label} geçersiz.`);return value;
}
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function purchasePriceBindingHash(value){return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function same(actual,expected,keys,code='PURCHASE_PRICE_BINDING_CHANGED'){for(const key of keys)if(actual[key]!==expected[key])fail(code,`Kaynak bağı değişti: ${key}.`);}
function numberBoundary(exact,scale){
 const units=decimal(exact,scale,'Native projeksiyon');
 const value=Number(exact),safe=units<=SAFE_INTEGER&&Number.isFinite(value)&&value.toFixed(scale)===exact;
 return {safe,value:safe?value:null,exact};
}

// exact8 -> native decimal(18,4), HALF_UP. delta is projected minus source.
export function projectPurchasePriceExact8(priceExact){
 const exact=decimal(priceExact,8,'Kaynak alış fiyatı'),projected=halfUp(exact,10000n);
 if(projected>MAX_NATIVE_PRICE)fail('PURCHASE_PRICE_OVERFLOW','Alış fiyatı native decimal(18,4) sınırını aşıyor.');
 const nativePriceExact4=formatted(projected,4),roundingDeltaExact8=formatted(projected*10000n-exact,8);
 return {priceExact,nativePriceExact4,roundingDeltaExact8,roundingRule:'HALF_UP',roundingRequired:projected*10000n!==exact,knownZero:exact===0n,nativeNumberBoundary:numberBoundary(nativePriceExact4,4)};
}

const SOURCE_FIELDS=['source','runId','sourceHash','planHash','sourceAsOf','readOnly','sourceFreshLive','cutoverAccepted'];
function validateSource(source,expectedSource){
 object(source,SOURCE_FIELDS,'Fiyat kaynağı');object(expectedSource,SOURCE_FIELDS,'Dondurulmuş fiyat kaynağı');
 if(source.readOnly!==true||source.sourceFreshLive!==false||source.cutoverAccepted!==false)fail('PURCHASE_PRICE_SOURCE_INVALID','Salt okunur kaynak kapsamı açıkça doğrulanmalı.');
 hash(source.sourceHash,'Kaynak hash');hash(source.planHash,'Plan hash');validDate(source.sourceAsOf,'Kaynak kesimi');
 if(source.source==='accepted-native-opening-prices')same(source,OPENING,['runId','sourceHash','planHash','sourceAsOf'],'PURCHASE_PRICE_SOURCE_INVALID');
 else if(source.source==='synthetic-test'){if(!/^TEST-C03-[A-Za-z0-9-]{1,60}$/.test(source.runId??''))fail('PURCHASE_PRICE_SOURCE_INVALID','Ayrı sentetik TEST kaynak kimliği gerekli.');}
 else fail('PURCHASE_PRICE_SOURCE_INVALID','Desteklenmeyen alış fiyatı kaynağı.');
 same(source,expectedSource,SOURCE_FIELDS);return {...source,synthetic:source.source==='synthetic-test'};
}
const UNIT_FIELDS=['productId','mainUnitSourceId','unit','factorExact8','source','sourceKey','version','hash'];
function validateUnit(unit,expectedUnit,product){
 object(unit,UNIT_FIELDS,'Operasyon birim kanıtı');object(expectedUnit,UNIT_FIELDS,'Dondurulmuş birim kanıtı');
 id(unit.productId,'Birim ürün kimliği');id(unit.mainUnitSourceId,'Ana birim kimliği');text(unit.unit,'Operasyon birimi',40);text(unit.source,'Birim kanıt kaynağı',80);text(unit.sourceKey,'Birim kaynak anahtarı',400);text(unit.version,'Birim sürümü',80);hash(unit.hash,'Birim hash');
 if(decimal(unit.factorExact8,8,'Birim faktörü')<=0n)fail('PURCHASE_PRICE_UNIT_INVALID','Kanıtlı pozitif birim faktörü gerekli.');
 if(unit.productId!==product.productId||unit.mainUnitSourceId!==product.mainUnitSourceId)fail('PURCHASE_PRICE_UNIT_INVALID','Ürün ana birim kimliği kanıtla eşleşmiyor.');
 same(unit,expectedUnit,UNIT_FIELDS,'PURCHASE_PRICE_UNIT_INVALID');return {...unit};
}
const SELECTION_FIELDS=['productId','priceId','productSourceKey','priceSourceKey','runId','sourceHash','planHash','type','unitSourceId','tier','currency','priceExact'];
const PRICE_FIELDS=['id','productId','productSourceKey','sourceKey','unitSourceId','type','tier','currency','priceExact','isMainUnit'];

// Selection is an untrusted snapshot; prices/product are verified reader rows.
// CARD purchase price has no unitSourceId. Operational unit evidence is separate.
export function selectPurchasePrice({selection,product,prices,source,expectedSource,unitEvidence,expectedUnitEvidence}){
 object(selection,SELECTION_FIELDS,'Fiyat seçimi');const provenance=validateSource(source,expectedSource);
 if(!product||typeof product!=='object'||Array.isArray(product))fail('PURCHASE_PRICE_INPUT_INVALID','Doğrulanmış ürün gerekli.');
 id(product.productId,'Ürün kimliği');id(product.mainUnitSourceId,'Ana birim kimliği');text(product.productSourceKey,'Ürün kaynak anahtarı',400);
 if(selection.type!=='purchase'||selection.unitSourceId!==null||selection.tier!==0)fail('PURCHASE_PRICE_TUPLE_INVALID','Yalnız purchase/CARD/0 alış tuple seçilebilir.');
 id(selection.productId,'Seçilen ürün');id(selection.priceId,'Seçilen fiyat');currency(selection.currency);decimal(selection.priceExact,8,'Seçilen fiyat');
 if(selection.productId!==product.productId||selection.productSourceKey!==product.productSourceKey)fail('PURCHASE_PRICE_BINDING_CHANGED','Ürün/kaynak kimliği farklı.');
 same(selection,provenance,['runId','sourceHash','planHash']);
 if(!Array.isArray(prices)||prices.length>1000)fail('PURCHASE_PRICE_INPUT_INVALID','Doğrulanmış fiyat listesi gerekli.');
 const seenIds=new Set(),seenKeys=new Set();
 for(const row of prices){
  object(row,PRICE_FIELDS,'Doğrulanmış fiyat');id(row.id,'Fiyat kimliği');currency(row.currency);decimal(row.priceExact,8,'Exact fiyat');
  const purchase=row.type==='purchase',sale=row.type==='sale';
  if(row.productId!==product.productId||row.productSourceKey!==product.productSourceKey||(!purchase&&!sale)
   ||(purchase&&(row.unitSourceId!==null||row.tier!==0||row.isMainUnit!==false))
   ||(sale&&(!Number.isInteger(row.tier)||row.tier<1||row.tier>6||row.unitSourceId===null||typeof row.isMainUnit!=='boolean')))fail('PURCHASE_PRICE_TUPLE_INVALID','Fiyat listesi ürün/birim/kademe bağı geçersiz.');
  if(sale){id(row.unitSourceId,'Satış kaynak birimi');if(row.isMainUnit!==(row.unitSourceId===product.mainUnitSourceId))fail('PURCHASE_PRICE_UNIT_INVALID','Satış ana birim işareti geçersiz.');}
  const key=`${product.productSourceKey}/PRICE/${row.type}/${row.unitSourceId??'CARD'}/${row.tier}/${row.currency}`;
  if(row.sourceKey!==key||seenIds.has(row.id)||seenKeys.has(key))fail('PURCHASE_PRICE_BINDING_INVALID','Fiyat listesi anahtarı tekil ve exact olmalı.');seenIds.add(row.id);seenKeys.add(key);
 }
 const matches=prices.filter(p=>p?.id===selection.priceId);if(matches.length!==1)fail('PURCHASE_PRICE_UNKNOWN','Seçilen fiyat bilinmiyor veya kimliği tekil değil.');const price=matches[0];object(price,PRICE_FIELDS,'Doğrulanmış fiyat');
 if(price.type!=='purchase'||price.unitSourceId!==null||price.tier!==0||price.isMainUnit!==false)fail('PURCHASE_PRICE_TUPLE_INVALID','Alış tuple birim/kademe bağı geçersiz.');
 same(selection,price,['productId','productSourceKey','type','unitSourceId','tier','currency','priceExact']);
 if(selection.priceSourceKey!==price.sourceKey)fail('PURCHASE_PRICE_BINDING_CHANGED','Fiyat kaynak anahtarı farklı.');
 const expectedPriceKey=`${product.productSourceKey}/PRICE/purchase/CARD/0/${selection.currency}`;
 if(price.sourceKey!==expectedPriceKey)fail('PURCHASE_PRICE_BINDING_CHANGED','Exact alış fiyatı kaynak tuple farklı.');
 if(provenance.source==='accepted-native-opening-prices'&&!/^VEGA_CAPTURE_20260930_01\/F0102\/TBLSTOKLAR\/[1-9]\d*$/.test(product.productSourceKey))fail('PURCHASE_PRICE_SOURCE_INVALID','Vega ürün kaynak kimliği geçersiz.');
 if(provenance.synthetic&&!product.productSourceKey.startsWith(`${provenance.runId}/PRODUCT/`))fail('PURCHASE_PRICE_SOURCE_INVALID','Sentetik ürün gerçek Vega kaynağı gibi gösterilemez.');
 const unit=validateUnit(unitEvidence,expectedUnitEvidence,product),projection=projectPurchasePriceExact8(price.priceExact);
 return {...projection,productId:product.productId,priceId:price.id,productSourceKey:product.productSourceKey,priceSourceKey:price.sourceKey,type:'purchase',unitSourceId:null,tier:0,currency:price.currency,source:provenance,operationalUnit:unit,selectionHash:purchasePriceBindingHash({selection,source:provenance,operationalUnit:unit})};
}

const RATE_FIELDS=['currency','rateToTryExact8','source','sourceId','asOf','version','hash'];
// expectedQuote and maxAgeDays are server-owned policy, never requester choices.
export function selectRateQuote({quote,expectedQuote,currency:expectedCurrency,documentDate,maxAgeDays=0}){
 object(quote,RATE_FIELDS,'Kur seçimi');object(expectedQuote,RATE_FIELDS,'Dondurulmuş kur');currency(expectedCurrency);currency(quote.currency);validDate(documentDate);
 if(quote.currency!==expectedCurrency)fail('PURCHASE_RATE_CURRENCY_INVALID','Kurun dövizi işlemle eşleşmiyor.');
 const units=decimal(quote.rateToTryExact8,8,'İşlem kuru',MAX_RATE);if(units<=0n)fail('PURCHASE_RATE_REQUIRED','Pozitif işlem kuru gerekli.');
 if(expectedCurrency==='TRY'&&units!==100000000n)fail('PURCHASE_RATE_CURRENCY_INVALID','TRY kuru tam 1 olmalı.');
 text(quote.source,'Kur kaynağı',80);text(quote.sourceId,'Kur kaynak kimliği',250);text(quote.version,'Kur sürümü',80);hash(quote.hash,'Kur hash');validDate(quote.asOf,'Kur tarihi');
 if(!Number.isSafeInteger(maxAgeDays)||maxAgeDays<0||maxAgeDays>366)fail('PURCHASE_RATE_POLICY_INVALID','Dondurulmuş kur yaş sınırı geçersiz.');
 const age=(Date.parse(`${documentDate}T00:00:00Z`)-Date.parse(`${quote.asOf}T00:00:00Z`))/86400000;
 if(age<0)fail('PURCHASE_RATE_FUTURE','Belge tarihinden sonraki kur kullanılamaz.');if(age>maxAgeDays)fail('PURCHASE_RATE_STALE','Kur, açık yaş sınırından eski.');
 same(quote,expectedQuote,RATE_FIELDS,'PURCHASE_RATE_BINDING_CHANGED');
 return {...quote,synthetic:quote.source==='synthetic-test',claimsFreshMarket:false,maxAgeDays,documentDate};
}

// PriceContext is re-resolved against verified rows at the native bridge boundary.
// Multiply native4 price by physical native3 quantity; round the document total
// to4, then convert to account/TRY4 with explicit8 rate quotes, all using BigInt.
export function calculatePurchasePriceSettlement({priceContext,quantityExact3,documentCurrency,accountCurrency,documentRateQuote,accountRateQuote,expectedDocumentRateQuote,expectedAccountRateQuote,documentDate,maxRateAgeDays=0}){
 const selected=selectPurchasePrice(priceContext);currency(documentCurrency);currency(accountCurrency);
 if(selected.operationalUnit.factorExact8!=='1.00000000')fail('PURCHASE_PRICE_UNIT_UNSUPPORTED','CARD fiyatı için yalnız kanıtlı ana birim/faktör 1 kullanılabilir; alternatif birimin fiyat bağı ayrıca gerekli.');
 if(selected.currency!==documentCurrency)fail('PURCHASE_PRICE_MIXED_CURRENCY','Alış fiyatının dövizi fiş döviziyle aynı olmalı.');
 const quantity=decimal(quantityExact3,3,'Miktar',MAX_QUANTITY);if(quantity<=0n)fail('PURCHASE_PRICE_QUANTITY_INVALID','Pozitif fiziksel miktar gerekli.');
 const documentRate=selectRateQuote({quote:documentRateQuote,expectedQuote:expectedDocumentRateQuote,currency:documentCurrency,documentDate,maxAgeDays:maxRateAgeDays});
 const accountRate=selectRateQuote({quote:accountRateQuote,expectedQuote:expectedAccountRateQuote,currency:accountCurrency,documentDate,maxAgeDays:maxRateAgeDays});
 const dr=decimal(documentRate.rateToTryExact8,8,'İşlem kuru'),ar=decimal(accountRate.rateToTryExact8,8,'Cari kuru');
 if(documentCurrency===accountCurrency&&dr!==ar)fail('PURCHASE_RATE_MISMATCH','Aynı döviz için iki farklı kur kullanılamaz.');
 const price=decimal(selected.nativePriceExact4,4,'Native fiyat'),amount=halfUp(price*quantity,1000n),account=halfUp(amount*dr,ar),tryAmount=halfUp(amount*dr,100000000n);
 if([amount,account,tryAmount].some(v=>v>MAX_NATIVE_PRICE))fail('PURCHASE_PRICE_OVERFLOW','Fiş/cari/TRY tutarı decimal(18,4) sınırını aşıyor.');
 const documentAmountExact4=formatted(amount,4),accountAmountExact4=formatted(account,4),amountTryExact4=formatted(tryAmount,4);
 return {selectedPrice:selected,quantityExact3,documentCurrency,accountCurrency,documentAmountExact4,accountAmountExact4,amountTryExact4,documentRate,accountRate,roundingRule:'HALF_UP',nativeNumberBoundary:{documentAmount:numberBoundary(documentAmountExact4,4),accountAmount:numberBoundary(accountAmountExact4,4),amountTry:numberBoundary(amountTryExact4,4)}};
}
