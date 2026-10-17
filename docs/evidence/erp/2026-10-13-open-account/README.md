# ERP-C05 / ERP09 — müşteri ve döviz bazında açık hesap görünümü

## 17 Ekim — P06.2 seçili SOURCE tahsilat API kapısı

[ERP PR36](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/36) eski PR23'ün feature tabanına squash birleşmesinden sonra ayrı, dar kaynak teslimidir: `52fde73` API kapısı, `69bbfa4` test fixture ayrımı, `3f6cc80` exact geçmiş tarama onarımı. Yeni `selected-source` context/preview/collect/cancel uçları production varsayılan router'da **yok/404**. Yalnız `createBusinessSelectedSaleCollectionPreparation` tarafından üretilen, modül içi WeakSet ile işaretli servis açıkça verildiğinde kaydolur; genel tahsilat servisi, kopyası veya benzeri nesne route kurulmadan503 reddedilir. Mevcut dört tahsilat uçları korunur.

Gerçek Express auth ve permission zinciri, yalıtılmış sentetik işlem journal/store'u ve yanıt/GET ile kısmi5TRY→kalan19TRY, tam19TRY→kalan0, aynı UUID'de ikinci etki0, iptal→kalan19TRY ve iptal replay'i doğrulandı. Yanlış aktör, izin, hesap, döviz, body, revision, fazla tutar ve iptal izni retleri ek finans/stok etkisi oluşturmadı. Ayrı test fixture'ı üretim logger kod envanterine katılmaz. Yerel route+service16/16, logger dâhil32/32 ve mevcut satış route5/5 PASS; bağımsız High inceleme ilk yanlış servis enjeksiyonu bulgusunu kapattı, son GO/açık P0/P1=0. Exact [push CI39031519965](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39031519965) ve [PR CI39031534448](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39031534448) completed SUCCESS.

PR23 squash merge `90d0a33` yeni erişilebilir ref'te önceden incelenmiş sentetik test satırlarını16 yeni fingerprintle görünür kıldı. Bağımsız salt okunur karşılaştırma, `.gitleaksignore` ekinin yalnız bu16 exact commit/path/rule/line parmak izi olduğunu ve genel yol/kural istisnası açmadığını doğruladı; birleşim commit taraması ve PR36 tam tarihçe CI secret scan0. Gerçek credential veya ham müşteri verisi GitHub'a taşınmadı.

**Sınır:** Bu yalnız sentetik kaynak/API kontratıdır. Default production ve kurulu ERPf5/CRM439 paketi değişmedi; native DB02 writer, gerçek SQL/finans/ticari etki, servis restartı, normal GUI, cihaz ve personel kabulü yapılmadı. P06/ERP09-C05 üst kapanışı ve 49/9/39/1 sayımı aynı. Sıradaki ortak P03 için CRM'nin yeni immutable paket makbuzu ve ERP tek-owner kontrollü geçişi ayrı bekler.

13 Ekim 2026. ERP-DEC-053 ana devam kapsamındaki dar okuma/gösterim teslimidir. Yeni satış, tahsilat, iptal, stok/cari/kasa hareketi, migration veya veri temizliği oluşturulmadı.

- Çalışan source: **a771afe29bde27762e88cf7095d4ff830ef25b30**; immutable paket `CANONICAL-COMPLETE-TEST-20261011-a771afe`,1874 dosya. Manifest SHA256: `8c1cafcb691c1ea38ddb0f743f52a4de76249735b1d377a3c0e6fe986e55a397`.
- Web5234 / API4184 / native4186, Semih\MELISADEV / MELISA_ERP_CRM_SHARED_TEST_20261009_02; copye16b70f0-4057-428b-9abc-6bbcaf35fe82, actualT1=false.
- CRM09ca/native sipariş60e kaynakları aynı; CRM sahibinin11staged kaydının diff/hash'leri aynı. Özgün TEST125 aynı source/health ile korundu.

## Dar düzeltme

