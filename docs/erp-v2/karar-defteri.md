# MELİSA ERP v2 — KARAR DEFTERİ

## 0. Amaç

Melisa ERP v2, Melisa Bebe’nin toptan bebek giyim operasyonunu yönetmek için geliştirilecek yeni nesil, masaüstü ERP hissi veren, web tabanlı ve ileride Electron ile Windows uygulamasına dönüştürülebilecek ERP sistemidir.

Bu doküman, kodlamaya başlamadan önce projenin ne olacağını, ne olmayacağını, hangi kurallarla ilerleyeceğini ve hangi modülleri içereceğini netleştirmek için hazırlanmıştır.

---

# 1. Ana Karar

## 1.1 Yeni ERP v2 Kararı

Mevcut proje öğrenme/prototip süreci olarak kabul edilir.

Yeni ERP v2:

- temiz mimariyle kurulacak,
- Vega/Wolvox gibi klasik yoğun ERP hissi verecek,
- web teknolojisiyle geliştirilecek,
- ileride Electron ile masaüstü programa çevrilebilecek,
- terminal uygulaması da v2 için baştan yazılacak.

## 1.2 Taşınacak Bilgi

Mevcut projeden doğrudan kod değil, şu kararlar ve iş mantıkları taşınacak:

- satış mantığı,
- alış mantığı,
- stok hareket mantığı,
- cari hareket mantığı,
- çoklu döviz kuralları,
- tedarikçi performans mantığı,
- import/toplu işlem mantığı,
- terminal sync/offline mantığı,
- yetki/audit kararları,
- katalog kararları,
- ERP görsel referansları.

---

# 2. Kullanıcılar

Ana kullanıcılar:

1. Patron / yönetici
2. Patron / kardeş
3. Muhasebe departmanı

Depo personeli web-admin kullanmayacak. Depo operasyonu Android terminal üzerinden yürütülecek.

---

# 3. UI / UX Kararları

## 3.1 Ana Görünüm

ERP v2’nin ana hissi:

- Vega/Wolvox gibi klasik yoğun ERP,
- yoğun tablo yapısı,
- az boşluk,
- çok bilgi,
- hızlı işlem,
- masaüstü program hissi.

Modern SaaS panel gibi geniş boşluklu, basit dashboard görünümü tercih edilmeyecek.

## 3.2 Çalışma Alanı

Web-admin şu yapıda olacak:

- üst modül menüsü,
- sol işlem paneli,
- orta çalışma alanı,
- pencere/modal mantığı,
- açık işler sekmeleri,
- alt durum çubuğu.

## 3.3 Pencere / Sekme Mantığı

- Detay ekranları büyük pencere/modal gibi açılacak.
- Açık işler sekme/tab gibi takip edilecek.
- Görüntüleme ekranları birden fazla açık kalabilecek.
- Fiş ekranlarında tek aktif işlem olacak.

## 3.4 Electron Hedefi

ERP v2 ileride Electron ile Windows masaüstü uygulaması haline getirilebilir.

Electron:

- sadece arayüz olacak,
- backend server/API tarafında çalışacak,
- API adresi uygulama içinden ayarlanabilecek.

---

# 4. Terminal App v2 Kararları

Terminal App v2 baştan yazılacak.

Terminal sade kalacak ama şu işleri yapacak:

- ürün/müşteri cache,
- barkod okutma,
- satış fişi oluşturma,
- offline queue,
- sync,
- stok sayım,
- ürün sorgulama,
- senkronizasyon durumu,
- ayarlar.

Terminal App ERP paneli olmayacak.

## 4.1 Terminal Login / Yetki

- Her terminal cihazı tek kullanıcıyla açık kalabilir.
- Yetki kullanıcı bazlı olacak.
- Aynı cihazda farklı kullanıcılar farklı yetkilere sahip olabilir.
- Terminal yetki rolleri daha sonra detaylandırılacak.

## 4.2 Offline Çalışma

Terminal internet yokken de çalışmaya devam edecek.

