# 200 farklı ürün / iki koli — gerçek native prova — 12 Ekim 2026

## Ölçülen karantina kontrolü / dar v9 kaynak düzeltmesi

Önceki timeout teşhisi artık gerçek aktif istek gözlemiyle ayrıldı: 51 örnekte kilit/bekleme yok; CPU 8,224→59,054 saniye, logical reads 1.593.733→59.815.276. Çalışan statement, `supplier_identity_quarantine_v2_sales_invoice_items` içindeki ürün/fatura hold kontrolüdür. Private safe kanıt `first-profit-dmv-first-profit-v4-1a-v3.safe.json`, SHA256 `ea44a9d09870e6aef745ffad64a0c0378bac6a39ac16694eb0779a4a07292985`. Son denemeden sonra bağımsız native/API kontrolü aynı taslağı ve bütün önceki kayıtları değişmeden doğruladı; kalıcı finalize ve yeni stok/cari etkisi yok (`retarget-controlled-outcome-1791776546437.json`, SHA256 `7dd0e8e4930b6899777cdead8381cc56e4e178a71c696917c465117b920fbb87`).

Dar dönüşüm yalnız dış EXISTS'i ayrı tekil ürün/fatura kimlikleri üzerinden değerlendirir. Inserted/deleted, NULL, bütün iç ürün/fatura kalem hold koşulları, THROW ve kaynak prefix/suffix korunur. Timeout, roller, ticari hesaplama veya karantina kuralları gevşetilmez. Kaynak v9, değişen beş native tanımı ayrı immutable registry ile doğrular; eski 185-modül manifesti ve v6/v7/v8 kayıtları tarihçe olarak değişmeden kalır. Effects tanımı değiştirilmez. Private kaynak tanımı, ticari değerler ve SQL artifact Git'e alınmaz.

Root 13 hedefli dönüşüm/builder kontrolü ve SQL ajanının 50 hedefli entegrasyon kontrolü geçti. Canonical private uygulama artifact'i `822c235cfc785e174f20747ed5564191d09361e47b6b7e4e3638fb043287d601`, revision `A8CE1A7281925E8844B380EEC7F09E1F31D30C47A8BF27CADD186646F933F27B`. Bu aşama **kaynak/offline hazırlık**tır; native Rehearse/rollback, kalıcı metadata uygulaması, yeni paket ve gerçek finalize süresi ayrıca doğrulanacaktır. Çalışan source1a ve mevcut veriler korunur; insan UA32 bekler.

## Çalışan 1a / ilk profit UPDATE gecikmesi

Kimlik düzeltmesi `1a2f4e25cefeaaa65f5ece21aee866d2c0252be7` paketinde etkin: 1834/1834 dosya, manifest `d99fd838a4855ad05c6f47b52aab68dbcb56f9c522949e95dc7361afedbf4069`. API4184/native4186/web5234 exact DB02/copy üzerinde; CRM09ca/native60e değişmedi. Normal15 giriş/refresh/logout, dört health ve dokuz served asset ayrı doğrulandı. Uygulama source, belge teslimi ve APKv22 source farklı kimliklerdir.

Yeni aynı 200 kalemli taslağın kontrollü denemesi kimlik kontrolünü geçti. Native observer ilk profit UPDATE batch'ini (630 karakter, SHA256 `a5c62ae2756b5da2b8748b1eeddc756d07ad416d74ab0c09c12d9fe389ea997a`) **60.018 saniye** sonunda başarısız gördü; ürün stok UPDATE ve stok hareket INSERT fazlarına ulaşılmadı. Sonraki rollback SQL3903 ikincil hatadır. Statement bazındaki ölçüm kilit beklemesi ile guard CPU maliyetini henüz ayırmaz; timeout yükseltme veya guard gevşetme yapılmadı. Bounded private gözlem `controlled-finalize-result-1791774108655.json`, SHA256 `5bc8c6780cd0f7b8fce25a2657dfbedea88599d04f0fc73ff4c761b2f08d8416`; ham SQL, parametre, hata mesajı ve ticari değer yayımlanmadı.