Müşteri kartındaki geçmiş artık seçilen native müşteri ve TRY/USD/EUR filtresine bağlıdır. İki filtre birlikte zorunlu,COUNT ve sayfa aynı izinli kapsamda daralır; mevcut actor/copy/date/journal/provenance koşulları korunur.25 fişlik ayrı sayfalama vardır; bütün geçmişi yükleyen döngü eklenmedi. Kapsam dışı eşleşme boş döner, yeni okuma veya işlem yetkisi verilmez. Liste bu aktörün mevcut tarihli TEST kapsamıdır; bütün şirket geçmişi iddiası değildir.

Kart seçilince başka müşterinin işlem düğmeleri/geçmişi kaldırılır. Yenile düğmesi müşteri+döviz+geçmiş sayfasını koruyup yeniden doğrular; geç gelen kart/döviz/sayfa yanıtı yeni seçimi değiştiremez. Müşteri adı yalnız exact müşteri kimliği+dövizden gösterilir; eşleşme yoksa doğrulanmadı. Cari hesap bakiyesi ile fiş kalan tutarı ayrı açıklanır.

Açık hesap/kısmi/tam tahsilat etiketi, pozitif finalized toplam ve exact4 tutarlı aktif tahsilat toplamından okunur. Taslak ve iptal ayrı; sıfır kalan iptal fişi 'ödendi' değildir. Gerçek sıfır veya tutarsız veri tamamı tahsil edildi sayılmaz. Mevcut sözleşmede doğrulanmış vade yok: **Vade bilgisi kayıtlı değil**. İşlem tarihi vade veya gecikme tarihi yapılmaz; limit/vade tahmin edilmez.

## Gerçek teknik kanıt

Root126/126 hedefli kontrol, bağımsız kaynak GO, syntax ve immutable build geçti. Commit-diff secret scan0 bulgu;13dosyalık dir taramasındaki3bulgu değişmeyen eski offline fixture kimlikleri, ayrıca incelendi; yeni ignore eklenmedi.

Mevcut iki müşteri/TRY-USD fişleri normal15/16 API'den okundu: tahsilatsız, kısmi ve iptal örnekleri; izin dışı müşteri/döviz boşliste. Önce/sonra tüm karşılaştırılan eski DTO hashleri aynı. Üç native fiş ve mevcut kısmi tahsilatın customer/finance bağlantısı bağımsız SELECT ile aynı; yeni ticariyazma0. Tam tahsilatın yeni DB02 ticari provası yapılmadı; mevcut kabul ve hedefli matematik testi devralınır.

Normal yeşil Chrome ekranında müşteri kartı/geçmiş, açık/kısmi/iptal, USD, başka müşterinin TRY geçmişinin kaldırılması ve Yenile düğmesi kontrol edildi.Seçili TRY müşteri kartında 1440/1024/390 hedefli görünüm kanıtı özel klasörde; ölçülen CSS genişlikleri ve ekran dosyaları browser-proof.json'dadır. Bu TC21 yeni belge veya personel insan kabulü değildir. CSS9 ve startup225 dosyası aynı; API'de yalnız2okuyucu ve2test dosyası değişti.8port/coreguard/health/heartbeat ve v22installer/APK HEAD200 doğru paketle geçti.

Private kanıt: `C:\Sirket\ERP\evidence\ERP-COMPLETE01-20261013\private\c05`. before/after-accounts.json, before-native.json / after-native.json ve before-native-partial.json / after-native-partial.json, browser-proof.json, running-proof.json, root-targeted-tests.txt, kaynak/CI kayıtları ve JPEG ekranlar. Ham isim/tutar/DTO/ekranlar GitHub'a yüklenmez.

## Kalan ve kabul

C05 hâlâ🟡: genel ticari limit/vade işletme kuralı ve kaynağı, seçili kaynak satışların tahsilat yazıcısının mevcut kapalı kapsamı ve personel kabulü açık. canCollect/canCancelCollection=false korundu. ERP-UA32 ve diğer bekleyen kabuller PASS yapılmadı;49/9/39/1 sayımı aynı. Eski TEST53 kanıtı güncel DB02 kaydı sayılmadı ve yeniden çalıştırılmadı. OPS01 birkaçsaniyelik okuyucu maliyeti ayrı açık; bu teslim hız işi değildir.

