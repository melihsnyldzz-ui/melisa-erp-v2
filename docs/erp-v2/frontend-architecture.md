# Melisa ERP v2 Frontend Architecture

## Amaç

Bu doküman Melisa ERP v2 frontend mimarisini yüksek seviyede tanımlar. Hedef, Vega/Wolvox hissini koruyan, desktop-first çalışan, yoğun tablo ve çok açık ekran senaryolarında performanslı bir React arayüz mimarisidir.

Bu doküman kod veya klasör oluşturmaz; Faz 1 için teknik yön ve standartları belirler.

## Teknoloji Yaklaşımı

### React

Frontend ana teknoloji olarak React kullanılacaktır. Ekranlar; liste, kart, fiş, rapor, dashboard ve ayar tiplerine ayrılmış, tekrar kullanılabilir ama aşırı soyutlanmamış bileşenlerle geliştirilecektir.

React kullanımı şu hedeflere hizmet etmelidir:

- Aynı anda birden fazla ekranın açık kalması.
- Sekme, pencere ve modal durumlarının kontrollü yönetilmesi.
- Büyük tablo ve yoğun form ekranlarının hızlı render edilmesi.
- Web ortamında çalışıp ileride Electron kabuğuna taşınabilmesi.

### Electron hedefi

İlk geliştirme web tabanlı olabilir, ancak mimari Electron hedefini bozmayacak şekilde kurulmalıdır. Dosya yazdırma, barkod etiketi, yerel cihaz entegrasyonu, pencere boyutu ve masaüstü davranışları ileride Electron katmanına bağlanabilir.

Electron uyumu için:

- UI, tarayıcıya özel dar responsive davranışlara bağımlı olmamalıdır.
- Ana layout sabit desktop çalışma alanı mantığında kalmalıdır.
- Yerel yetenekler doğrudan component içine gömülmemeli, servis/adaptör katmanından çağrılmalıdır.
- API, storage, print ve device entegrasyonları arayüzden ayrılmalıdır.

### Desktop-first yaklaşım

Melisa ERP v2 mobil-first tasarlanmayacaktır. Ana hedef `1920x1080` ve üzeri masaüstü kullanımdır. Minimum `1366x768` desteklenir, yoğun kullanım `2560x1440+` monitörlerde optimize edilir.

Mobil veya dar ekran desteği varsa bu yalnızca yardımcı görüntüleme olarak düşünülmelidir; ana ERP operasyonu masaüstü klavye, tablo, sekme ve pencere düzeniyle yapılacaktır.

### Yoğun ERP render mantığı

Ekranlar bol boşluklu SaaS panel gibi değil, yüksek bilgi yoğunluklu ERP çalışma masası gibi render edilmelidir. Tablolar, filtreler, alt toplamlar, durum renkleri, uyarılar ve hızlı aksiyonlar aynı bağlamda görünmelidir.

## Layout Architecture

Ana layout sabit bölgelerden oluşur:

- Üst menü / ribbon
- Sol modül ve işlem paneli
- Sekme barı
- Orta çalışma alanı
- Opsiyonel sağ yardımcı panel
- Alt durum çubuğu

Layout state'i uygulama genelinde korunmalıdır. Kullanıcı Stok Listesi'nden Satış Fişi'ne geçtiğinde ana layout yeniden kurulmaz; sadece aktif çalışma yüzeyi değişir.

Layout kuralları:

- Üst menü ve alt durum çubuğu global kalır.
- Sol panel seçili modüle göre bağlamsal içerik gösterir.
- Orta alan sekme ve pencere yöneticisinin render alanıdır.
- Sağ panel ekran tipine göre açılıp kapanabilir.
- Sayfanın tamamı gereksiz scroll etmemeli; scroll çoğunlukla tablo/form iç alanlarında çalışmalıdır.

## Window Manager System

Window manager, ERP içindeki açık ekranları ve yardımcı pencereleri yönetir. Buradaki pencere mantığı işletim sistemi penceresi değil, uygulama içi çalışma yüzeyi mantığıdır.