Ardından bağımsız native SQL/API okuması tam sekiz before-image bileşenini, önceki satış ve iki koliyi, aynı 200 kalem DRAFT/revision'ı ve finalize UUID404 sonucunu doğruladı. Yeni taslakta stok0/müşteri0 hareket; kalıcı finalize0. Kanıt `retarget-controlled-outcome-1791774210150.json`, SHA256 `a25c0b75ec10ee005ad8e29e7f9e3d18751c7b4e41c59c69f64bbcc57de18815`. Kontrollü finalize PASS değildir.

1a ortak cohort'un 02:49UTC'de durduğu görüldü. TaskReady/exit1 ve PT0S, fakat failure kaydı eski625: kesin kapanma nedeni kanıtlanmadı. Root, boş exact portlar ve settings/config/manifest/owner pinleriyle **aynı mevcut** başlangıç görevini 02:56UTC'de açtı; yeni supervisor/altı servis ve taze CRM running kaydı doğrulandı. TEST125/LIVE/Vega süreçleri durdurulmadı, SQL veri yazması veya rol/parola değişikliği yapılmadı. İnsan UA32 bekler. Exact1a CI38194712621/38194709143 jobssteps0 hesap ödeme/harcama engeli; yerel test CI yeşili değildir.

Beklenmedik çıkışı teşhis etmek için dar kaynak recorder'ı hazırlandı: yalnız realCLI ve başarılı tam pin doğrulamasından sonra passive `uncaughtExceptionMonitor`/`exit`; yeni PID/UUID bağlı private receipt, kaynak/zaman ve allowlist tür/kod/sayısal exit. PowerShell orijinal LASTEXITCODE'u kayıt öncesi yakalar ve mevcut nonzero throw'u korur. Hata mesajı/stack/sorgu/parametre/sır yayımlanmaz; mevcut failure dosyası ve kayıtlar değiştirilmez. Root5/review5 yeni kontrol ve backend38 toplam kontrol, syntax/parse/diff GO. Retry, eşikler, kapatma, izin ve giriş mantığı aynı. **Yalnız kaynakta hazır; çalışan1a recorder'ı içermez.** Hard kill event üretmeyebilir; bu yama mevcut kapanma nedenini kanıtlamaz.

## Native BIGINT kimliği — gerçek tip kanıtı ve dar kaynak düzeltmesi

Yeni 200 kalemli taslağın kontrollü finalize denemesi native callback içinde durdu; kalıcı finalize çağrısı yapılmadı. Her denemeden sonraki salt okunur kontrol aynı tam before-image, 200 taslak kalemi, sıfır stok/müşteri hareketi, eski satış ve iki koli korunumu sonucunu verdi. Kaynak, kasa/banka ve tedarikçi etkisi değişmedi. Kontrollü finalize henüz PASS değildir.

Mevcut SQL sürücüsüyle CAST uygulanmadan okunan 200 `id` ve 200 `product_id` değeri **string**; şemada ikisi de SQL BIGINT. Miktarlar number, dövizler string. 400 kimliğin tamamı immutable native checkpoint ile birebir eşleşir; mevcut `Number.isSafeInteger` kontrolü bu 400 doğru kimliği reddeder. Salt okunur kanıt SHA256 `a0af598879e316d8e819d83da331363c78131193b5a27ec01e18d13d89dafa56`; private dosya `native-draft-id-types-result-1791770676752.json`. Ham kimlik veya ticari tutar Git'e alınmaz.

Yalnız selectedSOURCE çok satırlı kesinleştirmenin kimlik doğrulaması düzeltilir: pozitif güvenli JS integer veya kanonik pozitif SQL BIGINT string kabul edilir. Kimlikler sayıya çevrilmez, trim edilmez; SQL BIGINT sınırını aşan, başında sıfır bulunan, kesirli, işaretli, bilimsel gösterimli veya hassasiyet kaybetmiş değer reddedilir. Bu kural kaynak stok kodu veya barkodu değiştirmez. Tam kaynak/kalem kimliği, sıra, tekillik, actor, transaction, döviz, miktar, maliyet, kâr ve üç fazın exact satır sayısı kontrolleri korunur. Genel satış ve tek satır yolu değişmez.

