export const exampleSettingDefaults=Object.freeze({displayName:'Melisa Baby',paymentMethod:'Nakit',countScanQuantity:1});
const check=(ok,message)=>{if(!ok)throw Error(message)};
export const canEditExampleSettings=actor=>actor==='Semih';
function values(input){
 check(input&&typeof input.displayName==='string','İşletme adını girin.');
 const displayName=input.displayName.trim();check(displayName.length>=2&&displayName.length<=80,'İşletme adı 2–80 karakter olmalı.');
 check(['Nakit','Banka','Kart'].includes(input.paymentMethod),'Geçerli tahsilat yöntemi seçin.');
 check(Number.isSafeInteger(input.countScanQuantity)&&input.countScanQuantity>=1&&input.countScanQuantity<=1000000,'Okutma adedi 1–1.000.000 arasında tam sayı olmalı.');
 return {displayName,paymentMethod:input.paymentMethod,countScanQuantity:input.countScanQuantity};
}
export function readExampleSettings(s){
 const saved=s.exampleSettings;if(!saved)return {revision:0,values:{...exampleSettingDefaults},history:[]};
 check(Number.isSafeInteger(saved.revision)&&saved.revision>=0&&Array.isArray(saved.history),'Kayıtlı ayarlar okunamadı.');
 return {revision:saved.revision,values:values(saved.values),history:structuredClone(saved.history)};
}
export function saveExampleSettings(s,input,revision,reason,actor){
 check(canEditExampleSettings(actor),'Ayarları yalnız Semih değiştirebilir.');
 const previous=readExampleSettings(s);check(revision===previous.revision,'Ayarlar başka bir ekranda değişti. Sayfayı yenileyip tekrar deneyin.');
 const next=values(input);check(typeof reason==='string'&&reason.trim().length>=3&&reason.trim().length<=300,'3–300 karakterlik değişiklik nedeni yazın.');
 if(JSON.stringify(next)===JSON.stringify(previous.values))return previous;
 const record={before:previous.values,after:next,actor,reason:reason.trim(),at:new Date().toISOString(),revision:revision+1};
 s.exampleSettings={revision:revision+1,values:next,history:[...previous.history,record]};
 s.audit.push({type:'Örnek ayarlar değiştirildi',id:'AY-'+record.revision,actor,at:record.at});return readExampleSettings(s);
}
