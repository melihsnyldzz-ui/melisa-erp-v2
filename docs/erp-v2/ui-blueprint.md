# ERP v2 UI Blueprint

## Tasarım Standardı

Melisa ERP v2 arayüzünün ana standardı modern boş SaaS paneli değil, Vega/Wolvox çizgisinde yoğun, masaüstü ERP hissi veren bir çalışma ortamıdır. Kullanıcı tek ekranda çok veri görmeli, hızlı işlem yapmalı, tablo ve fişler arasında kaybolmadan geçiş yapmalıdır.

Ortak ilkeler:

- Ekranlar beyaz boşlukla seyreltilmiş pazarlama paneli gibi değil, operasyon masası gibi davranmalıdır.
- Üst menü, sol işlem paneli, orta çalışma alanı ve alt durum çubuğu birlikte görünmelidir.
- Tablo yoğunluğu yüksek olmalı; kolonlar, filtreler, toplamlar ve durum bilgileri aynı bağlam içinde kalmalıdır.
- Fiş, kart, liste, rapor ve dashboard yapıları aynı görsel dilde çalışmalıdır.
- Modal ve pencereler masaüstü ERP alışkanlığına uygun olmalı; kullanıcı ana bağlamı kaybetmeden işlem yapmalıdır.
- Renkler uyarı, durum, kategori ve aksiyon ayrımı için kullanılmalı; dekoratif büyük gradient alanlar kullanılmamalıdır.

## Ana Ekran Yerleşimi

### Nasıl görünmeli

Ana ekran; üstte menü/ribbon, solda işlem paneli, ortada çoklu çalışma alanı, altta durum çubuğu olacak şekilde masaüstü ERP düzeninde kurulmalıdır. Dashboard kutuları, açık listeler ve hızlı işlem alanları aynı ekranda görülebilecek kadar kompakt olmalıdır.

### Nasıl çalışmalı

Kullanıcı ana ekrandan stok, cari, satış, rapor ve ayar ekranlarına doğrudan geçebilmelidir. Açılan ekranlar orta çalışma alanında sekme veya pencere olarak yönetilmeli, ana yerleşim sabit kalmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-01-dashboard.png`
- `ui-reference-07-dense-erp-layout.png`
- `ui-reference-08-dense-erp-layout.png`
- `ui-reference-09-dense-erp-layout.png`
- `ui-reference-13-dense-erp-layout.png`
- `ui-reference-19-dense-erp-layout.png`

### Neler yapılmamalı

Tek karttan oluşan boş SaaS dashboard yapılmamalıdır. Büyük hero alanları, gereksiz illüstrasyonlar, az veri gösteren geniş boşluklar ve sadece mobil panel hissi veren düzenlerden kaçınılmalıdır.

## Üst Menü Yapısı

### Nasıl görünmeli

Üst menü koyu veya belirgin bir şerit olarak görünmeli; modüller, hızlı komutlar, arama, kullanıcı/şirket bilgisi ve sistem durumları aynı hatta yer almalıdır. Menü yapısı klasik ERP ribbon hissi vermeli, ikon ve kısa metin birlikte kullanılmalıdır.

### Nasıl çalışmalı

Menü modül geçişlerini, hızlı aramayı, yeni fiş/kart oluşturmayı ve açık ekran yönetimini desteklemelidir. Sık kullanılan işlemler tek tıkla erişilebilir olmalı, daha az kullanılanlar gruplanmış açılır menülerde kalmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-02-sidebar.png`
- `ui-reference-05-vega-style.png`
- `ui-reference-06-wolvox-style.png`
- `ui-reference-15-wolvox-style.png`
- `ui-reference-18-form-screen.png`

### Neler yapılmamalı

Üst menü sadece logo ve profil ikonundan ibaret bırakılmamalıdır. Büyük boş nav bar, pazarlama sitesi menüsü veya aşırı sade üç bağlantılık yapı kullanılmamalıdır.

## Sol İşlem Paneli

### Nasıl görünmeli

Sol panel modül ağacı, işlem kısayolları, filtreler ve bağlamsal komutlar için kullanılmalıdır. Genişliği sabit ve kompakt olmalı; ikonlar ve kısa etiketler net okunmalıdır.

