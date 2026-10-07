# Goal8 E02 — bağlı sentetik TEST iş günü

7 Ekim 2026: dokuz native aşama tamamlandı. Normal API, bağımsız allowlist SQL, kayıt bağlantıları ve günlük rapor okumaları `nativeTechnicalPass:true` / `technicalPass:true` sonucunu doğruladı. [Anonim gün kanıtı](day-proof.json) teknik sonucu taşır. İnsan kabulü **ERP-UA24 bekliyor**, `humanAccepted:false`; normal ekran kabulü ayrıca takip edilir.

## Ortam ve kontrollü devam

Hedef yalnız `Semih\MELISADEV` / `MELISA_ERP_SIRKET_TEST_20260929_01`. Ürün325503, tedarikçi13370, müşteri30598 ve kasa20043 aynı sentetik gündedir. Actor15 `isolated_test_sales`, actor16 `isolated_test_ilker`; uygulama SQL login'i sysadmin0 / CONTROL0 / LIVE erişimi0. Rol ve grant kapsamı korunmuştur.

İlk beş aşama — başlangıç, mal kabul, alış, satış, tahsilat — TEST90/source `67c82ab698b6e9771a764c18ca012e6c26f9f4aa`, paket `CANONICAL-TEST-67c82ab698b6` üzerinde yazıldı. Ödeme önizlemesi 80 TRY için mevcut net borç kuralıyla `409 WORK_PAYMENT_DEBT` döndürdü; ödeme yazılmadı. Kabul edilmiş beş aşama ve özgün başlangıç snapshot'ı korundu.

İncelenen checkpoint SHA-256 `dde826a36f05dff80ef2e14a977c115b54e3e650eed0d94a967a384e919fae13`. Devam öncesi eski kayıtlar normal GET, güncel snapshot ve tam native etki hash'i bağımsız SQL ile karşılaştırıldı. Önceki aşamalar yeniden yürütülmedi. Yalnız ödeme, fiziksel sayım, alış iadesi ve raporlar TEST92/source `a4a05b2b3cdbb89fe2423bb14b1452b7a299fa45`, paket `CANONICAL-TEST-a4a05b2b3cdb` üzerinde tamamlandı.

İki runtime aynı açık TEST profiline bağlıdır: `ERP-GOAL8-20261007`, gün UUID `b5f7b5fd-5d45-472d-83c3-b95230e8ea8f`, seal `163DF110EEE5373A925AE4CBD42AEE89164FFFC42E0997430DB65FAC4823DBCA`. İlk yazımların ve devamın kaynak kimlikleri ayrı kaydedildi.

## Gerçek bakiye ve kayıt zinciri

Başlangıç tedarikçi bakiyesi −100 TRY korundu. Alış160 eklenince ödenebilir net borç60 oldu. Runner mevcut API kuralıyla `min(80, pozitif mevcut net borç)` kadar, **60 TRY** ödedi. İade80 sonrasında net tedarikçi bakiyesi −80 TRY kaldı. Yeni alış faturasının kalan borcu20 TRY'dir; fatura bazındaki bu tutar, önceki krediyi içeren net bakiyeden farklıdır.

| Aşama | Bağlı native kayıt | Stok | Tedarikçi TRY | Müşteri TRY | Kasa TRY |
| --- | --- | ---: | ---: | ---: | ---: |
| Başlangıç | özgün checkpoint | 3 | −100 | 100 | 300 |
| Mal kabul, 2 adet | receipt4 / satır7 | 5 | −100 | 100 | 300 |
| Alış160 | fatura25095 / kalem93196 | 5 | 60 | 100 | 300 |
| Satış, 1 adet / 120 | fatura34621 | 4 | 60 | 220 | 300 |
| Tahsilat120 | müşteri hareketi47760 | 4 | 60 | 100 | 420 |
| Ödeme60 | tedarikçi hareketi58087 / alış25095 | 4 | 0 | 100 | 360 |
| Sayım, fark0 | onaylı taslak47 | 4 | 0 | 100 | 360 |
| İade, 1 adet / 80 | taslak48 / native iade225 / alış25095 | 3 | −80 | 100 | 360 |
| Günlük rapor | aynı receipt, fatura ve hareketler | 3 | −80 | 100 | 360 |

