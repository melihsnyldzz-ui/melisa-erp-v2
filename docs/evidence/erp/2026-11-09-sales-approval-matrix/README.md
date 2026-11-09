<!-- WAREHOUSE-EMPTY-CAPTURE-FIX-20261109 -->
## 9 Kasım — SQL515 düzeltildi; tam salt okunur ön kontrol geçti

Boş tablonun eski FOR JSON scalar özeti NULL ve ardından SHA2_256 sonucu NULL kaldığı için NOT NULL envanter alanı SQL515 veriyordu. Gerçek iki tablo tanısı bunu doğruladı. Düzeltme yalnız kilit altında sıfır satır olduğu doğrulanan tabloyu standart boş diziyle özetler. Dolu tabloda NULL/boş dizi reddi ve diğer SQL/guard/CAS bölümleri korunur.

Sekiz hedefli test geçti. Üründen birebir alınan iki parça gerçek SQL üzerinde SERIALIZABLE/ROLLBACK ile bir kez denendi: audit_logs223 için önceki hash eşit, boş auth_refresh_tokens için boş dizi özeti eşit; ikisi de NULL olmayan32 bayt. Ham satır/JSON/hash/token değeri sonuç olarak çıkarılmadı. Dört SQL metni ayrıştırması0 hata; bağımsız kaynak ve salt okunur çalıştırıcı incelemeleri GO.

43 tabloyu kapsayan düzeltilmiş tam salt okunur ön kontrol de bir kez başarılı oldu:223 audit, depo30007 pasif ve RV0x000000000011BB11. Güncel47 native alan okuması ile kurulu80662275/paket21de9872 aynı hedefte doğrulandı. Bu adımda yeni fiş, hesap etkinleştirme, rol/izin, credential, servis veya runtime yazısı yok. Gerçek depo senaryosu ve yabancı fişe yazma reddi açık; bütün ERP/insan/LIVE kabulü değildir.

Kanıt: Masaüstü/ERP/kurulum/warehouse-current-prerequisites-v1; sql515-product-regression-result.v1.json SHAa5c490ed…, warehouse-lifecycle-initial-readback.json SHA57da8717…, empty-capture-targeted-tests.v1.tap SHA55478c50…. Yeni public-preparation-manifest.v4.json kaynak düzeltmesini bağlar; önceki manifestteki SQL hiç çalışmadı ifadesi tarihsel hazırlık kapsamındadır. Çalışan uygulama paketi değişmez.

# DES-19 indirim ve vade onayı: gerçek kurulum ve normal ekran

## 9 Kasım — Depo faz dosyası düzeltildi; gerçek salt okunur ön kontrol SQL515 ile durdu

Aktivasyon öncesi runtime kanıtı artık yalnız warehouse-lifecycle-preactivation-runtime.json, pasifleştirme/normal form sonrası kanıtı normal-form-source-runtime.json olarak bağlanır. Saf action→dosya adı işlevini gerçek BoundJson tüketir; eski karar/hedef/hash/NoReparse/CreateNew/CAS/UNKNOWN korumaları aynı. PowerShell AST0 hata, iki geçerli/dört ret mapping durumu ve üretici-tüketici eşleşmesi doğrulandı. Önceki23 ilgisiz sentetik test tekrar edilmedi. PS1 c469029c ve yeni hedefli test662b7857; manifestv3 1e5abc47 (17 yardımcı kaynak/aynı12 guard bağımlılığı). Eski kanıt dosyası ezilmedi.

Aynı turda mevcut tek kullanımlık kararla salt okunur yürütme ön kontrolü yapıldı. İncelenmiş observe SQL c3af3bfd, sabit hash'i zorunlu tutan gözlemci6dddfc42 üzerinden bir kez çağrıldı; SQL515/WH_READ_FAILED verdi ve doğrulanmış readback üretmedi. Bu ayrı SQL ön kontrol engelidir; dosya adı çakışması kapanmıştır. Kesin hata noktası henüz kanıtlanmadı. Kaynaktaki @before.h için boş tablo aggregate/hash ifadesi olası adaydır; gerçek NULL/JSON/hash verisi çıkarılmadı veya uydurulmadı. Yeni SQL renderer düzeltmesi bu dar işte yapılmadı.

Başarısız RO denemesinden sonraki bağımsız native okuma SHA34024d8e, önceki03ecfd65 ile47 alan/5korunan kümede birebir aynı:223audit,7kullanıcı,6rol,39uygulama izni ve aynı404SQL profili. Depo30007 pasif, RV11BB11. Kurulu80662275/paket21de9872/317kaynak ve sahiplik kontrolleri geçti. Snapshot başına iki ardışık transaction birleşik atomik değildir. Hiç yeni fiş, uygulama POST'u, aktivasyon/pasifleştirme, credential/rol/izin/servis/runtime değişikliği yok; yazma hakkı kullanılmadı. Normal depo senaryosu ve yabancı fiş reddi ayrı NOT_RUN; K10/insan/LIVE kapanışı verilmedi.