### Nasıl çalışmalı

Seçili modüle göre panel içeriği değişmelidir. Stok ekranında stok işlemleri, cari ekranında cari işlemler, raporda rapor filtreleri görünmelidir. Panel katlanabilir olabilir ama varsayılan deneyimde ERP navigasyonu görünür kalmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-02-sidebar.png`
- `ui-reference-11-stock-card.png`
- `ui-reference-17-stock-card.png`
- `ui-reference-21-form-screen.png`
- `ui-reference-23-customer-card.png`

### Neler yapılmamalı

Sol panel yalnızca dekoratif ikon bar olmamalıdır. Kullanıcıyı modül bulmak için ayrı bir menüye veya arama ekranına zorlayan minimal yapıdan kaçınılmalıdır.

## Orta Çalışma Alanı

### Nasıl görünmeli

Orta alan ERP’nin ana üretim yüzeyi olmalıdır: tablolar, fişler, kartlar, dashboard ve raporlar burada açılmalıdır. Alan, çoklu içerik gösterebilecek şekilde yoğun ama düzenli gridlerle tasarlanmalıdır.

### Nasıl çalışmalı

Kullanıcı aynı anda bir liste, bir fiş ve bir kart ekranını açık tutabilmelidir. Çalışma alanı sekme, pencere ve split görünüm mantıklarını desteklemelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-03-table-list.png`
- `ui-reference-10-table-list.png`
- `ui-reference-16-invoice-screen.png`
- `ui-reference-18-form-screen.png`
- `ui-reference-24-table-list.png`

### Neler yapılmamalı

Her işlem için tam sayfa geçişi yapılmamalıdır. Kullanıcı bir ekranı açınca önceki bağlam tamamen kaybolmamalıdır.

## Çoklu Pencere Mantığı

### Nasıl görünmeli

Pencereler masaüstü ERP hissiyle; başlık çubuğu, kapat/küçült benzeri kontroller, içerik alanı ve alt aksiyon satırıyla görünmelidir. Modal pencereler ana ekranı tamamen yok etmeden üstte çalışmalıdır.

### Nasıl çalışmalı

Detay, seçim, arama, onay ve yardımcı işlem ekranları pencere/modal olarak açılmalıdır. Kullanıcı pencereyi kapattığında geldiği liste veya fiş ekranına aynı durumda dönmelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-04-window-modal.png`
- `ui-reference-25-window-modal.png`
- `ui-reference-05-vega-style.png`
- `ui-reference-18-form-screen.png`

### Neler yapılmamalı

Küçük yardımcı işler için kullanıcı ayrı tam sayfaya gönderilmemelidir. Modal içinde gereksiz büyük boş alan, açıklama metni veya dekoratif kart kullanılmamalıdır.

## Sekme Sistemi

### Nasıl görünmeli

Sekmeler açık ekranları gösteren kompakt bir satır olarak çalışmalıdır. Sekme başlıkları kısa olmalı; modül, belge veya kart adı hızlı anlaşılmalıdır.

### Nasıl çalışmalı

Açık stok listesi, cari kart, satış fişi ve rapor ekranları sekmeler arasında korunmalıdır. Kullanıcı sekme kapatabilmeli, sekmeler arası hızlı geçiş yapabilmeli ve işlem durumunu kaybetmemelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-07-dense-erp-layout.png`
- `ui-reference-08-dense-erp-layout.png`
- `ui-reference-13-dense-erp-layout.png`
- `ui-reference-18-form-screen.png`

### Neler yapılmamalı

Sekme sistemi tarayıcı sekmesi gibi dev ve boş görünmemelidir. Her küçük seçim için yeni sekme açılmamalıdır; yardımcı işler modal kalmalıdır.

## Yoğun Tablo/Listeler

### Nasıl görünmeli

Tablolar yüksek veri yoğunluğuna sahip olmalıdır. Kolon başlıkları, hızlı filtreler, sıralama, seçili satır, toplam satırı ve durum renkleri aynı ekranda görünmelidir.

### Nasıl çalışmalı

