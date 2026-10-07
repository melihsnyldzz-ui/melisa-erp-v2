# Goal8 — ERP/CRM bağlantılı taslak regresyonu

7 Ekim 2026. [Bağlantılı CRM kanıtı](crm-connected-proof.json), aynı prova gününün ayrılmış sentetik müşterisi için mevcut CRM katalog → çeviri → native sipariş taslağı → replay → bağımsız GET zincirini doğrular. Goal8 kapsamında CRM kodu değiştirilmedi, gerçek mesaj gönderilmedi, atama veya rol değiştirilmedi. Bu sonuç tam bağlantılı ERP iş gününün veya insan/fiziksel kabulün PASS kaydı değildir.

## Çalışan kimlik ve kapsam

CRM source `77a2fa346b4c3653b77e33625e185c1259402af7`, paket `crm-test-77a2fa346b4c3653b77e33625e185c1259402af7`; manifest SHA256 `ccdaab18c33973ef5a7e95e28f696fb8ff0426c41c339faefc00bf9eb9929b31`. Önceki salt okunur startup/manifest/süreç karşılaştırması 62400/62401/62402/62403 üzerindeki bu immutable paketi doğruladı. CRM health200, authMode `crm-local`, mevcut provider/bridge readiness true. Native62404: `CRM-ORDER-DRAFT-TEST-20261006-05`, source `0940c49f3c90bc365955d3e2f64fb5b541f0717d`, purpose `crm-order-draft-only`; kanonik TEST DB, sysadmin0, databaseControl0 ve LIVE erişimi0 kimlikleri korunur.

Final ERP paket90/source `67c82ab` hazırlanıyor. Aşağıdaki mevcut CRM/bridge taslak kanıtı, bu final pakette normal ERP/API/browser/CRM ile tamamlanmış bütün gün veya FINAL cutover aktivasyonu olarak sunulmaz.

## Aynı günün müşterisi, ayrı katalog ürünü

Prova günü `b5f7b5fd-5d45-472d-83c3-b95230e8ea8f`; sentetik TEST müşteri30598 ve native taslak10 aynı gün bağını taşır. Fiyat teklifi katalog ürün30740 içindir. Mal kabul ürünü325503 ayrı üründür: katalog teklifi alınmış malın satışı, rezervasyonu veya stoktan çıkışı değildir.

Taslak fiyatı kabul edilmiş native satış tuple'ından alınır: fiyat ID145899, kaynak birim100544, kademe1, USD `9.90000000`. Döviz ayrımı ve kaynak fiyat anahtarı korunur. Taslak kur alanı `1.00000000`, önceki Goal5 sentetik taslak sözleşmesindeki taslak varsayımıdır; Vega kuru, güncel piyasa kuru veya muhasebe etkisi değildir. Kaynağın tazelik engeli kaldırılmadı; bu teklif güncel Vega stok/fiyat taahhüdüne veya finansal belge yetkisine dönüşmez. <!-- gitleaks:allow public product source identifiers, not credentials -->

Ürün30740 fotoğrafı katalog provenance'ında `CONFIRMED`/verified; fotoğraf metadata SHA256 `b098cecb55a57d3800e4d90dcb73040028345ee14d7c8283f5fb70f7f29c3ec7`. Önceki aynı ürünün CRM ve doğrudan ERP üzerinden alınan preview bytes karşılaştırması eşitti: 26225bytes, sunulan preview SHA256 `43bd97f67f05695c3851a43da6b4ad0948fd949523f83719dc74e79608878119`. Metadata hash'i ve önceki sunulan preview bytes hash'i ayrı ölçümlerdir; geniş fotoğraf nüfusu yeniden kabul edilmiş sayılmaz.

## Gerçek çağrı ve geri okuma sonucu

| İşlem | Sonuç | HTTP süresi |
| --- | --- | --- |
| Yetkili prova sohbeti GET | 200; mevcut atama/oturum korunur | 751ms |
| ERP müşteri seçici GET | 200; aynı sentetik gün müşterisi | 743ms |
| Katalog ürün30740 GET | 200; typed USD fiyat ve fotoğraf bağlamı | 1042ms |
| Mevcut çeviri endpoint'i | 200, `openai-translation`, metin var, `autoSend:false` | 3457ms |
| Native taslak CREATE | 200; taslak10 | 775ms |
| Aynı request/body replay | 200; aynı taslak10, ikinci taslak yok | 310ms |
| Bağımsız taslak GET | 200; aynı müşteri/ürün ve etki bayrakları | 105ms |

Çeviri isteği gerçekten çalıştırıldı; yanıt otomatik gönderilmedi. `messagesSent:0`, `assignmentsChanged:0`, `rolesChanged:0`. Taslağın stok, cari/defter, tahsilat ve rezervasyon etkileri false olarak bağımsız GET'te doğrulandı. Öncesi/sonrası native ürün30740 ve325503 satırları, müşteri30598 satırı ve stok/müşteri/tedarikçi/finans hareket sayılarının hash karşılaştırması değişmedi: `nativeEffectsPreserved:true`. Native taslak kaydı oluşması dışında bu aşama stok veya finans hareketi üretmedi.

HTTP süreleri tek bu çağrıların ölçümüdür; ekran paint, telefon/Zebra süresi veya SLA değildir. Önceki salt okunur üç örneklemde sohbet medyan170ms ve fotoğraflı ilk50 katalog medyan1021ms idi; farklı aşamadaki bu çağrılarla performans regresyonu sonucu çıkarılmaz.

## Yetki sınırı ve kalan kabul

Yeni taslak10 mevcut yetkili CRM ve ERP oturumlarıyla oluşturulup geri okundu; rol veya atama değiştirilmedi. Önceki Goal5 taslak9 için farklı eski erişim yolunda alınan admin/v2 `404 CRM_V2_NOT_FOUND` ve legacy/personel `403 CRM_TEST_ACCESS_DENIED`, korunması gereken sahiplik/atama sınırıdır. Yeni pozitif prova bu eski taslağı başka aktöre açmaz ve önceki reddin aşılması değildir. Goal4/5'in [tarihsel kabulü](https://github.com/melihsnyldzz-ui/melisa-crm/blob/codex/crm-agents-on-completion-20261003/docs/evidence/crm/2026-10-06-goal5/README.md) korunur.

Tam ERP gününün mal kabul → aynı alınmış stoktan satış → iade → cari/kasa ve CRM zinciri, final ERP paket kimliği ve normal ekranlarla ayrı bağlanmalıdır; bu belge bunun tamamlandığını söylemez. Telefon/Zebra/personel geniş kabulü ve insan PASS bekler. Gerçek T1, hold kaldırma, ticari cutover veya LIVE geçişi yapılmış sayılmaz.

Özel ham kayıtlar: `C:\Sirket\ERP\evidence\ERP-GOAL8-20261007\private\crm-day-stage-applied.json`, `crm-day-request.json`, `crm-day-product.json` ve önceki `crm-readonly.json`. Token, credential, alıcı bilgisi, müşteri metni/adı veya ham sohbet bu belgeye taşınmadı. Bu güncelleme yalnız kanıt kaydıdır; SQL/runtime/source veya Git işlemi çalıştırmaz.
