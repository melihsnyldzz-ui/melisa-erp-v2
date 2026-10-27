# Aşama 3 — doğrulanmış ürün alt kapsamı TEST uygulaması

ERP-DEC-032 / ERP-PRODUCTCOMPLETION01, 8 Ekim 2026. Mevcut Goal7 migration motoru, journal/before-image, kaynağa bağlı stok katkısı ve sürümlü fiyat okuması kullanıldı. Genel ürün/veri temizliği, fiziksel mağaza sayımı ve gerçek final T1 yapılmadı. İnsan ERP-UA26 bekliyor; bu dar kapsam sonunda DUR.

## Gerçek uygulama ve ayrı sayılar

| Varlık / işlem | Sonuç |
| --- | ---: |
| Yeni native fiziksel ürün kartı | 72 |
| Güncellenen mevcut native ürün satırı | 310 |
| Bunlar içinde kaynak ana kart alanı değişen ürün | 4 |
| Yeni barkod / doğrulanmış birim bağı | 109 |
| Yeni kartta kesin ADET / 1 ana birim bağı | 72 |
| Ürün-depo kaynak stok farkı | 343 |
| Yeni satış fiyatı satırı | 319 |
| Güncellenen satış fiyatı satırı | 47 |
| Yeni sealed görünümde ürün / typed fiyat (alış + satış) | 16.743 / 64.333 |
| Korunan karantina ile normal katalog | 16.797 |
| Native ticari DML | 1.272 |
| Native alanı değişmeyen grup | 16.356 |
| Bunlardan istisnasız aynı / alan istisnalı | 14.185 / 2.171 |
| Tamamı bekletilen kart grubu | 61 |

310 mevcut satır güncellemesinin stok/fiyat/kart alanları çakışabilir; dört ana kart değişikliği bunun alt kümesidir. Ürün, barkod, fiyat ve ürün-depo sayıları birbirine eklenmez. 16.356 no-op grup bütün güncel alanları tamam sayılmaz. Önceki bir döviz tuple'ı yalnız yeni immutable görünümde superseded; eski native fiyat/geçmiş/açılış/Goal7 sürümleri silinmedi.

## Kaynak ve uygulama anlamı

Kaynak SELECT-only F0102 / D0007 görüntüsü **08.10.2026 20:28:57 Europe/Istanbul (17:28:57Z)**. Ham görüntü SHA256 29fb7de04811c3b229ac1a1685023366ae3efe90cae541e66bb508375987798f; onaylı kapsamın türetilmiş kaynak hash'i 4161d6d90716b69e3c67c165a20fa674b0f0340dbf036233444ef9e39fbd4eee. Plan hash'i f5b1d9c79675b9cf905f050e5961d5dc1f9349f8a1bc328a32395be3ae38a3d6. Ardışık bulk okuma atomik T1 değildir; bu görüntü sonrasındaki Vega hareketleri final geçişte alınacaktır.

53.084 erişilebilir kartın tamamı aktarılmadı. Mevcut kabul edilmiş kimlikler ve aynı fiziksel kabul kurallarını karşılayan yeni kartlar esas alındı. Şirket/tablo/IND, tam stok kodu/ad, KOD1/KOD4 ve kaynak birim/barkod kimliği korundu; isim/model benzerliğiyle birleştirme yapılmadı. Kaynak dönem stok anlamı kullanıldı; takvim yılı filtresi ve ikinci devir toplamı eklenmedi. Doğrulanmış tek depo kapsamında kayıt bazlı kontrol yapıldı; başka depo/birimler tek miktarda toplanmadı.

Stok yazımı A (tarihli Vega stok katkısı) − B (önceki açılış/Goal7 katkısı) farkıdır. Mevcut C gerçek yerel ve D sealed sentetik etkileri ayrı tutuldu. Toplam TEST stoğu kaynak A ile aynı ilan edilmez. Değişen 343 güvenli stok grubunda C/D sıfır, source-effect/defter/kart closure exact; ayrıştırılamayan mevcut etkili ürünün stok alanı değiştirilmedi. Stok farkı alış veya cari borç oluşturmadı.