- Ürün/müşteri cache’den çalışacak.
- Fiş offline oluşturulacak.
- Offline stok kontrolü bilgi amaçlı olacak.
- Offline olmak satış akışını durdurmayacak.
- İnternet gelince otomatik sync olacak.
- Sync sırasında stok çakışması olsa bile kayıt kabul edilecek.
- Stok eksiye düşebilir.
- Eksi stok dashboard’da uyarı olarak gösterilecek.

---

# 5. Satış Kararları

## 5.1 Satış Fişi Oluşturma

Satış fişleri:

- terminalden oluşturulabilir,
- web-admin’den oluşturulabilir.

Satış fişi kesinleştiği anda stok düşer.

## 5.2 Satış Fiyatı

- Fiyat ürün kartından otomatik gelir.
- Para birimine göre doğru fiyat seçilir.
- Yetkili kullanıcı fiyatı değiştirebilir.
- Terminalde de fiyat değiştirilebilir ama yetkiye bağlıdır.
- Fiyat değişiklikleri audit’e düşmelidir.

## 5.3 Satış İskontosu

- Satışta sadece fiş geneli iskonto olacak.
- İskonto sadece yüzde olarak girilecek.
- İskonto yetkiye bağlı olacak.
- Tutar bazlı iskonto olmayacak.

## 5.4 Satış Fişi Taslakları

- Satış fişi taslak bırakılabilir.
- Gönderilmediği/kesinleşmediği sürece üzerinde çalışılabilir.
- Taslak fiş stok düşürmez.
- Taslak fiş cari hareket oluşturmaz.
- Taslak fiş kâr/maliyet kaydı oluşturmaz.
- Ticari etki sadece fiş kesinleştiğinde oluşur.

---

# 6. Alış Kararları

## 6.1 Alış Fişi Oluşturma

- Alış fişi web-admin’den girilecek.
- Alış fişini muhasebe işleyecek.
- Alış fişi kaydedildiği/kesinleştiği anda stok artar.
- Tedarikçi borcu oluşur.
- Cari hareket oluşur.

## 6.2 Alış Fiyatı

- Döviz/para birimine göre otomatik fiyat gelir.
- Muhasebe fiyatı değiştirebilir.

## 6.3 Alış İskontosu

Alışta:

- satır bazında iskonto olabilir,
- fiş geneli iskonto olabilir,
- tedarikçi genel iskontosu uygulanabilir.

## 6.4 Tedarikçi Anlaşmaları

Tedarikçi kartında tutulacak bilgiler:

- varsayılan para birimi,
- genel iskonto oranı,
- tedarikçi notu.

## 6.5 Kesinleşmiş Fiş Düzeltme

- Yetkili kullanıcı kesinleşmiş alış ve satış fişini `Düzenle` komutuyla açabilir.
- Düzeltme yeni iptal veya ters hareket oluşturmaz; mevcut stok, cari ve finans etkileri eski-yeni farkı kadar doğrudan güncellenir.
- Fişin müşteri/tedarikçi tarafı ve para birimi kesinleştikten sonra değiştirilemez.
- Ürün, miktar, fiyat, iskonto, tarih, fiş numarası ve açıklama düzeltilebilir.
- Her düzeltmede önceki ve sonraki fiş görüntüsü audit kaydına yazılır.
- Kapalı muhasebe dönemindeki fişler düzenlenemez.

---

# 7. Stok Kararları

## 7.1 Depo Yapısı

- Tek depo / tek merkez olacak.
- İşletme 7 katlı tek dükkândır.
- Kat/raf/konum takibi olmayacak.
- Sadece toplam stok takip edilecek.
- Terminal cihazları merkeze bağlı çalışacak.

## 7.2 Ürün Kartı Zorunlu Alanları

Ürün kartında zorunlu alanlar:

- stok kodu,
- barkod,
- ürün adı,
- marka,
- ürün tipi/kategori,
- para birimi,
- satış fiyatı,
- alış fiyatı,
- ana tedarikçi.

## 7.3 Ürün Para Birimi

- Hareket görmemiş ürünün para birimi değiştirilebilir.
- Hareket gördükten sonra para birimi değiştirilemez.
- Sadece ADMIN özel işlemle değiştirebilir.
- Bu işlem audit’e düşmelidir.

## 7.4 Ürün Silme

