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

Gerçek native TEST açılışı COMMITTED. Eşlenen kapsamın bağımsız SQL mutabakatı **PASS, fark 0**. Genel migration/cutover durumu **PARTIAL**: kapsam dışı/belirsiz kayıtlar, güncel delta ve günlük fiyat ekranı kabulü açık. Güncel canlı Vega kesimi, eksik maliyet ve belirsiz cari hesapları çözülmeden LIVE cutover kabulü verilmez.

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

### Uygulanan native açılış ve bağımsız mutabakat

Run `VEGA-OPENING-TEST-20261004-06`; plan SHA-256 `18639c27f276f4263d5e9a6b5037753c78f2c3d341a053055db7cb7b00da2f0a`. SQL uygulama kaynak commit'i `03ca9c122fbe98aca82f6998e4657aa9d63ccce0`. Writer yalnız exact binary server/DB kimliği, doğrulanmış TEST yedeği ve değişmemiş başlangıç hash'leriyle çalıştı. Bütün adımlar tek SERIALIZABLE transaction içindeydi; güncellemeler en fazla 500 kayıtlık gruplarla aynı korumadan geçti.

| Kontrol | Gerçek kapsam | Bağımsız sonuç |
|---|---:|---|
| Ürün kimliği/metadata/stok | 16.622 ürün | 0 fark; Vega miktarı + korunacak yerel hareket; scalar = etkili stok defteri |
| Maliyet | 6.070 kanıtlı, 10.552 bilinmeyen | 0 eşleme farkı; bilinmeyen SQL NULL olarak kaldı; tüm maliyetlerin bilinmesi ayrı kabul kapısı |
| Cari ana kartı | 371 müşteri + 401 tedarikçi | 0 fark; rol ve tedarikçi işareti ayrı kontrol |
| Döviz hesapları | 379 müşteri + 406 tedarikçi = 785 | 0 fark; 772 ana + 13 ek hesap; exact hesap = etkili döviz defteri |
| Para birimli/birimli/kademeli fiyat | 63.774 satır | 0 fark; 56.438 güncelleme + 7.336 yeni fiyat |
| Kart fiyatı | 16.182 satış, 6.871 alış projeksiyonu | 0 fark; diğer scalar fiyatlar kaynak kabulü sayılamaz |
| Barkod | 17.736 ürün/barkod çifti; 8 güvenli yeni barkod | Eksik/inaktif eşleşme 0; yeni barkodların kaynak ve hedef sahipliği tekil |
| Açılış hareketi | 1.310 stok + 115 müşteri + 68 tedarikçi = 1.493 | 0 fark; eski belgeler yeniden aktarılmadı |
| Ayrık kaynak kanıtı | 184.045 immutable staging kaydı | Payload/hash farkı 0; staging tek başına native kabul sayılmadı |

Kabul edilen 16.622 üründe korunan yerel stok etkisi toplam −1.109'dur; daha eski tarihteki gerçek terminal satışları da buna dahildir. Tarih eski diye etkileri silinmedi. Açılış stok düzeltmesi −14.461; güncel kaynak neti ve eski yerel hareketler birlikte doğrulandı. Yeni kaynak ürün/cari kartı oluşturulmadı; bu provada mevcut birebir eşlenen native kartlar güncellendi.

27 geçmiş/finans/terminal/audit tablosunun önceki içeriği aynı kaldı. Üç defterin bütün eski satırları ayrıca bağımsız hash ile doğrulandı: 557.649 stok, 29.040 müşteri ve 23.941 tedarikçi hareketi. Bu sayıların artışı yalnız yukarıdaki yeni açılış hareketleridir. 22 TEST guard eski gövdeleriyle etkin; geçici migration guard artığı 0. Kasaya/bankaya ve eski resmi belgelere yazım yok.

`--verify` ve `--replay-test` PASS; fark 0. Aynı `--apply-test` tekrar isteği `RUN_ALREADY_EXISTS_USE_REPLAY` ile DML başlamadan reddedildi. Bu üç kontrol öncesi/sonrası açılışlar, kartlar, fiyatlar, hesaplar, kaynak stage ve audit dahil **37 tablonun tüm satır sayısı/hash'i birebir aynı: ek yazma 0**. Başarısız büyük grup denemesinin transaction rollback'i de bağımsız başlangıç hash'leriyle PASS; guard gevşetilmedi. COMMITTED batch geri alma ve backup restore provası yapılmadı; VERIFYONLY restore kabulü değildir.

Normal TEST oturumuyla gerçek API okumaları: bilinen/bilinmeyen maliyetli iki ürünün stok/maliyeti ve bir müşterinin bakiyesi SQL ile aynı; bilinmeyen maliyet JSON NULL. Aynı kullanıcının native tedarikçi GET isteği mevcut `supplier.view` sınırı nedeniyle 403; yetki değiştirilmedi. 401 tedarikçinin kabul kanıtı bağımsız SQL mutabakatıdır. TEST ürün maliyet UI kaynağında NULL korunur ve Bilinmiyor gösterimi kullanılır; gerçek 0 sıfır kalır. Kaynak regresyonu PASS. Tarayıcı/paket kabul kanıtı release bölümünde tutulur. Toplam 20 hedefli migration/API/UI/SQL kimlik testi PASS.