Root14 hedefli kontrol ve bağımsız reviewer9 kontrol/source GO: gerçek sürücü biçimindeki 200 string kimlik, güvenli karma biçim, SQL BIGINT sınırı ve 40 bozuk kimlik durumu; duplicate/scope/partial-output/rollback negatifleri dahil. Yeni çalışan paket ve aynı mevcut taslağın native controlled rollback → tek API finalize → bağımsız native geri okuma sonuçları ayrı kaydedilecektir. Hazır kod çalışan uygulama veya insan kabulü değildir; mevcut runtime625, UA32 bekliyor.

ERP-COMPLETE01 / ERP-DEC-044–047, mevcut kontrollü sentetik DB02 kapsamı. Normal dedicated personel15 kullanılır; admin veya yeni izin yoktur. TEST125, kaynak aktarımları, eski belgeler, roller, LL ve holdlar korunur. Kaynaklı işletme kartlarının izole kopyası, güncel Vega veya fiziksel mağaza sayımı değildir.

## Yazma öncesi kanıt

Çalışan kaynak204b63f, API4184/native4186/web5234, exact DB02/copy/low-privilege kimliği doğrulandı. Uygun pozitif stok adayları mevcut native seçili satış okuyucusundan tekrar geçti. TRY200 seçiminin belge toplamı mevcut sınırı aşar; sınır yükseltilmedi. USD200 seçimi mevcut döviz, fiyat kademesi, ADET/1, stok, karantina ve belge tutarı korumalarıyla önizlendi.

Tek immutable private plan: **200 farklı ürün,199 satır×1 +1 satır×24 =223 adet**, iki koli için24=23+1. Plan SHA256 `c82cbbab554047804740798a5092edfa7b2c21a80a09924ab838b4238dc0395b`. UUID/gövdeler,200 ürünün tam before-image'ı, seçilen carinin döviz hesapları/ana kartı, kasa/banka/tedarikçi tabloları, eski request journal ve koli kayıtları private tutulur. Ham isim/kimlik/barkod/tutar veya kaynak dosyalar Git'e alınmaz.

## İlk gerçek deneme ve geri okuma

Bağımsız kaynak review GO alan private helper ile normal API üzerinden aynı planın taslak çağrısı yapıldı. Client90s sınırında sonuç alınamadı; bu anda başarısızlık veya rollback ilan edilmedi. İlk authoritative request okuması `ISOLATED_COPY_BUSY` döndü; işlem sürerken ikinci kayıt açılmadı. Sonraki okuma404/`ISOLATED_COPY_REQUEST_NOT_FOUND` ve bağımsız tam before-image karşılaştırması **aynı** sonucunu verdi. Eski journal/koliler ve seçilmiş ürün/cari/finans/tedarikçi içerikleri değişmeden kalmıştır. İlk çağrının native transaction denemesi yapılmadı veya bütün SQL yazmaları0 diye sunulmaz; ticari commit/ikinci etki kanıtlanmadı.

Normal API logunun static router yolu `/work-sales/drafts` ile okunmasında gerçek503/`WORK_UNAVAILABLE` bulundu. SQL mesajı, sorgu, parametre, stack veya sır çıktıya taşınmadı. Mevcut normalizer'ın200 immutable satırdaki saf, yazmasız karşılaştırması:

| Kontrol | Sonuç |
| --- | ---: |
| Preview adı ile mühürlü kaynak adı birebir aynı |200|
| Native normalizer'ın sondaki boşluğu değiştirerek ürettiği ad |2|
| Değişen stok kodu / maliyet |0 /0|
| Ara toplam / genel toplam / tarihli TRY karşılığı |Üçü aynı|

`normalizeSalesItem` ürün adını trim eder; native fiş okuyucusu adın immutable preview ile tam eşitliğini ister. İki kaynak adının bu dönüşümü mevcut sıkı geri okuma koşulunu kesin olarak ihlal eder. Kaynak ürün kartı/adı değiştirilmez; doğrulanmış selectedSOURCE fiş snapshot'ında tam kaynak adı korunmalıdır. Bu teşhis henüz düzeltilmiş native200 satışın kabulü değildir.

## Liste performansı