Satış fiyatı ürün + kaynak birim + kademe + döviz tuple'ıyla exact saklandı. Ana kart göstergesi ana birim/kademe sözleşmesiyle eş; TRY/USD/EUR, NULL ve gerçek sıfır ayrı. Kurdan fiyat üretimi, ikinci iskonto, ücretsiz satış yetkisi veya eski belgedeki fiyatı değiştirme yok. Yeni 72 kartta bilinmeyen alış fiyatı/maliyet/döviz NULL; 59 kaynak kart iskontosu aynen korundu, 13 bilinmeyen NULL. Mevcut iki NOT NULL alış kolonunun yalnız nullable olması kayıpsız dar DDL'dir; eski veri/default/scale değişmedi.

## İstisnalar

61 tam bekleyen grup: 55 eski yayımlanmamış kart (54 mevcut hold dahil), 5 fiziksel tür kanıtı eksik kart ve 1 native kod çakışması. Alan istisnaları: 1.990 negatif kaynak stok için işletme kararı; 185 ayrıştırılamayan stok lineage; 9 fiyat tuple'ında belirsiz döviz; 5 çelişen barkod sahipliği; 1 manuel/kanıtsız eski fiyat çatışması. Bunlar alan/kayıt bazlıdır ve birbirine eklenmez; kesin bağımsız kart/barkod/fiyat alanları ilerledi. Eksik fotoğraf/maliyet güvenli alanların önünü kesmedi. Karantina kullanılmayacak ürün demek değildir; ilgili kart normal listede inceleme bekliyor.

## Kanıt, koruma ve geri dönüş sınırı

Doğru hedef Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01. COPY_ONLY / CHECKSUM yedek, HEADERONLY, fiziksel SHA256 ve VERIFYONLY geçti. **Aktif veya izole DB'ye gerçek restore yapılmadı.** Tek owner SERIALIZABLE transaction, exact CAS, batch hash ve koruma trigger'ları kullanıldı. Post-write hata enjeksiyonundan sonra 1.272 DML, reader yayını ve nullable DDL geri alındı; bağımsız SQL başlangıçtaki 73 koruma kümesini ve native şemayı eş buldu.

Gerçek commit sonrası aynı batch replay: yeni kart 0 / barkod 0 / ikinci stok etkisi 0 / ikinci fiyat sürümü 0. Aynı UUID farklı içerikle reddedildi. Bağımsız SQL bütün 1.272 değişikliği, 16.738 uygulanabilir kimlik/no-op grubunu, 14.563 stok closure'ını ve 16.743 ürün / 64.333 fiyat bindingini doğruladı. Normal API: bütün değişen 382 kart ve iki koruma örneğinde 384/384 PASS; tüm satış birim/kademe/döviz/tutar tuple ve opt-in fiyat okuması kontrol edildi. Tarayıcı sonuçları aşağıdaki özet makbuza bağlıdır.

283 cari/59 finans hareketi, önceki16, iki LL/770 dış kapsam, cari/ürün holdları, 4.338 belge net alış, 6.090 eski maliyet, 3.830 fotoğraf/67 bağlanmamış belirsiz, eski belgeler ve roller korundu. Güncel gövde/kolon hashleriyle mevcut native veriler korunur; yeni fotoğraf aktarımı yapılmadı. R2 ve R3 için dörder ek immutable okuyucu yalnız iki mevcut TEST servis kimliğine EXECUTE; personel yetkisi değişmedi.

R2 kaynak JSON'u 4.000 karakteri aşan 16 ürünün doğrulanmış birimini nvarchar(max) ile okur; güvenlik ve stage/binding kontrolleri kaldırılmadı. R3 SQL'in tam saniyede milisaniyeyi düşürmesini önler; DTO timestamp doğrulaması gevşetilmedi. Önceki r1/r2 module tanımları ve sealed kaynak/veri sürümü değişmedi; bu düzeltmeler ticari DML üretmedi.

**Commit sonrası bütün yeni kart/barkod/fiyat/görünümü kapsayan toplu inverse henüz uygulanmış veya kanıtlanmış değildir.** Eski stok/fiyat inverse aritmetiği ve sonraki yerel hareketi koruyan dar CAS sözleşmesi offline kontrol edildi; bu gerçek toplu geri alma değildir. Yedek/immutable before-image ve atomic rollback kanıtı vardır. History-preserving tam committed inverse ve gerçek kurtarma provası final geçiş öncesinde açık kalır; çalışan TEST'e restore/reset/inverse yapılmadı.

