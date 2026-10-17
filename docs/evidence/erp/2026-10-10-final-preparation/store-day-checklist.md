# Melisa ERP + CRM — mağaza günü kontrol turu

10 Ekim 2026 · hedef süre 15–20 dakika · durum: hazırlanıyor, insan kabulü bekliyor.

Amaç, personelin normal yeşil ekranlarda günlük işi anlayıp takip edebildiğini tek turda görmek. Teknik test sonucu insan kabulü yerine geçmez. Bu belge kullanım turunu hazırlıyor; geniş işletme TEST’ini veya LIVE geçişini başlatmıyor.

## Başlamadan önce koordinatör hazırlığı

- TEST125 ve geçmiş teslimler korunur. Tur yalnız ayrı DB02 ortak TEST kopyasında yürütülür.
- ERP: [Ana Sayfa](http://127.0.0.1:5234/ornek-akis.html#home). CRM: [CRM çalışma yüzü](http://127.0.0.1:62700/). Bu bilgisayarda 5234/62700 dinleyicileri doğrulandı; paket ve DB kimliği tur öncesi yeniden kontrol edilir.
- Günlük satış/finans/sayım/iade için seçilmiş TRY kaynak ürün, müşteri, tedarikçi ve deneme kasa hesabından oluşan dar sunucu kapsamı hazırlanmıştır. Günlük revizyonun aktivasyonu ve gerçek kayıt kontrolleri tamamlanmadan yazma adımlarına geçilmez. Bu kapsam tüm şirket ürünlerinde veya tüm dövizlerde işlem hazır olduğu anlamına gelmez.
- Her adım için önceden hazırlanmış güvenli kayıt, beklenen sonuç ve hareket bağlantısı özel kanıt alanından seçilir. Özel cari isimleri/tutarları bu genel kontrol listesine veya GitHub’a eklenmez.
- Kullanıcı ve İlker mevcut rolleriyle kontrol eder. Teknik TEST aktörü ile gerçek personelin oturumu ayrı kaydedilir; yeni yetki verilmez. Kullanıcıdan parola sohbete yazması istenmez.
- İlk tur mevcut kayıtlar ve geçmiş üzerinden yapılır. Yeni işlem gerekiyorsa koordinatör yalnız doğrulanmış izole TEST kapsamında yönlendirir; istek kimliği ve sentetik etkiler ayrı izlenir.

## Tek kontrol turu

| Sıra / süre | Ekran ve günlük iş | Kullanıcının göreceği sonuç | Kaydedilecek gözlem |
| --- | --- | --- | --- |
| 1 · 1 dk | Ana Sayfa ve oturum | İlker/personel kendi yetkisiyle günlük işleri ve kısa yolları görür. | Kullanıcı, rol, çalışan paket; oturum engeli var mı? |
| 2 · 3 dk | Zebra terminal: Wi-Fi, ürün ve barkod | Koordinatör aynı ortak TEST’e ulaşan şirket Wi-Fi adresini açar. Fiziksel okuyucu ile okutulan barkod doğru ürün kodunu, fotoğrafı ve birimi getirir. Uyku/uyanma sonrası aynı oturum/bağlantı korunur. | Gerçek cihaz gözlemi, barkod sonucu ve uyanma sonucu ayrı yazılır. |
| 3 · 3 dk | Mal kabul → alış/fatura → tedarikçi borcu | Personelin gönderdiği sayım İlker’e ulaşır; onaylı miktar stokta görünür. Alış faturası aynı kabul satırını kullanır; ikinci stok girişi yapmadan doğru döviz hesabında borç gösterir. | Üç belgenin birbirine bağlı olması; yenilemede aynı sonuç. |
| 4 · 3 dk | CRM sipariş taslağı → ERP okuma → satış → müşteri borcu | CRM taslağında doğru müşteri hesabı, kaynak ürün, fiyat ve döviz görünür. ERP aynı taslağı geri okur. Taslak tek başına stok/cari hareketi oluşturmaz. Hazırlanmış satışın stok ve müşteri borcu ayrı görülebilir. | Taslak/satış farkı anlaşılır mı; fiyat/döviz/barkod doğru mu? |
| 5 · 3 dk | Tahsilat ve tedarikçi ödemesi | Hazırlanmış tahsilat satış borcuna; ödeme alış borcuna bağlı görünür. Tutar, tarih, döviz, ilgili hesap ve hareket geçmişi yenileme sonrasında korunur. | İki işlem ayrı izlenir; farklı dövizler bir toplam yapılmaz. |
| 6 · 3 dk | Stok sayımı ve iade | Personelin sayım farkı yetkili onay olmadan uygulanmaz. Hazırlanmış iade orijinal alış/satış satırıyla ilişkilidir; stok ve cari etkisi ile eski belgenin korunduğu görülür. | Yetki açıklaması, miktar, kaynak belge ve varsa ters kayıt bağlantısı. |
| 7 · 1 dk | Gün sonu ve raporlar | Satış, tahsilat, ödeme, sayım ve iade bu çalışma kopyasının raporunda izlenir. TRY/USD/EUR ayrı gösterilir; açılışı doğrulanmamış kasa gerçek kasa açılışı sayılmaz. | Günlük özet okunabilir mi; belge/hareket tutarlılığı? |
| 8 · 1 dk | Kullanıcı kararı | Kullanıcı ve İlker beğendikleri, zorlandıkları ve kontrol edemedikleri noktaları söyler. | Kabul edilen alanlar, somut hata ve bekleyen fiziksel adım ayrı kaydedilir. |

### Zebra fiziksel adımı

Koordinatör cihaz ekranını, bağlantıyı ve oturumu yönetir. Zebra’ya `127.0.0.1` verilmez. Aynı ortak TEST’e ulaşan doğrulanmış şirket Wi-Fi adresi gösterilir; başka veritabanına sessizce yönlendirilmez.

Koordinatör hazır olduğunda kullanıcıya yalnız şu çağrıyı yapar: **“Şimdi gerçek barkodu okut.”** Kullanıcı ürünü fiziksel okuyucu ile okutur. Koordinatör çıkan sonucu gözler ve kaydeder. Klavyeyle barkod yazılması fiziksel okuyucu kabulü değildir. Sonuç gözlenmeden cihaz kabulü tamamlanmış sayılmaz.

## Açılış ve işletme kararları

Bu kısa turdaki deneme kasa hesabı, şirketin gerçek kasa/banka açılışı değildir. Genel TRY/USD/EUR kasa/banka açılışları henüz bilinmiyor/doğrulanmamış durumda tutulur. Kullanıcıdan gerektiğinde tek karar paketiyle şu bilgiler istenir:

1. Hangi gerçek kasa, banka ve POS hesapları kullanılacak; her birinin para birimi ve yetkili personeli kim?
2. Aynı tarih/saatteki kasa sayımı veya banka ekstresiyle doğrulanan açılış tutarı ve yönü nedir?
3. Kökeni bilinmeyen belge/etkilerin işletme açıklaması ve gerçek kişi–cari eşlemeleri hangileridir?

Kaynak tutarları bugünkü Vega bakiyesi diye sunulmaz. Sonradan oluşan kaynak değişikliği final T1 planına bırakılır; kullanıcı kararı olmadan açılış/finans tutarı düzeltilmez. Karantina ve iki LL hesabının dışlanması korunur.

## Tur kaydı ve kabul

| Alan | Gerçek ekranda gözlendi | Yenilemede korundu | Kullanıcının kararı / kalan |
| --- | --- | --- | --- |
| Oturum ve yetki | Bekliyor | Bekliyor | Bekliyor |
| Zebra fiziksel okuyucu ve uyku/uyanma | Bekliyor | Bekliyor | Bekliyor |
| Mal kabul, alış/fatura, tedarikçi borcu | Bekliyor | Bekliyor | Bekliyor |
| CRM taslağı, satış, müşteri borcu | Bekliyor | Bekliyor | Bekliyor |
| Tahsilat ve ödeme geçmişi | Bekliyor | Bekliyor | Bekliyor |
| Sayım, iade ve desteklenen ters kayıt | Bekliyor | Bekliyor | Bekliyor |
| Gün sonu ve raporlar | Bekliyor | Bekliyor | Bekliyor |

Bir adım denenmediyse “denenmedi” yazılır. Teknik otomasyon, ekran görüntüsü ve gerçek kullanıcı kararı ayrı kayıtlar olarak kalır. Kullanıcı açıkça kabul bildirmeden insan kabulü PASS yapılmaz. Genel kullanım hazır kararı; günlük revizyonun gerçek kontrolü, fiziksel cihaz/personel gözlemi ve somut işletme engelleri birlikte değerlendirilerek verilir.

Korunan sınırlar: Vega/LIVE/CRM gerçek müşterilerine yazma, gerçek WhatsApp gönderimi, ücretli AI çağrısı, main merge, Eğitim Modu veya gerçek final T1 bu turda başlatılmaz.

Dayanak: [önceki geniş ortak TEST teslimi](../2026-10-10-business-expansion/README.md). Yeni günlük kapsamın uygulama/kanıt durumu ana hazırlık tesliminde ayrıca belirtilir; önceki tamamlanmış migration yeniden uygulanmaz.