Sorumlulukları:

- Açık ekran kayıtlarını tutmak.
- Aktif ekranı belirlemek.
- Sekme, pencere ve modal açılışlarını koordine etmek.
- Kirli/değişmiş ekranları işaretlemek.
- Kapatma sırasında onay akışını tetiklemek.
- Ekran durumunu gerektiğinde restore etmek.

ERP hissi için pencere davranışları:

- Liste, kart, fiş ve rapor ekranları sekme olarak açılır.
- Arama, seçim, onay ve kısa düzenleme modal olarak açılır.
- Detaylı yardımcı ekranlar pencere olarak açılabilir.
- Kullanıcı ana bağlamını kaybetmeden modal kapatıp önceki ekrana döner.
- Aynı entity için ikinci ekran açılırken mevcut sekmeye odaklanma veya yeni sekme açma kuralı net olmalıdır.

## Tab Management

Sekme sistemi açık ekranları yönetir. Stok Listesi, Ürün Kartı, Satış Fişi, Cari Ekstre gibi ekranlar sekme olarak tutulur.

Kurallar:

- Önerilen açık sekme sayısı 6-10 arasıdır.
- Aktif sekme her zaman görünür kalmalıdır.
- Sekme taşması sağ tarafta menü veya yatay scroll ile çözülmelidir.
- Kirli ekranlar sekme başlığında işaretlenmelidir.
- Kapatma işleminde kaydedilmemiş değişiklik varsa onay/modal açılmalıdır.
- Sekme başlıkları kısa olmalıdır: `Stok Listesi`, `Ürün: B001`, `Satış Fişi: Taslak`, `Cari: ABC`.

Performans için pasif sekmelerin ağır tablo render'ı askıya alınabilir; ancak filtre, seçim ve form durumu korunmalıdır.

## Modal Management

Modal sistemi global ve merkezi olmalıdır. Component'lerin kendi içinde dağınık modal state'i üretmesi yerine, modal manager veya ortak modal host kullanılmalıdır.

Modal tipleri:

- Arama modalı
- Ürün/cari seçim modalı
- Kritik işlem onayı
- Fiş iptal nedeni
- Kısa düzenleme
- Hata detayı
- Dışa aktarma/yazdırma seçenekleri

Modal standartları:

- Başlık net olmalıdır.
- Ana aksiyon ve iptal aksiyonu sabit yerde durmalıdır.
- Büyük seçim modallarında tablo header sticky olmalıdır.
- Modal kapandığında kaynak ekranın seçili satırı, filtreleri ve form durumu korunmalıdır.
- Modal içinde tam sayfa uygulama hissi verilmemelidir.

## Route Structure

Route yapısı ERP modül ağacıyla uyumlu olmalıdır; ancak uygulama içi sekme yönetimi klasik sayfa navigasyonundan daha baskındır.

Önerilen route yaklaşımı:

- `/dashboard`
- `/stock`
- `/stock/products`
- `/stock/products/:id`
- `/sales/invoices`
- `/sales/invoices/:id`
- `/purchase/invoices`
- `/purchase/invoices/:id`
- `/customers`
- `/customers/:id`
- `/suppliers/:id`
- `/catalogs`
- `/reports`
- `/terminal`
- `/settings`
- `/audit`

Route; derin link, refresh ve başlangıç ekranı için kullanılmalıdır. Açık sekmeler ve pencere içi çalışma durumu ayrıca window/tab manager tarafından tutulmalıdır.

## State Management Yaklaşımı

State katmanları ayrılmalıdır:

| State tipi | Örnek | Yönetim yaklaşımı |
| --- | --- | --- |
| Server data | ürünler, fişler, cari hareketler | query/cache katmanı |
| UI shell state | açık sekmeler, aktif modül, sidebar durumu | global store |
| Form state | satış fişi, ürün kartı, cari kart | ekran lokal state + dirty tracking |
| Modal state | açık modal, modal payload | modal manager/global store |
| Table state | kolon, filtre, sıralama, seçim | ekran bazlı persistent state |
| User/session state | kullanıcı, rol, yetki | global auth/session store |

