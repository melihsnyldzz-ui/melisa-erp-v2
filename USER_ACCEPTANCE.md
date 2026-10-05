# ERP kullanıcı kabulü

Kullanıcının **normal ekranda gözle denemesi** ve kendi sonucu burada tutulur. Teknik test, ajan tarayıcı provası veya CI PASS kullanıcı kabulü değildir; teknik kanıt [STATUS.md](STATUS.md) içindedir. Ayrıntılı kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), sıra [DELIVERY_BOARD.md](DELIVERY_BOARD.md). Sonuçlar yalnız `bekliyor / PASS / FAIL`; kullanıcı veya kullanıcı kabulünü açıkça doğrulayan kaynak olmadan PASS yazılmaz.

Her sonuçta kişi, tarih, TEST adresi/ortamı, denenen paket/commit ve kanıt bağlantısı eklenir. Bilinmeyen değer `Durum doğrulanmadı` kalır; mevcut URL/PID geçmiş kayıttan güncel sayılmaz. Kabul edilen kapsam değişirse aynı satırdaki geçmişi silmeden yeni deneme kaydı eklenir. Henüz hazır olmayan deneme kullanıcıya hazır diye sunulmaz.

## Yeni/değişen kapsam

| ID / iş | Kullanıcının gözle deneyeceği şey | Sonuç | Kişi / tarih / ortam-sürüm / kanıt |
| --- | --- | --- | --- |
| ERP-UA01 / ERP-D01 | TEST'i aç ve yenile; TEST ADMIN oturumu ve normal çalışma yüzü kullanılabilir olsun. | bekliyor | Durum doğrulanmadı |
| ERP-UA02 / ERP-D02 | Ürün & Stok'ta kod/barkodla ara, gerçek kartı aç; ad, stok, satış fiyatı ve para birimini kaynakla karşılaştır; eksik alan uydurulmuş görünmesin. | bekliyor | Durum doğrulanmadı |
| ERP-UA03 / ERP-D03 | Salt okunur arşiv/eşleme planındaki doğru, belirsiz ve eksik ürün örneklerini incele; planın kabulünü belirt. | bekliyor | Durum doğrulanmadı |

## Önceki kapsamın kabul kayıtları

Önceki teknik/kullanıcı kanıtları [finish tree](ERP_FINISH_PLAN.md) ve bağlı modül kabul belgelerinde korunur. Bu kurulum hiçbir eski maddeyi PASS veya FAIL yapmaz; aynı kanıt buraya kopyalanmaz. Yeni görsel denemeler gerektiğinde ilgili iş ID'siyle buraya eklenir. Personel ve fiziksel terminal kabulü teknik TEST sonucu ile kapatılmaz.
