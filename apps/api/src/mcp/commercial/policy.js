// Dataset names are server-owned. A matching SQL name alone never establishes
// an accounting meaning; vendor metadata and ERP evidence remain explicit.
export const vegaFamilies = {
  stock: ['TBLSTOKLAR','TBLBIRIMLEREX','TBLSTOKENVANTER','TBLSTOKHAREKETLERI','TBLDEPOENVANTER','TBLDEPOLAR','TBLSTOKGRUPLARI','TBLSTOKKARTSERISI','TBLSERINUMARALARI','TBLSERI1','TBLSERI2','TBLSERITAN1','TBLSERITAN2','TBLSTOKREZERV','TBLTXASORTI','TBLTXASORTIHAREKETLERI'],
  accounts: ['TBLCARI','TBLCARIHAREKETLERI','TBLCARIGENELHAREKET','TBLODEMEPLANI','TBLGENELODEME'],
  documents: ['TBLSATFAT','TBLALFAT','TBLSATIRS','TBLALIRS','TBLALSIP','TBLVERSIP','TBLPROFAT','TBLSTKCIK','TBLSTKGIR','TBLDEPOHAR','TBLSATVADFAT','TBLALVADFAT','TBLREZERVGIRIS','TBLREZERVCIKIS','TBLSAYIMGIRIS','TBLSAYIMCIKIS','TBLSEVKEMRI','TBLSEVK','TBLTESLIM','TBLSMFIYATISTEK','TBLSMTALEP'].flatMap(p=>[p+'BASLIK',p+'HAREKET']),
  finance: ['TBLKASA','TBLBANKALAR','TBLBANKAHAREKETLERI','TBLBANKAGENELHAREKET','TBLCEKGIRIS','TBLCEKCIKIS','TBLCEKHAREKETLERI','TBLCEKPORTFOY','TBLSENETGIRIS','TBLSENETCIKIS','TBLSENETHAREKETLERI','TBLSENETPORTFOY','TBLSAHSICEKLER','TBLSAHSISENETLER','TBLSAHSICEKPORTFOY','TBLSAHSISENETPORTFOY','TBLMASRAFFATURALARI','TBLISLGIDER','TBLOZGIDER','TBLOZGIDER2',...['TBLTAHSIL','TBLODEME','TBLBANKGIR','TBLBANKCIK','TBLBANKHAR','TBLBANKODEME','TBLBANKTAHSIL','TBLBANKGELIR','TBLBANKGIDER','TBLCEK'].flatMap(p=>[p+'BASLIK',p+'HAREKET'])],
  reference: ['TBLDOVIZLER','TBLDOVIZKURU','TBLDONEM','TBLFIRMA'],
};
export const templateFamily = new Map(Object.entries(vegaFamilies).flatMap(([family,names])=>names.map(name=>[name,family])));
export const melisaFamilies = {
  stock:['products','product_barcodes','product_images','stock_movements'],
  accounts:['customers','suppliers','customer_movements','supplier_movements'],
  documents:['sales_invoices','sales_invoice_items','purchase_invoices','purchase_invoice_items','sales_offers','sales_offer_items','sales_orders','sales_order_items'],
  finance:['currency_rates','finance_accounts','finance_account_movements','cash_drawers','cash_drawer_accounts','cash_sessions','cash_session_counts','expense_categories','cash_expenses','cash_transfers','cash_adjustments'],
  local_enrichment:['vega_product_images','vega_product_customs','catalogs','catalog_items'],
};
export const melisaTemplateFamily = new Map(Object.entries(melisaFamilies).flatMap(([family,names])=>names.map(name=>[name,family])));
export const secretName = /password|passwd|parola|sifre|şifre|secret|tokens?(?:_|$)|^token|credential|session_token|api.?key|private.?key|connection|conn.?str|auth|refresh|salt|hash|anahtar|tarimkey|ebirlik|pin(?:_|$)|cvv|cvc|card.?number|kredikart|kartno|intmusteri|inthesap|intsube|intbanka/i;
export const excludedObject = /USER|KULLANICI|YETKI|CONFIG|AYAR|PARAMETRE|SCRIPT|QUERY|PERSONEL|PERSONNEL|EMPLOYEE|AUTH|AUDIT|SYNC|(?:^|TBL|_)LOG|SESSION_TOKEN/i;
export const opaqueField = /(^|_)(metadata|payload|old_values|new_values|snapshot|notes|note|description|config|json)(_|$)|ISTIHBARAT|ALTNOT|ACIKLAMA|PESIN|KEFIL|TCKIMLIK|VERGINO|VNO|RESIM|FILEPATH|storage_key|passive_reason|RESPONSEMESSAGE/i;
export const personalField = /TELEFON|GSM|EMAIL|MAIL|FAX|FAKS|YETKILI|ADRES|^phone$|^email$|^address$|^contact_name$|^IBAN$|^HESAPNO$|^TEL$/i;
export const scalarTypes = new Set(['bigint','int','smallint','tinyint','bit','decimal','numeric','money','smallmoney','float','real','nvarchar','varchar','nchar','char','date','datetime','datetime2','smalldatetime','datetimeoffset','time','uniqueidentifier']);
export const decimalTypes = new Set(['decimal','numeric','money','smallmoney','float','real']);
export const integerTypes = new Set(['bigint','int','smallint','tinyint']);
export const dateTypes = new Set(['date','datetime','datetime2','smalldatetime','datetimeoffset','time']);
export const defaultNames=['IND','id','STOKKODU','stock_code','MALINCINSI','name','FIRMAKODU','supplier_code','FIRMANO','STOKNO','product_id','TARIH','created_at','BELGENO','EVRAKNO','PARABIRIMI','currency_code','STATUS','is_active','DELETED','is_deleted','IADE','IPTAL','BIRIM','unit'];