## Normal ekran, hız ve teslim

Normal yüz: http://127.0.0.1:5194/ornek-akis.html#stock; ağdaki mevcut adres http://192.168.1.46:5194/ornek-akis.html#stock. Yeşil tasarım/50 ürün/sayfalama korunur. Normal beş örnekte stok, kademeli fiyat, sıfırlı/çoklu barkod, yeni kart ve boş alan; ayrıca hold ve onaylı fotoğraf kontrol edildi. Yeni satış/fatura/tahsilat oluşturulmadı. Ham ad, tutar, kaynak dosya, fotoğraf ve özel ayarlar GitHub'da yok; private kanıt alanında kalır.

| Okuma | TEST107 önce | TEST113 sonra |
| --- | ---: | ---: |
| İlk 50 | 646 ms | 587 ms |
| Sonraki 50 | 736 ms | 551 ms |
| Kod arama | 532 ms | 552 ms |
| Tam barkod | 339 ms | 340 ms |
| Ürün kartı | 173 ms | 163 ms |
| Fiyat okuması | HTTP 503; okunamadı | 175 ms |

Ölçüm üç ardışık authenticated loopback GET medyanıdır, JSON okuması dahil; ekran paint ölçümü değildir. Eski price endpoint'in 503 sonucu hız başarısı sayılmaz. Belge taraması liste/kart açılışına eklenmedi.

Çalışan **TEST113 / source 63f0a017ec23e89ca9aab7e44acb051f4e86479a**, CANONICAL-TEST-63f0a017ec23, 1.516 manifest dosyası/baselineReproduced true; web5194/API4144/native4146. Bu uygulama source'u son belge teslim commit'inden ayrıdır. Dal codex/erp-finish-20261004 / PR23; uygulama source ve son PR head CI makbuzları STATUS ve PR'de kayıtlıdır. Teknik kontrol insan ERP-UA26 PASS değildir. Finish 49 / 9🟢 /39🟡 /1🔴 değişmez. Bir sonraki aşama genel TEST etkilerinin canlı açılıştan ayrılması ve günlük işlem kapsamıdır; **bu tur başlatılmadı**.

[Makinece okunur teslim ve private kanıt hashleri](delivery-summary.json). Tam kod/önce-sonra örnekler yalnız private expected-five-examples.json ve browser-proof.json içinde. Ayrı deneme ödeme geçmişi panelinin mevcut sorunu korunur; ödeme modülü işi açılmadı.

## 27 Ekim — Güncel kaynak dilimi ve ikinci tarihli katalog zinciri

ERP-DEC-078 / mevcut ERP03–A01–B02 devamıdır; yeni Goal/ajan/ikinci TEST yazarı yok. Kanonik repo origin/feature dalı ve kirli kullanıcı dosyası salt okunur doğrulandı; yeni kaynak mevcut PR54 owner worktree'sinde tutuldu. Kanonik `scripts/canonical/package-npm.test.mjs` ve owner'ın eski untracked dosyaları değiştirilmedi.

### Gerçek başlangıç ve hedef ayrımı

- API4194/native4196 bugün taze health okumasında349fae/035 ve `MELISA_ERP_CLEAN_TEST_20261022`, synthetic:true/actualT1:false olarak doğrulandı. Finans WEB10b/b6 kurulumu korunur; DB02 kontrol aracının başka hedefteki `deploymentAllowed:false` kaydı bu kurulumun yetkisi değildir.
- Gerçek ürün verisinin mevcut native alanı `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`; mevcut API4144/native4146 sourceedb3c891, normal WEB5194. Bu, yeni CLEAN ile aynı ortam diye sunulmadı. Native tablo toplamı53091 kart; yayınlanmış PRODUCT sürümü16743 kart/64333 fiyat ve54 ürün karantinasıdır. Legacy tablo toplamı ile normal katalog kapsamı birbirine eklenmedi; yeni aktarım veya tam katalog güncelliği iddiası yok.
- Üç seçili fiziksel kaynak kimliği mevcut native kartlarıyla birebir eşleşti. Ana bilgiler, üç barkod ve dokuz kaynak satış tuple'ı karşılaştırıldı: fark0. Stok toplamları üç üründe gözlemsel eş; bu depo/kaynak katkısı/yerel-sentetik etki ayrımı değildir. Bu nedenle mevcut açılış tekrar yazılmadı, yeni stok veya finans etkisi0.