State kuralları:

- Büyük tabloların tüm verisi global store'a yığılmamalıdır.
- Form state'i server cache ile karıştırılmamalıdır.
- Kirli form state'i sekme kapanana kadar korunmalıdır.
- Filtre/kolon tercihleri kullanıcı bazlı saklanabilir.

## Table Rendering Strategy

Yoğun ERP deneyiminin kalbi tablo performansıdır. Liste ekranlarında gerçek tablo kullanılmalı; kart listesi ana ERP veri sunumu olmamalıdır.

Tablo standardı:

- Sticky header.
- Opsiyonel sticky filtre satırı.
- Yatay scroll tablo içinde.
- Dikey scroll tablo gövdesinde.
- Kritik kolon sabitleme.
- Kompakt satır yüksekliği.
- Seçili satır vurgusu.
- Alt toplam / kayıt sayısı.
- Kolon gizleme/gösterme.
- Sıralama ve filtreleme.

Büyük tablo performansı:

- 1000+ satır senaryosunda virtualization veya server-side pagination düşünülmelidir.
- 10.000+ satır senaryosunda server-side filtre/sıralama tercih edilmelidir.
- Hücre renderer'ları hafif tutulmalıdır.
- Satır içinde ağır component veya modal üretimi yapılmamalıdır.
- Gereksiz re-render engellenmelidir.

Sticky header:

- Header tablo scroll alanına bağlı olmalıdır.
- Filtre satırı header altında sabit kalabilir.
- Toplam satırı gerekiyorsa alt bölümde sticky olabilir.

## Form Architecture

Formlar ERP yoğunluğuna uygun, bölümlü ve klavye ile hızlı kullanılabilir olmalıdır.

Form tipleri:

- Kart formu: ürün, cari, tedarikçi.
- Fiş formu: satış, alış.
- Ayar formu: sistem ve modül ayarları.
- Kısa modal formu: barkod ekle, iptal nedeni, fiyat onayı.

Form kuralları:

- Temel bilgiler üstte veya sol ana blokta görünür.
- Detay tabloları alt sekmelerde veya aynı yüzeyde durur.
- Kaydet, iptal, yazdır, kesinleştir gibi aksiyonlar sabit aksiyon alanında bulunur.
- Dirty state izlenir.
- Kaydedilmemiş değişiklikte sekme kapatma onayı zorunludur.
- Fiş ekranlarında satır girişi tablo üzerinde yapılır.

## Keyboard Shortcut System

ERP kullanımında klavye desteği birinci sınıf özellik olmalıdır.

Örnek kısayollar:

- `Ctrl+K`: global arama.
- `Ctrl+N`: aktif modülde yeni kayıt/fiş.
- `Ctrl+S`: kaydet.
- `Esc`: modal kapat veya aktif işlemi iptal et.
- `F2`: seçili kaydı düzenle.
- `F4`: ürün/cari arama.
- `F8`: fişi kesinleştir.
- `Ctrl+Tab`: sonraki sekme.
- `Ctrl+Shift+Tab`: önceki sekme.

Kısayol kuralları:

- Modal açıkken kısayol önceliği modalda olmalıdır.
- Form input içindeyken veri girişini bozacak global kısayollar çalışmamalıdır.
- Kritik işlemler tek kısayolla sessizce tamamlanmamalı; onay gerektirmelidir.

## Global Search Structure

Global arama, ERP içinde hızlı geçiş ve kayıt bulma merkezi olmalıdır.

Arama kapsamı:

- Ürün kodu, ürün adı, barkod.
- Cari/müşteri/tedarikçi adı ve kodu.
- Satış/alış fiş numarası.
- Katalog adı.
- Rapor ve menü ekranları.

