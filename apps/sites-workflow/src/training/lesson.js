export const lessonSteps=[
  {title:'Gelen Mal ekranını aç',short:'Ekranı aç',text:'Üstteki Gelen Mal düğmesine bas. Gelen ürünleri bu ekranda sayarız.'},
  {title:'Ürünü ve saydığın adedi kontrol et',short:'Ürünleri say',text:'Yeni sayım aç. Tedarikçiyi seç. Fotoğrafları ve ürün kodlarını karşılaştır. Her ürünü seçip sayımına ekle. Fiziksel adet alanına aşağıdaki alıştırma adedini yaz. Kaydet, sonra İlker kontrolüne gönder.'},
  {title:'Mal kabulü stoğu nasıl artırır?',short:'Stoğu öğren',text:'Sayımı göndermek stoğu artırmaz. Kabulü onayla düğmesine basınca sayılan ürünler stoğa bir kez eklenir. Aşağıdaki önce / sonra sayılarını karşılaştır.'},
  {title:'Bağlı alış faturasını incele',short:'Faturayı öğren',text:'Kabulü seç. Fatura numarası ve tarihini yaz. Her ürün için kabul edilen adedi gir. Tutarı kontrol et, taslağı kaydet ve faturayı kesinleştir. Stok tekrar artmaz; tedarikçiye borç oluşur.'},
  {title:'Tedarikçi borcunun yerini gör',short:'Borcu gör',text:'Tedarikçi hareketindeki alış faturası satırına bak. Kabul, fatura ve borç artışı aynı zincirde görünür. Ardından üç kısa soruyu cevapla.'}
];
export const questions=[
  {id:'stock',text:'Gelen ürün ne zaman stoğa eklenir?',options:[['save','Sayımı kaydedince'],['approval','Mal kabulü onaylanınca']],correct:'approval',explain:'Sayım kaydı adetleri saklar. Stoğu artıran işlem mal kabulünü onaylamaktır.'},
  {id:'invoice',text:'Bağlı alış faturası kesinleşince stok ne olur?',options:[['twice','Aynı ürünler tekrar eklenir'],['once','Stok tekrar artmaz']],correct:'once',explain:'Ürün stoğa mal kabulünde girdi. Bağlı faturada ikinci stok girişi yapılmaz.'},
  {id:'debt',text:'Bu alıştan doğan borcu nerede görürsün?',options:[['supplier','Tedarikçi hareketinde'],['stock','Ürünün fiziksel adet alanında']],correct:'supplier',explain:'Kesinleşen alış faturası tedarikçi hesabında borç artışı oluşturur.'}
];
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function scopedStorage(storage,exerciseId){const prefix=`melisa-training:${exerciseId}:`;return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};}
export function showTrainingTarget(element,{reducedMotion=false}={}){
  if(!element?.isConnected||typeof element.scrollIntoView!=='function')return false;
  element.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'center',inline:'nearest'});
  if(typeof element.focus==='function'){
    if(element.matches?.('button,input,select,textarea,a[href],[tabindex]')===false){element.setAttribute('tabindex','-1');element.addEventListener('blur',()=>element.removeAttribute('tabindex'),{once:true});}
    element.focus({preventScroll:true});
  }
  return true;
}
