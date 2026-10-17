# Yeşil Sites / kanonik API / gerçek TEST SQL kabulü

## Sonuç ve kapsam

2026-10-03T18:45:46.597Z. Paket `3eb36e70fddbbf4ff3a090e560153b5bfba7b3b8`, `C:/Sirket/ERP/releases/CANONICAL-SITES-SQL-TEST-20261003-02`.
Yeşil Sites kabuğunun örnek denetleyicisi, önceden kabul edilmiş SQL denetleyicileriyle değiştirildi. Gerçek kullanıcı girişi ve API yetkileri geçerlidir. TEST ERP yazıcısı yalnız ayrı TEST DB’ye erişir; SQL trigger korumaları ve uygulama kapsamı ticari/diğer kayıtları korur. Native yazımı, dış entegrasyonlar, otomatik işler ve LIVE erişimi kapalıdır.

Bu, mevcut ayrılmış TEST kayıtlarında gerçek SQL etkisi kabulüdür. Tüm normal ticari kartlar ve Sites'ın her taslak özelliği için sınırsız kullanım kabulü değildir. Yeni fiyat/kart yazımları veya çok satırlı ayrıntılı alış editörü eklenmedi; fiziksel terminal kabulü yapılmadı.

## Gerçek etkiler

| Akış | Kanıt / sonuç |
|---|---|
| Satış | Stok -1, cari +100 TRY; aynı requestId tek fiş; istemci fiyat enjeksiyonu ve çelişen retry reddedildi. API ve gerçek ekran PASS. |
| Satış iptali | Kaynak korunur; stok/cari geri gelir, ikinci iptal ikinci etki üretmez. Ekran yenilemesi sonrası da SQL’de aynı. |
| Mal kabul / alış | Pending kabul stok değiştirmez; fiziksel onay +1 adet, borç yok. Bağlı fatura +60 TRY borç, ikinci stok girişi yok. Fatura iptali fiziksel malı stokta tutar. API ve ekran PASS. |
| Tahsilat | TRY/USD/EUR: cari işlem kuru snapshot karşılığı kadar azalır, seçilen kasa/banka işlem dövizinde artar; iptal asıl snapshot’la geri alır. TRY ekran kabulü de PASS. |
| Dövizli cari | USD ve EUR tahsilatı USD cariye dört ondalık kayıtlı kurla işler; ters kayıt asıl snapshot’ı korur. Kur kaynak/zamanı kayıtlıdır. |
| Tedarikçi ödeme / dönüş | TRY/USD/EUR: ödeme borcu/kasayı azaltır; asıl ödeme bağlantılı para dönüşü alacağı azaltır/kasayı artırır. Tekrar ve iptal tek etkili; stok değişmez. |
| İadeler | Müşteri iadesi stok +1/cari -100; tedarikçi iadesi stok -1/borç -60. Özgün fiş fiyatı/maliyeti korunur; iade iptali etkisini geri alır. |
| Sayım | Taslak etkisiz; yetkisiz onay reddedilir; +1 fark tek hareket; ters kayıt asıl etkisini geri alır. Araya hareket giren eski fingerprint reddedilir. |
| Fiyat / maliyet | SQL kanıtı okunur; satış fiyatını istemci değiştiremez. Bilinmeyen maliyet 0/kâr uydurulmaz; doğrulanmış 60 TRY maliyetin kâr hesabı mevcut kabul testiyle PASS. |

Gerekli transaction desteği, actor kaydı, trigger uyumlu OUTPUT INTO ve kabulden faturalama bağlantı kontrolleri eski TEST düzeltmelerinden seçilerek alındı. Eski TEST’in tarihsel belge/maliyet raporlarını değiştiren diğer farkları körlemesine taşınmadı. Yeni iş kuralı veya DB migration uygulanmadı.

## Kontroller ve düzeltme

- 354 Sites testi + 27 seçili kanonik test PASS.
- 31 gerçek API/SQL kontrolü PASS: [SQL kabulü](real-workflow-acceptance.json).
- 8 gerçek ekran yazma kontrolü PASS: [tarayıcı kabulü](browser-write-acceptance.json).
- 16 ekran / 0 JavaScript hatası: [ekran kontrolü](sites-sql-browser.json).
- 32 son smoke PASS; 1085 paket dosyasının hash’i, üç süreç/paket kimliği, kapalı native/dış yazımlar, egress, 254 LIVE hash’i, üç sunulan LIVE dosyası, 587 kirli ağaç kaydı: [son smoke](final-sql-smoke.json).
- Tek loopback IP’ye uygulanan 300 istek/15 dakika limiti, normal ekran yenilemelerini kesiyordu. Yalnız canonical TEST’te 1000 istek/60 saniye sınırı tanımlandı; 320 ardışık okuma ve ardından gerçek ekran akışı PASS. LIVE limitleri değişmedi.
- Eski beş toplam satış denemesi kotası doluydu. SQL/audit geçmişi korunarak beş açık TEST fişi sınırına çevrildi; iptal edilmiş fişler yeni denemeyi engellemez. SQL’in isim/tutar/stok korumaları aynı kaldı. Diğer mevcut TEST kotası/kimlik sınırları korunur.

## Kalıcılık, koruma ve geri dönüş

Launcher: `C:/Sirket/ERP/runtime/start-canonical-test.ps1`; eski TEST launcher aynı girişe delegasyon yapar. Önceki launcher/paketler korunur. API 4144, native 4146 ve web 5194 yalnız loopback’te açılır. LIVE süreçleri 31820/33624/40828 aynı kaldı; yeni TEST süreçleri 21380/17064/17224.

Kabul satış/tahsilat/ödeme/iade/sayım hareketleri silinmedi; mevcut servislerle ters kayıt yapıldı. Mal kabul #4 fiziksel TEST kabulü olarak korunur (+1 adet); bağlı kabul fatura #25080 iptal edilmiş durumda. Bu kaydı silmek veya uydurma stok dengelemesi yapmak yerine audit izi korundu. Önceki kabuller ve diğer ticari kayıtlar değiştirilmedi.

Geri dönüş, yalnız doğrulanmış TEST sahiplerini durdurup korunmuş önceki paketi/launcher’ı seçmektir; SQL kabul tarihçesi silinmez. Güncel paketten sonra kaynakta yalnız test/dokümantasyon commitleri vardır; çalışan ticari dosyalar paketteki commit ile aynıdır.

DB’deki son kur tarihi 2026-09-12’dir. Hesap ve snapshot doğruluğu kanıtlandı; bu kurun bugün için işletme onaylı/güncel olduğu varsayılmadı. Fiyat kartı değişikliği, ayrıntılı alış taslağı ve native fiziksel kabul için PASS verilmedi.

## Kalan tek kabul işi

Personelin ayrı TEST oturumuyla yeşil ekranda günlük sırasını gözden geçirmesi. Bunun ardından LIVE geçişi ancak ayrı açık onayla değerlendirilir; bu çalışma LIVE dağıtımı yapmadı.