### Açık kabul kapıları ve güncel delta uygulaması

- 16.676 kaynak açılış ürününden 54'ü native plana alınmadı: 21 kimlik, 3 birim/miktar, 30 benzersiz barkod sorunu. Bu 54 eski TEST kartında hâlâ bulunur; 22 aktif, 39 stoklu. Karantina şu anda migration planındadır; operasyon ekranı otomatik engellemez. Eşleşme/sahiplik veya ayrı erişim engeli çözülmeden tam native operasyon kabulü verilemez. 36.270 pasif sıfır kartın native karşılıklarında aktif/stoklu sapma 0.
- 894 kaynak cariden 122'si güvenli native kabul dışında: kimlik/döviz/bakiye/ana hesap belirsiz. 84 kaynak ana bakiyesi bilinmiyor. NULL, sıfır veya uydurma kur ile kapatılmadı.
- Kabul edilmiş 16.622 üründen **9.751'inde scalar alış fiyatı korunmuştur**; kaynak alış dövizi kartın tek scalar döviziyle uyuşmadığı için zorla dönüştürülmedi. 9.774 plan inceleme kaydı, kapsamdan çıkarılan 23 ürünü de içerir; kabul edilmiş ürün sayısı değildir. Exact typed alış fiyatı mutabakatı PASS olsa da mevcut günlük API scalar fiyatı okur. Dövizli alış fiyatı okuma/yazma akışı ayrıca tamamlanmalıdır.
- Kabul edilmiş ürünlerde 33.049 eski ek typed fiyat anahtarı korundu. Mevcut API/UI `product_prices` tablosunu okumaz. Gelecek typed fiyat okuyucusu kaynak/batch/birim/kademe/döviz provenance filtresini uygulamalı; eski ek anahtarları güncel fiyat diye seçmemeli.
- 10.552 native maliyet NULL, kaynakta 2.048 eksi stok, 13 bilinmeyen miktar, belirsiz birim/döviz/barkod kayıtları açıklamalı işletme kabulü gerektirir. Liste alış fiyatı kanıtlı maliyetin yerine konmaz.
- Güncel Vega'nın 71 yeni ürünü, 341 değişmiş ürünü ve 74 değişmiş carisi ölçüldü; **bu delta uygulanmadı**. Güncel okuma atomik cutover kesimi değildir. Yeni kartlar için ID/alias/birim/barkod/fiyat/açılış ilişkileri yeni immutable TEST batch'inde prova edilmelidir. Mevcut writer frozen TEST run'ına sabitlidir; LIVE veya güncel delta aktarım aracı olarak kullanılamaz.
- Geçiş günü yeni T0/T1 kesimiyle yeni run/hash/plan gerekir. Cari yerel delta ve önceki defter toplamları `COALESCE(balance_effect_exact,balance_effect)` üzerinden hesaplanmalı. Bugünkü yerel unlinked müşteri/tedarikçi hareketlerinde exact/scalar farkı 0 olduğundan mevcut provada hassasiyet kaybı yok; gelecekte aynı varsayım yapılamaz. Dövizler toplanmaz, yabancı açılışa uydurma FX snapshot yazılmaz.
- Genel LIVE cutover, gerçek personel/terminal akışı, kasa/banka sayımı, kaynak yazıcılarının durdurulması, yeni delta mutabakatı ve geri dönüş kabulü açık. Bu görev LIVE'a/Vega'ya yazmadı; eski resmi geçmişi taşımadı.

### Kanıtlar ve TEST kabul ekranı

Korunan yerel kanıt kökü `C:\Sirket\ERP\evidence\VEGA-MIGRATION-TEST-20261004`. Private bölüm kullanıcı/SYSTEM/Administrators ACL'iyle sınırlıdır; ham ticari veri paket/Git/web'e alınmadı.

- `private/VEGA-OPENING-TEST-20261004-06/{commit-receipt,verification-receipt,replay-receipt}.json`
- `private/independent-postapply-06.json`, `independent-barcode-06.json`, `independent-replay-06.json`, `independent-rollback-03.json`
- `private/current-capture-01`, `private/delta-01/source-delta-summary.json`, `api-migration-proof.json`
- Kanonik TEST launcher: `C:\Sirket\ERP\runtime\start-canonical-test.ps1`; nihai paket `CANONICAL-VEGA-MIGRATION-TEST-20261004-06`. Tam kaynak commit'i ve her dosyanın SHA-256 değeri paketin `release-manifest.json` dosyasındadır.
- [5194 salt okunur migration özeti](http://127.0.0.1:5194/migration-proof.html): eşlenen kontroller ve açık kapılar. Kaydedilmiş paket özeti güncel SQL sonucu gibi gösterilmez.

`sql-vega`, backend, reviewer ve release rolleri kullanıldı. Çalışan eski ticari akışların kabulü yeniden açılmadı. LIVE servis sahipliği korundu; gerçek genel kullanım/LIVE geçişi için PARTIAL kapıları kapanmalıdır.
