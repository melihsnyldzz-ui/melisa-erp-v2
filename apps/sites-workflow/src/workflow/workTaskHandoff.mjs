const tasks=Object.freeze({
 receiving:{title:'Mal kabulünde iş sırası',steps:[['Personel','Ürünleri sayar, adetleri kaydeder ve kontrole gönderir.'],['İlker','Sayımı kontrol eder ve mevcut yetkisiyle kabulü onaylar. Stok bu onayda artar.'],['Muhasebe','Belgeyi, tutarı ve dövizi kontrol eder. Fatura işlemini ekrandaki yetkili kişi yapar.']]},
 purchase:{title:'Alış faturasında iş sırası',steps:[['Personel','Gelen ürünlerin fiziksel sayımını kaydeder.'],['İlker','Mal kabulünü kontrol edip onaylar. Faturada stok tekrar artmaz.'],['Muhasebe','Fatura belgesini, tutarı ve dövizi kontrol eder. Kaydı mevcut yetkili kişi kesinleştirir.']]},
 count:{title:'Sayımda iş sırası',steps:[['Personel','Fiziksel adedi ve fark nedenini kaydeder, kontrole gönderir.'],['İlker','Sayımı kontrol eder ve mevcut yetkisiyle onaylar. Stok farkı bu onayda uygulanır.'],['Muhasebe','Sonucu ve ilgili belgeleri kontrol eder. Sayım onayı stok yetkilisindedir.']]},
 sale:{title:'Satışa başlarken',steps:[['Müşteriyi seçin','Satışın yapılacağı müşteriyi seçin.'],['Barkodu okutun','Ürünü bulun ve satışa ekleyin.'],['Kontrol edip kaydedin','Adedi, fiyatı ve dövizi kontrol edin; taslağı kaydedip satışı tamamlayın.']]}
});

// Presentation only: no role grants, request handlers or commercial state.
export function workTaskHandoff(lesson){
 const task=typeof lesson==='string'&&Object.hasOwn(tasks,lesson)?tasks[lesson]:null;
 if(!task)return '';
 return `<section class="card work-task-handoff" aria-label="${task.title}"><div class="work-task-heading"><h2>${task.title}</h2><a href="/kullanim-egitimi.html#${lesson}">Kısa eğitim</a></div><ol>${task.steps.map(([role,description])=>`<li><b>${role}</b><span>${description}</span></li>`).join('')}</ol></section>`;
}
