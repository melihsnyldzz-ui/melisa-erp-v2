## 28 Ekim — Aynı owner içinde aday/commit/resume ve rollback dispatch: kaynak teslimi

`business-5244-maintenance-dispatch.ps1`, mevcut sabit retire isteğini aynı uzun yaşayan owner'da plan/preflight → retirement → sabit-pin fresh child → mevcut held publisher → kalıcı commit/resume zincirine bağlar. Paket/komut/PID/yol kabul eden yeni uzak writer yoktur. Aday ve geri dönüş aynı mevcut API ile çalışmadan eski çocuk durdurulmaz; API upgrade yetkisi bu web protokolüne eklenmez. Yeni native nesne create/spawn dönüşünden önce lease'in ownedNatives kaydında tutulur; dönüş öncesi hata/cleanup belirsizliğinde gerçek handle kaybolmaz.

Kayıt yazma CAS'i güncel recordExpected, başlangıç before-image hash'inden ayrı izlenir. Hazırlanmış commit makbuzu before-image geçmişiyle aynı pending stream'e durable yazılır; tek arşive taşıma/ACK kaybı hash ve native doğum kimliğiyle uzlaştırılır. Arşiv ve canlı child yeniden doğrulandıktan sonra kayıt stream'i kapanır, state yeni native/facts/pins'e geçer; SAME mutex bırakılmadan Owner durumuna döner. Tekrar aynı plan/native/body ikinci child/yayın/arşiv üretmez; değişmiş pin body'si reddedilir.

Başarısız başlatma, pre-archive hata veya candidate death için yalnız kesin owner child'ı kapatılıp yeni rollback child oluşturulur; eski PID geri yayımlanmaz. Arşivlenmiş veya dayanıklılığı belirsiz durumda otomatik tersine zorlama yoktur. Arşiv sonrası çocuk ölümü yeni pending recovery işaretiyle Unknown/held gate olarak kalır. No-op replay bitmiş makbuzun plan/mode/native kimliğine bağlıdır. Bu yalnız süreç/başlatma kayıtlarıdır; SQL, ticari belge, stok, cari veya rol değişmez.

Dispatcher9hedefPASS; gerçek commit8hedefPASS (içinde source dispatcher+gerçek held publisher/commit normal ve rollback bütünleşik senaryoları); değişen owned başlangıç guard/syntax2hedefPASS. Bağımsız dar incelemenin tek P2'si tamamlanan çağrının değişmiş Pins body'sini kabul etmesiydi; lastCompletion'a ayrı pins clone ve10kritik alan karşılaştırması eklendi, hedef1PASS ve darreviewGO. Testler kendi geçici OS çocukları ve file stream'lerinde, uygulama/kimlik/ağ adaptörleri izole edilerek çalıştı; normal ERP GUI veya kurulum kanıtı değildir. Önceki source61 kalite ve WindowsCI SUCCESS, secret-scanFAIL; ignore eklenmedi. Yeni source CI ayrı raporlanır.

İlk orphan21408 devri, eski launcher kopyalarının gerçek yönlendirilmesi, gerçek koruma before-image/CAS admission ve API uygulama kapsamı ayrı açık kalır. Kurulu süreç/servis/görev/config/veri değişikliği yapılmadı; mevcut pasif paketler ve geçmiş suite'ler yeniden taranmadı. Bu kaynak, generic B5 handoff ret yolunu açmaz ve JSON/makbuzdan sahiplik üretmez.

## 28 Ekim — Kontrollü retirement/ACK ve held kayıt yayını: kaynak teslimi

Yeni owner döngüsü current-SID ACL'li, uzak istemciyi reddeden sabit Windows named-pipe kanalını dinler. Gerçek OS pipe peer PID/birth-handle/currentSID doğrulanır; her bağlantının challenge'ı, exact request nesnesi, boyut ve süre sınırı vardır. Yalnız status/retire kabul edilir. Kimliği doğrulanmış status bile retire adapter'ına giremez. İstemci ölümü, bozuk/çift body, replay ve kayıp ACK yeni stop yetkisi sayılmaz; yanlış istek owner döngüsünü kapatmaz.

Owner gerçek kendi-child native handle'ını tutarken kayıt dosyasındaki5244kimliğiyle karşılaştırır. Mevcut kayıt uyuşmazsa durdurmaz. Exclusive kayıt stream'i, flush edilip hash'i doğrulanmış kalıcı before-image ve pending işareti stop'tan önce tutulur. Aynı Windows mutex/thread bırakılmadan owner lease maintenance durumuna geçer; yeni cooperative başlatıcı araya giremez. Owner ölümü/yarım işlemde pending işareti bootstrap'ı kapatır; receipt veya JSON'dan sahiplik üretilmez.

Yeni held publisher mevcut `Assert-Business5244RecordStage` sözleşmesini kullanır: API/native satırları aynı, yalnız5244yeni child kimliği; native birth/Node/argv/SID normal entry'de doğrulanır. Aynı native/body tekrarında ikinci yayın yok; farklı body ret. Yarım yazım yalnız held stream içinde önceki byte'lara döner; daha sonraki yerel hareketleri silen restore yoktur. Geri dönüş yeni child PID'sini kullanır. Kalıcı flush hata verirse cache readback tek başına başarı sayılmaz; yeniden başarılı Flush(true) ve hash gerek, aksi Unknown+held gate/pending korunur. CIM'in ilk crosscheck hassasiyeti B5 MatchesCim yaklaşımıyla ele alınır; native creation handle tam hassasiyetini korur.

Hedef doğrulama24/24; üç bağımsız P2 düzeltmesi sonrası değişen state8/8. Testler controlled geçici OS pipe/child/file stream'leri üzerindedir. Normal ERP ekranı veya gerçek uygulama kurulumu değildir. Kayıt yayın köprüsü aynı-process retirement state'e bağlı kaynak fonksiyonudur; uzaktan arbitrary writer yoktur. Yeni adayı başlatma ve commit/resume/pending kapatma dispatch'i ayrıca tamamlanmalıdır. Eski launcher kopyaları hâlâ yönlendirilmedi; orphan21408ilk bakım admission'ı, API upgrade yetkisi ve GUI/insanUA açık. Runtime/SQL/servis/görev/rol/config değişimi yok; generic B5 handoff retleri korunur. Önceki5fb exactCI kalite/WindowsSUCCESS, secret-scanFAIL; tarama istisnası eklenmedi.

## 28 Ekim — Gerçek 5244 owner ve ortak startup dışlaması: kaynak teslimi

Yeni `start-business-5244-owned.ps1`, sabit API/web adayını ve doğru TEST kimliğini doğruladıktan sonra yalnız boş portta yeni web oluşturur. Native `business-5244-web-native.cs`, Job'u atomik process creation'a bağlar; creation handle ve birth kimliğini uzun yaşayan owner'da tutar. Owner cleanup, aynı native handle üzerinde çocuk çıkışını doğrulayana kadar ortak kilidi bırakmaz. Normal launcher ile B5 maintenance lease aynı runtime+SID mutex'ine bağlandı. Hash/single-seam kontrollü saf legacy dönüşümleri, web içeren eski starter çağrısını diğer başlangıç yan etkilerinden önce gate'e alır; non-web ApiOnly/MainApiOnly yolları korunur.

Kaynak hedef kontrolleri ilk tur19/19 geçti. Bağımsız review'deki iki cleanup noktası düzeltildikten sonra değişen owned8/8 geçti; review blocker kalmadı. Testler yalnız kontrollü geçici child ve kaynak fonksiyonlarıyla çalıştı. İlk paralel test çalışmasında aynı gerçek mutex'i kullanan dosyalar çarpıştı; son doğrulama serial yapıldı. Eski kabul testleri ve paketler yeniden üretilmedi.

**Kurulum veya ilk bakım devri tamamlanmadı.** Mevcut eski launcher kopyaları bu kaynağa yönlendirilmedi. Sürekli owner'dan bakım sahibine retirement/ack, eksiksiz eski başlatıcı dışlama producer'ı, current-target/before-image/CAS admission ve süreç kayıtlarının yayını ayrıca gerekir. Generic `Get-B5WriterHandoff`/`Assert-B5WriterHandoff` retleri aynıdır. Kod sabit pasif çifti beklediği için mevcut eski API kimliğini yeni API diye kabul etmez. Servis, görev, runtime config, SQL, rol veya ticari kayıt değişimi yok; normal GUI/insan kabulü bekler.

Önceki pasif hazırlık: API READ2b manifest `8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090`, web API-READ manifest `91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd`. Kaynak2b okuyucuları/baseedb/normal-session10cdc ayrımı korunur; API11941 dosya ve22offline test, web7341 dosya, mevcut5cb rollback7337 dosya private makbuzlarda doğrulandı. Ham özel veri veya özel ayar GitHub'a eklenmedi. API upgrade yetkisi DEC084 web bakımından ayrı değerlendirilir.

## 28 Ekim — ERP09 geçici satış sepeti SOURCE/İZOLE hazır

Uygulama2b744f5b. Normal17 satış okuyucusunda açıkça seçilen müşteri/hesap/döviz ve server GET'le doğrulanmış ürün/fiyat kademesi için geçici sepet eklendi. Yalnız pozitif tam adet ve kaynakça doğrulanmış ADET/factor1, pozitif fiyat ve bilinen yeterli stok kabul edilir. Aynı ürünün farklı kademelerdeki adetleri stok için birlikte değerlendirilir. Para string/BigInt ile8hanede tutulur, ekranda mevcut iki haneli moneyDisplay kullanılır; yalnız Ürün toplamı sunulur. Native fatura motorunun fiyat4 kuralı, vergi, iskonto, kur, ödeme ve fatura toplamı hesaplandığı iddia edilmez.

Kart/hesap değişimi veya ekrandan ayrılma, sepet temizlenmeden bloke edilerek kaydedilmemiş hazırlık korunur; browser beforeunload uyarısı kayıt yerine geçmez ve sepet kalıcı saklanmaz. Kartları yenileme/seçim değişikliği önceki kontrol durumunu stale yapar. Her satır açık GET ile yeniden okunur; stok/fiyat/kartbakiye drift veya yetki/karantina/okuma hatası başarı durumunu kaldırır, eski satır kullanıcı çıkarana kadar korunur. Tek satır ve sepet doğrulamaları karşılıklı kilitlidir; geç yanıtlar eski sonucu yeşil yapamaz. Bu kontroller atomik snapshot, stok rezervasyonu veya satış yetkisi değildir. POST/journal/localStorage/ticari/SQL yazması0.

Hedefli62 API/model/UI/legacy test PASS, bağımsız review P2seri ve çapraz yarış bulguları düzeltildi, final P1/P2 yok. Üretim frontend derlemesi kaynak2b744f5b:52dist,11CSS hash aynı,10.03s; envDir kapalı ve SQL/kurulu runtime çağrısı0. Bu kaynak/izole teslimdir; gerçek5244 GUI, ticari yazma ve insan kabulü yok. Mevcut 5244 HTTP200 erişilebilir; kullanılan çalışan aday eski5cb'dir, yeni sepet kurulmadı. Asıl engel yeni yetkili bakım executorü için elde tutulan native handle/restart-exclusion/CAS/72önceki durum kanıtlarının birlikte gerçekleştirilmesi ve ComputerUse'un browser URL güvenlik engelidir. API4144 sale/history yeni GETleri de kurulu değil; yalnızweb paket değişimi yeterli değildir. Kullanıcının yedek restore ertelemesi, eski retler ve diğer servisler korunur.
## 28 Ekim — Yeni kullanıcı adına5244 bakım yetkisi; paket hazır, runtime uygulanmadı

ERP-DEC-084 doğrudan kullanıcı talimatı, önceki yalnız dış bakım bağımlılığını bu dar hedef için güncelledi. Yeni1393c5bb doğrulayıcısı bugünkü maintenanceTarget kimliğini denetler; kayıp originalspawn/parentChecked/adoption kanıtı üretmez. ExactPID/birth/exe/SID/argv ve hedefPID'nin bütünlistenerlarının yalnız üç5244 adresi olması zorunlu; durdurma veya nativehandleadmission fonksiyonu değildir. Yeni fixture1test yükseltilmiş yalnızkaynakoturumunda PASS. Varsayılanmanagedsandbox PS libraryyüklemesini AuthorizationManager ile engelledi; executionpolicy değiştirilmedi/bypass kullanılmadı. Gerçek bakımexecutorü henüz tamamlanmadı veya çalıştırılmadı.

Güncel saltokunurOS gözleminde aynı21408/parent20956/2026-10-27T22:41:12.1657850Z ve5cbabsoluteargv+tekspace/SID beklenen. Kaynakların desteklediği yeni bakım için fresh restart-exclusion ve72protection before-image/heldkernelhandle/CAS kilitleri gerçek yürütmede ayrıca tutulacak; bu kısmi inceleme admission tamam demek değildir. Readonly görev/süreç taramasında exactstart-erp/business5244 yenidenbaşlatıcısı bulunmadı; yalnızcleanNightlyBackup ayrı korunur. Hiçbir task/servis değiştirilmedi.

İnaktif webpaketi ERP-BUSINESS-WEB-5244-fb97585c tamam: sourcefb97585c,7340dosya,manifest6597571b6cbfe04bf243f1a8861218ba16befee60bbdc0fdb83882a51f77bf27; old5cbpayload ve sourcebuild hashleri doğrulanarak yeni ayrı klasöre kopyalandı, kaynak/yedek/kurulupaket değiştirilmedi. AynıAPI4144 bağlı kalır; satış/history API yeni route'ları kurulu olmadığı için bu webpaketi tek başına bu bağlantıları çalışır yapmaz. Kullanıcının yalnız5244 bakım sınırı nedeniyle API/native/CLEAN/CRM restart/upgrade yok.

Mevcut ComputerUse becerisinin destekli sky aracı Chromepencerelerini buldu; ilk windowstate çağrısında mevcutbrowserURL güvenle doğrulanamadığı için araç bu tur ComputerUse'u durdurdu. Alternatifbrowser, process/clipboard/HTTP ile UI engeli aşılmadı. NormalGUI kontrolü BLOCKED/NOT_ATTEMPTED; yeni kurulum, stop, adoption, controlpublication veya restart0. Çalışan5244aday/diğerservisler/roller/DB/veriler aynı, insanUA/sayaç değişmedi. Sonraki adım destekliGUIerişimi ve gözden geçirilmiş yeni maintenanceexecutor admission koşullarıdır; önceki installer tekrar edilmeyecek.
## 28 Ekim — Kalıcı5244 kurtarma sınırı ve gerçek başlatıcı kapalı-kalma provası

Mevcut başarısız kurulum makbuzu MANUAL_RECOVERY_REQUIRED / B5_PROCESS_ARGUMENTS_OR_CWD / WEB_ONLY_PENDING_SPAWN_NO_ADOPTION'dır. Makbuz özgün çocuk doğum-handle/issuer zincirini içermez; başlangıç kontrol dosyaları eski süreci gösterir. Disk hash, mevcut PID/argv/SID veya sağlıklı ekran eski ownerın canlı kapsamını yeniden üretmez. Başlatıcının desteklediği yol API kimliği ve paket pinleri doğrulandıktan sonra boş5244te özgün freshspawn'dır; aktif orphanı devralma veya kapanış endpointi yok. Güncel süreç devralınmadı/durdurulmadı, başlangıç kayıtları yayınlanmadı ve kurulum tekrarlanmadı.

Gereken en dar dış devir: özgün ownera ait doğrulanabilir kurtarma kanıtının geri bulunması; bulunamıyorsa yetkili Windows bakım sorumlusunun açık taslakları koruyarak yalnız5244 web adayını kontrollü kapatıp portun boşluğunu devretmesi. Bu, diğer ERP/API/native/CRM servislerini, veritabanlarını veya yedekleri kapatma/reset yetkisi değildir. Ajanın eksik sahipliği sonradan sahiplenmesi için dolaylı yol sayılmaz; böyle bir devir gerçekleşmeden agent stop/adopt yapmaz.

Bağımsız hazır teknik adım tamamlandı: var olan gerçek Start-Business5244Web fonksiyonu, yalnız test sürecinde taklit paket/health/port ve var olmayan executable/root ile çağrıldı. Port dolu ve yabancıT1 API iki durumda da spawn/env değişikliğinden önce kesin ret verdi. Altı Windows hedef testi PASS; gerçek SQL/HTTP/kurulu süreç çağrısı0. PowerShell modülleri test mocklarından önce yüklenerek ikinci senaryoda mockların autoload ile değişmesi engellendi. Üretim başlatıcısı/guardı değiştirilmedi; bu test mevcut orphanı kurtarmış sayılmaz.

Önceki history kanıtHEAD5eaf2c85 CI run40605731418: quality-build-test SUCCESS, secret-scan FAILURE, Windows IN_PROGRESS olarak son okundu. BütünCI PASS denmedi, secret istisnası açılmadı. Hazır fb97585c UI ve99720bf3 API source ile offlinebuild korunur; kalıcı kuruluma veya normalGUI kabulüne dönüşmedi. İnsanUA/sayaçlar ve kuruluTEST/CRM/veriler aynı.
## 28 Ekim — Normal müşteri/tedarikçi kartı hesap geçmişine SOURCE/İZOLE bağlandı

Uygulama fb97585c: mevcut müşteri ve tedarikçi controllerları normal business sessionın exact hedef+aktif kimlik17/rol17 ve ilgili finance/party/trade görünüm yetkileriyle yeni history adapterini kullanır. Diğer ortam/rollerde legacy akış değişmedi. Bu bağlantıda eski sentetik satış, mal kabul ve ödeme contextleri çağrılmaz. Kullanıcı kartı açar, accountId ve para birimiyle hesabı açıkça seçer; varsayılan hesap/döviz atanmaz. Belge tarihi filtresi isteğe bağlı; varsayılan bütün kayıtlı tarihler, 25li sayfalama ve Tüm tarihler düğmesi vardır. Yenile aynı kartın hesap/tarih/sayfasını korur. Kart/döviz değişimi, filtre, kapanış ve geç yanıtlar önceki satırları göstermez.

Belge tutarı/dövizi, cari tutarı/dövizi ve kayıtlı bakiye etkisi ayrı gösterilir. Mevcut moneyDisplay iki ondalık gösterir; exact kaynak değerleri değişmez. NULL Bilinmiyor kalır; legacy etki fallback olmaz. Hesaba bağlanmamış hareket sayısı açıkça ayrı tutulur; bu liste bakiye hesaplamaz veya B/A yönü üretmez. Teknik hareket türleri bilinmediğinde sade Kayıtlı hareket etiketi vardır. Kayıt/onay/ödeme düğmesi veya ticari istek eklenmedi; var olan iletişim düzenleme kilitleri korunur.

167 hedefli UI/controller/legacy/oturum testi ve9 API/session testi PASS. Bağımsız parent wiring incelemesinde engelleyici bulgu yok; yeni controller9 testini root regression paketi de kapsar. Önceki99e506fc CI kalite hatası üç VMworkspace test yükleyicisinin yeni iki saf model importunu export olmadan stub yapmasıydı; yalnız bu modeller gerçek saf modül olarak yüklendi ve ilgili12 test geçti. Secret-scan FAIL ayrı, istisna/tarama gevşetmesi yapılmadı.

Private immutable kaynak derlemesi fb97585c:52 dist dosyası,11 CSS hash aynı,8.27s; envDir kapalı, ayıklanmış offline ortam ve salt okunur mevcut bağımlılıklar. SQL/runtime çağrısı0. Bu bir kurulum paketi veya normal tarayıcı kanıtı değildir. Mevcut browser aracı timeout engeli ve orphan21408 için özgün owner/spawn kanıtı eksikliği nedeniyle yeni kurulum/restart/adoption yapılmadı. Normal5244 müşteri/tedarikçi GUI ve insan kabulü BEKLİYOR. TEST125/CRM/veriler/roller aynı; ticari/SQL yazma0. Sonraki zorunlu adım desteklenen lifecycle kurtarma, eşli API+frontend kurulumu ve normal gerçek ekran doğrulamasıdır. MERKEZ native depo/personel bağı ayrı engel olarak korunur; yeni migration veya iş ağacı yok.
## 28 Ekim — MERKEZ eşleme sınırı ve bağımsız cari geçmişi okuyucusu

Kullanıcının fiziksel F0102 / 1 / MERKEZ teyidi ERP-DEC-083 altında zaten kayıtlıdır; tekrar karar istenmedi. Mevcut private native envanterinde yalnız TEST-V70-GOODS-WH/1 vardır ve normal Semih17 için employee bağlantısı boştur. Bu yüzden kaynak depo ile aynı sayısal kimlik eşleştirilmez. Gereken bileşen: kaynak şirket/depo kimliğine bağlı doğrulanmış native iş deposu kaydı ve mevcut izinlerle Semih17 receiving-domain/personel bağı. Kaynak adı konusunda işletme sorusu kalmadı; desteklenen kayıt/bağ altyapısı olmadan kullanıcı rolünü genişletmek, diğer aktörü taklit etmek veya ticari kayıt yazmak çözüm değildir. Mal kabul writer açılmadı; orphan aday değiştirilmedi.

Bağımsız hazır kaynak işi ilerledi: exact müşteri/tedarikçi + accountId + TRY/USD/EUR için yalnız GET hesap geçmişi API/store/model/session taşıması eklendi. Mevcut normal17 actor/izin tanığı kullanılır; her çağrıda ilgili finance/party/trade görünüm izinleri zorunludur. SQL yalnız SELECT; schema-init, ensure-table, DDL/DML veya bakiye hesaplama yok. Belge dövizi/tutarı ile hesap dövizi/tutarı ayrı exact metin kalır. NULL bilinmeyen, legacy etki ayrı; kaynak/sentetik köken tahmini yok. Varsayılan tüm kayıtlı tarihlerdir; açık tarih filtresi eski dönem hareketlerini kendiliğinden dışlamaz. Sayfa25, boş ileri sayfa toplamı korur; hesaba bağlanmamış eski satırlar ayrı sayılır ve dövize bakarak hesaba atanmaz. Bilinen çelişkili hesap/rol/döviz bağı kapalı kalır.

35 hedefli HTTP/model/store/normal-session/startup testi ve21 logger testi geçti. Logger yalnız8kesin statik tanı koduyla genişletildi, redaksiyon/tarama kuralları gevşemedi. Önceden private kaydedilmiş native müşteri75/ilk25 ve tedarikçi6/6 hareket satırı yeni saf modelden geçti; bu normal17 SQL izin veya GUI kanıtı değildir, yeni SQL okuması yapılmadı. Ticari/SQL/rol/runtime yazması0. Normal müşteri/tedarikçi ekranı geçmiş controllerı henüz bu reader'a bağlanmadı; API source hazır olması ekran veya insan kabulü değildir. Kalıcı kurulum önceki özgün spawn-owner kanıtı engelinde bekler. Sonraki bağımsız adım exact hesap seçimiyle normal geçmiş controller bağlantısıdır. Önceki kabuller ve sayaçlar değişmedi.
## 28 Ekim — Normal Satış controllerı read adapterine SOURCE/İZOLE bağlandı

Uygulama27896589, sonkompaktfotoğrafdüzeltmesic0c31b03. workSales yalnız exact BUSINESS_WORKFACE_SCOPE_UNAVAILABLE, normalSemih17/rol17/3viewizin ve !receiptOnly durumunda yeni createBusinessSalesRead controllerına geçer. Gerçekrol403/503, eski sentetik profiller ve Satışfişleri davranışı değiştirilmedi; mevcutjournal değiştirilmez. Önceki bölümdeki normalSatışcontrollerbağı bu kaynakaltadımında tamamlandı; yazan satış/finans akışı tamamlanmadı.

