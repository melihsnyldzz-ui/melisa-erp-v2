# Goal8 — ERP/CRM bağlantılı taslak regresyonu

7 Ekim 2026. [Bağlantılı CRM kanıtı](crm-connected-proof.json), aynı prova gününün ayrılmış sentetik müşterisi için mevcut CRM katalog → çeviri → native sipariş taslağı → replay → bağımsız GET zincirini doğrular. Bu CRM aşaması, native geri okumayla tamamlanan dokuz aşamalı sentetik ERP gününe aynı gün/müşteri kimliğiyle bağlandı: `technicalPass:true`, `fullDayVerified:true`. Goal8 kapsamında CRM kodu, CRM paketi veya çalışan CRM servisi değiştirilmedi; gerçek mesaj gönderilmedi, atama veya rol değiştirilmedi. İnsan/fiziksel kabul hâlâ `humanAccepted:false`.

## Çalışan kimlik ve kapsam

CRM source `77a2fa346b4c3653b77e33625e185c1259402af7`, paket `crm-test-77a2fa346b4c3653b77e33625e185c1259402af7`; manifest SHA256 `ccdaab18c33973ef5a7e95e28f696fb8ff0426c41c339faefc00bf9eb9929b31`. Önceki salt okunur startup/manifest/süreç karşılaştırması 62400/62401/62402/62403 üzerindeki bu immutable paketi doğruladı. CRM health200, authMode `crm-local`, mevcut provider/bridge readiness true. Native62404: `CRM-ORDER-DRAFT-TEST-20261006-05`, source `0940c49f3c90bc365955d3e2f64fb5b541f0717d`, purpose `crm-order-draft-only`; kanonik TEST DB, sysadmin0, databaseControl0 ve LIVE erişimi0 kimlikleri korunur.

Günün tamamlandığı ERP kimliği TEST92, source `a4a05b2b3cdbb89fe2423bb14b1452b7a299fa45`, packageId `CANONICAL-TEST-a4a05b2b3cdb`. Aynı günün başlangıç mühürü source `67c82ab698b6e9771a764c18ca012e6c26f9f4aa` üzerindeydi; kaydedilmiş continuation mühürü kalan aşamaları TEST92 kimliğine bağlar. CRM taslak aşaması mevcut `77a2fa` CRM / `0940c49` bridge üzerinde korunur. Gerçek T1 ve normal API'de FINAL cutover context aktivasyonu gelecekteki ayrı kesim adımlarıdır.

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

Tam sentetik ERP gününün dokuz aşaması native teknik kanıtla tamamlandı: baseline, mal kabul, alış, aynı alınmış stoktan satış, tahsilat, ödeme, sayım, iade ve günlük rapor. Aynı gün/müşteri30598 üzerinde CRM taslak10 ayrıca teknik olarak doğrulandı; CRM teklif ürünü30740, operasyon zincirindeki mal kabul/satış/iade ürünü325503'ten ayrıdır. Kök gün kanıtının yayımlanacak [day-proof.json](day-proof.json) kaydı bu teknik sonucu ve aynı gün bağını taşır; mevcut özel `day-result.json` kaydında `remaining:[]`, `nativeTechnicalPass:true`, `technicalPass:true`, `fullDayVerified:true`, CRM `technicalVerified:true` ve `humanAccepted:false` bulunur. Telefon/Zebra/personel geniş kabulü ve insan PASS bekler. Gerçek T1, normal FINAL API aktivasyonu, hold kaldırma, ticari cutover veya LIVE geçişi yapılmış sayılmaz.

Özel ham kayıtlar: `C:\Sirket\ERP\evidence\ERP-GOAL8-20261007\private\day-result.json`, `crm-day-stage-applied.json`, `crm-day-request.json`, `crm-day-product.json` ve önceki `crm-readonly.json`. Token, credential, alıcı bilgisi, müşteri metni/adı veya ham sohbet bu belgeye taşınmadı. Bu güncelleme yalnız kanıt kaydıdır; SQL/runtime/source veya Git işlemi çalıştırmaz.

## Son okuma paketi — TEST94

Son TEST94/source `cee7d7a85b4c797732cfcba8967855f2efbad55b` 45normal ekran,13rol ve7rapor geri okuması tamamlandı. Yukarıdaki native günün TEST90→92 yazma kanıtı tarihsel olarak korunur; gün yeniden çalıştırılmadı. [Ana teslim](README.md), [runtime](runtime-proof.json), [ekran](ui-proof.json), [hız](performance-proof.json). CRM kaynak/rol/provider değişmedi; insan kabulü ve gerçek FINAL aktivasyonu bekler.
