# Vega Tedarikçi - Alış Fişi - Ürün Eşleştirme Denetim Raporu

Tarih: 2026-08-26  
Kapsam: Vega 2026 dönemi, F0102 stok ve F0103 alış verileri  
Çalışma biçimi: Salt okunur analiz; Vega ve Melisa ERP verilerinde değişiklik yapılmadı

## 1. Amaç

Bu rapor, Vega alış fişlerinde tek bir genel `URUN` stok kartına kaydedilen satırların gerçek stok kartlarıyla güvenilir biçimde bağlanıp bağlanamayacağını incelemektedir.

İncelemenin temel soruları şunlardır:

- Alış fişi tedarikçisi güvenilir bir tedarikçi bağlamı sağlıyor mu?
- Alış satırındaki ürün adı/cinsi gerçek model kodunu taşıyor mu?
- Model kodu tek başına gerçek stok kartını bulmaya yeterli mi?
- Tedarikçi ve marka bilgisi birlikte kullanıldığında eşleşme ne kadar güçleniyor?
- Bu bağlantı Vega'ya yazmadan Melisa ERP içinde nasıl kurulabilir?

## 2. Kaynak Alanlar ve Veri Yapısı

Denetimde aşağıdaki Vega kaynakları kullanılmıştır:

| Bağlam | Kaynak | Kullanılan alanlar |
|---|---|---|
| Tedarikçi kartı | `F0103TBLCARI` | `IND`, `FIRMAKODU`, `FIRMAADI` |
| Alış fişi başlığı | `F0103D0007TBLALFATBASLIK` | `IND`, `FIRMANO`, `BELGENO`, `TARIH`, `PARABIRIMI` |
| Alış fişi satırı | `F0103D0007TBLALFATHAREKET` | `IND`, `EVRAKNO`, `STOKNO`, `STOKKODU`, `MALINCINSI`, `AFIYATI`, `ACIKLAMA`, `PACIKLAMA` |
| Gerçek stok kartı | `F0102TBLSTOKLAR` | `IND`, `STOKKODU`, `MALINCINSI`, `KOD1`–`KOD21` |

Mevcut ERP kodunda `KOD1`, ürün markasının kaynak alanı olarak kullanılmaktadır. Alış fişi başlığı tedarikçiyi, alış satırı ise fişte yazılan ürün bilgisi, miktar ve fiyatı taşımaktadır.

## 3. Temel Veri Bulgusu

Bazı tedarikçilerin alış fişleri gerçek ürün stok kartlarına doğrudan bağlanmamıştır. Bu fişlerde bütün satırlar aynı genel karta yazılmıştır:

- Genel stok kimliği: `1122`
- Genel stok kodu: `URUN`
- Gerçek model kodunun bulunduğu alan: `MALINCINSI`
- Alış fiyatının bulunduğu alan: `AFIYATI`
- Açıklama alanları: İncelenen MY MİO kayıtlarında `ACIKLAMA` ve `PACIKLAMA` boştur

Dolayısıyla kayıt yapısı pratikte şöyledir:

```text
Tedarikçi: MY MİO BABY
Stok kartı: URUN
MALINCINSI: 4556
AFIYATI: alış satırı fiyatı
```

Buradaki `4556` değeri açıklama değil, ürün adı/cinsi alanına yazılmış model kodudur. Gerçek stok kartı ise `4556 MY MİO` gibi ayrı bir karttır.

## 4. MY MİO Özel Denetimi

Vega tedarikçi kartlarında MY MİO ile ilişkili iki kayıt bulundu:

- `MY MİO BABY`
- `MİOMİNİ BABY (MYMİO)`

2026 döneminde denetlenen alış fişleri `MY MİO BABY` kartına bağlıdır. İkinci kart aynı ticari tarafın mükerrer veya alternatif kaydı olabilir; birleştirme veya pasifleştirme kararı ayrıca insan kontrolü gerektirir.

`MY MİO BABY` için bulunan sonuçlar:

| Ölçüm | Sonuç |
|---|---:|
| Alış fişi | 6 |
| Alış satırı | 93 |
| Farklı model kodu | 76 |
| Kullanılan genel stok kimliği | 1122 |
| Kullanılan genel stok kodu | `URUN` |
| Model koduyla en az bir stok adayı | 76 / 76 |
| Model kodu tek başına tekil stok adayı | 36 / 76 |
| MY MİO/MİOMİNİ marka bağlamıyla tekil eşleşme | 76 / 76 |
| Marka bağlamlı eşleşme oranı | %100 |

