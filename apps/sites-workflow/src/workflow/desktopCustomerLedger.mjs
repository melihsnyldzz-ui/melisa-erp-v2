import {desktopCustomerCardId} from '../../../../packages/shared/src/desktopCustomerCard.mjs';
import {desktopAccountSalesPage} from '../../../../packages/shared/src/desktopAccountSales.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value');});
const code=v=>['TRY','USD','EUR'].includes(v);
const movementNames=new Map([['sales_invoice','Satış'],['sales_invoice_cancel','Satış iptali']]);
const text=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
const decimal=(v,n,w)=>typeof v==='string'&&new RegExp(`^-?(?:0|[1-9]\\d{0,${w-1}})\\.\\d{${n}}$`).test(v)&&v!==`-0.${'0'.repeat(n)}`;
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));return y>=1900&&x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;}

// Browser-safe contract check: no arithmetic or reconstructed balances.
export function isDesktopCustomerLedgerView(value,{customerId,accountId,page,currency}={}){
 try{
  if(!plain(value,['customerId','accountId','currency','balanceExact8','page','hasNext','hasUnassignedMovements','rows'])||!desktopCustomerCardId(customerId)||!desktopCustomerCardId(accountId)||!desktopAccountSalesPage(page)||value.customerId!==customerId||value.accountId!==accountId||value.page!==page||!code(currency)||value.currency!==currency||!decimal(value.balanceExact8,8,20)||typeof value.hasNext!=='boolean'||typeof value.hasUnassignedMovements!=='boolean'||!Array.isArray(value.rows)||value.rows.length>10||value.hasNext&&value.rows.length!==10)return false;
  const seen=new Set();let previous=null;
  for(const row of value.rows){
   if(!plain(row,['id','documentDate','movementType','invoiceId','documentNo','documentCurrency','documentAmountExact4','accountCurrency','accountAmountExact4','balanceEffectExact8'])||!desktopCustomerCardId(row.id)||seen.has(row.id)||!date(row.documentDate)||!text(row.movementType,40)||!(row.invoiceId===null||desktopCustomerCardId(row.invoiceId))||!(row.documentNo===null||text(row.documentNo,60))||(row.invoiceId===null)!==(row.documentNo===null)||!code(row.documentCurrency)||row.accountCurrency!==currency||!decimal(row.documentAmountExact4,4,14)||!decimal(row.accountAmountExact4,4,14)||!decimal(row.balanceEffectExact8,8,20))return false;
   if(previous&&(row.documentDate>previous.documentDate||row.documentDate===previous.documentDate&&BigInt(row.id)>=BigInt(previous.id)))return false;seen.add(row.id);previous=row;
  }
  return true;
 }catch{return false;}
}