Gerçek normal15 HTTP tanığı: native5 fiş listesi11.057s, tek fiş6.381s; packing3 finalized fiş listesi10.196s, aynı fiş7.094s. Normal yeşil tarayıcıda ilk liste okuması hata verdi; Yenile sonrasında fişler geldi ama eski hata yazısı kaldı. Başarılı ve doğrulanmış refresh sonrası eski hata temizlenir; pending journal uyarısı ve bütün kilitler korunur.14 controller kontrolü ve bağımsız review GO; çalışan paket sonucu ayrıca kaydedilir.

Mevcut paketin yazmasız faz ölçümü iki listede10.833/10.608s: outer READY1.49/1.46s, owner context3.32/3.67s, üç selected native context toplam5.33/5.03s. Üç seçimin grupları farklıdır; aynı seçime cache koymak bu mevcut ölçümde kazanım sağlamaz.12s upstream sınırı, SERIALIZABLE, güncel rol/hold/kimlik/fiyat/source proof kaldırılmaz. Performans açığı açık kalır.

### v9 native metadata ve normal writer kontrolü — 12 Ekim 2026

Private V6 kurulumunun gerçek Rehearse işlemi beş modülü doğruladı ve tam before-image'e geri döndü; ardından Apply yalnız bu modüller ile append-only beş satırlı revision kaydını tamamladı. 51 ticari tablo ve 14 geçmiş/registry grubu, roller, şema ve eski etkiler korunur; ticari yazma0. Apply makbuzSHA `73ea21029d78053133e8d6fb81aeb54c4ff9c5164da709b4401bb288dff84830`; revision `A8CE1A7281925E8844B380EEC7F09E1F31D30C47A8BF27CADD186646F933F27B`. Eski native object ID ve izinler aynı; guard kaldırılmadı veya gevşetilmedi.

SSPI operatör READY için geçerli uygulama writer kimliği değildir; mevcut `STAGE4_WRITER_REQUIRED` reddi metadata provasında beklenen sonuç olarak ayrı tutuldu. Ardından paket797'nin normal kısıtlı SQL servis hesabıyla installedProof ve pozitif READY gerçek SQL'de doğrulandı; aynı SERIALIZABLE salt okunur transaction rollback edildi, rol ve ticari yazma0. Bu olumlu servis sonucu operatör denemesinden türetilmedi. Gerçek200 finalize/native sonuç, HTTP süreleri, normal ekran, Android ve insan kabulü ayrı kanıtlardır; henüz bu başlıkla tamamlanmış sayılmaz.

Paket797/1839manifest mevcut logon/Hub görevinden gerçekten açıldı: API4184/native4186/web5234 exact DB02/copy/T1=false, native CRM60e aynı. Önceki40 süreç ve92 port/PID bağı, orijinal makbuzun UTC milisaniye hassasiyeti/çalıştırılabilir yoluyla eşleştirildi; kayıp0. Yeni controlled200 denemesi profit/stok/cari fazlarına gelmeden nested `usp_check_operation_quarantine` yolunda51076 ile durdu; PASS veya stok etkisi sayılmadı. Ardından bağımsız SQL/API full8 before-image, aynı200DRAFT/profitDEFAULT0/stok0/cari0/request404/eski satış-koli ve normal15 logout tekrar doğrulandı.

Gerçek metadata SELECT,79 resolver kaydında yalnız supplier-item native hash'in (`2611E…0914F`) önceki beklenen hash'ten (`601C9…55D26`) ayrıldığını gösterdi; diğer78 aynı. Native iç assertion'ın karşılaştırması185 temel manifestine bakıyor; uygulanmış v9 zincirini henüz projekte etmiyor. İleri companion düzeltmesi bu iç assertion ve onu mühürleyen parent bağımlılıklarını kapsamalıdır; eski registry yeniden yazılmaz, assertion atlanmaz, hold/rol/timeout gevşetilmez. Mevcut native kaynak8 ve40 bağımlılık salt okunur private kanıtta alınmıştır. Satış API commit/replay henüz çalıştırılmadı; başarılı yeni controlled rollback gerekli.

