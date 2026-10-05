# ERP kullanıcı kabulü

Kullanıcının **normal ekranda gözle denemesi** ve kendi sonucu burada tutulur. Teknik test, ajan tarayıcı provası veya CI PASS kullanıcı kabulü değildir; teknik kanıt [STATUS.md](STATUS.md) içindedir. Ayrıntılı kapsam [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md), sıra [DELIVERY_BOARD.md](DELIVERY_BOARD.md). Sonuçlar yalnız `bekliyor / PASS / FAIL`; kullanıcı veya kullanıcı kabulünü açıkça doğrulayan kaynak olmadan PASS yazılmaz.

Her sonuçta kişi, tarih, TEST adresi/ortamı, denenen paket/commit ve kanıt bağlantısı eklenir. Bilinmeyen değer `Durum doğrulanmadı` kalır; mevcut URL/PID geçmiş kayıttan güncel sayılmaz. Kabul edilen kapsam değişirse aynı satırdaki geçmişi silmeden yeni deneme kaydı eklenir. Henüz hazır olmayan deneme kullanıcıya hazır diye sunulmaz.

## Yeni/değişen kapsam

**2026-10-05 ERP-UA03 kullanıcı kabulü — PASS:** Bu sohbetin kullanıcısı “Kullanıcı ERP-D03 fotoğraf eşleme planını kabul ediyor” diyerek 3315f3abd0c091512e03182112bd6bdc0168d16e teslimindeki planı kabul etti. Manifest kayıt SHA256: 5da967d2652aa0d6710ad206ac10b7a5898d5a8af7ff3f45e048669e15d22b6d. Kabul yalnız 3.830 CONFIRMED eşleme; 67 AMBIGUOUS ve 4620 LEYLEK karantinası dışarıda. ERP-D04 TEST kopyalama/metadata bağlama ayrıca bu mesajla yetkilendirildi; orijinaller korunur. Bu kabul uygulanmış fotoğraf ekranının insan kabulü değildir.

**2026-10-05 kullanıcı kabulü:** Bu sohbetin kullanıcısı “Kullanıcı normal `ornek-akis.html#stock` kataloğunu ve performansını kabul etti; ERP-UA02 sonucunu buna uygun şekilde kaydet.” talimatını verdi. ERP-UA02 **PASS**, kapsam normal gerçek katalog ve performans; denenen TEST paket40/source `df3de9054cbeb80419976cede6a26f12b1c16e94`, web5194/API4144. Kullanıcının kişi adı ve ayrı deneme saati bildirilmedi; kullanıcı kimliği bu sohbetin sahibidir. Fotoğraf bağlantısı, genel ticari/migration/cihaz kabulü veya ERP-UA01 bu PASS'e dahil değildir.

**Önceki ERP-UA03 inceleme hazırlığı:** [Fotoğraf eşleme planı](docs/erp-v2/canonical-20261005/photo-mapping-plan.md) ve [makine manifesti](docs/erp-v2/canonical-20261005/photo-mapping-plan.json). 3.897fotoğraf:3.830kesin/67belirsiz/0eşleşmeyen; ana görsel seçilmedi, orijinaller değişmedi, ürünlere yazılmadı. Kullanıcı planı görmeden ERP-D04/toplu bağlama başlatılmaz.

Önceki performans teknik denemesi: ERP-UA02 için paket40/sourcedf3de90 ile 50 satırlı normal ekran, kod/ad/leading-zero barkod/sayfalama/kart/stok/satış fiyatı ajan tarafından doğrulandı; STATUS'ta ilk393ms/35sn boşta sonrası ve39paketilk1353ms ara ölçümü korunur. Bu teknik deneme kendi başına insan PASS değildi; izleyen açık kullanıcı kabulü yukarıda ayrıca kaydedildi. O performans turunda fotoğraf işi başlatılmamıştı.

| ID / iş | Kullanıcının gözle deneyeceği şey | Sonuç | Kişi / tarih / ortam-sürüm / kanıt |
| --- | --- | --- | --- |
| ERP-UA01 / ERP-D01 | TEST'i aç ve yenile; TEST ADMIN oturumu ve normal çalışma yüzü kullanılabilir olsun. | bekliyor | Kullanıcı/deneme tarihi: Durum doğrulanmadı. Mevcut teknik hazırlık: [TEST ADMIN kaydı](docs/erp-v2/canonical-20261005/test-admin-acceptance.md); insan sonucu bu satırda bekler. |
| ERP-UA02 / ERP-D02 | Normal [Ürün & Stok](http://127.0.0.1:5194/ornek-akis.html#stock) gerçek katalog ve performansı. | PASS | Bu sohbetin kullanıcısının yukarıda alıntılanan açık kabulü;2026-10-05,TEST paket40/source df3de9054cbeb80419976cede6a26f12b1c16e94. Önceki teknik denemeler/38paketi ve performans kanıtı STATUS'ta korunur. İnsan adı/ayrı saat bildirilmedi. [v1 kaynak sözleşmesi](docs/erp-v2/canonical-20261005/working-catalog-contract.md). |
| ERP-UA03 / ERP-D03 | [Onaylanan eşleme planı](docs/erp-v2/canonical-20261005/photo-mapping-plan.md): 3.830 kesin kayıt, 67 belirsiz ayrı; orijinaller ve karantina korunur. | PASS | Bu sohbetin kullanıcısının yukarıda alıntılanan kabulü; 2026-10-05, plan commit3315f3abd0c091512e03182112bd6bdc0168d16e. ERP-D04 uygulaması ve yeni ekran kabulü ayrıdır. |

## Önceki kapsamın kabul kayıtları

Önceki teknik/kullanıcı kanıtları [finish tree](ERP_FINISH_PLAN.md) ve bağlı modül kabul belgelerinde korunur. Bu kurulum hiçbir eski maddeyi PASS veya FAIL yapmaz; aynı kanıt buraya kopyalanmaz. Yeni görsel denemeler gerektiğinde ilgili iş ID'siyle buraya eklenir. Personel ve fiziksel terminal kabulü teknik TEST sonucu ile kapatılmaz.
