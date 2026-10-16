# AI Agent Entry Point

## EN YÜKSEK ÖNCELİK — 16 Ekim 2026 / ERP-DEC-063: Büyük iş akışını tamamla, sonra panel

Kullanıcı **önce ERP/CRM'deki orijinal bitiş gereksinimlerinin büyük dikey akışlarını** ilerletmeyi, yüzde/performans panelini **sonra** geliştirmeyi açıkça seçti. Bağlayıcı kalıcı karar [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) **ERP-DEC-063**; karşı repo **CRM-DEC-021**. Bu öncelik, önceki mini Cloud bug-fix görev seçimini günceller; eski teslimlerin teknik kanıtı korunur.

**İlk iş seçimi:** Mevcut 49/25 bitiş yapraklarından bir özgün kabul ID'si ve teknik parçaları bitirilebilir akış seç. CRM tarafı için öncelikli aday CRM06 müşteri/katalog/ürün/adet/tek talep/saklama/yeniden açma/atanmış ve yanlış personel; ERP tarafı için ERP09 satış/tahsilat/açık hesap **sentetik domain/API kontratı ve GUI** (gerçek SQL ve ticari veri yok). Önce PR13/14 CRM ile PR32/33 ERP ve güncel ana branch kapsam/çakışmalarını kontrol et. Bir akış birkaç güvenli feature PR'ına bölünürse her parça aynı gereksinime ve kabul senaryosuna bağlansın; görev kapanışı için gerçek Cloud uçtan uca smoke sonucu sunulsun. Sadece bir UI satırını düzeltmek, çoğu iş akışını kapatmış sayılmaz.

**Cloud TEST:** Kullanıcının yayımladığı mevcut ERP ve CRM Codex Cloud ortamında **sentetik örnek müşteri, ürün, sipariş ve çevrimdışı/yerel mock servis** ile frontend+API kontratı+negatif durumlar+tarayıcı akışı çalıştırılabilir. Cloud çalışma alanını ortak sürekli TEST sunucusu ilan etme. Uygun kalıcı ortak bulut staging hosting/DB ancak ayrı teknik tasarım ve gerekli erişim/maliyet onayları sonrası kurulur; yeni hosting, genel internet portu, gerçek JWT/credential veya Vega/SQL bağlantısını icat etme. Dot'un task bilgisayarı da kalıcı Windows/Vega/SQL/terminal TEST değildir.

**Yerel TEST ayrı:** ERP'nin tek shared DB02, SQL, Windows servis, watcher, Hub ve kurulum sahibi olma kuralı değişmez. Mevcut `STOP_CAPTURED` / iki watcher durmuş ortamda güvenli sahiplik-kurtarma kanıtı olmadan ikinci stop/restart/kurulum yok. Yerel TEST ve gerçek cihaz kabulünü Cloud sentetik PASS yerine sayma.

**Çalışma:** Dot Cloud uygun iş akışlarını koordine/denetlesin; mevcut Cloud/yerel ana ajanlar çakışmasız kapsamda çalışsın. İş seçimi tek bir rastgele mikro düzeltme değil, **kullanılabilir bütün akış için tanımlı kabul sonucuna yaklaşma** olsun. Gerektiğinde 2-4 bağlantılı küçük PR değerlendirilebilir; her PR exact CI/review ile sunulsun ama tamamlanma sayıları yalnız özgün insan/teknik kapanış şartlarıyla değişsin. Mevcut doğrudan onay/scheduler/yerel-Codex sınırları korunur; GitHub dosya değişikliği görev başlatmaz. LIVE/Vega/gerçek T1/ticari işlem/müşteri mesajı, güvenlik bypass, main merge veya ücretli servis yetkisi verilmedi.


## ÖNCELİKLİ ÇALIŞMA KURALI — 16 Ekim 2026 / ERP-DEC-062

**YENİ KULLANICI KARARI (önceki yalnız-Dot devri kuralını günceller):** Mevcut ERP ana ajanı `AGENTS.md`, `PROJECT_DECISIONS.md`, kendi `*_FINISH_PLAN.md`, `STATUS/CRM_STATUS` ve ilgili feature-PR son kaynak/teslim kayıtlarını okuyarak **kendi iş sırasını seçebilir ve güvenli teknik işleri kendi native Codex zamanlanmış çalışma turu içinde arka arkaya ilerletebilir.** Dot'un her mikro görevi göndermesini veya kullanıcıdan her turda "devam" beklemesini şart koşma. Eski "Dot verir, sen bitince DUR" ifadesi tarihsel tek-görev pilotlarının kuralıdır ve bu devam döngüsünü artık engellemez. Tam sözleşme [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) **ERP-DEC-062** (karşı **CRM-DEC-020**) kararında; 49 ERP + 25 CRM yaprağı korunur.

**Güvenli iç döngü:** Native çalışma turu başladığında aktif/queued çakışmaları, eski kapalı işleri ve mevcut gereksinim/bağımlılıkları kontrol et → bağımsız ve yetkili bir işi seç → gerçek kod + hedefli test + bağımsız review + mevcut feature dalı commit/CI sonuçlarını ayırarak teslim et → çalışma turunda kapasite ve koşullar elveriyorsa **yeni uygun teknik işe geç**. Engellenen işe tekrar tekrar takılma; öteki bağımsız işlere geç. Kaynak teslimi, çalışan TEST kurulumu, normal ekran, fiziksel cihaz ve insan kabulü ayrı durumlar; son insan kabulü orijinal `USER_ACCEPTANCE` üzerinden BEKLİYOR.

**Dot denetler, tek çalışma kapısı değildir:** ERP ve CRM ayrı kaynak/worktree işlerini paralel yapabilir; Dot mevcut 2 saatlik denetimiyle kaynak/test/CI ve bağımlılıkları gözetir. Native ERP+CRM geliştirme zamanlamaları etkinleştiğinde Dot bu rutin işleri ayrı bir gönderimle çift başlatmaz. Ancak gerçekten başarısız native tetikleme, kanıtlı idle ve empty queue veya eşgüdümlü tek-owner işi varsa sınırlı koordinasyon yapar. İki native geliştirme zamanlaması kullanıcı tarafından daha önce duraklatılmıştı; **GitHub kararı onları açmaz**, kullanıcı uygulamada mevcut görevleri **Yeniden etkinleştir** yapmalıdır. Mevcut Dot denetimini veya herhangi bir yeni otomasyonu yeniden yaratma.

**Sahiplik/güvenlik:** Ortak izole TEST DB02/SQL/runtime/config/servis/kurulumda **yalnız ERP ana ajanı yazar**. CRM yalnız kendi kod/UI/paket işini yapar. Son `STOP_CAPTURED` ve durmuş iki watcher için kanıtlı owner-recovery olmadan hiçbir shared stop/restart/kurulum tekrarı yok; diğer offline kaynak işleri sürer. LIVE/gerçek Vega/T1, gerçek ticari kayıt, gerçek müşteri mesajı, ücretli servis, main merge/release, yetki/kimlik aşma ve yıkıcı veri işlemi kullanıcıdan ayrı yetki ister. Proje bitişi ve güvenli TEST kurtarması **Hub gösterge panelinden önceliklidir**. Bunun dışında önceki ERP-DEC-061 güvenli teknik geliştirme izinleri devam eder. Zamanlamanın gerçek çalışması, GUI veya insan kabulü yalnız kanıtla raporlanır.

