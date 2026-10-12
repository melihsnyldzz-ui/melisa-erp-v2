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