Müşteri adla25liksayfalarda aranır; exactmüşteri kartı ve bağımsız dövizhesabı açıkça seçilir. Barkod Enter ile literal metinolarak50likkatalogarama yoluna gider; tekil sonuç ve detail'de exactbarkod tekrar doğrulanınca ürün açılır. Baştaki sıfırlar/çoklu barkod korunur; belirsiz/yanlışbarkod rastgeleürün açmaz. Ürün+birim+kademedöviz fiyatı açıkçaseçilir; yeniGETokuyucusuna exacttuple gönderilir. Hesap/fiyat değişimi ve dispose eskiyanıtı geçersizkılar; gösterilenexactfiyat/stok/kod/bakiye ile tazeyanıt farklıysa eşleşti denmez. Unknown/0fiyat/uygunsuzbirim/hold başka anlamayorulmaz. quantity/grandtotal/cari/stok/kasa yazması, taslak saklama veya kaydet/finalize/ödeme düğmesi yok. Fotoğraflar mevcutlazyloaderla açılır; fotoğrafsızüründe büyükboşblokyerine temiznot var. Yeşiltasarım/CSS değişmedi.

44UI/legacyregresyon testiPASS; sonfotoğrafsızmarkupdüzeltmesi8UItestiyle ayrıca doğrulandı. workTrade dataURLloader yeniimport için dar güncellendi. BağımsızHighkaynakreviewde engelleyicibulgu yok. Offlineproductionbuildc0c31b03:52dist/11CSSaynı,SQL/kuruluruntimecall0; değişenimports nedeniyle çıktıchunkadedi önceki53ten52ye geldi, entry/CSS config değişmedi.

GerçekChrome fakat tamamen izole/sentetik Viteprovası127.0.0.1:5173te normalcreateWorkSaleskodunu çalıştırdı: müşteri adıarama→müşteri155→USDhesap7veayrıEURhesap8→0000120000barkodu→ürün12iki sıfırlıbarkodu→USDkademe1→Bilgileri doğrula akışı görüldü. Ekrandaki kalıcıuyarı bunun kuruluERP/ticariveriolmadığını söyler. YalnızfixtureGETler; SQL/normalTESTağçağrısı/ticariyazma0. Bu fizikselZebra/insanUA veya gerçekveriGUIkabulü değildir. Browsergözlemözetiprivatealanda; görüntüsohbettegösterildi. 1440viewport çağrısı ve birsekmetekrarbağlama timeoutaldı; aynıişlemtekrarlanmadı.1440/1024/390/sonfotoğrafmarkupGUIkontrolü DENENMEDİ/BLOCKED, PASSsayılmadı. Yalnız bu ajanın izoleharnesssunucusu normalclosekomutuyla kapatıldı; diğersekme/oturumlar değiştirilmedi.

Kurulumdeğerlendirmesiöncekikanıttanaynı: mevcut21408orphanadayı için özgünStart-Process/nativebirthhandle/ownerkapsamkanıtı kayıp; sağlık/argv/SID/GUIeşleşmesi kalıcısahiplikyerinegeçmez. Yeniownerınscopezamanınıgeriyetaşıma, parentCheckedtaklidi, stop/adoption, eskiinstallertekrarı veya restore/reset yapılmadı. Geri yüklemeyi erteleme kararı korunur. Sonraki zorunlu bileşen destekli lifecyclekurtarma/freshstart ve yeniAPI+frontend'in birlikteversionedkurulumudur. Sonra normalSemihgerçekveriGUI, genişlikler ve diğermenübağları sırayla doğrulanır. İnsanUA/sayaçlar değişmedi.
## 28 Ekim — ERP09 gerçek satış seçimi okuyucusu SOURCE/İZOLE hazır; kurulum yok

Kaynak ba9261c4: mevcut customerCardService.detail ve catalogProductService.detail üzerine yalnız saltokunur GET /api/business-sales/selection eklendi. Yeni finans/stock/sales writer veya veri motoru yok. Kanonik başlangıç, rotayı yalnız mevcut businessSession ile modeerp içinde güvenlik/kapsam middleware'inden sonra açar. Normal registered17/rol17/aynıexactizinwitnessi ve sales.view+customer.view+product.view başlangıçta ve bağımsız okuyucular tamamlanınca tekrar doğrulanır.

Seçim customerId+accountId+currency+productId+priceId+unitSourceId+tier birlikteliğidir; native müşteri ID'si ile party_currency_accounts ID'si karışmaz. Aynı dövizde birden çok hesap varsa exacthesap seçilir; diğer unknown hesap, seçili doğrulanmış hesabı bozmaz. Müşteri B/A/ZERO yönü signedbalance ve mutlak tutarla hem serverbuilder hem clientenvelope'da doğrulanır. GenelBakiye, sourceComparison veya başka döviz eklenmez. Kaynak ve TEST okuma tarihleri ayrı; atomic/freshLive/actualT1 false.

Ürünün tam stok kodu, sıfırlı gösterim kodu, çoklu barkod, mevcutstok ve exact8fiyatı korunur. Fiyat ürün+nativefiyatID+birim+kademe+döviz ile tekileşir; yanlış/eskimiş tuple409, hold409. Bilinmeyen stok/bakiye/fiyat null kalır; gerçek0ve negatiffiyat satışseçimini doğrulatmaz. Pasif/karantina/belirsizkaynak/birim engel olarak döner; yalnız doğrulanmış ADEТ/factor1mainunit darhazırlığı var, diğerbirim yeniden etiketlenmez. Negatif bilinen stok korunur; selectionVerified stok yeterliliği veya satış onayı değildir. Quantity/kur/fatura/borç hesaplaması yok. canSave/canFinalize/canCollect ve writeAuthorized daima false.

workingCatalogSession.businessSaleSelection mevcut sameorigin/HttpOnly normaloturum taşımasını kullanır; ayrılogin/tokenstore yok. Frontend/BFFpolicy yalnız exact7queryparametreli GET/HEAD'i tanır; eskiwork-sales/context/draft/finansyazma kapıları açılmaz. Mevcut çalışan adayın filtreleri değiştirilmedi.

İzole kanıt:19hedefPASS. Kaynak normal sessionmodülü → localhostephemeralHTTP → gerçekroute/servis → mevcutcustomerCardDto/catalogProductDto üzerinden sentetikfixtureokuma geçti. POST/PUT/PATCH/DELETE405; anonim401/yanlışaktörveeksikizin403; duplicate/LL/yanlışhesap-döviz-birim-fiyat/float/B-Açelişkisi/yerinegeçenwitnessnegatifleri var. Gerçek canonicalstartentry native/SQL/listener bağımlılıkları kapalı çalıştırıldı; profilvar/yok route401vs404 veenvironmentheader geçti. Bağımsızreviewde bulunan erkenappmount ve clientB-Akontrol eksikleri teslim öncesi düzeltildi; sonreviewyeni bulgu yok.

Offline frontend build:53dist/11CSS içerikleri aynı, envDirfalse/sanitizedenv/okunurdepsreuse. Paketleme, kurulum, normalSatışGUI veya insanPASS değildir; SQL/runtimecall0. Mevcut21408aday süreci devralınmadı/durdurulmadı/yenidenbaşlatılmadı. TEST125/roller/finans/migration/CRM/Vega/LIVE değişmedi.

Kurulum ön koşulları: (1) önceki kalıcıkurulum özgünowner-spawn zincirinin destekli kurtarması veya yetkili boş-port freshstart; mevcutorphanadmission aşılmaz. (2) yeni route+sharedmodeli içeren versionedAPI ve session/policy/modeli içeren frontend birlikte hazırlanmalı; çalışan API10cdc0ee yenirotayı içermez. (3) normalSatış müşteri/ürün seçici controllerı bu okuyucuyu tüketmeli; eski sentetik tradeContext gibi sunulmamalı. Şimdiki workSalesGUI ve draft/finalize/stock/financewriter bağlantısı hâlâaçık. İnsan kabulleri/sayaçlar değişmedi.
## 28 Ekim — 5cb web adayı çalışıyor; kalıcı kurulum MANUAL_RECOVERY_REQUIRED

Uygulama source5cb682d8, owner/pins8904f7a2. Yeni immutable paket ERP-BUSINESS-WEB-5244-5cb682d8 / bfb85a12333772bd40467f6258984ce08277f643dc544ff85b3d7ba39e86a617,7337dosya/53dist/11CSSaynı.42frontend+4ilkowner hedefPASS, bağımsız review engelleyici bulgu yok. Yalnız5244web geçişi denendi; API10cdc0ee/DBaynı.

Kurulum, yeni çocuğun argv doğrulamasında B5_PROCESS_ARGUMENTS_OR_CWD ile durdu. Windows exact absolute komutun sonuna tek ASCII32 eklemiş (199/198karakter); ek argüman veya başka root saptanmadı. Installer pending spawn bilinmeyen-sahiplik koruması WEB_ONLY_PENDING_SPAWN_NO_ADOPTION ile kapanır. Sonuç installed=false / MANUAL_RECOVERY_REQUIRED; starter/records before-image hashleri aynı, yayın yapılmadı. Aynı installer tekrar çalıştırılmadı, orphan adopt/stop yapılmadı.

YeniPID21408 mevcut5244adreslerini sunuyor; bu kalıcı kurulum kanıtı değildir. Normal Semih Chrome yeni sekme: Ödeme bağlantısı doğrulanamadı açıklaması görünür; Satış terminaline menüyle geçiş başarılı, sahte bekleyen-ödeme kilidi yok. Satış açıklaması artık bağlantı eksikliğini söyler; satış kaydı hâlâ kapalı. Private GUI JSON+PNG var. TicariPOST/SQL/rol yazması0.

Saltokunur failure sonrası audit: önceki kabul edilmiş D4 baselineına göre72koruma özeti eş, API4144/native4146/5194/CLEAN4194/4196/CRM62800–62803 PID/birth/exe/adres tupleları eş. Audit karşılaştırmasında PSCustomObject/hashtable ve süreçler arası JSON anahtar sırası farkları dar düzeltilerek gerçek tuple/hash karşılaştırıldı; veri değişikliği sayılmadı. Bu karşılaştırma kayıp özgün spawn sahiplik zincirini tamamlamaz.

Bağımsız review: failure receipt özgün child nativebirth/owner-spawn zinciri ve installer belleğindeki protectionBefore/keptBefore bilgilerini taşımıyor. Yeni scope mevcutorphanı kabul edemez; scope zamanı/parentChecked değiştirilmedi. Eski2000başlangıç kaydı yeni21408ile sessizce değiştirilmedi. Kaynakta yalnız gelecekteki özgün Start-Process/nativehandle/freshscope altında kullanılabilecek Assert-Business5244FreshSpawnArguments eklendi: exactabsolute argv, en fazla1sonASCIIspace; parent/EXE/SID exact. Yeni5Windows testPASS (orphan/relative/ekarg/iki boşluk/tab ret). Bu helper runtimea kurulmadı ve mevcut21408i kabul etmek için kullanılmadı. Genel transition guard aynı.

5194 Satış normaltarayıcıda Yönetici / bilgiler henüz hazır değil gösterdi. Kaynak adapteri tarihli sentetik15/16/ikiürün/TRY sözleşmesine bağlı; gerçek5244Semih17yerine geçirilemez. Mevcut native GET sales-invoices SELECT-only ve sales.view ile yeniden kullanılabilir, ancak currency belge dövizidir; cari hesap dövizi/hesap tutarı/tahsilat DTOsu yok, Number hassasiyeti ve boş sayfada total0 sınırı var. Cari döviz geçmişi diye bağlanmadı.

Somut açık iş: özgün owner-spawn kanıtına dayanan destekli kurtarma/boş-port yeni sahip başlangıcı sağlanmadan kalıcı kontrol yayını yok. Bu çözüldükten sonra gerçek17 satış/hesap-dövizi okuyucu adapteri gerekir. İnsanUA ve ticari akış PASS değildir. Yeni Görev/Goal/ana ajan/takip sistemi yok.
## 28 Ekim — 5244 satış bağlantısı ve menü denetimi (SOURCE; kurulum yok)

Kullanıcı F0102 / 1 / MERKEZ fiziksel mal kabul deposunu teyit etti; önceki ERP-DEC-083 kaydı korunur. Native deneme deposuyla aynı sayılmadı.

Normal Semih oturumunda Satış ekranındaki yetki uyarısı görüldü. Somut ilk neden: businessWorkfaceRequestAllowed, work-sales/context isteğini gönderilmeden reddediyor. Bu, mevcut satış izninin eksik olduğunu kanıtlamaz. Gelen Mal yalnız zaten izinli katalog/tedarikçi kartlarını okur; kayıt/gönder/onay çalışıyor değildir. Sadece allowlist açarak eski operasyon aktörünü kullanma veya yetki artırımı yapılmadı.

Menüler gerçek Chrome arayüzünden tıklandı. İş Sırası, Ürün & stok, müşteri/tedarikçi kartları önceki okuma teslimiyle erişilebilir. Gelen Mal kontrol görünümü var, ticari zincir kapalı. Alış faturaları bağlantı hazır değil; Satış ve Satış fişleri scope reddi; Tahsilat, Sayım, İadeler yetki dili gösteriyor (her biri ayrıca domain/scope incelemesi ister); Günlük kasa API_ERROR. Onaylar, Raporlar ve Ayarlar açılıyor; açılması verinin/işlemin doğrulandığı veya insan kabulü anlamına gelmez. Raporun 0 kaydı genel finans mutabakatı değildir. Geçici yükleme durumları başarı sayılmadı. Ödeme dışındaki 15 menünün nihai DOM kanıtı ve ödeme engeli private alandadır.

İkinci somut kusur: business 5244 same-origin adresi ödeme journalinin desteklediği hedef değil. Journal oluşturulmadan hata oluşunca ekran başlangıç açıklamasını boyamıyor ve requestClose, backupFailed nedeniyle var olmayan ödeme için gezinmeyi kilitliyor. Dar düzeltme: journal hiç oluşmamışsa bağlantı hatasını göster ve ayrılmaya izin ver; gerçek pending/backup korumasını koru. Journal/endpoint allowlist, izin, kayıt veya storage içeriği değiştirilmedi.

Satıştaki yerel BUSINESS_WORKFACE_SCOPE_UNAVAILABLE, gerçek rol403ünden ayrı kullanıcı açıklaması gösterir. Bu mesaj düzeltmesi satış bağlantısını tamamlamaz.

42 hedefli test PASS: satış yerel scope/gerçek403 ayrımı, ödeme desteklenmeyen hedefte storage okuma/yazma ve API çağrısı0, gerçek pending isteğinde çıkış kilidi ve UUID/body korunumu, mevcut oturum/allowlist sınırları. git diff --check temiz. Kurulu web d4f52345/frontend d875dc6e ve API10cdc0ee korunur; yeni kod KURULMADI. Ticari işlem, SQL, rol değişikliği ve restart0. İnsan kabulü BEKLİYOR.

Sıradaki somut iş: normal17 ve doğru gerçek-veri hedefi için destekli satış/okuma adapterini mevcut sözleşmeye bağlamak; 5194 eski aktör veya farklı hedefi sessizce kullanmamak. Cari geçmişi okuma bağlantısı önceki görev olarak korunur. Ham ekranlar/tutarlar private; GitHub'a eklenmez.

# 5244 yeşil ekran + gerçek veri — dar uyumluluk adayı

27 Ekim 2026; mevcut ERP03/A01–B02 kapsamıdır. **Kaynak adayı hazır, birleşik çalışan paket hazır değildir.** Yeni Goal/ajan/takip sistemi yoktur. 5244/4194/5194/4144, native, profil/config, hesap/rol/grant, gerçek kart/bakiye, CRM veya Vega değiştirilmedi. Restore/deploy/restart yapılmadı.

## Korunan iki kurulum

| Katman | Günlük 5244 | Gerçek-verili TEST125 |
|---|---|---|
| Web/API/native | 5244 / 4194 / 4196 | 5194 / 4144 / 4146 |
| DB | MELISA_ERP_CLEAN_TEST_20261022, sentetik | MELISA_ERP_SIRKET_TEST_20260929_01 |
| API | 349fae354e2a, manifest3aa51a25 | edb3c8915ef0 + katalog0a221778, manifest0927de3c |
| Web | 349 + kabul edilmiş CSSb6de5305 + finans okuma10b6535a, manifestebb1ce99 | TEST125 katalog uyum paketi |
| Kullanıcı | Mevcut normal hesabı ve rolü CLEAN'e ait | Aynı kullanıcı adına/role eşdeğer mevcut hesap dar sorguda bulunmadı |
| İşlemler | Clean wrapper, sabit sentetik gün/hesap ve yetki sınırları | Mevcut native/Goal8 kapsamı ve farklı kimlikler |

Bu tablo önceki gerçek süreç/health/manifest incelemesini kullanır; aynı geniş envanter veya eski testler tekrar başlatılmadı. Normal hesap için yalnız iki DB'deki mevcut kullanıcı/rol kimliği dar SELECT ile karşılaştırıldı; parola/hash/token/korumalı oturum okunmadı. Aynı sayısal kullanıcı ID'si farklı kişilere/rollere ait olabilir; eşleştirme veya mevcut kullanıcı yerine yönetici/İlker ödünç alma yapılmadı.

## Gerçek kod farkı

- 5244 `testAdminSession.resolveTestApiBase`, 5244→CLEAN4194 eşliğini zorunlu tutar. 5244→4144 reddedilir; otomatik admin açılmaz. Bu kapı değiştirilmedi.
- 5244 katalog modeli son PRODUCT-b40b0745 zincirini reddediyor. TEST125'in kabul edilmiş modeli ve backend doğrulayıcısı aynı zinciri kabul ediyor. Eski kart/187/sonraki stok halkaları silinerek uyum üretilmedi.
- Günlük finansın `cleanSyntheticServer` ve `cleanStoreDayStore` adapterleri sonlu sentetik ortam/hesap/gün kapsamları içerir. Yalnız CORS, port, synthetic bayrağı veya DB adı değiştirilemez. CLEAN auth + TEST125 ticari okuma şeklinde iki-DB akışı oluşturulmadı.
- Normal kart sunumundaki `currencyAccountPresentation`, UNKNOWN döviz hesabını “Bilinmiyor” gösterir ve legacy scalar0/ham BAKIYE'yi ikame etmez. TRY/USD/EUR ve rol bazlı B/A korunur. Ancak normal generic müşteri/tedarikçi DTO'ları ve create yolu zero/default davranışı içerir; bu nedenle 5536'nın native UNKNOWN/NOT NULL problemi kapanmış değildir.

## Dosya adayı

`scripts/canonical/prepare-green5244-realdata-compat.mjs` yalnız pinli üç manifesti ve seçili kaynak dosyaları okur; mevcut release'lere yazmaz, bağımlılık kurmaz, API/SQL/servis veya credential kullanmaz. Çıktı `UNBUILT_SOURCE_OVERLAY_NOT_INSTALLABLE`, `installed=false`, `executionAllowed=false` olarak mühürlenir. Hedef DB teknik varsayım olarak TEST125'tir; 5244'e kurulmuş veya nihai hedef seçilmiş değildir.

Private aday:
`C:/Sirket/ERP/evidence/ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private/source-candidate-v2/`

Üç dosya, mevcut kabul edilmiş TEST125 paketinden hash-eş yeniden kullanıldı:

1. `apps/sites-workflow/src/workflow/currentProductCatalogModel.mjs` — eski 5244 katalog doğrulayıcısının dar değişimi.
2. `apps/api/src/services/currentProductCatalogContext.mjs`
3. `apps/api/src/services/finalCatalogContext.mjs`

Son iki dosya frontend'in import ettiği **saf ortak doğrulayıcılardır**; API server veya CLEAN backend'i gerçek veri backend'i ilan etmez. İlk tek-dosyalı probe bu bağımlılıklar eksik olduğu için geçmedi; v1 korunur, v2 doğru import kapanışını içerir. Mevcut motor/validator tekrar geliştirilmedi.

`candidate.json` üç manifest, önce/sonra dosya hash'leri, bağlam kanıtı, 10 korunan dosya hash'i, kurulum engelleri ve geçiş/geri dönüş sırasını taşır. Kabul edilmiş erp-modern.css/b6, workCollections/workingCatalogSession10b, normal müşteri/tedarikçi/finans kaynakları byte-eş korunur. Yeni frontend dist derlenmedi; eski dist yeni kod diye sunulmaz. Aday hash'i `79aef113d71313f44693673a0091d9ce1c16e9f6d94f722311c239f8779efb3a`.

## Gerçekten denenenler

`node --test scripts/canonical/green5244-realdata-compat-local.test.mjs`: **8/8 yerel izole kontrat testi geçti**. Kurulu kanıtlar olmayan CI/host'ta SKIP edilir; SKIP tamamlanma kanıtı değildir.

- Pinli overlay ve finans/CSS dosyalarının korunması.
- Eski 5244 bağlam reddi, donor overlay ve gerçek-veri backend modelinin bağlamda uyuşması.
- Gerçek 5244 katalog consumer'ının overlay ile sentetik fixture'da tam kod, sıfırlı barkod, negatif stok ve USD fiyat tuple'ını koruması.
- Yetkisiz fiyat okuması, hold, yanlış sayım/ancestry/actualT1 ve sentetik kapsam karışımının reddi.
- Gerçek 5244 müşteri/tedarikçi HTML helper'larında UNKNOWN'ın scalar0 yerine Bilinmiyor kalması; ayrı döviz/B-A sunumu.
- Mevcut oturum/yanlış API eşliği reddinin korunması ve kalan kurulum engelleri.

Bunlar fixture/model/üretilen HTML kanıtıdır; gerçek GUI, normal yeni kullanıcı oturumu, SQL/native işlem veya insan kabulü değildir. Canlı endpoint testi, yeni satış/ödeme/tahsilat veya bakiye yazması yoktur. Eski kabul/stock/283+16 testleri, build ve geniş CI döngüsü tekrarlanmadı.

## Tam somut engeller ve sonraki kontrollü işlem

1. **Tek DB ve backend:** TEST125 gerçek veri korunarak yeni günlük ekranların çalışacağı desteklenen native adapter kapsamı seçilip kanıtlanmalı. CLEAN wrapper'ın gerçek DB'ye erişimi genişletilmez; iki-DB auth/business proxy yapılmaz.
2. **Normal mevcut kullanıcı:** CLEAN'deki kullanıcı TEST125'te eşdeğer mevcut hesapla doğrulanmadı. Mevcut girişin aynen kullanılması şu an desteklenmiyor. Bu tur hesap/rol/grant oluşturma veya token taşıma yetkisi yok; böyle bir değişiklik ayrı, exact kimlik/izin etkisiyle ele alınmalı.
3. **UNKNOWN:** customers/suppliers.balance NOT NULL/default0 iken 5536 insert edilmez. Depolama + kullanılan native reader/DTO + yazma önkoşulları NULL/UNKNOWN'ı uçtan uca korumalı; şema/guard kendiliğinden gevşetilmez.
4. **Gerçek paket/admission:** Yukarıdakiler kapandıktan sonra bu üç kaynak dosyası korunmuş web üzerine tek derlemeyle uygulanmalı; seçilmiş aynı DB'ye bağlı API/native, desteklenen normal entry ve paket manifesti birlikte mühürlenmeli. Şu an böyle bir runnable artifact yoktur.