İleri v10 kaynak/derleme: yalnız `usp_assert_operation_quarantine_v2` ve dört parent güncellenir. İç assertion'ın önceki karşılaştırma ifadeleri dışındaki bütün gövdesi korunur; eşleme185→v9→v10 exact copy/name/before bağlantısına dayanır. Current beş native modül/immutable registry/şema kanıtı eski sürüm projeksiyonundan önce gelir.79 resolver kaydı, kendi assertion hash'i, hold/compatibility/aktif intent/rol sınırı korunur; READY iç assertion'dan tekrar çağrılmaz.37 sidecar, check/list ve alış-referansı assertion tüketicisi aynı adlı doğrulamayı kullanır; ek tüketici gövdesi native salt okunur tanımla kontrol edildi, değişmez.

Root77/77 hedefli offline kontrol0skip/0fail; private canonical artifact `7fb590429363276ff18b9879be325d001513682178e3b3eedb17bd79f34d8e35`, revision `FED833C7F36B98ADB2498816180EF9A914D4D4BC45C511A824CF3FC792E19613`.16 compiler dosyasının current SHA eşliği ve sekiz native before-pin doğrulandı. Bu artifact SQL'de uygulanmış değildir; yeni Rehearse/rollback/Apply, normal kısıtlı servis READY, gerçek finalize ve son hız kanıtı ayrıca gerekir. Ham SQL tanımları/ticari bilgiler private alanda kalır.

## Dar kaynak değişikliği ve kapanma ölçütü

Yeni motor, tablo, TYPE veya guard değişikliği yok. Mevcut branded selectedSOURCE invocation ve hesap doğrulamasından sonra exact ürün kimliği/adı kaynakla eşleşirse snapshot adı korunur; genel normalizer aynıdır. Aynı trusted selectedSOURCE dalında çok satırlı kalemler mevcut kolonlara parametreli OPENJSON ile tek INSERT olarak yazılabilir; genel akış seri kalır. Mevcut trigger/intent/UUID/stock/currency/effects guardları bütün satırları denetler.

INSERT SELECT'in ordinal ORDER BY'si identity hesaplama sırasını belirler; fiziksel insertion veya OUTPUT sırası varsayılmaz. Native getter yine ID'ye göre okur. [Microsoft INSERT belgesi](https://learn.microsoft.com/en-us/sql/t-sql/statements/insert-transact-sql?view=sql-server-ver17#limitations-and-restrictions). Bu teknik dayanak gerçek200 satırın SQL/preview sırasını kontrol etmenin yerine geçmez.

Kapanma: controlled rollback/native ID→ürün→quote/fiyat/birim/ad eşitliği; sonra aynı plan/UUID ile normal API draft/finalize;223 stok etkisi ve yalnız seçilen USD cari etkisi; tam diğer alan koruması; iki kolide23+1, READY/kalan0/reload/replay; normal ekran kanıtı. Snapshot/hash eşitliği garanti edilmeden tekrar yazma yok. Yeni runtime, uygulama source ve belge teslim commit'i ayrı kaydedilir.

Private kaynaklar `readonly-candidates` içindeki plan, progress, request/before-image/normalization/timing sonuçlarıdır. Tarihsel yedek referansı mevcut before-image veya yeni inverse provaları yerine geçmez. Eski193 farklı ürünlü fişe sahte link eklenmedi. Önceki ADB politika reddi aşılmadı;200 cihaz ve yeni video **NOT_RUN/NOT_UPDATED**, ERP-UA32 insan kabulü bekliyor.49/9/39/1 aynı. LIVE/Vega/T1/main/CRM/gerçek WhatsApp/ücretli AI işlemi yok.

## Paketli controlled rollback sonucu

2d371c4 paketinin 1830/1830 dosya hash'i doğrulandı. Aynı mevcut transaction ve native engine üzerinde immutable planın 200 satırı gerçekten INSERT edildi; native ID sırası, tam kaynak adı, ürün/quote/fiyat/birim ve 223 adet doğrulandı. Helper journal/commit öncesinde kontrollü hata üretip mevcut rollback yolunu kullandı. Sonrasında tam before-image aynı ve authoritative request404: ticari commit0. Dedicated oturumdan çıkış doğrulandı.