## Toplu teknik bitiriş ve en sonda insan kabulü — 15 Ekim / ERP-DEC-060

**15 Ekim 2026 kullanıcı kararı — teknik işler önce, insan kabulü sona:** Bu yeni yürütme kararı önceki v3 ana çalışma sözleşmesinin yalnız "CRM06 insan kabulü olmadan başka ana işe teknik olarak geçilmez" ve "kabulü her yaprağın hemen sonunda alma" kısmını açıkça günceller. Tarihsel karar ve kanıtları silmez; tüm 74 bitiş yaprağı (ERP 49 = 9🟢/39🟡/1🔴; CRM 25 = 12🟢/13🟡/0🔴), sabit55/ortak21 ve özgün kabul ölçütleri aynen korunur. Yeni Goal/ana ajan/iş tablosu/ikinci takip sistemi YOK.

**Yürütme:** Mevcut yetkili iki ana Codex ajanı, mevcut alt ajan ve Sanal Personel Testçisi rolleriyle, bağımlılığı hazır bütün kalan teknik gereksinimleri seçer. CRM06 önceliklidir; gereken gerçek kullanıcı/telefon kabulü beklemesi artık başka bağımsız, güvenli teknik geliştirmeyi engellemez. ERP09 dahil bağımsız kod/test/yalıtılmış TEST kurulumları hazırlanır; ardından kalan orijinal sıralardaki yapılabilir teknik işlere geçilir. Önce bağımlılık ve mevcut kanıtı oku, kabul edilmiş iş/testi tekrar etme, aynı şeyi defalarca deneme. Her yeni teknik kanıt mevcut STATUS / ilgili finish planı ve mevcut PR'de tutulur; bir yaprak gerçek insan kabulü gerektiriyorsa bu kabul **BEKLİYOR** kalır ve kapanış sayıları kanıtsız artırılmaz. Teknik olarak hazır çalışma `son toplu kabul için hazır` diye ayrıca ifade edilebilir; bu bir PASS veya yeni tracker değildir.

**Toplu son kullanıcı kabulü:** Geliştirme, resmi API/iş kuralı/normal GUI ve otomatik sanal personel senaryolarıyla erişilebildiği kadarıyla tamamlandıktan sonra, mevcut USER_ACCEPTANCE.md iş ID'lerinden satış personeli, müdür ve muhasebenin kendi yetkili normal hesaplarıyla gerçek telefon/el terminali/uygulama günlük akışı için KISA toplu kabul paketi hazırlanır. Kullanıcı tüm tıklamaları yapmak zorunda değil. Gerçek insan/birim sorumlusu denemeden PASS yazılmaz; ret/hata varsa yalnız ilgili işi yeniden açıp düzelt. Gerçek Windows reboot/logon ile physical device kanıtı API/fixture/browser responsive moduyla eşdeğer değildir. Personel kabulü yeterli işletme güveni olmadan LIVE'a geçiş için kaldırılmaz.

**Somut sınırlama:** CRM CUA'nın korumalı ilk normal login credential aktarımı desteklenmiyor; API login bu açığı kapatmaz. Parola isteme, clipboard/HTTP/process/JWT/cookie/başka ajan/model ile ret dolanma, auth kapatma yok. D01 54 karantina ve belirsiz gerçek stok/maliyet/cari verisi, gerçek fiziksel sayım/kaynak gereksinimleri otomatik uydurulup kapatılmaz; bu kalemler açıkça insan/veri kararı olarak kalır. Böyle bir kapalı bağımlılık başka bağımsız teknik işi durdurmaz.

**Yetki sabit:** Mevcut CRM-DEC-015 / ERP-DEC-057 yalıtılmış TEST yetkisi ve tek-ortak-runtime sahibi ERP. LIVE/Vega/gerçek T1 yazısı, gerçek müşteri mesajı/gönderim, ticari işlem/gerçek belge, main merge/tag/release, veri silme/toplu reset, güvenlik/kimlik bypass ve ücretli API/servis ayrıca açık onay olmadan YASAK. Codex oturumu durursa kayıt kendiliğinden çalıştırmaz; ayrıca kullanıcıyla birlikte doğrulanacak Codex automations gerekebilir, kurulmuş sayma. İnsan kabulü ertelendi diye ana kapsam küçültülmez veya LIVE önkoşulu kaldırılmaz.

**Proje sahibi:** ERP ana ajanı, değişmeyen ERP_FINISH_PLAN.md içindeki 49 kayıt ve ortak21/sabit55 kapsamında bütün henüz tamamlanmamış, bağımlılığı hazır teknik halkaları mevcut alt ajanlarla yürütür: ERP09 satış/açık hesap/performans ve stok-cari tek etki, alış/mal kabul/tahsilat/muhasebe/iadeler, kart/fiyat/döviz, rol/terminal, yedek/ayrı TEST restore, güncel delta hazırlığı ve mutabakat. CRM06 ortak teknik bağımlılıklarını önce karşılar; gerçek LIVE/Vega/T1 yazısı, fiziksel sayım veya işletme onayı gerektiren veri/cutover kararını otomatik tahmin etmez. Ortak DB02/SQL/runtime/config/servis tek sahibidir; CRM UI/normal müşteri akışı CRM sahibindedir.

**Bitiş denetimi:** Teknik hazır, TEST'e gerçekten kuruldu, normal GUI denendi, fiziksel cihaz denendi, gerçek çalışan kabul etti ve LIVE onaylandı durumları birbirinden ayrıdır. Son kabul mümkün değilse özel engeli kanıtla; başka işte ilerle. Her turda özet verilmesi gerekmez, anlamlı sonuç veya insan kararı gerektiren gerçek engelde KULLANICI RAPORU ver. Kalıcı karar [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) ERP-DEC-060, karşı proje CRM-DEC-018.

**Zamanlanmış yürütme — 15 Ekim 2026 kullanıcı talimatı:** Mevcut ERP ana konuşmasına bağlı `erp-2-saatlik-teknik-geli-tirme` otomasyonu native uygulama aracıyla ACTIVE kaydedildi; yeni ana ajan, Goal veya takip sistemi kurulmadı. Europe/Istanbul planı her iki saatte bir 00:25/02:25/.../22:25; CRM'nin 01:25/03:25/.../23:25 fazından bir saat sonra. İlk nominal saat 15 Ekim14:25, uygulamanın kayıtlı ilk tetikleme saati14:23:26'dır; fiilî çalışma kanıtı değildir. İlk doğrulamada last_run_at boş ve çalışma kaydı0: **İLK GERÇEK ZAMANLANMIŞ TUR BEKLİYOR**. Her tur ERP-DEC-060, mevcut STATUS/finish planı ve yetkili alt ajanlarla ilerler; insan kabulü en sona kalır. Ortak TEST'in tek yazarı ERP'dir; önceki ortak işlem sürüyorsa ikinci yazma/restart başlatılmaz, bağımsız güvenli işe devam edilir. Bu otomasyonda LIVE/Vega/gerçek T1/gerçek ticari işlem/gerçek mesaj/ücretli servis/main merge yok. İlk gerçek scheduler turunda tetikleme ve yapılan teknik iş veya somut engel aynı konuşmada kanıtlanır; kayıt/aktiflik veya manuel tur başarı sayılmaz.


