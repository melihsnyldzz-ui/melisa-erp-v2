# ERP-C05 / ERP09 — müşteri ve döviz bazında açık hesap görünümü

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
