# Dövizli alış kabulü — 4 Ekim 2026

C03'ün dar sentetik TEST teknik provası tamamlandı; genel alış ve personel kabulü bekliyor. Normal fiyat ekranı kabul edilmiş kart alış fiyatını, ayrı ana birim kanıtını ve tarihli kur kayıtlarını kullanır. Kaynak 30 Eylül kesimidir; güncel Vega fiyatı değildir. Yazma yalnız `TEST-DAILY-PURCHASE` ürün301986 ve TRY tedarikçi13373 içindir. USD40/EUR45/TRY1, 4 Ekim tarihli sentetik prova kurlarıdır; piyasa kuru değildir. En fazla 5 tam ADET ve 200 TRY; gerçek ticari kartlarda yazma açılmadı.

## Personelin beş denemesi

[Alış faturaları](http://127.0.0.1:5194/is-akisi-taslagi.html#purchases) · [Fiyat ve maliyet](http://127.0.0.1:5194/is-akisi-taslagi.html#prices) · [Üç genişlik görünümü](http://127.0.0.1:5194/responsive-acceptance.html).

Mevcut İlker TEST oturumunu kullanın. Kabul35'e bağlı fatura25089 / `TDAY-FXQ-35ac3cf790fb02f04994` kalıcı taslak olarak hazır: 1 ADET, 1,1000 EUR, 49,5000 TRY. Başlangıç deneme stoğu29 ADET, kayıtlı ortalama maliyet63,9242 TRY, tedarikçi borcu60 TRY. Şifre bu belgede yoktur.

1. Hazır taslağı inceleyin. Kaynak fiyatın8 basamağını, fiş fiyatının4 basamağını, ayrı işlem/cari kurlarını, 4 Ekim tarihini ve doğrulanmış ADET×1 birimini kontrol edin. Bilinmeyen maliyet sıfır görünmemeli.
2. Sayfayı yenileyip taslağı tekrar açın. SQL'den aynı kayıt gelmeli; stok ve borç değişmemeli.
3. Taslağı kesinleştirin. Borç60→109,50 TRY olmalı; stok29 ve maliyet63,9242 yeniden değişmemeli.
4. Aynı faturayı gerekçeli iptal edin. Orijinal kurla borç60 TRY'ye dönmeli; fiziksel stok29 kalmalı. Sonucun tekrar kontrolü ikinci etki üretmemeli.
5. Üç genişlik görünümünde1440/1024/390 seçin. Alış ve fiyat ekranlarında kaynak/kur/işlem butonlarını okuyup kullanın. Başka bir sentetik kabulü gerekçeli reddetmek stok/borç oluşturmamalı. İnsan kabulü için kişi/tarih ve gözlenen sorunlar kaydedilmelidir.

## Gerçek TEST kanıtı

- Normal ekran EUR kabul32: pending stok26/borç60 etkisiz; onay stok27/ortalama59,6111, borç60. Fatura25087 SQL'de kalıcı1,1000 EUR/49,5000 TRY taslak olarak yenilemede döndü. Normal ekranda kesinleştirme borç60→109,50, iptal→60; stok ikinci kez artmadı.
- Normal API USD kabul33: onay stok27→28/ortalama64,4393, borç60. Native fatura25088 toplam4,8700 USD/194,8000 TRY. Kesinleştirme60→254,80, iptal→60; stok28/maliyet64,4393 sabit. Create/approve/draft/finalize/cancel beş aynı istek tekrarında ek etki0. İlk finalize satır-sayısı hatası bütünüyle rollback oldu; düzeltmeden sonra aynı belge ve işlem kimliğiyle devam edildi.
- Normal ekran EUR kabul35 stok28→29/ortalama63,9242, borç60; fatura25089 kalıcı taslak ve borç0. Kabul36 gerekçeli ret: stok29/maliyet63,9242/borç60 aynı. Dört kabulün üçü onaylı, biri reddedildi; üç native faturanın ikisi iptal, biri taslak.
- 12 gerçek olumsuz API yanıtı: oturumsuz401, seller403, yanlış tarih/adet/exact fiyat/kur sürümü, istemciden kur hash'i, farklı içerikli UUID, kısa ret/iptal gerekçesi, geçerli önizleme hash'iyle200 TRY üstü kabul ve aynı kabulden ikinci taslak. Başarılı ticari etki0. Ayrı dört rollback SQL denemesi: immutable kur/kaynak, sahte journal tutarı ve gerçek stok-after kanıtı olmadan hareket51072 ile reddedildi.
- Bağımsız SQL kontrolü:17 yeni/15 eski guard etkin ve hash eşleşti;42 önceki tanım/37 FIRST/karantina ve açılış mühürleri aynı. İki kaynak fiyat8/native4 ve üç kur snapshotı doğrulandı. Tam3 fiziksel stok hareketi/+3 ADET, fatura kaynaklı stok0; tam4 borç/ters kayıt toplam0. Yeni kayıtların actor/fixture/birim/fiyat/kur bağında sapma0. Önceden mevcut24 ticari ve finans tablosunun tam satır count/digest'i aynı; yeni finans/kasa/banka/satış/müşteri/iade hareketi0.
- Son kaynak `2751fac7093013798f8035c462dcab51b8663163`: API250/Sites382/canonical27 offline test ve build PASS. Bağımsız backend/native/SQL incelemeleri tamam; source2751fac push+PR quality-build-test/secret-scan dört hosted job SUCCESS. Nihai belge head'inin CI sonucu teslimde ayrıca kontrol edilir.
- Gerçek çalışma ekranı iframe genişliği1440/1024/390 ölçüldü; client/scroll aynı1427/1011/377 (dikey scrollbar farkı). Alış taslağı ve gerçek kaynak önizlemesi okunaklı; yatay sayfa taşması0, mobil işlem butonları klavyeyle erişilebilir. Dış ekran görüntüsü ölçeklenir; PNG boyutu1440 viewport kanıtı olarak kullanılmaz. Diğer modüller, fiziksel telefon/terminal ve personel kabulü bu iki ekran kontrolü değildir.

## Çalışan paket ve geri dönüş sınırı

TEST paket21 `CANONICAL-FINISH-PURCHASE-FX-TEST-20261004-21`, uygulama source2751fac,1163 dosya manifest eşleşti. Launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`; web5194/API4144/native4146 → `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Kısıtlı yazıcının sysadmin/control/LIVE erişimi0; native salt okunur, dış işler kapalı. Paket18/19/20 ve launcher kayıtları korunur; checkout deployment sayılmaz. LIVE süreç sahipleri aynı; LIVE commit doğrulanmadı. Main merge, LIVE restart/deploy veya Vega yazması yapılmadı.

SQL companion `F882CB378FA2A486B1F827953701A4CA38BC9ACDB5BC65C48F86C61952B5B741`: ilk gerçek kurulum ve aynı kurulumun tekrarında ek yazma0. Ayrı COPY_ONLY/CHECKSUM yedeği ve RESTORE VERIFYONLY geçti; restore/committed rollback provası yapılmadı. Başarılı deneme geçmişi schema silerek geri alınmaz. İptal fiziksel stok iadesi değildir; mal iadesi ayrı akıştır. Ham SQL, kaynak kart bilgileri, özel erişim ve API kanıtları yerel private evidence alanında kalır.

[Tek finish tree](../../../ERP_FINISH_PLAN.md) · [Önceki C01/C02 kabulü](purchase-batch-acceptance.md) · [Draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Genel typed fiyat yazımı, tüm cari dövizleri/birim dönüşümleri, gerçek ticari alış ve personel kabulü açık. Sıradaki tek kaynak işi C06: gerçek müşteri kartı.
