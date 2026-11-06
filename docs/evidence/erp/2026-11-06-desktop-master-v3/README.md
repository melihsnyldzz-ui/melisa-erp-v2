# PR54 kart alanları: masaüstü TEST V3

Mevcut ERP06/C06 müşteri, ERP07/C07 tedarikçi ve ürün kartı bağımlılığıdır.
Özgün 49/25 kapsam, kullanıcı kabulleri ve sayaçlar değiştirilmedi.

Kaynak, yeşil ekrana tedarikçi oluşturmayı; üründe marka, ürün türü ve seçilmiş
aktif ana tedarikçiyi; yeni müşteride zorunlu şehir/ülkeyi ekler. Tedarikçi,
ayrı supplier party kimliği ve müşteriyle karışmayan sıfır bakiyeli döviz
hesabıyla tek işlemde kaydedilir. Ürün kaydında aktiflik ve tüm yeni alanlar aynı
SQL işleminde kilitlenip geri okunur. Eski ürün ve müşteri verileri doldurulmaz.
Eski bekleyen V2 gövdesi yalnız eşleşen kalıcı journal varsa özgün hash ile
tekrar okunabilir; aynı eski biçim yeni kayıt yaratamaz.

V2 varsayılan factory ve kurucu/izin manifesti korunur. V3 seçimi gerçek TLS
connector kaydından gelir; HTTP veya bir istemci bayrağı bu seçimi yapamaz.
Üründe product.edit ve supplier.view aynı işlemde yeniden denetlenir.
Tedarikçi için yeni supplier.edit uygulama hakkı ve yalnız suppliers INSERT /
UPDATE(party_entity_id) SQL hakları gerekir. Uygulama DDL hakkı almaz.

Bu aşamada ürün maliyet kaydı TRY ile sınırlıdır; desteklenmeyen FX yeni isteği
kalıcı kuyruğa girmeden reddedilir. Müşteri/tedarikçi kartındaki ayrı para
hesabı, dövizli alış veya satışın tamamlandığı anlamına gelmez. Tam FX, iskonto,
kart düzenleme, mal kabul/alış ve finans kapsamı devam eder.

## Gerçek SQL geri alma kanıtı

Hedef yalnız Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105, DB id5,
GUID c67f5317-9c0d-4831-aadd-fadc379a95d1. Mevcut ilk satış uygulaması sahipliği
doğrulanarak kapatıldı. İki Windows owner kilidi, tek SQL transaction app-lock,
eşzamanlı oturum/trigger reddi, sınırlı lock timeout ve sabit hedef kontrolleri
kullanıldı. 36 tablo metadata ve güvenlik özeti, ayrıca marker/roles/permissions
dışındaki 33 tablonun PK-sıralı veri özeti karşılaştırıldı. Boşluğu bağımsız
COUNT ile kanıtlanan tablonun NULL JSON'u yalnız bu durumda [] yapılır.

V3 DDL, role 9→10, iki dar grant ve gerçek EXECUTE AS etkili hak kontrolü
rollback-v3 denemesinde geçti; transaction geri alındı. Ayrı, tamamen kapanmış
önceki süreçten sonra açılan gözlemde schemaVersion2 ve üç başlangıç hash'i aynı:

- Metadata: 4acc4e3e7bdd795bdf012df8bb08225084b43e8462845ae6b06cbe9e24464904
- Güvenlik: 4b2510f3cada04bb82e24ff28fc7b024435d45f7343f84cde3961e9ee4c14d5a
- İş verisi: ea91bf50c0d8bdc455f8a24f76a44719aebd9abb23f69a742809f0ee9a9727f0

Önceki SQL468 (sys permission collation) ve SQL207 (yeni sütunun aynı iç batch'te
erken derlenmesi) denemelerinin UNKNOWN kayıtları korunur. Her biri sonraki ayrı
okumada başlangıç hash'leriyle uzlaştırıldı; düzeltmeler yeni SQL hash'iyle ayrı
denemedir. Bilinmeyen sonuç otomatik tekrarlanmaz. Kanıtlar repo dışında
kurulum/master-v3-rollback-v1..v3 altında. V2 aynı 616BE3... paketle tekrar açıldı.

## Teslim sınırı

58 seçili test dosyası temiz ortam ve mevcut offline guard ile geçti; yeni TRY
kuyruk koruması ve geçiş derleyicisi hedefleri ayrıca geçti. Yeşil ekran derlemesi
başarılı. Gerçek V3 kalıcı kurulum, normal GUI kart kaydı ve sonraki satış
bağlantısı henüz bu kaynak kaydının kanıtı değildir. İnsan kabulü BEKLİYOR.
Başlatıcılar yalnız bu makinedeki ayrılmış TEST içindir; genel taşınabilir
kurucu, LAN/LIVE veya tüm ERP teslimi değildir. Sırlar ve SQL kanıt dosyaları
kaynak paketine alınmaz.