Model kodu tek başına güvenli değildir. Örneğin aynı sayısal kod farklı markaların stok kodlarında bulunabilir. Model koduna MY MİO marka bağlamı eklendiğinde 76 kodun tamamı yalnızca bir aktif stok kartına bağlanmıştır.

Örnek doğru bağlantı:

```text
Alış tedarikçisi: MY MİO BABY
Fiş satırı MALINCINSI: 4473
Onaylı marka: MY MİO
Gerçek stok kartı: 4473 MY MİO
```

## 5. Genel Denetim Yöntemi

Önce, 2026 alış fişlerinde `STOKKODU = URUN` olan ve ürün adı/cinsi alanı boş olmayan satırlar seçildi.

Tedarikçi bazında güvenilir bir ölçüm yapabilmek için en az 5 farklı model kodu bulunan tedarikçiler denetim kapsamına alındı. Bu koşulu 78 tedarikçi karşıladı.

Model kodu eşleşmesinde yanlış pozitifleri azaltmak için kodun stok kodunun bağımsız başlangıç bölümü olması şartı kullanıldı:

- Kabul: model `4089` → `4089 MY MİO`
- Kabul: model `4089` → `4089-MY MİO`
- Kabul edilmez: model `4089` → `40895 DONİNO`

Marka bağlamı için stok kartındaki `KOD1` değeri kullanıldı. Tedarikçi adıyla açıkça ilişkili marka tercih edildi; doğrudan ad ilişkisi bulunmayan durumda model kodlarının aday stok kartlarında en geniş kapsama sahip marka aday olarak kullanıldı.

Bu otomatik marka seçimi nihai insan onayı değildir. Yüzdeler, ERP'nin üretebileceği güçlü eşleşme önerilerinin oranını gösterir.

## 6. Rastgele Tedarikçi Örneklemi

MY MİO ayrı denetlendiği için rastgele örneklem dışında bırakıldı. En az 5 farklı model koduna sahip diğer tedarikçiler arasından `2026-08-26` sabit tohumu kullanılarak 12 tedarikçi seçildi. Sabit tohum, aynı örneklemin tekrar üretilebilmesini sağlar.

| Tedarikçi | Fiş | Satır | Model | Model koduyla aday | Kod tek başına tekil | Marka bağlamıyla tekil |
|---|---:|---:|---:|---:|---:|---:|
| DEMİRDAĞ TEKSTİL | 19 | 63 | 53 | %96,23 | %47,17 | %88,68 |
| TİASİS-LEYLEK | 19 | 258 | 123 | %99,19 | %46,34 | %98,37 |
| MİNİCE | 2 | 37 | 29 | %100 | %82,76 | %100 |
| COCOSİSS | 5 | 45 | 39 | %94,87 | %61,54 | %94,87 |
| PİCOLA KİDS | 8 | 67 | 54 | %100 | %27,78 | %100 |
| MAMO BABY | 1 | 6 | 6 | %100 | %33,33 | %100 |
| NOYNOY | 3 | 23 | 23 | %100 | %69,57 | %100 |
| ÇİÇO KİDS | 7 | 105 | 77 | %100 | %38,96 | %98,70 |
| İLK CEMRE | 16 | 22 | 10 | %70 | %30 | %70 |
| BEBİCO | 1 | 24 | 24 | %100 | %58,33 | %100 |
| VAYA KİDS | 2 | 5 | 5 | %100 | %0 | %100 |
| AYLİN BEBE | 14 | 23 | 12 | %91,67 | %33,33 | %91,67 |

Rastgele örneklem toplamları:

| Ölçüm | Sonuç |
|---|---:|
| Tedarikçi | 12 |
| Fiş | 97 |
| Satır | 678 |
| Tedarikçi-model birleşimi | 455 |
| En az bir stok adayı bulunan | 446 / 455 — %98,02 |
| Model kodu tek başına tekil | 214 / 455 — %47,03 |
| Marka bağlamıyla tekil | 440 / 455 — %96,70 |

## 7. Tüm Uygun Tedarikçilerde Genel Sonuç