Private helper SHA256 `fd3eac6c6d8861367b141e20b5066b05fbd6e068c7fe19b40e268cdb8818c473`; sonuç proof SHA256 `7250d6167f8ee9935c98c61c45d986f70b27471e6ecd4b3e8101c9ecb2e92bb3`. Bu native SQL/rollback kanıtıdır; normal HTTP finalize, koli, Android veya insan kabulü değildir. Rollback sonrası identity/rowversion sayacının geri alınması iddia edilmez veya zorlanmaz.

Normal commit kontrolünden önce DB02 şemasında products/customers `row_version` alanlarının otomatik timestamp olduğu, party_currency_accounts üzerinde böyle alan olmadığı bağımsız okundu. Commit sonrası raw alan karşılaştırması yalnız doğrulanmış otomatik rowversion, işlem zaman damgası ve izinli stok/bakiye alanlarını ayrı ele alır; manuel değişebilir başka alanları dışlamaz. Seçilen döviz hesabının bütün diğer alanları ve diğer hesaplar tam korunmalıdır.
## Normal API 200 taslak / kesinleştirme gözlemi

2d371c4 izole runtime etkinleştirildi; exact DB02/copy/T1=false,9 served asset, v22 APK ve normal15 login-refresh-logout doğrulandı.40 korunan süreç aynı. Orijinal C82 plan/UUID değişmedi. İlk draft çağrısı90.011s client timeout; işlem günlüğü sonrasında200 native satırlı draft varlığını doğruladı. Aynı UUID/body replay6.472/6.607s, aynı UUID farklı body409/5.022s. İkinci taslak yok. Finalize90.006s client timeout; authoritative503BUSY işlem sürerken görüldü, başarı veya rollback sayılmadı.

Salt okunur DMV/owner-definition eşleşmesi mevcut guard tanımı AAFF70... ve414bayt statement8AC650... üzerinde profil ürünlerini intent ürünlerine süzen correlated JSON_MODIFY/OPENJSON yapısını kesinleştirdi (revision-sql.mjs:141). READY çağrısı değildir. Satır başına profit/product/stock DML bunu tekrar çağırır; üç toplu faz korumaları kaldırmadan tekrar sayısını azaltabilir. DMV CPU/elapsed değerleri tek statement süresi diye sunulmaz. Native write sürerken yeni runtime activation veya yeni UUID/işlem yoktur.
## Selected SOURCE finalize batch — kaynak hazır

Yalnız mevcut branded selectedSOURCE çoklu2..200 finalize dalı: native maliyet/kâr fonksiyonları ve ürün kilitleri aynen çalışır; hesaplanan satırlar typed decimal3/4/6/null ile üç parametreli faza gider. Profit snapshot UPDATE→products stok UPDATE→16kolon stock movement INSERT; her faz OUTPUT COUNT_BIG exactN yoksa failclosed. Header/cari/döviz/audit devamı, generic ve tek satır seri dal aynıdır. Şema/SQLguard/rol değişikliği0. No-op profit atlama yapılmadı; draft kâr alanları boş olduğundan mevcut hesap gerekli.

Root38 hedefli kontrol ve bağımsız yeni5 production-VM test/reviewGO geçti; null/bilinmeyen maliyet, negatif kâr, foreignscope/account/actor/transaction, eksik/bozuk çıktı sayısı ve ikinci/üçüncü DML hatasında rollback/no commit hedeflendi. VM native trigger/decimal/gerçek200 SQL etkisini kanıtlamaz. Yeni paketin dar rollback ve API/performans teslimi bekler.
## Orijinal native commit / terminal okuma sınırı ayrımı

İşlem sona erdikten sonra aynı finalize UUID authoritative200/200satır/finalized doğrulandı. Aynı finalize gövdesi replay6.972/6.998s; ikinci stok/cari etkisi olduğu iddia edilmez, tam native ledger karşılaştırması ayrıca hazırlanır. Koli henüz yazılmadı: normal `/api/work-sales/invoices/{id}` GET200/200satır/15.530s, terminal GET503/WORKTEST_API_UNAVAILABLE/12.022s. Bu veri veya rol hatası olarak genellenmez; terminal okuyucusunun süre sınırıdır.

