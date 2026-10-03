# Vega → Melisa ERP açılış migration planı

4 Ekim 2026. Kullanıcının bu görevdeki talimatı geçerlidir: Vega kaynak sistemdir; aktif kartlar, stok, cari/döviz bakiyesi, fiyat ve kanıtlı maliyet ile gerekli açılış verileri taşınır. Eski resmi geçmiş, eski fatura/arşiv ve muhasebe belgeleri yeniden aktarılmaz. TEST provası yetkilidir; LIVE yazımı yetkili değildir.

## Kaynak, hedef ve veri kesimi

- Kanonik kaynak kod: `C:\Sirket\ERP\source\canonical-live-20261003`, `codex/canonical-live-20261003`.
- Prova kaynağı: `Semih\MELISADEV / VEGA_CAPTURE_20260930_01`, fiziksel salt okunur. Yerel `VEGA2026` F0102/F0103 işletme dönemini içermediğinden kaynak seçilmedi; eski `VEGA2026_ANALIZ_READONLY` da güncel prova kaynağı değildir.
- Yakalamanın işaret ettiği veri kesimi 30 Eylül 2026'dır. 4 Ekim export zamanı kaynak güncelliği anlamına gelmez. Güncel Vega `DESKTOP-KSRK0EQ / VEGA2026` bağlantısı da SELECT-only SQL rolüyle doğrulandı: sysadmin/CONTROL/INSERT/UPDATE/DELETE yetkisi yok; gerekli 29 tabloda SELECT var. Snapshot isolation OFF. Güncel okuma/delta gerçek geçiş anının atomik snapshot'ı değildir.
- Hedef yalnız `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`. Web 5194, ERP API 4144, native API 4146 salt okunur. LIVE DB ve 5188/4114/4116 servislerine yazma/restart yok.
- Ham kart, cari, fiyat, maliyet ve ilişki dökümleri yalnız `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004\private` altında. Git ve web paketine yalnız kod, yöntem ve anonim mutabakat özeti girer.

## Eşleme ve açılış kuralları

| Alan | Kaynak | Hedef ve kontrol |
|---|---|---|
| Ürün kimliği | F0102 stok IND + özgün kod; baştaki sıfırlar korunur | Mevcut native source_record_key/alias ile birebir eşleştir; benzer adla birleştirme yok |
| Kapsam | Aktif sıfır stok dahil; pasif sıfır olmayan ek açılış kapsamı | Pasif sıfır kart dışarıda; belirsiz aktiflik/miktar karantinada |
| Stok | F0102 D0007 hareket neti; dönem hareketi olmayan kart için KALAN ve kaynak gerekçesi | MERKEZ tek fiziksel stok. F0103/F0104 ikinci stok değildir. Eksi stok aynen kayıtlı inceleme konusu; sıfıra çevrilmez |
| Birim/barkod | F0102 BIRIMLEREX, birim IND/faktör | ADET/faktör 1 kanıtı; çakışan barkod yeni sahipliğe zorlanmaz |
| Satış fiyatı | Kaynak birim + kademe + para birimi | Çoklu kademe/döviz korunur; sadece scalar alan kontrolü yeterli değildir |
| Liste alış fiyatı | Kart ALISFIYATI/DALISFIYATI/APB ve iskonto | Son net maliyetten ayrı, para birimiyle korunur |
| Maliyet | Kanıtlı ürün bağı olan son kesinleşmiş net alış satırı, tarih/kur/iskonto izleri | Son net alış maliyeti; hareketli ağırlıklı ortalama diye etiketlenmez. Kaynak bağı/kur kanıtlanmıyorsa NULL/UNKNOWN; bugünün kuruyla doldurma yok |
| Müşteri | F0102 cari IND + rol + hesap dövizi | Native müşteri, party link ve döviz hesabı birlikte kontrol |
| Tedarikçi | F0103 cari IND + rol + hesap dövizi | Native tedarikçi, party link ve döviz hesabı birlikte kontrol |
| Bakiye | D0007 cari defterinin işaretli (BORC−ALACAK)/KUR hesabı; 30/31 teknik devir sınıflaması ayrıca belgeli | TRY/USD/EUR ayrı. Müşteride native alacak işareti kaynakla aynı; tedarikçide native pozitif borç için kaynak işareti ters çevrilir. Card BAKIYE ile hesap dövizi aynı değilse zorla eşitleme yok. Eksik/uyumsuz hesap karantinada |
| Açılış etkisi | Dondurulmuş kaynak ve korunacak hedef başlangıç farkı | Eski belgeleri silmeden yalnız tanımlı açılış farkı; scalar stok/bakiye ve etkili hareket aynı sonuca ulaşmalı |
| Kasa/banka ve günlük kur | Fiziksel döviz sayımı, banka mutabakatı ve kabul edilmiş geçiş günü kur kaynağı | Cari bakiyeden kasa türetme yok. Mevcut TEST kasa/banka korunur; gerçek finans açılışı ayrıca iş sayımıyla kabul edilir. 12 Eylül kayıtlı kur güncel piyasa kuru kabul edilmez |

