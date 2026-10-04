# CRM taslağı ve kabul edilmiş açılış fiyatları

Bu çalışma mevcut CRM taslak sözleşmesini güncel ERP ürün/fiyat kimliğiyle uzlaştırır. Günlük ERP servisi ve mevcut taslak kayıtları korunur. Gerçek kullanım sonucu ve tam teslim HEAD'i `STATUS.md` ve CRM reposundaki `CRM_STATUS.md` içinde ayrı kaydedilir; bu sözleşme belgesi kullanıcı kabulü değildir.

## Sınır ve veri sahibi

- Veri sahibi ERP'dir; CRM yalnız mevcut HTTP adapteri üzerinden bağlanır. CRM içinde SQL yazıcısı veya ikinci ürün/fiyat veritabanı yoktur.
- Ayrı native servis `127.0.0.1:62404`, amaç `crm-order-draft-only`; CRM UI/API `62400/62401`, adapter `62403`.
- Veritabanı yalnız `MELISA_ERP_SIRKET_TEST_20260929_01`; mevcut TEST scoped-sales principal kullanılır. LIVE, Vega yazımı, finalize, rezervasyon, stok ve cari hareketi kapsam dışıdır.
- Ticari TEST kabulü yalnız önceden izin verilen 7733 / konuşma55 / sentetik müşteri593 kapsamındadır. Genel müşteri eşlemesi ve günlük kullanımın bütünü bu dar kabulden tamam sayılmaz. Başka müşteriye yazışma veya ticari kayıt için ayrıca açık kapsam gerekir.

## Kesin eşleme

Yeni taslak, kabul edilmiş `VEGA-OPENING-TEST-20261004-06` açılışının ürün alias'ı ve typed satış fiyatını kullanır. Kaynak ürün kimliği, native ürün/fiyat kimliği, ana birim, satış kademesi1, para birimi, adet birimi ve birim faktörü1 birlikte doğrulanır. Native BIGINT kimlikleri kayıpsız ondalık metindir. İsim benzerliği, eski scalar satış fiyatı veya örtük kur dönüşümü eşleme değildir.

Kaynak exact8 fiyat native exact4 alana `HALF_UP` ile projekte edilir. CRM'in mevcut kayıtlı adet fiyatı aynı projeksiyon ve para birimiyle eşit olmalıdır. Açılış 30 Eylül kaynağıdır; bugünkü canlı stok veya fiyat olduğu varsayılmaz. Kaynak/catalog farkı varsa işlem durur; kaynak seal veya ürün fiyatı uyum sağlamak için değiştirilmez.

Ürün ve müşteri karantina denetimi native kimliklerle, yeni taslağın transaction'ı içinde uygulanır. Aktörün güncel CRM yetkisi ve konuşma erişimi HTTP await sonrasında tekrar okunur; native `sales.view/sales.create` yetkileri korunur. Fiyat ekranının farklı `product.view/purchase.view` izinleri otomatik eklenmez.

## Tekrar deneme ve eski kayıtlar

Mevcut UUID, aktör, payload fingerprint ve taslak readback sözleşmesi korunur. Mevcut başarılı UUID önce okunur; yeni ürün eşleme kapısı eski kabul edilmiş taslağın okunmasını engellemez. Aynı UUID ve farklı payload çakışmadır. Belirsiz ağ sonucunda yeni UUID ile otomatik tekrar oluşturma yoktur.

Yeni satırlar tek transaction'da yazılır ve ardından ERP'den geri okunur. Sonuç yalnız `draft`, `stockEffect:false`, `ledgerEffect:false` olarak kabul edilir. Çok satırlı deneme mevcut CRM katalog seçimi ve formundan yürütülür; ikinci sipariş mimarisi kurulmaz.

## Kaynak, kurulum ve geri dönüş

Native paket ayrı, committed/clean ERP kaynak HEAD'inden üretilir; manifest tüm payload/dependency dosyalarının hash'lerini ve Node kimliğini kapsar. Özel config repo dışında kalır. Günlük ERP paketleyicisi ve onun 4144/4146/5194 launcher'ı bu native servis için kullanılmaz.

Typed kapsam kurulumu eklemelidir: önceki prosedür tanımlarının gerçek hash'leri ve salt okunur gerçek eşleme kanıtı açık girdidir. Tahmini baseline kabul edilmez. Eski taslak/request satırları silinmez; önceki prosedür tanımı/hash'i geri dönüş için tutulur. Installer kendiliğinden SQL'e bağlanmaz veya migration çalıştırmaz. Kurulum yalnız doğrulanmış named TEST hedefinde, bağımsız inceleme ve teslim kontrollerinden sonra yürütülür.

Somut before/after recovery yalnız context/create yordamlarını değiştirir. Önceki CREATE başlığı mevcut nesneye uygulanırken yalnız ALTER olarak normalize edilir; orijinal tanım/hash ve normalize recovery hash ayrı doğrulanır. Değişmeyen read yordamı yeniden çalıştırılmaz. Bilinmeyen tanım veya hash farkında geri dönüş durur; veri silme ve otomatik DB restore yoktur.

Native sürüm değişiminde mevcut CRM launcher, port sahibi, process creation ve özel config/paket pinleri birlikte doğrulanır. Önceki native paket/config/kayıt korunur. Geri dönüş ticari kayıtları silmez ve otomatik DB restore yapmaz. Kod paketinin geri gelmesi yeni şemayla uyumluluk veya gerçek geri dönüş kabulü yerine geçmez.

## Kabul ölçütü

Normal CRM ekranından iki kesin ürün seçilir; adet, fiyat ve tek para birimi görülür. Kullanıcı mevcut ERP TEST hesabıyla giriş yapar. Yalnız TEST müşteri593 için taslak oluşturulur; iki satır ve toplam ERP readback'ten karşılaştırılır. Aynı UUID'nin yeniden okunması duplicate oluşturmaz. 390 genişlikte form ve readback incelenir; fiziksel mobil kabulü ayrıca kaydedilir. Build/unit/HTTP200 bu kabulün yerine geçmez.