### Gerçek kod değişikliği

`current-vega-product-slice.mjs`, güncel SELECT-only connector cevaplarını mevcut exact decimal ve `sourceTypedPrices` sözleşmesine taşır. Firma/tablo/kayıt/ana birim kimliği, metin barkod, KOD1/KOD4, kaynak ham fiyat kademeleri/dövizleri korunur. Eksik marka/tür stok kodundan çıkarılmaz. Bilinmeyen birim/kur/tutar/negatif fiyat yalnız kendi alanında sorun olur; ücretsiz veya varsayılan TRY üretilmez. Birden fazla barkod korunur, çelişki bağlanmaz. Sonuç `DATED_SOURCE_READ`, acceptedOpening:false/stockApplicationReady:false; SQL bağlantısı veya yeni writer değildir. `compareCurrentVegaSliceWithNative` CLEAN hedefi ve bilinmeyen hold kanıtını reddeder; toplam miktar eşitliğini stok yazma iznine çeviremez.

İkinci tarihli PRODUCT batch'inin mevcut builder'ı önceki PRODUCT halkasını düşürüyordu. Artık önceki tam bağlam doğrulanarak additive `lineageRevision:2` ile korunur. API ve yeşil ekran aynı saf `product-catalog-lineage.mjs` sözleşmesini kullanır. Eski üç halkalı bağlamın kabul sınırı aynı; yeni revizyon için tam önceki bağlam/hashler, exact reader adları, tekil bütün atalar, geri gitmeyen tarih ve kart sayısı gerekir. Çevrim ve16'dan fazla devam halkası reddedilir. SQL seal/actor/hold/manifest/gerçek stok delta korumaları kaldırılmadı; CLEAN kimliği veya synthetic bayrağı değiştirilmedi.

### Kontroller ve gerçek ekran

Hedefli kontroller yeni source adapter, ikinci/üçüncü batch, sahte/eksik/çevrimli ata reddi, eski native lineage'ın normal API DTO'su ve yeşil katalog zarfından geçmesini kapsar. İlk yeni ekran-zarfı testinde fixture sözdizimi ve eksik media-null alanları düzeltildi; başarısız sonuçlar PASS sayılmadı. Yeni dalda ancestry dizisi ve ata bağlamları da dondurulur. Eski kabul edilmiş geniş suite/Goal8/migration/CI rerun yok. Browser-targeted esbuild kontrolü yeni saf lineage modülünü gerçek normal katalog bağımlılık grafiğinde bundle etti; write:false, çıktı1/girdi6. Bu tam paket veya kurulum değildir.

Normal gerçek TEST5194'te mevcut Yönetici görüntüleme oturumuyla üç ürün arama→liste→kart yolunda açıldı. Kaynak tam kod, baştaki sıfır, ADET miktar, ayrı USD fiyat, barkod ve mevcut fotoğraf/temiz eksik fotoğraf durumu görüldü. Bir örnekte boş KOD1/KOD4 doğru biçimde Bilinmiyor kaldı; kod parçalanmadı. UI katalog tarihi08.10.2026'yı koruyor; stok okuması bugünkü native okumadır. Bu, yeni kaynak kodun kurulum/normal personel kabulü değildir; rol veya ticari kayıt yazılmadı.

### Private kanıt ve açık kalan bileşen

Ham kaynak/önce-image/tutar/fotoğraf ve ekran görüntüleri GitHub'a eklenmedi. Mevcut ERP evidence private `business-catalog-20261027` altında `current-three-source.json`, `current-three-normalized.json`, `native-three-readback-v2.json`, `native-three-comparison.json`, `normal-native-gui.json` ve üç `native-*-card.png` tutulur. Kaynak27Ekim yerel02:14–02:26 aralığında çok sorgulu güncel okumadır; atomik T1 veya iki-pass-stable batch değildir. Native SQLCMD ilk parametre/JSON taşıma hataları yalnız okuma sırasında oldu; düzeltilmiş capture UTF8 ve tek scalar JSON kullandı. Veri yazması veya restore yok.