Liste ekranları hızlı arama, kolon bazlı filtre, çoklu seçim, satır içi durum göstergesi ve alt toplam bilgilerini desteklemelidir. Kullanıcı tablo üzerinden karta, fişe veya rapora geçebilmelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-03-table-list.png`
- `ui-reference-10-table-list.png`
- `ui-reference-24-table-list.png`
- `ui-reference-05-vega-style.png`
- `ui-reference-06-wolvox-style.png`

### Neler yapılmamalı

Kart kart ayrılmış az satırlı liste tasarımı ana ERP ekranı olarak kullanılmamalıdır. Gereksiz satır yüksekliği, büyük avatarlar ve tabloyu seyrelten boşluklar tercih edilmemelidir.

## Fiş Ekranları

### Nasıl görünmeli

Fiş ekranları üstte belge bilgileri, ortada satır tablosu, sağda/alt bölümde toplamlar ve işlem butonları olacak şekilde düzenlenmelidir. Satır girişi tablo üzerinde hızlı yapılabilmelidir.

### Nasıl çalışmalı

Kullanıcı ürün ekleme, miktar/fiyat/döviz/iskonto düzenleme, belge toplamı izleme ve kaydet/yazdır/iptal işlemlerini tek bağlamda yapmalıdır. Fiş satırları klavye ile hızlı girilebilir olmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-16-invoice-screen.png`
- `ui-reference-05-vega-style.png`
- `ui-reference-25-window-modal.png`

### Neler yapılmamalı

Fiş ekranı adım adım sihirbaz gibi bölünmemelidir. Ürün satırları kart listesine çevrilmemeli, toplamlar ekrandan kopuk ayrı sayfada verilmemelidir.

## Ürün Kartı Ekranı

### Nasıl görünmeli

Ürün kartı; temel bilgiler, barkodlar, fiyatlar, stok hareketleri, görsel/ürün bilgisi ve varyant detaylarını aynı ekranda gösterecek şekilde çok bölmeli olmalıdır.

### Nasıl çalışmalı

Kart ekranı stok hareket listesine, fiyat geçmişine, barkod/alternatif kod bilgilerine ve ilgili fişlere hızlı geçiş sağlamalıdır. Kullanıcı hem form alanlarını hem tablo detaylarını aynı bağlamda görmelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-11-stock-card.png`
- `ui-reference-17-stock-card.png`
- `ui-reference-18-form-screen.png`

### Neler yapılmamalı

Ürün kartı yalnızca birkaç inputtan oluşan boş form olarak tasarlanmamalıdır. Ürün görseli veya açıklama alanı tablo ve hareket bilgisinin önüne geçmemelidir.

## Cari Kart Ekranı

### Nasıl görünmeli

Cari kart; firma bilgileri, bakiye, hareketler, adres/iletişim, limit ve risk bilgilerini yoğun ama okunabilir bir düzende göstermelidir.

### Nasıl çalışmalı

Kullanıcı cari hareketlere, satış fişlerine, tahsilat/ödeme bilgilerine ve raporlara kart üzerinden geçebilmelidir. Bakiye ve risk bilgileri her zaman görünür olmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-23-customer-card.png`
- `ui-reference-18-form-screen.png`
- `ui-reference-05-vega-style.png`

### Neler yapılmamalı

Cari ekranı CRM kartı gibi geniş profil alanına dönüştürülmemelidir. Operasyonel bakiye, hareket ve belge bilgileri gizlenmemelidir.

## Rapor Ekranları

### Nasıl görünmeli

Rapor ekranları filtre paneli, sonuç tablosu, özet kutuları ve grafik alanını birlikte taşımalıdır. Raporun veri yoğunluğu korunmalı, çıktı/Excel/yazdır gibi işlemler görünür olmalıdır.

### Nasıl çalışmalı