Yerel kanıt warehouse-current-prerequisites-v1: phase-slot-targeted-check.v1.json SHA2cd267fb, public-preparation-manifest.v3.json SHA1e5abc47, warehouse-readonly-initial-failure.v1.json SHA34da8600. Aynı açık hedef için sonraki somut ihtiyaç, iki izinli boş/dolu kontrol tablosunda yalnız NULL bayrağı/sayı/uzunluk döndüren dar RO tanıyla515'in nedenini bulmaktır; bu tanı burada çalıştırılmadı. R1/tekTEST sahibi ve merkezplan/Excel aynı; eski kaynak/kanıtlar korunur.


## 9 Kasım — Depo önkoşulları: yalnız kaynak ve çevrimdışı doğrulama

Bağımsız hazırlık incelemesi GO_NO_NEW_P1_P2: `independent-review.v1.json` SHA `7d467b452733f1d5b9ca267727aa738523a30c2d444f8a428590d035c8c611a0`. İnceleme yalnız kaynak/çevrimdışı kanıt içindir; yürütme kabulü değildir.

Önceki koşullu yürütme, güncel depo giriş tüketicisi ve 404 izinli çalıştırıcı doğrulanamadığı için hiçbir yazma yapmadan durmuştu. Ayrı hazırlık göreviyle [dar yardımcı kaynakları](../../../../scripts/desktop-empty/warehouse-continuation/README.md) eklendi. Fiş15'te gerçekten kullanılan dedicated warehouse broker'ı SHA894205d4 ile değişmeden yeniden kullanılır; satış/müdür okuyucusunun yetkisi genişletilmedi. Yeni tüketici yalnız aynı30007/rol10, güncel karar/öneri, bağımsız aktif kullanıcı RV'si, runtime, kapalı ağ kaydı ve normal maskeli form kanıtlarıyla çalışabilir. Belgeli tab.id, her await çevresinde adres/sekmeyi kontrol eder; 30 saniyelik binding ve CreateNew intent aynı girişin otomatik tekrarlanmasını engeller. Sır yalnız eski özel pipe→normal parola alanına taşınır; hata/buffer temizliği korunur. Public ESM tanımının CUA ortamına yüklenmesi doğrulandı; fonksiyon çağrılmadı, gerçek sekme/giriş/broker kullanılmadı.

Yeni SQL derleyici tam mevcut V7 guard'ını ve404 izin profilini kullanır. Windows-owner ODBC çalıştırıcısı varsayılan ValidateOnly; gelecekte yalnız exact karar, öneri, kaynak/SQL hash'leri, taze native/readback/runtime/önkoşul kanıtları ve CreateNew intent ile tek CAS yapabilir. Yalnız users30007.is_active/doğal RV ve bir audit değişir; diğer kayıtlar aynı transaction içinde korunur. Pasifleştirme gerçek etkinleştirme RV'si ve bağımsız kanıt ister. UNKNOWN yazma tekrar gönderilmez. Eski400bd/RV111ED1 SQL ve runner değiştirilmedi veya çalıştırılmadı.

23 benzersiz sentetik test PASS/0skip:11 normal form,10 yaşam döngüsü,2 test koruması. Node test sürecinde ağ/alt süreç/özel dosya girişleri engellidir; bu Windows firewall değişikliği veya OS sandbox iddiası değildir. Dört SQL metni TSql160Parser ile0 hata; kalıcı DML hedefleri yalnız users UPDATE ve audit_logs INSERT. PowerShell AST0 hata, host script çağrılmadı. Bir ara fd koruması Node'un public modül yüklemesini durdurdu; yalnız guard edilmiş public open/close descriptor'larına izin verilerek düzeltildi. İlk C# parser visitor referans hatası gözlemcinin salt AST yürüyüşüyle giderildi; ikisi de gerçek SQL denemesi değildir.

Yerel D15 kanıtı: Masaüstü/ERP/kurulum/warehouse-current-prerequisites-v1. Son public manifestv2 SHAa5b38c8d… (16 yardımcı kaynak+12 guard bağımlılığı), verification-result.v1.json SHAd322f630…, combined-offline-tests.v3.tap SHA4350deae…, parserproof SHA6079ce39…, tanım-import kanıtı SHA55b46c5a…. Ara koşular23 sayısına eklenmez. Gerçek canlı binding/activation proof üretilmedi; güncel223 başlangıcı SQL'de okunmadı. Hesap açma, credential/rol/izin değişimi, gerçek broker/sır/SQL/ERP ağ çağrısı, runtime/servis işlemi yok. Kurulu uygulama80662275/paket21de9872 bu kaynak hazırlığından ayrı. Gerçek depo olumlu senaryo, yabancı fişte yazma reddi, insan/cihaz/LIVE ve K10 tam kabulü açık; R1, tek TEST sahibi, merkezplan/Excel ve özgün kapanış sayaçları aynı.