- Hareket görmüş ürün silinmez, sadece pasif yapılır.
- Hiç hareket görmemiş ürün sadece ADMIN tarafından silinebilir.
- Silme audit’e düşmelidir.

## 7.5 Pasif Ürün

- Pasif ürünler yeni fişlerde seçilemez.
- Kart listelerinde “pasifleri göster” filtresiyle görünebilir.
- Geçmiş raporlarda görünmeye devam eder.

---

# 8. Diğer Barkodlar

## 8.1 Genel Mantık

Ürün kartı altında “Diğer Barkodlar” bulunabilir.

- Ana barkod ve diğer barkodlar aynı ürün kartını bulur.
- Tüm barkodlar aynı ana ürün stoğundan düşer.
- Diğer barkodlar terminalde, web-admin aramada ve katalog aramada çalışır.

## 8.2 Yönetim

- Diğer barkodlar sadece manuel eklenip silinir.
- Excel/import ile toplu diğer barkod ekleme ilk aşamada yoktur.
- Barkod silinse bile geçmiş hareketler ürün kartında kalır.

---

# 9. Cari / Muhasebe Kararları

## 9.1 Kapsam

ERP tam muhasebe programı olmayacak.

Olacaklar:

- cari ekstre,
- satış hareketleri,
- alış hareketleri,
- ödeme,
- tahsilat,
- bakiye.

Olmayacaklar:

- resmi muhasebe fişi,
- hesap planı,
- beyanname,
- e-fatura/e-arşiv,
- çek/senet,
- kasa/banka modülü.

## 9.2 Müşteri Kartı Zorunlu Alanları

- müşteri adı,
- telefon,
- para birimi,
- müşteri tipi,
- şehir/ülke.

Telefon bilinmiyorsa “000” gibi geçici değer girilebilir.

## 9.3 Tedarikçi Kartı Zorunlu Alanları

- tedarikçi adı,
- telefon,
- para birimi,
- genel iskonto oranı,
- tedarikçi notu.

Telefon bilinmiyorsa “000” gibi geçici değer girilebilir.

## 9.4 Müşteri/Tedarikçi Silme

- Hareket görmüş müşteri/tedarikçi silinmez, sadece pasif yapılır.
- Hiç hareket görmemiş müşteri/tedarikçi ADMIN tarafından silinebilir.
- Pasif müşteri/tedarikçi yeni fişlerde seçilemez.

---

# 10. Çoklu Döviz Kararları

## 10.1 Temel Kural

- Stok kartının para birimi sabittir.
- Cari kartının para birimi sabittir.
- Fiş para birimi farklı olabilir.
- Dolar giren mal TL çıkabilir.
- TL giren mal USD/EUR çıkabilir.

## 10.2 Hesaplama

- Kâr TRY bazında hesaplanır.
- Maliyet TRY bazında tutulur.
- Fişte işlem anı kur snapshot’ı korunur.
- Geçmiş kur sonradan yeniden hesaplanmaz.

## 10.3 Alan Mantığı

- documentCurrency: fiş para birimi
- accountCurrency: cari kart para birimi
- amountTry: TRY karşılık
- averageCostTry: ürün ortalama maliyeti

---

# 11. Tedarikçi Performansı

Tedarikçi performansında görmek istenenler:

- bu tedarikçiden gelen ürünler,
- toplam alınan miktar,
- satılan miktar,
- elde kalan miktar,
- stok değeri,
- satış cirosu,
- toplam maliyet,
- brüt kâr,
- kâr oranı,
- son alış tarihi,
- son satış tarihi,
- tedarikçiye mevcut borç,
- para birimi bazlı borç,
- iyi/yavaş/zararlı ürünler.

Ürün kartında ana tedarikçi bulunacak.

Alış fişindeki tedarikçi gerçek alış hareketidir.

---

# 12. Katalog Modülü Kararları

## 12.1 Genel Mantık

Katalog, web-admin içinde ayrı bir ana modül olacak.

Menü önerisi:

- Katalog Oluştur
- Katalog Listesi
- Genel Kataloglar
- Müşteriye Özel Kataloglar
- Katalog Performansı
- Katalog Ayarları

## 12.2 İlk Faz Katalog İçeriği

- ürün görseli,
- stok kodu,
- WhatsApp butonu.