**Açık:** Yeni kod henüz API/Web paketine kurulmadı. CLEAN'ın native writer/kimlik ve CRM ilişkileri sentetik profile bağlı; yalnız katalog etiketini/bayrağını değiştirmek gerçek işletme profilini oluşturmaz. Normal yerel `semih` kimliği eski native hedefte aynı adla bulunmadı; oturumlar varsayımla eşleştirilmedi. Ortak normal işletme veri profili, doğrulanmış native kullanıcı/rol bağı ve CRM/native hedef uyumu hazırlanıp before-image/geri dönüş kapsamı kesinleşmeden bu iki ortam birleştirilemez. Depo/kaynak katkısı/yerel etki ve yeni geniş veri farkları kayıt bazında ilerlemeli; bütün kaynak, cariler, geçmiş yıl menüsü veya günlük ticari akış tamamlandı denmedi. İnsan kabulleri/sayaçlar değişmedi; gerçek personel ticari kullanımı/LIVE/T1 başlamadı.
**27 Ekim03:08TR — Güncel aktif ürün kapsamı:** F0102 stok STATUS=1, silinmemiş/iptal edilmemiş 12.066 tekil kart, 242 sayfada 02:48–03:07TR arasında okundu; atomik T1 değildir. Miktar/tarih filtresi yok; aktif sıfır stok dahil. AKTIF alanı bu kaynakta bütün satırlarda false olduğundan seçici değildir. Exact kaynak kimliğiyle mevcut native TEST125 ana kart karşılaştırması: 11.845 ana bilgi eş, 26 ana bilgi farkı, 195 eksik hedef, çoğul hedef kimliği0. Bu sayı barkod/birim/fiyat/depo-stok mutabakatı veya uygulama sayısı değildir. Özel kayıt bazlı kanıt repo dışındadır; kaynak/hedef veri yazması0. Üç ürün yalnız doğrulama dilimidir; hedef tüm aktif stok kartlarıdır. Cari kapsamı ayrı: aktif/pasif bütün müşteriler F0102, tedarikçiler muhasebe F0103; ad benzerliğinden birleştirme/temizlik yok, TRY/USD/EUR ve mevcut iki LL dışlama kararı korunur. Yeni normal okuyucu zinciri ve adaptör için56 hedefli test geçti; kurulum ve işletme kimliği/native/CRM bağı henüz tamamlanmadı, insan PASS yok.

Private kanıt dizinindeki `active-stock-cards-part-1..5.json`, `active-native-readonly.sql`, `active-native-readback.json` ve `active-master-comparison.json` kaynak okuma penceresini ve tekil karşılaştırmayı korur. Ham kartlar GitHub'a alınmaz. Önceki üç gerçek ekran kanıtı eski TEST125 okuyucusuna aittir; yeni kaynak kodun kurulumu olarak sayılmaz. Eksik kaynak alanı varken `OBSERVED_EQUAL` yerine `SOURCE_GAPS` döner. Yeni stok/cari/finans hareketi, servis restartı, rol veya karantina değişikliği yok.
## 27 Ekim — 221 aktif kartın mevcut yazıcı girdisi: teknik uyarlama tamam, uygulama yapılmadı

Önceki 197/42/6 sayımı SQLCMD'nin65.535 karakterde JSON özellik adlarını ve değerlerini fiziksel satıra bölmesi nedeniyle hatalıydı. Ham çıktı korundu; yalnız doğrulanmış taşıma bölünmeleri kaldırılarak katı JSON ve satır şekli kontrolüyle aynı saklı okuma yeniden çözüldü. Yeni Vega taraması yapılmadı: **12.066 =11.845 ana alan eş +26 ana alan farkı +195 eksik native kart; çoğul0**. İlk239 hazırlığından18 zaten eş kart çıkarıldı; gerçek kapsam221. Bu ana alan eşliği stok/barkod/fiyat veya insan kabulü değildir. `sqlcmd-scalar-json.mjs` için3 dar regresyon, bozuk transportu kabul etmek yerine reddeder.

