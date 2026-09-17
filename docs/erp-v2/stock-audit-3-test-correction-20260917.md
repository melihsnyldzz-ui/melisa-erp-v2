# STOCK-AUDIT-3 — onaylı TEST uygulaması

**Sonuç: PASS — onaylı 131 ürün ve bu uygulamanın oluşturduğu yeni stok farkları.**

**Genel Vega hareket bakiyesi = TEST bakiyesi koşulu: FAIL.** Uygulamadan önce mevcut olan, onaylı kapsam dışındaki 4.550 ürün farkı devam ediyor. Bunların bu düzeltmelerle açıklanabildiği veya genel stok mutabakatının tamamlandığı iddia edilmez.

Hedef: Semih\MELISADEV / MELISA_ERP_FULL_TEST_20260916. Run: `stock-audit-3-20260917-01`. Kullanıcının STOCK-AUDIT-3 mesajı, donmuş STOCK-AUDIT-2 paketinin yalnız TEST uygulaması için açık onaydır. Paket SHA-256: `6aacc8a3567e14b127525993ad254c82a2b6d38b27f3dd2e48883aadfbbed708`.

| Kontrol | Gerçek sonuç |
|---|---:|
| Uygulanan ürün / bağımsız hareket / audit kaydı | 131 / 131 / 131 |
| Toplam stok düzeltmesi | +12.464 adet |
| Negatif stoğu azalan ürün | 55 |
| Negatif adette azalma | 7.088 adet |
| Sıfır veya pozitife gelen | 45 |
| Düzeltme grubunda hâlâ negatif | 10 |
| Tüm TEST ürünlerinde negatif ürün: önce → sonra | 1.934 → 1.889 |
| Yeni negatif ürün | 0 |
| Cari / finans etkisi | 0 / 0 |
| Yeni alış faturası / yeniden finalize | 0 / 0 |
| Mevcut maliyet alanlarında değişiklik | 0 |
| Duplicate stok etkisi | 0 |
| Açıklanamayan yeni stok farkı | 0 |
| 29 AMBIGUOUS ürün | Tamamı korundu |
| 5500 BERÇO | 0 düzeltme; 62 adet korundu |

## İşletme kararlarının gerçekleşen etkisi

| Ürün | Önce | Düzeltme | Sonra | Hareket ID |
|---|---:|---:|---:|---|
| 68873 MİNİKİDS | -3200 | +3200 | 0 | 902931 |
| 1584 PAKEL | -411 | +551 | 140 | 902932 |
| 057 PAKEL | -319 | +511 | 192 | 902933 |
| 051 PAKEL | -303 | +471 | 168 | 902934 |
| 1579 PAKEL | -247 | +411 | 164 | 902936 |

PAKEL dört model toplamı +1.944; mevcut 36 adet ikinci kez eklenmedi.

## Audit ve muhasebe sınırı

Her kayıt ERP'nin mevcut `movement_type=adjustment`, `source_type=stock_adjustment` biçimiyle bağımsız bir hareket olarak kaydedildi. İş anlamı `MIGRATION_STOCK_CORRECTION`, hem native audit action alanında hem hareketin source_notes JSON'unda saklandı. Şema/enum veya web yetkisi genişletilmedi.

Her hareketin source_payload_json alanında ürün kimliği, stok kodu, marka, düzeltme miktarı, F0103 belge/satır kimlikleri, belge tarihi, kaynak tedarikçi, alış miktarı, F0102 gerçek giriş miktarı, dağıtılmış giriş bağlantıları ve fark bulunur. Audit kaydı önce/sonra bakiyeyi, hareket kimliğini, kullanıcı onayını ve run referansını içerir. Hareket tarihi uygulama tarihidir; geçmiş alış tarihleri kaynak kanıtında ayrıca korunur.

