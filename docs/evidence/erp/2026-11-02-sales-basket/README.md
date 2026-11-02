# ERP09 / B6 — cihazda saklanan satış sepeti

Mevcut1420 işinin ilk işlevsel dilimi. Eski1344kurulum işi yeniden açılmadı; yeni bitiş yaprağı veya kabul ID'si yoktur.

Önce: normal satış okuyucusundaki sepet yalnız bellekteydi. Tarayıcı yenilemesinde uyarı veriyor, fakat yeniden açılabilecek hazırlık tutmuyordu.

Şimdi: kullanıcı **Sepeti bu cihazda sakla** ile seçimini saklayabilir; yeniden açılışta **Saklanan sepeti aç** güncel müşteri hesabını ve her satırın ürün/stok/birim/fiyatını mevcut production okuyucu ve basket validator üzerinden tekrar doğrular. İki ürünlü2+1adet/USD örneği gerçek tarayıcıda sakla→reload→geri aç akışından geçti. Fiyat değişimi eski sepeti reddetti. Bunlar yalnız sentetik adapter ile normal createWorkSales/createBusinessSalesRead kanıtıdır; gerçek SQL/native veya personel kabulü değildir.

Yerel kayıt yalnız müşteri/hesap/ürün/fiyat/birim/kademe kimliklerini, miktarı, fiyat kontrol değerini, isteğe bağlı tarihi ve son işlem durum damgasını taşır. İsim, telefon, bakiye, token, stok kanıtı, capability veya native gönderim gövdesi taşımaz. Ayrı host+actor anahtarı kullanır; mevcut journal, UUID/body ve replay akışı değişmez. Açılış otomatik POST, fiyat güncelleme veya stok ayırma yapmaz; satış önizlemesi/yetki denetimi ayrıca gerekir.

Yerel mutasyonlar gerçek browser Web Locks exclusive kilidi altında yürür; kilikuyruğunda ekran/nesil/sepet/tarih/journal tekrar kontrol edilir. Diğer sekmenin yeni kaydı, bozuk kayıt veya kapanmış ekran üzerine yazılmaz. Destek yoksa yazma kapalıdır: özelliğin kullanılabilmesi için tarayıcının Web Locks sunduğu güvenli bağlam gerekir; HTTPS olmayan LAN adresinde saklama kullanılabilir sayılmaz. [Web Locks sözleşmesi](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API). Ekran normal bellekte sepet hazırlamaya devam eder.

## Kanıt

-100 hedefli model/UI/binder/journal/trade testi PASS,0skip; gerçek production fonksiyonları kullanıldı.
-Bağımsız source incelemesi GO. Bulunan dispose ve iki-sekme mutasyon P2'leri düzeltildi; ilgili negatifler eklendi.
-Değişen Sites uygulaması offline guard ile11,94s derlendi. İlk genel build komutu değişmeyen web-admin'in yerel Vite bağımlılığı bulunmadığı için ilerleyemedi; bunun yerine mevcut Sites bağımlılığıyla aynı offline guard kullanıldı. Workflow/test/süre sınırı değişmedi.
-Gerçek IAB'de kendi geçici loopback Vite uygulaması; sentetik adapter, SQL/Vega/CRM/ücretli servis/gerçek oturum sunucusu bağlantısı yok. Tarayıcı gerçek Web Locks desteğini gösterdi. Başında sıfır olan iki barkod korundu; geri açılış ürün miktarları ve USD toplamı aynıydı. Bu ürün toplamıdır; native fatura toplamı değildir.
-Özel ekran/log kanıtları mevcut `C:\Sirket\ERP\evidence\ERP-COMPLETE-INDEPENDENT-20261102-1420` altındadır. Görüntüler GitHub'a taşınmadı.

Bu dilim yeni kalıcı TEST kurulumunu, genel satış/finans yazmasını, native sonucu veya ERP-UA07 insan kabulünü kapatmaz. Mevcut normal actor/rol kapsamı değişmedi. Önceki1344 PS WIP ve bütün paketler/consumed kanıtlar korunur. Son exact-head GitHub CI sonucu STATUS ve aynı PR54 raporunda ayrıca belirtilir; önceki commit sonucu bu işlevin sonucu sayılmaz.