Hedef hassasiyeti açıkça korunur: fiyat ve döviz hesabı tabloları decimal(28,8), kart maliyet/fiyat/bakiye alanları decimal(18,4), stok kartı decimal(18,3). Finansın tam kaynak değeri döviz hesabında ve exact hareket alanında tutulur; 4 basamaklı kart alanı SQL ROUND(value,4) projeksiyonudur ve en fazla 0,00005 fark ayrı raporlanır. Maliyet/fiyatın tam kaynağı da kanıtta tutulur. Mutabakat exact hesap/fiyatı exact kaynakla, kart projeksiyonunu aynı yuvarlanmış kaynakla karşılaştırır. Stokta temsil edilemeyen miktar sessiz yuvarlanmaz; karantinaya ayrılır.

## Prova uygulama sırası ve koruma

1. Server/DB/rol/firma/dönem kimliği, kaynak read_only ve hedef izolasyonu doğrulanır. Export projeksiyonları iki okumada aynı hash vermeli; canlı kaynakta bu kontrol atomik veri kesimi yerine geçmez.
2. TEST başlangıcının COPY_ONLY/CHECKSUM yedeği alınır; mevcut TEST korumaları, belge/hareket/kasa ve fixture parmak izleri saklanır. Yalnız TEST yedeği; LIVE yedeği/restore/reset yok.
3. Kaynak açılış modeli `erp_migration` ayrık şemada immutable run/hash ile kaydedilir. Ham veri paketlenmez. Bu aşama tek başına native geçiş kabulü değildir.
4. Native plan her hedef ID için before/after değerleri, kaynak kimliği ve izinli kolonları dondurur. Mevcut trigger'lar kapatılmaz. Gerekli uzantı yalnız aynı TEST DB, admin migration oturumu, aktif run ve onaylanmış birebir planı kabul eder; uygulama writer'ına genel migration izni verilmez.
5. Ürün/stok/fiyat/maliyet ve cari/bakiye eşlenen alanları kontrollü güncellenir; farklar tek seferlik kaynak anahtarlı açılış hareketine bağlanır. Kaynak çakışması veya başlangıç sapması transaction'ı durdurur. Eski fatura/satış maliyet snapshot'ı/kasa/geçmiş silinmez.
6. Replay ek yazma üretmemeli. Bağımsız reviewer doğrudan donmuş Vega SELECT → native hedef SELECT ile kayıt anahtarlı stok, cari/döviz, fiyat, maliyet farklarını doğrular. Aynı importer'ın stage-to-stage sayımı tek başına mutabakat değildir.
7. Kanonik TEST paketi manifest/hash ile üretilir; `C:\Sirket\ERP\runtime\start-canonical-test.ps1` ile açılır. 5194'te yayınlanan salt okunur özetin gerçek SQL kanıtıyla aynı olması kontrol edilir.

## Geçiş günü delta/cutover

1. İşletme geçiş saati ve sorumlusu belirlenir. Güncel Vega server/DB/firma/dönem ile hedef LIVE kimliği ayrı yetkilendirilmeden LIVE işlemi başlamaz.
2. Kart/stok/cari/fiyat/maliyet ve ürün bağları için T0 dondurulmuş başlangıç export/hash alınır. Vega kesiminde bütün yazıcılar ve gecikmiş/offline terminal senkronları kontrollü durdurulur; tek ortak tutarlı snapshot veya yazım duraklatılmış kesim gerekir.
3. T1 son export alınır. T0→T1 delta kaynak kimliği ve payload hash ile INSERT/UPDATE/pasifleştirme olarak ayrılır. Timestamp tek başına değişim yakalama değildir; tüm açılış bakiyesi/net stok yeniden hesaplanır. Eksilen kart DELETE sayılmaz; gerekçe/karantina gerekir.
4. Geçiş anına kadar Vega tek yazıcıdır. T1 aktarımı sonrası yeniden iki sistemde satış/alış açılmaz. Cutover pencere içindeki hareket source-key ile tek etkili uygulanır; eski açılışlar/teknik ters kayıtlar ikinci kez çalıştırılmaz.
5. Kabul kapıları: kaynak/hedef kimliği, kapsam dışı ve karantina açıklaması; kayıt bazında stok/cari/döviz/fiyat/maliyet farkı sıfır; bilinmeyen/çatışmalı alanların işletme kararı; native etkili defter ve scalar eşitliği; replay sıfır yazma; kasa/geçmiş/yerel hareket korunması; gerçek personel/terminal kabulü.
6. Kabulden önce Vega yazıcılığına dönülecekse yalnız doğrulanmış hedef açılış batch'i geri alınır veya TEST doğrulanmış backup stratejisi uygulanır; yeni gerçek Melisa işlemleri oluştuysa restore ile kaybedilmez. Kaynak ve hedef delta/ters kayıt planı birlikte incelenir. Bu görev hiçbir LIVE rollback/restore gerçekleştirmez.
7. Kabul sonrası kaynak Vega salt okunur arşiv olarak tutulur. Eski resmi geçmiş Melisa ERP'ye toplu taşınmaz; gerekirse ayrı salt okunur referans erişimi sağlanır.