Davranış:

- `Ctrl+K` ile açılır.
- Sonuçlar kategorilere ayrılır.
- Sonuç seçilince ilgili ekran sekme olarak açılır.
- Ürün/cari seçimi gibi bağlamsal aramalarda modal arama kullanılabilir.
- Pasif kayıtlar varsayılan gizli, filtre ile görünür olmalıdır.

## Aynı Anda Çok Açık Ekran Performansı

Çok açık ekran performansı için:

- Pasif sekmelerde ağır tablo DOM'u dondurulabilir veya unmount edilip state saklanabilir.
- Aktif olmayan dashboard widget refresh'i yavaşlatılabilir.
- Sekme state'i küçük tutulmalıdır.
- Büyük data setleri server cache ve query key üzerinden yönetilmelidir.
- Her sekme kendi table/form state'ini izole etmelidir.
- Global store'a yüksek hacimli satır verisi konulmamalıdır.

Hedef davranış: Kullanıcı 6-10 sekme açıkken ERP'nin ana shell performansı bozulmamalıdır.

## Electron ile Ortak Çalışma Mantığı

Electron hedefi için frontend şu ayrımları korumalıdır:

- UI component'leri yerel dosya sistemi veya cihaz API'sine doğrudan bağlı olmamalıdır.
- Yazdırma, PDF, barkod etiketi ve cihaz bilgisi için adaptör servisleri kullanılmalıdır.
- Web build ve Electron build aynı React ekranlarını paylaşmalıdır.
- Electron özel yetenekleri feature flag veya platform service üzerinden açılmalıdır.
- Güvenlik için renderer tarafında hassas sistem çağrıları doğrudan yapılmamalıdır.

## Sayfa Tipi Standartları

### Dashboard standardı

Dashboard ekranı kullanıcı girişinden sonra ilk açılan operasyon yüzeyi olmalıdır. Patron, muhasebe ve admin rolleri için aynı layout dilini koruyan ama farklı kutu ve uyarı setleri gösterebilen yapı kullanılmalıdır.

Zorunlu parçalar:

- Kompakt KPI kutuları.
- Kritik uyarı listeleri.
- Kısa tablo widget'ları.
- Mini grafikler.
- Hızlı geçiş aksiyonları.
- Auto-refresh durumu ve son güncelleme bilgisi.

Dashboard kartları dekoratif olmamalıdır. Her kutu ilgili liste, rapor, fiş veya uyarı ekranına sekme olarak geçiş sağlamalıdır.

### Liste ekranı standardı

Liste ekranları yoğun tablo merkezli olmalıdır.

Zorunlu parçalar:

- Başlık ve kısa aksiyon şeridi.
- Hızlı filtre alanı.
- Ana tablo.
- Sticky header.
- Seçili satır vurgusu.
- Alt toplam/kayıt sayısı.
- Sağ/sol bağlamsal işlem paneli.

Liste ekranı sekme olarak açılır. Satır çift tıklama veya Enter ile kart/fiş detayına geçer.

### Fiş ekranı standardı

Fiş ekranları tek aktif işlem yüzeyi olarak çalışır.

Zorunlu parçalar:

- Belge üst bilgisi.
- Cari/tedarikçi seçimi.
- Ürün satır tablosu.
- Genel iskonto/toplam alanı.
- Kaydet, kesinleştir, yazdır, iptal aksiyonları.
- Dirty state ve taslak davranışı.

Fiş satırları kart görünümüne dönüştürülmez; tablo üzerinde hızlı giriş yapılır.

### Kart ekranı standardı

Kart ekranları temel bilgi + detay tabloları düzeninde olmalıdır.

Örnek:

- Ürün kartı: temel bilgiler, barkodlar, fiyatlar, stok hareketleri, görseller.
- Cari kart: temel bilgiler, bakiye, hareketler, satış/alış geçmişi, risk bilgisi.