Kullanıcı tarih, depo, cari, ürün, kategori gibi filtreleri hızlı değiştirebilmeli; sonuçları tablo, özet ve grafik olarak aynı bağlamda inceleyebilmelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-12-report-screen.png`
- `ui-reference-01-dashboard.png`
- `ui-reference-14-dashboard.png`
- `ui-reference-20-dashboard.png`

### Neler yapılmamalı

Raporlar sadece büyük grafiklerden oluşmamalıdır. Tablo sonucu, filtre bağlamı ve dışa aktarma komutları gizlenmemelidir.

## Dashboard Kutuları

### Nasıl görünmeli

Dashboard kutuları kompakt KPI, uyarı, grafik ve hızlı liste bloklarından oluşmalıdır. Her kutu operasyonel bir soruya cevap vermeli: satış, stok, açık fiş, risk, bekleyen işlem, kritik ürün gibi.

### Nasıl çalışmalı

Kutular tıklanabilir olmalı ve ilgili liste/rapor/fiş ekranına geçiş sağlamalıdır. Dashboard yalnızca özet değil, işlem başlatma noktası olarak kullanılmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-01-dashboard.png`
- `ui-reference-14-dashboard.png`
- `ui-reference-20-dashboard.png`
- `ui-reference-06-wolvox-style.png`

### Neler yapılmamalı

Dashboard dekoratif grafik panosu olmamalıdır. Büyük metrik kartlarıyla ekranı boşaltmak veya kullanıcıyı asıl ERP işleminden uzaklaştırmak doğru değildir.

## Alt Durum Çubuğu

### Nasıl görünmeli

Alt durum çubuğu firma, dönem, kullanıcı, bağlantı durumu, seçili kayıt, toplam satır ve kısa sistem mesajlarını göstermelidir. İnce, sabit ve okunur olmalıdır.

### Nasıl çalışmalı

Kullanıcının nerede çalıştığını ve sistemin hangi durumda olduğunu sürekli bildirmelidir. Hata, uyarı ve başarı mesajları kısa süreli olarak burada desteklenebilir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-01-dashboard.png`
- `ui-reference-05-vega-style.png`
- `ui-reference-06-wolvox-style.png`
- `ui-reference-15-wolvox-style.png`

### Neler yapılmamalı

Alt durum çubuğu tamamen kaldırılmamalıdır. Kritik sistem durumu yalnızca popup veya toast mesajına bırakılmamalıdır.

## Modal / Popup Kuralları

### Nasıl görünmeli

Modal ve popup ekranları küçük, net başlıklı, işlem odaklı ve masaüstü pencere disiplininde olmalıdır. İçerik, ana ekranla görsel olarak aynı ERP dilini taşımalıdır.

### Nasıl çalışmalı

Arama, seçim, belge onayı, kısa düzenleme ve hata detayları modal üzerinden yapılmalıdır. Modal kapandığında ana ekranın seçili satır ve filtre durumu korunmalıdır.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-04-window-modal.png`
- `ui-reference-25-window-modal.png`

### Neler yapılmamalı

Modal içinde tam sayfa form hissi verilmemelidir. Gereksiz açıklama blokları, büyük ikonlu boş durumlar ve kullanıcıyı işlemden koparan tasarımlar kullanılmamalıdır.

## Vega/Wolvox Yoğun ERP Hissi

### Nasıl görünmeli

Genel arayüz; koyu üst şerit, yoğun tablo, dar ama okunur formlar, çoklu bölme ve klasik masaüstü ERP ritmini taşımalıdır. Modernlik; boşluk artırmakla değil, hiyerarşi, okunurluk ve hızlı işlem akışıyla sağlanmalıdır.

### Nasıl çalışmalı

Kullanıcı klavye, tablo, hızlı filtre, sekme ve pencere ile çalışabilmelidir. ERP v2, az tıklama ile çok işlem yapmayı hedeflemelidir.

### Hangi referans görsellerden etkilenmeli

- `ui-reference-05-vega-style.png`
- `ui-reference-06-wolvox-style.png`
- `ui-reference-15-wolvox-style.png`
- `ui-reference-07-dense-erp-layout.png`
- `ui-reference-13-dense-erp-layout.png`

### Neler yapılmamalı

Melisa ERP v2 boş, pastel, tek sayfalık SaaS yönetim paneli gibi tasarlanmamalıdır. Kullanıcıdan ERP ekranı beklenirken az kolonlu kart düzeni, büyük hero başlığı veya pazarlama sitesi estetiği sunulmamalıdır.

# ERP Ana Ekran Wireframe ve Bölge Ölçüleri

## Temel Geometri

Melisa ERP v2 desktop-first tasarlanacaktır. Mobil-first yaklaşım kullanılmayacak; ana deneyim büyük monitörde, çok veriyle ve aynı anda birden fazla ERP bağlamı açıkken verimli çalışacak şekilde kurulacaktır. Vega/Wolvox benzeri bilgi yoğunluğu korunacak, modern boş SaaS panel görünümü ana standart olmayacaktır.

