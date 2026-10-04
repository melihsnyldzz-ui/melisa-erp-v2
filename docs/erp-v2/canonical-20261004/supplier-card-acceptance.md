# Gerçek tedarikçi kartı — C07 TEST kabulü

## Kapsam

Normal Tedarikçiler ekranı SQL kartlarını kod/ad araması, aktif/pasif ve karantina filtresi, 25 satırlık sayfalar ve ayrı döviz hesaplarıyla açar. Pozitif doğrulanmış tutar Melisa'nın tedarikçiye borcu, negatif tutar tedarikçiden alacağıdır. Kaynak kimliğinin eşleşmesi tek başına güncel bakiye kabulü değildir; açılış + yerel etki = güncel hesap = defter kanıtı gerekir. Bilinmeyen, doğrulanmamış ve karantinadaki tutarlar sıfır yapılmaz. Kaynak 30 Eylül 2026 kesimidir; bugünkü Vega verisi değildir.

Kullanıcı 5 Ekim'de İlker için TEST tedarikçi **görüntüleme ve düzenleme** erişimini açıkça istedi. Yalnız mevcut tek üyeli TEST rol16'ya `supplier.view` ve `supplier.edit` eklendi; kullanıcı/credential veya diğer 134 izin kaydı değiştirilmedi. Bu erişim LIVE veya gerçek ticari kartlarda test yazması yetkisi değildir.

İlk düzenleme yalnız mevcut sentetik `TEST-DAILY-PUR-S` kart13373'ün telefon, şehir ve ülkesidir. Kod/ad, döviz, iskonto, bakiye, kaynak kimliği, stok ve ticari hareketler değiştirilmez. Gerçek tedarikçi kartları salt okunur kalır. Telefon en fazla40, şehir/ülke100 UTF16 birimidir; NULL ve boş metin ayrılır. Tam içerik/UUID kaydedilir; aynı istek ek etki oluşturmaz. Değişen kart sürümü409 ile reddedilir; row_version revizyona dahil olduğundan A→B→A değişimi eski isteği yeniden geçerli yapmaz.

Mevcut audit_logs korumasına sahte ürün/fiş kaydı eklenmez. Yalnız bu fixture/actor/işlemi tutan yeni `test_supplier_contact_requests` geçmişi, gerçek önce/sonra sürümü ve yanıtı saklar. Eski guardlar ve mühürler korunur. Kaydedilmiş geçmiş değiştirilmez; geçmiş kayıt sayısı yeni düzenlemeyi engellemez. Kaynak code/build sonucu personel kabulü sayılmaz.

## Personelin deneyeceği beş adım

1. [Tedarikçiler](http://127.0.0.1:5194/is-akisi-taslagi.html#suppliers) ekranında bildiğiniz kod/adı arayın; aktif/pasif ve sayfa geçişini deneyin.
2. Gerçek kartın ayrı TRY/USD/EUR hesaplarını açın. Doğrulanmış borç/alacak ile bilinmeyen/kayıtlı fakat doğrulanmamış tutarı ayırt edin; dövizler toplanmamalı.
3. Karantina filtresindeki bir kartı açın. Gerekçe görünmeli; bu karttan ticari işlem veya düzenleme yapılmamalı.
4. İlker TEST hesabında `TEST-DAILY-PUR-S` arayın. Telefon/şehir/ülkeyi değiştirip kaydedin, aynı kaydı tekrar doğrulayın ve yeniden açın. Sonra orijinal Bilinmiyor değerlerini geri kaydedin. Gerçek kartlarda bu denemeyi yapmayın.
5. [1440/1024/390 görünümü](http://127.0.0.1:5194/responsive-acceptance.html) üzerinden arama, kart aç/kapat ve düzenleme alanlarını deneyin. Yetkisiz hesapta tedarikçi verisi gösterilmemeli; boş sonuç ve hata örnek veriyle doldurulmamalı.

## Teknik kanıt ve kalan kabul

Gerçek HTTP, normal ekran kaydetme/yenileme/geri yükleme, olumsuz SQL denemeleri, üç genişlik, paket ve nihai CI sonucu bu kaydın sonraki güncellemesinde doğrulanacaktır. Şu an tamamlandığı iddia edilmez.

Doğrulanan ilk okuma:530 native kartın25 satırı ve90 native karantina kartı; tüm530 kart migration kabulü değildir. Kaynak495 tedarikçi/503 hesap projeksiyonu998 kayıtla mühürlüdür.94 kaynak hold'un4'ü hedefsizdir. Gerçek10160 kartında bir kanıtlı ve bir doğrulanmamış hesap;13045 UNKNOWN/karantina,10182 karantina,13373 kaynakla eşlemesiz/hesapsızdır.

İlk karantina filtresi30sn zaman aşımı verdi. Aynı dört kimlik eşlemesinin bir defa hesaplandığı geçici projeksiyonla filtre25satır699ms oldu; kart ayrıntıları172–440ms. Kaynak/mühür ve engel kuralları korunur. Reader hash `D750DDCD6B3F4AEDBDC9A38C5347DED081961A6018505559D2F7D50014404C0B`; önceki C06 okuyucusu değişmedi.

Genel C07 PARTIAL: gerçek ticari kart düzenleme kapsamı, personel günlük kullanım kabulü, fiziksel telefon/terminal ve güncel Vega delta/cutover kabulü açık. Personel kabulü/tarih: Henüz bulunamadı. Main merge veya LIVE deploy yok.