## 9 Kasım K10-02 devamı: aktör30013 kendi fişinde normal beş geçiş

Bağımsız gerçek kanıt incelemesi `SCOPED_GO_NO_NEW_P1_P2`: `own-lifecycle-actual-independent-review.v1.json`, SHA `92cc399165ad52fb81cca4f5d88dc080daaecf88f15f222938ccbb2066151886`. Yedi komut, korunum ve sıfır yeni finansal etki uyumlu; yabancı SQL yazma/depo denemesi ile tam K10, insan ve LIVE kabulü bu sonucun dışındadır.

Saf kanıt doğrulayıcı root tarafından bir kez çalıştırıldı: exit0, `K10_INSTALLED_OWN_PREPARATION_LIFECYCLE_VERIFIED`. Sonuç `own-lifecycle-verification.v1.json` SHA `13cb1c976e54710d4442a9e4bfcae6f4cb4068c99187c80a35e2ef270256d36e`; dar kapsamlı birleşik sonuç `delivery-result.v1.json` SHA `7d2f4d0249d275fcafe74fce161af1859f105c0f7fde686082199c45baabceb9`. Verifier ve contract ön incelemesi GO; final gerçek kanıt incelemesi ayrıca kaydedilir. Doğrulayıcı yalnız yerel kanıtı okudu ve kendi CreateNew çıktısını yazdı; yeni SQL/UI/runtime işlemi yapmadı.

Uygulama kaynağı80662275/paket21de9872 ve owner39008/worker3828 değişmedi. Normal aktör30013, yeni21/24TRY üzerinde beş işleme201COMMITTED/replayed=false aldı; altı journal CREATE dahil saklandı. Son durum CANCELLED, personel30013/30013/30013; iki rezervasyon RELEASED, bir koli/iki kalem korunur. Sevk/finansal etki yok. NormalUI'nin restore ettiği DRAFT19, bağımsız incelenmiş dar plan ekiyle yalnız normalCANCEL kullanılarak kapatıldı; veri silinmedi, eski fiyat/iskonto/kalem/onay225–226/bağ228/CREATE journal korundu.

| Kanıt | Sonuç |
| --- | --- |
| Kendi PREPARE/SAVE_CARTONS/READY/CHECK/CANCEL | Gerçek normalGUI+201yanıt+aynıUUID/gövde/journal/sürüm+seçiliSQL; fiş21 |
| Eski19temizliği | AyrıCANCEL UUID2a38231c-3639-4a83-8dd9-bf8d0a10474f; DRAFT→CANCELLED,0rezervasyon |
| Eski15/18/20 ve seçili kalemler | Başlık/workflow/journal ve seçili tam kalem satırları korunur; bütün tarihsel kalemler değil |
| Audit |219→223; yeni240CANCEL19,241CREATE21,242pricing.bound21,243CANCEL21; eski219korunur |
| Güvenlik |7kullanıcı/6rol/39uygulama izni/3ayar ve404SQLhak aynı; hesap açma/etkinleştirme/DDL/GRANT yok |
| Finans/stok | Yeni hareket yok; ürün10/11=5/6, hesap110=23TRY, kasa1=9TRY; eski satış/tahsilat tekrarlanmadı |
| Başka personele ait fişte yazma | NOT_RUN_TOOL_CAPABILITY_BLOCKED; hiç business isteği gönderilmedi |
| Aktif depo | NOT_RUN;30007pasif. Eski15lifecycle tamam; yeni dar karar önerisi uygulanmadı |
| İnsan/cihaz/LIVE | BEKLİYOR; bu ajanGUI/native kanıtıdır |

Yerel dizin `C:/Users/Xaser/Desktop/ERP/kurulum/k10-installed-role-boundaries-v1`: normal-role-wire.json yalnız iş isteği/yanıtı; fresh-*-body/response.json, fresh-checked ve fresh-cancelled DOM/PNG; before-19-cleanup/after-19-cleanup/before-fresh-cancel/after-own-five-selected-own-workflows.json. Son seçili snapshot SHA `a48d3233a9fcd42099ed49fdf8e440b8f35806e347742bbf5c46a6d0bdd795f8`. Native gözlemler preparation-staff-v1 altında k10role-before/k10role-after19-cleanup/k10role-after-own-five; sonSHA `4e82ff37978a7d304a8da52de14df5bd8c79275c8974e159f138a6ac940bc9aa`. Hedefli fiş gözlemi tek SERIALIZABLE transaction; native/protected ile üç ardışık okumanın bütünü atomik değildir. Sekiz native alanın meşru deltası vardır; tüm47eşit denmez.