Yaklaşık bölge oranları:

| Alan | Yaklaşık oran | Piksel karşılığı, 1920x1080 örnek | Not |
| --- | ---: | ---: | --- |
| Üst menü | Yükseklik %6-8 | 64-86 px | Ribbon, modül menüsü, hızlı işlem, arama ve kullanıcı bilgisi |
| Sol sidebar | Genişlik %12-16 | 230-310 px | Modül ağacı, işlem kısayolları, bağlamsal filtreler |
| Sekme barı | Yükseklik %3-4 | 32-44 px | Açık ekranlar, aktif sekme, kapatma ve taşma kontrolü |
| Orta çalışma alanı | Genişlik %68-82, yükseklik %82-88 | Değişken | Ana liste, fiş, kart, rapor ve dashboard alanı |
| Sağ yardımcı panel | Genişlik %14-18 | 260-345 px | Opsiyonel; özet, belge aksiyonları, uyarılar veya detay bilgisi |
| Alt durum çubuğu | Yükseklik %2-3 | 24-32 px | Firma, dönem, kullanıcı, bağlantı, seçili kayıt ve sistem mesajı |

Sağ yardımcı panel her ekranda zorunlu değildir. Stok kartı, satış fişi, dashboard ve rapor ekranlarında anlamlıysa açılmalı; yoğun tablo ekranlarında orta çalışma alanını daraltıyorsa kapalı veya katlanmış başlamalıdır.

## Çözünürlük Standartları

| Kullanım seviyesi | Çözünürlük | Tasarım kararı |
| --- | --- | --- |
| Minimum çözünürlük | 1366x768 | Temel kullanım; sidebar daralır, sağ panel varsayılan kapalı olur, tablo kolonları yatay scroll kullanır |
| Önerilen çözünürlük | 1920x1080 | Ana hedef; üst menü, sidebar, sekmeler, orta alan ve alt durum çubuğu birlikte rahat çalışır |
| Yoğun kullanım çözünürlüğü | 2560x1440 ve üzeri | Çoklu pencere, sağ yardımcı panel, geniş tablo ve dashboard kutuları aynı anda verimli kullanılır |

## Pencere, Modal ve Sekme Davranışı

Maksimum aynı anda açık pencere mantığı:

- Önerilen açık sekme sayısı: 6-10.
- Aynı anda görünür aktif pencere sayısı: 1 ana ekran + en fazla 1 modal veya 1 yardımcı pencere.
- Büyük monitörde karşılaştırma için 2 bölmeli çalışma desteklenebilir; varsayılan davranış tek ana çalışma alanıdır.
- Arka planda açık ekranlar sekme olarak korunur, kullanıcı filtre ve seçili satır durumunu kaybetmez.

Modal davranışı:

- Arama, seçim, onay, kısa düzenleme ve hata detayı modal olarak açılır.
- Modal ana ekranı tamamen yok etmez; arka plan bağlamı korunur.
- Modal genişliği işlem tipine göre ayarlanır: küçük onaylar 420-560 px, seçim tabloları 800-1100 px, detay popup'ları 900-1200 px.
- Modal içinde kaydet/iptal/kapat komutları sabit alt aksiyon satırında durur.

Sekme taşması davranışı:

- Sekmeler yatay satırda gösterilir.
- Alan dolunca sekmeler küçülür, sonra sağda taşma menüsüne alınır.
- Aktif sekme her zaman görünür kalır.
- Kirli/değişmiş ekranlar sekmede işaretlenir; kapatırken onay istenir.

## Tablo ve Yoğun Veri Davranışı

Tablo scroll davranışı:

- Dikey scroll tablo gövdesinde çalışır; sayfanın tamamı gereksiz kaymamalıdır.
- Yatay scroll yalnızca tablo içinde olmalıdır.
- İlk kritik kolonlar sabitlenebilir: seçim, kod, ad/unvan, belge no veya barkod.
- Toplam satırı ve kayıt sayısı tablo altında veya alt durum alanında görünür kalmalıdır.

Sticky header kuralları:

