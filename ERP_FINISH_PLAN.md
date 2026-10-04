# Melisa ERP — bitirme planı

## Güncel finish tree — 4 Ekim 2026

**Toplam 49 iş: 🟢 5 tamam · 🟡 16 kısmi / kabul bekliyor · 🔴 28 açık. Genel ilerleme: %10,2 tamam; %32,7 kısmi.** Sayımlar yalnız aşağıdaki tekil yaprakları kapsar. Teknik hazırlık ve personel kabulü ayrı tutulur; kısmi işler tamam yüzdesine eklenmez. Aşağıdaki tarihsel F01–F06 satırları yeni açık iş veya ikinci finish tree değildir.

Ana hedef: gerçek SQL verisini kullanan, günlük mal kabul → alış → satış → tahsilat → gün sonu akışına ve Vega geçişine hazır ERP. Bu hedefin tümü henüz kabul edilmedi. Kaynak `C:\Sirket\ERP\melisa-erp-v2`, exact origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`. Çalışma dalı `codex/erp-finish-20261004`, uygulama tabanı `e0c18e3d36a48bc2caab33f8192655eb2fc5805d`; belge dalı veya eski main uygulama tabanı yapılmadı. Ayrı CRM kabulü PR #21'de korunur; o eski paralel dal güncel migration kodunun üstüne körlemesine alınmaz.

🟢: kayıtlı kapsamın kabulü tamam; yeniden ispat işi açılmaz. 🟡: kaynak/teknik hazırlık var, belirtilen gerçek kullanım veya işletme kabulü eksik. 🔴: somut uygulama/kanıt/karar eksik. Bilinmeyen maliyet, bakiye, barkod veya kur sıfır/tahmin ile tamamlanmış sayılmaz. Belirsiz kartlar karantinada kalır.

| ID | İş | Durum | Kanıt / kapanış ölçütü |
| --- | --- | --- | --- |
| P01 | Kanonik kaynak ve origin | 🟢 | SEMIH exact repo, temiz e0 tabanı ve fetch/push doğrulandı; eski kopyalar korunur. |
| P02 | TEST/LIVE süreç ve DB ayrımı | 🟢 | TEST 5194/4144/4146 → paket18/4e6b606 → Semih\\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01; LIVE farklı DB ve süreçlerde. |
| P03 | Tek TEST launcher ve paket/hash kaydı | 🟢 | Paket18 1.143 dosya manifest eşleşti; eski paket16 ve launcher geri dönüş kaydı korunur. |
| A01 | Stok kartı, kod/ad, barkod, stok, birim | 🟡 | 16.622 eşlenen kart teknik mutabakatlı; normal günlük stok ekranı ve personel kabulü eksik. |
| A02 | Satış/alış fiyatı, maliyet, döviz | 🟡 | 63.774 typed fiyat okuyucu hazır; NULL/gerçek 0 ayrımı korunur. Günlük operasyon seçimi/yazımı ve personel kabulü eksik. |
| A03 | Gerçek ürün fotoğrafı | 🔴 | Doğru kaynak kimliğiyle gerçek görsel bağlantısı/eksik görsel gösterimi ve normal ekran kabulü. |
| A04 | Gerçek müşteri ve dövizli bakiyeler | 🟡 | 371 müşteri/379 hesap açılışı eşlenmiş; normal kart ve defterde scope/UNKNOWN/karantina kabulü. |
| A05 | Gerçek tedarikçi ve dövizli borçlar | 🟡 | 401 tedarikçi/406 hesap SQL mutabakatlı; mevcut supplier.view sınırıyla normal izinli kart/defter kabulü eksik. |
| A06 | Kaynak güvenirliği ve karantina gösterimi | 🟡 | 176 kaynak/172 hedef/4 hedefsiz; API+SQL engeli ve negatif ekran provası hazır. İşletme kabulü bekliyor. |
| B01 | Ana Sayfa günlük iş sırası | 🔴 | Gerçek veri, hızlı görevler, ayrı döviz toplamları; 1440/1024/390 kabulü. |
| B02 | Stok arama/filtre ve detay | 🔴 | Yoğun tablo, net stok/birim/fiyat/görsel; üç genişlik ve boş/hata/yetki kabulü. |
| B03 | Cariler bilgi hiyerarşisi | 🔴 | Müşteri ve tedarikçi ayrı; hesap dövizi/borç işareti doğru; üç genişlik. |
| B04 | Satış günlük kullanım ekranı | 🔴 | Büyük net işlemler, gerçek müşteri/ürün satırları ve yetki; üç genişlik. |
| B05 | Alış günlük kullanım ekranı | 🟡 | İki ürünlü kabul ve kalıcı taslak ekranı, ayrı onay/iptal ve toplamlar masaüstünde çalışıyor. Tarayıcı ölçü ayarı uygulanmadı; 1440/1024/390 ve personel kabulü doğrulanmadı. |
| B06 | Finans günlük kullanım ekranı | 🔴 | Kasa/banka/tahsilat/ödeme ayrımı, doğru döviz ve büyük aksiyonlar; üç genişlik. |
| B07 | Raporlar filtre ve kapsam | 🔴 | Gerçek kaynak, NULL maliyet/kâr kapsamı, ayrı döviz ve açıklamalı export; üç genişlik. |
| B08 | Ayarlar günlük kullanım ekranı | 🔴 | Kullanıcı/izin/terminal/başlama/yedek durumlarını kanıtlı ve sade göster; üç genişlik. |
| C01 | Çok satırlı mal kabul | 🟡 | İki sentetik ürünlü normal TEST kabulü/ret/replay ve SQL etkisi doğrulandı: stok28/0→29/2; borç değişmedi. Genel kart kapsamı ve personel kabulü bekliyor. |
| C02 | Ayrıntılı alış taslağı | 🟡 | Kalıcı native taslak, kısmi140/80 TRY, finalize/iptal, rezervasyon ve stok ikinci kez artmaması gerçek TEST'te doğrulandı. 220 TRY taslak hazır; genel alış/personel kabulü eksik. |
| C03 | Dövizli alış fiyatı operasyonu | 🔴 | **Sıradaki tek kaynak işi:** typed okuyucudan doğru döviz/birim/kademe/kur snapshot seçimi; bilinmeyen kaynak ve yazım kabulü. Mevcut TRY fixture fiyatı gevşetilmez. |
| C04 | Gerçek satış ekranı kabulü | 🟡 | Önceki ayrılmış TEST satış/iptal kabulü korunur; günlük gerçek ekran/personel kabulü eksik. |
| C05 | Açık hesap | 🟡 | Yetkili satışın tahsilatsız cari etkisi baseline'da; normal ekranın limit/vade/yetki kabulü eksik. |
| C06 | Gerçek müşteri kartı | 🔴 | Normal kart, yetkili düzenleme, döviz hesabı ve belirsiz alan/karantina kabulü. |
| C07 | Gerçek tedarikçi kartı | 🔴 | Normal kart, izinli düzenleme, borç/hesap bağlantısı; supplier.view olmadan erişim açılmaz. |
| C08 | Kasa/banka günlük akışı | 🟡 | Ayrılmış TEST tahsilat/ödeme kabulleri korunur; fiziksel açılış/sayım ve personel kabulü ayrı. |
| C09 | Fiyat yazma/düzenleme | 🔴 | Fiyat tuple/provenance, yetki, audit, stale kontrol ve gerçek TEST ekranı; eski mühür ezilmez. |
| C10 | Sayım/iade/ters kayıt | 🟡 | Mevcut sayım ve aynı faturadan bağlı alış iadesi kabulü korunur; yeni çok satır kapsamı ve personel kabulü eksik. |
| C11 | Kullanıcı/yetki | 🟡 | Mevcut API izinleri korunur; günlük rol matrisi ve eksik normal kullanıcı negatif kabulü kapanır. |
| C12 | Fiziksel terminal | 🔴 | Gerçek cihaz/scanner/offline/sync; kaynak/API/DB/package kimlikli normal kullanım kabulü. |
| C13 | Windows otomatik başlama | 🔴 | Mevcut görev/launcher sahibi, logon/reboot/uyku sınırı ve gerçek açılış kabulü; LIVE değişikliği ayrı yetki. |
| C14 | Backup/restore | 🔴 | Ayrı sentetik restore hedefiyle prova, veri kaybetmeden geri dönüş ve operatör kabulü; VERIFYONLY restore değildir. |
| C15 | Günlük raporlar | 🟡 | Mevcut rapor kaynakları korunur; normal ekranın dönem/döviz/maliyet kapsamı ve export kabulü eksik. |
| D00 | Donmuş Vega açılış mutabakatı | 🟢 | RUN06 COMMITTED, eşlenen 16.622 ürün/772 cari/785 hesap/63.774 fiyat fark0, replay ek yazma0; yalnız bu kapsam. |
| D01 | 54 ürün belirsizliği | 🔴 | İşletme kimlik/birim/barkod kararı ve kaynak kanıtı; operasyon engeli A06'da korunur. |
| D02 | 122 cari belirsizliği | 🔴 | 28 müşteri/94 tedarikçi kimlik/döviz/bakiye kararı; tahmin/NULL→0 yok. |
| D03 | Eksik maliyetler | 🟡 | 10.552 NULL açık gösterilir; yeni kanıt veya açıklamalı işletme kabulü gerekir. Liste alış fiyatı maliyet değildir. |
| D04 | 71 yeni ürün delta | 🔴 | Gerçek kaynak salt okunur plan; yeni ID/alias/birim/barkod/fiyat/açılış zinciri, sentetik TEST prova. |
| D05 | 341 değişmiş ürün delta | 🔴 | Kaynak kimliği ve before-image ile eşleme; korunmuş yerel stok/maliyet etkisi; atomik TEST prova. |
| D06 | 74 değişmiş cari delta | 🔴 | Döviz hesaplarını ayrı ve exact etkileri korunarak eşle; güvenli kapsam belirsizliği açık kalsın. |
| D07 | T0/T1 cutover planı | 🔴 | Sorumlu/zaman, bütün kaynak yazıcı ve gecikmiş terminal kesimi, tutarlı snapshot; LIVE uygulama ayrıca onaylı. |
| D08 | İdempotent delta batch | 🔴 | Yeni immutable run/hash/plan, tam before-image, drift/red ve replay0; RUN06 writer tekrar kullanılmaz. |
| D09 | Son mutabakat | 🔴 | Yeni kesim/delta kaynak→native kayıt bazında fark0; fiyat sürümü/karantina mirası ve eski geçmiş korunur. |
| D10 | Committed rollback provası | 🔴 | Ayrı sentetik TEST etkisini geri al, sonraki hareketi ezme; yarıda transaction rollback'i yeterli değil. |
| D11 | Vega READ ONLY arşiv planı | 🔴 | Tek yazıcı devir sırası ve geçmişe salt okunur erişim; gerçek Vega mod değişikliği bu yetkide yapılmaz. |
| E01 | Modül bazında gerçek kabul | 🔴 | Her modüle normal TEST URL ve 3–5 deneme; rol/olumsuz durum/SQL etkisi ve kişi/tarih/kapsam kayıtlı. |
| E02 | Personelin günlük akış kabulü | 🔴 | Mal kabulden gün sonuna kullanıcı günlük işini deneyip kabul eder; ajan teknik testi insan kabulü değildir. |
| E03 | Görsel üç genişlik kabulü | 🔴 | 1440/1024/390 gerçek browser; etkilenen ekranlarda okunabilirlik, aksiyonlar, taşma/hata/boş durum. |
| F01 | Tek finish tree ve otomatik sıra | 🟢 | Bu tablo güncel iş kaynağı; root sayım/status günceller. `devam` sıradaki bağımsız açık işi seçer. |
| F02 | Branch/commit/PR/CI teslimi | 🟡 | e0 feature tabanı + seçilmiş portable ajan/CI dosyaları; gerekli iki check son tam head'de başarılı olacak. Merge/LIVE deploy yok. |

### Aktif dilim, sahiplik ve kabul

C03 aktif kaynak kapsamı: typed `purchase/CARD/0` açılış fiyatı, ayrı mühürlü ana birim/faktör1 kanıtı, exact8 kaynak → açık HALF_UP native4 projeksiyonu ve iki tarihli kur snapshotı. Gerçek kartlar salt okunur seçilir; native yazma yalnız ürün301986/tedarikçi13373/ADET×1 sentetik TEST kopyasına, satır1–5 adet ve toplam200 TRY sınırına aittir. USD40/EUR45, 4 Ekim tarihli açık sentetik prova kurlarıdır; piyasa kuru veya güncel Vega fiyatı olarak sunulmaz. Ayrı fiziksel kabul stoku bir kez oluşturur; kalıcı taslak borç oluşturmaz; kesinleştirme TRY borcu, iptal yalnız tarihsel kurla ters borç oluşturur. Eski TRY fiyat60/80 fixture ve15 guard tanımı gevşetilmez. Explorer yeni backend servis/routes; frontend yeni seçim bileşeni ve testPrices/testPurchase; SQL-Vega yalnız yeni companion kurulum kaynakları; root native proof köprüsü, mount/policy, plan, TEST kurulum/runtime ve Git sahibidir. C03 henüz 🔴; gerçek tarayıcı ve SQL kabulü tamamlanmadan durum yükseltilmez.

İlk C01/C02 dilimi teknik olarak TEST'te teslim edildi; [kabul kaydı](docs/erp-v2/canonical-20261004/purchase-batch-acceptance.md) personelin beş denemesini içerir. SQL source `46e10ce`, uygulama paketi18 `4e6b606`; kaynak yalnız CI/SQL companion eklediğinden çalışan uygulama hash'i ayrı kaydedilir. Sıradaki kaynak işi C03'tür. Backend API/model/native received-context, frontend alış ekranı/CSS, SQL kaynak kurulum ve bağımsız inceleme ayrı dosya sahipliğiyle yürütüldü; root kurulum/runtime/Git/plan sahibidir. Aynı dosyada paralel yazma yok.

İlk kabul iki farklı sentetik ürün, satır başına 1–5 ADET, TRY ve açık KDV/iskonto0 kapsamındadır. Bu dar prova genel dövizli fiyat yazımı, tüm ticari kartlar veya fiziksel terminal kabulü sayılmaz. Legacy tek satır/bağlı iade korunur. Taslak/pending stok ve borç değiştirmez; fiziksel onay stok oluşturur; finalize yalnız borç oluşturur; replay ikinci etki üretmez; sahte/yetkisiz/karantina satır bütün işlemi durdurur.

Yeni kod sonrasında uygun hedefli test/build, bağımsız review, normal browser ve SQL farkı kaydedilir. Personel kabulü olmadan ilgili yaprak 🟡 kalır. LIVE/Vega yazması, main merge, gerçek ticari kartlarda test yazması, credential değişikliği ve geri dönüşü zor işlem bu teknik yetkiye eklenmez.

Güncel yerel kaynak toplama: [3 Ekim kanonik baseline](docs/erp-v2/canonical-20261003/README.md). Aşağıdaki ilk envanter, EVDEKIPC devir anının tarihsel kaydıdır; SEMIH kaynak eşlemesi bu bağlantıdaki kanıtla güncellenir.

Güncelleme: 4 Ekim 2026. Bu dosya ERP bitirme işinin **tek güncel kaynağıdır**. Kısa görünüm: [STATUS.md](STATUS.md). Kaynak ve ortam kanıtları: [envanter](docs/erp-v2/inventory-20261003.md).

## 4 Ekim güncel migration dilimi

Vega → Melisa gerçek TEST açılışı ve bağımsız stok/cari/fiyat/maliyet mutabakatı tamamlandı; exact kapsam fark0, genel cutover PARTIAL. Kabul edilmiş fiyat okuyucusu önceki PASS kapsamıyla korunur. Sonraki gerçek açık olan operasyon karantinası kapandı: 176 kaynak/172 hedef/4 hedefsiz tedarikçi, immutable kimlik bağı ve API/SQL işlem engeli; 21 hedefli test, bağımsız37 tablo koruma ve gerçek normal kullanıcı negatif API/masaüstü/mobil provası PASS. Günlük [Aktarım karantinası](http://127.0.0.1:5194/is-akisi-taslagi.html#migration-quarantine) personelin kabulüne hazır; insan kabulü BEKLİYOR.

Güncel kaynak codex/canonical-live-20261003; SQL/ticari kod45959295421c61b40bf49b1cc51bcb01dce784f4/paket15, nihai dokümantasyon TEST paketi CANONICAL-VEGA-MIGRATION-TEST-20261004-16. Zorunlu launcher C:\Sirket\ERP\runtime\start-canonical-test.ps1, web5194/API4144/native4146; yalnız ayrı TEST DB. LIVE/Vega yazımı yok. [Migration planı](ERP_MIGRATION_PLAN.md), [STATUS](STATUS.md), [PR15](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/15).

Sıradaki migration kaynak eksiği güncel deltanın ayrı idempotent TEST batch'iyle prova edilmesidir; 71 yeni/341 değişmiş ürün ve74 cari henüz uygulanmadı. Typed fiyat yazımı, belirsiz kimlik/bakiye/maliyet iş kararı, fiziksel finans, atomik kesim ve geri dönüş kabulü açık. Önceki çok satırlı mal kabul ve fiziksel terminal işleri ayrıca açık ERP kapsamlarıdır; bu görev çalışan bağlı iade/satış akışlarını yeniden ispatlamadı.

## 3 Ekim SEMIH sonucu — tamamlanan önceki dilim

Kanonik kaynak `C:\Sirket\ERP\source\canonical-live-20261003`; origin `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`, aktif dal `codex/canonical-live-20261003`. Kullanıcının son talimatındaki bu kök uygulanır. F02 kaynak eşlemesi, F03 dosya sınıflaması ve önceki F05 teknik kabulleri korunur; çalışan satış/tahsilat/sayım yeniden ispatlanmadı.

Bulunan ilk gerçek eksik kapatıldı: **mal kabulden yeni alış faturası → aynı faturanın kendi satırından mal iadesi**. Önce iade ekranı farklı, sabit bir TEST faturası kullanıyordu. Yeni bağ kaynak fiyatı/kalabilecek miktarı gösterir; taslak etkisizdir, yetkili onay gerçek SQL stok/borç etkisi üretir. Aktif iadeli kaynak fatura iptal edilemez; iade ters kayıtla kapatıldıktan sonra iptal edilebilir. Alış kalan borcu onaylı iadeyi de düşer.

Fatura #25083 / satır #93181 → iade taslağı #31 → iade #223: 1 ADET ve 60 TRY borç ters etkisi; ters kayıtta ikisi de geri geldi. Kasa/banka hesapları ve hareketleri aynı. 10 API + 4 UI hedefli test, 14 gerçek tarayıcı kontrolü PASS. SQL'deki iki stok, iki tedarikçi ve iki audit kaydı korunur. İlk audit kapsam reddi bütünüyle rollback edildi; aynı taslaktan devam edildi. Toplam alış istek geçmişinin 30 kayıt engeli kaldırıldı; geçmiş boyutu iptal/ters kaydı kilitlemez. Yeni ticari kural, tablo veya kolon eklenmedi.

Son TEST paketi `CANONICAL-LINKED-RETURN-TEST-20261003-05`; tam commit ve hash paketin `release-manifest.json` dosyasında. Launcher `C:\Sirket\ERP\runtime\start-canonical-test.ps1`, ekran `127.0.0.1:5194`, API 4144, native 4146 salt okunur. DB `MELISA_ERP_SIRKET_TEST_20260929_01`; LIVE erişimi/dış işlemler kapalı. [Yeni kabul](docs/erp-v2/canonical-20261003/linked-purchase-return-acceptance.md) · [Teslim](docs/erp-v2/canonical-20261003/delivery.json).

**Sıradaki insan kabulü:** bu bağlı akışı günlük iş sırasıyla TEST ekranında görmek. Bu akış ayrılmış kayıtlarla iş kabulüne hazırdır. **Sıradaki gerçek kaynak eksiği:** çok satırlı mal kabul/ayrıntılı alış taslağı; fiyat kartı yazımı ve fiziksel native kabulü de açık. Önceki “kalan tek iş insan kabulü” ifadesi eski dar teslim kapsamına aitti; tüm ERP tamamlandı anlamına gelmez. LIVE geçişi yapılmadı.

Aşağıdaki eski host envanteri ve F02 bekleme anlatısı tarihsel devir kaydıdır; güncel durum yukarıdaki bölüm ve STATUS'tur.

## Çalışma ilkesi ve mevcut durum

**Çalışanı koru; kanıtlı kabulü yeniden açma; dağınık kaynakları eşleştir; yalnız gerçek eksikleri düzelt.** Mevcut çalışan ERP işlevsel baseline'dır. GitHub'da en yeni tarihli dosya veya `main` etiketi, kendiliğinden çalışan sürüm anlamına gelmez.

ERP sıfırdan yapılmayacak. [9 Temmuz insan kabulü](docs/erp-v2/final-human-acceptance-log.md) ve Eylül ayındaki sınırlı gerçek SQL/tarayıcı kabulleri korunur. Bunlar kendi sürüm ve kapsamlarında geçerlidir; yeni bir ortamın tamamı için otomatik kabul sayılmaz. Bir özellik ancak somut hata, ilgili kod değişikliği veya farklı veri kaynağı varsa yeniden incelenir.

3 Ekim'de inceleme **EVDEKIPC / WARD-V2** üzerinde başladı. Yerel eski kaynaklar ile GitHub incelendi. **SEMIH'teki çalışan kaynak, tüm worktree'ler, TEST/LIVE süreçleri ve gerçek DB kimlikleri henüz doğrudan envanterlenmedi.** Bu nedenle kanonik deployment seçimi ve TEST kurulumu tamamlanmış değildir. Kullanıcı aynı sohbeti SEMIH'e geçiremediğini ve orada yeni sohbet açacağını bildirdi. Devir kaynağı bu dosyadır; kullanıcı uzun görev metnini yeniden taşımayacak. Yeni sohbette önce araçların host/çalışma yolu kontrol edilir.

Bu oturumda mevcut ERP kopyalarına, servislere veya ticari verilere müdahale edilmedi. GitHub `main`den bağımsız `codex/erp-finish-20261003` dalında dokümantasyon hazırlanıyor. Bu dalın tabanı `577c0cb9d0953635b30088fa23e1e887c7b75775`; LIVE tabanı olarak kabul edilmedi.

## Yetki ve ilerleme

Kullanıcının 3 Ekim talimatı, TEST'te gerekli kod düzeltmesi, restart, branch/commit/push ve testleri ayrıca onay almadan yürütmeye izin verir. Eski dokümanlardaki genel onay maddeleri bu yetkilendirilmiş işler için tekrar onay döngüsü oluşturmaz. İşe ek bridge, test kotası veya yapay onay paneli eklenmez; uygulamanın gerçek kullanıcı yetkileri ve ticari veri bütünlüğü korunur.

Yalnız geri dönüşü zor LIVE değişikliği, veri kaybı, gerçek ticari kayda istenmeyen yazma veya credential riski için açık onay istenir. TEST adlı bir servisin gerçekten ayrı DB'ye bağlı olduğu anlaşılmadan ticari test yazımı yapılmaz. Şifre, token, connection string, müşteri dökümü, yedek ve ortam dosyası Git'e girmez. Eski kopyalar kanıtlanmadan silinmez.

## Tek repo ve ortam düzeni

Mevcut `melihsnyldzz-ui/melisa-erp-v2` ailesi korunacak; yeni ERP reposu açmaya şu an gerek gösteren kanıt yok. Uygulanacak düzen:

| Parça | Hedef | Bugünkü durum |
|---|---|---|
| Kaynak | Tek ERP repo; web/API/native terminal ve gerekli ortak sözleşmeler burada | GitHub aile ve dalları bulundu; SEMIH kaynakları eksik |
| `main` | Kabul edilmiş kaynak; çalışan LIVE sürümü ayrıca tam commit ile kayıtlı | Mevcut `main` ile LIVE eşitliği bilinmiyor |
| `candidate/test` | Çalışan baseline üzerine yalnız seçilmiş eksik/düzeltmeler | Çalışan baseline eşleşmesinden sonra kurulacak |
| TEST | Web 5194 → API 4144 / native 4146; tek launcher ve açık TEST etiketi | Kullanıcının bildirdiği düzen; güncel yerel süreç/DB kanıtı bekliyor |
| LIVE | Web 5188 → API 4114 / native 4116; sabit sürüm ve geri dönüş kaydı | Kullanıcının bildirdiği düzen; mevcut çalışma korunuyor |
| Geliştirme | API 4100; TEST/LIVE ile karıştırılmaz | SEMIH Tailscale adresinden health/version yanıtı alındı |
| Vega | VEGA2026 kaynak bağlantısı ayrı kaydedilir | Kaynak rolü biliniyor; güncel server/instance/firma/dönem eşlemesi eksik |

Her deployment kaydı yalnız host, checkout yolu, branch, tam commit, varsa yerel fark özeti, web/API adresleri, servis/launcher adı, DB server/instance/adı, rolü ve son kabul bağlantısını içerir. Gerçek secret içermez. Host görülmeden yeni port, ikinci TEST veya tahmini DB yaratılmaz. Geri dönüş; önceki uygulama sürümü ve yapılandırmasıyla yapılır, iş kayıtlarını silerek yapılmaz.

## Önce yapılacak somut işler

| İş | Durum | Tamamlanınca görülecek sonuç |
|---|---|---|
| F01 — EVDEKIPC ve GitHub kaynak envanteri | Tamam, kapsamı sınırlı | 10 mevcut ilgili repo + bu inceleme checkout'u, korunacak yerel farklar, 14 uzak dal kayıtlı |
| F02 — SEMIH çalışan kaynak eşlemesi | SEMIH erişimi bekliyor | LIVE/TEST süreç → dosya → commit → DB haritası; native backend dahil |
| F03 — Değerli adayları çalışan kaynakla uzlaştırma | Karşılaştırma kısmen hazır | Her fark için zaten mevcut / alınacak / gereksiz kararı; eski kopyalar korunur |
| F04 — Tek TEST çalıştırma ve sürüm kaydı | F02'ye bağlı | Kullanıcının açabildiği 5194 ve doğru TEST API/DB bağlantısı |
| F05 — Gerçek iş akışındaki açık eksikleri kapatma | F02 sonrası hata bazında | Her düzeltme TEST ekranında görülebilir; bilinen kabuller tekrarlanmaz |
| F06 — Günlük kullanım ve LIVE geçişi | Açık | Kabul edilmiş TEST sürümü, somut kalan riskler ve gerektiğinde tek LIVE onayı |

F02 için SEMIH'te ilk bakılacak yerler: çalışan süreçlerin gerçek dosya yolları; `C:\Sirket\ERP`; `C:\Users\Xaser\Documents\Codex\2026-09-30\task`; kullanıcı GitHub/Codex worktree dizinleri. Bunlar geçmiş kayıtlardan gelen arama başlangıçlarıdır, güncel kanıt değildir. Eski `ERP_STATUS.md` ve teslim paketleri silinmez. Önceki erişim/gate metinleri yeni iş listesi gibi kopyalanmaz; yeni hostta gerçek erişim ve mevcut çalışan durum esas alınır.

## İşyerinin günlük akışı

“Mevcut/kabulü kayıtlı” yeniden geliştirme işi değildir. “Eşleme eksik” de özellik bozuk demek değildir. Her açık satır yalnız somut eksik bulunduğunda kod işine dönüşür.

| İş akışı | Korunan çalışma / kayıt | Gerçekten tamamlanacak nokta |
|---|---|---|
| Sabah gelen malı sayma, barkod indirme/etiket | Ürün/barkod ekranları mevcut; stok sayımı için Eylül tarayıcı/SQL kabulü var | SEMIH'te kullanılan mal kabul ve barkod indirme yolunu eşleştir; eksik veya çalışmayan indirme/etiketi düzelt |
| İlker'in alış, stok ve fatura girişi | Eylül kabulünde 10 × 12 TRY alış: stok 10, tedarikçi borcu 120; taslak etkisiz | Çalışan ekrandaki karşılığı ve açık hatalar; tüm alış modülünü yeniden yapma |
| Terminal satışı ve stok düşümü | ERP Core satışı kabul edilmiş; terminal mükerrer gönderim/transaction için ayrı gerçek SQL kabulü mevcut | Native istemci ile çalışan native API kaynağını eşleştir; mevcut kabulün hangi sürüme ait olduğunu koru |
| Muhasebenin eşzamanlı tahsilat/kasa/cari işlemi | 20 tahsilat + 10 ödeme; cari 40, tedarikçi 110, net kasa 10 örneği kayıtlı. Kasa kapanışı/çakışma düzeltmeleri ayrı dalda | Çalışan kaynakta bu düzeltmelerin bulunup bulunmadığı; yalnız eksik farkın eşzamanlı akışı |
| KDV toplamda | Kullanıcının açık gereksinimi | Mevcut fiş toplamı, indirim sonrası KDV ve çıktıyı incele; eksikse toplamda gösterimi düzelt. Vergi oranı uydurma |
| USD / EUR | İşlem anı kur snapshot'ı, ayrı döviz kasa ve eksik kur görünürlüğü için mevcut çalışma/kabuller var | Güncel kaynakta doğru dalı koru; farklı dövizleri tek para gibi toplama; eksik kuru 1 veya 0 sayma |
| Açık hesap | 26 Eylül şirket kararı: yetkili açık hesap satışı tahsilat olmadan cari borç oluşturabilir | Güncel uygulanmış akışı ve yetki/limit/vade bağını eşleştir; satışa sahte tahsilat ekleme |
| Tedarikçi borç / ödeme / dönüş | Alış borcu ve ödeme kabulü; tedarikçi hareketleri mevcut | Tedarikçiye mal dönüşünün gerçek ekranı ve stok/borç/ödeme etkisindeki eksikler |
| Müşteri iadesi | Satış iptali kabulü mevcut; iptal otomatik nakit iade değildir | Kısmi/tam mal iadesi, cari alacak ve gerekiyorsa ayrı ödeme akışının mevcut kapsamını bul; eksik kısmı tamamla |
| Sayım / fark | Gerçek tarayıcı 5→7→6→8; üç hareket, üç audit; neden/yetki/stale kontrolleri kayıtlı | Bu sürümün çalışan kaynakta olup olmadığını eşleştir; aynı kabulleri sırf belge için yeniden çalıştırma |
| İptal / düzeltme | Gerçek servis/SQL kabulünde mükerrer iptal tek etki; kapanmış kasaya parasal düzeltme engeli | Güncel TEST'e alınacak fark varsa yalnız etkilenen akış; geçmiş fişleri silme |
| Son alışa göre fiyat / maliyet | Son net alış maliyeti ve ağırlıklı ortalama maliyet ayrı mevcut kavramlar | İlker'in kullandığı son alış fiyatının öneri ve ekranda görünmesi; geçmiş satış maliyet snapshot'ını güncel fiyatla ezme |

## Değerli kaynaklar ve kabulün devri

- `codex/commerce-erp-quality-20260908` (`f787cfe…`), mevcut `main`den 64 commit ileride; 275 dosya farkı var. Terminal satış güvenliği, kasa/fiş/sayım/döviz/rapor ve çıktı düzeltmeleri içeriyor. Hepsini körlemesine birleştirme. SEMIH'te zaten olanları ayır, yalnız eksikleri aktar. [Kabul kayıtlarının dizini](docs/erp-v2/inventory-20261003.md#korunan-kabul-kayıtları).
- `review/erp-simplification-20260915` (`aea716f…`): 1 commit, 10 dosya; menü sadeleştirmesi ve kanıtsız “hazır/eksi stok yok” etiketlerinin kaldırılması. Ticari kabul veya native backend teslimi değildir. Commerce dalıyla ortak menü dosyaları var; kaynak okunarak uzlaştırılmalı.
- `codex/native-terminal-source-20260929` (`552491b…`): 1 commit, 74 dosya; native Android candidate.18-t2 kaynak koruması. **Uyumlu native backend bu teslimde yok.** Android kaynağını main'e almak tek başına terminal entegrasyonunu bitirmez.
- Mayıs/Haziran EVDEKIPC kopyaları ve değiştirilmiş UI/terminal dosyaları envanterde korunuyor. Son tarih tek başına değer ölçüsü değildir; kullanıcı farkları kaybolmaz.

## Kabul ve bitiş ölçütü

Bir düzeltme için kayıt: sorun → değişen dosya/commit → TEST adresi → iş ekranındaki sonuç → stok/cari/kasa etkisi → kalan somut eksik. Otomatik test/HTTP 200 yalnız teknik destek kanıtıdır. Önceden kabul edilmiş değişmeyen özellikler yeniden açılmaz. Yeni/düzeltilen akış kullanıcıya gerçek ERP ekranında gösterilir; iş kabulü kullanıcının gördüğü sonuca bağlanır.

Son teslim: tek kanonik kaynak; tek anlaşılır TEST/LIVE eşlemesi; korunan eski kopyalar; bu plan ve kısa STATUS; sabah mal kabulden satış/tahsilat ve gün sonuna günlük kullanılabilir ERP. **Bu teslim henüz tamamlanmadı.** Mevcut sonraki adım F02'dir; sırf yeni sprint üretmek için özellik açılmaz.