Gelecekteki geçiş: taze tek-ERP-owner ve port/PID/doğum/paket/DB/T1false pinleri → geçerli current backup ve config/start/profile before-image → yalnız desteklenen dar API+web bakım çifti → gerçek normal giriş ile aynı DB'den ürün, müşteri, tedarikçi ve ayrı döviz hesapları; UNKNOWN/ret kontrolleri → ticari yazma olmadan sonuç. 5194, CRM ve eski veri korunur; önceki bakım makbuzu/PID'leri tekrar kullanılmaz.

Geri dönüş yalnız bu bakımın before-image'ındaki exact başlangıç/route/profil/paket bağlarına CAS ile yapılır; başarısız endpoint'i başka DB'ye düşüren fallback yoktur. Normal oturumlar veya sonraki yerel hareketler silinmez; ticari DB restore/reset edilmez. Mevcut owner yolları (`clean-b5-pair-transition` / bağlı TEST125 maintenance) tek başına bu yeni birleşik topolojiyi desteklemiyor; yeni hedef için exact admission olmadan çağrılmaz. Bu aşamada geri alma gerektiren runtime yazması oluşmadı.

## 27 Ekim19:49TR — frontend derlemesi gerçekten tamamlandı

Kaynak adayı sonrasında bağımsız frontend kısmı derlendi: 53 çıktı ve 11 CSS dosyası. CSS içerikleri, hash kümesiyle kabul edilmiş mevcut web sürümüyle aynıdır. Finans10b ve CSSb6 kaynakları değişmedi. İlk build, web-only release içindeki workTradeModel'ın saf ortak goal8DaySqlProof import kaynağı bulunmadığı için durdu; aynı deneme tekrar edilmedi. v2, aynı pinli CLEAN349 API kaynak manifestinden yalnız bu bir saf ortak dosyayı source closure'a ekledi. Bu, API/native process veya DB kurulumu değildir.

Derleme 16:49:33.692–16:49:44.070UTC (19:49TR), nodev24.19.0, Vite7.3.3; configFilefalse ile mevcut staged config objesi aynen kullanıldı, envDirfalse, temiz env ve mevcut dependency klasörleri saltokunur alias olarak kullanıldı. Config preview hook'u başlatılmadı. Npm install, ağ/SQL/credential veya çalışan runtime çağrısı yok. Yeni target frontendBuildApiBase4194'tür; buna uygun gerçek-veri backend ve normal kullanıcı sözleşmesi hâlâ engeldir.

Private çıktı: frontend-build-v2/dist; makbuz frontend-build-v2-receipt.json, log frontend-build-v2.log, ek kaynak bağı frontend-build-v2-shared-closure.json. Makbuz SHA25636997cd0cc8e99317dfc9d38f053ff429d22e9c7708f5cc0b5db8b4f8f64c81d. Script build-frontend-candidate-v2.mjs SHA25652557bd4758ca745e5692ffe659711b39b6cd52bf3494a2760d20b2c8d91199f. Makbuz FRONTEND_ONLY_BUILT_NOT_INSTALLED, executionAllowedfalse, databaseCalls0, normalLoginVerifiedfalse, sameDbBackendReadyfalse. Eski kaynakoverlay makbuzu ayrı tarihsel artefakttır; derlenmiş yeni çıktı onun yerine sessizce sunulmaz.

Normal kullanıcı için kaynakta aynı36izin satırı ve hedefte kullanıcıyokluğu dar SELECT ile hazırlandı; hedef mevcut başka role eşitlenmedi. Yeni hesap/rol henüz yaratılmadı. Bu özel kimlik işlemi için kullanıcı sorusu açık; genel5244onayı ile Windows/SQL/LIVE yetkisi açılmadı. Yeni5244çalışır doğrulanmadan eski5194durmaz.

## Semih TEST kimliği — gerçek hazırlık

27 Ekim2026 20:17–20:18TR; ERP-DEC-083. Özel onay koordinatörün doğrudan insan yanıtından doğrulandı. Eski CLEAN hesabı ve parolası değişmedi. Yeni kimlik ayrı native ID ile aynı36 izin satırını kullanır; varsayılan admin rolü veya SQL/Windows grant verilmedi.

| Kontrol | Gerçek sonuç |
| --- | --- |
| Hedef | Semih\\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01 |
| Yeni normal hesap / rol | unified-semih-test / unified_test_semih; native17 /17 |
| İzinler |36 satır; kaynak ve hedef hash-eş; etkin izin kümesi de aynı |
| Eski hesaplar ve roller | Transaction öncesi/sonrası kullanıcı, rol ve izin özetleri aynı |
| Korunan ticari etkiler | Stok/müşteri/tedarikçi/finans/audit hareket sayıları aynı; bu kurulum yalnız auth tablolarına yazar |
| Korumalı giriş | Yeni rastgele parola yalnız CurrentUser DPAPI; owner+SYSTEM dosya erişimi. Parola/hash/token çıktı veya GitHub'da yok |
| Tekrar | Ayrı süreçte ALREADY_PREPARED_VERIFIED; yeni kullanıcı0/rol0/izin0 |
| Bağımsız SQL | Native kimlik, aktif rol,36izin ve exact hash doğrulandı |
| Normal API | Mevcut4144 normal login200; aynıhesap/rol; katalog50satır,16992toplam |
| Kalıcı giriş | Mevcut4144 refresh vermiyor.5244tekDB/persistent normal session henüz kurulmadı |
| GUI / insan kabulü | Yeni birleşik5244 GUI denenmedi; insan kabulü verilmedi |
| Runtime | Servis/port/profile/kurulum0; eski ERP girişleri aynı, CRM/Vega/LIVE değişmedi |

Yerel kurulum normal yönetimin kullandığı createManagedAuthUserCore'u yeniden kullanır; hedef transaction, owner ve izin pinleri yerel kurulum sahibindedir. Normal API write guard'ı, trigger, SQL grant veya parolalı giriş kontrolü gevşetilmedi. Eski kurulum yolundaki gibi bu özel hazırlığın audit kanıtı private yerel installer günlüğüdür; SQL ticari audit kaydı eklenmedi. Before-image mevcut auth satırlarının server-side hashleri ve yeni username/rol yokluğudur. Commit öncesi hata rollback; commit sonrası otomatik silme/restore yok, yalnız bu yeni kimliğin kullanım bağları incelenerek dar devre dışı bırakma değerlendirilebilir.

İlk Windows ACL kontrolü SQL yazmadan durdu: PS7'den miras PSModulePath, PS5.1 Security modülünü yükletmiyordu. Aynı hatalı komut körlemesine tekrarlanmadı; çocuk Windows PowerShell kendi varsayılan modül yolu ile çalıştırıldı. Güvenlik ayarı/Defender/execution policy değişmedi. Bağımsız readback ilk bigint string/number tip kontrolünde durdu; Number ile kimlik karşılaştırması düzeltildi, hedef/veri değiştirilmedi.

### UNKNOWN okuyucu hazırlığı

Customer list/detail ve supplier DTO'daki Number(row.balance || 0) dönüşümü nativePartyBalance ile değiştirildi. NULL/eksik/geçersiz değer null kalır; gerçek0 ve negatif tutar mevcut sayısal gösterim anlamını korur. Kaynak hassasiyeti veya saklanan bakiye değiştirilmedi; döviz hesabının yerine scalar kullanılmaz.

Bu dar kaynak düzeltmesi yeni5536kartının veya diğer eksik kartların aktarımı değildir. customers/suppliers.balance NOT NULL ve normal create yolunun0varsayımı hâlâ storage/write engelidir. Mevcut protected session hedefleri CLEAN/DB02'ye bağlıdır; gerçek veri hedefinin desteklenen backend/persistent-session profili de ayrıca tamamlanmalıdır. CLEAN synthetic bayrağını kaldırmak veya gerçek veriye CLEAN oturumunu taşımak çözüm sayılmaz.

