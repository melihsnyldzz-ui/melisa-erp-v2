# Goal8 — ERP/CRM salt okunur regresyon

7 Ekim 2026. Mevcut Goal4/5 kabulü korunarak güncel çalışan paket üzerinde GET karşılaştırması yapıldı. Yeni mesaj, atama, çeviri isteği veya sipariş taslağı oluşturulmadı. İnsan/fiziksel kabul verilmedi.

## Güncel kimlik

CRM source `77a2fa346b4c3653b77e33625e185c1259402af7`, paket `crm-test-77a2fa346b4c3653b77e33625e185c1259402af7`; manifest SHA256 `ccdaab18c33973ef5a7e95e28f696fb8ff0426c41c339faefc00bf9eb9929b31`. Startup kaydı, manifest hash'i ve 62400/62401/62402/62403 dinleyen süreçlerin bu immutable paket yolları eşleşti. CRM health200; authMode `crm-local`; mevcut provider/bridge readiness true. Bu bilgi yeni gönderim kanıtı değildir.

ERP API4144: `CANONICAL-TEST-769031cb88de` / source `769031cb88de8ab26720266c62ce0e63d62d0877`; TEST86 release klasörü ayrı kimliktir. Native62404: `CRM-ORDER-DRAFT-TEST-20261006-05` / source `0940c49f3c90bc365955d3e2f64fb5b541f0717d`, purpose `crm-order-draft-only`. İki ERP health yanıtında kanonik TEST DB, sysadmin0, databaseControl0 ve LIVE erişimi0 doğrulandı. Normal TEST oturum bootstrap/login dışında POST yapılmadı; kullanıcı/parola/rol değiştirilmedi. <!-- gitleaks:allow public product source identifier, not a credential -->

## Güncel GET sonucu

| Okuma | Sonuç | HTTP süreleri |
|---|---|---|
| İzinli test sohbeti | 200; mevcut mesaj ve ek bağlamı okunuyor | 167 / 204 / 170ms; medyan170ms |
| Fotoğraflı ilk50 ortak katalog | 200; `melisa-catalog.v1` | 2048 / 1009 / 1021ms; medyan1021ms |
| Örnek ürün kartı | 200 | 336ms, tek örnek |
| CONFIRMED ürün fotoğrafı | 200; 26225bytes | 604ms, tek örnek |

Tek katalog örneğinde CRM ve doğrudan ERP: native ürün kimliği, stok kodu, barkodlar, birim,18 kayıtlı fiyatın exact değerleri/kaynak anahtarları ve TRY/USD ayrımı aynı. Kaynak `sourceAsOf` aynı; ürün fotoğrafı kaynak kimliği ERP provenance ile eşleşti. CONFIRMED fotoğraf bytes iki yoldan aynı; SHA256 `43bd97f67f05695c3851a43da6b4ad0948fd949523f83719dc74e79608878119`. Geniş ürün veya fotoğraf nüfusu yeni baştan kabul edilmiş sayılmaz. Kaynak30Eylül açılışı + yerel TEST hareketleridir; güncel Vega stok/teslim taahhüdü değildir.

Sohbet medyanı önceki Goal5 final208ms ile aynı ölçüm türünde; yeni170ms küçük üç örneklem sonucudur. Önceki selector759ms ile yeni fotoğraflı first501021ms eşdeğer filtre/faz kanıtı olmadığı için performans regresyonu iddia edilmez. HTTP süreleri ekran paint veya fiziksel cihaz SLA'sı değildir.

## Native taslak ve kalan sınır

Önceki Goal5 sentetik taslak9 için yeni CREATE yapılmadan GET denendi. Önce admin/v2 GET `404 CRM_V2_NOT_FOUND`; aynı eski UUID'nin legacy/personel GET'i `403 CRM_TEST_ACCESS_DENIED` verdi. İzinli test sohbetinin güncel ataması önceki kabul sonunda geri yüklenen aktördedir; prova personeli farklı aktördür. Erişim/atama değiştirilmedi ve bu reddin aşılması denenmedi. Bu tur mevcut personel/native oturumuyla taslak9'un pozitif geri okuması doğrulanmadı; önceki Goal5 independentGet/refreshGetOnly/replay kanıtı tarihsel kabul olarak korunur. Güncel pozitif kabul, konuşmaya zaten yetkili doğru CRM aktörü ve özgün ERP aktörüyle yalnız GET gerektirir.

Yeni çeviri, insan kontrollü paylaşım ve native CREATE zinciri bu salt okunur turda çalıştırılmadı; önceki [Goal5 kabulü](https://github.com/melihsnyldzz-ui/melisa-crm/blob/codex/crm-agents-on-completion-20261003/docs/evidence/crm/2026-10-06-goal5/README.md) yeni insan PASS değildir. Telefon/Zebra/personel geniş kabulü bekler. CRM taslağının stok/cari/finans etkisi yoktur; bu durum E02 mal kabulünden aynı stok ve kasa üzerinden geçen tam iş günü provası yerine geçmez.

Ham özel kanıt: `C:\Sirket\ERP\evidence\ERP-GOAL8-20261007\private\crm-readonly.json`. Token, credential, müşteri metni/listesi ve gerçek alıcı bilgisi bu belgeye alınmadı. İşletme yazısı0, mesaj gönderimi0, atama değişikliği0, yeni taslak0; servis/deploy/LIVE/Vega değişikliği yok.
