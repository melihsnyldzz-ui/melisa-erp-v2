# Toplu Stok Kartı Oluşturma

## Amaç

Toplu Stok Kartı ekranı, alış faturası satır düzenine benzer bir çalışma alanında en fazla 100 yeni ürün kartının birlikte hazırlanmasını sağlar. CSV veya Excel zorunluluğu yoktur.

## İş Akışı

1. Kullanıcı stok kodu, barkod, ürün adı, marka, kategori, ana tedarikçi, para birimi, alış ve satış fiyatını doldurur.
2. `Veritabanını Kontrol Et` işlemi yalnızca okuma yapar.
3. Sistem aynı listedeki ve veritabanındaki stok kodu/barkod tekrarlarını kontrol eder.
4. Ana tedarikçinin aktif ve mevcut olduğu doğrulanır.
5. Bütün satırlar uygunsa `Kartları Kaydet` düğmesi açılır.
6. Satırlardan biri değişirse önceki kontrol geçersiz olur ve kayıt düğmesi tekrar kapanır.
7. Kayıt işlemi bütün kartları tek SQL transaction içinde oluşturur. Bir satırda hata olursa hiçbir kart kaydedilmez.

Stok kodu veya barkod yazılırken 400 ms bekleme sonrasında ayrıca anlık kimlik kontrolü yapılır. Mevcut bir değer bulunursa diğer zorunlu alanların doldurulması beklenmeden ilgili giriş alanı kırmızıya döner, satır uyarı verir ve mevcut ürün kartını açma bağlantısı gösterilir.

Ana tedarikçi alanı mevcut tanımdaki tam `kod / ad` etiketiyle, yalnızca tedarikçi koduyla veya tam tedarikçi adıyla eşleşebilir. Ön kontrol hatası oluşursa teknik sebep yalnızca araç ipucunda saklanmaz; satırın durum hücresinde açıkça gösterilir.

Toplu kart ekranında marka, kategori ve ana tedarikçi mevcut seçeneklerden seçilmelidir. Marka seçildiğinde mevcut aktif ürün kartlarından markanın en sık kullanılan kategorisi ve ana tedarikçisi satıra otomatik getirilir. Ana tedarikçi seçildiğinde tedarikçi kartında kayıtlı para birimi yeni stok kartının para birimine uygulanır. Kullanıcı bu değerleri kaydetmeden önce değiştirebilir ancak yeni tanım yine mevcut seçeneklerden biri olmalıdır. Serbest tanım açılması gerekiyorsa önce Tanımlar veya tekil Ürün Kartı akışı kullanılmalıdır.

## Açılış Stoğu

Açılış stoğu sıfırdan büyükse ürün kartıyla aynı transaction içinde `stock_adjustment` kaynaklı stok hareketi oluşturulur. Muhasebe dönemi kilidi kontrol edilir. Böylece stok miktarı doğrudan ve izsiz değiştirilmez.

TRY dışındaki kartlarda açılış hareketinin kaynak para birimi ve birim fiyatı saklanır. Geçerli kur bilgisi olmayan yeni kartın TRY maliyet değeri sıfır kalır; gerçek maliyet değerlemesi alış faturası veya kur bilgili operasyonla yapılmalıdır.

## Yetki ve Denetim

- Ön kontrol ve kayıt uçları `product.edit` yetkisi ister.
- Her ürün için `product_created` denetim kaydı yazılır.
- Toplu işlem için ayrıca `products_bulk_created` denetim kaydı yazılır.
- Arayüz, oluşturulan kartları doğrudan açmak için bağlantı gösterir.