Foreign araç sınırı: raw CDP Fetch.enable, açık API URL ve non-Document Fetch request aşamasıyla bile araç tarafından desteklenmedi. Boşpatterns ile temizlendi; kaynak guard reddi veya yetki hatası diye sunulmaz. Alternatif oturum/credential/istek kanalı denenmedi; NO_COMMIT resolver/fence oluşturulmadı. Kaynak five-transition sıfırDML regresyonları korunur, gerçek SQL olumsuz kabulünün yerine geçmez. İlerlemek için desteklenen normal transport üzerinde dar, yetkili yabancı-hedef senaryosu gerekir; her operasyonun geçerli başlangıç durumu ayrı kurulmalıdır.

Depo için `warehouse-continuation-decision-request.v2.json` SHA `ee3fe39c436659282737984e6357ecfaf31169341e2e02ced22b1281092d61fd` mevcut devredilmiş teknikTEST yetkisine sahip koordinatöre somut karar girdisidir; approvalGranted=false/executionAuthorized=false. Aynı30007/rol10/üçdepoizni, güncelRV ve kaynak/paket; etkinleştir/audit→yeni sentetik normalGUI→mutabakat→çıkış→pasifleştir/audit önerilir. Önceki15onayı veya sonradan verilen devam sözü yeni karar sayılmaz. Yeni rol/grant/parola veya eski15tekrarı yok. R1 ve tekTEST yazarı korunur; merkezi plan/Excel/sayaçlar yazılmadı. Aşağıdaki219audit bölümü önceki kurulum/personel okumasıdır.


## 9 Kasım güncel80662275: K06-03/C11 kurulumu ve normal personel okuması

PR123 / `codex/erp-sales-approval-matrix-20261109`; kurulu kaynak `80662275fa8be91c32aad1efa91e6805f028df0d`, paket `21de9872afcf1c48a35fad300ba36c64bdd9857d03be4cca910271e89d8af6fb`. [Push42642593718](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42642593718) ve [PR42642604506](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42642604506), Windows dahil8iş/104adım SUCCESS. Önceki d396 doküman CI koşuları successor806tarafından iptal edildi, PASS değildir. Resmi artifact13685209807/run42642593718,92563byte ZIP SHA256 `f9bbe1151bd29e9efbbb07e86e2710b5e2605c6f0918188ed0df976e2bdca5f5` doğrulandı. 317runtime kaynağın315'i ham byte aynı, desktopSaleWorkflowService/Transactions iki API dosyası değişti; iki frontend girdisi resmi üç web asset'ine derlendi. Yeni desktopWriteGreen-5iKuMcme.js ve HTML kuruldu; CSS aynı.

Owner39008/worker3828 yalnız127.0.0.1:5294/4294; SQL5240/legacy31560 aynı,404SQL hakkı korunur. Ready SHA `e2bb43e6b3f6c69dd4e0781e74d3c33859fafc222cc9560a5f18c8a1d13c0294`. Önce50a06fc9→stopped5613dd32→installed60e6cd53→poststart9066b506→postGUI3b042cf7 gözlemleri47native alan/5korunan kümeyi aynı buldu:219audit,7kullanıcı,6rol,39uygulama izni. TLS taşıması miras, yeni probe yok. Ready kaydındaki normalGuiLogin NOT_RUN_AT_READY_OBSERVATION etiketi başlangıç anına aittir; sonraki GUI sonucu ayrı kanıttır.

Normal operatör30002, mevcut fiş15 ve20'yi GET200 ile açtı. Gönderen/Hazırlayan/Kontrol eden15'te30007/30007/30002,20'de30002/30002/30002 olarak dürüst `Personel #ID` metniyle görüldü; ad uydurulmadı/personel dizini okunmadı. Fiş20 Tamamlandı24TRY ve Vade2026-12-09 gösterdi. Yeni satış/sevk/tahsilat veya başka ticari yazma yok;47alan eşliği önceki24TRY satış/1TRY tahsilat/23TRY bakiye bağını korur, bu işlemlerin yeniden yapıldığı iddia edilmez. Eski satış kalemleri tek tek karşılaştırılmadı.

Yerel dizin `C:/Users/Xaser/Desktop/ERP/kurulum/preparation-staff-v1`: source-ci-verification.json SHA `17ee2db2cd2c97324a11e9e36834cb570c0d5a16ff3312009f8feac2624e1445`; normal-staff-gui-proof.json SHA `42a9d08256582947c97b4db994a460c2dd2793a62cbfc06875aebdb0d86558e2`, durum PREPARATION_STAFF_NORMAL_GUI_AND_NATIVE_READ_VERIFIED; post-gui-native-snapshot.json SHA `3b042cf73c299c97d2e0bc8a051fd92294cc4bafbd8922a099105642522c6e67`. invoice15-staff ve invoice20-staff için .response.json/.dom.txt/.png saklıdır. Bunlar ajan normal ekran/okuma kanıtıdır; insan kabulü değildir. Header/token/özel giriş verisi repoya taşınmaz.