- Tablo başlığı sticky kalmalıdır.
- Filtre satırı varsa başlığın hemen altında sticky davranmalıdır.
- Fiş ekranlarında belge üst bilgisi ve toplamlar kaybolmamalı; satır tablosu kendi içinde scroll etmelidir.
- Dashboard kutularında başlıklar sticky olmak zorunda değildir; yoğun liste widget'larında kullanılabilir.

Çok yoğun veri ekranı kuralları:

- Satır yüksekliği kompakt olmalı, ancak okunurluk bozulmamalıdır.
- Kolon gizleme/gösterme ve sıralama desteklenmelidir.
- Renk yalnızca durum, risk, uyarı ve kategori için kullanılmalıdır.
- Büyük boş kart listeleri yerine gerçek tablo yapısı kullanılmalıdır.
- 1000+ kayıt senaryosunda sanallaştırılmış liste veya sayfalama düşünülmelidir.

## ASCII Wireframe: Ana Dashboard

```text
+----------------------------------------------------------------------------------+
| ÜST MENÜ / RIBBON / ARAMA / KULLANICI / ŞİRKET / DÖNEM                           |
+----------------------+-----------------------------------------------------------+
| SOL SIDEBAR          | SEKME BAR: Dashboard | Stok Listesi | Satış Fişi          |
| - Modüller           +-----------------------------------------------------------+
| - Kısayollar         | KPI KUTULARI: Satış | Stok Risk | Açık Fiş | Uyarılar     |
| - Favoriler          +----------------------+----------------------+-------------+
| - Filtreler          | Grafik / Trend       | Bekleyen İşler       | Sağ Özet    |
|                      |                      |                      | Panel       |
|                      +----------------------+----------------------+-------------+
|                      | Yoğun kısa listeler: kritik stok, açık cari, son fişler   |
+----------------------+-----------------------------------------------------------+
| ALT DURUM: Firma | Dönem | Kullanıcı | Bağlantı | Seçili kayıt | Mesaj          |
+----------------------------------------------------------------------------------+
```

## ASCII Wireframe: Stok Listesi Ekranı

```text
+----------------------------------------------------------------------------------+
| ÜST MENÜ: Stok | Yeni Kart | Hareketler | Fiyat | Barkod | Aktar | Yazdır        |
+----------------------+-----------------------------------------------------------+
| SOL İŞLEM PANELİ     | SEKME BAR: Dashboard | Stok Listesi                       |
| - Stok filtreleri    +-----------------------------------------------------------+
| - Depo               | HIZLI FİLTRE: Kod | Barkod | Ürün Adı | Kategori | Durum   |
| - Kategori           +-----------------------------------------------------------+
| - Marka/Grup         | STICKY TABLO HEADER                                      |
| - Kritik stok        | Kod | Barkod | Ürün Adı | Depo | Miktar | Fiyat | Durum   |
|                      | ----+--------+----------+------+--------+-------+--------- |
|                      | Satırlar dikey scroll, kritik kolonlar sabit             |
|                      | ...                                                       |
+----------------------+-----------------------------------------------------------+
| ALT DURUM: 12.450 kayıt | Seçili: 1 | Toplam stok | Filtre aktif | Hazır        |
+----------------------------------------------------------------------------------+
```

## ASCII Wireframe: Satış Fişi Ekranı

```text
+----------------------------------------------------------------------------------+
| ÜST MENÜ: Satış | Yeni Fiş | Kaydet | Yazdır | İptal | Cari Bul | Ürün Bul       |
+----------------------+-----------------------------------------------------------+
| SOL İŞLEM PANELİ     | SEKME BAR: Satış Fişi                                    |
| - Fiş türleri        +-----------------------------------------------------------+
| - Son fişler         | BELGE ÜST BİLGİSİ: Tarih | Belge No | Cari | Depo | PB     |
| - Cari işlemleri     +-----------------------------------------------------------+
| - Kısayollar         | SATIR TABLOSU                                             |
|                      | Barkod | Kod | Ürün | Miktar | Fiyat | İsk. | Tutar       |
|                      | -------+-----+------+--------+-------+------+------------ |
|                      | Klavye ile hızlı satır girişi, tablo içi scroll          |
|                      +------------------------------------------+----------------+
|                      | Not / açıklama / belge detayları         | TOPLAMLAR      |
|                      |                                          | Ara Toplam     |
|                      |                                          | KDV / İskonto  |
|                      |                                          | Genel Toplam   |
+----------------------+------------------------------------------+----------------+
| ALT DURUM: Fiş açık | Kaydedilmedi | Satır: 8 | Cari bakiye | Uyarı alanı       |
+----------------------------------------------------------------------------------+
```