Rastgele örnekleme ek olarak, uygunluk koşulunu karşılayan 78 tedarikçinin tamamında aynı yöntemle çapraz kontrol yapıldı.

| Ölçüm | Sonuç |
|---|---:|
| Denetlenen tedarikçi | 78 |
| Denetlenen alış fişi | 832 |
| Denetlenen alış satırı | 6.291 |
| Tedarikçi-model birleşimi | 3.876 |
| En az bir stok adayı bulunan | 3.826 / 3.876 — %98,71 |
| Model kodu tek başına tekil | 2.269 / 3.876 — %58,54 |
| Tedarikçi/marka bağlamıyla tekil | 3.733 / 3.876 — %96,31 |

Yüzdeler ham satır sayısı üzerinden değil, her tedarikçi içindeki farklı model kodlarının toplamı olan tedarikçi-model birleşimleri üzerinden hesaplanmıştır. Böylece aynı modelin çok sayıda fişte tekrar etmesi sonucu yapay biçimde yükseltmemektedir.

## 8. Eşleşmeyen veya Düşük Güvenli Kayıtlar

Eşleşmeyen değerlerin önemli bölümü gerçek model kodu değildir. Rastgele örneklemde görülen başlıca değerler:

- `KDV`
- `URUN`
- `KUTU`
- `YASTIK`
- `ASKIDA PATİKLİ TEK ALT`

Bu değerler masraf, ambalaj, açıklama veya genel ürün satırı niteliğindedir. Otomatik ürün eşleştirmesinden çıkarılmaları gerekir.

Diğer riskler:

- Aynı sayısal model kodu farklı markalarda bulunabilir.
- Tedarikçi adı ile marka adı birebir aynı olmayabilir.
- Bir tedarikçi birden fazla marka sağlayabilir.
- Mükerrer tedarikçi kartları bulunabilir.
- Eski veya pasif stok kartlarının ayrıca raporlanması gerekebilir.
- Alış fiyatı gerçek ürün kartının ana alış fiyatını otomatik değiştirmemelidir.

## 9. Sonuç ve İş Kararı Önerisi

Model kodu tek başına yalnızca %58,54 oranında tekil sonuç üretmiştir. Bu nedenle yalnızca sayısal model koduna dayanarak otomatik ürün bağlantısı kurulması güvenli değildir.

Tedarikçi ve marka bağlamı eklendiğinde tekil eşleşme oranı %96,31'e yükselmiştir. Rastgele 12 tedarikçi örnekleminde de çok yakın biçimde %96,70 sonucu alınmıştır. Bu iki sonuç yöntemin genellenebilir olduğunu güçlü biçimde desteklemektedir.

Önerilen temel kural:

```text
Alış fişi tedarikçisi
+ MALINCINSI model kodu
+ onaylı tedarikçi-marka takma adı
= gerçek Vega stok kartı adayı
```

Eşleşme sonucu doğrudan kesin iş verisine dönüştürülmemeli; yüksek güvenli sonuçlar onaylanmalı, düşük güvenli sonuçlar inceleme kuyruğuna alınmalıdır.

## 10. ERP Bağlantı Tasarımı

Bağlantı Vega'ya yazmadan, `MELISA_ERP_V2` içinde yerel eşleştirme katmanı olarak kurulmalıdır.

### 10.1 Tedarikçi kimlik bağlantısı

Önerilen tablo: `vega_supplier_links`

- Vega şirket kodu
- Vega tedarikçi kaynak kimliği
- Melisa ERP tedarikçi kimliği
- bağlantı durumu
- onaylayan kullanıcı
- onay tarihi

### 10.2 Tedarikçi-marka takma adları

Önerilen tablo: `vega_supplier_brand_aliases`

- Vega tedarikçi kaynak kimliği
- Vega `KOD1` marka değeri
- normalleştirilmiş marka adı
- aktif/pasif durumu
- onaylayan kullanıcı
- audit zamanı

Örnekler:

```text
MY MİO BABY -> MY MİO
MY MİO BABY -> MİOMİNİ
TİASİS-LEYLEK -> LEYLEK
NOYNOY -> NOY NOY
```

### 10.3 Alış satırı-ürün eşleşmesi

Önerilen tablo: `vega_purchase_product_matches`