Kaynak testi sınırı: own/all kapsamı aynı kilitli transaction'da beş taze PREPARE/SAVE_CARTONS/READY/CHECK/CANCEL geçişine uygulanır; yabancı fişte sıfır DML yalnız kaynak regresyonuyla doğrulandı, gerçek SQL olumsuz denemesi NOT_RUN. Mevcut depo kapsamı, COMMITTED replay sırası ve UNKNOWN aynı UUID/gövde korunur. Canonical personel string/null verisi doğrulanır, eski NULL Belirtilmemiş gösterir; bozuk/gecikmiş/yetkisi kaybolmuş okuma eski personeli bırakmaz. 94frontend,30API ve7ek tüketici/route PASS örtüşen koşulardır,131tekil test iddiası yok. Rol/hesap etkinleştirme, DDL/GRANT yok. Depo30007pasif olduğundan ayrı aktif depo olumlu denemesi NOT_RUN; K04-04uygun yönetim aktörü eksikliği açık, geniş yetki verilmez. Son boş ticari profil/LAN/bütünERP/insan/cihaz/LIVE ve özgün49yaprak/sayaçlar aynı/açık. Bu belge successor'ı kurulu806kaynağı değiştirmez; doküman için restart yapılmaz. Aşağıdaki DES-19 aşamaları tarihsel kanıt olarak korunur.

## 9 Kasım önceki6c0d: fiş20 vade/satış/tahsilat zinciri doğrulandı

Kurulu kaynak `6c0d64cea0a4e815eb68c0324c7e921130f98687`, paket `59f149b1eae19cf9199b4b87d179d6eb7a9b2ee5b7067651da07673a43e0271d`,317runtime kaynak. [Push42628201898](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42628201898) ve [PR42628212029](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42628212029), Windows dahil8iş/104adım SUCCESS. Resmi artifact13679996757/run42628201898,92392byte ZIP SHA256 `c05a3cafbd7287ae0f830ebaefc48b0b10cf6bc1e9b5920ad412cbd74b8d2940` GitHub digest'iyle eşleşti; üç derlenmiş web asset'i önceki B81 artifact'iyle aynı. Owner18328/worker2756; yalnız127.0.0.1:5294/4294. Stop/stage/start boyunca47native alan ve5korunan registry kümesi eş; başlangıçta209audit. Bu kurulum eşliği fiş20'nin sonraki stok/cari etkisini doğrulamaz. TLS taşıması miras; yeni probe yok.

| Kanıt aşaması | Gözlenen sonuç |
| --- | --- |
| Normal okuma | Katalog müşteri/ürün çifti200/200 yaklaşık5.7/6s; yeni müşteri104 kartı ve kur okuması200 |
| Yeni satış | Operatör30002, müşteri104/TRY hesap110, ürün10+11, fiş20/24.0000TRY; CHECKED aşamasına normal ekranla geldi |
| Vade isteği | Talep232, create UUID `ff658b30-adf7-4456-bc1b-d8537ed11ea8`,30gün, belge2026-11-09/istenen vade2026-12-09; dönen taban termsDefinition null |
| Dar karar | Mevcut müdür30016 ayrı normal oturumda talep232'yi onayladı |
| Açık seçim | Operatör aynı232'yi çıkışta kullanmak üzere seçti; en son onay otomatik seçilmiş sayılmadı |
| Tek çıkış yanıtı | Bir DISPATCH POST201; UUID `96d3ec78-cc06-4a92-a13b-2ed392ac11a4`, COMMITTED/replayed=false, fiş20/COMPLETED/sürüm `0x00000000001600D6` |
| Ekran | Aynı fişte Tamamlandı, belge2026-11-09 ve Vade2026-12-09; invoice20-completed-due.png ve DOM kaydı |
| Tek tahsilat | Normal Finans ekranı, bir POST201/COMMITTED/replayed=false; UUID `a05a67b3-297b-4c44-9e34-4e2e8652b4ca`,1.0000TRY, müşteri hareket18/finans hareket7/kasa1; fiş20'ye tahsis, vade2026-12-09/kalan23.0000TRY |
| Native vade ve stok/cari | Talep232→onay233→tüketim234→v2snapshot235 ve tam DISPATCH gövde hash'i eşleşti. Stok40/41 birer ADET çıkış; ürün10 6→5/ürün11 7→6; tek cari borç17/+24TRY. Tahsilat sonrası müşteri104/hesap110=23TRY, kasa1=9TRY (önce8) |
| Global tanım ve koruma | Müşteri genel vade/kredi tanımı yazısı yok; son219audit içinde eski208/209audit ve dört güvenlik kümesi aynı. Kullanıcı7/rol6/uygulama izni39/ayar3 |
| Tahsilat ekranı | invoice20-collection.dom.txt ve invoice20-collection-viewport.png; fiş18 / satışfişi20 / tahsis1 / kalan23. FullPage yakalama hatası tarihsel olarak korunur |
| İnsan/işletim kabulü | BEKLİYOR; ajan ekran sonucu gerçek personel/cihaz veya bütünERP kabulü değildir |