Ayrı gerçek native faz ölçümü detail200=16.005s (outer READY1.866 +context3.931 +selected native context9.665s); list50=20.606s/6fiş/4unique selectedgroups (selected context14.507s). Snapshot/price/hold/rol doğrulamaları veya12s proxy sınırı kaldırılarak hazır sayılmaz. Yeni dar aynı-transaction okuyucu tüm fresh mutable checks ve signed native/source proof'u korumalı; list/kart normalHTTP ve terminalde gerçek doğrulama bekler. Mevcut5d6fb25 finalize batch1831manifest/root38/reviewGO paketi hazırlanmış ve başlangıç Validate geçmiştir, henüz etkinleştirilmemiştir.
## Bağımsız native sonuç ve dar fiş okuyucusu — 12 Ekim 2026

Orijinal C82 planının final sonucu artık bağımsız SQL ile doğrulandı: 200 native kalem,200 stok hareketi,223 adet ve yalnız seçilen döviz hesabında1 müşteri hareketi. İki request journal/immutable body/effect proof, kaynaklı kartların izinli stok etkisi dışındaki tam alanları, diğer müşteri hesapları, kasa/banka ve tedarikçi tam kayıt hashleri, eski journal ve koli metadata'sı korunmuştur. Kayıp yanıt aynı UUID'den geri okunmuştur; yeni finans etkisi yaratılmamıştır. Native proof helper4936B6... / raw-after EB685D... private tutulur. Koli READY veya ekran kabulü henüz bu sonuçtan türetilmez.

Önceki ADO hash uyuşmazlığı gerçek kayıt değişikliği değildir: iki sürücü aynı ham satırları okur; stdin UTF-8 hash aktarımının offline Türkçe/emoji fixture'ı hatayı doğruladı. Düzeltilmiş bağımsız native kontrol bütün eski koruma kontrollerini sürdürür; hiçbir veri kontrolü kaldırılmadı. Mevcut düşük yetkili TEST okuyucusunda9 gerekli SELECT ve5 prosedür VIEW DEFINITION/definition görünürlüğü gerçek metadata'dan doğrulandı; GRANT/rol değişikliği yok.

Yeni kaynak okuyucu yalnız read-only selectedSOURCE trade fişinde, mevcut fresh owner READY/context/readProof ve gerçek aktör doğrulamasından sonra aynı SERIALIZABLE/Shared transaction'ı kullanır. Güncel müşteri/döviz hesabı, bütün seçilmiş ürünler, fiyat satırlarının tam hashleri, birim, stok, maliyet, barkod, kur ve kaynak kimliği parametreli tek projection'da yeniden okunur. Öncesi/sonrası native kimlik/SPID/transaction ve dört parent/context-v2 definition pinleri failclosed doğrulanır. Kalıcı cache, TTL, timeout artışı, SQL guard/şema/yetki değişikliği yok; preview/writer ve generic yollar aynıdır. Root35 hedefli kontrol ve bağımsız kaynak review GO; yeni gerçek SQL/API/hız/paket kontrolü henüz bekler. Çalışan uygulama2d371c4, hazırlanmış5d6fb25 paketi etkin değildir. GitHub hosted CI hesap ödeme/harcama engeli nedeniyle başlamadı; yerel test CI yeşili veya insan kabulü değildir. UA32 ve49/9/39/1 aynı.
## Çalışan625 paketi / gerçek iki koli — 12 Ekim 2026

Uygulama625969da6252ef14b4f6bde52b054a6ba97feee5 etkin;1833/1833 dosya hash'i, baseline rebuild,9servedasset/v22APK ve normal15 login-refresh-logout doğrulandı. Paket manifestSHA4473047e9bbb315af5e7469c7b21d6bb2933071a28c52ca15614c8380e829350. Exact DB02/copy veT1=false; ilk değişimde41 korunan süreç aynı. CRM09ca/native-order60e değişmedi. Hazırlanıp etkinleşmeyen12tarihli aynı-source paket başlangıç ad doğrulamasında reddedildi; runtime için mevcut11completion ad sözleşmesi kullanıldı, koruma gevşetilmedi.

Gerçek200 fiş GET15.530s→5.975s; packingGET önce12.022s/503, sonra6.053s/200. Fresh ownerREADY/context/SERIALIZABLE Shared ve ürün/cari/fiyat/birim/maliyet/kur/hold/pin kontrolleri devam eder; TTL/cache/12s proxy artışı yok. Normal Personel tarayıcısı listeyi hata metni olmadan açtı;50→100yerel satır sayfalama ve0089başlangıç sıfırı arama doğrulandı.

