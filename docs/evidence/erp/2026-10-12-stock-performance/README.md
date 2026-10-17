# ERP-COMPLETE01 — 200 satırlı stok kontrolü

12 Ekim 2026. Aynı onaylı ERP-COMPLETE01 kapsamı; kabul edilmiş satış ve migration tekrar edilmez. Bu kayıt yeni fiziksel satış veya insan kabulü değildir.

## Ölçülen darboğaz ve dar kapsam

Önceki salt okunur tanıkta aynı 200 stok hareketinin hold koşulu, aynı kaynak satırları ve aynı transaction içinde eski biçimde **48.072 ms**, tekil etkilenen kimliklerle **503 ms** sürdü. Hold sonucu aynıydı. Bu, yalnız koşul ölçümüdür; bütün satışın veya ekranın yeni süresi değildir. Önceki satış/fiş/koli kanıtı [korunur](../2026-10-11-completion/source-200-sale-proof.md).

Değişiklik yalnız `product_id`, `customer_id`, `supplier_id` ve `(source_type, source_id)` alanlarının aynı stok değişiminde tekrar kontrol edilmesini önler. `inserted` ve `deleted`, yedi hold koşulu, NULL/collation davranışı, kaynak/manifest/hash/kimlik/intent kontrolleri ve iç assertion korunur. Beş bağlı procedure, yeni stok trigger sürümünün tam hash zincirini tanır. Eski 185 manifest satırı ve V6–V10 kayıtları değiştirilmez.

## Gerçek native geri alma provası

ROOT tek SQL aktörüydü. SSPI bağlantısı yalnız `Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02`, copy `e16b70f0-4057-428b-9abc-6bbcaf35fe82` içindi. SERIALIZABLE transaction ve Exclusive copy lock ile frozen V2 uygulama adayı geçici olarak derlendi; sonra tamamı ROLLBACK edildi.

| Kontrol | Sonuç |
| --- | --- |
| Altı TR/P native definition ve hash | Exact |
| Mevcut objectId, parent, enabled, first/last trigger sırası | Korundu |
| 51 ticari tablo; güncel bütün kullanıcılar dahil | Aynı |
| 16 stage4 geçmiş/kontrol tablosu | Aynı |
| Altı ek karantina/supplier/migration geçmiş tablosu | Aynı |
| SQL grants, roller, principals, eski şema/index/FK/module metadata | Aynı |
| Rollback sonrası yeni registry ve immutable trigger | Yok |
| Kalıcı metadata / ticari yazma / rol-grant değişikliği | 0 / 0 / 0 |

Başlangıç ve rollback snapshot SHA256 aynı: `F5D7A952A965AC606E437205B535948F1BE6D577F0DD0986AE59D2C36B8490D7`.

Prova UTC 11:52:21–11:56:43 arasındadır. Private receipt `stock-predicate-v11-rehearse-20261012-115221-045-e8a0017f.json`, SHA256 `C9CCBC9525B4705728CFB21DAA6689480F0FF848C580B269AA76B2873916DA02`. Private helper SHA256 `616A1413A18E0F2E1412CD7A8816DC18D6237D8848865F0104EB1C934CCA9C0C`; artifact SHA256 `16E5C7BA86C2C71C6B9C8D0E0AAF97716E5C47D92762D697CFC381534D7AFB25`. Before-image ve ham SQL/private veri repo dışındadır; GitHub'a eklenmez.

ROOT bağlantısının READY çağrısı yalnız beklenen `51904/STAGE4_WRITER_REQUIRED` ile reddedildi. Bu, kısıtlı servis writer READY başarısı değildir. Receipt açıkça `applicationReady=false`, `normalWriterReadyVerified=false`, `metadataCommitted=false`, `humanAcceptance=false` taşır. Root'ta helper'ın 10 hedefli offline testi geçti; önceki frozen compiler incelemesinin 15 testi ayrı kanıttır.

Prova sonrası API4184 `/test-health` yine source `73f4b85597f2036e99c74efe22611a3b0ebedf43`, aynı copy ve `actualT1=false` bildirdi. Mevcut source73 paketi yeniden başlatılmadı veya değiştirilmedi. TEST125, eski cari/ürün aktarımları, LL dışlamaları, roller ve mevcut 200 satış korunur.

## Kaynak entegrasyonu ve kalan kapanış

V11 için exact private startupV6, canonical yeniden üretim, altı fresh native metadata tanığı ve önceki sürümlerin doğrulanmış tarih projeksiyonu kaynakta hazır; bağımsız inceleme GO. Dondurulmuş V2 ile bütün bundle/SQL/revision içeriği birebir; revision `5D69AF31C2DFC1119D6E5ACC03E259BD23E9789EF672B4DC3A2AFED3267FEF90`. 70 hedefli kontrolün 57'si geçti, 13 eski private kontrol varsayılan offline koşulda SKIP; bunlar PASS sayılmaz. Yeni 13 kontrolün tamamı geçti. Exact private input üzerinden ayrı modeled writer/reader qualification, startupV6, WeakMap artifact bağı, güncel read-proof ve trigger-order drift reddi de geçti; bu son testin native cevapları modeled'dır.

Mevcut V10 DB üzerinde yeni kaynakla ayrıca gerçek kısıtlı SQL bağlantıları çalıştırıldı: writer bootstrap ve READY, reader bootstrap başarılı; her iki transaction ROLLBACK, ticari/metadata yazma0. Writer makbuzu SHA256 `f43f1a6774cdff48746bde7bacf4e8ac0bec4e53331f1fa65932fa1c3d4e9aa2`; reader makbuzu SHA256 `019bffb097ca7e2975d2f94eaa6ce8985caf632716dc4b803221b43eb97b7331`. Private helper'ın reader için yanlış runtime kayıt fonksiyonunu kullanması review'de bulundu ve gerçek ayrı reader/writer kayıt yolları ile düzeltildi; dört hedefli kontrol bağımsız geçti. Kullanıcı girişine, HTTP/server başlatımına veya yeni işlem oluşturmaya gerek yoktu.

Reader/writer üzerinde zaten var olan DATABASE SELECT ve VIEW DEFINITION hakları salt okunur doğrulandı; yeni grant veya rol genişlemesi planlanmaz. **Yeni V11 native sürümü üzerinde** gerçek kısıtlı writer/reader başlangıç ve READY kontrolü hâlâ yapılmalıdır; mevcut V10 uyum kontrolü bunun yerine geçmez.

Kapanış sırası: kaynak test/bağımsız review → pinli paket ve metadata inverse hazırlığı → kontrollü ileri uygulama → kısıtlı writer/reader READY → normal API/ekran ve süre kontrolü. Bu adımlar olmadan hız düzeltmesi çalışan teslim sayılmaz. Aynı eski satış yeniden oluşturulmaz; uygun performans provası geri alınan transaction ile yapılır.

ERP-UA32 bekliyor; 49 toplam / 9 tamam / 39 kısmi / 1 açık sayımı aynı. Windows Semih istemci başlatımı için önceki policy reddi aşılmaz; bu bağımsız SQL/kaynak çalışması o GUI kabulünü tamamlamaz. LIVE/Vega/CRM/main/T1/gerçek müşteri/ücretli servis değişikliği yok.