Sorgu ölçümünde ham2875.898ms/ayrı-IF2054.297ms, sıcak ayrı-IF16.475ms/ham13.770ms gözlendi. Cache soğukluğu kanıtlanmadı; genel hız artışı veya önceki401'in kesin alt nedeninin giderildiği iddia edilmez. Auth/list tam doğrulaması aynı transaction'da korunur, ayrı yinelenen tarama3→2; guard dönüşümünün203koşul/THROW byte/sıra eşliği önceki bağımsız kaynak/AST kanıtıdır.

Güncel yerel kanıt dizini: `C:/Users/Xaser/Desktop/ERP/kurulum/auth-read-concurrency-v1`. source-ci-verification.json, artifact-proof.json, runtime-observed-ready.json ve post-start-native-snapshot.json kurulum aşamasına aittir; ready kaydındaki NOT_RUN normal-vade etiketi daha sonraki GUI sonucunu kapsamaz. Sonraki GUI/HTTP kanıtları ayrı tutulur: invoice20-draft.dom.txt, invoice20-checked.dom.txt, invoice20-due-create-response.json, invoice20-due-approve-response.json, invoice20-due-selected.dom.txt/.png, invoice20-dispatch-body.json, invoice20-dispatch-response.json, invoice20-completed-due.dom.txt/.png; tahsilat için invoice20-collection.dom.txt/body.json/response.json. invoice20-collection-viewport.png kaydedilip görsel olarak kontrol edildi; tahsilat fişi18, satışfişi20/vade2026-12-09/tahsis1/kalan23 görülür. Önceki fullPage yakalama hatası korunur; son viewport kanıtı bu hatadan ayrıdır. Header/token veya özel giriş verisi repoya alınmaz.

**Bağımsız native son kontrol:** invoice20-dispatched-v4-due-chain.json SHA `fc80ef1ab92396e198211463af68e293d8af5178d1f512a8093d43bf0b76d966`; doğrulama SHA `8a280b95413109797512e2d73b05efcdcd9c8be83c3028959b751e0e8683aceb`. Tahsilat sonrası invoice20-collected-v4-due-chain.json SHA `afe87afc52429f901d337dcab4dda51d8c4192937ce432b656228ee5d867998f`; invoice20-collected-v4-due-chain-verification.json SHA `c32072da32b1f19f7492b21e16f460e7d1a1066bd7c96c473b153d76362cdab6`. Son durum K10_DES19_DUE_EXCEPTION_ACTUAL_CHAIN_VERIFIED; collectionAllocationVerified=true ve dispatchBodyHashCompared=true. Hedefli fiş zinciri bir SERIALIZABLE okumada atomiktir; toplam3read transaction birleşik atomik gözlem değildir. Yalnız iki yeni seçili invoice_item satırı karşılaştırıldı; historicalSaleItemRowsCompared=false. Korunan eski audit ve güvenlik satırları kapsamı, bütün eski satış kalemleri eşliği diye genişletilmez.

İlk salt okunur gözlemci207/created_at hatası, var olmayan alanla sıralama yaptığı için oluştu; yalnız helper SELECT ORDER BY request_id düzeltildi. Uygulama şeması/runtime değişmedi, başarısız okumalar başarı diye yeniden etiketlenmedi. Son yardımcı incelemesi8ea6a46… GO, bu helper düzeltmesi kapsamındadır. Son boş ticari kurulum, bütün modüller, LAN, personel/insan/cihaz ve LIVE açık; özgün49yaprak/sayaçlar aynı. Bu seçili sentetik vade/satış/tahsilat doğrulaması bütün ERP kabulü değildir. Eski null/eksik vade snapshot'ları olan hesaplarda tahsilatın kapalı kalması ayrı sınırdır; yeni müşteri104 üzerindeki olumlu sonuç bu eski kayıtları değiştirmez. Bu dört dokümanın successor commit'i uygulama kurulumu değildir. Aşağıdaki önceki aşamalar tarihsel kanıttır.

## 9 Kasım önceki B81 kurulumu ve okuma engeli

B81cfaa3b14d7036d4c1754724dccea7ceec0f87, paketd961dc127083a366fb32943fd9e84e077a9463ca85b5fac472c959e3d3d3b92d gerçekten kuruldu. [Push](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42615436695) ve [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42615447370) Windows dahil8iş/104adımSUCCESS; artifact13671074795, ZIP187f362bef7304a997f5e62b430ea147a091dd20d96c95fac13354c078c20184 resmi digest ile eşleşti. Owner35016/worker51424, yalnız5294/4294loopback. Kurulumun47alan/5korunan küme eşliği ve404SQL hakkı doğrulandı; yeniTLSprobe yok. Önceki indirim onayı kanıtları aşağıda tarihsel olarak korunur.