export function mountDesktopCustomerLedger({root,customer,load,onOpenInvoice=()=>{},canOpenInvoice=false,initialAccountId=null,onAccountChange=()=>{}}={}){
 if(!root||typeof root.querySelector!=='function'||!customer||!desktopCustomerCardId(customer.id)||!Array.isArray(customer.accounts)||typeof load!=='function'||typeof onOpenInvoice!=='function'||typeof onAccountChange!=='function'||typeof canOpenInvoice!=='boolean')throw Error('CUSTOMER_LEDGER_VIEW_INVALID');
 if(customer.accounts.length>3||customer.accounts.some(a=>!a||!desktopCustomerCardId(a.id)||!code(a.currency))||new Set(customer.accounts.map(a=>a.id)).size!==customer.accounts.length||new Set(customer.accounts.map(a=>a.currency)).size!==customer.accounts.length)throw Error('CUSTOMER_LEDGER_VIEW_INVALID');
 let live=true,sequence=0,page=1,accountId=customer.accounts.find(a=>a.id===initialAccountId)?.id??customer.accounts.find(a=>a.currency===customer.currency)?.id??customer.accounts[0]?.id??'',data=null,busy=false,message='';
 const account=()=>customer.accounts.find(a=>a.id===accountId);
 function draw(){
  if(!live)return;
  if(!accountId){root.innerHTML='<h3>Hesap ekstresi</h3><p>Bu müşterinin bağlı döviz hesabı yok.</p>';return;}
  root.innerHTML=`<h3>Hesap ekstresi</h3><label>Hesap <select data-ledger-account>${customer.accounts.map(a=>`<option value="${esc(a.id)}" ${a.id===accountId?'selected':''}>${esc(a.currency)}</option>`).join('')}</select></label><p role="status">${esc(message||(busy?'Hareketler okunuyor…':''))}</p>${data?`<p>Güncel hesap bakiyesi: ${esc(data.balanceExact8)} ${esc(data.currency)}</p>${data.hasUnassignedMovements?'<p>Bu müşteride hesaba bağlanmamış eski hareketler var; aşağıda yalnız seçili hesaba bağlı hareketler gösteriliyor.</p>':''}${data.rows.length?`<div class="tablewrap"><table><thead><tr><th>Tarih</th><th>Hareket</th><th>Belge</th><th>Belge tutarı</th><th>Hesap tutarı</th><th>Bakiyeye etkisi</th><th></th></tr></thead><tbody>${data.rows.map(row=>`<tr><td>${esc(row.documentDate)}</td><td>${esc(movementNames.get(row.movementType)??'Diğer hareket')}</td><td>${esc(row.documentNo??'—')}</td><td>${esc(row.documentAmountExact4)} ${esc(row.documentCurrency)}</td><td>${esc(row.accountAmountExact4)} ${esc(row.accountCurrency)}</td><td>${esc(row.balanceEffectExact8)} ${esc(row.accountCurrency)}</td><td>${canOpenInvoice&&row.invoiceId?`<button type="button" class="btn" data-ledger-invoice="${esc(row.invoiceId)}">Fişi aç</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p>Bu hesapta kayıtlı hareket yok.</p>'}`:''}<div><button type="button" data-ledger-prev ${busy||page===1?'disabled':''}>Önceki hareketler</button> <span>Sayfa ${page}</span> <button type="button" data-ledger-next ${busy||!data?.hasNext?'disabled':''}>Sonraki hareketler</button> <button type="button" data-ledger-refresh ${busy?'disabled':''}>Ekstreyi yenile</button></div>`;
  root.querySelector('[data-ledger-account]').addEventListener('change',event=>{if(!live||!customer.accounts.some(a=>a.id===event.target.value))return;accountId=event.target.value;onAccountChange(accountId);page=1;void refresh();});
  root.querySelector('[data-ledger-prev]').addEventListener('click',()=>{if(!busy&&page>1){page--;void refresh();}});
  root.querySelector('[data-ledger-next]').addEventListener('click',()=>{if(!busy&&data?.hasNext&&page<100000){page++;void refresh();}});
  root.querySelector('[data-ledger-refresh]').addEventListener('click',()=>{if(!busy)void refresh();});
  root.querySelectorAll('[data-ledger-invoice]').forEach(button=>button.addEventListener('click',()=>{if(live&&!busy&&canOpenInvoice&&data?.rows.some(r=>r.invoiceId===button.dataset.ledgerInvoice))onOpenInvoice(button.dataset.ledgerInvoice);}));
 }
 async function refresh(){const current=++sequence,selected=accountId,number=page,currency=account()?.currency;if(!currency)return;data=null;busy=true;message='';draw();try{const value=await load(customer.id,selected,number,currency);if(!live||current!==sequence)return;if(!isDesktopCustomerLedgerView(value,{customerId:customer.id,accountId:selected,page:number,currency}))throw Error();data=value;}catch{if(live&&current===sequence)message='Hesap ekstresi okunamadı. Hesabı kontrol edip yeniden deneyin.';}finally{if(live&&current===sequence){busy=false;draw();}}}
 onAccountChange(accountId||null);
 if(accountId)void refresh();else draw();
 return Object.freeze({dispose(){live=false;sequence++;}});
}