TEST: [Müşteriler](http://192.168.1.46:5234/ornek-akis.html#customers), [Satış fişleri](http://192.168.1.46:5234/ornek-akis.html#sales-receipts), [Tahsilat](http://192.168.1.46:5234/ornek-akis.html#collections). Yalnız mevcut kayıtları inceleyin; yeni işlem gerekmez.

PR23/branch codex/erp-finish-20261004; appsource yukarıda, teslim dochead PR üzerinde ayrıdır. Source exact6hostedcheck **FAILURE**: hesap ödemesi/harcama limiti yüzünden başlamadı. Yerel126PASS/Vercel sonucu hostedCI yerine geçmez. Son dochead kontrolleri push sonrası ayrıca doğrulanır. Main merge/LIVE/Vega/T1/CRM geliştirmesi/mesaj/ücretliAI yok.

## 17 Ekim — ERP-TEKNIK-23EKIM / P06 tahsilat sonucu ve yenileme ayrımı

Bu kayıt yukarıdaki 13 Ekim uygulama/CI sonucunu değiştirmez. Mevcut Goal'ın ikinci bağımsız kaynak işi, başarılı tahsilat/iptal sonrası takip GET hatasının yerel journal ve ekrandaki kalan tutar üzerindeki etkisidir; genel tahsilat yazıcısı veya native finans yetkisi açılmadı.

Önce gerçek `createWorkCollections` kontrolörü sentetik session/DOM/storage ile çalıştırıldı. Kısmi/tam/iptal/replay × network/403/404/409 yenileme hatası matrisindeki16 yeni kontrol düzeltmeden önce **FAIL** verdi: deterministik GET hataları başarılı POST journal'ını rejected ile eziyor, bağlantı hatası ise eski context/tutar/önizlemeyi bırakıyordu.

`send` artık doğrulanmış POST sonucunu kalıcı journal'a yazar; takip GET ayrı hata alanındadır. Başarı kayıtlıysa sonraki okuma hatası onu reddedilmişe çeviremez. Önceki fiş/önizleme/tutar/liste/finans önbelleği geçersizleşir; eski async cevaplar yeni generation'a yazamaz. Kullanıcıya “İşlem kaydedildi. Güncel fiş bilgileri açılamadı. Yenile ile tekrar görüntüleyin.” denir. Yenile yalnız GET yapar, otomatik yeni tahsilat POST'u göndermez. Mevcut Türkçe yeşil tasarım ve yetkiler korunur.

Cihazda başarı sonucu saklanamazsa işlem eski pending path/body/UUID ile kilitli kalır; başarı varsayılmaz. Kullanıcının “Son işlemi doğrula” seçimi aynı UUID/body ile mevcut replay protokolünü kullanır. Yeni talep kimliği üretilmez. Yanlış fiş dönen GET, geç gelen eski liste/finans cevabı, refresh/dispose davranışı da mevcut guard'larla korunur.

Son yerel kontrol: `node --require ./scripts/ci/offline-guard.cjs --test apps/sites-workflow/src/workflow/workCollectionsCache.test.mjs apps/sites-workflow/src/workflow/workTrade.test.mjs` → **52/52 PASS, 0 skip**; bağımsız reviewer aynı komutla52PASS ve açık P1/P2=0 buldu. Gerçek Sites üretim derlemesi offline guard ve temiz child ortamıyla geçti; syntax/diff kontrolü temiz. Uzak kaynak **51aae110fe11bc297aaba30e294eccc5405a7fa5** / PR23; [PR39027662913](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39027662913) ve [push39027659716](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/39027659716) completed SUCCESS. Kaynak CI’si sonraki belge HEAD’i veya çalışan paket sonucu değildir. Hiçbir test gerçek HTTP/API/SQL veya ticari kayıt kullanmadı.

Çalışan ERPf5/CRM439b/denetleyici2bf0 paketine bu değişiklik henüz kurulmadı; dist derlemesi kurulum değildir. Yeni TEST/DB, servis/restart, stok/cari/kasa/finans/rol yazısı, gerçek mesaj veya LIVE/Vega/main işlemi yok. C05/ERP09 ve özgün insan/GUI kabulü **BEKLİYOR**; kaynak düzeltmesi genel kısmi/tam tahsilat veya işletme kabulü yerine sayılmaz. 49/9/39/1 ve 19/23/26–27/28/30 Ekim hedefleri aynı.