## Bu provanın sonucu

Uygulama ve bağımsız SQL mutabakatı devam ediyor. PASS sonucunu tamamlanmamış alanlara yayma. Güncel canlı Vega kesimi, eksik maliyet ve belirsiz cari hesapları çözülmeden LIVE cutover kabulü verilmez. Nihai run/hash/sayılar ve TEST paketi aşağıdaki sonuç bölümüne yazılacaktır.

### Doğrulanmış source ve gerçek delta

- Dondurulmuş final export `source-capture-06`, SHA-256 `36971dab7296dd171ee0084c185f833b47b96d6a47fe57c8486a2b81d78ef400`. 52.959 kart; 11.749 aktif ve 4.927 pasif sıfır olmayan = 16.676 açılış kapsamı. 36.270 pasif sıfır kart dışarıda, 13 belirsiz miktar incelemede. 2.048 kaynak eksi stok sessiz sıfırlanmaz.
- 950 cari; 891 aktif + 3 pasif bakiyeli = 894 kapsam. 84 ana döviz bakiyesi bilinmiyor, 2 tanınmayan LL dövizli kayıt var. Kaynak çoklu döviz hesapları ayrı tutulur.
- 6.076 kanıtlı son net alış maliyeti; 150 son bağlı alışta net/kur/birim/kayıt tutarsızlığı; 10.450 kanıtlı alış bağı olmayan ürün. Bu maliyetler bilinmiyor. 10 birim incelemesi ve 1 sıfır olmayan tanınmayan dövizli fiyat vardır.
- Reviewer doğrudan salt okunur Vega SELECT ile 52.959 ürünün miktarını ve 420 kaynak döviz hesabını snapshot ile karşılaştırdı: sıfır fark; native tedarikçi işaret dönüşümü sıfır fark. Kapsamdaki 16.669 ürün ana birim pointer'ı exact, 7 kayıt belirsiz.
- Güncel kaynak export `current-capture-01`, SHA-256 `c62d3366f8505437daf6f7227bd459f2ab289c02b7b52a3ddf0e431a8bc84d64`; 4 Ekim 00:58:47 TRT okuma bitişi. Projeksiyonların iki okuma hash'i aynı, fakat bütün tabloların ortak atomik veri kesimi kanıtlanmış değildir.
- Gerçek T0→güncel delta: 71 yeni ürün (70 kapsamda), 341 değişmiş ürün (337 kapsamda), kaybolan ürün yok. Miktar 327, satış fiyatı 35, alış fiyatı 54, maliyet kanıtı 28, net maliyet 19, barkod 8 kartta değişmiş. 74 cari değişmiş, 71 bakiyesi değişmiş; yeni/kaybolan cari yok. Alan fark sayıları aynı kartı birden fazla sayabilir; toplamı değişen kart sayısı değildir.
- Güncel kaynakta 53.030 kart, 16.745 kapsam, 6.104 kanıtlı maliyet var. Bu yeni kart ve deltalar dondurulmuş 30 Eylül native prova kabulüne dahil sayılamaz; geçiş günü ayrı idempotent batch + aynı mutabakat kapıları gerekir.
- Ek bağımsız barkod incelemesi: kapsamda 17.804 benzersiz kaynak ürün/barkod çifti; başlangıçta 36 native eşleşme eksikti. Native plan kapsamındaki 35 eksikten yalnız 8'i hem kaynakta tek sahipli hem hedefte sahipsizdir; 27'si kaynakta çok sahipli veya hedefte başka ürünün barkodudur. Güvenli 8 eklenebilir; diğerleri yeniden sahiplik atanmadan karantinaya ayrılır. Önceden pasif barkodlar kaynaktan aktivasyon kanıtı olmadan açılmaz.
- TEST başlangıç yedeği `C:\Sirket\ERP\backups\VEGA-MIGRATION-TEST-20261004\PRE_OPENING_01.bak`: COPY_ONLY + CHECKSUM, VERIFYONLY PASS. SQL Express COMPRESSION desteklemediği için ilk sıkıştırma denemesi yazmadan durdu; başarılı yedek sıkıştırmasızdır. Restore provası bu görevde yapılmadı.