`current-vega-product-slice.mjs::buildCurrentVegaCompletionInput/Plan`, mevcut `buildProductCompletionPlan` girdisini üretir; yeni motor/hesap/rol/guard istisnası kurmaz. Kaynak DESKTOP-KSRK0EQ/VEGA2026/F0102/D0007, gerçek UID ve fiziksel tür alanlarıyla yalnız221 kartın iki tam SELECT geçişi:221 kararlı,0 drift. Etkili kaynak ve tablo izinleri SELECT-only doğrulandı; dönem hareketlerine takvim yılı filtresi eklenmedi. Depo1→MERKEZ ilişkisi mevcut sealed PRODUCT sürümünün30 gerçek stok hareketi ve aynı ürünün kaynak stage warehouseGroups kanıtıyla bağlandı; varsayılan depo uydurulmadı. Native hedef Semih\\MELISADEV/MELISA_ERP_SIRKET_TEST_20260929_01; mevcut16.743 ürün/64.333 fiyat bağları ve16.743 ürün stage'i bütünlük için okundu, yeniden aktarılmadı.

Mevcut yazıcının gerçek plan sonucu: **180 yeni +7 mevcut kart; planlanan191 barkod,130 stok etkisi,588 yeni ve7 güncel satış fiyatı**. Bunlar UYGULANMIŞ SAYILAR DEĞİLDİR.34 bekleyen:17 mevcut karantina,2 daha önce yayımlanmamış native kart,5 barkod sahipliği çatışması,10 negatif kaynak stoklu yeni kart. Yedi mevcut kartın stokları6 ayrıştırılmamış lineage ve1 negatif miktar nedeniyle ayrıca korunur; diğer kesin alanları bağımsızdır. Eksik ad/birimli10 kayıt17 karantinanın içindedir; eklenerek yeni toplam oluşturulmaz. Yeni maliyet/alış referansı araştırılmadı; mevcut değerler yazılmaz.

Yedek: güncel COPY_ONLY/CHECKSUM **9.172.549.632 bayt**, HEADERONLY ve VERIFYONLY başarılı; gerçek restore yok. İlk yeni yardımcı önkontrolündeki iki kopya alan varsayımı, gerçek tek çıktı ve DATA+LOG ölçümüne göre düzeltildi: boş30.299.529.216 bayt, ayrılmış15.049.162.752, tek dosya üst sınırı+2GiB rezerv17.196.646.400. Kullanılan veri9.171.107.840 ve log61.792.256 bayt olarak ayrıca okundu. Temizlik/shrink/taşıma veya ikinci DB yok; eski yedekler korundu.

**Şimdiki tek ilk bağımlılık:** mevcut yazıcının `driver.verifyPause` bakım kabulünü bu yeni run için TEST125'in gerçek sahibiyle bağlamak. `apply-products.mjs` içindeki8Ekim `assert-paused.ps1`/pause-record makbuzu yeni yetki değildir; tekrar kullanılmaz. `start-owned-test.ps1::Invoke-ErpOwnedSession` mevcut supervisor döngüsü, `manage-owned-test-startup.ps1` yalnız Install/Remove/Inspect sunuyor. Taze salt okunur gözlem üç child'ın owner/sağlık eşliğini doğruladı; API4144 ve supervisor hâlâ çalışıyor, yeni-run pauseReady:false. Kaynak/plan hash ve yeni yedek hazır; sıradaki dar değişiklik yeni run'a bağlı owner bakım devri ve geri dönüş tanığıdır. Bu teknik iş mevcut TEST yetkisindedir; kullanıcıdan parola veya yeni genel izin istenmez. Guard gevşetilerek yazıcıya girilmedi. Uygulama/ticari DML0, restart0, hesap/rol0. Normal kullanıcı/yeşil ekran yeni verisi ve insan kabulü BEKLİYOR; çalışan source edb3c891/5194 ile sentetik CLEAN349/5244 birbirine karıştırılmaz.

Uyarlama6 dar regresyonda geçer: gerçek iki geçiş/UID, kaynak-hedef reddi, yalnız değişeni ayırma, bilinmeyeni sıfırlamama, ikincil koli birimini ADET fiyatına çevirmeme, manuel fiyat/yerel stok/hold koruması. Paket regresyonunda ortak saf sözleşme normal API payload'ına taşındı; migration compatibility export kaldı. DB02 projected bootstrap ve normal frontend/API kaynak grafı mevcut dar testlerde geçer; CI sonucu exact commit üzerinden ayrı raporlanır. Ham capture, native before-image, plan, kaynak kimlikleri ve yedek makbuzu yalnız mevcut repo dışı private kanıttadır.