Başlangıca göre son farklar: stok **0**, tedarikçi **+20 TRY**, müşteri **0 TRY**, kasa **+60 TRY**. Yedi rapor türü — satış, alış, tahsilat, tedarikçi ödeme, stok, müşteri ve tedarikçi hareketleri — aynı ID'ler ve 7 Ekim TRY filtresiyle okundu. Ödeme60, iade80 ve fatura kalan borcu20 doğrulandı.

Yedi iş aşaması özgün tam gövde ve request UUID ile tekrarlandı: `replayed:true`, ek native etki **0**. Son bağımsız okumada mal kabul, alış, satış, tahsilat, ödeme, sayım ve iade doğrulama bayraklarının tamamı `true`. Taslak47 fark yaratmayan sayımı stok hareketi üretmedi.

## Profil onarımı ve korunmuş kapsam

İlk TEST86 denetimindeki `BLOCKED_PROFILE` kopukluğu açık Goal8 TEST adapter'ıyla kapandı. Varsayılan NIGHT/FINOPS akışları ve mevcut iş writer'ları korundu. Ürün325503 için TRY120 açık **sentetik fixture quote** olarak etiketlendi; gerçek katalog fiyatı değiştirilmedi.

Native JSON'da eksik nullable barkod açık NULL'a çevrildi. Goal8 tuple kontrolü iki NULL barkodu eşit kabul eder; tek NULL, farklı veya sayı biçimindeki barkod reddedilir. Eski NIGHT satış koruma dalı birebir korunur. Kullanılmamış profile uygulanan atomik CAS bir mevcut satış kalemi koruması ve iki Goal8 yardımcı prosedürünü değiştirdi; UUID ve quote/scope kayıtları korundu.

İlk CAS denemesi boş `work_trade_intents` JSON scalar'ının NULL hash üretmesi nedeniyle durdu ve geri alındı. Native SELECT nedeni doğruladı. Düzeltme boş ilişkiyi `[]` olarak hashler; tüm kolonlar, sıralama ve NULL alanlar korunur. Engine kanıtında boş ilişki, NULL alanlı kayıt ve farklı değerler farklı SHA-256 üretir. Başarılı repair SQL SHA-256 `42c247e068391f45407dbf8f3014cfd9f30956a1fe4ca2e1894f9eca825aa7ee`; ScriptDom hatası0.

CAS öncesi/sonrası **22 mevcut + 18 Goal8 module hash'i**, etkin guard'lar, 40 native/eski kapsam tablosunun tam satır parmak izleri, quote/scope alanları, rol üyelikleri, izinler ve trigger sıraları doğrulandı. İncelenmiş sekiz metadata immutability guard'ı tek transaction içinde kapatılıp yeniden açıldı; native kart veya FIRST karantina guard'ı kapatılmadı. CAS sırasında kart, gerçek fiyat, rol ve grant değişikliği yapılmadı. Hatalı girişimler atomik rollback sınırında kaldı.

## CRM bağlantısı ve kabul sınırı

Aynı sentetik müşteri30598 için native CRM taslak10 normal GET ve replay ile doğrulandı. CRM kalemi30740 kabul edilmiş katalogdan USD9.9 taşır; ürün325503 sentetik TRY120 quote'undan ayrıdır. Draft FX1 açık sentetik TEST değeridir. Taslak stok/finans hareketi üretmedi. Konuşma55, çeviri ve katalog/medya okumaları doğrulandı; gerçek mesaj gönderilmedi, assignment veya rol değiştirilmedi.

Private native gün sonucu ve tamamlanan checkpoint kaynak repo dışında tutulur. Public iz [day-proof.json](day-proof.json) içindedir. Enjekte edilmiş testler destekleyici regresyondur; bu native teknik sonuç gerçek TEST uygulaması ve bağımsız readback'e dayanır. Normal ekran kontrolleri ile fiziksel kullanım/insan kabulü ERP-UA24 ayrıca bekler.
