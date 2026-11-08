# Yerel V7 personel mal sayımı taslağı — K07-01 / C01

Mal sayımı, gelen malların ürün, sayılan miktar, genel not ve satır notlarını birlikte kaydeder. Kullanıcı kaydı listeden tekrar açabilir ve tam sayfa yenilemesinden sonra aynı miktar ve notları okuyabilir. Sayım taslağı stok, maliyet, alış fişi veya cari hareketi oluşturmaz. Mal kabulü gönderme/onaylama ve alış fişine dönüştürme bu kapsamın dışındadır.

Normal kullanıcı için goods.view okuma; goods.view + goods.create kaydetme, güncelleme ve kalıcı sonuç çözümlemesi için birlikte gerekir. Aynı oturum ve aynı SQL transaction içinde yetkiler tekrar doğrulanır. Her kullanıcı yalnız kendi taslaklarını görür. Yeni rol, kullanıcı, SQL GRANT veya tablo eklenmez. Eski work-receiving pilotunun sabit15/16 kullanıcıları ve canonical veritabanı bağlantısı kullanılmaz.

Form1–20satır kabul eder. Miktar mevcut normal mal akışındaki pozitif decimal(18,3) sınırında açık değerdir; boş miktar veya0 kabul edilmez. Eski pilotun1–5 tam adet kısıtı genel şirket kuralı olarak taşınmaz. Genel not ve her satır notu500karaktere kadar saklanır; normal satır sonları korunur. Eksik/fazla/yanlış işareti kullanıcı beyanıdır; beklenen adet uydurulmaz. Tanınmayan barkod ürün kartı oluşturmaz; taslak kontrol gerekli durumunda saklanabilir. Ürün seçimi fiyatsızdır; maliyet veya finans bilgisi açılmaz.

Taslak ve komut kimlikleri UUIDv4, sürüm SHA256'dır. Yeni kayıt kimliği ilk kaydetme isteğinin UUID'sidir; güncelleme ayrı UUID ve güncel expectedRevision taşır. source=desktop-count-v1, entity_type=desktop-count-draft, entity_id=aktör altında immutable audit olayları saklanır. Her kayıt normal aktör, komut gövdesi ve önceki sürüme bağlıdır. Tek kaynak kapsamındaki UUID kilidi, actor ayrımı ve SERIALIZABLE transaction aynı isteğin çoğalmasını ve eski sürümle üzerine yazmayı engeller. Aynı komutun tekrarı özgün sonucu döndürür; güncel taslak ayrı okunur. Eksik/bozuk/çatallanan veya sınırlı okumayı aşan zincir sessizce tamamlanmış sayılmaz.

Yanıt kaybolursa istemci tam komutu aktör kapsamında saklar. Aynı komut tekrar denenir veya özgün gövdeyle sonuç çözülür. Kayıt bulunmazsa kalıcı çözümleme olayı geç gelen aynı komutun yazmasını önler. Kesin kaydedilmedi sonucunda girilen not ve miktarlar korunur. Bekleyen kayıt ekrandan çıkış veya oturum kapatma sırasında silinmez; yetki kaybı tekrar gönderim için aşılmaz. Kaydedilmemiş ve kalıcı komuta alınmamış düzenlemelerden ayrılma ayrıca engellenir.

HTTP yüzeyi yalnız yerel V7 normal oturumunda açılır:

- GET /api/desktop-count/products?page=1&search=... — fiyat içermeyen aktif yerel ürünler.
- GET /api/desktop-count/drafts?page=1 — mevcut aktörün taslakları.
- GET /api/desktop-count/drafts/:draftId — mevcut sürüm.
- POST /api/desktop-count/drafts — requestId,note,lines.
- POST /api/desktop-count/drafts/:draftId — requestId,expectedRevision,note,lines.
- POST /api/desktop-count/resolve — kind,draftId ve özgün body.

Yalnız bu sayım yolunda64KiB JSON gövdesi kabul edilir; diğer yolların limitleri değişmez. Host/origin/loopback ve no-store sınırları korunur. SQL yazısı yalnız audit INSERT'tür. Kaynak testleri, GitHub CI, gerçek kurulum, SQL kilit yarışı, normal ekran, fiziksel cihaz ve insan kabulü ayrı kanıtlardır. Kaynak testi tek başına kurulmuş veya tam K07 kabulü değildir.
