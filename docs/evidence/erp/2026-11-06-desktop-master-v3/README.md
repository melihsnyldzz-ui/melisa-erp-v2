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

## Kalıcı TEST kurulumu ve normal ekran sonucu

V3 bir kez uygulandı; apply-v1 sonucu ayrı süreçle okundu. Korunan 33 tablo
veri hash'i değişmedi. Yeni metadata 386cff075fd1b77044595d518c12d14c781de6978699a5823f2d5bd0db709ea0,
güvenlik ba16496c752d410d3461fc061fc202d42b24e916ba90b7099c3bf3d7dd78e15d.
Mevcut SQL girişinin parolası değiştirilmeden gerçek CA/ad doğrulamalı TLS
probe geçti. Paket 99C6DA2B7278DA9EF4A32F1FAC8DE57FC01E599DB3BD8CD645D3ECC9089D7AE3:
184 kaynak, beş PowerShell yardımcı ve iki web varlığı. Normal deneme hesabıyla
yerel 127.0.0.1:5294 ekranı kullanıldı; LAN/LIVE yayını yok.

- Supplier1 / ERP-V3-S1: party3 supplier, account3 supplier-only TRY, bakiye0.
- Product3 / ERP-V3-P3: MELISA TEST, DENEME TÜRÜ, supplier1; alış8, iskonto%10,
  ilk maliyet7.2000, açılış3.000 ve tek21.6000TRY stok hareketi.
- Customer3 / ERP-V3-C1: Bursa/Türkiye, ayrı party4/account4. Şehir boşken normal
  form kaydı engelledi. Doldurulunca kaydoldu; yenilemede kartlar korundu.
- Üç özgün kayıt UUID'sinin gövde hash'i gerçek journal'a karşı eşleştirildi;
  normal auth ile ikişer gerçek HTTP replay COMMITTED/replayed=true döndü.
  Bağımsız öncesi/sonrası fixture okuması eş: altı journal, bir tedarikçi,
  üç ürün, tek yeni ürün açılışı. Bu ek tekrar GUI tekrarı değildir.
- Yeni müşteriyle eski P1 ve yeni P3 birer adet satıldı: fiş7,
  DS-12cbadf4-b6f6-4d8a-8efa-9. Normal hazırlama, koli, kontrol ve açık çıkış
  onayı geçti; toplam22TRY/kâr8.8000. Stok P1 4→3, P3 3→2; müşteri ve bağlı
  hesap0→22. Tek customer movement invoice7/party4/account4'e bağlı; iki rezerv
  DISPATCHED. Önceki müşteri50TRY ve önceki finalized50/cancelled30 fişleri aynı.

Kanıtlar kurulum/master-v3-apply-v1/verification.json, master-v3-runtime-admissions,
master-v3-replay-readback.json ve master-v3-observations; görseller kanit altında.
Bu kayıtlar ve korumalı sırlar Git dışında tutulur.

## Teslim sınırı

58 seçili test dosyası temiz ortam ve mevcut offline guard ile geçti; yeni TRY
kuyruk koruması ve geçiş derleyicisi hedefleri ayrıca geçti. Yeşil ekran derlemesi
başarılı. Gerçek V3 TEST kurulumu, normal GUI kart kaydı ve sonraki satış
bağlantısı yukarıda ayrıca kanıtlandı. İnsan kabulü BEKLİYOR.
Başlatıcılar yalnız bu makinedeki ayrılmış TEST içindir; genel taşınabilir
kurucu, LAN/LIVE veya tüm ERP teslimi değildir. Sırlar ve SQL kanıt dosyaları
kaynak paketine alınmaz.