Fatura/cari bağlantısı kurulmadı. Maliyet ve tutar alanları NULL bırakıldı; bilinmeyen maliyet sıfır olarak üretilmedi, ürünün mevcut maliyeti değişmedi. Ürün kartındaki miktar ile etkin hareket bakiyesi birlikte arttı; bu iki değer ayrı stok girişi değildir. Tekil source_record_key mevcut veritabanı indeksi ile korunur.

## Gerçek doğrulama

- COPY_ONLY + CHECKSUM TEST yedeği alındı; RESTORE VERIFYONLY ve yedek başlığı kontrolü başarılı. Yaklaşık 6,66 GB.
- 161 kapsam ürünü için güncel ürün eşlemesi, satır sürümü ve başlangıç bakiyesi paketle eşleşti.
- 49.447 TEST ürününün önce/sonra kontrolünde yalnız onaylı 131 miktar değişti. Kapsam dışındaki ürünlerin satır sürümü ve güncelleme tarihi de korundu.
- 31 korunan tablonun satır bazlı SHA-256 özetleri ve eski stok hareketlerinin özeti değişmedi. Cari, finans, alış/satış faturaları ve satırları, iadeler, açılış kayıtları, ürün fiyatları ve terminal kuyruğu buna dahildir.
- İşlem içi kontrol sonrasında commit yapıldı. Ayrı bağlantıyla işlem sonrası veri tekrar okunarak aynı sonuç doğrulandı.
- Aynı paket tekrar çağrıldı: ALREADY_APPLIED, 0 insert, 0 ek miktar.
- Vega alış, hareket, ürün ve birim verileri işlem öncesi/sonrası aynı SHA-256 değerlerine sahip. Vega yetkileri SELECT=1; INSERT/UPDATE/DELETE/ALTER/EXECUTE=0.
- 17 koruma testi ve JavaScript sözdizimi kontrolleri geçti.
- Terminal TEST 4133 ve görüntüleme API'si 4134 sağlıklı; süreçleri değiştirilmedi.
- Başarılı TEST değişiklikleri geri alınmadı. Canlı ERP bağlantısı açılmadı.

## Vega karşılaştırmasının kapsamı

48.542 F0102 ürün eşlemesinin tamamında şu eşitlik sağlandı: **TEST sonrası − TEST öncesi = onaylı düzeltme**. Yeni açıklanamayan fark 0. Onaylı 131 üründe ayrıca **TEST sonrası − Vega gerçek hareket bakiyesi = onaylı düzeltme**.

Buna karşılık daha önce mevcut 4.550 fark bu run'ın sonucu değildir. Bu grubun 4.450 ürününde D0007/2026 hareketi yok; 4.454 ürünün TEST bakiyesi Vega stok kartı bakiyesiyle eşleşiyor. Bu alt gruplar örtüşür, toplanmaz. Kart bakiyesi ile dönem hareket bakiyesi birbirinin yerine kullanılmadı. Genel farklar ayrıca incelenmeden tüm ERP için tam Vega mutabakatı PASS sayılamaz. Kapsam dışı bakiye düzeltmesi yapılmadı.

## Kalıcı kanıtlar ve yeniden kontrol

- [Onaylı paket ve 131 ürün kanıtı](../operations/stock-audit-3-approved-package-20260917.json)
- [Sonuç, audit hareketleri ve karşılaştırma hash'leri](../operations/stock-audit-3-verification-20260917.json)
- Yerel ayrıntılar: artifacts/stock-audit-3-20260917/{before,after-independent,commit-receipt,replay-receipt,vega-reconciliation,source-immutability}.json. Ham veri, yedek, günlük ve çalışma zamanı dosyaları Git commit'ine alınmaz.
- Salt okunur tekrar kontrol: `node apps/api/scripts/stock-audit-3-test.mjs --verify`. Yerel STOCK-AUDIT-2/3 kanıt dosyaları gereklidir. `--commit-test` mevcut commit-attempt kaydı varken tekrar çalışmaz.
- Yeniden uygulama yerine mevcut commit-receipt ve veritabanı audit kayıtları kontrol edilmelidir. Başarılı run için otomatik rollback yoktur.