Yeni normal TEST müşteri104 tek201 ile kaydedildi; audit208→209, beş müşteri-kayıt tablosu değişti, diğer32tablonun sayısı/hash'i ve dört güvenlik kümesi aynı. Taze oturumda cari GET401/10091.008ms, eşzamanlı kurGET200/10665.335ms; yeni satış/vade talebi/sevk yok.20s salt okunur DMV örnekleri blokaj0, RUNNING/RUNNABLE ve CPU artışı gösterdi.11987olaylık mevcut system_health dosyası deneme zamanını kapsadı, hedefDB5 için ilgili deadlock yoktu. Kesin401SQLkodu bilinmiyor; zaman aşımı henüz çıkarımdır.

Yerel deliller: k10-due-exception-v1/post-start-native-snapshot.json SHA524a6012…; post-customer-load-block-native-snapshot.json SHA288071eb…; customer-load-block-observation.json; normal-account-diagnostic-wire.json; sql-request-watch-7e824a31782d4e0ebf82f86990eddb73.result.json SHA2efba670…; system-health-deadlocks-c247dfafa2144c93b9bd3fb0a911f119.json SHA6d714d50…. Altında yeni kaynak6d505da0/219b50a2 ile tekrar tarama3→2 ve203eşdeğer IF hazır;51birleşik/84okuyucu testPASS, bağımsız40+8PASS, AST203predicate/THROW byte/sıra eşliği. Yeni exactCI/native ölçüm/kurulum/normal vade kabulü BEKLİYOR. Source review: auth-read-concurrency-v1/auth-list-independent-review.json SHAabfe2a9b… ve guard-compiler-independent-review.json SHA45aa7c89…. İnsan/cihaz/LIVE ve tüm ERP hazır durumu verilmez.

## Önceki indirim onayı kurulumu

9 Kasım 2026, SEMIH üzerindeki ayrılmış yerel TEST. Sonuç: satış talebi → uygun karar veren → aynı satış taslağı. Fişe özel vade istisnası ve bütün ERP teslimi açık; insan/personel kabulü BEKLİYOR.

## Kaynak ve kurulum

PR123 / codex/erp-sales-approval-matrix-20261109; runtime kaynak `2e43de9a3662b9689dcc78b7ea61d1aa73771163`, paket `2991027a0191df74310b1969b09c8b4e144d6ad7aea893e6f69ae5230463cf18`. Runtime315kaynağın4'ü değişti,311'i aynı; frontend3CI girdisi3derlenmiş asset üzerinden sunuldu. Yerel junction/esbuild build reddi korundu; hosted artifact kuruldu.

Runtime [push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42593167929) ve [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42593174294) Windows dahil8iş/104adım SUCCESS. Offline SQL compiler87396faf runtime'a kurulmuş kaynak olarak gösterilmez; onun [push](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42606184609) ve [PR](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/42606193212) koşuları da8iş/104adım SUCCESS.

İki yeni TEST hesabı pasif oluşturma ve etkinleştirme için ayrı gerçek rollback denemesi/native karşılaştırmadan sonra etkinleşti: müdür30016, patron30017, rol18, yalnız sales.view. Genel cari düzenleme veya finans hakkı eklenmedi. Rollback identity boşlukları kaydedildi; reseed yok. İlk eski setup UNKNOWN kanıtı korunur; tam47alan/identity/korunan satır eşliği etkisiz olduğunu doğruladı. Exact mevcut CUSTOMER_ACCOUNT_EXISTS terminali ve tam6kolon master journal hash'i bağlanarak ayrı v2 işlemler yürütüldü; eski istek/journal yeniden oynatılmadı.

Yeni uygulama bir kez başladı: owner42004/worker43112; yalnız127.0.0.1:5294 ve4294. Başlangıç sonrası47alan ve korunan registry satırları etkinleştirme sonuyla aynı. TLS kanıtı değişmeyen taşıma yapılandırmasından miras; yeni probe iddiası yok. SQL5240/eskiSQL31560 doğumları, DBguid c67f5317-9c0d-4831-aadd-fadc379a95d1 ve404SQL izni aynı. Son7kullanıcı/6rol/39uygulama izni/3ayar/208audit.

## Normal oturum sonucu

