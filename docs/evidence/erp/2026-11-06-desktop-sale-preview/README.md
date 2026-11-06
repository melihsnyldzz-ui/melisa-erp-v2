# K05-04: TRY satış önizlemesi

Kaynak, kurulum, normal ekran ve insan kabulü ayrı tutulur. İlk kaynak tesliminde SQL/GUI sonucu henüz yoktur.

- PR54 `normalizeSalesPayload` aynen kullanılır. Bağımsız BigInt hesabı miktar3 × fiyat4, ham ara toplam ve fiş geneli yüzde4 iskonto için native/Tedious decimal4 sonucu ile karşılaştırılır. Uyuşmazlıkta önizleme reddedilir; farklı bir yuvarlama sonucu üretilmez.
- Güncel iki ürün/fiyat/stok ve müşteri seçimi aynı serializable transaction içinden gelir. SERİ, ortak seçim yordamıyla güncel faktörden ADET'e çevrilir; eski liste faktörüne güvenilmez.
- İskonto tavanı istemciden alınmaz. Aynı actor/transaction için doğrulanmış normal oturumun kilitli rolü kullanılır. Yalnız mevcut `desktop_first_sale_operator` %3; diğer roller %0. Admin/manager/owner yetkisi varsayılmaz, grant/rol değişmez. DES-06 müdür %5 ve patron onayı entegrasyonu açık kalır.
- DES-06 maliyet altı uyarısı vardır, maliyet tutarı istemciye gönderilmez. İskontolu yazma kapalıdır. Taslak kaydetmek güncel seçim fingerprinti ve exact iki satır miktar/fiyat eşleşmesini gerektirir; sıfır iskonto dahil eski toplamla kaydetme engellenir.
- Normal önizleme mevcut GET kontratını geriye uyumlu genişletir. Ek/eksik/tekrar query alanları, uydurma rol/tavan, eksik sales.create/finalize reddedilir. Bekleyen yazma kuyruğunun UUID/gövdesi değişmez.

`source-tests.txt`: 16 dosyada 79 test PASS; normal native draft/finalize, oturum lease/logout, exact iskonto sınırı, rol değişimi, seri ve stale önizleme testleri dahil. Vite üretim derlemesi PASS: `desktopWriteGreen-BVpBP4IK.js`, CSS `desktopWriteGreen-D6yoncVT.css`.

Readonly bağımsız inceleme: sıfır iskontoda miktar değiştikten sonra önizlemesiz kaydetme P2 bulundu ve giderildi; ikinci incelemede yeni somut P1/P2 yok. İnceleyen test/SQL/UI/runtime yazısı yürütmedi.

Örnekler: 2 ADET ×12 +1 ADET ×10 =34, %3 =1,02, toplam32,98 TRY. 2 SERİ ×6 ADET ×12 +1×10 =154, %3 =4,62, toplam149,38 TRY. Bu sayılar kaynak testidir; gerçek ekran/SQL doğrulaması sonradan ayrıca kaydedilecektir.

İnsan/personel kabulü BEKLİYOR. K04-03 dövizli satış, günlük şirket kuru entegrasyonu, müdür/patron onayı ve iskontolu kayıt bu teslimle kapanmaz. Eski ERP/ticari veri/yedek/Vega ve merkezi plan/Excel değiştirilmez.

İlk a05baf2c exact GitHub API testinde iki yeni statik kodun güvenli logger listesinde eksik olduğu görüldü. Yalnız DESKTOP_SALE_QUOTE_UNVERIFIED ve DESKTOP_SALE_DISCOUNT_APPROVAL_REQUIRED allowlist'e eklendi; wildcard açılmadı. Logger dâhil16 dosyada79 hedefli test geçti. İlk CI başarısızlığı başarı diye sunulmaz; düzeltilmiş head için CI ayrıca izlenecek.

### K05-04 kurulum ve normal ekran kanıtı — 6 Kasım 2026
Kaynak152a6694309895cfbe74acc6af92f1fdcf7be9e7, PR79, kurulu V4 paket042f9a9870b658f68c586360df47bb0ca21be4efd52eb0aafd50aaef241f49d6. 201 kaynak/5 yardımcı/3 ekran varlığı; önceki206 paketine göre yalnız3 mevcut API kaynağı,2 yeni kaynak ve HTML/JS değişti; yardımcılar, dependency digest, snapshot SQL ve CSS birebir aynı. Yalnız sahipliği doğrulanmış yerel uygulama durdurulup açıldı; SQL PID5240, şema4/36 tablo, kullanıcı/grant ve eski ERP korunur. Son owner16664/worker48784; yalnız127.0.0.1:5294/4294.
Normal erp_deneme oturumuyla13 gerçek HTTP kontrolü: ADET34/%3indirim1.02/toplam32.98, SERİ2→ADET12/154/4.62/149.38, kesirli miktar22.5/0.675/21.825, sıfır iskonto, sınır3.0001 ve rol/tavan iddiası/anonim/yabancı Origin/eksik stok reddi. İlk harness yabancı Origin için route503 bekledi; gerçek dış app guard403 olduğu kaynaktan doğrulandı, yalnız kalan iki kontrol tamamlandı, ilk11 başarı tekrarlanmadı.
Normal yeşil ekranda ADET ve SERİ toplamları, yetki uyarısı, sıfır iskonto sonrası miktar değişince kaydetmenin kapanması doğrulandı; yazma gönderilmedi. Screenshot API'leri görüntü alamadı; native pencere sorgusu Codex'in küçültülmüş olduğunu bildirdi. AX/DOM kanıtı var; görsel screenshot/personel kabulü diye sunulmaz. Bağımsız öncesi/sonrası observer'ın tamamı birebir:33 tablo, bütün kimlik sayaçları, metadata/security ve business hash fe23c8b9aa8797656a40f9dfb8a26ae277ac367229659390ba8ce08a827b539b. 16 dosyada79 hedefli test/build/secret ve readonly review PASS. İlk a05baf2c CI logger kod listesi eksikliğiyle başarısızdı; iki statik kod eklendi,152a6694 quality/secret iki koşuda PASS, Windows sürüyor. Exact son head CI tamamlanması ve insan kabulü BEKLİYOR. İskontolu yazma/müdür5/patron onayı/dövizli satış açık. Kanıt: docs/evidence/erp/2026-11-06-desktop-sale-preview/installed-proof.json.