Sipariş/sepet/ödeme ilk aşamada olmayacak.

## 12.3 Fiyat Gösterimi

Katalog oluştururken seçilecek:

- fiyat göster,
- fiyat gizle.

## 12.4 Katalog Linkleri

- genel katalog linki,
- müşteriye özel katalog linki,
- kalıcı link,
- süreli link.

## 12.5 Stok Gösterimi

Katalog oluştururken seçilebilir:

- stok bilgisi gösterme,
- stokta var/yok,
- az/orta/çok,
- net adet,
- sadece stokta olanları göster.

Varsayılan genel katalogda stokta olan ve görseli olan ürünler tercih edilir.

## 12.6 Filtreler

Katalog oluştururken şu filtrelerin tamamı desteklenebilir:

- marka,
- ürün tipi/kategori,
- yaş grubu,
- cinsiyet,
- tedarikçi,
- stok durumu,
- kâr oranı,
- çok satanlar,
- yeni gelenler.

## 12.7 Yeni Gelenler

Yeni gelenler şu yöntemlerle belirlenebilir:

- son alış fişinde gelen ürünler,
- son X gün içinde açılan stok kartları,
- son X gün içinde stoğa giren ürünler,
- manuel seçilen ürünler.

## 12.8 Görsel Yönetimi

- Her ürün için 1 ana görsel yeterli.
- Ürün kartına manuel görsel yükleme olacak.
- Toplu görsel yükleme olacak.
- Stok kodu/barkod adına göre otomatik eşleşme olacak.
- Görsel yoksa placeholder kullanılabilir.

## 12.9 Katalog Görünümü

- Mobilde grid görünüm.
- Masaüstünde liste/grid seçilebilir.
- Ürüne tıklanınca detay modalı açılır.
- Ayrı ürün detay sayfası olmaz.

## 12.10 Dil / WhatsApp

- Katalog dili katalog oluştururken seçilir.
- WhatsApp mesaj dili varsayılan olarak katalog diliyle aynı olur.
- İstenirse WhatsApp mesaj dili ayrıca seçilebilir.
- Katalog üstünde Melisa Baby logosu + “Wholesale Baby Clothing” yazısı olur.
- Müşteri adı özel katalog ekranında görünmez; sadece link içinde takip edilir.

## 12.11 Performans Takibi

Takip edilecekler:

- kaç kişi görüntüledi,
- hangi ürünlere tıklandı,
- WhatsApp’a hangi üründen gidildi,
- genel katalog performansı,
- müşteriye özel katalog performansı.

---

# 13. Dashboard Kararları

## 13.1 Genel

- Herkes Ana Sayfa/Dashboard ile başlar.
- Patron dashboard’u ayrı olur.
- Muhasebe dashboard’u ayrı olur.
- Kullanıcı dashboard kutularını seçebilir.

## 13.2 Güncelleme

- İlk aşamada dashboard 30 saniyede bir auto-refresh yapar.
- İleride WebSocket eklenebilir.

## 13.3 Patron Dashboard

Kutular:

- günlük satış,
- günlük kâr,
- toplam stok değeri,
- müşteri borçları,
- tedarikçi borçları,
- en çok satan ürünler,
- tedarikçi performansı,
- eksi stok uyarısı,
- hatalı terminal sync,
- katalog performansı.

## 13.4 Muhasebe Dashboard

Kutular:

- günlük tahsilat,
- günlük ödeme,
- cari hareketler,
- en borçlu müşteriler,
- tedarikçi borçları,
- son satış fişleri,
- son alış fişleri,
- hatalı fişler/sync problemleri,
- bugünkü toplam satış,
- cari ekstre kısa özeti.

## 13.5 Kritik Uyarılar

Dashboard’da görünecek kritik uyarılar:

- eksi stok,
- hatalı terminal sync,
- bakiye yüksek müşteriler,
- tedarikçi borçları.

Borç limitleri dashboard ayarlarından kullanıcı tarafından belirlenir.

---

# 14. Yazdırma / Dışa Aktarma

## 14.1 Satış Fişi Çıktısı

- A4 satış dökümü gibi olacak.
- Toptan satış fişi formatında olacak.
- Her zaman fiyatlı olacak.
- Sadece sade başlık olacak.