const meanings={
 IND:'Source row identity; only unique within the named object and scope.',id:'Local ERP row identity.',
 STOKKODU:'Vega stock code (ERP vegaProductService).',MALINCINSI:'Vega product name (ERP vegaProductService).',
 FIRMAKODU:'Account code (ERP vegaCustomerService).',FIRMAADI:'Recorded account/document name; entity role depends on dataset.',
 GIREN:'Recorded incoming quantity; not necessarily a purchase.',CIKAN:'Recorded outgoing quantity; not necessarily a sale.',
 IZAHAT:'Source movement code; unrecognized codes must not be interpreted as sales.',
 PARABIRIMI:'Recorded source currency code; not a conversion instruction.',KUR:'Recorded transaction exchange rate; zero/null is unavailable.',
 stock_code:'Local ERP stock code.',name:'Recorded local ERP name.',currency_code:'Recorded local ERP currency.',
 current_stock_qty:'Local ERP current quantity; separate from live Vega.',sales_price:'Local recorded sales price; current commercial offer not implied.',
 purchase_price:'Local recorded purchase price.',average_cost_try:'Local recorded average cost in TRY; not independently validated live cost.',
};
// Newly discovered objects get only these reviewed scalar source fields until
// their remaining columns are classified. Their names do not imply a sale,
// purchase, balance, price unit, or a join.
const unclassifiedFields = new Set([...defaultNames,'FIND','STOKNO','BIRIMEX','BIRIMADI','BARCODE','TUTAR','BORC','ALACAK','KUR','GIREN','CIKAN','KALAN','MIKTAR','DEPO','LN','ODEMETARIHI','ISLEMTARIHI','ISLEMTIPI','IZAHAT','CARINO','BANKANO','KASANO','PORTFOYNO','SERINO','KOD','KODU','ADI','AD','TARIH1','TARIH2','FIYAT','FIYATI','KDV','KDVTUTARI','ISK1','ISK2','ISK3','ISK4','ISK5','ISK6']);
export function fieldPolicy(column,{source,template,family}){
 if(secretName.test(column.name)||opaqueField.test(column.name)||!scalarTypes.has(column.dataType))return null;
 if(family==='unclassified'&&!unclassifiedFields.has(column.name)&&!(column.sourcePrimaryKey&&(integerTypes.has(column.dataType)||column.dataType==='uniqueidentifier')))return null;
 // Firm definitions contain credentials and tax identity: select only the
 // exact source identifiers needed to establish an authorized company scope.
 if(source==='vega'&&template==='TBLFIRMA'&&!['IND','KOD','KISAAD','AD1','AKTIFDONEM'].includes(column.name))return null;
 const meaning=meanings[column.name];
 return {...column,personal:personalField.test(column.name),meaning:meaning||'Raw source column; business meaning has not been independently verified.',meaningStatus:meaning?'erp-mapped':'raw-unverified',aggregate:[]};
}
export const warnings = [
 'Rows are source records, not finalized sales or verified balances unless the dataset explicitly says so.',
 'Null means unavailable; quantities, prices, cancellations and returns must retain their source context.',
 'Metadata visibility is limited by the SELECT-only account; an invisible object is not proven absent.',
 'Source date/time columns may not record a timezone. Live pagination is not a historical snapshot.',
 'The registered period year is not a date filter: historical period tables contain out-of-year dates. Specify both period and date bounds for year comparisons.',
];
export function fail(code,message=code){return Object.assign(new Error(message),{code,statusCode:400});}
export function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
export function exactKeys(value,keys){if(!plainObject(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail('INVALID_ARGUMENTS');}
