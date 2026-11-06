# Masaüstü temiz TEST: ilk satış akışı

6 Kasım 2026. Bu kayıt, PR54'ten gelen kaynak üzerinde ayrı ve ticari veri
aktarılmamış Windows TEST veritabanındaki sınırlı TRY akışını belgeliyor.
Tüm ERP teslimi, insan kabulü, LAN/LIVE kurulumu veya genel amaçlı soğuk kurulum
paketi değildir. PR54 kaynak başı `dce0fff48893d1a1778a9de61dc3e3ffbc5ed462`
bu feature dalının atasıdır; PR54'ün kabul kapsamı değiştirilmedi.

## Gerçekte doğrulanan davranış

- Ayrı normal `erp_deneme` oturumunda müşteri ve iki ürün oluşturuldu. Ürünler
  yerel barkod/birim/fiyat ve tek açılış stok hareketiyle atomik kaydedildi.
- İlk satış: P1 1 adet × 10 TRY, P2 2 adet × 20 TRY. Taslak → hazırlama/rezerv
  → iki numaralı koli → hazır → son kontrol → açık test çıkış onayı → tamamlandı.
- Hazırlama boyunca stok 5/6 ve müşteri bakiyesi 0 kaldı. Kesinleşmeden sonra
  stok 4/4, müşteri ve bağlı TRY hesabı 50 oldu: bir finalized fiş, iki satır,
  iki stok çıkışı ve bir müşteri/cari hareketi.
- Aynı sevk UUID/gövde hash'i gerçek günlüğe karşı eşleştirildi. Normal auth ile
  iki HTTP tekrarında `replayed:true` döndü; bağımsız SQL okumasında etkiler
  çoğalmadı. Bu ek tekrar deneyi GUI tekrarı değildir.
- İkinci 30 TRY taslak hazırlanıp kısmi kolilendi ve normal ekrandan iptal
  edildi. İki rezerv bırakıldı; önceki 4/4 stok ve 50 TRY bakiye değişmedi.
  İptal yalnız henüz sevk edilmemiş taslak içindir. Zaman `updated_at` ve audit
  kaydındadır; finalized satış iadesi veya `cancelled_at` desteği iddia edilmez.
- Eksik koli sunucuda hazır yapılamadı; sonraki UI düzeltmesi eksik/fazla miktarı
  yeni bir istek göndermeden açıklıyor. Belirsiz yazmalar aynı UUID/gövdeyle
  korunur; yalnız kalıcı no-commit uzlaştırması kuyruğu serbest bırakır.
- Uygulama kapanıp aynı paketle açıldıktan sonra normal girişten ilk fiş tekrar
  okundu. Ürün ve müşteri listelerinde stok/bakiye görüldü. Fiş listesi ve arama
  üzerinden tamamlanmış ve iptal edilmiş kayıtlar tekrar açılabildi.
- Gerçek fişten tek sayfa A4 PDF çıkarıldı; Poppler görüntüsü gözle incelendi.
  Türkçe harfler, iki ürün, 50 TRY ve iki koli doğru; menü/düğmeler basılmıyor.
  Fiziksel yazıcı ve işletim sistemi yazdırma diyalogu doğrulanmadı.

## SQL, yedek ve kimlik sınırı

Hedef yalnız `Semih\MELISAERP / MELISA_ERP_DESKTOP_TEST_20261105`, DB id5,
GUID `c67f5317-9c0d-4831-aadd-fadc379a95d1`. TLS doğru CA/ad ile doğrulanır;
sertifika güvenini atlama yoktur. Web/API yalnız `127.0.0.1:5294/4294`.
Yeni profil 36 tablo ve sınırlı sütun hakları kullanır; uygulama hesabında DDL,
geniş DB rolü veya diğer veritabanlarına yazma yetkisi verilmez.

İlk satıştan sonra COPY_ONLY/CHECKSUM yedeği ayrı
`MELISA_ERP_RESTORE_CHECK_20261106_D2DA15E3` veritabanına gerçekten yüklendi.
Kopya restore anından itibaren RESTRICTED_USER ve ek public CONNECT reddiyle
yalıtıldı. Kaynak öncesi/kopya/kaynak sonrası 36 dbo tablonun PK sıralı satır
hash'leri ve denetlenen şema/uygulama güvenliği metadatası eşleşti; kopyaya
eklenen public CONNECT reddi açıkça karşılaştırma dışında. CHECKDB onarımsız
geçti; uygulama SQL hesabı kopyaya erişemiyor. Eski yedekler ve kaynak izinleri
değişmedi. Bu yedek ikinci iptal denemesinden öncedir; başka bilgisayara
kopyalanmadı ve geri yüklenen kopyada ayrı uygulama başlatılmadı.