İçerik:

- müşteri,
- fiş no,
- tarih,
- para birimi,
- ürün satırları,
- stok kodu,
- ürün adı,
- adet,
- birim fiyat,
- toplam,
- genel iskonto,
- genel toplam.

## 14.2 Barkod Etiketi

- Farklı etiket şablonları seçilebilir.
- ERP içinden toplu barkod etiketi basılır.
- İlk aşamada web-admin’den ürün seçip basılır.

## 14.3 Rapor Dışa Aktarma

Tüm raporlarda:

- Excel dışa aktarma,
- PDF dışa aktarma.

---

# 15. Yetki / Audit Kararları

## 15.1 Kullanıcı Girişi

Her kullanıcı kendi kullanıcı adı/şifresiyle giriş yapacak.

## 15.2 Yetki

Roller ve yetkiler daha sonra detaylandırılacak.

Fiş iptal yetkisi yetki ayarından seçilebilir olacak.

## 15.3 Audit Log

Audit log her kritik işlemi takip edecek:

- fiş oluşturma/iptal,
- fiyat değişikliği,
- stok düzeltme,
- import işlemleri,
- kullanıcı/yetki değişiklikleri,
- para birimi değişiklikleri.

Audit log sadece ADMIN tarafından görülebilecek.

## 15.4 Kritik İşlem Onayı

Kritik işlemlerden önce onay popup’ı olacak.

Tekrar şifre/PIN istenmeyecek.

---

# 16. Taslak / İptal / Silme Kuralları

## 16.1 Fiş Silme

Satış ve alış fişleri silinmeyecek.

Her zaman iptal mantığı olacak.

## 16.2 Fiş Taslakları

- Taslak fişler manuel silinir.
- Otomatik silinmez.
- Satış taslakları satış menüsü altında.
- Alış taslakları alış menüsü altında.

## 16.3 Kaydedilmemiş Değişiklik

Satış/alış fişinde kaydedilmemiş değişiklik varsa:

- çıkarken uyarı verilir,
- otomatik taslak kaydedilir.

---

# 17. Olmayacaklar

İlk kapsamda olmayacaklar:

- tam muhasebe,
- e-fatura/e-arşiv,
- çek/senet,
- kasa/banka modülü,
- depo/şube transferi,
- kat/raf/konum takibi,
- terminalde karmaşık ERP paneli,
- katalogda ilk aşamada sepet/sipariş/ödeme,
- modern boş SaaS panel görünümü.

---

# 18. İlk Resmi Hedef

İlk hedef kod yazmak değil, proje dokümantasyonu ve tasarım kararlarını netleştirmektir.

Sıradaki ana hazırlıklar:

1. Proje klasörü
2. Karar defteri
3. UI blueprint
4. Menü şeması
5. Ekran akışları
6. Veri şeması
7. Teknik roadmap
8. Codex görev planı

---

# 19. Geliştirme Kuralı

Yeni ERP v2’de plansız özellik kodlanmayacak.

Her özellik önce:

1. karar defterine yazılacak,
2. roadmap’e alınacak,
3. modül spec’e çevrilecek,
4. sonra Codex görevi açılacak.

---

# 20. Son Karar

Melisa ERP v2, Vega/Wolvox gibi klasik yoğun ERP hissi veren, web tabanlı, ileride Electron’a taşınabilecek, terminali sade ama güçlü, katalog ve tedarikçi performansı destekli, çoklu dövizli ticari takip ERP’si olarak tasarlanacaktır.

---

# 21. Alış İskontosu ve Stok Maliyeti Kuralı