### 27 Ekim — TEST125 mevcut kayıtlı görevine bağlı bakım hazırlığı

`scripts/canonical/test125-bound-maintenance-plan.ps1` **yalnız salt okunur hazırlık** yapar; stop/start/apply modu yoktur. Aynı startup-config, source edb3c891, TEST125 DB, kayıtlı görev/action/owner/working-directory, tek çalışan task instance ve onun EnginePID'sinin kayıtlı supervisor ile eşliği doğrulanır. Supervisor executable/argv/owner/doğum ve üç child'ın kayıtlı doğum/sahiplik/port/sağlığı bağlanır; native ayrıca SQL read-only/sysadmin0 olmalıdır. Başlangıç/launcher/manifest/task XML hash'leri ile gerçek instance ve doğumlar private hazırlık kaydına alınır. SID, hesap, argv ve süreç envanteri normal çıktıya verilmez. Değişmiş hedef, PID/doğum, task/action veya birden fazla instance işlem öncesinde reddedilir. Yeni görev/servis/daemon, task tanımı veya hesap/yetki değişikliği yoktur.

Gerçek salt okunur gözlem: **tek task instance, EnginePID=mevcut supervisor, üç child owner+healthy; desteklenen ScheduledTasks Stop/Start komutları mevcut**. Private `active-221-test125-maintenance-preparation-v1.json`, PRODUCT-48099bf7-757f-451a-885c-68125da8c9e7 run'ına bağlıdır. Durum `PREPARED_NOT_REHEARSED`, pauseReady:false, stop/start0 ve ticari yazma0. Bu hazırlık pause makbuzu veya writer admission değildir; eski pause-record kullanılmaz. Yeni kaynak yalnız kaynak worktree'sindedir, kurulu launcher değiştirilmedi.

**Sonraki gerçek bakımın somut yolu (bu tur uygulanmadı):**

1. Aynı owner mevcut hazırlığı taze tekrar üretir ve `Assert-Test125MaintenancePin` ile startup/launcher/package/task instance/supervisor doğum/child doğum eşliğini hemen stop öncesinde karşılaştırır. Tek scope TEST125 ve aynı PRODUCT run; sealed plan/input/code, yeni yedek ve before-image kontrolleri korunur. Diğer owner işlemi varsa başlanmaz.
2. Yalnız `Stop-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\'` kullanılır. Bu komut seçilen görevin **bütün çalışan instance'larını** durdurur; bu yüzden tek instance ve action eşliği önkoşuldur. Task disable/remove/register, genel süreç kill veya başka görev durdurma yoktur.
3. Stop dönüşü kanıt sayılmaz: aynı instance ve pinlenmiş supervisor gerçekten bitmiş olmalı. Mevcut starter'ın aynı single-owner mutex'i yalnız serbestse mevcut bakım sahibi tarafından tutulabilir; yeni mutex/control engine oluşturulmaz. Arada başka task instance/owner belirmişse uygulama reddedilir. Kalan API4144 yalnız taze tam sahiplik+doğum+listener eşliğinden sonra mevcut sınırlı süreç durdurma yordamıyla kapatılabilir; PID yeniden kullanımı/foreign süreçte durulur.
4. **Native4146'nın aynı kaynak/paket/DB ve read-only kimliğiyle ayakta kalması şarttır.** Task durdurma child'ları da sonlandırabilir; bu henüz prova edilmedi. Native kapanırsa migration yazıcısına girilmez, yeni başlatıcı üretilmez, doğrudan aşağıdaki normal geri dönüş uygulanır. API'nin gerçekten kapalı olması ve4144 listener olmaması tekrar doğrulanır. Ancak bunlardan sonra yeni-run pause makbuzu üretilebilir; önceden hazır `pauseReady:true` yazılmaz.
5. Mevcut writer, her verifyPause sınırında config/task pinleri, supervisor/instance yokluğu,4144 kapalı ve native aynı/read-only kanıtını taze ister. Snapshot/backup/CAS/replay/protection kontrolleri gevşemez. Açık transaction hata verirse kendi rollback'i çalışır; çalışan DB'ye restore/reset veya toplu inverse uygulanmaz. Bu hazırlık turu driver bağlamaz veya yazıcıyı çalıştırmaz.
6. Başarı veya hata sonrasında bakım sahibinin tuttuğu **mevcut** mutex bırakılır; aynı task XML/owner/action/source tekrar eşleşirse `Start-ScheduledTask -TaskName 'Melisa-ERP-TEST-Canonical' -TaskPath '\'` ile normal devam edilir. Start asenkrondur: dönüşü başarı sayılmaz. En fazla60 saniyelik sonlu beklemede yeni instance/supervisor doğum kaydı ve5194/4146/4144 için yeniden üretilmiş sahiplik+gerçek sağlık doğrulanır. Mevcut starter aynı exact sağlıklı child'ları sahiplik denetimiyle benimser veya eksikleri kendisi başlatır. Eski PID/makbuzdan çalışıyor denmez.
7. Taze eşleşme yoksa foreign sürece veya başka task'a dokunulmaz; normal start/sağlık başarısızsa somut `MANUAL_RECOVERY_REQUIRED` kaydı bırakılır, kör ikinci stop/start veya yeni daemon yapılmaz. Kurulu paket/config/task before-image'ı değişmediğinden geri dönüş aynı eski kurulu pakettir; backup restore değildir. CLEAN5244/4194/4196 ve CRM hedefleri bu yordamın dışında kalır.