Önceki UNKNOWN denemeler sonuç kaydıyla korunuyor. Mevcut 36 tablo/etkin hesap
üzerinde ilk kurucu veya aktivasyon yeniden yürütülmez. Sonraki uygulama paketleri
salt okunur kaynak/TLS/yetki yeniden kabulünden geçer. ODBC Dispose→Open fiziksel
bağlantıyı yeniden kullanabildiğinden kurulum sonrası bağımsız gözlemler ayrı
süreçte yapılır. Genel bir kurucu veya geri dönüş reçetesi olduğu varsayılmaz.

## Kaynak ve doğrulama

Aktif yerel paket SHA256:
`616BE3CA4C7838A4572B68C8F994B046E8CDF27EE67117FCD8A5B64A92D1EA5B`.
Paket 185 API/kurulum kaynak bağı, dört yardımcı PowerShell dosyası, iki üretilmiş
web varlığı ve ayrı bağımlılık ağacı hash'iyle sabitlendi. Git commit'i veya
derleme tek başına bu yerel paketin kurulumu anlamına gelmez.

Seçili 51 Node test dosyası mevcut CI offline guard ve temizlenmiş ortamla geçti;
ilgili normal HTTP, native işlem modeli, yetki reddi, audit/journal rollback,
kayıp yanıt, kesin para/miktar ve kuyruk kontrolleri içerir. Gerçek SQL ve normal
GUI kanıtları bunlardan ayrı yukarıda kaydedildi. Yeni exact GitHub CI sonucu
ayrıca raporlanır; bu kayıt CI PASS veya insan PASS üretmez.

Gerçek taze SQL'de ortaya çıkan ve düzeltilen uyumsuzluklar: NOT NULL tahmini kâr
alanına NULL gönderilmesi; rowversion'ın binary(8) olmadan hex'e çevrilmesi;
Turkish_CI_AS altında UPPER(finalized) sonucunun ASCII durumla uyuşmaması.
Kesirli kâr, bilinmeyen maliyet ve binary/decimal yuvarlama uyumu ayrıca sınandı.

Özel kanıtlar ve korumalı makine sırları repo dışında `Masaüstü\ERP\kurulum`;
görseller ve PDF `Masaüstü\ERP\kanit` altındadır. Sırlar, sertifika özel
anahtarı, DPAPI dosyası, SQL yedeği ve gerçek ticari veri Git'e eklenmedi.

## Tam kapsamda kalan işler

PR54'ün marka/tip/ana tedarikçi ve zorunlu müşteri konum kuralları; tedarikçi
kartı; mal kabul→alış→tek stok/tedarikçi borcu; çoklu döviz, iskonto ve fiyat
yetkileri; ayrı cari/finans/rapor ekranları; personel/terminal ve diğer modüller
sürer. İlk iki ürünlü TRY kanıtı bunları kapatmaz. Eski ticari kayıt aktarımı,
Vega/LIVE yazması, eski veri/yedek silme ve main merge/tag/release yapılmadı.

İnsan kabulü: [USER_ACCEPTANCE.md](../../../../USER_ACCEPTANCE.md).
Teknik durum: [STATUS.md](../../../../STATUS.md).

### İlk hosted CI incelemesi ve düzeltmesi
PR70 `69c780f2` hosted Linux API çalışması 8 hata gösterdi. Taşınabilir TLS
fonksiyon testi artık yalnız sentetik public PEM kullanıyor; gerçek sabit pinin
bu fixture'ı reddettiği ayrıca sınanıyor. Bu gerçek bağlantı kabulü değildir.
B6 selected-items hazırlığı, incelenen yeni tam dosya hash'ine sabitlendi;
PR54 ile byte-identical kalan çıkarılmış SQL ayrıca özgün SHA256 ile kilitli.
Native readonly metadata mount'u eski startup projection hash'ini değiştirmeden
iki exact/tekil satır olarak doğrulanıyor; VM bağımlılıkları açık inert doubles
ile sınırlandı. Logger yalnız sonlu, kaynakta incelenmiş statik kodları tanıyor.

Yerel geniş API denemesinde bu sekiz hata giderildi: 1747 test geçti, 13 skip,
1 test Windows native carton ACL subprocess'ini offline guard engellediği için
başarısız oldu. Guard gevşetilmedi veya test atlatılmadı; sonraki aşamalar bu
sırada çalıştırılmadı. Bu sonuç tam API PASS değildir; hosted Linux exact-head
CI sonucu ayrıca izlenir. İlk satış runtime paketi ve SQL bu düzeltmelerle
henüz değiştirilmedi.