- Tedarikçi kartındaki alış iskontosu, yeni alış fişine önerilen **fiş sonu tedarikçi iskontosu** olarak gelir.
- Bu oran satır iskontosuna otomatik kopyalanmaz. Satır iskontosu yalnızca ürüne veya ilgili satıra özel ayrı bir indirim varsa kullanılır.
- Satır iskontosu, fiş geneli iskontosu ve tedarikçi iskontosu ardışık uygulanır; oranlar doğrudan toplanmaz.
- Fiş geneli ve tedarikçi iskontoları, satırların satır iskontosu sonrası tutarları oranında ürünlere dağıtılır.
- Net birim alış maliyeti, ürünün dağıtılmış net satır tutarının miktara bölünmesiyle hesaplanır.
- Dövizli alışlarda stok maliyeti, fişin kur snapshot değeriyle TRY'ye çevrilen net maliyettir.
- Tedarikçi borcu fişin net genel toplamı üzerinden oluşur.
- Ürün kartındaki liste alış fiyatı korunur; son net alış maliyeti ve ağırlıklı ortalama stok maliyeti ayrı gösterilir.
- Dövizle alınan ürünlerde ağırlıklı ortalama stok maliyetinin ana gösterimi ürünün döviz cinsindedir; TRY yalnızca raporlama karşılığı olarak ikincil gösterilir.
- Döviz ortalaması bugünkü kurdan çevrilmez; alış fişlerinin işlem anındaki kur snapshot ve net satır tutarlarından hesaplanır.
- Yuvarlama farkları fiş genel toplamıyla satırların toplamı eşleşecek biçimde kontrol edilir.

---

# 22. Çoklu Döviz Günlük Kasa Kuralı

- Fiziksel kasa çekmecesi TRY, USD ve EUR için ayrı ayrı açılır, sayılır ve kapatılır; para birimleri günlük kasa içinde birbirine çevrilmez.
- Ana kasa ile günlük çekmece ayrı finans hesaplarıdır. Sabah çekmeceye eklenen ve akşam ana kasaya teslim edilen para çift taraflı iç transferdir; gelir veya gider sayılmaz.
- Açık kasa oturumu varken nakit müşteri tahsilatları ve nakit satışlar çekmeceye giriş, nakit tedarikçi ödemeleri çekmeceden çıkış oluşturur.
- Banka, kart ve diğer ödeme yöntemleri fiziksel çekmece bakiyesini etkilemez.
- Masraflar kategori, para birimi, tutar ve açıklama ile kaydedilir; çekmece bakiyesinden düşer.
- Sabah ve akşam fiziksel sayım farkları açıklamasız kaydedilemez ve audit kaydı oluşturur.
- İlk sürümde aynı anda yalnızca bir günlük kasa oturumu açık olabilir.
- Veri modeli ve işletim akışı [Çoklu Döviz Günlük Kasa](multi-currency-daily-cash.md) belgesinde tanımlıdır.

---

# 23. Ana Tedarikçi Stok Performansı Kuralı

- Tedarikçi kartındaki ürün portföyü, ürün kartında **ana tedarikçi** olarak seçilen tedarikçiye göre belirlenir.
- Satılan adet yalnızca kesinleşmiş satışların ürün miktarlarından hesaplanır.
- Kalan adet, ana tedarikçiye bağlı ürünlerin pozitif güncel stoklarının toplamıdır.
- Kalan mal değeri, her ürünün kalan adedi ile geçmiş kesinleşmiş alışlardan hesaplanan ağırlıklı ortalama net alış maliyetinin çarpımıdır.
- Kalan mal değeri ürünün kendi para biriminde gösterilir; farklı para birimleri birbirine eklenmez.
- İptal edilmiş alış ve satış kayıtları performans hesabına dahil edilmez.

---

# 24. Personel, Terminal ve Satış Sahipliği Kuralı

- Personel kaydı ile ERP kullanıcı hesabı farklı kavramlardır. Kullanıcı hesabı giriş ve yetki içindir; personel kaydı ticari işlemin sahibini gösterir.
- Terminal satışı yapacak personel tek bir aktif ERP kullanıcı hesabına bağlanmalıdır. Personel formunda kullanıcı adı ve ilk şifre girildiğinde bu hesap aynı işlemde otomatik oluşturulur.
- Aktif terminal cihazı belirli bir personele atanmaz. Terminal giriş ekranında aktif giriş hesabına bağlı bütün aktif personeller listelenir; ayrıca terminal seçimi veya ataması yapılmaz.
- Personel kendi kullanıcı adını seçip şifresini doğruladıktan sonra terminali başlatır.
- Terminal satışı oluşturulurken cihaz kimliği ile giriş yapan personelin kimliği satış fişine snapshot olarak yazılır. Daha sonraki kullanıcı veya personel değişiklikleri eski fişin sahibini değiştirmez.
- Pasif veya giriş hesabı olmayan personel terminal listesinde görünmez. Personel ekranından oluşturulan her yeni aktif kayıtta terminal giriş hesabı aynı işlemde zorunlu olarak oluşturulur.
- Web-admin üzerinden manuel oluşturulan satış fişlerinde personel zorunlu değildir; zorunluluk terminal satış akışı içindir.
- Geçmiş satışlara tahmin yoluyla personel atanmaz. Kanıtlanamayan eski kayıtlar personelsiz kalır.
- Personel oluşturma, güncelleme ve şifre değiştirme audit kaydı üretir.