**15 Ekim13:16:28 TR otomasyon yürütme kanıtı:** Bu aynı konuşmaya gelen gerçek heartbeat, yerel native dispatch kaydında `automation_heartbeat_run_now` olarak doğrulandı; normal periyodik scheduler çalışması değildir. last_run_at10:16:28.899Z; sıradaki periyodik next_run_at14:23:26TR/nominal14:25TR. Bu turda CRM894 miktar-UI paketi için sonlu profil kodu,6 hedef test, bağımsız inceleme, sourceCI, gerçek izole kurulum ve65dosya/18ref geri okuması tamamlandı. **İlk normal periyodik çalışma BEKLİYOR**; Run-now sonucu zamanlama PASS veya insan kabulü değildir. Native zamanlama/CRM ayarı elle değiştirilmedi; ham log veya sır yayımlanmadı.

## Ana çalışma sözleşmesi — 15 Ekim 2026

**MELISA-WORKING-AGREEMENT-2026-10-15-v3 / ERP-DEC-058.** Kullanıcının [ERP CRM Görüntüleme Sorgusu](https://chatgpt.com/c/6acf870f-84b4-83eb-9449-8add81e3946e) sohbetindeki çalışma düzeni, bu görevde kullanıcı tarafından tam metniyle teyit edilerek ana çalışma sözleşmesi olarak kaydedildi. Kalıcı karar ve kaynak [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) içindedir; karşı proje kaydı CRM-DEC-016. Bu bölüm devam, koordinasyon ve denetim düzeninde önceliklidir. ERP-DEC-057 kapsamındaki izole TEST yetkisi, mevcut işletme kapsamı, özgün kabuller, sabit55/ortak21, sahiplik ve güvenlik sınırları korunur; tarihsel kararlar silinmez. Şirket geneli iş ve güvenlik ilkelerinin kaynağı mevcut [Melisa OS](https://github.com/melihsnyldzz-ui/melisa-os) olarak kalır.

1. Ana ajanlar mevcut bitiş planından hazır ve onaylı işleri seçer, alt ajanlarını açık dosya sahipliğiyle yönetir; kod, hedefli test, izinli TEST kurulumu ve GitHub teslimini yürütür. Çalışma oturumu sürdüğü sürece rutin işler için kullanıcıdan veya ChatGPT denetçisinden yeni görev/`devam` beklenmez. Ortak ortamın tek yazarı ERP, CRM akışının sahibi CRM'dir; iki sohbetin kendiliğinden haberleştiği varsayılmaz, devir mevcut kayıtlar üzerinden doğrulanır.
2. İlk ERP/CRM yanıtlarının planlama sohbetinde birlikte kontrolü başlangıç değerlendirmesidir: görev, yetki ve sahiplik doğru anlaşılmış mı bakılır. Her işte rapor taşıma veya yeniden onay kapısı kurulmaz. İstendiğinde bağımsız denetçi GitHub farkını, gerçek test ve kurulum kanıtını çalışan sonuçla karşılaştırır; yalnız rapor/commit varlığını yeterli saymaz.
3. CRM06 bütün özgün koşulları ve gereken gerçek kullanıcı kabulüyle kapanır. ERP09'un bağımsız hazırlığı ERP-DEC-057 sınırında bu sırada sürebilir; ana kapanış sırası değişmez. Tamamlanan iş mevcut kayıtta kapanır, sıradaki hazır ve onaylı iş aynı bitiş planından başlar. Yeni tracker, plan ağacı, Goal veya sayaç oluşturulmaz; mevcut işletme kapsamı daraltılmaz.
4. Kod/test ve rutin GitHub gönderiminde kullanıcıya görev yüklenmez. Aynı teknik engelde denemeyi tekrarlamak yerine eksik bileşen ve yapılabilir bağımsız iş kaydedilir; gerekiyorsa çözüm/alternatif çalışma için kısa rapor verilir. Gerçek kullanıcı kabulü hazır olduğunda kullanıcı veya ilgili personel kısa normal akışı dener. Canlıya geçişin son kararı kullanıcıdadır; mevcut LIVE/Vega/T1/main/gerçek müşteri/ücretli servis sınırları sürer.
5. Oturum durursa sonsuza kadar kendiliğinden çalışma iddiası yoktur. Yeniden başlatıldığında bu sözleşme ve STATUS.md içindeki etkin `Sıradaki iş` okunarak kayıtlı yerden devam edilir; bütün işler baştan anlatılmaz veya kabul edilmiş işler tekrarlanmaz. ChatGPT mesajlar arasında GitHub'ı otomatik izliyor sayılmaz; bu kayıt otomasyon kurmaz ve açık diğer oturumun talimatı okuduğunu kanıtlamaz.
6. Anlamlı teslim veya gerçek engelde kısa **KULLANICI RAPORU** ver. Bağımsız denetimin sonucu **🟢 Devam etsinler / 🟡 Şu somut engeli çözelim / 🔴 Yanlış yönde ilerliyorlar, düzeltelim** olur. Hedef çalışan ERP ve CRM'yi Melisa Baby personeline teslim etmektir; teknik hazırlık, kaynak teslimi ve gerçek insan kabulü ayrı kalır.

## Sanal Personel Testçisi — 15 Ekim 2026 / ERP-DEC-059

**Mevcut ERP ana ajanı altında test sorumluluğu; yeni ana ajan, Goal, iş planı veya tracker değildir.** Aktif v3 çalışma sözleşmesi (ERP-DEC-058), ERP-DEC-057 geniş yalıtılmış TEST izni, ortak DB02/SQL/runtime tek sahipliği, özgün sabit55/ortak21 kapsamı ve CRM06 önceliği korunur. Karar: [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) ERP-DEC-059.

- **ERP Satış Personeli senaryosu (ERP09'a hazırlık ve yetkili özgün kapsam):** Gerçek normal satış/terminal rolüyle yetkili yalıtılmış TEST'te barkod okutma veya normal arayüz girişi, ürün/adet/fiyat/döviz, sepet, satış/açık hesap-vade ve gerekliyse iade akışını sentetik kayıtla dener. Tek işlemin tek ve doğru stok/cari etkisi, tekrar çalıştırma/iptal ve veri kalıcılığını kontrol eder. Yeni satış/ERP09 ana kapanışına CRM06'nın son gerçek kabulü tamamlanmadan hükmetme; yalnız bağımsız offline/izole sentetik hazırlıkları yap.
- **ERP Muhasebe senaryosu:** Normal yetkili muhasebe hesabıyla sentetik müşterinin açık hesabı, doğru borç/alacak, tahsilat/fatura/ödeme, vade ve izin sınırlarını yalnız mevcut finish planının ilgili parçasında kontrol eder. Zaten kabul edilmiş satış/tahsilat/iade halkalarını sırf tekrar test etmek için açma. Ticari belge ve finansal hareket kesinlikle yalnız yalıtılmış TEST'te sentetik olmalıdır.
- **Gerçek kullanım kanıtı ayrımı:** Mevcut STATUS.md ve USER_ACCEPTANCE.md özgün ID'lerine rol, yalıtılmış DB/ortam kimliği, uygulama commit/kurulum, sentetik başlangıç verisi, normal GUI/terminal adımları, eldeki ekran/cihaz kanıtı, tek etkili stok/cari önce-sonra kontrolü, geri açma/replay sonucu ve eksik insan adımı yazılır. Backend/API/fixture/Windows CI = gerçek personelin ekran kullanımı değildir; ekran/terminal cihaz erişimi yoksa `GUI/CIHAZ DENENMEDİ` denir. Reenactment veya otomatik test çalışan kullanımı PASS sayılmaz.
- **Son çalışan kabulü:** Ancak ajanların güvenle doğrulayamadığı son gerçek telefon/terminal, kullanım hızı ve iş akışı ilgili satış personeline ve muhasebe personeline **kendi yetkili hesabı ve cihazında** 5–10 dakikalık hedefli test olarak hazırlanır. Kullanıcı tüm tıklamaları yapmaz; nihai işletme kararı ve LIVE onayı kullanıcıdadır.
- **Sınırlar:** Yeni TEST parolası/rolü ve DB02/config/store/servis yazısında mevcut ERP owner/geri dönüş kilitleri; CRM rol/UI yazısı CRM sahibinde. Eski kayıt, kabul ve sır korunur. LIVE/Vega/T1 gerçek veri yazısı, gerçek belge/gerçek müşteri mesajı, ücretli servis, main merge, yetki/sandbox/kimlik engeli dolanma veya mevcut hesabı sıfırlama YASAK. Desteklenmeyen CUA/DPAPI credential akışını başka araç/ajan/modelle aşma. Yalnız anlamlı değişim ve somut insan engeli için kısa KULLANICI RAPORU; rutin `devam` bekleme.

## Geniş izole TEST yürütme kararı — 15 Ekim 2026

Etkin ek sözleşme **ERP-DEC-057**: [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md), [ERP23 kaynak6179460000](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6179460000) ve [CRM3 kaynak6179459282](https://github.com/melihsnyldzz-ui/melisa-crm/pull/3#issuecomment-6179459282). Kullanıcının bu oturumdaki doğrudan kararıyla aşağıdaki 14 Ekim hükümlerinin yalnız yürütme/yetki ve ERP09 paralel hazırlık kısımları güncellenmiştir; tarihsel kabul, özgün kapsam, sabit55/ortak21 ve ana sahipler değişmez.

Kimliği ve yalıtımı doğrulanmış DB02/ayrı TEST ve kanonik feature dallarında güvenli geliştirme/refactor, hedefli test, sentetik veri/talep, gerekli TEST hesabı hazırlığı, yetkili kurulum/restart, düzeltme, sınırlı rollback, önce-sonra/yedek kontrolü ve GitHub teslimi için yeniden rutin onay veya `devam` bekleme. Önce hedef kimliği, tek sahip/kilit ve geri dönüş korumasını doğrula; gerçek/değişmez kayıtları, kabul edilmiş örnekleri ve TEST125'i koru. Ortak DB02/runtime/SQL/config/store/servis yazarı yalnız ERP; CRM kendi kaynak/UI/okuma-kabul sahibidir.

CRM06 önceliklidir; desteklenmeyen korumalı ilk GUI girişini tekrar araştırma veya başka kanal/token/clipboard/HTTP/JWT/process/araç/ajan/model ile aşma. Mevcut bağımsız API/iş kuralı eksiklerini tamamla ve kısa son normal personel/mobil kabulünü hazırla. Parolayı/secretı sohbette isteme. Normal ekran/insan kabulü beklerken ERP09 **bağımsız kod/offline/izole sentetik TEST hazırlığına** ortak sistemi bozmadan ve CRM06 bağımlılığını geciktirmeden devam edilebilir; bunu aynı STATUS'ta açıkça yaz. Bu, ERP09 ana kapanışı veya CRM06 kabulünü atlamak değildir. İkinci takip sistemi veya goal açma.

LIVE/Vega/gerçekT1/gerçek ticari kayıt/gerçek müşteri mesajı/ücretli servis/main merge/tag/yayın, toplu reset/restore/silme, auth kaldırma/yetki yükseltme/paylaşılan üretim parola reseti ve ret dolanma yetkisi yok. İnsan ve gerçek cihaz kabulü otomatik testle PASS olmaz. Rutin işlemde değil, anlamlı teslim veya yalnız insanın yapacağı gerçek engelde kısa rapor ver; son çalışan sürüm, eksik teknik hareket/kanıt, bağımsız yapılabilir halka ve tek gereken insan adımını ayır. Oturum durduysa çalışıyormuş gibi anlatma.

## Kalıcı kullanıcı çalışma sözleşmesi — 14 Ekim 2026

Sürüm: **MELISA-WORKING-AGREEMENT-2026-10-14-v1**. Kaynak: kullanıcının 11, 13 ve 14 Ekim doğrudan kararları; son kalıcılaştırma isteği `sesli yönlendirme` sohbetindeki `01a13a1d-61d1-7cc1-8ca1-3c6634b2fa1e` insan mesajıdır. Bu sözleşme aşağıdaki eski belge görevi, Medium varsayılanı ve dedicated TEST istisnası olmayan credential hükümlerini ilgili kapsamda supersede eder. Sistem ve araç güvenliği sınırları korunur; sohbet/özet/model değişimi kararları sıfırlamaz.

1. **Aynı kararı tekrar sorma.** Her devamda bu dosyayı ve mevcut teslim/kaldığı yer kaydını kullan. Kullanıcıdan izinleri, parolayı, kabulü veya iş planını yeniden anlatmasını bekleme. Yeni kullanıcı kararı eski kararla çelişirse yalnız ilgili kuralı güncelle.
2. **Tek ana başlığı çalışan sonuçla kapat.** Sabit 55 ana ID ve ortak 21 sıra korunur. Mevcut tek odak **CRM06 — Katalog ve müşteri ürün talebi**, özgün K01/K02/K03 kapsamıyla. Tam kapanana veya kullanıcı açıkça değiştiren karar verene kadar bağımsız başlığa atlama. ERP06 iletişim kaynağı dalında korunur. Kaynak/test/belge/push/sağlık ara adımdır; çalışan teslim, cihaz veya insan kabulü değildir. Kapsamı daraltıp sayacı yükseltme.
3. **Tekrar yerine eksik halkayı tamamla.** Mevcut kabul ve kanıtı son sürümle eşle; değişmeyen kabulü, fb34/403/readback'i, iki gerçek restore'u veya geçmiş provayı yeniden çalıştırma. Yalnız değişen ya da kanıtsız gerekli davranışı doğrula. Alt kapsam, kalan, sürüm, runtime kanıtı, uzak commit, yerel değişiklik ve insan/dış bağımlılık ayrı tutulur.
4. **TEST erişimini ajan hazırlar.** Kullanıcıdan kullanıcı adı/parola, tekrar giriş veya aynı TEST iznini isteme. Önce geçerli yetkili oturum/korumalı teslim; ardından desteklenen kullanıcı yönetimiyle ajana ayrılmış izole TEST hesabını uygun mevcut normal personel rolüyle hazırlama, gerekirse yalnız bu hesabın parolasını yenileme yetkilidir. Gerekiyorsa böyle ayrılmış TEST hesabını desteklenen yoldan oluşturma yetkilidir. Bir hesap kaydı bulunamadı diye desteklenen ajan hesabı yolunu incelemeden durma. Paylaşılan/gerçek/üretim hesabı reseti, mevcut kimlikte yetki yükseltme, auth kaldırma, kimliksiz LAN admin, statik URL/HTML token veya TEST ADMIN'i normal kullanıcı sayma yok. Geçerli yönetim bağlamı ve desteklenen kurulum yolu gerçekten yoksa denenen yol ile eksik yetki/bileşeni tek somut engel olarak kaydet; parola isteme.
5. **Güvenli oturum normal işin parçasıdır.** Korunan cihaz deposu, yenileme, uygulamayı yeniden açma ve ERP/CRM/terminal geçişinde doğrulanmış kimlik/rol korunur. Çıkış, kullanıcı değiştirme ve iptal çalışır. MFA gibi yalnız insanın yapabildiği gerçekten gerekli adımı hazırlık tamamlandıktan sonra tek somut işlem olarak ayır. Sırları sohbet, kod, GitHub veya düz metin günlüğe taşıma.
6. **Ortak ortamın tek yazarı vardır.** ERP sahibi ortak runtime/native/startup/config/port/kullanıcı-store değişikliği, servis kurtarma, sürüm/veri koruma ve bağımsız readback sahibidir. CRM sahibi normal müşteri/personel/mobil akış, gerekli mevcut rol eşlemesi ve kabul kanıtı sahibidir. Aynı ortak dosya/store üzerinde eşzamanlı yazma veya habersiz restart yapma; bağımlılığı kaydet.
7. **CRM06 bütün özgün koşulları kapsar.** Gerçek katalog/foto/arama/veriye dayalı kategori; mevcut K02 ürün PDF gönderme kabulünün eşlenmesi; ürün/fiyat/döviz doğruluğu; seç–adet–çıkar–yenile–tek kalıcı talep; atanmış personelde aynı kayıt ve yanlış personelde ret; yeniden açılışta korunma/çift kayıt olmaması; son normal mobil ve gereken insan kabulü. Önceki 196 TRY/adet kanıtını başka ürün/dövize genelleme. Talep ERP satış/stok/fiş oluşturmaz. Yeni gerçek müşteri mesajı gönderme. Bağımlı geniş başlıkları tümüyle yeniden yapmak yerine bu akışa düşen özgün davranışı kanıtla.
8. **İşi kaydet ve devam et.** Her tamamlanan iş parçasını kendi mevcut feature dalında commit+push yap, uzak SHA'yı doğrula. Yalnız değişikliğe uygun kontrolleri çalıştır; belge değişikliğinde uygulama/CI/restore bekleme döngüsü açma. Güncel veri korumasını kalıcı durum değişikliklerinde doğrula; GitHub kod kaydı veri yedeği değildir. Yedek kapsamı/tarihi/korumalı konumu/bütünlük-restore kanıtı/ayrı konum kopyası ayrıdır. Ayrı kopya yoksa makine kaybı koruması var deme.
9. **Gerçek engeli somutlaştır.** Yetkili ve güvenli sonraki adım varsa yalnız rapor/push üreterek durma. Çalışan giriş/ekran, davranış, kanıt ve kalan varsa tam nedeni göster. Yetki dışı karar gerekiyorsa mümkün hazırlığı tamamla; tekrar eden genel engel yerine eksik bileşeni belirt. Mevcut Goal/sohbeti koru; model/özet değişimi baştan keşif gerekçesi değildir. Rutin ara başarıları tekrarlama.
10. **Sınırlar korunur.** LIVE/Vega/T1 yazması, main merge, gerçek müşteri mesajı, ücretli servis veya eski sistemi kapatma yetkisi yok. Reddedilmiş özel cihaz200 QA, yerel eğitim HTML ve ayrı deneme EXE işlemini başka araç/adres/komut/kullanıcı/model ile aşma. Geçici Semih düğmesi ve ayrı Windows TEST programı iptal; MELISA HUB ayrı Host uygulaması değildir. İki sahip **gpt-6.1-sol / high** ile devam eder; Astra yalnız somut zor sorun için sınırlıdır, sonra Sol'a dönülür. Yetkili işi tekrar onaya bağlama; bu metin LIVE veya güvenlik sınırı aşma yetkisi vermez.

11. **Sıradaki adım kayıtlıdır ve kendiliğinden yürütülür.** Her yeni/yeniden başlayan turda ve özet sonrası STATUS.md içindeki tek **Sıradaki iş** kaydını oku. Kayıtta seçilen ana ID, güncel adım, sahibi, somut bitiş koşulu, kanıt, bağımlılık/engel ve bitince geçilecek adım bulunur. Bu, sabit55/ortak21/selectedMainClosure'un proje içi çalışma görünümüdür; yeni tracker/sayaç değildir. Adım kapanınca aynı kaydı bir kez güncelle ve sıradaki hazır/yetkili adıma kullanıcı veya denetçi mesajı beklemeden devam et. Engel varsa yalnız aynı CRM06'nın bağımsız gerekli halkasına geç; başka ana başlık üretme. Teknik engel/eksik kurulum ile yalnız insanın verebileceği karar ayrı tutulur. Mevcut zincir: ERP korumalı dedicated TEST issuer/personel hazırlığı → CRM normal müşteri/atanmış personel/son mobil akış → ERP bağımsız kalıcılık/no-sale readback ve CRM tekrar/açılış/kabul eşlemesi → bütün özgün CRM06 şartları kanıtlıysa ana kapanış → ortak21'de sonraki hazır onaylı madde. Eski kabul veya değişmeyen test tekrarlanmaz.

CRM06 özgün tüm şartları ve gereken kabulüyle kapanırsa ortak21 sıra1 **ERP09 — Satış, açık hesap ve kullanılabilir hız** sonraki ana kapanış başlığıdır. ERP sahibi SQL/normal satış/vade/stok-cari tek etki ve hız eksiklerini, CRM gereken müşteri/yetki bağlantısını üstlenir. ERP03/ERP04/ERP06/ERP14'ün yalnız bu akıştaki eksik koşulu çözülür; kabul edilmiş geniş testler tekrarlanmaz. **15 Ekim ERP-DEC-057 istisnası:** CRM06 GUI/insan kabulü beklerken bağımsız ERP09 kod/offline/izole sentetik TEST hazırlığı yapılabilir; ana kapanış/kabul sırası değişmez. Aşağıdaki eski mutlak ERP09 bekleme ifadeleri bu dar istisnayla okunur.

Bu aktif sözleşme genel günlük sıra hükümlerinden önce uygulanır. Teknik kanıt STATUS, insan sonucu USER_ACCEPTANCE, tam kapsam mevcut finish planında kalır; ikinci takip ağacı veya yeni goal oluşturulmaz.

## İş sınırında Melisa kayıt kontrolü — 14 Ekim 2026

Kullanıcının “tamam bunları kuralım lütfen” kararıyla [delivery-checks README](scripts/delivery-checks/README.md) kapsamı etkindir. Ortak scriptin tek sahibi ERP'dir; CRM aynı scripti kendi ayrı config/cache'iyle kullanır. Script kaynağı PR30'daki `b433b00e9bc9ec5e4ad79961b0db52489f77ad01` (ilk paket5003160 ve tarihsel sayaç parser düzeltmesi); çalışan uygulama veya yeni ana teslim değildir.

Sonraki güvenli iş sınırında, yeni/devam eden turda ve özet sonrası önce mevcut **Sıradaki iş** kaydını oku; aşağıdaki yapılandırılmış kayıt kontrolünü **bir kez** çalıştır. Aynı adım kapanınca veya ortam/çalışan paket/rol/ekran önkoşulu değişince yeniden çalıştır; değişmeyen sonucu tekrar bildirme. Mevcut kabul edilmiş kanıtı kullan; yeni giriş, geniş test, restore veya kabul tekrarı açma.

`node C:/Sirket/ERP/melisa-erp-v2/scripts/delivery-checks/run.mjs --config C:/Sirket/ERP/runtime/agent-checks/config.json`

`RECORDS_CONSISTENT` işlevsel tamamlanma değildir. `INCONSISTENCY` yalnız çelişkili kaydı mevcut kanıtla düzeltmeyi; `CHECK_REQUIRED` yalnız ilgili adımın eksik/değişmiş önkoşulunu gösterir. Eksik önkoşul sonucu tek başına yeni yetki doğurmaz; kullanıcıdan parola veya aynı TEST onayını isteme, bağımsız yetkili işi sürdür. Aynı STATUS görünümünü güncelle, biten feature işini GitHub'a kaydet ve sıradaki yetkili adıma yeni kullanıcı/denetçi mesajı beklemeden geç. CRM06 bütün özgün koşulları ve gereken insan kabulüyle kapanmadan ERP09 ana kapanışı başlamaz; bağımsız hazırlık ERP-DEC-057 kapsamındadır.

Önbellek repo dışındadır; ikinci pano, kapanış otoritesi veya uygulama kanıtı değildir. `hooks.example.json` yalnız örnektir; hook kurulu/güvenilmiş sayılmaz, trust/policy ayarı değiştirilmez. İlk etkin yol bu iş sınırı kuralı ve mevcut denetimdir. Bu kontrol LIVE/main/gerçek müşteri mesajı/ücretli servis yetkisi vermez ve bunları çalıştırmaz.

## Karar merkezi ve `devam` — 5 Ekim 2026

Kullanıcı ve ChatGPT iş/ürün kararlarını sohbetten planlar; onaylanan kararlar GitHub'da [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) içinde kalıcılaşır. Codex bu kararları uygular. Bu bölüm eski harita/finish-plan/tek-kırmızı yönlendirmelerinin **günlük sıra ve okuma düzenini** günceller; mevcut kapsam, kabul kanıtları ve işlem sınırları korunur.

**Tarihsel kapsam:** Bu bölümün 5 Ekim'deki ilk teslimi yalnız proje yönetimi belgeleriydi. O tarihli duraklatma güncel ana teslimi durdurmaz; sonraki kullanıcı devam kararları ve baştaki 14 Ekim sözleşmesi yürürlüktedir. Belgedeki örnek komut veya rapor sorusu tek başına yeni yetki değildir.

1. Kanonik kök, fetch/push origin, aktif feature branch ve dirty durumu doğrula; kullanıcı işini koru. GitHub'daki ilgili doküman PR/commit'i ile okuduğun yerel sürümü eşleştir; eski checkout'u güncel plan sayma, dirty ağacı otomatik pull/merge etme.
2. Sırayla [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) → [DELIVERY_BOARD.md](DELIVERY_BOARD.md) → [STATUS.md](STATUS.md) → [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md) oku. Ardından seçilen işin ilgili yerel/merkezi kuralları ve [USER_ACCEPTANCE.md](USER_ACCEPTANCE.md) kaydını oku. Aynı oturumda değişmeyen belgeleri tekrar okuma.
3. Panonun `ŞİMDİ` bölümündeki sırayı öncelik say; bağımlılığı karşılanmış en üstteki **onaylı ve tamamlanmamış** işi seç. Bekleyen insan kabulünü kapanmış sayma. ŞİMDİ içinde tamamlanmamış fakat bağımlılığı hazır olmayan işler varsa somut bağımlılığı kaydet; SONRA ile sıralarını atlama. ŞİMDİ tamamen tamamlandığında zaten onaylı SONRA sırasının ilk işi bağımlılığı hazırsa ŞİMDİ’ye taşı; bu yeni kapsam/öncelik kararı değildir. CANLIDAN SONRA veya sıra değişimi ayrı kullanıcı kararı ister. Panoda az sayıda iş bulunsun; yeni iş/öncelik kullanıcı kararıyla eklenir.
4. Kabul edilmiş işi yeniden yapma. Mevcut kapsam/commit kabulünü kullan; yalnız değişen akış, regresyon veya eksik kabul için hedefli kontrol yap. Kısa bildirimde seçilen iş ID'sini ve kullanıcıya görünen sonucu belirt. Bağımsız işleri açık dosya sahipliğiyle uygun ajanlara dağıt; aynı dosya veya serviste eşzamanlı değişiklik yapma.
5. Seçilen işi gereken kod, hedefli test ve teknik kanıtla tamamla. Teknik sonuç/kanıt ve runtime-kaynak ayrımı yalnız `STATUS.md` içindedir; finish tree'nin ilgili yaprağını güncelle, günlük sıra üretme. Kullanıcının gözle denemesi gerekiyorsa `USER_ACCEPTANCE.md` içine iş ID'si, kısa deneme, ortam/sürüm, kişi/tarih ve `bekliyor / PASS / FAIL` sonucu ekle. Teknik test PASS, kullanıcı PASS değildir.
6. İlgili değişiklikleri dar **branch → commit → push → PR** ile GitHub'a teslim et; uzak PR head ve aynı commit'in mevcut CI sonucunu doğrula. Kullanıcı kabulü beklemek kaynak teslimini durdurmaz. Pano durumunu teknik hazır/kullanıcı kabulü bekliyor/tamam olarak kanıta bağla; status'a karar veya roadmap kopyalama. Somut engelde kalan adımı yaz; onaylı hedef dışında kapsam ekleme.
7. `PROJECT_DECISIONS.md` kararını Codex tek başına değiştiremez. Yeni açık kullanıcı kararı geldiğinde yeni ID ile önceki kararı **supersede** et, gerekçe/tarih/kaynak bağını koru; eski kararın metnini veya geçmişini silme. Çelişkiyi tahminle çözme.

Panodaki iş bir gelecek çalışma talimatıdır; kendi başına runtime/SQL/Vega/gerçek müşteri gönderimi yetkisi değildir. İlgili görev kapsamı ve mevcut TEST/LIVE, gerçek alıcı, credential sınırları sürer. `devam` main merge/tag/release/LIVE deploy yetkisi vermez. GitHub kaynak teslimi deployment değildir.

Dosyaların rolü ve karar kayıt yöntemi [PROJECT_DECISIONS.md](PROJECT_DECISIONS.md) içindedir. [Ortak teslim haritası](MELISA_TESLIM_HARITASI_V1.md) tam teslim bağlamıdır; günlük sırayı pano belirler. Bu belge PR'si main veya diğer açık oturumları kendiliğinden güncellemez.

## GitHub geliştirme ve teslim kuralı — 3 Ekim 2026

- Her geliştirme **branch → commit → push → PR** olarak teslim edilir. Aktif, doğrulanmış geliştirme tabanından devam et; main'e doğrudan yazma, force-push/rebase ile mevcut kayıtları kaybetme.
- Önce [GitHub çalışma düzeni](docs/development/GITHUB_WORKFLOW.md), [sürümleme](docs/development/RELEASES.md) ve [TEST → LIVE / rollback](docs/development/DEPLOY_ROLLBACK.md) belgelerini oku. Kabul edilmemiş mevcut dalları otomatik birleştirme veya kapatma.
- PR'nin tam head commit'i için gerekli CI kontrolleri yeşil olmalıdır. Teknik PASS ve gerçek kullanıcı kabulü ayrı alanlardır; build/unit/secret scan sonucu kullanıcı kabulü sayılmaz.
- Kullanıcının tam PR/commit ve kapsam için kayıtlı kabulü olmadan main merge yok; auto-merge açma. Kabulden sonra değişen kod için etkilenen kontroller/kabul yenilenir.
- İlk ve sonraki sürüm tagleri yalnız kullanıcı tarafından kabul edilmiş, CI kontrolleri geçmiş main commit'inden oluşturulur. Feature dalını tagleme; mevcut görevin kapsamı tag/release/deploy yetkisi değildir.
- Her iş sonunda projenin kanonik STATUS dosyasına tarih, kapsam, teknik sonuç/kanıt, USER_ACCEPTANCE kaydı bağlantısı, branch, commit, PR, TEST/LIVE commitleri ve kalan somut iş yaz. Bilinmeyen bilgiyi `Durum doğrulanmadı` olarak kaydet. Kendi hash'ini içeren commit üretmeye çalışma: teslim commit'ini izleyen status kaydı veya PR head bağlantısı kullan.
- Son raporda branch/commit/PR, CI sonucu, güncellenen status ve kalan kullanıcı kabulünü açıkça belirt. `gh` işlemlerini ajan yürütür; kullanıcıdan komut öğrenmesi veya token paylaşması istenmez.
- CI yalnız GitHub-hosted runner üzerinde offline/sentetik kontrollerdir. Self-hosted runner, LIVE/TEST bağlantısı, gerçek secret, provider/SQL smoke, migration, deployment, gerçek mesaj veya ticari veri testi ekleme.

This repository is the Melisa ERP v2 application repository. It is AI-first, but it is also a live business system. Every AI agent must understand the safety rules before touching code, data, scripts, or documentation.

These instructions apply to Codex, ChatGPT, Claude, and any future AI agent working in this repository.

## Kanonik çalışma kökleri — 3 Ekim 2026

Bu yerel düzen kullanıcı tarafından onaylandı. Mantıksal proje adı Windows yolu değildir. SEMIH üzerinde yeni CRM/ERP geliştirme işleri yalnız aşağıdaki repo köklerinde yürütülür:

- MELISA CRM: `C:\Sirket\CRM\melisa-crm`; origin tam olarak `https://github.com/melihsnyldzz-ui/melisa-crm.git`.
- MELISA ERP: `C:\Sirket\ERP\melisa-erp-v2`; origin tam olarak `https://github.com/melihsnyldzz-ui/melisa-erp-v2.git`.

Git işlemini repo kökünde yap; üst klasörü Git repo sayma. Başlangıçta kök, fetch/push origin, branch ve dirty durumunu doğrula. Aktif feature branch'i kullan; main'e rastgele geçme ve otomatik merge etme. Gerekli feature branch/commit/push/PR bu kaynak düzenleme kapsamındadır. Eski kopyalar yalnız arşiv/kanıttır: değiştirme, taşıma, silme veya snapshot yığınını yeni repoya kopyalama. Mevcut LIVE/TEST runtime, releases, logs, backups ve ticari verilere bu düzenleme işi kapsamında dokunma. Çalışan servis için kaynak repo checkout'u deployment değildir. Sonraki feature/restart/deploy yetkisini kendi görevinin kapsamından doğrula.

Yerel servis ve özel ayarlar kaynak repo dışında kalır. Repo yanında `releases`, `runtime`, `logs`, `backups` dizinleri bulunur; bunlara geçmiş paketler otomatik taşınmaz. Proje config'leri model/ajan varsayılanlarını taşır; host sandbox ve approval politikası korunur.

## CRM / ERP çalışma düzeni — 2026-10-03

Bu bölüm kullanıcının 2026-10-03 tarihli çalışma yetkisini kaydeder. Aşağıdaki eski
kurallar korunur; TEST geliştirme yetkisi, iş sıralaması ve aşağıda belirtilen
salt okunur LIVE inceleme sınırı bakımından bu bölüm geçerlidir. İş kuralları,
credential güvenliği ve LIVE değişikliklerinin onay sınırları sürer.

- Bu proje **ERP**'dir. Kanonik remote: `melihsnyldzz-ui/melisa-erp-v2`.
  CRM ayrı `melihsnyldzz-ui/melisa-crm` reposudur; ERP içindeki eski CRM klasörleri
  yeni CRM çalışmasının hedefi değildir. Diğer projelerde değişiklik yapma.
- Semih PC dahil her bilgisayarda önce `git remote -v`, repo kökü, branch ve
  `git status --short` ile kimliği doğrula. HTTPS/SSH remote aynı kanonik repoya
  çözülmelidir; fetch/push hedefleri farklıysa yazma. Yerel yol, port veya DB
  kimliğini klasör adından, geçmiş rapordan ya da bilgisayar adından varsayma.
- Proje klasörleri, eski çalışmalar ve kullanıcı değişiklikleri korunur. Projects
  alanının ileride yalnız CRM ve ERP olacak şekilde sadeleştirilmesi bu görevin
  silme, taşıma veya arşivleme yetkisi değildir.
- Önce yukarıdaki karar merkezi okuma sırasını izle. Günlük sıra `DELIVERY_BOARD.md`,
  tam kapsam/kabul ağacı `ERP_FINISH_PLAN.md`, teknik kanıt `STATUS.md` içindedir. Ardından aşağıdaki gerekli merkezi/yerel okumaları yap.
  Aynı görevde okunmuş ve değişmemiş belgeleri yeniden okumak gerekmez.
- Çalışan baseline'ı yeniden ispatlayan sprint açma. Mevcut commit, ortam ve kabul
  kapsamıyla uyumlu kanıtı kullan; sadece değişen akış, somut regresyon, hedef
  değişimi veya eksik kabul için ilgili kontrolü çalıştır. Eski kanıt güncel LIVE
  sağlığı değildir; işlem öncesi hedef kimliği kontrolü yine zorunludur.
- Panodan **bağımlılığı hazır en öncelikli onaylı işi** seç; ID, amaç, kabul kriteri, dosya sahipliği ve
  TEST hedefini kaydet. Bağımsız inceleme/backend/frontend işleri alt ajanlara
  böl. Aynı dosyaya eşzamanlı yazma yok; ortak sözleşmeyi önce ana ajan belirler,
  bağımlı işler sırayla ilerler. Plan/status güncellemesi ve entegrasyon ana ajana
  aittir. Alt ajan sonucu otomatik kabul sayılmaz.
- Güncel kullanıcı tercihi **GPT-6.1 Sol / High** (`gpt-6.1-sol`); ana sahipler ve
  bu kapsamda görevlendirilen ajanlar bunu kullanır. Eski Medium varsayılanı
  13–14 Ekim kararıyla superseded'dır. Astra yalnız somut zor sorun için sınırlı
  kullanılır; problem kapanınca Sol'a dönülür. Rutin inceleme/paket/belge için
  otomatik Astra veya model fallback yok; gerçek sınırlamayı raporla.
- `.codex/agents/explorer.toml` salt okunur keşif; `backend.toml` API;
  `frontend.toml` web/terminal; `reviewer.toml` bağımsız salt okunur inceleme;
  `sql-vega.toml` salt okunur SQL/Vega analizi; `release.toml` salt okunur
  sürüm/rollback incelemesidir. Çalışanı yalnız atanmış dosya kapsamına yönlendir.
- İzolasyonu doğrulanmış TEST'te restart/build/test/branch/commit/push için tekrar
  izin isteme. Restart öncesi port → süreç/checkout → API → database/runtime
  eşlemesini doğrula; LIVE veya ortak servisi durdurma. TEST verisi sentetik olmalı.
  Bu yetki LIVE/Vega yazması, gerçek müşteri/ticari kayıt, mesaj gönderimi, veri
  kaybı, paylaşılan/gerçek credential değişikliği ya da riskli backup/restore/reset
  yetkisi değildir. ERP-DEC-047 ve baştaki sözleşme uyarınca desteklenen yoldan
  yalnız ayrılmış izole TEST hesabı hazırlama ve onun parola yenilemesi yetkilidir.
  Bilinmeyen ortam TEST sayılmaz. Bu risklerde hedefi ve işlemi adlandıran açık
  onay, geri dönüş planı ve veri güvenliği gerekir. Salt okunur LIVE inceleme için
  yeniden onay isteme; gereken veriden fazlasını okuma, secret yazdırma.
- Feature branch/worktree kullan; dirty dosyaları devralma, reset/stash ile
  gizleme. İlgili kontroller ve reviewer sonrası dar commit/push yap, mümkünse
  PR aç; main'e otomatik merge veya auto-merge yok. Sandbox/kurumsal izinler
  devralınır; config üzerinden approval ya da credential korumasını kaldırma.
- PASS ancak seçili maddenin gerçek kullanım kabulü, uygun rol/izin, olumsuz
  senaryo ve gerekiyorsa audit/DB/idempotency/cihaz kanıtı tamamlanınca verilir.
  Build, smoke, mock, PR veya commit tek başına PASS değildir. Eksikleri
  PARTIAL/BLOCKED/NOT_VERIFIED olarak ve sonraki somut adımla raporla. Kabulde
  yeni kod gerekiyorsa ilgili testleri yeniden çalıştır; ilgisiz tam baseline yok.

### Tek kelimelik varsayılan — 3 Ekim 2026

- Kullanıcı ana Codex konuşmasında yalnız `devam`, `başla` veya `sıradaki` yazarsa bunu **ERP DELIVERY_BOARD ŞİMDİ listesindeki bağımlılığı hazır en öncelikli onaylı işi tamamla; gereken subagent'ları kullan, TEST'te gereken teknik işlemleri yap ve gerçek kabul hazır olunca dön** talimatı olarak uygula. Uzun komutu yeniden yazmasını veya rutin iş için tekrar onay vermesini isteme.
- Karar merkezi okuma sırasını ve pano seçimini uygula; finish plan tam kapsam, `STATUS.md` teknik kanıttır. Eski `ERP_STATUS.md` yeni durum kaynağı yapılmaz.
- Seçilen işi yukarıdaki çalışma düzeniyle tamamla: gereken explorer/backend/frontend/reviewer/sql-vega/release subagent'larını açık dosya sahipliğiyle görevlendir, sonuçları birleştir ve doğrulanmış TEST'te gerekli kod düzeltmesi, build, kurulum, restart, test, feature branch/commit/push işlemlerini yürüt. Verilmiş TEST yetkisi için yeni gate, bridge veya approval döngüsü oluşturma; eski genel onay metinleri bu kapsamda tekrar izin isteme gerekçesi değildir.
- Çalışan baseline'ı yeniden ispatlama; yalnız değişen akış, somut regresyon veya eksik kabul için hedefli doğrulama yap. Kullanıcı kabulünü `USER_ACCEPTANCE.md` içine, teknik kanıtını status ve ilgili finish yaprağına bağla. Personelin veya kullanıcının fiziksel kontrolü gerekiyorsa teknik hazırlığı tamamlayıp yalnız kalan somut kabul adımını iste; build/smoke/mock sonucunu gerçek kabul veya PASS yerine koyma.
- Yukarıdaki runtime kimliği, TEST/LIVE, Vega/gerçek ticari kayıt, mesaj gönderimi ve credential sınırları sürer. Kısa komut main'e otomatik merge veya LIVE değişiklik yetkisi vermez; açık madde kalmadıysa tamamlanmış işi yeniden başlatmadan mevcut sonucu bildir.

### Semih PC'de kullanım

Yerel checkout'u remote üzerinden doğrula, ilgili setup branch/PR'yi getir ve
bu repo kökünü ERP projesi olarak aç. Dirty/live checkout'ta branch değiştirme;
izole worktree kullan. Codex'in proje config'ini yüklemesi için projeyi kullanıcı
güvenilir olarak seçmelidir; 3 Ekim kök standardizasyonu yalnız bu iki doğrulanmış repo için yerel proje güvenini kaydeder; host sandbox/approval politikası değişmez.
Yeni oturumda `.codex/config.toml` ve agent keşfini kontrol et. Dosyaların GitHub'da
bulunması Semih PC'de etkinleştiğini veya LIVE'ın hazır olduğunu kanıtlamaz.

Kısa komut: **`devam`**, **`başla`** veya **`sıradaki`**. Ana ajan yukarıdaki varsayılanı otomatik uygular.

## Required Reading Order

Before making any change, read in this order:

1. The central Melisa OS knowledge base:
   - Repository: https://github.com/melihsnyldzz-ui/melisa-os
   - Start with the reading order in `melisa-os/README.md`.
2. Local AI instructions:
   - `docs/ai/README.md`
   - `docs/ai/local-agent-rules.md`
   - `docs/ai/safe-change-protocol.md`
   - `docs/ai/melisa-os-integration.md`
3. ERP product and architecture documentation:
   - `docs/erp-v2/README.md`
   - `docs/erp-v2/karar-defteri.md`
   - `docs/erp-v2/implementation-roadmap.md`
   - `docs/erp-v2/stabilization-roadmap.md`
   - `docs/erp-v2/production-readiness-checklist.md`
4. Current repository state:
   - Inspect `git status` before changing anything.
   - Identify dirty, untracked, or user-owned files.

## Non-Negotiable Rules

- Never expose secrets, tokens, passwords, SQL credentials, WhatsApp keys, or `.env.local` contents.
- Never touch production data, live SQL writes, destructive restore/reset, external messages, or LIVE deployment without explicit human approval. Existing dedicated TEST account/setup and scoped TEST runtime authorization is recorded above; do not ask for it again or extend it to shared/production credentials.
- Plan before coding, especially for business logic, database, auth, finance, inventory, import, terminal, or external integration changes.
- Make small, safe commits with a single clear purpose.
- Keep documentation updated whenever behavior, workflow, setup, safety rules, or business operations change.
- Never silently change business rules. If a requested change conflicts with `docs/erp-v2/karar-defteri.md` or Melisa OS, report the conflict and ask for human confirmation.
- Do not mix unrelated changes in one commit.
- Do not include tool-specific local folders such as `.claude/` unless explicitly requested.

## Default Work Style

- Prefer documentation-only planning before risky changes.
- Prefer read-only verification before write operations.
- Prefer local/lab/test data over production data.
- If a task requires production access, stop and ask for explicit approval.
- If uncertain whether an action is risky, treat it as risky.