Kart ekranı sekme olarak açılır ve geçmiş hareketleri bozmadan pasif kayıtları gösterebilir.

### Rapor ekranı standardı

Rapor ekranları filtre paneli + sonuç tablosu + özet/grafik alanı düzeninde olmalıdır.

Kurallar:

- Filtreler görünür olmalıdır.
- Sonuç tablo olarak verilmelidir.
- Excel/PDF dışa aktarma görünür aksiyon olmalıdır.
- Büyük grafik raporun yerine geçmemelidir.

### Modal standardı

Modal kısa ve işlem odaklıdır.

Zorunlu parçalar:

- Net başlık.
- Ana içerik.
- Sabit aksiyon satırı.
- Klavye ile kapatma/onay desteği.
- Kaynak ekran state'ini koruma.

Modal içinde ağır nested layout yapılmamalıdır.

### Dashboard widget standardı

Dashboard widget'ları kompakt ve tıklanabilir olmalıdır.

Widget tipleri:

- KPI kutusu.
- Uyarı listesi.
- Kısa tablo.
- Mini grafik.
- Hızlı işlem kutusu.

Her widget ilgili liste, rapor veya fiş ekranına geçiş sağlamalıdır. Dashboard dekoratif grafik alanı değil, operasyon başlangıç noktasıdır.

## Faz 1 Frontend Klasör Yapısı Önerisi

Önerilen yapı:

```text
src/
  app/
    AppShell/
    routes/
    providers/
  layout/
    TopMenu/
    Sidebar/
    TabBar/
    StatusBar/
    WorkArea/
    RightPanel/
  window-manager/
    registry/
    store/
    components/
  modal-manager/
    components/
    store/
  modules/
    dashboard/
    stock/
      product-list/
      product-card/
      stock-movements/
    sales/
      invoice-list/
      invoice-form/
      draft-invoices/
    purchase/
      invoice-list/
      invoice-form/
    cari/
      customer-list/
      customer-card/
      supplier-card/
      account-statement/
    catalog/
    reports/
    terminal-management/
    settings/
    audit/
  shared/
    components/
      DataTable/
      FormField/
      Toolbar/
      SearchBox/
      ConfirmDialog/
    hooks/
    services/
    utils/
    types/
  platform/
    web/
    electron/
```

Klasör yapısı modül bazlı olmalı, ancak tablo, modal, toolbar, form field gibi ortak ERP parçaları `shared` altında toplanmalıdır. Faz 1'de aşırı generic framework yazmak yerine gerçek ekran ihtiyaçlarından ortak bileşen çıkarılmalıdır.

## Yazılmaması Gereken Anti-patternler

- Mobile-first ana mimari.
- Aşırı animasyon ve geçiş efekti.
- Büyük kart bazlı SaaS tasarımı.
- Gereksiz boşluk ve seyrek bilgi düzeni.
- Her ekran için tam sayfa route geçişi.
- Liste yerine az satırlı kart grid kullanımı.
- Ağır component nesting.
- Her hücrede karmaşık component render etmek.
- Tüm tablo verisini global store'a koymak.
- Modal state'lerini dağınık component içlerinde yönetmek.
- Fiş ekranını sihirbaz/adım adım akışa çevirmek.
- Dashboard'u sadece dekoratif grafik alanı yapmak.

## Faz 1 Öncelikli Frontend Kararları

Faz 1'de önce şu altyapılar kurulmalıdır:

1. App shell: üst menü, sidebar, çalışma alanı, alt durum çubuğu.
2. Tab manager: sekme açma, kapatma, aktif sekme, dirty state.
3. Modal manager: merkezi modal host ve onay akışları.
4. DataTable standardı: sticky header, scroll, seçim, filtre, kolon düzeni.
5. Form standardı: kart ve fiş formları için dirty tracking.
6. Global search: ürün, cari, fiş ve menü arama iskeleti.
7. Dashboard widget standardı.
8. Electron uyumlu platform servis ayrımı.