Orijinal C82 satışının iki mevcut UUID'siyle koli hazırlığı kaydedildi:200çeşit/223ADET,24=23+1. İki ACK5.607/5.615s ve aynıbodyreplay6.394s/200;READY/iki koli/200satır tamam. Önce/sonra tam native ürün/cari/finans/tedarikçi/journal ve özgün200kalem/200stok/1müşteri native satırları aynı; yalnız koli metadata'sı eklendi. Eski koli kayıt/istek hashleri korunur. NativeSQLuser-tableDML0; yeni stok/cari etkisi0. Normal tarayıcı yeniden açılışında223toplanan/kalan0, Koli1'de23 veKoli2'de1 gerçek gözlem/screenshot tamam. Ekran kanıtı private readonly-candidates packing-200-ready-625.png vepacking-200-split-second-625.png; ham görüntü/ürün/tutar Git'e taşınmaz.

Private V1 packing helper'ın sayısal0/+1 sürüm varsayımı READ hazırlığında durdu; POST yapılmadı. Mevcut üretim store sürümü SHA64/CAS'tır. V3 helper gerçek kontratla düzeltildi; bağımsız üretim store/bellek testi ve READY sonrası eskiACKreplay testi geçti. V3mainSHA016417a91e26a1a930e9ea570e23a1ca18b7b9c600f1e4f9f4add399de40cf7c; yeni planSHAc11c3c010a52da838c17afac95175da46c6ddbdfcda3c630c342a70369c5680c. EskiC82/F6/progress dosyaları değiştirilmedi; bu uygulama kodu/yetki düzeltmesi değildir.

## Yeni finalize kaynağının dar kontrolü / gözlemci teşhisi

Orijinal satış2d motoruyla kesinleştiğinden yeni üçfaz finalize'nin gerçek SQL provası ayrı immutable200SOURCE/223adet/aynı20kUSDsınırı planıyla hazırlanır; eski fiş DRAFT'a çevrilmez veya iptal edilmez. Yeni taslak aynıUUIDauthoritative200 ile bulundu;200 nativekimlik/sıra/quote/kod/ad/barkod(193var/7NULL)/miktar/fiyat/cost/döviz ve tam eski alan koruması doğrulandı. Yeni taslak stok0/cari0; journal+1 ve eski200satış/iki koli aynı. Kontrollü finalize rollback/gerçek yeni finalize/hız kabulü henüz yok.

DRAFTkâr alanlarını NULL varsayan private kontrol durdu. Gerçek şema gross_profit_try decimal18,4 vegross_profit_rate decimal18,6 nullable ama literalDEFAULT0;200satırda exact0 görüldü. INSERT12kolon bu iki alanı yazmaz. Önceki NULL varsayımı kabul kanıtı değildir; maliyetler200knownpositive ve değişmeden korunmuştur. Nativeprofit hesaplaması/finalizeupdate atlanmaz veya varsayımla yapılmaz; yeni dar schema/default kontrolü bekler.

Gözlemci bir kez kendi başlattığı altı izole servisi kapatıp yeniden açtı;Hub açık kaldı. Eski failure.json yalnız genericTERMINAL_LOGON_ATTEMPT_FAILED sakladığından hangiprobe'un durduğu kanıtlanamadı; önceki dörthealth200. Bundan veri/rol hatası veya kesin timeout sonucu çıkarılmaz. Kaynakta yalnız allowlist stage/phase/errorType/staticCode ekleyen tanılama hazır:root33test/bağımsız5test GO;4sHTTP/10sprocess/15smonitor/4deneme/60sretry/kimlik/pin/cleanup aynı. Tanılama yeni runtime değildir. Mevcut kaldığıyerden saltokunur native kontrol sürer; yenişema/rol/DDL/yetki/aktifrestore0. CI source625 push38188003602/PR38188006330 jobssteps0, hesap ödeme/harcama engeli gerçekannotation ile teyitli. UA32 ve49/9/39/1 aynı;200Android/videoNOT_RUN/NOT_UPDATED sınırı değişmez.
