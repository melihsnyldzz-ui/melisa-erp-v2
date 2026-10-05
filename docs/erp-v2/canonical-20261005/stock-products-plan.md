# Sonraki teslim: ERP-1 / B02+A01 normal stok ekranı

5 Ekim 2026. C09 sonrası salt okunur kaynak keşfi; uygulama/SQL kurulum/kabul yapılmadı. Kaynak: bağımsız backend keşfi, mevcut kod ve ortak teslim haritası ERP-1. Genel ticari işlem kapsamını genişletmez.

Normal `#stock`, `testSales.js` içinde yalnız301984 deneme ürününü gösteriyor. Legacy `productRoutes/productService` ürün/barkod listesi var; scalar fiyat ve NULL→0 davranışı, birim/provenans/hold eksikleri nedeniyle doğrudan günlük kabul sayılmaz. Kabul edilmiş opening okuyucusu16622ürünü exact stok/nullable maliyet/typed fiyatlarla sunuyor; barkod/detay/hold eksik ve purchase.view şartı stok girişini sınırlar. Mevcut kabul edilmiş okuyucular değiştirilmeden ayrı salt okunur companion reader seçilir.

## En küçük işletme sonucu

Normal Ürün & stok ekranında kabul edilmiş kartların kod/ad araması, kesin barkod araması, aktif/pasif ve pozitif/sıfır/negatif stok filtresi,25satırlık sayfalama ve kart detayı. Barkod baştaki sıfırlarla string kalır; çoklu eşleşme seçim sunar. Sentetik kartlar ayrı açık kaynakla gösterilir. Kaynağı olmayan kart/birim/barkod veya görsel tahmin edilmez.

GET `/api/stock-products` ve `/:id`; stok kimliği/birim/barkod/görsel `product.view` ile. Fiyat/maliyet ayrı mevcut `purchase.view` yetkisiyle typed tuple/exact değer sunar; finans izni stok girişine şart olmaz. DTO nativeID string, kaynak bağları, kod/ad, nullable exact stok, birim/faktör kanıtı, provenance ve hold/reasons içerir. Kaynak30Eylül kabul edilmiş snapshot; native TEST stok okuma anı ayrı belirtilir. Güncel Vega veya LIVE stok iddiası yok.

## Sahiplik ve kabul

- API: yeni route/model/service/readStore. Legacy productService ve C03/C09 writer değiştirilmez.
- SQL: yeni salt okunur companion owner/readiness/proof; accepted kimlikleri, native ürün/barkod/görsel ve hold bağları. Eski mühür/procedure/guard değişmez; yalnız dar EXECUTE. Gerçek DB kurulumu root'ta, hedef kimliği doğrulandıktan sonra.
- Frontend: yeni stockProducts modülü ve normal dispatch. testSales ortak registration/navigation root'ta; aynı dosyada paralel yazma yok.
- Reviewer: bağımsız salt okunur kaynak/SQL/UI kontrat incelemesi. Plan/status/runtime/Git entegrasyonu root'ta.

Kabul: normal kod/ad+kesin barkod+detay, bilinmeyen/gerçek0/negatif stok, yetkiye göre finans, karantina nedeni/işlem engeli, arama/boş/hata/yetki,1440/1024/390 ve personel adımları. Bilinmeyen fiyat maliyet yerine geçmez; source/readiness hatası boş veya örnek listeyle doldurulmaz. Yeni reader actual hash/mühür kontrolüyle failclosed olur. Mevcut satış baseline'ı yeniden ispat işi açılmaz. Genel kart yazması, migration delta, LIVE ve terminal kabulü bu salt okunur dilim değildir.