- Vega şirket ve dönem kodu
- alış fişi başlık kaynak kimliği
- alış satırı kaynak kimliği
- tedarikçi kaynak kimliği
- ham model kodu
- eşleşen Vega stok kaynak kimliği
- eşleşme yöntemi
- güven puanı
- `suggested`, `confirmed` veya `rejected` durumu
- onaylayan kullanıcı ve zaman
- eşleşme kanıtı/audit özeti

Şirket ve dönem kodları anahtarın parçası olmalıdır; farklı şirket veya dönemlerde kaynak kimlikleri çakışabilir.

## 11. Önerilen Eşleşme Kuralları

1. Alış satırı `STOKKODU = URUN` ise model kodu `MALINCINSI` alanından alınır.
2. Boş değerler ve `KDV`, `URUN`, `KUTU`, `YASTIK` gibi engelli genel ifadeler reddedilir.
3. Model kodu normalize edilir; baştaki ve sondaki boşluklar temizlenir.
4. Stok kodu, model koduyla bağımsız bir bölüm olarak başlamalıdır.
5. Stok kartındaki `KOD1`, tedarikçinin onaylı marka takma adlarından biri olmalıdır.
6. Tek aday bulunursa yüksek güvenli öneri oluşturulur.
7. Sıfır veya birden fazla aday varsa otomatik kesin bağlantı kurulmaz.
8. Onaylanan bağlantı audit kaydıyla saklanır.
9. Aynı kaynak satır için ikinci aktif kesin bağlantı oluşturulamaz.

Önerilen güven seviyeleri:

| Güven | Koşul | İşlem |
|---|---|---|
| 100 | Model kodu + onaylı marka + tek aktif stok kartı | Onaya hazır güçlü öneri |
| 90–99 | Onaylı marka takma adıyla tek aktif stok kartı | Onaya hazır öneri |
| 70–89 | Model kodu tek başına tekil, marka doğrulanmamış | Manuel inceleme |
| 0–69 | Aday yok, birden fazla aday veya genel ifade | Otomatik bağlama yok |

## 12. ERP Ekranlarına Etkisi

### Tedarikçi 360

- Bu tedarikçiden gerçekten alınan ürünler
- toplam alış adedi
- fiş sayısı
- son alış tarihi
- son alış fiyatı ve para birimi
- eşleşmeyen satırlar
- onay bekleyen ürün bağlantıları

### Ürün 360

- ürünün alış yapıldığı tedarikçiler
- ilk ve son alış tarihi
- alış sıklığı
- son ve dönemsel ortalama alış fiyatı
- ana tedarikçi ile gerçek alış tedarikçisi karşılaştırması

### Vega alış fişi detayı

```text
Ham satır: URUN / 4556
Önerilen kart: 4556 MY MİO - gerçek ürün adı
Eşleşme: model + onaylı marka
Durum: önerildi / onaylandı / reddedildi
```

## 13. Ana Tedarikçi İş Kuralı

Alış fişindeki tedarikçi gerçek alış hareketidir; ancak bu sonuç ürün kartındaki ana tedarikçiyi otomatik değiştirmemelidir.

Bir ürün birden fazla tedarikçiden alınabilir. Sistem aşağıdaki bilgileri öneri olarak gösterebilir:

- en sık alış yapılan tedarikçi
- en son alış yapılan tedarikçi
- en yüksek miktarda ürün alınan tedarikçi
- ürün kartındaki mevcut ana tedarikçi

Ana tedarikçi değişikliği insan onayı, audit ve geri dönüş planı gerektiren ayrı bir işlem olmalıdır.

## 14. Önerilen Uygulama Aşamaları

### Aşama 1 - Salt okunur önizleme

- Mevcut Vega adapterlarıyla eşleşme adayları hesaplanır.
- Hiçbir migration veya veri yazma yapılmaz.
- Tedarikçi, model, marka, aday stok kartı ve güven puanı raporlanır.
- Engelli genel ifadeler ve marka takma adları insan tarafından gözden geçirilir.

### Aşama 2 - Onaylı yerel eşleştirme katmanı

- İnsan onayından sonra korumalı migration hazırlanır.
- Yalnızca `MELISA_ERP_V2` hedefinde yerel tablolar oluşturulur.
- Vega kaynaklarına yazılmaz.
- Eşleşme onay/red işlemleri permission ve audit arkasına alınır.

### Aşama 3 - ERP ekranları ve raporlama

