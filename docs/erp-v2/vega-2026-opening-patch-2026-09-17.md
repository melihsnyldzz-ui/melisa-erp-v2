# Vega 2026 açılış bakiyesi düzeltmesi

İşletme sahibinin 17.09.2026 tarihli kesin kuralı: 01.01.2026 cari açılışında
Vega devir kaydı esas alınır. 2020–2025 hareketleri değişmeden kalır. Eski
hesaplanan kapanışla fark, her cari ve döviz için ayrı bir
`Vega 2026 Devir Düzeltmesi` hareketi olarak kaydedilir. Döviz çevrimi yapılmaz.

## Uygulanan TEST patch'i

- Run: `devir2026-20260917-01`.
- Hedef: `Semih\MELISADEV / MELISA_ERP_FULL_TEST_20260916`.
- Durum: `COMMITTED_OPENING_PATCH_REVIEW_REMAINS`. Commit korundu; rollback yok.
- 1.040 mevcut cari+döviz hesabı tarandı. Kaynak açılışı tanımlı 324 hesabın
  170'inde fark vardı. 85 müşteri ve 85 tedarikçi hesabına ayrı native cari
  hareketi eklendi. Bu 324 hesapta patch sonrası açılış farkı 0.
- Kaynak açılışı bulunmayan 716 mevcut hesap düzeltme dışında inceleme listesinde:
  189'unda geçmişten hesaplanan kapanış sıfır değil, 527'sinde sıfır.
  Açılış kaydı yokluğu sıfır bakiye kanıtı olarak kullanılmadı.
- Ayrıca iki müşteri açılış satırının `LL` döviz kimliği USD/EUR/TRY olarak
  yorumlanmadı. Bu iki kayıt ve 716 hesap, toplam 718 patch karar kaydında tutuldu.
- Kaynak 2026 açılış satırları F0102'de 147, F0103'te 179. 326 satırın 324'ü
  tanımlı dövizle hesaplara bağlı; 2'si `LL`. İptal açılış satırı yok.

PAKEL USD (cari hesap 974): geçmiş kapanış `37102.78770591`, kaynak açılış
`37265.26003454`, eklenen düzeltme `162.47232863`. Düzeltme native tedarikçi
hareketi `47861`; kaynak cari açılış satırı
`VEGA2026/F0103/D0007/F0103D0007TBLCARIHAREKETLERI/244`, başlığı
`VEGA2026/F0103/D0007/F0103D0007TBLSTKGIRBASLIK/226`.

## Hesaplama ve denetlenebilirlik

`vega-2026-opening-model.mjs`, tarihi 01.01.2026 ve IZAHAT 103/104 olan kaynak
cari satırlarını açılış adayı kabul eder. Başlık eşleştirmesi, iptal durumu,
kaynak hash'i, tek hesap eşleşmesi ve döviz/rate bilgisi ayrıca doğrulanır.
İleri tarihli 103/104 fişleri ve tip 90 işletme belgeleri bu açılışa eklenmez.
2026 hareketleri geçmiş kapanış hesabına katılmaz.

Fark = kaynak açılışı − (2026 öncesi etkin hareketler + zaten etkin olan aynı
2026 açılış satırları). Sonraki yıllık devirler `affects_balance=0` ise tekrar
sayılmaz. Bakiye hassasiyeti `decimal(28,8)` / BigInt 8 basamaktır.
Yerel cari kartının dört basamaklı özet alanı ayrıca güncellenir; kesin döviz
bakiyesi `party_currency_accounts.current_balance` içinde tutulur.

170 düzeltme `customer_movements` / `supplier_movements` içinde
`movement_type=vega_journal`, `document_date=2026-01-01`, `affects_balance=1`
olarak yazıldı. İşlem adı `source_document_no` ve `source_notes` içindedir.
Sabit `VEGA2026-OPENING-ALIGNMENT/<party_entity_id>/<currency>` anahtarı ikinci
kaydı önler. 170 `document_links` kaydı düzeltmeyi özgün kaynak cari açılış
satırına bağlar. Hareket payload'ı önceki kapanışı, beklenen açılışı, farkı ve
özgün kaynak hash'lerini içerir. Kasa/banka hareketi üretilmez.

`migration_decisions` ve `migration_runs` kayıtları patch run kimliğiyle
filtrelenebilir. JSON alanları MCP politikası gereği kapalı olduğundan karar
nedeni, kaynak anahtarı ve run durumu tipli alanlarda da bulunur. Ayrıntılı hesap
listesi özel yerel `plan.json` içinde korunur.

## Güvenlik ve kanıt

Vega canlı bağlantısında yalnız SELECT kullanıldı; 326 açılış satırı ve dört
başlık tablosundaki ilgili kayıtlar iki kez okunup donmuş kaynakla eşleştirildi.
Kaynak kimliği ve nesne seviyesinde SELECT-only yetki denetlendi. TEST yazıcı
süreci Vega bağlantısı açmaz. Canlı ERP bağlantısı yoktur.

Yeni COPY_ONLY/CHECKSUM yedeği RESTORE VERIFYONLY ile doğrulandı:
`8E087506-17FB-4FE0-8491-E1AB7CC70C67`, 6.587.715.584 bayt. Restore yapılmadı.
Yazıcı yalnız kesin TEST kimliğini kabul eder ve SERIALIZABLE transaction,
uygulama kilidi, kaynak/plan hash'i ve koruma manifesti ile çalışır.

Önceden mevcut tüm müşteri/tedarikçi hareketlerinin bütün alan hash'leri aynı
kaldı. Terminal fişleri 10059/10060/10061, satırları, stok/cari hareketleri ve
kuyruk kayıtlarının ortak hash'i değişmedi:
`d1205b7c8b7a61fa617fa64be1a0faf108ca6692ddf9199c1574f8a11b6d8509`.
Düzeltme dışındaki hesap bakiyeleri değişmedi. İkinci `--commit-test` çalışması
0 ek yazma ile döndü. Beş model testi geçti; commit sonrası kayıt kontrolü geçti.

Gerçek bağlı Yeni ERP MCP üzerinden patch run kaydı ve PAKEL düzeltmesi okundu.
Bu işlem açılış patch'inin uygulama kontrolüdür; tam migration'ın bağımsız
Vega ↔ ERP karşılaştırması veya canlıya geçiş kabulü değildir.

Kanıt klasörü: `%LOCALAPPDATA%\MelisaERPServer\migration-spec\devir2026-20260917-01`.
Kaynak kontrolü, plan, yedek makbuzu, hareket/terminal manifestleri, commit,
tekrar çalışma, commit sonrası doğrulama ve bağlı MCP okuma çıktıları burada.

## Komutlar

Yeni plan/kaynak kontrolü/yedek çıktı dosyaları mevcutsa üzerine yazılmaz.
Başarılı patch tekrar çalıştırıldığında yeni düzeltme üretmez.

```powershell
node apps/api/scripts/vega-2026-opening-plan.mjs
node apps/api/scripts/vega-2026-opening-source-check.mjs
node --test apps/api/scripts/vega-2026-opening.test.mjs
node apps/api/scripts/vega-2026-opening-patch.mjs --backup
node apps/api/scripts/vega-2026-opening-patch.mjs --commit-test
node apps/api/scripts/vega-2026-opening-patch.mjs --verify
```