---

# 25. Personel Görev ve Kısıtlama Kuralı

- Personelin görev/pozisyon bilgisi personel kartında tutulur; bu alan ticari raporlama ve sorumluluk tanımı içindir.
- ERP ekranlarına erişim, personelin bağlı kullanıcı hesabındaki mevcut ERP rolü ve permission sistemiyle yönetilir. Ayrı ve çelişen ikinci bir web yetki sistemi kurulmaz.
- Kullanıcı hesabı olmayan eski veya dışarıdan alınmış personel ERP web arayüzüne ve terminale giriş yapamaz; yeni personel formu bu nedenle giriş hesabını personelle birlikte oluşturur.
- Terminal operasyon kısıtları personel bazında ayrıca tutulur ve API tarafında zorunlu olarak uygulanır.
- İlk çalışan kısıt seti: terminalden satış yapabilme, satış fiyatını değiştirebilme ve azami satış indirimi oranıdır.
- Fiyat değiştirme yetkisi olmayan personel ürünün kayıtlı satış fiyatından farklı fiyatla terminal satışı oluşturamaz.
- Fiyat değiştirme yetkisi olan personelin yaptığı indirim, personel kartındaki azami oranı aşamaz.
- Personel görevi, ERP rolü veya terminal kısıtları değiştiğinde audit izi korunur; geçmiş fişlerin personel sahipliği değiştirilmez.

---

# 26. Mikro İhracat Demo Kuralı

- FedEx mikro ihracat hazırlığı ilk aşamada yalnızca ERP içi, dış etkisiz bir demo akışı olarak çalışır.
- Demo ekranı FedEx'e, ETGB sistemine veya başka bir dış servise veri göndermez; ücret, takip numarası, etiket ya da kurye kaydı oluşturmaz.
- Vega ve Melisa ERP SQL kaynaklarına yazmaz; demo ilerlemesi yalnızca tarayıcıda yerel olarak saklanabilir.
- Operasyon fişi resmî e-arşiv/e-fatura olarak gösterilmez. Resmî belge eksikliği son onay kapısında açıkça görünür.
- Koli ölçüsü/ağırlığı, ürün içeriği, menşe, GTİP, alıcı VAT/EORI, teslim şekli ve FedEx canlı fiyatı insan doğrulaması olmadan kesin kabul edilmez.
- Gerçek entegrasyon ayrı bir onaylı sprint, güvenli secret yönetimi, yetki, audit, idempotency, test ortamı ve işlem anı insan onayı gerektirir.
- Mikro ihracat GTİP taslağında aksi açıkça belirtilmedikçe ürün malzemesi pamuk kabul edilir; `velsoft`, `polar`, `polyester`, `sentetik` veya eşdeğer açık işaret bulunan ürünler sentetik içerik grubuna alınır. Etiket veya teknik belge bilgisi her zaman varsayımdan üstündür.
- Proforma hazırlanırken yerel GTİP kaydı olmayan ürünlere ürün adı ve açık malzeme işaretlerinden otomatik **taslak** kod üretilebilir. Kayıtlı/doğrulanmış kod ezilmez; otomatik kod güven seviyesi ve kural dayanağıyla görünür ve sevk öncesi insan doğrulaması zorunludur.
- Otomatik GTİP taslağı Vega'ya veya Melisa ERP ticari tablolarına kendiliğinden yazılmaz. Kalıcı ürün sınıflandırması ayrı onaylı, audit izli doğrulama akışıdır.