| Senaryo | Sonuç |
| --- | --- |
| Satışçı30013 | Etkin sınır %3.0000, %5 kayıt onaysız kapalı |
| %5.0001 talebi223, müdür30016 | Listede yok; numarayla normal Talebi aç GET403 |
| Aynı talep223, patron30017 | Gerekçeli tek POST200; karar224, Onaylandı |
| Tam %5.0000 talebi225, müdür30016 | Yalnız uygun bekleyen talep görünür; gerekçeli tek POST200, karar226 |
| Satışçı onayı kullanır | Talep225 seçildi; TRY cari/kur normal düğmeyle yüklendi; taze önizleme alındı |
| Aynı taslağı kaydetme | Tek POST201, UUIDf8d4e49c-da1c-46ac-9465-924f5009b05a; fiş19 DRAFT,24.0000−1.2000=22.8000TRY |
| Yenilenen onay paneli | Talep225, müdür30016, gerekçe/zaman ve Bağlı fiş19 aynı ekranda |
| İlgisiz görünürlük | Müdürde müşteri/ürün menüleri yok, genel fiş listesi200/boş. Doğrudan genel cari API403 normal oturumda denenmiş sayılmaz; önceki kaynak testleri ayrıdır |

Maskeli normal giriş kullanıldı; token/session enjeksiyonu yok. Auth sırasında Network kaydı kapalıydı; iş kanıtlarında header/token tutulmadı.

## Native kontrol ve kapsamı

SQL audit225→approval226→pricing.bound228→invoice19; aynı aktör, intent/quote hash, politika revizyonu, tam gövde ve UUID. CREATE_DRAFT journal COMMITTED/replayed=false/pricingProofRequired=true; header createdBy30013/DRAFT/22.8TRY/%5.

Taslak öncesi/sonrası yalnız5tablo değişti: audit+2, sale journal+1, workflow+1, invoice_items+2, invoices+1. Diğer32tablo hash/sayı eşit; stok, cari, finans ve registry değişmedi. Full local-master journal aynı. Eski206audit ve gözlenen eski başlık/workflow/journal satırları tek tek eşit. Eski invoice_items satırlarının ayrı önceki dump'ı yok; bunlar için tek tek eşlik iddiası yok. Kalem kanıtı toplam+2, değişen aggregate hash ve normal fişteki iki kalemdir. İlk verifier dosyasının geniş old206AuditsAndAllOldSaleRowsExact alanı bağımsız addendum ile bu kapsamda düzeltilmiştir; eski kanıt overwrite edilmedi.

Fiş18/17/15 ve tarihsel209 yeniden gönderilmedi. Onaylı223 kullanılmadan geçmişte kalır. Taslak19 kesinleştirilmedi; stok/cari tahakkuk veya ödeme tekrarı yok.

## Yerel kanıtlar ve kalan

Repo dışı dizin: C:/Users/Xaser/Desktop/ERP/kurulum/k10-sales-approval-matrix-v1.

- runtime-observed-ready.v2.json:62d139ea6b0a0e37eeb1a001a629e928561e50daf78d1327e00e0515cfc30dcd.
- normal-sales-approval-verification.v2.json:96e9684aae9b826c547bf32d465d6fb9977b8e4a47ef99964c5ed204b570016f.
- Bağımsız scoped GO/addendum normal-sales-approval-independent-review.v2.json:dfde44ef9499584ccc73575bce25e88577c793e7589b16b70d5113b17fc19168.
- Önceki/sonraki native snapshot:1966fc94c49c112dcf15117f68fb3dcf6fdcbbeeb2e52a337e74cf54abf11ec1 /3df1bd9d3563e0c2a07cc9bebcead5fb9e9c52d118ed6d14215a719b225a09b2.
- approved-sale-chain-native.v2.json:2095418864af725e684fc0a6fce9d03adf8a6e828bffe38cc1a7d87a44ab2d49; tek salt okunur işlem.
- gui-approved-sale-linked.dom.txt, mudur-onayli-fis-19.png, patron-onayi.png ve ayrı istek/karar/kayıt wire dosyaları.

Bir ilk müşteri liste GET'i401, aynı yüklemedeki ürün GET'i200 döndü. Tekrar giriş yok; aynı oturumda onay listesi/müşteri2/kurlar/son önizleme200 ve taslak201 oldu. Kaynak request-local auth.bind dalını gösteriyor; kesin alt neden bilinmiyor, düzeltilmiş sayılmadı. Onaylı TRY taslağı seçimi cari bağlamını otomatik yüklemedi; Şirket kurlarıyla doldur kullanıldı. İlk yükleme sürerken onay düğmesinin sessiz no-op olması da gözlendi; yeni iş POST'u tekrarlanmadı.

Sıradaki aynı K10 işi fişe özel vade istisnasıdır; kalıcı saveTerms eşdeğer sayılmaz. TEST deneme kayıtları içerir. Gerçek kullanım için boş son kurulum, bütün modüller, LAN ve insan/personel kabulü bu kanıtla kapanmaz. Özgün49yaprak/sayaçlar, main, LIVE ve Vega aynı.
