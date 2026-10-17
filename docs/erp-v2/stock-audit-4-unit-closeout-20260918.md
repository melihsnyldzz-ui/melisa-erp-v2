# STOCK-AUDIT-4 — ADET kararı ve candidate kapanışı

**Sonuç: PASS.** Run ID: `STOCK-AUDIT-4-UNIT-20260918-01`.

İşletme, `8031 MURAT BABY` birimini ADET olarak doğruladı. Kaynak ürün `102503`, ERP ürün `296542`, kaynak eşlemesi `35324`. Vega kartı, önceki TEST kanıtı ve yeniden okunan candidate stoku **20**; fark **0**. Kayıt `UNKNOWN` sınıfından `HISTORICAL_ONLY_DIFFERENCE` sınıfına taşındı.

## Uygulanan kapsam

Yalnız `Semih\MELISADEV / MELISA_ERP_PROD_CANDIDATE_20260917_01` üzerinde `product_source_aliases.unit_status` alanı bir satırda `REVIEW` → `VERIFIED` değişti. Ürün kartının birimi zaten ADET idi; kart ve miktar değiştirilmedi. Ham Vega ADET/M2 kaynak kanıtı korunuyor. Karar `269021`, audit `115784` kaydıyla izlenebilir; kararın yetki kaynağı işletmenin bu görevdeki açık talimatıdır.

Yeni stok/cari/finans hareketi **0**. Birim doğrulama çalıştırıcısı Vega, `MELISA_ERP_V2` ve kabul edilmiş TEST'e bağlantı açmadı. LIVE-3 kabul kontrolü kaynakları yalnız salt okunur sorguladı. TEST'teki eski REVIEW metadatası değiştirilmedi; STOCK-AUDIT-4 raporu işletme kararını ayrı kanıt olarak kullanıyor.

## Son sınıflandırma

| Sınıf | Önce | Sonra |
|---|---:|---:|
| HISTORICAL_ONLY_DIFFERENCE | 4.449 | 4.450 |
| REAL_CURRENT_STOCK_MISMATCH | 100 | 100 |
| UNKNOWN | 1 | 0 |
| Diğer üç sınıf | 0 | 0 |
| Toplam | 4.550 | 4.550 |

100 aktif üründeki toplam 1.034 adet fark korunmuş 10059, 10060, 10061 satış fişleriyle açıklanıyor. Açıklanamayan güncel fark **0**. Bu satış etkileri için yeni stok girişi oluşturulmadı.

## Ekonomik etki kontrolü

16 ekonomik tablonun tüm satırları id sırasıyla karşılaştırıldı. Ham `source_payload_json` dışındaki bütün sütunlar (kaynak hash alanları dahil) SHA-256 kontrolüne dahil. İşlem öncesi/sonrası içerik hash'leri ve satır sayıları aynı. SERIALIZABLE işlem içinde kontrol edildi; commit sonrasında yeni bağlantıyla bağımsız okuma da aynı hash'i verdi.

| Kontrol | Önce | Sonra | Fark |
|---|---:|---:|---:|
| Ürün | 49.447 | 49.447 | 0 |
| Ürün stok kontrol toplamı (karma birimler) | 635.592,75 | 635.592,75 | 0 |
| Negatif stoklu ürün | 1.889 | 1.889 | 0 |
| Stok hareketi | 554.186 | 554.186 | 0 |
| 8031 MURAT BABY (ADET) | 20 | 20 | 0 |

| Bakiye türü | Döviz | Önce | Sonra |
|---|---|---:|---:|
| Cari | EUR | 750834.27298898 | 750834.27298898 |
| Cari | TRY | 772957.83655563 | 772957.83655563 |
| Cari | USD | 1612223.42528273 | 1612223.42528273 |
| Finans | EUR | 1336299.33520000 | 1336299.33520000 |
| Finans | TRY | -296574039.13050000 | -296574039.13050000 |
| Finans | USD | 7534076.97220000 | 7534076.97220000 |

Dövizler birbirine çevrilmedi ve birbiriyle toplanmadı. Kontrol toplamları stok değerlemesi değildir.

## Kabul ve geçiş durumu

- Ön kontrol: PASS, yazma 0.
- Candidate birim kararı: PASS, metadata 1 + karar 1 + audit 1.
- Bağımsız yeniden okuma: PASS, yeni ekonomik etki 0.
- Sınıflandırma sınır testleri: 9/9 PASS.
- LIVE-3 salt okunur kabul kontrolü yeniden çalıştırıldı: PASS. Şema farkı 0, açıklanamayan stok farkı 0, 1.044 cari/döviz hesabında fark 0, terminal kabul hash'i korundu.
- Önceden kabul edilmiş STOCK-AUDIT-3: 131 ürün / 12.464 adet; yeni düzeltme uygulanmadı.
- **GO_LIVE_BLOCKER: 0. Production switch readiness: PASS**, LIVE-3 tanımlı kabul kapsamı ve bu birim kararının dahil edilmesi açısından.

Production switch yapılmadı; mevcut bağlantılar değiştirilmedi. Rol girişleri ve finalize/iptal testleri önceki LIVE-3 kanıtından alındı; ekonomik etki yaratmamak için yeni yazma smoke testi yapılmadı. Bu karar genel production checklist'indeki bütün altyapı maddelerinin kapatıldığı anlamına gelmez. LIVE-3 planındaki 13 miktarı belirsiz kayıt ayrı kapsamda aynen korunmuştur; bu rapordaki UNKNOWN=0 yalnız 4.550 kayıt içindir.

## Kanıtlar ve geri alınabilirlik

- [Kalıcı kabul kanıtı](../operations/stock-audit-4-unit-closeout-20260918.json): tablo sayıları/hash'leri, önce/sonra bakiyeler, karar/audit kimlikleri ve LIVE-3 kabul hash'i.
- [Ayrıntılı rapor ve ilk 30 örnek](../../outputs/01a0b0b7-24d2-7290-b159-cac85eb51c52/STOCK-AUDIT-4-RAPOR.md).
- [Güncellenen Excel](../../outputs/01a0b0b7-24d2-7290-b159-cac85eb51c52/STOCK-AUDIT-4.xlsx).
- `artifacts/stock-audit-4-unit-20260918/`: `before.json`, `receipt.json`, `independent-verification.json`, `acceptance.json`, `business-unit-decision.json`; önceki rapor/Excel `original/` altında korunur.
- `artifacts/live3-runtime-signoff-20260917/acceptance.json`: yeniden doğrulanmış LIVE-3 kabulü.

Çalıştırıcı varsayılan olarak dry-run'dır. Yazma yalnız `--apply-approved-unit` ile, tam candidate/server/ürün/eşleme/miktar kontrolleri ve beklenen REVIEW durumu doğrulanınca açılır. İkinci apply reddedilir; `--verify` salt okunur karar ve ekonomik etki doğrulamasıdır. İşlem içi uyuşmazlık rollback üretir. İşletme kararı ileride geri alınırsa yalnız aynı metadata alanı yeni bir açık talimat ve yeni audit/karar kaydıyla geri çevrilir; mevcut karar ve audit silinmez, ekonomik düzeltme yapılmaz.