- Tedarikçi 360 ve Ürün 360 ilişkileri eklenir.
- Alış fişinde ham ve eşleşmiş ürün birlikte gösterilir.
- Eşleşmeyen kayıtlar için inceleme kuyruğu oluşturulur.
- Ana tedarikçi yalnızca önerilir; otomatik değiştirilmez.

## 15. Sınırlar ve Doğrulama Notu

- Denetim 2026 dönemi F0102/F0103 verilerinin inceleme anındaki durumunu yansıtır.
- Sonuçlar salt okunur sorgularla alınmıştır.
- Vega veya Melisa ERP verisine yazma yapılmamıştır.
- İlk geniş çapraz karşılaştırma sorgusu 15 saniyelik okuma zaman aşımına uğramış, işlem daha hafif iki aşamalı salt okunur okuma ve bellek içi karşılaştırmayla tamamlanmıştır.
- %96,31 oranı onaylanmış ticari gerçeklik değil, otomatik ve tekil bağlantı önerisi üretme oranıdır.
- Şema değişikliği, migration, eşleşme onayı veya ana tedarikçi değişikliği bu raporun kapsamında değildir ve ayrıca açık insan onayı gerektirir.

## 16. Nihai Değerlendirme

Vega alış fişlerindeki genel `URUN` satırları kayıp veri değildir. Tedarikçi, `MALINCINSI` model kodu ve `KOD1` marka bağlamı birlikte kullanıldığında kayıtların büyük çoğunluğu gerçek stok kartlarıyla güvenilir biçimde ilişkilendirilebilir.

Genel bulgu:

```text
Model kodu tek başına tekil eşleşme: %58,54
Tedarikçi/marka bağlamıyla tekil eşleşme: %96,31
En az bir gerçek stok kartı adayı bulma: %98,71
```

Bu nedenle özellik teknik olarak uygulanabilir ve ticari olarak değerlidir. Güvenli çözüm, Vega geçmişini değiştirmeden Melisa ERP içinde onaylı, auditable ve geri izlenebilir bir eşleştirme katmanı kurmaktır.

## 17. Uygulanan Salt Okunur İlk Dilim

2026-08-26 tarihinde migration veya veri yazımı olmadan ilk çalışan dilim eklendi.

Eklenen davranışlar:

- Tedarikçi alış satırları gerçek stok kartlarıyla salt okunur eşleştirilir.
- Doğrudan gerçek `STOKNO` taşıyan satırlar kaynak kimliğiyle bağlanır.
- Genel `URUN` satırları model kodu ve tedarikçi-marka bağlamıyla bağlanır.
- Model kodunun stok kodunda bağımsız başlangıç bölümü olması zorunludur.
- `KDV`, `URUN`, `KUTU` ve `YASTIK` gibi genel değerler ürün eşleştirmesinden çıkarılır.
- Brüt birim alış fiyatı, net birim alış fiyatı ve efektif iskonto ayrı hesaplanır.
- Son alış fiyatı ile miktar ağırlıklı dönemsel net alış fiyatı ayrı gösterilir.
- Otomatik kesin bağ kurulamayan satırlar inceleme listesine bırakılır.

Salt okunur API:

```text
GET /api/vega/suppliers/:supplierSourceId/purchase-intelligence
```

Endpoint `supplier.view` yetkisi gerektirir ve mevcut Vega worker sınırları içinde çalışır.

### Efektif iskonto hesabı

Canlı denetimde genel `URUN` yapısındaki 6.348 satırın hiçbirinde `ISK1`–`ISK6` alanlarında oran bulunmadı. Buna rağmen 5.466 satırda brüt ve net tutar arasında indirim vardı. Bu nedenle yalnız iskonto alanlarına güvenilmez.

Uygulanan formül:

```text
brüt satır tutarı = miktar x brüt birim fiyat
net birim alış = net satır tutarı / miktar
efektif iskonto = 1 - (net satır tutarı / brüt satır tutarı)
```

Dövizli belgelerde Vega'nın yerel tutarları, fiş başlığındaki işlem anı kuru kullanılarak belge para birimine çevrilir. TRY belgelerinde kur `1` kabul edilir.

MY MİO canlı doğrulaması:

```text
Model: 4556
Miktar: 16
Fiş kuru: 47,20
Brüt birim fiyat: 469,64 TRY / 47,20 = 9,95 USD
Net satır tutarı: 6.762,816 TRY / 47,20 = 143,28 USD
Net birim fiyat: 143,28 USD / 16 = 8,955 USD
Efektif iskonto: %10
```

