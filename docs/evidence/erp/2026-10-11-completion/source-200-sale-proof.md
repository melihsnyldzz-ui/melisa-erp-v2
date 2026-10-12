# 200 farklı ürün / iki koli — gerçek native prova — 12 Ekim 2026

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