## ASCII Wireframe: Ürün Kartı Ekranı

```text
+----------------------------------------------------------------------------------+
| ÜST MENÜ: Ürün Kartı | Kaydet | Kopyala | Pasifleştir | Hareket | Yazdır          |
+----------------------+-----------------------------------------------------------+
| SOL İŞLEM PANELİ     | SEKME BAR: Ürün Kartı                                    |
| - Kart bölümleri     +-----------------------------------------------------------+
| - Temel bilgiler     | TEMEL BİLGİLER: Kod | Ad | Marka | Grup | KDV | Durum      |
| - Barkodlar          +-------------------------------+---------------------------+
| - Fiyatlar           | FORM ALANLARI                  | ÜRÜN GÖRSELİ / ÖZET       |
| - Hareketler         | Barkod, birim, kategori,       | Stok, fiyat, risk,        |
| - Raporlar           | açıklama, özellikler           | son hareket bilgisi       |
|                      +-------------------------------+---------------------------+
|                      | ALT SEKMELER: Barkodlar | Fiyatlar | Depo Stok | Hareketler |
|                      | Yoğun detay tablosu ve kayıt bazlı hızlı işlem            |
+----------------------+-----------------------------------------------------------+
| ALT DURUM: Ürün kartı | Son kayıt | Kullanıcı | Dönem | Bağlantı                 |
+----------------------------------------------------------------------------------+
```

## UI Referans Görselleri

- [Dashboard referansı](ui-references/ui-reference-01-dashboard.png)
- [Sidebar referansı](ui-references/ui-reference-02-sidebar.png)
- [Tablo / liste referansı](ui-references/ui-reference-03-table-list.png)
- [Pencere / modal referansı](ui-references/ui-reference-04-window-modal.png)
- [Vega yoğun ERP referansı](ui-references/ui-reference-05-vega-style.png)
- [Wolvox stil referansı](ui-references/ui-reference-06-wolvox-style.png)
- [Yoğun ERP yerleşim referansı 07](ui-references/ui-reference-07-dense-erp-layout.png)
- [Yoğun ERP yerleşim referansı 08](ui-references/ui-reference-08-dense-erp-layout.png)
- [Yoğun ERP yerleşim referansı 09](ui-references/ui-reference-09-dense-erp-layout.png)
- [Tablo / liste referansı 10](ui-references/ui-reference-10-table-list.png)
- [Stok kartı referansı](ui-references/ui-reference-11-stock-card.png)
- [Rapor ekranı referansı](ui-references/ui-reference-12-report-screen.png)
- [Yoğun ERP yerleşim referansı 13](ui-references/ui-reference-13-dense-erp-layout.png)
- [Dashboard referansı 14](ui-references/ui-reference-14-dashboard.png)
- [Wolvox stil referansı 15](ui-references/ui-reference-15-wolvox-style.png)
- [Fiş ekranı referansı](ui-references/ui-reference-16-invoice-screen.png)
- [Stok kartı referansı 17](ui-references/ui-reference-17-stock-card.png)
- [Form ekranı referansı 18](ui-references/ui-reference-18-form-screen.png)
- [Yoğun ERP yerleşim referansı 19](ui-references/ui-reference-19-dense-erp-layout.png)
- [Dashboard referansı 20](ui-references/ui-reference-20-dashboard.png)
- [Form ekranı referansı 21](ui-references/ui-reference-21-form-screen.png)
- [Sıralanmamış referans 22](ui-references/ui-reference-22-unsorted.png)
- [Cari kart referansı](ui-references/ui-reference-23-customer-card.png)
- [Tablo / liste referansı 24](ui-references/ui-reference-24-table-list.png)
- [Pencere / modal referansı 25](ui-references/ui-reference-25-window-modal.png)
