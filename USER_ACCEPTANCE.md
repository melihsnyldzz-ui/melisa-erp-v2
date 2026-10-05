# ERP kullanıcı kabulü

Kullanıcının **normal ekranda gözle denemesi** ve kendi sonucu burada tutulur. Teknik test, ajan tarayıcı provası veya CI PASS kullanıcı kabulü değildir; teknik kanıt [STATUS.md](STATUS.md) içindedir. Ayrıntılı kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), sıra [DELIVERY_BOARD.md](DELIVERY_BOARD.md). Sonuçlar yalnız `bekliyor / PASS / FAIL`; kullanıcı veya kullanıcı kabulünü açıkça doğrulayan kaynak olmadan PASS yazılmaz.

Her sonuçta kişi, tarih, TEST adresi/ortamı, denenen paket/commit ve kanıt bağlantısı eklenir. Bilinmeyen değer `Durum doğrulanmadı` kalır; mevcut URL/PID geçmiş kayıttan güncel sayılmaz. Kabul edilen kapsam değişirse aynı satırdaki geçmişi silmeden yeni deneme kaydı eklenir. Henüz hazır olmayan deneme kullanıcıya hazır diye sunulmaz.

## Yeni/değişen kapsam

5 Ekim performans teknik denemesi: ERP-UA02 için paket40/sourcedf3de90 ile 50 satırlı normal ekran, kod/ad/leading-zero barkod/sayfalama/kart/stok/satış fiyatı ajan tarafından doğrulandı; STATUS'ta gerçek süreler ve son ilk393ms/35sn boşta sonrası ölçümler ayrıdır;39paketilk1353ms ara ölçümü korunur. Bu kayıt insan sonucunu PASS yapmaz. Fotoğraf işi başlatılmadı.

| ID / iş | Kullanıcının gözle deneyeceği şey | Sonuç | Kişi / tarih / ortam-sürüm / kanıt |
| --- | --- | --- | --- |
| ERP-UA01 / ERP-D01 | TEST'i aç ve yenile; TEST ADMIN oturumu ve normal çalışma yüzü kullanılabilir olsun. | bekliyor | Kullanıcı/deneme tarihi: Durum doğrulanmadı. Mevcut teknik hazırlık: [TEST ADMIN kaydı](docs/erp-v2/canonical-20261005/test-admin-acceptance.md); insan sonucu bu satırda bekler. |
| ERP-UA02 / ERP-D02 | Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) ekranını aç/yenile; kodla ara ve gerçek kartı aç; başında sıfır olan barkodla ara; stok/satış fiyatı/döviz/birim/kademeyi kaynakla karşılaştır; inceleme bekleyen kartın fiyat göstermediğini ve eksik fotoğraf alanını gör. | bekliyor | Güncel performans teknik hazırlığı 2026-10-05, paket40/sourcedf3de9054cbeb80419976cede6a26f12b1c16e94; önceki normal katalog paketi38/source7db0685 korunur. Ajanın gerçek ekran/üç genişlik kontrolü STATUS'ta; insan kişi/tarih/sonuç Durum doğrulanmadı. [v1 kaynak sözleşmesi](docs/erp-v2/canonical-20261005/working-catalog-contract.md). |
| ERP-UA03 / ERP-D03 | Salt okunur arşiv/eşleme planındaki doğru, belirsiz ve eksik ürün örneklerini incele; planın kabulünü belirt. | bekliyor | Durum doğrulanmadı |

## Önceki kapsamın kabul kayıtları

Önceki teknik/kullanıcı kanıtları [finish tree](ERP_FINISH_PLAN.md) ve bağlı modül kabul belgelerinde korunur. Bu kurulum hiçbir eski maddeyi PASS veya FAIL yapmaz; aynı kanıt buraya kopyalanmaz. Yeni görsel denemeler gerektiğinde ilgili iş ID'siyle buraya eklenir. Personel ve fiziksel terminal kabulü teknik TEST sonucu ile kapatılmaz.
