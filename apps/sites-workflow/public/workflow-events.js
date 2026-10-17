// Fixed handlers migrated from the existing panel; no eval or inline event code.
(function(){
const handlers={
wf0:function(event){go('home')},
wf1:function(event){showProduct(Number(this.dataset.wfArg0))},
wf2:function(event){go('receipts')},
wf3:function(event){go(this.dataset.wfArg0)},
wf4:function(event){go('goods')},
wf5:function(event){go('receipts')},
wf6:function(event){toast('Dışa aktarma örneği hazır değil')},
wf7:function(event){openModal('product')},
wf8:function(event){filterTable(this.value)},
wf9:function(event){openModal('goods')},
wf10:function(event){toast('Örnek: kabul tamamlandı, stok 120 adet arttı')},
wf11:function(event){openModal('purchase')},
wf12:function(event){saleCompact=!saleCompact;render()},
wf13:function(event){saleCustomer=this.value;saleFxRate='';render()},
wf14:function(event){saleFxRate=this.value.trim();updateSalePricing()},
wf15:function(event){addProduct()},
wf16:function(event){finishSale()},
wf17:function(event){saleStage='edit';render()},
wf18:function(event){completePreviewSale()},
wf19:function(event){MelisaTerminal.reset()},
wf20:function(event){greenOpenLast()},
wf21:function(event){setSaleQty(Number(this.dataset.wfArg0),this)},
wf22:function(event){basket.splice(Number(this.dataset.wfArg0),1);saleMessage='';render()},
wf23:function(event){go('sales')},
wf24:function(event){toast('Örnek filtre uygulandı')},
wf25:function(event){receiptDetail('SF-02659')},
wf26:function(event){receiptDetail('SF-02658')},
wf27:function(event){openModal('collection')},
wf28:function(event){toast('Örnek bildirim onaylandı')},
wf29:function(event){toast('Bildirim iade edildi')},
wf30:function(event){openModal('count')},
wf31:function(event){toast('Sayım geçmişi açıldı')},
wf32:function(event){openModal('return')},
wf33:function(event){toast('Örnek liste dışa aktarıldı')},
wf34:function(event){toast('Örnek indirim onaylandı')},
wf35:function(event){toast('Örnek indirim onaylandı')},
wf36:function(event){document.getElementById('productDetail').innerHTML='<section class="card inspector-empty"><h2>Ürün bilgileri</h2><p>Soldaki listeden bir ürün seçin.</p></section>';document.querySelectorAll('#stocktable tr.selected').forEach(r=>r.classList.remove('selected'))},
wf37:function(event){closeModal()},
wf38:function(event){closeModal()},
wf39:function(event){closeModal()},
wf40:function(event){closeModal()},
wf41:function(event){closeModal()},
wf42:function(event){closeModal();toast('Örnek taslak kaydedildi; canlı ERP’ye yazılmadı')},
wf43:function(event){document.getElementById('receiptDetail').innerHTML=''},
wf44:function(event){toast('Örnek: müşteri carisine aktarım adımı açıldı')},
wf45:function(event){toast('Örnek düzeltme formu açıldı')},
wf46:function(event){greenTransferCustomer(event)},
wf47:function(event){greenClose()},
wf48:function(event){greenCollect(event)},
wf49:function(event){greenApprove(event)},
wf50:function(event){greenShip()},
wf51:function(event){go('receipts')},
wf52:function(event){go('sales')},
wf53:function(event){go('goods')},
wf54:function(event){go('purchases')},
wf55:function(event){go('count')},
wf56:function(event){go('approvals')},
wf57:function(event){go('sales')},
wf58:function(event){greenFilterReceipts(event)}
};
for(const type of ['click','input','change','keydown','submit']){
 document.addEventListener(type,event=>{
  const target=event.target.closest?.('[data-wf-'+type+']');
  if(!target)return;
  const handler=handlers[target.getAttribute('data-wf-'+type)];
  if(handler&&handler.call(target,event)===false)event.preventDefault();
 });
}
})();