**Beklenen kesinti:** yalnız eski native TEST125'in API yazma erişimi bakım süresince kapanır; Windows task sonlandırmasının child etkisi nedeniyle5194/4146 da kesilebilir. Kesinti henüz ölçülmedi, sıfır kesinti veya garantili süre vaat edilmez. Kaydedilmemiş ekran/taslaklara dokunulmaz. Native'nin korunması gerçek provada doğrulanmadan187grup uygulanabilir denmez. İnsan/normal kullanıcı kabulü bekler.

Yardımcı için4 dar offline test geçti: kütüphane importu/CLI ret çıktısı, mutation bulunmaması, task/action/owner/policy retleri ve stale PID-birth/instance/source/package boundary retleri. İlk test koşusunda beklenen CLI exit1 fixture tarafından hata sayıldı; fixture exit1+safe code'u doğrulayacak şekilde düzeltildi, üretim ret davranışı korunur. Gerçek stop/start, SQL DML, runtime değişimi ve kurulum **0**.

Desteklenen OS semantiği: [Stop-ScheduledTask](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/stop-scheduledtask), [Start-ScheduledTask](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/start-scheduledtask). Komut bulunması, durdurma/sağlıklı geri dönüş provası yerine geçmez.

**27 Ekim13:01:36–13:02:12TR gerçek tek bakım sonucu:** exact9cb0cfcd hazırlığı ve taze pinler doğrulandı. Aynı görev Stop1/Start1; supervisor durdu, native/web/API childları ayakta kaldı. API4144 çalıştığından verifyPause koşulu sağlanmadı: TEST125_TASK_STOP_LEFT_API_WRITER_RUNNING. Writer/transaction hiç başlatılmadı; ticari yazma0/uygulanan0. Finally aynı görevden yeni supervisor başladı; üç aynı child doğum/sahiplik/health ve startup/task XML/paket hash eşliği doğrulandı. Sonuç ABORTED_BEFORE_APPLY_NORMAL_RETURN_VERIFIED.180yeni+7mevcut uygulanmadı,34bekleyen korunur. Task config/schedule/hesap/kurulum değişimi, child kill, ikinci pencere, eski receipt veya restore yok. Private active-221-bound-maintenance-before/after/result-v2.json gerçek kanıttır; ilk PS7 tarih nesnesi karşılaştırma ret-v1 (stop0) korunur, PS5.1 gerçek pencerede kullanıldı. Yeni GUI/insan kabulü veya CI PASS iddiası yok. İlk somut engel artık belirsiz bakım yolu değil, kayıtlı görevin durdurulmasının API yazıcısını durdurmamasıdır.