İlk dilimin MY MİO sonucu:

- 6 fiş
- 93 satır
- 76 farklı model
- 76 eşleşen gerçek stok kartı
- %100 güçlü model eşleşmesi
- 93 satırın tamamında ölçülebilen efektif iskonto
- miktar ağırlıklı efektif iskonto: %10

Web-admin tedarikçi hareket ekranına şu alanlar eklendi:

- eşleşen gerçek stok kodu ve ürün adı
- marka bağlamı
- son brüt birim alış fiyatı
- efektif iskonto
- son net birim alış fiyatı
- miktar ağırlıklı net alış fiyatı
- toplam alınan adet ve fiş sayısı
- eşleşme güveni
- manuel incelemeye kalan satır sayısı

Bu dilim öneri ve analiz üretir; ana tedarikçi, stok kartı, alış fiyatı veya geçmiş Vega fişlerinde hiçbir değişiklik yapmaz. Kalıcı onay kayıtları ve tedarikçi-marka takma adı tabloları sonraki aşamada, ayrı migration ve açık insan onayıyla ele alınmalıdır.

## 18. Ürün Kârlılığı Bağlantısı

2026-08-26 tarihinde alış eşleştirmesi F0102 satış hareketleriyle birleştirilerek salt okunur ürün kârlılığı raporu eklendi.

Salt okunur API:

```text
GET /api/dashboard/vega-product-profitability?dateFrom=2026-01-01&dateTo=2026-08-26
```

Endpoint `dashboard.view` yetkisi gerektirir. Vega veya Melisa ERP tablolarına yazmaz, migration gerektirmez ve sonucu beş dakika uygulama önbelleğinde tutar.

Uygulanan ticari hesap:

```text
net satış = brüt satış - efektif satış iskontosu - satış iadeleri
satılan mal maliyeti = satış miktarı x satış anındaki hareketli ağırlıklı net alış maliyeti TRY
hesaplanan brüt ticari kâr = maliyeti bağlı net satış - satılan mal maliyeti
kâr marjı = hesaplanan brüt ticari kâr / maliyeti bağlı net satış
```

Maliyet zinciri 2020–2026 dönemlerini kronolojik işler. Aynı gün içindeki sıra alış, satış iadesi ve satış olarak kabul edilir. Güçlü eşleşmeyen alış satırları tahmin edilerek maliyete katılmaz. İlk eşleşen alıştan önce satış bulunan, geçmişte eksi stoğa düşen veya satış maliyeti kapsamı eksik kalan ürünler `Kontrol gerekli` ya da `Maliyet eksik` olarak işaretlenir.

İlk canlı 2026 doğrulamasında:

- 5.256 satış gören ürün bulundu.
- satış maliyeti kapsamı %85,40 oldu.
- alış satırı güçlü bağlantı oranı, 2020–2026 eski veri dahil edildiğinde %87,98 oldu.
- 3.139 ürün `Güçlü`, 1.324 ürün `Kontrol gerekli`, 793 ürün `Maliyet eksik` olarak sınıflandı.
- satış brüt-net farkından 1.039.393,16 TRY satış iskonto etkisi ölçüldü.
- eşleşen dönem alışlarında 8.742.738,19 TRY ve %9,03 efektif alış iskonto etkisi ölçüldü.

MY MİO marka toplamında aynı canlı çalıştırma 125 satış gören ürün ve 3.868 adet brüt satış buldu. Satış maliyeti kapsamı %99,12 oldu. Maliyeti bağlanan 1.802.962,49 TRY net satış için 1.561.741,54 TRY satılan mal maliyeti, 241.220,93 TRY hesaplanan brüt ticari kâr ve %13,38 brüt kâr marjı oluştu. Bu tutar genel giderleri içermez ve maliyeti eksik 21.988,80 TRY net satış kâr toplamına katılmaz.

Bu canlı toplamlar inceleme anındaki Vega verisini yansıtır ve yeni hareketlerle değişir. Raporun kâr toplamı yalnızca maliyeti bağlanmış satışları kapsar; maliyeti eksik net satış ayrı gösterilir. Kargo, POS/komisyon, gümrük, kira, personel ve diğer genel giderler dahil değildir.