10 hedefli yerel test PASS: managed-user çekirdeği4, exact hedef/onay/izin policy4 (biri private gerçek izin kanıtı; CI'da dosya yoksa SKIP), UNKNOWN2. İlgili JS syntax kontrolleri geçti. Bu sonuç kaynak/yerel SQL/API kanıtıdır; yeni backend/GUI/insan kabulü veya CI PASS değildir.

Private kanıtlar aynı ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private alanındadır: account-target-admission.json, account-before-*.json, account-install-*.json, account-normal-api-proof.json. Kimlik ve şifreli ilk giriş runtime/UNIFIED-5244-SEMIH-20261027 altında tutulur; GitHub'a eklenmez.

## 5244 business backend ve normal oturum adayı

27 Ekim20:39TR: canonical4144 aynı DB/SQL kimliğini korur. Yeni isteğe bağlı businessWorkface profili yalnız Semih17/rol17 ve onaylı36satır için, gerçek servis pool'undan yeni SQL tanığı ile açılır. Başka DB/port, sysadmin/control/LIVE erişimi, CLEAN bayrağı, yanlış kullanıcı veya değişmiş izin seti reddedilir. Normal user read sırasında permission satır hash'i yeniden kontrol edilir; fingerprint kullanıcı ve rol row_version'larını da içerir. Eski/native/CLEAN/DB02 davranışı isteğe bağlı profil yoksa aynıdır.

Mevcut normal refresh store ve normal login/refresh/logout/session-confirm kullanılır; yeni parola/login motoru veya SQL yetkisi yok. Yalnız bu kimlikte açık çıkış ömrü kullanılır; accessJWT kısa, yenileme rotasyonlu ve iptal edilebilir kalır. Yeniden açılan depo, eski yenilemenin reddi, eski token ile bütün family logout, aktiflik/rol/row-version değişimi test edildi. Kalıcı oturum henüz kurulu API'de açılmadı.

Aynı yeşil5244 için ilk aday, explicit build profiliyle mevcut4144'e same-origin proxy yapar. Başlangıçta source/package/DB/login/uygulama profili ve yeni kalıcı-session health'i eşleşmeden web bağlanmaz; eski CLEAN sağlık cevabı kabul edilmez. Interface/Host/Origin/finite Tailscale peer ve forwarded-header koruması korunur. Normal browser yenileme sırrı JSON veya localStorage'a verilmez; host-only HttpOnly/SameSiteStrict çerezi ve normal API akışı kullanılır. Yerel şirket TEST'inin mevcut HTTP taşımacılığı değişmedi; LIVE/TLS kabulü değildir. Native protected-device taşıması ayrı kalır; CRM kimlik/oturum eşlemesi açılmadı.

İlk adayın veri kapsamı bilinçli olarak ürün/katalog/fotoğraf ve müşteri/tedarikçi kart okumalarıdır. Proxy ve istemci normal auth lifecycle dışında ticari yazmayı reddeder. Bu, geçmiş satış/finans akışlarının gerçek veri kapsamına açıldığı iddiası değildir. customers/suppliers scalar NOTNULL/default0 sorunu nedeniyle yeni UNKNOWN kartların yazıcısı hâlâ admit edilmez; mevcut ayrı döviz hesaplarının NULL/UNKNOWN gösterimi değiştirilmez veya0yapılmaz.

Gerçek servis tanığı private business-session-service-witness.json ve profil fragmanı business-session-profile.json içinde: mevcut named SQL principal, sysadmin0/control0/LIVE erişimi0; hedef/actor/36izin ve session hedefi kabul edildi. SQL DML0, grant dosyası0, listener0, kurulum0. Bu bağımsız metadata kontrolü normal yeni GUI veya gerçek oturum yenilemesi değildir.

99 farklı yerel hedefli test geçti: backend identity/session/route retleri, mevcut CLEAN ve protected-device kapsamları, proxy origin/health/CLEAN karışma retleri, cookie body/family enjeksiyon retleri, browser factory reopen/logout ve safe logging. Yerel private tanığı olmayan CI'da iki LOCAL test SKIP olur. Frontend/API paket üretimi ve gerçek normal ekran kontrolü ayrı sonraki fiziksel adımlardır.

## Paketler ve owner geçişinin daraltılması

27 Ekim21:18TR: İlk private API assembly1592payload'a10340mevcut bağımlılık dosyası hash-eş kopyalanarak tamamlandı:11932dosya, module import0, manifest13240dfa0161307f12ebab6187826abddc63381f69adc752fd009924c0d474ff. İlk source receipt'teki dependency ifadesi yalnız manifestteki source dosyalarını kapsıyordu; final receipt gerçek10340dependency sonucunu ayrıca tutar. Web7336dosya/6637dependency,53dist/11CSShash-eş; manifest981e1a5b61fa870f3e6cfe00f72c43144a37df637037abd73cbbe0b8029f7d8f. SQL/runtime/listener/kurulum0. Bu v1paketler çalışıyor diye sunulmaz.

Dağıtım öncesi inceleme, yeni normal family JWT'sinin korunan eski readonly native tarafından eski imza anahtarıyla doğrulanmamasını gerektirdi. Bu nedenle yalnız yeni business family için ayrı sunucu imza alanı eklendi; mevcut kullanıcıların ve native'in eski anahtarı değişmez. Yanlış alan/aktör ve eski anahtarla family taklidi reddedilir. v1adayları bu kaynak düzeltmesini taşımadığı için dağıtım izni yoktur; v2paket gereklidir. Frontend bundle içeriği değişmediğinden53çıktı yeniden derlenmeyecek; Vite host sağlık doğrulayıcısı yeni imza alanını da ister. API runtime config'e yalnız yeni businessSessionAccessSecret alanı eklenebilir; eski jwtAccessSecret ve kullanıcı parolaları değişmez. Sır kaynak/rapor/GitHub'a yazılmaz.

Gerçek named servis hesabıyla v2 context admission21:18TR tekrar salt okunur doğrulandı:sysadmin0/control0/LIVE erişimi0,36izin; yeni imza girdisi yalnız bellekte üretildi, login/JWT/grant dosyası oluşturulmadı. Private business-session-service-witness-v2.json. Mevcut Task/supervisor/5194/4146/4144 fresh planı da kaynak/instance/owner/birth/health eşliğiyle doğrulandı; pauseReadyfalse, stop/start0. Kanıt business-current-owner-admission.json; bu gerçek kesinti makbuzu değildir.

En dar kalıcı yol mevcut kayıtlı canonical görev ve launcher üzerinden yalnız API component root'unu pinlemektir. Native ve5194web aynı eski paket/argümanlarla kalır; API health kendi manifest/package ve Semih17normal-session/imza-alanı kanıtıyla doğrulanır. Görev tanımı veya RunLevel değiştirilmez. Kanonik launcher mevcut Git kaydı temiz ve eski byte'ları feature tabanıyla eş; kullanıcıya ait npm test değişikliği ayrı korunur. Fiziksel uygulama öncesi yeni launcher before-image/CAS, tek-owner task stop/start ve üç mevcut çocuk kimliği gerekir. Yeni owner kütüphanesi ve negatif fixture testleri hazır; gerçek güncelleme henüz yapılmadı.

Kullanıcının TEST verilerini5244'ten kaldırma hedefi, portun okuma kaynağını mevcut gerçek-veriTEST125'e alarak karşılanabilir. CLEAN DB, hesap/parolalar, CRM bağımlılıkları ve rollback verisi silinmez; aktarımlar yeniden yapılmaz. Bu kayıt yeni silme/reset veya bakiye aktarımı değildir.

## 27 Ekim22:13TR — API V5 gerçekten kuruldu, web ayrı devam ediyor

API paketi `CANONICAL-TEST125-BUSINESS5244-10cdc0ee`; manifest `3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33`. Uygulama tabanı `edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d`, auth/UNKNOWN closure `10cdc0ee3794c59bb6ae8ef900a5920541d76cc0`. Aynı TEST125 hedefi korunur. API-only profil eski native/web paket mühürlerini değiştirmez. Yeni ayrı business imza alanı eski native tarafından kabul edilmez; eski sırlar ve roller aynı kalır.

Gerçek kurulum makbuzu `business-api-component-upgrade-v5-result.json`: API_COMPONENT_INSTALLED_HEALTHY_COMPANIONS_PRESERVED; yalnız API stop/start, companionStops0, SQLwrites0, hata/geri dönüş yok. Doğrudan kurulu HTTP kanıtı `business-api-installed-normal-proof-v5.json`: login200, katalog50/16992, müşteri25/442+ayrıntı200, tedarikçi25/535+ayrıntı200, refresh200, logout200, çıkış sonrası401 ve aynı business JWT eski native4146'da401. Katalog ilk soğuk1290ms; müşteri558ms, tedarikçi511ms. Bu API kanıtıdır; tarayıcı veya insan kabulü değildir.

İki somut ara hata çözüldü: SQL timestamp sürümünün açık binary(8) üzerinden karşılaştırılması ve paket üreticisinin mevcut auth router/controller/middleware closure'ını eksiksiz alması. V4 hizmet katmanı testi HTTP refresh405'i yakalamıyordu; V5 gerçek paket router+SQL ve kurulu HTTP testleriyle ayrım kapandı. Bootstrap eksik closure ile SQL bağlantısına dahi geçmez. NULL/UNKNOWN gösterim düzeltmesi de aynı pakette; finans/schema yazması yok.

Web adayı `ERP-BUSINESS-WEB-5244-10cdc0ee`, manifest `6ca2e178cf805abe5063d134e08c052eb44d80b11a494681639ea07bd5c01069`. Kabul edilmiş53dist/11CSS içeriği aynıdır. Kontrol source `491edafe`, Windows test fixture düzeltmesi `56e5dd30` ayrı; kurulu uygulama source'u gibi sunulmaz.56e5dd30 exact push ve PR CI kalite/build+Windows SUCCESS; secret-scan5bulgu FAIL. Kalıcı istisna veya tarama kapatma yapılmadı.

Web-only fiziksel işlem22:15TR tek süreçte başlatıldı; `web-only-10cdc0ee/progress.jsonl` paket/rollback açık dosya kilitleri ve hash kontrolünü gösteriyor. Makbuz tamamlanmadan web kurulu denmez; eski girişler kapatılmaz. CLEAN4194/4196/CRM rollback bağımlılıkları, eski5194 taslakları ve son eski CLEAN tahsilat/ödeme panelindeki doğrulanmamış hata ayrı korunur. Bu aday ticari yazma açmaz; günlük iş zinciri tamamlandı iddiası yok.20eksik cari/UNKNOWN storage engeli, güncel Vega bakiye aktarımı ve gerçekT1 bu turda çözülmüş sayılmaz.
## 27 Ekim22:43TR — gerçek5244kurulumu ve GUI sınırı

Sonuç `BUSINESS_WEB_5244_INSTALLED`, yalnız5244stop/start. API/native/CLEAN/CRM kimlikleri ve72koruma kapsamı aynı; SQLwrites0,tradeWrites0,crmRestarts0. Yeniweb12336, workerbittikten sonra kernel handle/native doğum+sahip+mutlakargv+3bağlama ve LAN'dan3manifesthash bağımsız doğrulandı. Makbuzlar private `web-only-10cdc0ee-fast/receipt.json` ve `business-web-independent-postcheck.json`. Bunlar kurulum/bağımsızokuma kanıtıdır, GUI veya kullanıcı kabulü değildir.

İlk metadata kontrolü22dakikayı geçti; değişmeyen paket tekrar build/kopyalanmıyordu, PowerShell Test-Path/Get-Item ile her dosyada bütün üst dizinler tekrar yürünüyordu. Yalnız kendi preflight worker'ı, starter+records exclusive kapısıyla herhangi runtime stop'a ulaşamayacağı kanıtlanıp durduruldu. `preflight-external-stop.json`; eski5244PID/doğum aynı, runtimeStops0. Aynı reparse kontrolü direct.NETattribute traversal'a taşındı; scope/hash/inventory/dosya kilidi/nativeowner/publication sınırları aynı. Kaynak `2f9c95bc`;6normal/eksik/yaprakreparse/üstklasörreparse durumu eski yordamla eş ve Windows hedefli test1PASS.100gerçekdosya1844.67→66.96ms. Yeni tam dosya/rollback kontrolü74s, dar web geçişi4dk18s. Bu salt metadata hız ölçümüdür; katalog/API hızı diye sunulmaz. Yalnız mevcut özel kurulum yordamında kullanıldı, genel kapalı writer-handoff kontrolleri açılmadı.

GerçekChrome yeni ayrı sekmede `http://192.168.1.46:5244/ornek-akis.html#stock` normal yeşil giriş ekranını açtı; eski kullanıcı sekmesi/taslak değiştirilmedi. Normal hesabın CurrentUserDPAPI kaydını okuyacak mevcut helper browser runtime içinde `process is not defined` verdi. Eksik standart modül `node:process` için normal import denemesi araçça izin verilmedi. Bunun üzerine başka araç/ajan/clipboard/HTTP/process/JWT/cookie enjeksiyonuyla secret aktarımı denenmedi; form doldurulmadı, parola istenmedi, kullanıcıya kod/şifre ifşa edilmedi. Private `5244-gui-result.json` ve `5244-normal-login-blocked.png`.

**GUI:** sayfa ve giriş formu görüldü; authenticated ürün/cari/refresh/reopen/logout DENENMEDİ/BLOCKED. **API:** önceki V5 normal HTTP kapsamı doğrulandı; GUI yerine geçmez. **İnsan:** özgünUA kayıtları BEKLİYOR; PASS/sayaç değişmedi. Kalıcı launcher webroot/pin'i güncellendi; gerçek Windows reboot/logon ve DHCP/IP rezervasyonu denenmedi.5244tekport sabitliği bu kabullerin yerine geçmez.

Eski5194veCLEAN4194/4196/CRM giriş/bağımlılıkları, veritabanları, yedekler ve önceki taslaklar korunur. Ürün/cari/bakiye yeniden migrate edilmedi. Yeni alış/satış/finans yetkisi açılmadı. Kullanıcının tümcariler/güncelbakiyeler isteği bu kurulum kanıtıyla tamamlanmış sayılmaz. Kalan somut halka desteklenen korumalı normalGUIilk giriş teslimidir; bunun ardından normal gerçekürün/cari ve sekmeyeniden açılış/çıkış doğrulaması, sonra eski giriş bağımlılıklarının kapatılabilirliği gelir.
## 27 Ekim — tekrar oturum ve giriş mesajının dar düzeltmesi, kurulmadı

Kullanıcı giriş denemesinde de “Oturumunuz sona erdi” gördüğünü bildirdi. MevcutChrome5244Ürün&Stok ekranında mesaj gözlendi; gerçekbaşarılıbrowserlogin veya hangiisteğin bunu doğurduğu kanıtlanmadı. Başka İşsırası sekmesindeki “bu alanı doldurun” HTMLformuyarısı kimlik doğrulama yanıtı değildir. Bunlar gerçek oturum süresi doldu diye genellenmez. Parola görülmedi/aktarılmadı/istenmedi; mevcut araç retleri başka kanalla aşılmadı.

Kaynak `66a9c3bc` ve ek hedefli kabul testleri:

- Yanlış/eksik normal login401 artık “Kullanıcı adı veya şifre doğrulanamadı” der; ilk giriş hatası süre doldu diye sunulmaz.
- Ekran değişimi/reload'da sessionStorage'daki mevcut accessJWT ile HttpOnlycookie normal `/api/auth/session-confirm` üzerinden sunucuda birlikte doğrulanır. Kimlik17/rol17, aktiflik/izinler/süre ve çiftin eşliği korunur. Geçerliyse cookie gereksiz yere döndürülmez; süresi yakınsa bir kez normal refresh kullanılır. Yeni sekmede cache yoksa mevcut normal refresh yolu kalır; yeni oturum motoru yok.
- Geçersiz/replay/missing refresh ve session-confirm401 backend'de hâlâ reddedilir; geciken hata yanıtı başka sekmede daha sonra yenilenmiş geçerli cookie'yi silemez. Yalnız açıklogout cookie'yi siler; role/user değişimi ile geçersiz aile kullanılabilir hale gelmez. Ham refresh JS/localStorage'a taşınmaz.
- Yalnızbusinessbrowser'da fotoğraf403, geçerli kimliği logout yapmaz; 401 hâlâ oturum sınırıdır. Legacy/native fotoğraf403 davranışı değiştirilmedi.

75hedefliyereltestPASS: paralel4ekranda confirm/rotasyon0, yakınexpiry tekrefresh, yanlışkimlik ret,503durumunda cache/taslak koruma, eski401'in yeniCookie'ye etkisizliği, çıkışsonrasıyenaçılış ret ve mevcut operasyon/UUID sınırları. Bunlar fixture/adapter kanıtıdır; fizikselChromeoturumkabulü değildir.

Yeni derleme private `frontend-business-session-v2-receipt.json`:53dist/11CSShash-eş,8.43s, mevcut bağımlılıklar saltokunur yeniden kullanıldı; listener/SQL/kurulum0. Aday source66a9c3bc. Kuruluweb hâlâERP-BUSINESS-WEB-5244-10cdc0ee; API/DB/roller aynı. Düzeltmenin çalışana yansıması için yeni darwebpaketi/kontrollügeçiş gerekir; API/DB yeniden kurma gerekmez. GUIkorumalıilk giriş engeli açık olduğu için geniş/insan kabulü PASS değil. Mevcutkullanıcısekmesi/taslak/oturum değiştirilmedi.
## 27 Ekim — session web gerçekten kuruldu, ilk erişim ayrı engel

Kurulu web `ERP-BUSINESS-WEB-5244-66a9c3bc`, manifest `c8b399dca0a5260af1a964661fb2181576a7cf72a40e031633a0f4ffb1996094`. Frontend source66a9c3bc, kontrol71bf2108, APIhâlâCANONICAL-TEST125-BUSINESS5244-10cdc0ee.53dist/11CSSaynı; yalnıziki kaynakdosya ve ilgili derlenmişJSyenilendi. Mevcut bağımlılıklar hashkontrollü immutablepakete alındı; API/DB/rol/şifre/satışfinans/karantina değişmedi.

İlk v2preflight `B5_HEALTH_TARGET` ile stopöncesi kapandı. Hata uygulamada değildi: korunacakCLEANAPI349kimliği ile mevcutbusinessweb874kimliği kurulumyordamında aynıdeğişkenle karşılaştırılmıştı. İki exactkimlik ayrıdeğişkenlere ayrıldı; gerçekhealthönkontrolü ağırkontrolönüne alındı. Sağlık/owner/data sınırı gevşemedi, aynıpaket yenidenbuildedilmedi. v2makbuzu stop0 olarak korundu.

v3gerçekmakbuz BUSINESS_WEB_5244_INSTALLED: tek5244stop/start;SQLwrites0/tradeWrites0/crmRestarts0/failure0/recoveryFailure0. Kaynak/T1false ve koruma/PIDdoğumları geçişboyunca korundu. Sonraki ayrı süreç gözlemi gerçekkernelhandle/nativebirth+owner+absoluteargv,3loopback/LAN/Tailscaleadresini ve3sunulanHTML/JS/CSSmanifesthash'i, kurulumworker'ıçıktıktan sonra doğruladı. Private `web-only-session-66a9c3bc-v3/receipt.json`, `session-web-independent-postcheck.json`. Önceki10cdcweb/başlatıcı/beforeimage geri dönüş için korunur.

GerçekChrome'da ayrı yeni5244normalstok girişformu açıldı. Yalnız varolmayan sentetikfixturekullanıcı ve gizliolmayanfixturealanıyla BFF'nin upstream'e geçmeden reddettiği olumsuz form testi yapıldı. Mesaj artık “Kullanıcı adı veya şifre doğrulanamadı.” Gerçekhesap/parola denenmedi/görülmedi/aktarılmadı, kullanıcıdan istenmedi. `session-fix-gui-result.json`, `session-fix-installed-negative-login.png`. Sonra yalnız buajansekmesi yenilenerek temiznormalgirişformu bırakıldı; kullanıcının eskisekmeleri/taslakları yenilenmedi/silinmedi.

Saltokunur SQL: hazırlanan Semihuser17active,rol17active,36permission satırı mevcut.5244webtransport yalnız bu açıkonaylı normalTESTkimliğini kabul ediyor.5194'teki otomatikTESTadminoturumu farklısigner/origin/kimliktir; sessizce taşınmaz. Bu kimliğin CurrentUserDPAPIilk giriş kaydının desteklenenbrowser teslimi hâlâ eksik: mevcutbrowserortamıprocessglobalı/node:processmodülünü sunmuyor; ret başkaaraç/clipboard/HTTP/JWT/cookie enjeksiyonuyla aşılmadı. Yeniwebkurulumu bu ilk erişimengelinikendiliğinden çözmez.

PozitifnormalGUIlogin,gerçekrefresh/reopen/logout veözgüninsanUA BEKLİYOR; olumsuzformPASS bunların yerinekonulmadı. Kullanıcıya parola talebi yok; eksikbileşen desteklenenkorumalıGUIilk girişteslimidir. API/DByenidenkurulumu/yenihesap/rol/şifrereseti gerekmiyor. EskiERP girişleri bu doğrulama olmadan kapatılmaz. Exact71bf2108PRrun40576398910 qualitySUCCESS,Windowsçalışıyor,secretFAIL;genelCIyeşil değil.

## 28 Ekim — Kullanıcı seçtiği giriş adı ve cold-tab oturum düzeltmesi

**28 Ekim — Semih normal 5244 girişi ve yeni sekmede oturum dönüşü ajan tarafından doğrulandı:** Kullanıcı adı `semih` yalnız mevcut native17/rol17 hesabına çözülür; kullanıcının verdiği mevcut parola normal formdan kabul edildi, yeni parola yazması/izin değişikliği yok. Yeni web ERP-BUSINESS-WEB-5244-bf3d65c7 / manifestEB817358, frontendd50d06d7, hostbf3d65c7, ownera38f08d7 kurulu. İlk modül kurulurken demo render ile yarışan ve başarılı refresh yanıtını iptal eden erken mount, tüm modüller tamamlanana ertelendi. Gerçek Chrome: normal login→Semih/50ürün, tam reload→aynıSemih, giriş sekmesini kapatıp boş yeni sekme→parolasız aynıSemih/Stok listesi. Tarayıcının tümden yeniden başlaması ve bu tur GUIlogout denenmedi; insanUA BEKLİYOR. Tek5244stop/start, SQL/ticari yazma0, CRMrestart0; API4144/4146/5194/CLEAN/CRM/roller/veriler/yedekler aynı, 72koruma kapsamı eşit. Kurulumworker sonrası bağımsız nativebirth/owner/argv+3bağlama/3LANasset hash eşleşti. 7giriş/boot+4Windowsowner+27normalpersonel/logger hedef testiPASS. Eski API fixture yeni reset sonucuna uyarlandı, yalnız iki kapalı log kodu kayıtlandı (8e24f068); APIye kurulmadı. Exact8e24CI40584955579 quality/Windowsçalışıyor, secretFAIL; taramaistisnası açılmadı. Kaynak/CI/kurulum/GUI/insan kabulü ayrıdır. Parola/hamveri GitHuba taşınmadı. Sıradaki mevcut stok/cari işi ayrı; başka aktarım veya eski giriş kapatma başlatılmadı.**

Özel kanıtlar: `web-only-semih-alias-bf3d65c7/receipt.json`, `semih-session-independent-postcheck.json`, `semih-5244-gui-session-result.json`, `semih-5244-login-reopen-verified.png`. Ekran görüntüsü ve hesap içeriği yalnız private alandadır. Kaynak BFFde sadece exact `semih` etiketi mevcut canonical kullanıcıya çevrilir; parola doğrulaması aynı normal APIde, native kimlik/rol ve browser cookie kapsamı aynı kalır. Yenileme/replay/yetki korumaları kaldırılmadı.


## 28 Ekim — Gelen Mal: bağlantı reddi ile gerçek rol reddinin ayrılması

**28 Ekim — Gelen Mal bağlantı teşhisi sonrası dar SOURCE hazırlığı (KURULMADI):** 882efb2e; kurulu5244scope ve rol korumaları aynı. Kapsam reddi BUSINESS_WORKFACE_SCOPE_UNAVAILABLE koduyla gerçekrol403ünden ayrıldı. Gelen Mal bu kodda doğru kullanıcı açıklaması ve çalışan Ürün&Stok/Tedarikçiler gezinmesini gösterir; etkisiz tekrar/işlem düğmesi sunmaz. Bekleyen yerel taslak/journal korunur; yeniAPI/HTTPticariisteği/rol/SQLyazması yok.55frontend+12inboundservice hedef testiPASS;53dist/11CSSaynı aday7.34s offline derlendi. Native4144 defaultinbound aktör15/16 ve doğrulanmış darürün/depo/tedarikçi scope ister; normalSemih17 bu kapsam değildir. Clean4194veverifiedcopy5234 bağlantıları başka hedef/kimlik/kanıt sözleşmeleridir,5244e yönlendirilmedi. Sadecefrontendallowlist açmak backendbağını sağlamaz; adminyetkisi bu eksikbağı çözmez. GerçekSemih17bağlı supplier/depo/ürün/akış adapteri doğrulanmadan günlük MalKabul çalışır ilan edilemez. Kuruluwebbf3d65c7/EB817358 veAPI10cdc0ee korunuyor; yeniaday kurulu normalekran veya insanUA PASS değildir. Sıradaki tek teknikbağ: mevcutgüvenli işakışı sözleşmesini aynı5244/native17hedefine kaynakkapsamı ve rolkanıtıyla uyarlamak; bu tur ticariyazma/kurulum yok.**

Mevcut özel teşhis: `semih-5244-permission-warning-diagnosis.json`, `semih-5244-admin-permission-comparison.json`. Yeni derleme: `frontend-receiving-scope-882efb2e-receipt.json`; status FRONTEND_BUSINESS_CANDIDATE_BUILT_NOT_INSTALLED, runtimeCalls0/databaseCalls0. Kurulu normal ekran sonucu hâlâ eski uyarıdır; yeni kullanıcı mesajı yalnız kaynak/controller testi ve pasif derlemede doğrulandı. Kullanıcıya çalışan mal kabul teslim edildiği söylenmedi.

Desteklenen sözleşmeler: native workInboundService varsayılan aktör kontrolü15/16; workInboundStore native rolde isolated_test_sales/isolated_test_ilker ve kaynakça doğrulanmış iki ürün/tedarikçi/depo kapsamı; isolated copy ayrıca copyId/sealHash/operationOrigin ve seçili tedarikçi/döviz bağını doğrular. Clean sunucu ayrı kayıtlı ortamda kendi actorCheck/capability adapterini kullanır. Bu sözleşmelerin hiçbiri normal5244Semih17bağını hazır varsaymaz. Yeni negatif test17nin native storagea dahi ulaşmadığını kanıtlar. Yetki incelemesinin önceki otomatik reddi aşılmadı; hiçbir rol veya kişi eşlemesi değiştirilmedi.


## 28 Ekim — Native17 için en dar gerçek bağ hazırlığı

**28 Ekim — Gelen Mal gerçek bağ envanteri ilerledi; iki somut runtimebağı eksik:** Aynı5244/API4144/nativeTEST125/normal17hedefinde saltokunur exactgüncelkatalogrun PRODUCT-b40b0745 kapsamı incelendi.16.938kabul edilmişüründen1.211inde mevcutnative tedarikçiFKbağı;1.205aktif/karantinasız/birimkaynakkanıtlı aday55tedarikçiye bağlı.5tedarikçiholdluve1pasifürün ayrı;15.727kartta doğrudantedarikçibağı yok.1.211birim/çarpan mevcutlineagepayload+SHA256ile1.00000000 doğrulandı; tahmin yapılmadı. Kaynak F0102depo1/MERKEZ etiketleri var; native mal kabuldepo1 yalnızTEST-V70-GOODS-WH, aynıid aynıdepo değildir. Normal17nin mevcut15/16mal kabulaktörscopeuna destekli bağı yok; employeesuser17bağı da bulunmadı (kendiliğindenkişi oluşturulmadı). Kısmiadaymanifest privatehazır, runtimeadmission0/kurulum0/SQLticariyazma0. Aktör17ye mevcutizinlerle destekli receivingdomainbağı ve kaynakdepo→gerçeknativeişdeposu eşlemesi kurulmadan çalışıyor denmez; frontendfiltre/rolextension veya testdeposuyla zorlanmadı. Adaylar henüz kaynaktedarikçiilişkisi için ticariyazmaonayı değildir. Mesajkaynağı882efb2e+67hedefPASS/pasifderleme korunur; kurulu5244bf3d65c7aynı. Son7bCIqualitySUCCESS/WindowsSUCCESS/secretFAIL; yenidenCIbaşlatılmadı/istisnayok.**

Özel makine kanıtı: `receiving-native17-binding-admission-result.json`, `receiving-native17-binding-candidates-unit-proved.json`, `receiving-native17-current-catalog-binding.json`, `receiving-source-warehouse-labels-readonly.json`. Sayılar farklı dönem/snapshot53275ürünlük genişnativekümeden değil exactmevcut16938katalogdan alınır. Genişilk ilişkienvanteri karşılaştırma dışı bırakıldı. Sourcewarehouse1/MERKEZ eski kaynak hareket etiketidir; gerçek T1 veya nativewarehouseregistrybağı değildir. Tutar/bakiye/fiyat/parola okunmadı; hiçbir DBkaydı oluşturulmadı. Yeni bağı kurmak, kullanıcıya genel yönetici vermek veya diğer aktörü taklit etmek değildir; mevcut normal17witness/izinleriyle ayrı kanıtlanmış receivingdomain ve gerçekdeposcope gerekir. Bunların aktifortamda hazır olmadığı somut engel olarak korunur.


## 28 Ekim — Gelen Mal gerçek kart kontrolü kuruldu

**28 Ekim — Gelen Mal gerçek kart KONTROL yüzü5244te KURULU / AJAN DOĞRULADI; ticari mal kabul henüz AÇILMADI:** Kullanıcı F0102/1/MERKEZi fizikselmal kabul deposu olarak teyit etti; bu kaynakkararı nativeTESTdepo1eşitliği sayılmadı. Yeniweb ERP-BUSINESS-WEB-5244-d4f52345 /916b7fe1, frontendd875dc6e, owner e577646e, BFFbf3d65c7, API10cdc0eeaynı. MevcutSemih17/rol17/36izinle sadece zatenizinli catalog/supplier-cards GETokuyucuları GelenMalda gerçekveri gösteriyor:533aktiftedarikçi/12064aktifürün. Tedarikçiarama, sıfırlıürünkoduarama veKartlarıYenile6GET/200ile doğrulandı; tamreloadparolasızaynıSemihvegerçekliste. DepoMERKEZ/SorumluSemih ekranda; teknikTESTsuffixi kaldırıldı. Kaydet/gönder/onaydüğmesi0/ticarirequest0. Client/backendkapsamfiltreleri/yetkileraynı; legacy15/16aktörütaklitetme/gerçeknativewarehouseoluşturma yok. Tek5244stop/start,SQL/ticariyazma0/CRMrestart0,72koruma aynı; workerçıkışı sonrası bağımsıznativebirth/owner/argv+3bağlama/3LANassethash eşleşti.62frontend+4ownerhedefPASS; CIeskitestloader yenimodülüçözemeyince15ilgilisupplierUItesti için darimportyükleyicisi düzeltildi (8b522f66),uygulamapaketiyenidenkurulmadı.53dist/11CSSaynı, normalyeşiltasarımkorundu. CIe577qualityFAILeskiyükleyici/secretFAIL/Windowsçalışıyor; yeniexactteslimCIsonucubeklenir. Bu, saltokunur kontrolyüzü teslimidir; gerçekmal kabul kayıt→gönderim→onay/stok veinsanUA tamamlanmadı.**

Ürün/tedarikçi alanları tek bir ticari çift olarak bağlanmaz; mevcut normal saltokunur kartları ayrı gösterir. Nativeişlemaktörü ve gerçekişdeposu bağları henüz aktif değildir; kaynakdepoteyidi bunları otomatikoluşturmaz. YeniGelenMalkontrolünde veriokunur fakat mal kabul belgesi oluşturulamaz. Kurulu görüntülemeyi tam günlük mal kabul zinciri diye sunma.

Private kanıt: `web-only-receiving-read-d4f52345/receipt.json`, `receiving-read-independent-postcheck.json`, `receiving-read-installed-gui-result.json`, `receiving-read-installed-normal-screen.png`. AltıkartGETinin200yanıtı, iki arama ve yenidenokuma kaydedildi; authyenileme dışında ticariPOSTyok. Tarayıcı tamreloadsonrası aynıSemih/533/12064doğrulandı. Source/paket/kurulum/gerçekGUIveinsanUA ayrı. Kullanıcıya yeni parola veya ikinci fizikselişlem yüklenmedi.

## 28 Ekim — Boş5244 portunda Current web kurtarıldı; normal Chrome doğrulandı

Eski21408 süreci ve5244listener yoktu; ajan eski süreci durdurmadı veya sahiplenmedi. Desteklenen boşport başlangıcıyla yalnız Current web5cb7337dosya sözleşmesi ve mevcut10cdc API uyumuyla başlatıldı. ac860e8d kaynak owner bundle manifest24c7d8f91a7090ebca7ec56526b66707a5792a90c08f80b3bb4a700367f5978c; app ERP-BUSINESS-WEB-5244-5cb682d8. Source owner ile uygulama source/paket birbirinden ayrıdır.

Gerçek fresh-start makbuzu FRESH_CURRENT_OWNER_READY: HTTP200; creator3484/owner49848/child42952, exact native doğum kimlikleri private makbuzda. AynıSID authenticatedpipe yalnız status isteği gerçek server birth-handle'ını doğruladı, phase Running. Bu saltokunur status stop yetkisi değildir. Uzun yaşayan owner, ilk oluşturduğu web child native Job/creation-handle'ını tutuyor.

Koruma makbuzu: companionsPreserved=true, controlsPreserved=true, apiPreserved=true; stopCalls0/apiRestarts0/sqlCalls0/configWrites0. API4144 CANONICAL-TEST125-BUSINESS5244-10cdc0ee, native4146 ve5194 dahil diğer mevcut servisler korundu. Process-record hâlâ eski kaydı içerir; installedRecordPublished=false açıkça kaydedildi. Mevcut launcher/config/scheduledtask değiştirilmedi; tam kalıcı launcher dönüşümü veya yeni readerAPI kurulumu tamamlandı denmez.

**Normal ekran:** Chrome extension ekran aracı başarılı envanter ve mevcut5244tab bağlantısı verdi. Mevcut Semih oturumunda normal Ürün&Stok açıldı; kullanıcı ekranındaki Yenile düğmesinden sonra16.992ürün/50satır yeniden görüldü. Stok, barkod, satış fiyatı/döviz ve durum alanları görünür. Ekran görüntüsü bu konuşmada gösterildi; ticari satırlar GitHub'a taşınmadı. Önceki ekran aracı zaman aşımının kök nedeni kesinleşmedi; portun boş/ulaşılamaz olduğu ayrı kanıt, şu an tarayıcı kontrolü çalışıyor. İnsanUA/logout/tümChrome yenidenbaşlatma denenmedi.

**Açık somut kapsam:** yeni2b744f5b normal satış/cari readers API ve eşli web henüz kurulmadı. Bunun için4144 API hedefinin mevcut10cdc→pasif READ-2b paketi geçişi, exact sahibi/beforeimage/downtime/rollback ve korunacak native4146/5194/5244/DB/roller ayrı değerlendirilmelidir. Yalnız5244web DEC084 yetkisi API restart yetkisi yerine kullanılmaz. Yeni geçiş tamamlanmadan yeni satış/cari ekranlarını kurulu diye sunma.

Private: current-owner-ac860e8d-start.json, current-owner-ac860e8d-before.json, current-owner-ac860e8d-peer-status.json, current-owner-ac860e8d-gui-result.json. Ham ticari veri, sırlar ve ekran içerikleri repoya alınmadı.

## 28 Ekim — READ-2b eşli API/web geçişinin dar kapsamı (UYGULANMADI)

### Doğrulanan mevcut sahip ve geri dönüş

4144API23156, parent/scheduler engine26476; canonical görev tek instance. TaskXML SHA256e959af0b36ea9d2bd0fabdd6371174c4bd406258e64dc904e38833f79820d99a. Başlatıcı canonical scripts/canonical/start-owned-test.ps1 SHA25629bf5c5cf566a73aa60d2347360890dff5da17b3fccdd0dc663198296d501b9e; startup-config SHA256d7ea40fecf11fb0a926547a4cd62f8b17858534801621dcc89fb95d474396676. Mevcut startup-config.ApiComponent exact10cdc pakete bağlı. API23156/CANONICAL-TEST125-BUSINESS5244-10cdc0ee; manifest3e498c4fe89853e295c3ef0a66f88abcbd640b22750c6a54d4348b309b5c2f33. Geri dönüş bu paket + Current5cb webdir; eskiPID yeniden yayınlanmaz. İşlem anında bunlar taze nativehandle/owner/argv/port ve CAS ile yeniden doğrulanmalıdır; bu okuma tek başına stop yetkisi değildir.

### Hedef ve değişecek alanlar

API hedefi C:\Sirket\ERP\releases\CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213; manifest8b39a46f27ce8c6e0b8e41a34e29bee2aab0b4575129da5503c0602c4c9c8090. Eşliweb C:\Sirket\ERP\releases\ERP-BUSINESS-WEB-5244-2b744f5b-API-READ; manifest91ee8b23c37a46ec89f8060967bc7a0106f68f2de9a4a1f4199941cce5a9e0fd. Source read2b744f5b, baseAPIedb3c891. Önceden doğrulanmış pasif paketler yeniden taranmadı/build edilmedi.

Runtime değişikliği yalnız canonical startup-config.ApiComponent.ReleaseRoot ve ManifestSha256; SourceCommit ve private ConfigPath aynı kalır. Config before-image korumalıDPAPI, atomikCAS; özelprofile/rol/hesap/parola değişmez. Owned-processes/health kayıtlarını mevcut supervisor yeniAPIPID/birth ile kendisi yayımlar. Canonical başlatıcı/görevXML/baseRelease/native/web5194 değişmez. 5244 kaydı stalePID2000 olarak başarı diye tutulmaz veya yeniPID elle kanıtsız yazılmaz; mevcut web yayın sözleşmesinde exact eski kayıt→kanıtlanmış gerçekchild CAS önkoşulu ayrıca gerekir.

### Sıra ve kesinti

1. Exact API ve web sahipleri/tek çalışma/görevinstance, korunacak süreçler/DB/T1false, eski-yeni paket pinleri ve korumalı before-image tek işlem sınırında sabitlenir.
2. Mevcut TEST125 API component bakım/quiescence yordamı kullanılır; geçmiş PRODUCT runID'leri yeni işlem diye replay edilmez. Canonical supervisor görevi desteklenen Stop-ScheduledTask ile kısa süre durur; native4146 veweb5194 çocukları durdurulmaz. Gözetmenin bellekte tuttuğu eski config yüzünden yalnızAPIyi öldürerek kurulum yapılmaz.
3. Yeni API için only4144 exacthandle stop; config.ApiComponent CAS; aynı görev yeniden başlar. Diğer native/web çocuklarının PID/birth/health aynı kalması zorunlu. Kesinti4144 API hizmetindedir;5244iş sayfalarının API okumaları da geçici kullanılamaz. Süre ölçülmeden saniye garantisi verilmez.
4. YeniAPI health/package/DB/normal17/T1false ve yeni GET okuyucular doğrulanır; yalnız sonra5244 eşliweb owned geçişi yapılır. Mevcut Current sahibi/lease korunur; yeni web hazır olana kadar Current uygulama başarı diye yeniden etiketlenmez.
5. Normal Semih stok/kart, satış müşteri+ürün+fiyat seçimi ve cari exacthesap geçmişi normal Chrome'da saltokunur görülür; yenileme/taslak/oturum korunur. Ticari yazma yok.
6. Herhangi bir safhada hata: sonraki eşleşmeyen web başlatılmaz. Aynı sınırda exact APIyi10cdc vewebi5cb uyumlu çiftine yenichild kimlikleriyle döndür; config before-image CAS ve korunmuş native/5194/CRM teyidi. DB restore/reset veya geçmiş kayıt silme yok. Bilinmeyen ownership/CAS durumunda zorla geri dönüş yok; somut hata kaydıyla dur.

### Uygulamadan önce gerçek iki engel

**Yetki:** ERP-DEC-084 metni4144/API upgrade'ini açıkça kapsam dışı bırakır. Eski geniş izoleTESTyetkisi veya yalnızweb yeni kullanıcı talimatı bu daha dar sınırı kendiliğinden kaldırmaz. İstenen ek kapsam yalnız mevcut4144API komponenti ve onu gözeten canonical görev için kısa kontrollü bakım + eşli5244web; DB/roller/veri/native5194/CRM değiştirme değildir.

**Mevcut uygulama yolu:** Eski API bakım yordamı yalnız üç eskiPRODUCTrun'a exactpinned; yeni run için dar kaynak uyarlaması gerekir. Güncel5244dispatcher aday ve rollback'in aynı çalışan APIhealth'iyle uyumunu stopöncesi zorunlu tutar; bu pin mevcut10cdc ile yeniREAD-2b çiftinin birlikte geçişine uygun değildir. Guardı kaldırmak veya yeniAPIyi eski rollback diye tanıtmak çözüm değildir. Aynı mevcut APIcomponent ve5244dispatcher içinde iki exact çiftli fazların bağlanması ve installedRecordPublished=false/stale kayıt için gerçek CAS girişinin hedefli kanıtı gerekir. Yeniowner/engine/tracker kurulmaz. Bu kaynak uyarlaması ve ayrıAPIkapsamı tamamlanmadan varolan driver'ı çalıştırmak uygulanabilir kurulum değildir.

Bu incelemede stop/restart/config/SQL/rol/CRM değişikliği0. Çalışan5244korunur. Private read-pair-api-owner-scope-20261028.json. İnsanUA BEKLİYOR.

## 28 Ekim — Aynı yordamlarda iki exactçift SOURCE uyarlaması; runtime uygulanmadı

Yeni kaynak kapsamı mevcut test125-bound-maintenance-plan/api-quiescence ve5244owner/retirement/dispatcher içindedir; yeniowner/engine/tracker yok. READ2b scope TEST125-API-READ2b-20261028-41d3c213 yalnız hazırlık constructorı ve aynıprocess/thread/referenceissued transition ile kullanılır. EskiüçPRODUCTRunId bu yeni scope yerine geçmez. Token exactstartup/privateprofile/baseprofile hashlerini, eski/yeniAPIcomponentini ve korunacak4146/5194kimliklerini bağlar. Plan hash'i exactAPIcontracthash ve ikiwebçiftinin10pinini birlikte taşır. Normalweb-onlyretire hâlâ aday/rollback'in aynıAPIyle uyumunu zorunlu tutar; parametreflagı veya serializedtoken bu yolu açamaz.

Önceki dar kapsam raporundaki yalnızstartup2alan varsayımı düzeltildi: APIprivateprofile.goal8SyntheticDaySeal.packageId ayrıca yeni exactpaketle eşleşmelidir. Kaynakadapter yalnız bu tekalanı değiştiren fullprofilebefore/after hashCAS ve DPAPICurrentUser+owner/SYSTEMprivatebeforeimage hazırlar. DB/SQLlogin/signer/rol/hesap/izin/ticari/sentetikdaydiğeralanları değişmez; Assert-ErpApiPrivateProfile gevşetilmedi. Bu runtimeyazma onayı veya uygulanmışconfig değildir.

Yeni dispatcher sırası: exactCurrentAPI+web/issuedAPIcontract doğrula → sabitstaleCLEANrow'u gerçekheldCurrentchild ile exclusiveCASyayınla → kendiwebchild'ını retire et → mevcut APIcomponent/quiescence ile yeniAPI → eşliweb yenichild → kayıt/yayın/durablecommit/aynıownergate. Doğrulanabilir hata durumunda candidatecleanup → eskiAPI → yeni5cbrollbackchild; unknown/foreign/archived belirsizliğinde zorla stop/restore yok. Committed/lostACK uzlaştırması finalAPICurrent/Candidate kimliğini de tekrar doğrular; replay yeniAPIstop veya webspawn üretmez.

Bootstrap tek exactbaseline24bb8c... ve eskiD4row/PID2000 yokluğunu ister; gerçekcurrentnativechild creationhandle/Job/SID/argv/portlease yerini recordJSON alamaz. Korunan ikiCLEANrow byteanlamı aynı kalır. Pendingbeforeimage Flush(true), recordCAS ve archivehash doğrulanmadan published denmez; flushbelirsizliğinde Unknown/marker korunur, stalePID otomatik geri yazılmaz. Üretim girişinde ön kontrol pending yaratılmadan yapılır. Bu fonksiyon gerçekinstalledrecord'a çağrılmadı; installedRecordPublished=false hâlâ gerçekdurumdur.

**Yeni hedefler:** business-5244-paired-maintenance8PASS (bootstrap/replay/hashdrift/oldPID/flushfail; forgedtoken/defaultsameAPIret; başarı/rollback/unknown); test125-read2b-pair6PASS (scope/copytoken/mutation/CAS/preservedchildren; aday→rollback/replay; profilCASsonrasıstartupfail; restartreadytimeoutret). BeşdeğişenPSdosyası syntaxPASS. API bakımplanı mevcut4darhedef de agenttarafındanPASS. Testler tempdosya ve kendiömrübağlıPSsleepchild veya scheduler/network/nativebindingfixture kullanır; productionmutex/task/HTTP/SQL/runtimeçağrısı0. WindowsCI yeniikihedefi seriallistesine ekledi; tümgeçmişsuite/paket taraması yerelde yeniden çalıştırılmadı. Darbağımsızreview runtimeişlemi yapmadı.

### Kalan üç somut teknik bağ; henüz kullanıcıdan kurulum onayı istenmiyor

1. Kurulu frozenac860owner bu repodaki yeniAPIadapter/pairedfonksiyonları hotloadetmez. Desteklenen ownergenerationdevri ayrıca bağlanmalı; kaynakdeğişikliği kurulmuşuygulama değildir.
2. Mevcutpipe isteği15saniyedir. Ağır fullpayload/API hazırlığı owner içinde yeniistek oluşmadan tamamlanmalı; yeniistek sonrası kısa CAS/health/kimlik doğrulaması korunmalıdır. Deadline uzatılmaz veya freshness atlanmaz. Şimdiki kaynak bu ağır hazırlık bağını tekbaşına çözmez.
3. YeniAPI Startsonrası hiçsağlıklıadmissionvermezse mevcutadapter eldekibinding'i kapatmış olur ve TEST125_READPAIR_UNADMITTED_RECOVERY_REQUIRES_OWNER ile reddeder. Unknown/Blocked güvenli sonuçtur; otomatik10cdc+5cbkurtarıldı iddiası değildir. Test bu durumda ikinci scheduler/APIstop/configetkisi olmadığını kanıtlar. Desteklenen failed-start ownerrecoverybağı gereklidir.

Bu bağlar çözülmeden genel 'kuruluma hazır' veya gerçekkurulum/GUI/insanPASS yazılmadı. DEC084 yalnızwebyetkisinin dışındaAPIrestart onayı da ayrıca gerekir. Bu tur runtime/config/servis/task/restart/SQL/rol yazımı0; önceki çalışan5244aynı.

### Teknik bağlar kapanınca sunulacak tek onayın altı kısa adımı (bugün uygulanmadı)

1. Çalışan API/web kimliklerini ve korunan servisleri sabitle, dar geri dönüş kopyalarını korumalı al.
2. Yalnız4144API ve onu yöneten gözetmen için kısa bakım aç;4146/5194/CRM çalışmaya devam etsin.
3. API'yi hazır READ2b paketine geçir; startup2alan ve APIayarındaki tekpaketkimliği birlikte doğrulansın.
4. Sağlıklı yeniAPI görülünce5244'ü eşliwebpaketine geçir; Semih oturumu ve taslakları koru.
5. Stok, satış seçimi ve cari geçmişini normalekranda saltokunur+yenilemeyle kontrol et; yeni ticari işlem yapma.
6. Hata halinde yalnızkanıtıtam sınırda10cdcAPI+5cbwebçiftine dön; DB/roller/veriler/yedekler/diğerservisler değişmesin. Belirsizsahiplikte zorla geri dönüş yapma.

## 28 Ekim — Üç eksik için kaynak sonucu ve yeni yalnızweb kullanıcı kararı

Requestöncesi hazırlık aynıownerprocess/thread'de, channel açılmadan yapılır. Yeni Business5244PackageSeal, iki exactweb/node/manifest/payload dosyasını gerçekFileStream+FileShare.Read üzerindeSHAile doğrular ve freeze eder; write/delete kapalıdır. Freshrequest hızlı yolu registeredAPIref/planHash, nativePID/birth ve sealvalidity ile manifest/API/child recheck yapar; 15snonce/freshness sınırı aynı. Commit doğrulanınca gereksiz açıkdosyalar bırakılır. Devamlı runtimeowner henüz bu yeni source'a geçirilmiş değildir.

Failed-start API health olmadan ancak bu invocation'ın Start'ından gözlenmiş COMengine/GUID+ilkCIMbirth, exacttaskpolicy/XML, config/profile/base/launcherhash, stableownedrecord, APIexe/argv/SID/parent/birth ve4144listener kanıtıyla tutulur. Sağlıklıfulladmissiongelirse geçicihandle kapanır; erkençıkmış ama önceden bağlanmışkernel+boşportta ikinciAPIstop0. Kanıtlıtimeoutta mevcutquiescence→eski startup2field+privateAPIseal1fieldCAS→eskitaskstart/healthyreadback ile dönüş mümkündür. İlkcaptureöncesiölmüş/eksikkayıt veya foreign/ilerlemişkimlik otomatik benimsenmez; somut ownerrecovery ret kalır. Üçhelper registeredcontextReferenceEquals/issuedtoken/PID/thread ile başlar; bağımsızreviewP1bulgusu kapatıldı. CandidateToken tekdenemelidir; tamamlanmışrollbacksonrası tekrarCandidate0etki ile reddedilir.

Değişen iki testdosyasında18/18PASS0skip; APIevidenceparenthedefi17somutsenaryo içerir. Normal/full suite ve paketler tekrar taranmadı. İlave controlledmaintenance hedefine yalnız disposablepipe server/child üzerinde1PASS; normalwirehandler hâlâ otomatikstopkomutu sunmaz. NativeControlledShutdown hiçbirPID/komutparametresi almaz; gerçek sameSIDserverpeer'den ayrıterminate+sync/queryhandle alıp nativebirth'i sabitler. Clientpeer veya disposedcontrol stop yapamaz. Gerçek bakımda üst exactbundle/argv/child/koruma kontrolleri ayrıca şarttır; bu nativeprimitive kendi başına kurulum veya eskiadoption izni değildir.

**Yapısal eskiowner bağı:** frozenac860kaynağı yalnızstatus/retire bilir; kendiweb-onlyretire yolunda farklı10cdc/READ2bAPI paketlerini aynıhealth'eeşitlemeşartı vardır. Desteklenen hotreload/exit yoktur. Çözüm source'u belleğe enjekte etmek veya guardkaldırmak değildir. Kullanıcı artık doğrudan yalnız5244'ü kontrollükapatıp yenibaşlatıcıylaaçmayı istedi. Bu tekseferlikwebbakımı exactauthenticatedowner-target ve nativeboundWindowskapatma, eskiJobchildexit+boşport, sonra yeni exactsourceowner'ın Current5cb başlangıcıdır. Yeni başlatıcıdaki pairedAPIapply/PrepareReadPairMaintenance etkinleştirilmeyecek; API4144/roller/profile/SQL değişmez. Önce küçükownerbundle+rollback hazır; otomatikret/foreignprocess/durumu bilinmeyenhandle zorlanmaz. Bu bölüm yazılırken gerçekcut/yeniStart henüz yapılmadı; uygulama sonucu ayrıca kaydedilecektir.

## 28 Ekim — Yalnız5244 kurulumu tamamlandı; bağlantı hatası giderildi

**Çalışan gerçek durum:** yeniowner ec316a63b535544e53a566370b1614a1721f940c; bundle C:\Sirket\ERP\releases\ERP-BUSINESS-5244-OWNER-ec316a63-20261028, manifest61c2b43bf61b9a0ad750d992eab20398d04fcb65318e64c168943899224d64ec/12dosya. Uygulama hâlâ ERP-BUSINESS-WEB-5244-5cb682d8, API CANONICAL-TEST125-BUSINESS5244-10cdc0ee. Yeni source yalnızbaşlatıcı/bağlantıdayanıklılığıdır; READ2b satış/cari okuyucuları kurulmuş değildir. PairedAPImaintenance açıkdeğil.

### Bakım sırasında gerçekte olanlar

- İlk sourcepinned replacement stop0/start0 ile beklenmeyen alt süreç guard'ında kapandı. Sonraki saltokunur inceleme ikiMicrosoftWindows-signedconhost ve exactCurrentpaketmanifestSHA'lı esbuild0.27.7 worker'ını yalnızwebkaynağı olarak kanıtladı; genelçocukallowlist veya doğrudanauxkill yapılmadı.
- V2beforeimage/5kaynaknesli/CAS/PID-birthkontrolleri hazırlanıp darreviewgeçti. Appseal sonrasında ikinci client'ın gövde göndermeden kapanması eskiac860owner'da WaitForConnectionAsync “Kanal kesik” hatası doğurdu. Gözetmen finallycleanup ile kendiJob/webkaynaklarını kapattı; controllerControl.Stop çalışmamıştı (stop0/start0). Bu olay bağlantıakışımızın eski hata yolunu tetiklemesidir; dış kapanma diye gizlenmedi. İlk/V2makbuzlar ve eski stderr korunur.
- Dar ec316a63 düzeltmesi cachedbrokenserver'ı tekrar kullanmak yerine dispose edip sameSID/FIRST_PIPE_INSTANCE korumalı yeniinstanceaçar. Yeniden açılamıyorsa Unavailable durumunda yönetimisteği yetkisi kapalı kalır; normal webJob sırfkanalhatasından kapatılmaz. 15srequest/güvenlik/source/nativekimlik kontrolleri kaldırılmadı. Gerçekizoleownerdöngüsü+ownnativeJobchild ile3bodyöncesiabort→geçerlistatus hedefiPASS; çalışanTEST'te bozukistekprovasyapılmadı.
- Sonra eski5kaynakneslinin çıkışı/boş5244/pendingyokluğu, önceki18port/PIDkoruması veprivateconfig/legacyhash eşliği freshstartöncesi doğrulandı. Desteklenen boşportstart ile yalnızecCurrentowner açıldı; Stop/adopt/diğerservisrestart yapılmadı. CreatorProcess ilkgerçekhandle/birthmakbuzu ve sonraki authenticatednativepeer owner41156/child50028 Running eşleşti. HTTP200;companionsPreserved/controlsPreserved/apiPreserved=true.

### Normal ekran ve sınırlar

GerçekChrome192.168.1.46:5244/ornek-akis.html#stock: mevcutSemihoturumu, stok/barkod/fiyatdöviz alanları; Yenile sonrasında16.992katalogkartı/50satır görüldü. Yenilogin/parola istenmedi; kullanıcıya ait başka5234/CRM/alıştaslakları açılmadı/değiştirilmedi. Görüntü sohbette gösterildi, hamürün/cari tutarlarıGitHub'ayüklenmedi. Buajanokuma/görseldoğrulamasıdır, insanUA PASS değildir.

SQL/ticari/rol/özelayar/profile/görev yazması ve API/native/CLEAN/CRM restart0. 4144/4146/5194 ve5234 dahil diğerhizmetler/PIDbirth/portları, sourcekarantina/LL/medya/migration/yedekler korunur. YeniSQLkopyası/migration/restore yok. GerçekT1/LIVE/Vega/CRM/main değişmedi. StaleCLEANerp-processesPIDkaydı bu işte yayımlanmadı (installedRecordPublished=false); otomatikWindowsreboot/logon kalıcılığı denenmedi, eskibaşlatıcılar yönlendirilmedi. Bu iş yalnızçalışan5244webyenibaşlatıcıdır.

### GitHub ve kanıt

Source2a8fcd7e: requestöncesi immutablepaketseal ve exactfailed-start recovery kaynakları,18hedefPASS; ayrıcontrollednativepeer hedef1PASS. Son ec316a63: actualpipeabortowner-preservation hedef1PASS. Exactec CI40667948912 quality-build-test ve windows-startup-test SUCCESS; secret-scan FAILURE, genelCI yeşildeğil. Taramaistinası veya korumakapatma yok. Source/kurulum/normalGUI/insanUA ayrı tutuldu.

Private: current-owner-2a8fcd7e-replace.json, current-owner-2a8fcd7e-v2-replace.json, current-owner-ac860e8d.stderr.log, current-owner-ec316a63-package.json, current-owner-ec316a63-before.json, current-owner-ec316a63-start.json, current-owner-ec316a63-peer-status.json, current-owner-ec316a63-gui-result.json. Önceki9/12fileownerbundle'ları veCurrent5cbrollbackpaketi korunur; fotoğraf/veri/yedek silinmedi. Bu teslimden sonra yeniAPI/başka finish işi kendiliğinden başlatılmaz.

## 28 Ekim — READ2b kuruluma hazırlık denetimi; mevcut5244 korunur

| Başlık | Kanıta göre sonuç | Gerçek çalışma ayrımı |
|---|---|---|
| Frozenowner | Eskiac860 yerineec316a63 çalışıyor; gerekliAPI/dispatchkaynağı aynı12filecore içinde var. | Çalışanentry PrepareReadPairfalse; APItransitionissueddeğil. Kaynakvarlığı yeniAPImodunun etkinleştiği anlamına gelmez. |
| Request15sn | Ağırhash/seal hazırlığı owneriçinde requestkanalı açılmadan; freshistekte kısa kimlik/CAS/health; protokol15snaynı. | Öncekiizolekaynakkanıtı korunur; gerçekREAD2bgeçişi henüz denenmedi, sürehedefi runtimePASS değildir. |
| FailedAPIstartup | ExactCOM/GUID/ilkCIMbirth/record/argv/SID/parent+erkenkernelcapture; kanıtlıtimeout/earlyexit→eski10cdc+5cbkaynakrollback yolu var. | İlkkanıt oluşmadan ölüm/foreign/ilerlemişkayıt failclosedownerrecovery; otomatikforceadopt/restore yok. Önceki18hedef tekrar edilmedi. |
| Current→sonraki başlangıç | Yeni küçükrouter exacteskiAPIde Current+Prepare, kesincommittedREAD2bAPIde doğrudansteadyReadPair seçer. Böylece sonraki başlangıç eski10cdc'yi zorlamaz veya batch'i tekrarlamaz. | İkidosyalıentryoverlay yalnızhazırlık; aktifecentry değiştirilmedi.3yeni purehedefPASS ve darreviewGO. |
| Legacygirişler | Gerçek5standaloneweb+CLEANstart-erp için mevcutpureprojectionlarla6ASTPASS; before/afterhashler privateartifactte. CLEANstarter embeddedD4pin'i, değişecekD4launcherafterhash'iyle aynıprojeksiyonda eşlendi. | Bu6giriş henüz ortakgate'e katılmadı; gerçekdosyalara yazılmadı. Baremutex veya sourcetestlegacyexclusion değildir. |
| CLEANwebmetadata | Sonkurulum makbuzu installedRecordPublished=false; mevcutstale kayıt korunuyor. | İlkgerçekCurrentchild→rowbootstrap ve soncandidate/rollback yayını exclusiveCAS ile uygulama kapsamına alınmalı; eskiPIDbaşarıdiye yayımlanamaz. |

### Bu turun tek kalan uygulama bileşeni

MevcutkaynakfonksiyonlarıvepasifAPI/webpaketleri hazırdır, fakat **coldownerdevri,6legacygiriş+helperCASyayını, routerentryyayını, aynıprocess/threadissuedAPItransition ile tekretire, yanıt kaybında saltokunuruzlaştırma ve darrollback'i bağlayan mevcutbakımyürütücüsünün exactbuçifte uyarlanması henüz tamamlanmadı**. Sonweb-onlyfreshdriver bunu yapmaz. Yeniengine/anaajan/Goal/tracker gerekmiyor; mevcutyordamın birleşikadaptörü gerekir. Bu nedenle henüz kullanıcıdan onay istenmiyor ve “onaya/kuruluma hazır” yazılmıyor.

### Tamamlanınca sunulacak tek onay taslağı — şu an soru değildir

“YalnızTEST'te4144APIbileşenini hazırREAD2bpaketine ve5244'ü eşliwebpaketine geçirmemi onaylıyor musun? İşlem; korumalıDPAPIbefore-image, startup.ApiComponentiki alanCAS, privateAPIayarında yalnızgoal8SyntheticDaySeal.packageId tekalanCAS, altıeskibaşlatıcının yalnızwebdışlaması/helper ve exactroutergirişi, gerçekwebPIDmetadataCASyayını ve kısa4144/5244kesintisini kapsar. 4146/5194/CLEAN/CRMservisleri, veritabanı/ticari veriler/roller ve diğerprivatealan/sırlar korunur. Hata halinde yalnızkanıtıtam aynıscope'ta exact10cdcAPI+5cbwebçiftine ve öncekiayar/başlatıcıbefore-image'larına dönülür; foreign/bilinmeyen süreçte zorla stop/restore yapılmaz. LIVE/Vega/T1/main veya ticari yazma yapılmaz.”

Kaynak15sn/rollbackkanıtları ve mevcutpaketler yeniden üretilmedi. Bu tur yalnızyeni router3hedef ve gerçekgirişlerinpure6projectionASTkontrolü yapıldı; productionmutex/servis/HTTP/SQLstartçağrısıyok. Çalışanec/5cb/10cdc ve kullanıcının oturumu aynı. Privateartifact: read2b-entry-gate-projection-20261028.json; payload değil yalnızhash/path/sözdizimi sonucu içerir. Hamayar/secret/tutar GitHub'a alınmadı. İnsanUA/sayaçlarBEKLİYOR; genişişletmetesti veya APIkurulumu başlatılmadı.


## 28 Ekim — READ2b tek bakım komutu: kaynak tamam, gerçek uygulama yok

Mevcut `scripts/canonical/install-business-5244-readpair.ps1`, önceki private V2 cold-owner prosedürlerini kaynak içinde yeniden kullanır. Private eski sürücüyü çalıştırmaz, yeni owner/protokol/plan sistemi kurmaz. Normal çağrısı kapalıdır; `-Library` yalnız yordam tanımlar. İncelenmiş kaynak SHA ve ayrıca API bakım onayı olmadan `-Apply` çalıştırılmayacaktır.

Hazır komut (bu tur **çalıştırılmadı**):

```powershell
& C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -File C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018\scripts\canonical\install-business-5244-readpair.ps1 -Apply -SourceSha256 D48A9D269891F60CA3A6C37DE7313551BA022FD8DC99065C082F64FDE8942E3C
```

### Sonlu etki ve geri dönüş

- Exact ec owner/core ve hazır 4b511 router overlay/manifest ile mevcut10cdc+5cb çifti; yalnız hazırlanan READ2b API ve eşli2b web adayı. Yeni paket derleme/tarama bu tur yok.
- Beş eski web entry + CLEAN starter altı dosyanın tamamı exclusive stream ile tutulur. Mevcut legacy çağrı bulunursa ret. Altı before-image CreateNew→Flush(true)→SHA geri okuma tamamlanmadan ilk entry değişmez. D4 embedded SHA aynı CAS kapsamındadır. Helper ve iki router dosyası yalnız CreateNew/hash pinleriyle yayımlanır.
- Kimliği native peer handle, doğum, SID, exact argv ve imzalı conhost/pinli esbuild kaynak zinciriyle doğrulanan **yalnız5244** owner kapanır. Diğer servisler port/PID/doğum/dosya before/after ile korunur. Yeni owner'ın özgün creator Process nesnesi tutulur; hazırlık bitmeden retire gönderilmez.
- Bir retire denemesi; ACK alınmasa da tekrar gönderim yok. Gerçek commit arşivi bootstrap arşivinden ayrılır. Same-owner/child native kimliği + exact planHash + before/records SHA + API config/profile/base hash + API sınır/kimlik ve web200 birlikte doğrulanır. Bu dış salt okunur sonuç owner'ın özel `Dispatch.Completed` token'ını gördüğümüz anlamına gelmez.
- Retire öncesi hata: yalnız aynı held dosyaların before/after SHA'sı kesin ise inverse; kanıtlı kapanmış kaynaklardan fresh Current owner. Yarım/çelişkili entry, yabancı süreç veya belirsiz child varsa recovery-required, otomatik zorla geri alma yok.
- Retire sonrası: API `startup.ApiComponent` iki alanı ve private `goal8SyntheticDaySeal.packageId` tek alanı mevcut issued core/CAS/DPAPI backup yoluyla değişir. Core'un kanıtlı rollback'i eski10cdc API +5cb webi **yeni gerçek child PID** ile döndürür. Kontrolör eski PID/DB kopyası yazmaz. Unknown durumda owner stop/config restore/entry inverse/ikinci retire0; pending ve kanıt korunur.
- Başarılı Candidate veya doğrulanmış native rollback sonucunda güvenli entry gate/router altyapısı korunur. Bu, tüm altyapı dosyalarının hiç kurulmamış hâle geri alınması değildir. İşlem sonrasında kimlik ve kayıtlar gerçek yeni PID'ye bağlı kalır.

### Dar kanıt ve açık sınır

`business-5244-readpair-install.test.mjs`: **9/9 PASS, 0 skip**. Normal sıra, ACK kaybı/tek retire, native rollback sonucunun ayrı tutulması, Unknown'da mutasyon yasağı, pre-retire hata sınırı, gerçek geçici exclusive dosya CAS/inverse, default-deny, bootstrap/commit ayrımı ve partial-entry recovery ret'i. Akış testleri inert I/O kullanır; TEST/API kuruldu veya gerçek finans/SQL kanıtlandı sayılmaz. PowerShell parser hatasız. Bağımsız incelemenin iki P1'i (partial entry atlama ve bootstrap sayımı) ve durable before-image P2'si düzeltildi. Eski14/18/suites/AST-projection/payload kanıtları yeniden üretilmedi.

**Bu tur gerçek etki:** çalışan5244/4144/4146/5194/CLEAN/CRM üzerinde stop/start/install/profile/config/SQL/rol/task0. Yeni source teslimi ve kurulmuş ec Current web ayrı tutulur. İnsan UA değişmedi.

**Kalıcı giriş ayrı açık:** router exact committed config'ten doğrudan ReadPair boot edebilir; ancak bu komut onu bu oturum için başlatır. Altı eski entry yalnız gate alır, Hub/görev/logon otomatik olarak router'a yönlendirilmez. Windows reboot/logon sonrası yeniden açılma kanıtlanmadı; kalıcı normal giriş teslimi tamamlandı denmez. Bu kapsamda yeni scheduler/servis değişikliği yapılmadı.

**Uygulamadan önce gereken ayrı kapsam onayı:** mevcut4144 API +5244 eşli web için kısa kesinti; startup2alan/private seal1alan CAS; altı giriş/helper/router ve gerçek5244 metadata CAS. DB/SQL/rol, native4146/web5194/CLEAN/CRM, diğer sırlar, Vega/LIVE/T1 ve main korunacak. Kaynak komut tek başına bu onayı oluşturmaz.


### Ayrı API bakım onayı ve son salt okunur admission

Koordinatör kaydında kullanıcı,4144+5244 kısa kesinti/eşli güncelleme, dar config/başlatma ayarları ve eski uygulama çiftine dönüş sorusuna açıkça “onaylıyorum” dedi. İletilen kapsam mevcut83303ed7 yürütücüsünün before-image/startup2alan/private seal1alan/6entry/helper/router/gerçekwebmetadata CAS işlemidir. Hub/task/logon kalıcılığı ve reboot kapsam dışı; rol/DB/ticari/diğer servisler aynı.

Taze salt okunur kontrolde API10cdc/aynıTESTDB, owner41156/child50028 ve beş web kaynağı doğrulandı. Gerçek Windows Start-Process argv sonunda tek ASCII boşluk bulundu; kurulum denemeden önce dar kabul düzeltildi. Yalnız exact argv veya exact argv+tek boşluk kabul edilir; Trim/genel whitespace/ek argüman kabulü yok. Yeni hedefli1 test PASS; kaynak SHA yukarıdaki komuta güncellendi. API bakım uygulaması bu kayıt anında henüz başlamadı. Önceki CI kalite SUCCESS/Windows sürüyor/secret-scan11 aynı tarihsel bulgu FAIL; genel CI yeşil değildir.


### Onaylı ilk uygulama, loader hatası ve doğrulanmış Current kurtarma

Onaylanan d6649e98 kaynaklı ilk çağrı bir kez yapıldı. Altı entry gate ve router dosyaları yayımlandı; eski ec owner native handle ile kapandı. Yeni36768 PowerShell, yayımlanan entry üzerinde açık RW/FileShare.Read writer varken dosyayı okumaya çalıştığı için script yüklemeden çıktı. retireAttempts0, API10cdc/PID23156, private/startup/base hashleri aynı kaldı. `newResourceRows0` guard'ı genel fallback'i kapattı; bu ret gizlenmedi/gevşetilmedi.

Ayrı mevcut destekli empty-port fresh Current recovery, önceki operasyonu, eski ve failed-owner süreçlerinin yokluğunu, boş5244/pendingyokluğunu, exact core/Current API/profile/config/protection eşliğini kontrol ederek yapıldı. Original fresh creator tutuldu; authenticated peer ile owner42868/child8640 ve beş kaynak doğrulandı, web200. APIrestart/retire/SQL/rol0. Eski süreç veya PID sahiplenilmedi. Kanıt: private `read2b-install-once/result.json` ve `read2b-loader-failure-current-recovery.json`; eski kayıtlar değiştirilmedi.

Dar loader düzeltmesi: CreateNew write→Flush(true)→hash readback→writer close→reparse/SHA tekrar kontrolü→ReadOnly/FileShare.Read seal. Gerçek temp Windows PowerShell okuyucusu çalıştı; seal yazmayı reddetti. Yeni sonlu continuation yalnız ilk exact pre-retire loader failure + bu verified recovery + canlı native Current generation + altı exact after-hash + özgün durable before-image + değişmemiş API/config/profile/diğer servislerle kabul edilir. Önceki receipt/loglar korunur; ikinci continuation aynı sabit once dizini nedeniyle reddedilir. Eski generic fallback/retire/reset guardları aynı.

Continuation başlatma komutu (bu kayıt anında henüz çalıştırılmadı):

```powershell
& C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -File C:\Sirket\ERP\worktrees\erp-p03-pr53-candidate-20261018\scripts\canonical\install-business-5244-readpair.ps1 -Apply -AfterLoaderRecovery -SourceSha256 ADDD235DEC64255FAC7A35716F9F6A1DE0ACDF9D6D75A65617AB3280B5795AAA
```

İlave hedefler: gerçek temp PS reader1PASS, exact continuation negatifleri1PASS, map-sırası bağımsız exact alan/baseline negatifleri1PASS; gerçek hedefte yalnız readonly continuation admission PASS. Eski geniş suite/paket taraması tekrarlanmadı. Kalıcı Hub/logon/reboot ve insan kabulü aynı ayrı açık sınırdadır.


## 28 Ekim — gerçek nonce süresi engeli, immutable API/base düzeltmesi ve harici bakım sınırı

### Gerçek sonuç

Continuation tek retire denemesi11:12:25.663Z, bootstrap yazımı11:13:36.356Z (**70,693223sn**). Ardından ilk `Invoke-Business5244OwnedRetirement` request reference/deadline guard'ı15sn süresi dolmuş isteği kabul etmedi. Dispatcher Unknown'da Current native child'ı korudu; API geçişi başlamadı. Controller91708 kendi15dk salt okunur uzlaştırma sınırında11:27:42Z `READPAIR_RECONCILIATION_TIMEOUT_NO_REPLAY` ile kapandı. İkinci retire/owner stop/inverse/restore yapılmadı. Eski başarısız ilk loader çağrısı ve ayrı Current kurtarma kanıtları da korunur.

Bağımsız post-close native status: owner42216/child25564, `Unknown`; Current web5cb HTTP200; API10cdc/user17/aynıTESTDB; startup, privateAPI ve base profile hashleri aynı; diğer servis port/PID/doğum/dosya koruma imzası aynı. Yalnız Current metadata bootstrap arşivi var; gerçek paired commit/pending yok. Bu, owner'ın private terminal `NoEffects` yetkisini ürettiği anlamına gelmez.

Gerçek Chrome'da mevcut Semih oturumu reload sonrası geri geldi; stok16.992/50, müşteri listesi ve ayrıUSD kartı görüldü. Eski5cb Satış “henüz bağlı değil”; yeni hesap geçmişi API'si kurulmadığından geçmiş açılamıyor. Bunlar yeniREAD2b GUI kabulü olarak işaretlenmedi; ticari kayıt/form gönderimi yok. Stok ekranının görüntüsü sohbette gösterildi; yeni bir PNG dosyası üretildiği iddia edilmez.

### Aynı dolaylı çağrı yolundaki kaynak düzeltmesi

`New-Test125ReadPairTransition` nonce açılmadan önce base+CurrentAPI+CandidateAPI payload'larını gerçek `Business5244PackageSeal` v2 ile hashler ve read handle'larını tutar. Her ancestor için native directory handle (shareREAD|WRITE/noDELETE), başlangıç finalpathname/volume/FileID/type/reparse bağı; her payload gerçek READ/shareREAD handle üstünde SHA. Request-time `Validate` native handle/fileID/type/reparse'ı kontrol eder; payload yeniden hashlenmez. Yeni policyversion zorunlu; eski frozen native sınıfı hotload ile kabul edilmez.

Prepared proof process/thread/SID/issued object reference'e bağlıdır. Yalnız gerçek `Read-ErpStartupConfig`'in ürettiği config referansı ve ondan türeyen API projection fastpath kullanabilir. Caller-built veya JSON copy config/proof reddedilir. Node ve manifest freshSHA/reparse/source, privateprofile/config exacthash, owner/health ve hedef koşulları kalır. Varsayılan standalone/canonical ReadStartup/AssertRelease FULL'dür. Paired GetPlan/Open/StoppedSupervisor/failedStart/beforeStart ve transition/rollback dolaylı okuyucuları aynı proof'u taşır. Owner finally owned child'lar kapandıktan sonra proof'u kapatır; hata halinde gate güvenli kalır.

Installer beklenen token/plan hash'ine aynı ordered **public** packageProof pinleri eklendi; opaque token/id aktarılmaz. Gerçek inert constructor ile aynı immutable pins/contract/planSHA eşliği ayrıca test edildi. Future controller authenticatedUnknown'u hemen terminalfailure sayar; stop/inverse/replay eklemez.

### Dar doğrulama

Yeni production-path dosyasında5 hedef PASS/0skip: standaloneFULL/nativeclass yokken gerçekhash doğrulaması, gerçektemp native write/delete/ancestorrename engeli+unrelatedwrite izni, junction reddi, gerçekConstructor/ReadStartup/AssertRelease/pairdolaylıcallpath payloadhash0, foreign/copy/thread/closed/profile/manifest/candidatecorruption negatifleri. Installer gerçekconstructorpublicpins/planhash entegrasyonu yeni1PASS. Etkilenen eski constructor/taskCAS/replay fixture'larının4 hedefi güncellenip PASS; tüm eski18/suite/payload paketi tekrar çalıştırılmadı. FutureUnknown classification ve currentmetadatafinitebaseline yeni hedefleri PASS. Bağımsız native/API/root entegrasyon incelemesi GO; gerçek15sn yeni owner provası ve yeni kurulum henüz yok.

### Desteklenen çıkışın gerçek sınırı

Frozen ec owner, aynı issued request/plan'a bağlı terminal `PreRetireExpired/NoEffects` capability üretmiyor. Status/CIM/bootstrap/API eşliği bu capability yerine konamaz. `OpenControlledShutdown` gerçek peer handle'ı verse de Unknown stop guard'ını dolanma yetkisi değildir. Agent CLI/UI/nativekill, frozenhotpatch veya JSON token üretme yapmayacak.

Tek uygulanabilir **harici insan** bakım eylemi: o anda source/argv/native PID-doğumu tekrar gösterilen **yalnız owner42216** kullanıcının Windows Görev Yöneticisi'nden kendisinin sonlandırmasıdır. Child25564 owner'ın Job'u ile kapanır; API4144/native4146/web5194/CLEAN/CRM kapatılmaz, reboot gerekmez. Bu yalnız5244 kısa kesinti oluşturur; yapılmadan önce yeni başlatıcı/fresh-start malzemesi hazır olmalıdır. Ajan aynı kararı otomatik kill iznine dönüştürmez. Sonrasında tüm eski web kaynaklarının çıkışı, boş5244/pendingyokluğu, aynıAPI/profile/koruma ve yeni original creator/Job koşulları yeniden doğrulanır; yabancı işgal/ret varsa zorlanmaz.

Mevcut Current metadata hash3bfd.../PID25564 için source publisher'a yalnız **bu exact after-image** finite CAS baseline eklendi; PID25564 canlıysa hâlâ ret. Bu yalnız yeni owned Current child'ın metadata'sını, harici bakım gerçekten tamamlandıktan sonra yazmaya yarar; hiçbir shutdown/Unknown reset yetkisi vermez. Eski commands/frozenec API-proof generation v1 ile yeni prepared flow çalıştırılmaz; yeni core/router source malzemesi gerekir. KalıcıHub/logon/reboot ve insanUA aynı ayrı açık sınırdadır.


## 28 Ekim — ikinci gerçek admission süresi hatası ve dar düzeltme

Kullanıcının dışarıdan kapattığı eski owner42216/child25564 sonrasında yalnız bir fresh-start yürütüldü. Yeni owner31768, child41116, source d3032186; Current5cb web ve önceki10cdc API korunmaktadır. Tek retire12:13:28.0982183Z; Current bootstrap12:13:42.2393695Z (14.1411512sn). Sonraki assertion15sn sınırını geçti; owner Unknown, controller12:13:46Z READPAIR_FINAL_OWNER_UNKNOWN ile durdu. API23156/edb3c891 değişmedi. Gerçek yeni READ2b API/web commit/archive yok; bootstrap arşivi eşli uygulama commit'i değildir. Üçüncü runtime denemesi, Unknown stop/adoption, yeni veri hareketi veya otomatik inverse yapılmadı.

Düzeltme aynı mevcut owner/channel/dispatcher içinde kalır: ağır immutable kaynak doğrulaması ve Current metadata CAS/archive nonce öncesinde; API'nin gerçek issued context'inden dört salt okunur creation/birth handle'ı hazırlanır. İstek sırasında aynı handle'lar, profile/config/launcher hashleri, gerçek COM görev XML/instance/engine, tek port sorgusu ve üç health kontrolü taze doğrulanır. Web için aynı native Job/creation handle ve taze5244 bind kontrolü kalır; request yolunda ağır CIM/plan tekrarına gerek yoktur. Nonce öncesi bütün read-only admission ve iki metadata kontrolü10sn bütçeyi aşarsa request kanalı açılmaz.

Input/body geliş sınırı15sn korunur. Exact gövde kabulünden sonra monotonic, client tarafından seçilemeyen ayrı60sn admission vardır. Client ACK15sn ve controller salt okunur uzlaştırma15dk ayrı sınırlardır.60sn sınırı bağlantısı kopmuş peer'a hak vermez; nonce/ref/body/hash/PID/birth/thread/once/foreign kontrolleri gevşetilmez. Yanıt kaybı ikinci retire/stock/finance etkisi oluşturmaz.

Retiring öncesi son peer/deadline kontrolü yapılır. Yalnız gerçek aynı-issued request, hâlâ canlı özgün native çocuk, aynı plan/API context ve tüm transition state alanları boşken, diskte pending de yoksa typed expiry `PreRetireExpiredNoTransitionEffects` olarak sınıflandırılır; Current Running kalır, yeni geçiş başlatılmaz. Yazma/retirement belirsizliği Unknown kalır. Bu yeni kaynak frozen31768 için geriye dönük capability değildir.

Özel kanıt: repo dışındaki `read2b-after-external-owner-exit-once/continuation-result.json` ve aynı operation stdout; kaynak, pasif paket, gerçek kurulum, normal GUI ve insan kabulü ayrı durumlar olarak korunur. Desteklenen sonraki giriş yalnız frozen owner'ın dışarıdan gerçekten çıkması ve exact tüm kaynaklarının/boş port/protection baseline'ın doğrulanmasından sonraki yeni sahipli başlatmadır. Bilinmeyen owner zorla kapatılmaz.

### Dar doğrulama ve sınırlar

- Yeni `business-5244-readpair-admission.test.mjs`:4 ana senaryo (gerçek issued-pipe/Job/creation-child/dispatcher/held CAS/commit; pre-nonce bootstrap, normal tek etki/readonly status,18sn admission+normal client15sn ACK kaybı, gerçek61sn admission expiry,15sn pre-body timeout) ve1 kontrollü clock-fault testi iki varyantla PASS. Normal fixture ölçümü cold410ms/warm19ms/request244ms; gerçek18sn gecikmede API/retire etkisi0. Kontrollü Retiring expiry Running/PreflightFailed; pending belirsizliği Unknown/Blocked ve ikinci etki0. Koşular hedeflidir; bütün eski suite yeniden çalıştırılmadı.
- API/HTTP/paket/ağ/CIM/COM sağlayıcıları bu entegrasyon fixture'ında açıkça mock'tur; aynı production Prepare/AssertPlan/dispatch/state/native pipe/Job gövdeleri, yalnız sabit dosya/pipe hedefleri temp'e yönlendirilerek çalıştırılmıştır. Bu ölçümler gerçek kurulu API/admission süresi değildir. Ayrı prepared-API hedefi gerçek query-only native handle ve immutable temp payload üzerinde constructor/reference/COM/TCP/health/provider negatiflerini doğrular.
- Bağımsız review iki dar kapsam eksikliğini kapattı: web fresh TCP kontrolü çocukPID OR5244 bütünlüğünü korur; API quick admission gerçek `owned-processes.json` kaydını source/supervisor/başlangıç ve çocuk PID/doğum alanlarıyla semantik olarak taze kontrol eder. Heartbeat/JSON biçimi ham hash ile dondurulmaz. Bu son delta için6 sahiplik drift negatifi+izinli heartbeat hedefi PASS; ağır CIM/plan/payload çağrısı0.
- İlave değişen paired-state5, dispatcher2, owned readiness/parse2, exact metadata baseline1 hedefi PASS. Başlangıçta eski dispatcher fixture production mutex'e yönlendiği için test fail-closed oldu; fixture benzersiz Local temp mutex'e ayrıldı, ilgili2 hedef yeniden PASS. Kurulu owner'a stop veya veri etkisi olmadı.
- Gerçek frozen31768/41116 ve API23156 değiştirilmedi. Yeni kaynak kurulmadan normal satış/cari geçmişi veya10sn gerçek admission bütçesi doğrulandı denmez. Yeni insan UA PASS yok. CI mevcut exact commit sonucu olarak ayrıca raporlanacaktır; eski secret-scan hatası kaynak-test başarısıyla yeşil sayılmaz.


## 28 Ekim16:39TR — READ2b gerçekten kuruldu ve normal ekranda doğrulandı

Bu sonuç önceki BLOCKED kayıtlarından daha yenidir. Kullanıcının exact31768 sonlandırması gerçek5kaynak çıkışı ve boş5244 ile doğrulandı. Önceden kapatılmış CRM62700–62704/4PID için insanın “hepsini kapattım” açıklaması, yalnız bu exact kapalı tuple'ları kapalı koruyan before-image projection'a bağlandı; diğer bütün listener/process/file kimlikleri değişmedi. CRM yeniden başlatılmadı ve başka DB/source seçilmedi.

Aynı kapanışta canonical supervisor26476 da çıkmış, görev Ready/instance0/0xC000013A olmuştu. İlk b941 fresh preparation bu gerçek task-state guard'ında durdu (issued retire0/API değişimi0). Görev XML'i e959af0b…d99a, source/entry/config/3çocuk SID/argv/PID/birth/health exact doğrulanıp önceki değerler kaydedildi; yalnız mevcut desteklenen Windows görevi başlatıldı. Supervisor51796 gerçek owned/COM kaydına geldi,3çocuk aynı PID'lerde ve restartCount0 kaldı. Guard gevşetilmedi. Finite continuation mevcut log-slot varlığında start öncesi reddedildi; eski kanıt korunarak aynı operation'ın sabit task-recovery log slotuyla devam edildi.

- Gerçek source/core **b9416929**, owner49668. Uygulama frontend **2b744f5b**, web16084; API **CANONICAL-TEST125-BUSINESS5244-READ-2b744f5b-20261028-41d3c213**, PID46124. API health base source edb3c891, paket/source/core kimlikleri ayrı tutulur.
- Hedef **Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01**, normal aktör17; sysadmin/databaseControl/LIVEaccess0, actualT1false. Source/rol/ticari veri yeni migrasyonu yok.
- Toplam2fresh-start: ilk preparation fail1 + başarılı1. **Tek retire13:34:20.932Z**, tekrar0. ACK15sn kaybından sonra yalnız read-only sonuç uzlaştırması; controller exit0/**CandidateVerified13:39:11.604Z**. Eşli arşiv `5244-retirement.pending.f67405a1ad6e4ae6abdaef6608c4405c.completed`, pending yok. Bootstrap arşivi eşli commit yerine sayılmadı.
- 4146/native2288,5194/web47272,5234/web39668 kimlikleri korundu. Haricen kapatılmış CRM servisleri kapalı bırakıldı. Kalıcı Hub/logon yönlendirmesi ve Windows reboot kabulü bu sonuçla tamamlanmış sayılmaz.

**Normal GUI — ajan doğruladı, insan kabulü değil:** Chrome'da Semih mevcut oturumuyla iki yeni normal yeşil sekme açıldı; yeni parola/giriş istenmedi. Satışta gerçek müşteri ve ayrı USD hesabı, gerçek ürün/barkod/fotoğraf ve kayıtlı satış kademesi seçildi; GET doğrulaması “Müşteri hesabı ve fiyat bilgileri eşleşti” verdi. Satış/borç/stok hareketi oluşturulmadı; bu read-only seçim/sepet hazırlığı satış kaydetmeyi açmaz. Cari kartında doğrulanmış sıfır/boş geçmiş ayrı gösterildi; hareketli başka gerçek hesapta25satırlık sayfa1→2→yenileme, seçili hesabı/dövizi/sayfayı korudu. Genel bakiye ile hareket neti birleştirilmedi. Ekran görüntüleri aynı konuşmada gösterildi; kaydedilmiş PNG iddiası yok. Ham cari, tutar ve ekran verisi GitHub'a alınmadı; repo dışı `read2b-installed-normal-gui-readback-20261028.json` kanıtındadır.

**CI ayrımı:** b941 qualitySUCCESS/secretFAIL, Windows sonraki doküman commit'i nedeniyle cancelled. 83aa doküman CI'sında qualitySUCCESS; Windows step16 yeni fixture'ların kısa8.3/hidden AppData temp yolunda başarısız oldu, üretim guard'ı doğru kapandı. Yalnız2test dosyası RUNNER_TEMP/kanonik native uzun temp yoluna bağlandı; cleanup aynı seçilmiş rootla sınırlıdır. Etkilenen4preparedAPI ve1normal issued-pipe zinciri PASS,0skip; eski61sn/native/diğer suite tekrarı yok. Gerçek hosted CI dalı yeni normal commit çalışmasında ayrıca doğrulanmalıdır; secret-scan istisnası veya elle rerun yapılmadı. İnsan USER_ACCEPTANCE ID'leri PASS yapılmadı.


### 28 Ekim — Mevcut native satış sözleşmesine kaynak hazırlığı

**28 Ekim — READ2b kurulu; satış yazma bağlantısı kaynak hazırlığı:** Çalışan5244 web16084/API46124/coreb9416929 korundu; gerçek Semih17 müşteri/hesap/ürün/fiyat GET doğrulaması ve müşteri hareketleri sayfa2+yenileme önceki normalChrome kanıtıdır. Bu tur CUA/SQL/rol/ticari yazma/kurulum/restart0. Kaydetmenin kesin engeli: business gate yalnız auth POST kabul eder; mevcut native writer actor15/16 ve dar sentetik kapsamla, geniş selected writer ise DB02/server-proof ile sınırlıdır. SQL canInsertSales1 genel yazma izni değildir. Mevcut canonicalBusinessSaleReadService içinde prepareNativeSelection exact müşteri+hesap+döviz+ürün+fiyat+birim/kademe seçimlerini taze okuyup mevcut workSelectedSaleInput ile native DTO'ya hazırlar; ayrı hesap bağı korunur, yinelenen ürün/farklı quote birleştirilmez, unknown/hold/negatif/yetersiz stok ve authority drift reddedilir. Native transaction/context/preview zorunlu; invoice toplamı/hash/UUID veya yazma yetkisi üretilmez; HTTP route ve canSave/finalize/collect kapıları açılmadı. Yeni5 + etkilenen mevcut8 test PASS/0skip. Bu yalnız SOURCE; çalışan satış kaydetme teslimi veya insan UA değildir. Önceki d5a hosted CI iki koşuda qualitySUCCESS/secret-scanFAIL/Windowscancelled; fixture yerel5PASS hosted WindowsPASS sayılmadı, rerun yok. Sıradaki tek halka aynı gerçekTEST01/Semih17 için native hesap-kaynak-transaction admission bağını mevcut writer üzerinden tamamlamak; korumayı kaldırmak veya DB02'ye yönlendirmek değil.


### 28 Ekim17:14TR — B6 native admission kesin engel

**28 Ekim17:14TR — B6 gerçek native engeli salt okunur kesinleşti; B6 AÇIK:** Fresh PID/port/argv:5244web16084,4144API46124 READ-2b744f5b-41d3,4146native2288 CATALOG-COMPAT-0a221778;5194/5234aynı.4144healthok; SQLdm_exec_sessions gerçekAPI46124→melisa_sirket_sales_test_20260929_01 bağlantısını doğruladı. TrustedWindows bağlantısında yalnız SELECTmetadata: TEST01/SemihMELISADEV exact, aktör17/rol17aktif; sales.create/finalize/cancel zaten var, rolartışı gerekmiyor. Kurulu work_trade ready/context/effects hashleri Goal8proof ile birebir; eski kapsam2ürün/1TRY, context aktör15/16 rollerini açıkça sabitliyor. Finans/stock/sales guardları enabled. Geniş selected native account/rate/quote/transaction+intent bağı yalnız DB02copyproof yolunda; invoiceDraftService.businessInvoiceSelection TEST01'de null döner, seçili party_currency_accounts yerine genel kart dövizine düşer. Bu nedenle yalnız capability/gate açmak veya17'yi15/16gibi göstermek güvenli entegrasyon değildir. Ek helper/engine/testsuite/CIrerun üretilmedi; runtime/SQL/rol/ticariwrite0, CUA0. Eksik kullanıcıparolası/rol/kimlik değil; TEST01 için normal17 exact dövizhesabı+native source/quote/kur/transaction-intent/journal/effectadmission revizyonu yok. Uygulanabilir tek sonraki adım mevcut motorun bu dar SQL+source revizyonunu exact scope/before-image/inverse ile incelemeye hazırlayıp ayrı kontrollü kurulum/provaya almak; bu tur SQLdeğişimi/gerçeksatış/kurulum yetkisi yok. Source3fb5preparation kanıtı korunur, çalışanwriter/GUI/insanUA tamam sayılmaz. Ham SQLtanım/izin/kimlik kanıtı private tutuldu.

### 28 Ekim — B6 native admission kaynak inceleme paketi (KISMİ / APPLY YOK)

Çalışan READ2b/coreb9416929/web2b744f5b/API46124 aynı. Bu teslim bir kurulum, native satış kabulü veya B6 kapanışı değildir. Aktör17'nin mevcut izinleri korunur; parola/rol/SQL grant değişimi yoktur.

| Parça | Gerçek hazırlık | Açık bağımlılık |
| --- | --- | --- |
| canonicalBusinessSessionContext | Production pool/driver tarafından oluşturulmuş private native transaction; target/login/SPID/TX/Exclusive lock/üç proc hash'i, fresh SQL owner assert, raw UTF16 bodyhash, exact account/quote/qty/native4 arithmetic ve finally cleanup | Protected profile/startup bağlanmadı; owner proclar/rowphase/replay-dispatch tamam değil |
| invoiceDraftService + nativeCurrencyAccount | Mevcut motorun canonical actor17 dalı; proof yoksa ret; seçili döviz hesabı, snapshot ve tek posting; ana kart yalnız kendi dövizinde; pca28,8 üzerine exact4 delta; iptal aynı hesabı tersler | Gerçek SQL owner-issued binding olmadan girilemez; normal ekran yazma kapalı |
| canonical-business-sale-admission-sql | 72 eski sealed referansın frozen before-image ve exact after-image hash kapanışına yönelik immutable registry/seed/read-only projection altcompiler | FULL_ADMISSION_NOT_READY, installable:false, prefix semantics verified:false; issuer/context/effects/rowguard/legacyreadiness tüketicisi yok |

Private exactbefore: `b6-native-exact-dbo-before-metadata-20261028.json`, SHA256 A89BA46ED624409464C557EA38D8C2EB8E7FD0AB493CA575387D11DB4FF1E377. Legacyclosure `b6-native-legacy-seal-closure-20261028.json`, SHA256 0C5A96724EB0485A7850ECC1061439B2F2D6080FC79CB8766A84E5112F6B3627. Ham modüller, kolon/rol/grant ve kaynak ticari tuple'ları GitHub'a taşınmaz. İlk export'taki tekrarlı tablo adları schema/objectId ile ayrıştırıldı; compiler yalnız exactdbo kaynağını kabul eder.

**Tam revizyonun değişiklik kapsamı:** mevcut JS satış parser/model/store içinde exact `customerAccountId` selection→previewhash→body/journal boyunca korunacak; yeni native admission tek TEST01/17 named scope'tur. Owner-produced immutable scope/native tuple hash, same SPID/TX request intent ve statement-phase guard/effects mevcut native invoice/journal/replay motoruna bağlanacak. Legacy sales/item/stock/product/customer/movement/audit/link/intent/request guard'ları ve ready/context/effects procları successor hash registry üzerinden doğrulanmadan değiştirilmeyecek. Eski15/16/DB02 kimliği taklit edilmez. Eski15/17/22/18 manifest satırı ve immutable korumaları aynen kalır; gerçek after-definition +original-projection, yeni readiness tüketicisi ve JS proof pinleri birlikte doğrulanmalıdır. NULL projection her tüketicide kesin ret olmalıdır.

**Kaynak sözleşmesi:** istemciden gelen JSON/flag/hash kendi başına otorite değildir. Owner hazırlığı mevcut normal katalog/cari okuyucularından alınmış exact native source tuple'larını, kaynak sürümü/hold/birim/maliyet/döviz kanıtıyla doğrulamalıdır. Kimlik/fiyat/source alanları sealed typed-row hash'e girer; hareketle değişen stok ve bakiye mühüre gömülmez, fresh context/revision'a girer. NULL, bilinmeyen maliyet/kur, pasif/hold, birim/fiyat çelişkisi ret. Tarihli döviz kaynağı korunur; fotoğraftan fiyat veya kaynaksız kur üretilmez. İlk kaynak seam'i dar sentetik TEST prova sınırını korur (en fazla2satır,1–5tamADET,belge veTRYeşdeğeri ayrı ayrı500); bu günlük işletme için yeni genel limit veya insan kabulü değildir.

**Yedek/before-image/inverse:** Kurulu sisteme yazma olmadığından bu tur restore/rollback yoktur. Gelecek apply öncesi exact artifact/DB/login/proc/trigger/schema/index/grant pinleri ve aynı owner kapsamı yeniden doğrulanacak; güncel TEST yedeği ve bağımsız restore provası ayrı kanıt gerektirir. Eski manifestler güncellenmez, trigger kapatılmaz. Yeni kaynak kodu eski çalışan paketlerin üzerine yazılmaz. Bir native17 işleminden sonra toplu DB restore veya registry/table drop inverse sayılmaz: admission durdurulup devam eden TX boşalmalı, journal/history/hesap ve sonraki yerel etkiler korunmalı; yalnız exact request'in yetkili native ters işlemi kullanılmalıdır. Şema inverse ancak referans/işlem yokluğu ve tam after-image eşliği kanıtlanırsa planlanabilir; aksi durumda additive history consumer korunur ve manuel inceleme gerekir.

**İzole prova yöntemi:** Gerçek TEST125 üzerinde yazma yok. Tam SQL+app artifact hazır olduğunda mevcut izinli izole altyapıda yalnız sentetik seçili scope ile draft→finalize→cancel, exact8 bakiye, stok/cari/journal etkisi, aynıUUID/body replay, farklıbody ret, response-loss ve ara-statement fault/rollback testleri yapılmalı. Eski15/16/Goal8 ve DB02 proof closure korunmalı; source/SQL/kurulum/normalGUI/insanUA ayrı yazılmalı. Bu tur yapılan40 hedef yalnız source/VM/offline compiler testidir; gerçek native rowguard/replay/restore/GUI provasının yerine geçmez.

**Gereken sonraki ayrı onay:** Bugün kullanıcının bir parola/rol kararı gerekmez. Kaynak hazırlığına devam yetkisi vardır. Henüz uygulanacak tam ve sayısal kapsamı donmuş finans/SQL paketi yoktur; bu kısmi artifact için uygulama onayı istenmez. Tam artifact sonrası yalnız adı/hash'i ve exact sentetik scope'u sabit TEST01 SQLadmission DDL+izinli izole finans/stok provası+gerekli API/native paket geçişi tek somut onay kapsamı olarak sunulmalıdır. Önceki4144/5244bakım onayı bunları kapsamaz. Vega/LIVE/CRM/main/T1 yok.

Hedefli doğrulama: transaction6, nativeinvoice/accountVM9, projection7, değişen importcontract nedeniyle üç eskiVMfixture18; toplam40PASS/0skip. Üç VMfixture'a yalnız yeni zorunlu contextgetter için `null` sağlayan default bağ eklendi; davranış/koruma/skip değişmedi. Bağımsız review'de bulunan caller-factory P1, production-only opaque issuer ve forgedfactory negatif testiyle kapandı. Yeni kaynak CI henüz değerlendirilmedi; genel build/CI/rerun döngüsü yapılmadı. B6 ve insanUA açık.

### 28 Ekim — koordinatörün mevcut sekme gözlemi; B6 sonrası araştırma

Koordinatör, kullanıcının yeni salt okunur ekran isteğiyle mevcut 5244 Chrome sekmesini gözlemlediğini bildirdi. Seçili marka filtresinde pasif kartlar ve negatif stok örnekleri görüldü; 16.992 katalog kartı sayısı yalnız aktif kart sayısı değildir. Müşteri listesi açıldı ve bazı hesaplarda Bilinmiyor gösterildi. Aynı mevcut sekmede Satış sayfası bağlantının henüz hazır olmadığını bildirdi. Bu kayıt, önceki ayrı yeni sekmelerdeki READ2b müşteri/hesap/ürün/fiyat GET seçimi kanıtını bütün sekmeler için güncel kabul ilan etmez. Tab/paket/oturum ve korunmuş taslak farkı B6 kaynak işi tamamlandıktan sonra güvenli read-only karşılaştırmada incelenecek; şu an runtime veya veri değişikliği yapılmadı. Bu gözlem verinin yanlış olduğuna veya bir insan kabulünün geçtiğine kanıt değildir. Stok için yalnız aktif kapsam ayrımı sonraki kayıtlı D1'de, bütün müşteri kartlarını koruma kararı ise cari kapsamda izlenecek. Bu root turunda CUA yeniden başlatılmadı.


### 28 Ekim — B6 tam kaynak/SQL artefacti; gerçek uygulama yapılmadı

**28 Ekim — B6 tam dar kaynak/SQL artefacti hazır; uygulama ve gerçek SQL/GUI kabulü açık:** Mevcut fatura motoru, SQL-bound transaction/intent, taslak→kesinleştirme→iptal, mevcut journal/replay ve seçili döviz hesabı bağlantısı kaynakta birleştirildi. 14 aktif catalog/stock/supplier/C09/inbound/payment/FX/contact tüketicisi actual self/dependency pinleriyle kapanır; customer, dated detail/list, historical base-stock, arşiv sürümleri ve native4146 değişmez. Source snapshot yalnız2 fiziksel ürün/2 USD fiyatı/1 müşteri hesabı/1 native TEST kurudur; rakamlar private kalır, güncel Vega veya T1 değildir. Tek artefact25 mevcut modülün byte-eşit eski gövde+dar prefix revizyonu,31 yeni modül,7 özel metadata tablosu/1indeks, izin before-image/inverse ve1geçici header-policy probe içerir. Eski72manifestreferansı/manifest satırları aynı; yeni roller/grant bypass yok. Yeni4EXEC+20VIEWmetadata+6özel tabloDENY statement'ı ayrı uygulama kapsamında açıklanır; eski bir VIEW zaten vardır, native izin değişimi0. Native geçmiş commit edildiyse toplu DDL inverse/restore yasak; ilgili satış inverse'i ve history korunur. 100 değişen-sözleşme hedefi kaynak/izole fixture PASS; 284 üretilmiş SQL birimi ScriptDom0hata; bağımsız kaynak review GO. Bunlar native SQL compile/etki/prova, paket/normal GUI veya insan kabulü değildir. Revision9F232D0D83754017B37E23E16D67DAD71AE3A53ABAEFBBDA867DB5C46D90F6AF. installable=false/executeAllowed=false; ayrı exact TEST DDL+sentetik prova onayı, fresh backup/owner CAS ve koordineli API/web kurulum/readback olmadan çalıştırılmaz. Kurulu READ2b, veri/rol/yedekler/diğer servisler korundu; bu tur DDL/ticari/rol/kurulu-runtime/CUA0. B6 AÇIK; gerçek kapanıştan sonraki tek iş D2, sonra D1/D3.

Private artefact, apply/inverse SQL, app descriptor, before-image metadata, tam tutarlı kapsam/prova inceleme tablosu ve grammar sonuçları aynı mevcut ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027/private alanında tutulur. Ham cari/ürün değerleri, ticari tutarlar ve SQL metadata orijinalleri GitHub'a konmaz. Eski kabul edilmiş40/18/8/5suite veya genelbuild/CI tekrarlanmadı; yeni/etkilenen sözleşmeler hedeflendi. 280ilkSQLbirimi sonrası headerprecondition nedeniyle yalnız6 yeni/değişen birim parse edildi; değişmeyenler byte-eşitlikten devralındı (284nihai birim). Headerprobe sadece kaynakta hazır; targetplainALTER storage policy ölçümü gerçek SQL'de yapılmış gibi gösterilmedi.


### 28 Ekim — exact CI geri bildirimiyle dar düzeltme

**28 Ekim — af56e36c exact CI düzeltmesi, kurulu TEST aynı:** Yeni quality koşusunda6 VM fixture eksik canonical/selectedSale bağından,1 strict input-before-store regresyonundan ve1 statik logger kod sözlüğünden hata alındı. Yalnız ilgili kaynak/fixture bağlantıları düzeltildi:6 VM hedefi,1 fail-target+3 etkilenen canonical service hedefi ve1 logger kapsam hedefi PASS. Guards, redaction, rol, mali hesaplama veya SQL artefacti değişmedi; artefact revision9F232 aynıdır. Secret-scan13 onaylanmamış generic-api-key bulgusu bildirdi; ham Secret/Match gösterilmedi, geçmiş yeniden yazılmadı veya tarama istisnası genişletilmedi. Yeni source CI sonucu ayrıca izlenecek; mevcut başarısız koşu yeşil sayılmaz. B6 gerçek SQL/prova/paket/GUI/insan sonucu açık; kurulu runtime/DDL/ticari/CUA0.

Koordinatörün ilettiği kullanıcı ekran kararları, mevcut B6 ve D2/D1/D3 sırasını bölmeden ilgili ekran işinde [Melisa ERP ekran düzeltme listesi](https://chatgpt.com/space/page_d77f6b1daec8819198e0f3521fd41295) üzerinden okunacak. Bu kaynak turunda yeni UI uygulayıcısı veya ekran değişikliği açılmadı. Alış/mal kabul bağlı-değil metni mevcut 5244 gerçek-veri read-only işlem bağlantısı sınırıdır; yalnız menüyü/allowlist'i açarak çözülmüş sayılmaz.


### 28 Ekim — saf terminal grafı / API native runtime ayrımı

**28 Ekim — c120 exact CI paket sınırı düzeltmesi, kaynak katman ayrımı:** API/site/model testleri geçti; terminal-worktest-package kapalı saf grafı, purecontext içindeki yeni SQL dynamic bağımlılığını doğru biçimde reddetti. Kontrol/kaynak listesi gevşetilmeden aynı3 SQL fonksiyonu API-only canonicalBusinessSaleRuntime'a taşındı; purecontext yalnız readonly metadata, private WeakMap/getter ve protectedstartup'ın bir kez aldığı opaque null-proto bootstrap capability'sini taşır. Token consumption tekkez/currentcontext+profile bağlı; public metadata/getter token veya registry vermez. Gerçek SQLpool/driver/TX hâlâ runtime'ın kendi üretim modülünden gelir, callerfactoryDI yok. 15 runtime/factory hedefi ve başarısız terminal-graph hedefi PASS; bağımsız securityreview GO. SQLrevision9F232 ve284grammar sonucu değişmedi, native/kurulum/GUI/insan kabulü değildir. Gelecek API adayında yeni runtime dosyası zorunlu kaynak parçasıdır; eski normal-session/terminal manifest validator'ı ve kurulu paketler değiştirilmedi. Bu tur kurulu-runtime/SQL/rol/ticari/CUA0.

### 28 Ekim — Windows CI job bütçesi

**28 Ekim — Windows CI süre bütçesi dar düzeltmesi:** Exact90c3c048 PR ve push Windows job annotationları10dakikalık job timeoutunu doğruladı; son business adımına142–159sn kalmıştı. Yalnız windows-startup-test timeout-minutes10→20; aynı test dosyaları/adımlar, seri çalışma, action pinleri, permission/concurrency/offline ve secret-scan korumaları byte-eşit. Kaynak delta kontrolü PASS; hosted yeni sonucun yerine geçmez.13 yanlış pozitif için istisna/kural değişimi0; kurulu READ2b/B6 kurulum durumu, SQL/veri/rol/servis ve insanUA aynı.

PR40739172216/job122995769449 ve push40739161248/job122995730843 doğrudan annotation: job exceeded maximum execution time10m. Bu düzeltme test timeoutlarını/guardlarını kaldırmaz, yalnız toplam hosted Windows iş bütçesini20dakika yapar. Eski cancelled sonuç PASS değildir; yeni exact-head sonucu ayrıca kaydedilecektir. Manuelrerun0.

### 28 Ekim — doğrulanan CI ve 13 bulgu için kesin kapsamlı karar önerisi

**28 Ekim — exact8a1ea1f0 hosted CI sonucu doğrulandı:** PR40743549260 ve push40743537952 Windows-startup-test SUCCESS (11dk17sn /11dk28sn), quality-build-test SUCCESS;20dk toplam bütçe önceki10dk engelini giderdi. Secret-scan aynı13 incelenmiş false-positive nedeniyle FAILURE; overallPASS yok. Exact13 fingerprint için dar karar önerisi mevcut kanıtta hazır, ONAYLANMADI/UYGULANMADI; ignore/kural/history/kurulum/SQL/veri/rol/servis değişikliği0. B6 yalnız kaynak hazırlığıdır; READ2b kurulumundan ayrı, native prova/normal satış/insanUA açık.

- [PR exact-head run](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/40743549260): Windows/quality SUCCESS, secret FAILURE.
- [Push exact-head run](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/40743537952): Windows/quality SUCCESS, secret FAILURE.
- PR maskeli tarama çıktısı13 onaylanmamış bulguyu doğrular. Ayrı read-only kaynak incelemesi ve bağımsız reviewer13/13 yanlış pozitifi kanıtladı;9manifest hash,2operasyon metni,1sentetik kur referansı,1PowerShell fonksiyon adı. Değerler burada yayımlanmaz.

**Seçenek A — önerilen, ayrı kesin onay gerektirir:** yalnız aşağıdaki13 tarihsel fingerprint mevcut `.gitleaksignore` dosyasına eklenebilir. Commit+dosya+kural+satır exact kapsam; yeni commit/bulguya yayılmaz. Gitleaks sürümü/checksumu, tüm geçmiş taraması, redaction, kurallar, CI required-check sonucu, path kapsamı ve mevcut ret sınırları aynı kalır. Önceki3 bulgu onayı bunlara uygulanamaz.

**Seçenek B — istisnasız bekle:** korumaları ve mevcut13 bulgulu FAIL sonucunu olduğu gibi koru; bu engeli aşılmış/yeşil sayma. Mevcut yetkili bağımsız source işlerini sürdürmek kurulum izni veya tüm CI PASS değildir.

**Uygulanabilir çözüm olmayan yollar:** HEAD metnini yeniden adlandırmak geçmiş bulguları silmez. Git geçmişini yeniden yazma/forcepush, yalnız HEAD tarama, kural/path allowlist, scanı kapatma veya hatayı yoksayma bu görev kapsamında uygulanmaz. Doğrulanmış gerçek secret bulunmadığından credential reset/rotation gerektiren kanıt yoktur; yeni belirsiz bulgu olursa ayrıca incelenir.

**ÖNERİLEN KARAR METNİ — kullanıcı henüz onaylamadı:**

> PR54 source8a1ea1f0 incelemesindeki aşağıdaki13 kesin tarihsel `generic-api-key` fingerprintinin, doğrulanmış yanlış pozitif olarak yalnız `.gitleaksignore` dosyasına eklenmesini onaylıyorum. Bu onay genel dosya/kural/gelecek bulgu istisnası, geçmiş yeniden yazma, CI koruması kapatma, kurulum/SQL/veri/rol/ticari işlem veya B6 insan kabulü yetkisi değildir. Mevcut tam geçmiş/maskeleme/sabit scanner korumaları aynı kalacak; değişiklik sonrası gerçek exact-head CI sonucu ayrıca doğrulanacaktır.

```text
af56e36ca89bca988dc7f521125b7a9263310811:apps/api/src/services/canonicalBusinessSaleModel.test.mjs:generic-api-key:24
d303218681fe212155b6a91f8fb62b1274721842:STATUS.md:generic-api-key:1
f0568be74d8e2d35c4adefef92b6c60c67cfb6ec:docs/evidence/erp/2026-10-08-current-party-completion/green5244-realdata-compat-prep-20261027.md:generic-api-key:364
b990f65b63e341657495e6030e7bcf36307ac859:scripts/canonical/start-business-5244-web.ps1:generic-api-key:15
8904f7a2f991da91d0290986896c33f10aa0f23a:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
e577646ed0f160149556e19c2bc5fd27ea9ab058:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
a38f08d74ae533db6d89a71908435255c78e0899:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
71bf21089874677bf4062c1a31de0b14aa0e8d84:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
491edafe4852625c7fdb851329bce6e6d34e5a8c:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
9177143cfc252924c015518f7bac151f51aa0a8f:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
76106c22e816175c51306dfac1e4d7dd1a45dc93:scripts/canonical/start-business-5244-web.ps1:generic-api-key:5
8a060591b38ad484db60c98f0ea61423809d2cd1:scripts/canonical/prepare-green5244-realdata-compat.mjs:generic-api-key:9
0a22177889268a00772ea25aa0b2a9f1578e4d64:scripts/canonical/test125-bound-api-quiescence.test.mjs:generic-api-key:34
```

Bu tur yalnız karar hazırlığı/dokümantasyon: hiçbir fingerprint eklenmedi; scanner/workflow değişmedi. B6 kaynak/gerçek SQL/prova/kurulum/normal yazan ekran/insan kabulü ayrı ve tamamlanmamıştır.

### 28 Ekim — exact13 kullanıcı onayı uygulama sonucu

**28 Ekim — kullanıcı onaylı exact13 tarama istisnası uygulandı:** Koordinatörün özgün kullanıcı onayı saltokunur doğrulandı; yalnız incelenmiş13 tarihsel commit/dosya/kural/satır `.gitleaksignore` girdisi eklendi, eski içerik aynı ve bağımsızreviewGO. Sabit8.30.1/checksum doğrulandı. Dalın3301c480 tümataları taraması0bulgu/exit0; aynı yerel depodaki tümref taraması iki ayrı ajancheckpoint geçmişinde54 ekbulgu/exit1 verdi, bunların0ıHEADatalarında. Bu54 incelenmedi/istisna yapılmadı; tümref sonucu yeşil değildir. CIscanner/rule/workflow/maskeleme/history aynı; gerçek hosted yenihead sonucu ayrıca kaydedilir. KuruluREAD2b/SQL/veri/rol/servis/CRM değişimi0; B6kurulum/normal satış/insanUA açık.

Önceki karar önerisi tarihsel kayıttır; kullanıcı artık yalnız o13exact girdiyi açıkça onaylamıştır. Liste özel kanıt kümesiyle13/13 aynı, unique13, wildcard0, eski girdiler aynıprefix; scanner/rule/path/futurebulgu kapsamı değişmez. Yerel tümref taraması currentbranch ile eşit sayılmadı;54 ek bulgu iki refs/agents checkpoint commitindedir, çözülmüş veya false-positive ilan edilmedi ve bu görev kapsamına alınmadı. Ref/geçmiş silme veya yeniden yazma yok. Tam fetched-history tarayan hosted CI scripti değiştirilmedi.

### 28 Ekim — B6 kaynak kapsülü ve kontrollü uygulama sınırı

**28 Ekim — B6 kontrollü uygulama hazırlığı / kurulum yok:** Exact0981b4a7 PR+push güvenlik/kalite/Windows SUCCESS doğrulandı. Mevcut private alanda0981source kapsülü1867dosya,8zorunluAPI dosyası ve4SQL/profileartefacthash bağımsız doğrulandı;4API/webdependencyJSON aynı. Gitblob/Windowsarchive satırsonu farkı ayrıhashlerle kaydedildi; eski runtime dosyası kayıt hashinin90c kaynak ayrımından önce kaldığı görünür, önceki kanıt değiştirilmedi. Bu bir runnablepaket/kurulum değildir: installable=false/executeAllowed=false. Normal5244 yalnızreadsepetfallback kullandığı için B6API tekbaşına satışkaydetmeyi açmaz; mevcutnormalekranın darcanonical freshcontext/preview SOURCE bağlantısı ilerletiliyor, draft/finalize/cancel transport kapalı. ExactTEST SQL25mevcut/31yeni modül/7tablo1indeks/30izin, yalnız4144+5244geçişi ve2draft/1finalize/1saleinverse/1draftcancel için ayrı private karar taslağı hazır, ONAYBEKLİYOR. KuruluREAD2b/SQL/ticari/rol/diğerservis/CUA0; insanUAaynı.

Kapsül aynı mevcut private kanıt alanında b6-handoff-source-0981b4a7 dizinidir; gerçek runtime dependency kurulumunu içermez. application-source.zip sha/1867fileentry ve8zorunlu dosyanın gerçekarchivebytes+Gitnormalized karşılaştırması geçti;4SQL/profile bytekopyası eş. Eski8mandatory kaydından yalnız yeniAPI-only runtime dosyasının worktreehashi stale; canonical-test-env/start-canonical-test Gitblob/Windowsarchive CRLF farkı ayrıca açıklanır, içerik aynı. Mevcut READ2b API/web lockfile/packageJSON4/4eş; npm/SQLbinding çalıştırılmadı, servis/config/yedek değiştirilmedi.

Önerilen uygulama kararı private b6-controlled-application-decision-PROPOSED-20261028.md dosyasında; önceki incelenmiş kapsam eki byte-eşit korundu, yeni tutar/kart seçimi yapılmadı. Karar; freshowner/target/T1false/CAS/backup, SQLnativecompile/header/readerclosure,30izin ve yalnıziki ilgili servis geçişi ile nativeprova etkisini açıklar. Geçmiş commit edilmişse topluDDL inverse/restore yasaktır; özgün journal/satışinverse korunur. Şu an yeniSQL/ticari/kurulum izni verilmiş sayılmaz.

### 28 Ekim — normal ekran native önizleme mock/source seam

**28 Ekim — B6 normal ekran native önizleme SOURCE/MOCK bağı hazır:** Mevcut4frontenddosyasında normal17 oturumu, exacthesap/tarih/quote/adet ve freshcontext→preview DTO doğrulaması tamamlandı;3hedef testdosyasıyla47/47PASS/0skip, bağımsızsource reviewGO. canSave=false; draft/finalize/cancel transport kapalı. Kendi kaynak ağacına standart npmci offline/ignore-scripts76kilitlidependency kuruldu; guard değişmeden Vite7.52s/52dosya derlendi.11CSSin9u byte-eş,2statikCSS yalnızCRLF/LF farklı (normalize içerik11/11eş); ilk katıbyte-CSSassertret kaydı korundu, runtime adayı/kurulumGO değildir. ViteBFF:82 eski genelgate üçpreviewyolunu reddetmeye devam eder; bu teslim gerçek normalekran/nativeSQL doğrulaması değildir. Sıradaki somutSOURCEbağ mevcut normal17 BFFpreviewadmission, sonra mevcutfiş/journal/draft/finalize/cancel bağıdır; SQL/izin/4144+5244kurulum ve nativeprova ayrıonaysız yapılmaz. READ2b/SQL/veri/rol/CRM/servis/CUA0.

FrontendbusinessWorkface/session/basket/readseam sadece kaynakta dar actor17 ve noncommercialpreview contractına bağlıdır; backend/publicDTOya yeniownerhash veya contextunitsource alanı varmış gibi davranmaz. Public revision/account/quote/native4/FX/stock/item-unit karşılaştırması yapılır; opaquepreviewHash yalnızserverresponseformatıdır, writegrant değildir. Context nativehash/source-unit crossbinding ileride writerDTO bağı için ayrı konudur.

Build sınırı açık: ilkprivateharness offlineguard güvenli defaultenvlerinden dolayı başlamadı; sonraki yanlışcwd entryret düzeltildi. Eski runtime dependencyhelperini CIguard reddetti; guard gevşetilmedi. Desteklenen npmci offline ignore-scripts ile yalnız mevcutsourceworktree dependencyleri hazırlandı, lockfile/packageJSON aynı kaldı; aynıguardla actualcompile7.52s tamamlandı. MevcutinstalledCSS2staticbytefarkı newline-only olduğu bağımsız karşılaştırıldı; byteeşiddiası veya publish/install yapılmadı. Handoff/privatebuild kanıtı aynıexistingkanıt alanında, GitHuba hamveri/payload alınmaz.

### 28 Ekim — normal17 BFF önizleme ve hareket-bağlı fiş READ

**28 Ekim — B6 normal hesabın BFFönizleme ve harekettenfiş READ bağı SOURCE tamam:**6production+4test dosyası;64/64hedefPASS/0skip, bağımsızreviewGO/P1P2yok. BFF mevcutBearer ile heristekte sabit4144/auth/me jwt-auth+normal17/rol/izin doğrular; cookiePath=/api/auth aynı, yeniissuer/cache/tokenaktarımı yok. Host/origin önce; yalnız3preview ve darfişdetayı, genericlist/yazma kapalı. Fiş seçiliaccountun freshsales/cancel hareketindeki nativeinvoiceId→aynıcustomer/currency detayıyla bağlanır; draft/unlinked/samecurrency-otheraccount/stale/dispose ret. Supplier/clean/nativelegacy değişmez. Offlineguard aynı6.43s/52dosya build;11CSS önceki kaynakbuildiyle byteeş. Kurulum/SQL/gerçekHTTP/ekran/nativeetki/insanUA0. Sonraki SOURCEbağ nativefiş/journal kanıtıyla draft→finalize→cancel UI bağını tamamlamak; canSave/final/cancel/collect açılmadı. AyrıSQL/izin/API+webdevir/prova onayı hâlâ gerekir; READ2bkuruluaynı.

Backendin publicfiş DTOsunda accountId yoktur; yalnızcustomer+currency filtreli genel listeden hesapbağı varsayılmaz. Yeniokuma; mevcutvalidatedpartyhistory exactaccount sözleşmesini taze okur, sales_invoice/sales_invoice_cancel invoiceId ilişkisinden hareketli kesinleşmiş/iptalfişi açar. BelgenumarasındanIDçıkarımı/draftaccountvarsayımı/genericlistfallback yok. PublicDTOda bulunmayan ownerhash/contextunitsource alanları varmışgibi doğrulanmaz. API SQLnativeproof ve mevcutpermission yetkisi otoritedir; frontendflag yetkivermez.

BFF normalwork-salesisteğinde cookiePathgereği refreshcookie olmadan desteklenenGETauth/me Bearer doğrulamasını kullanır. Refresh/path/issuer/kimlikcache veyaJWTdecode eklenmedi. Readonlyrenderer DTOmutationcaptrue olsa bile kayıt/iptal/tahsilatdüğmesi/handler üretmez. Mevcutmalik/DB/roller/currentREAD2b ve ret sınırları aynı; build yalnızprivateçıktıdır, yeniAPI/webbaşlatıcı kurulmadı ve 5244normalekran doğrulanmadı.

### 28 Ekim — hesap-doğrulamalı fiş ve kapalı lifecycle/journal hazırlığı

**28 Ekim — B6 hesap-doğrulamalı taslak/fiş/journal zinciri SOURCE hazır, yazma kapalı:** Canonicalfişe nativeJOIN+oluşturmajournal doğrulamasından4publicsunumalanı(customerAccountId/partyEntityId/creationRequestId/operationOrigin) eklendi; requestUUID/operation gerçekSQLüreticisinden bağlanır, özelproof/hash sızmaz ve legacyDTO aynı. Mevcuttradejournal key/version/body korunarak opsiyonelcompactinvoiceWitness ve typed draft/finalize/cancel canSend=false planları hazırlandı. NormalUI explicitSonİşlem GETrequestsUUID→sahip olunanpending/op/UUID→freshfiş/account/party/currency/creationUUID+güncelresponseRevision bağını okur; eskieksikwitness UNKNOWN, otoadopt/retry/begin/done/clear0. Source76hedefPASS; P2sonrasıilgili21UI,3APIve40etkilenenlegacyfişcontroller hedefiPASS/0skip. Başkasekmegünlüğüdeğiştirme/silme/readerror P2si fullrecordsnapshot tekrarokumasıyla kapandı; independentreviewGO. Finalofflinebuild6.53s/52dosya/11CSSbyteeş. Activewriterhandler/standalone receiptOnly bağlantısı tamamlanmış değil; mutationtransport/buttonskapalı. Kurulu5244/SQL/rol/ticari/CRM/nativeprova/gerçekGUI/insanUA0. AyrıSQL/izin/kurulum/prova kararı mevcutprivateöneride bekler, buSOURCEteslimi yetki değildir.

Yenipublicwitness yalnızcanonicalSession invoice dalındadır. Producer owner-sql223requestId/operation üretimi→intentproof_json→runtimevalidation/privateWeakMap→creationgetter karşılaştırması doğrulandı; immediatecurrentDraft ve sonraki persistedjournal aynıdraftUUIDye bağlıdır. Eski72manifest/SQLrevizyon/30izin kapsamı değiştirilmedi, yeniSQLderlemesi veya DDL uygulanmadı.

Readonly journalGET orijinalbodyHash/expectedRevisionı döndürmez; UI bunu bağımsıznativebodyeşliği veya writegrant diye sunmaz. Localpendingintent ayrı korunur. Finalize/cancelsonuç revisionı freshGETfişle eşleşir, işlemöncesiexpectedRevisionla eşit olması beklenmez. Reopen eskiinvoice snapshotını kullanır, bugünkükatalogfiyatı/kur/tarih/stocktan yeniden hesaplamaz. Eski/missingwitness pendingaction kayıtları silinmez/değiştirilmez ve otomatikbenimsenmez.

ReadonlySonİşlem yanıtında journalA→B/deleted/readerror race P2si gösterimöncesi tamretainedrecord snapshotını tekrarokuyarak kapandı. UI yalnızokur; storagebegin/done/clear veya yeniUUID üretip tekrar gönderim yok. Typedlifecycle kodunun mevcutnormalUIde aktifPOSThandlerı bilerek yok; sourcecanSendfalse/canSavefalse, kayıt/finalize/cancel/tahsilattransportkapalı. Standalone eskiworkSalesreceiptOnly dalı genericcontextgateretinde kalır; bunlar gerçekyazanUI/kurtarma/insanPASSolarak kapatılmadı.

### 28 Ekim — Kapalı işlem bağlayıcısı ve bağımsız fiş okuması

**28 Ekim — Kapalı satış bağlayıcısı ve bağımsız fiş modu kaynakta hazır:** Mevcut UI callback’leri `prepareCanonicalOperation → typed plan → begin/send` akışına bağlandı. Değişmez `canSend=false` sonucu hem bağlayıcıda hem `begin/send` kapılarında günlük yazımı ve POST öncesinde durdurulur; kullanıcı veya olay verisi yetki veremez. Bağımsız `receiptOnly` ekranı normal hesabın müşteri/döviz hesabı, mevcut journal ve doğrulanmış fiş/geçmiş görünümünü kullanır; ürün yüklemez, genel fiş listesi açmaz. 82 hedef test PASS, 0 skip; bağımsız inceleme GO. Aynı hesapta fiş değişimi, hesap/tarih/journal değişimi, eşzamanlı hazırlık ve dispose sonuçları geçersiz kılar; kapalı işlem mevcut sepeti veya ekranı yıkmaz. Çevrimdışı derleme 6,74 sn, 52 dosya; 11 CSS dosyası önceki kaynak derlemesine byte-eşit. Bunlar kapalı kaynak bağlantısıdır: kayıt/finalize/iptal düğmeleri ve gerçek gönderim hâlâ kapalı, native satış veya insan kabulü değildir. Kurulu 5244, SQL, roller, ticari veriler ve CRM değişmedi. Ayrı kontrollü TEST SQL/izin/kurulum/prova kararı ve doğrulama sonrası kayıt aktivasyonu sınırı korunur.

Kaynakta gerçek parent callback bağlantısı vardır; fakat değişmez kapalı plan nedeniyle journal.begin ve mutation POST çağrısı yapılamaz. Hazırlık için kullanılan UUID kalıcı kayıt değildir; zorlanmış disabled callback testinde günlük yazımı ve POST sayısı sıfırdır. Yeni motor, takip sistemi, yetki/rol veya SQL katmanı eklenmedi. Eski native/legacy begin/send davranışı korunur.

Standalone fiş fallback’i yalnız normal business actor ve exact kapsam reddinde mevcut read widget’ına gider. Yanlış hedef, başka rol veya genel liste için geçiş yoktur. Fiş/döviz hesabı/oluşturma journal kanıtı mevcut public sözleşmeden doğrulanır. Aynı hesap içinde başka fişe geçiş de private history version/identity hook’u üzerinden hazırlığı iptal eder. Handler kapalı olduğunda parent paint çağrısıyla boş context ekranı oluşturulmaz; sepet ve seçim korunur.

Kaynak paketinin kapalı bağları tamamlanmıştır; kurulum, SQL owner/readiness etkisi, replay’in gerçek native sonucu, Windows veya gerçek tarayıcı kabulü bu testlerden çıkarılmaz. Mevcut private karar önerisi SQL kapsamını ve sınırlı provayı açıklar; bu kaynak turu o kararı onaylanmış saymaz.

**29 Ekim — TUR66 normal B6 writer binding SOURCE/OFFLINE:** Existing `prepareCanonicalOperation → begin/send → createTradeJournal` now consumes a separate normal-session-issued opaque capability; the pure request model still returns `canSend:false`. Public flags, event data, serialized/cloned tokens or a claimed actor never create a session admission. Fresh normal actor17/role17, active token/generation, canonical base capabilities, exact account/currency/items/quote/quantity/date and native preview/revision (or owned invoice witness) bind the issued object. Two UI/journal gates precede the one admitted POST. The normal BFF checks current `/auth/me` and exact operation permissions and admits only draft/finalize/cancel DTOs; the generic read gate and all server/native profile, metadata, target and transaction guards remain authoritative.

The existing UUID journal remains pending after timeout, rejection, lost ACK, disposal, account change or a competing tab. No automatic retry/new UUID is generated. Explicit “Son işlemi kontrol et” can finish only that exact retained pending record after genuine native request-journal/account/operation validation. Its original `journalResponse` is persisted separately from the current invoice, which may legitimately have advanced status/revision. Success re-reads the selected customer and products and refreshes history; failed readback cannot repeat or reclassify a confirmed sale. Role, currency, quantity, limits, barcode strings and financial calculations are unchanged.

Changed-behavior groups: session/BFF116PASS, UI63PASS plus affected legacy16PASS, startup6PASS; groups overlap and are not a completion counter. The coupled in-memory test runs the actual normal-session and BFF implementations against a mock public API and existing journal through draft/finalize/cancel. It is not native SQL, GUI or human acceptance. Independent review identified duplicate-array scalar aliasing in PowerShell and trailing-LF aliases in new operation DTOs; strict scalar types, fixed lengths, canonical IDs, full path matching and operation-only LF/CRLF negatives close them. Existing legacy validators remain unchanged. Final independent source review GO. Network-disabled offline build6.79s,52files; all11CSS files equal the prior source build (including the two previously documented publication newline projections). No redesign.

A separate future `CANONICAL-TEST125-BUSINESS5244-B6-WRITER-20261029` startup data contract requires `ADMITTED_B6_WRITER`, `WriterProfileActivation`, exact prior B6 manifest/artifact/descriptor/revision pins and actor17/role17. The current passive package still rejects writes=true. This validator does not issue a native maintenance or HTTP capability and does not activate anything. A compatible new package must obtain a fresh after-state-issued profile-only admission and transition from current Applied B6/false profile. Existing Rehearse/Apply/Inverse must not be replayed; activation rollback must restore current B6/profile bytes while preserving SQL history.

Current installed B6 (owner45104/web33576/API5140, owner source9f9a45bb) and all data/backups/roles remain unchanged. No production API call, real POST, SQL/runtime/config/task write, installation, GUI retry or commercial operation occurred in this source task. GUI URL STOP was not bypassed; normal screen and human acceptance remain pending. The same PR54/common report carries exact source/CI versus installation status. Coordinator counters/board were not edited.

### 29 Ekim — TUR67 Writer profil aktivasyonu hazırlığı
**29 Ekim — TUR67 dar B6 Writer profil devri SOURCE hazır; kurulum henüz yapılmadı:** Kabul edilmiş DEBAFECB native revizyonu yeniden uygulanmaz. Ayrı WriterProfileActivation factory, issuer/thread/ref-bound token, fiziksel API duraklaması, fresh After okuması, görev/profil CAS ve mevcut Applied-B6 çiftine rollback kullanır. Writer yolu DDL/Rehearse/Apply/Inverse çağırmaz. API560c735f/web121020af immutable çifti kaynak1033566d ile pasif üretildi (11989/7341 dosya,14 normal-session closure,52dist); bu kurulum değildir.143 değişen bakım/startup hedefi ve37 quiescence hedefi PASS/0skip; gruplar ayrı. Son installer/producer incelemesi ve yeni exact CI ardından yalnız4144/5244 kurulumu yapılacaktır. Native/5194/5234, veriler/roller ve GUI güvenlik STOP korunur; satış/taslak/finalize/iptal0, insan kabulü BEKLİYOR. [Ortak rapor](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/54#issuecomment-6448803704).

TUR67 CI düzeltmesi: c2cb7d79 kalite/güvenlik başarılı; Windows son adımında yalnız managed-cancel fixture'ı yeni gerçek supervisor dosyasını eski1e6 hash'iyle karşılaştırdı. Test artık c2 üretim baytlarını sabit3cb2ed49 SHA ile doğrular ve kanıtında c2 kaynağını açıkça yazar; eski1e6'yı çalıştırmış gibi sunmaz. Aynı gerçek PS5 pipeline/finally/issuer-thread/preheld-mutex/çocuk-kapanışı kontrolleri değişmedi; yerel1/1 PASS/0skip. Üretim kodu değişmedi, kurulum başlamadı; yeni exact CI beklenir.
