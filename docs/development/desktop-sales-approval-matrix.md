# K10-02 / DES-19 satış onay sınırları

9 Kasım son kurulum: B81/paketd961 TEST'e kuruldu; vade denemesi yeni müşteri104 cari okumasında401/10.091sn ile durdu, yeni fiş/sevk gönderilmedi. Kaynaktaki okuma iyileştirmesi aynı transaction'da tam doğrulamayı koruyup ayrı yinelenen taramayı kaldırır(3→2); V7statik guard12IF/203predicate yerine aynı203predicate/THROW'u ayrı IF'lerde çalıştırır. SQLmetadata/literal/manifest/yetki/timeout/UUID aynı; bağımsız AST byte/sıra eşliğini doğruladı. Birleşik51hedefPASS; yeniCI/native hız/kurulum/normal vade kabulü ayrıca açık. Bu,401çözümü veya tamamlanmış ERP iddiası değildir.

9 Kasım 2026. Bu çalışma PR119'un `00ef3887` kaynak tabanını ve PR120'nin rol matrisi incelemesini kullanır. PR121 ve PR122 sonraki satış/depo/mal kabul/finans hazırlıklarıdır; bunların varlığı kurulum veya kabul değildir.

## Kesin şirket kararı

Satışçı kendi kişi sınırına ve en fazla yüzde 3 indirime tabidir. Üzerindeki oran onay gerektirir. Müdür yüzde 5 dahil indirim ile müşteri limit/vade istisnasını onaylayabilir; yalnız bekleyen karar için gerekli cari bilgisini görebilir. Yüzde 5 üzeri indirim patrona aittir. Mevcut izin sistemi kullanılır; bu karar genel yönetici veya finans erişimi vermez. Önceki geniş birleşik onaylayıcı önerisi uygulanmaz.

Kararın yerel koordinasyon kaydı: `erp-koordinasyon-izleme.json` / `salesApproverDecision.approvedMatrix`; açıklama: `scopeClarification`. Bu belge yeni iş kararı veya yeni takip tablosu oluşturmaz.

## Bu kaynak değişikliği

- Canonical kişi politikası manager/boss için `sales.view` ile `canApproveUpToFive` üretir. `canApproveAboveFive` yalnız boss olarak kalır. Rolün adı yetki oluşturmaz; genel rol varsayılanları eklenmez.
- Müdür başka satışçının yalnız bekleyen, süresi geçmemiş, mevcut kişi politikasıyla bağlı ve en çok yüzde 5 olan indirim isteğini listeler, okur ve onaylar. Kendi isteğini onaylayamaz. Patronun mevcut davranışı korunur.
- Kararın tüketimi aynı talep, kişi, gövde, quote, yetki revizyonu, süre ve tek kullanım bağıyla tekrar doğrulanır. Satış kaydı güncel katalog/önizleme kanıtını ayrıca doğrular. Müdürün listesinde eski kararlar ve sınır dışındaki yabancı istekler açılmaz.
- Kredi onay yetkisi genel CHECKED fiş okuyucusu değildir. Yabancı cari özeti yalnız henüz karara bağlanmamış, fiş/bakiye/politika revizyonu güncel gerçek kredi talebine bağlı okunur. Genel hesap okuma `customer.view`, tanım yazma ayrıca `customer.edit` ister; bu haklar yeni onay rolüne eklenmez.
- Yalnız `sales.view` taşıyan kişi normal yeşil ekranın onay panellerine katalog veya satış giriş formu açılmadan ulaşır. UNKNOWN işlemler özgün UUID ve gövdeyi korur; yetki kaybı yeni POST üretmez, mevcut komutun opak sonucu çözülebilir.
- Çok sayıdaki eski veya geçersiz istek, daha eski geçerli bekleyen kararı gizlemez; dar kontrol, ilerlemesi doğrulanan keyset sayfaları üzerinde yapılır.

## Ayrı kalan vade ve kurulum kabulü

9 Kasım gerçek yerel kurulumda %5.0001 için müdür GET403/patron onayı, tam %5 için müdür onayı ve satışçının aynı onayla fiş19 taslak kaydı normal ekran/native journal üzerinden doğrulandı. Runtime2e43/paket299 ile offline SQL compiler873 ayrıdır. [Gerçek kanıt ve kalan sınırlar](../evidence/erp/2026-11-09-sales-approval-matrix/README.md).

Mevcut `saveTerms` kalıcı müşteri vadesi tanımıdır; fişe özel vade istisnası değildir. Mevcut kredi snapshot'ındaki `vadeStatus: unknown` bir istisna kabulü sayılmaz. Vade istisnasının fiş/kişi/terim revizyonuna bağlı ayrı protokolü ve olumlu normal ekran kanıtı henüz tamamlanmadı. Bu eksik genel cari düzenleme yetkisi verilerek kapatılmaz. K10-02 bu kaynak değişikliğiyle tamamlanmış sayılmaz.

Yeni dar TEST müdür/patron kimlikleri önce pasif hazırlanır; eski yüzde 5 adlı hesabın kind=sales olması şirket müdürü olduğu anlamına gelmez. Kişi politikası satırına ekleme bütün policy revizyonlarını değiştirdiğinden uygulama öncesi açık/belirsiz komutlar gözden geçirilir. Fiş18 ve tarihsel209 silinmez, yeniden gönderilmez veya kendiliğinden iptal/onay/sevk edilmez. Korunan eski taslağın değişmiş politika altında otomatik kesinleştirilebildiği iddia edilmez.

Teknik kaynak testleri, paket/kurulum, ayrı normal satışçı-müdür/patron oturumlarında aynı fişe bağlı karar ve kayıt, SQL tek etki kontrolü ve insan kabulü ayrı kanıtlardır. Gerçek ekran sonucu bulunmadan K10-02 veya bütün ERP için PASS yazılmaz. LIVE/Vega, SQL servisleri, eski ticari kayıtlar ve main bu çalışmanın değişiklik hedefi değildir.

## Fişe özel vade istisnası uygulama sözleşmesi

Bu bölüm sonraki kaynak hazırlığıdır; çalışan2e43/paket299 uygulamasına henüz kurulmamıştır. Kalıcı müşteri vadesi değiştirilmez. Tanımsız vadenin bütün satışları engellemesi veya geçmiş borcun sevki genel olarak durdurması gibi kararlaştırılmamış kurallar eklenmez.

- CHECKED fiş sahibi, güncel fiş/workflow ve taban vade revizyonuyla istenen gün sayısını ve gerekçeyi gönderir. Gün sayısı mevcut kuralla güvenli, negatif olmayan tam sayıdır; gerçek belge tarihinden hesaplanan tarih katı Gregorian doğrulamasından geçer. Yeni ticari gün üst sınırı icat edilmez.
- `/api/desktop-credit/invoices/:invoiceId/due-exception` ayrı dar bağlamı okur. `/due-requests` GET/POST ve `/due-requests/:id/approve` POST aynı base altında ayrıdır. Eski kredi/kalıcı vade DTO'ları genişletilmez.
- Create gövdesi tam olarak requestId/invoiceId/expectedVersion/expectedTermsRevision/requestedTermDays/reason taşır. Taban vade tanımı yoksa beklenen revizyon null'dır. Sunucu müşteri/hesap/döviz/tarih/tutar ve hesaplanan tarihi kendi kilitli kayıtlarından bağlar.
- Müdür/patron yalnız güncel ve süresi geçmemiş yabancı bekleyen talebin gerekli bilgilerini görür. Müdür kendi talebini onaylayamaz; patronun bu ayrımı yalnız mevcut açık boss kişi tanımından türetilir. Genel müşteri/finans hakkı verilmez.
- Onay mevcut10dakika örneğine, güncel onaylayan yetki revizyonuna ve tek kullanıma bağlıdır. Satışçı aynı fişin dispatch gövdesine açık dueExceptionRequestId seçer; en son onay kendiliğinden seçilmez. Alan yoksa eski dispatch gövdesi/hash'i değişmez.
- Aynı SERIALIZABLE kesinleştirme işleminde fiş, kişi, workflow, hesap/döviz/tarih/tutar, taban vade ve onay yetki revizyonları/süre yeniden doğrulanır. Kredi ve vade tüketimleri ayrı sonlu kayıt ad alanları kullanır. Vade tüketimi, immutable vade snapshot'ı, stok/cari etkileri ve workflow journal birlikte commit veya rollback olur.
- Yanıt kaybında UUID ve tam gövde korunur. Mevcut komut kuyruğu/resolver yeni dar kind'ları taşır; yetki kaybı yeni onay POST'u oluşturmaz.

`invoice.due.snapshot` v1'in tam12alanlı şekli korunur. Yalnız onaylı istisna v2 yazar; effective termDays/dueDate ile nullable taban termsRevision ayrı anlam taşır. Ek exception alanı requestRecordId/approvalId/consumeId/snapshotHash/approverId/authorityRevision/approvedAt/expiresAt/baseTermDays kökenini tutar. Workflow okuyucusu ve tahsilat tahsis okuyucusu aynı katı ortak validator ile v1/v2 kabul eder; tanımsız tarihli v1 tahsilat tahsisi için kabul edilmiş sayılmaz.

DDL/DCL, yeni kullanıcı/rol veya grant gerekmez. Kaynak, bağımsız inceleme/CI, kurulum ve yeni normal vade akışı kabulü ayrı tutulur; mevcut18/19 ve209/223/225 kayıtları değiştirilmez.

Kaynak doğrulaması: API/shared49 ve frontend126 hedef PASS; bağımsız backend42 ve frontend111 hedef PASS/0skip ve GO. Normal auth+gerçek servis+sentetik driver/HTTP, çift tüketim rollback'i, eski dispatch hash'i, v1/v2 okuyucuları, UNKNOWN/reload/aynıUUID/gövde ve rol sınırları kapsandı. İlgili ekran düzeltmeleri: ilk yüklemede onay düğmesi devre dışı/yükleme durumu; onaylı TRY cari yüklemesi ve FX override koruması; kayıtlı fişte boss kendi onayı için politika yüklenmesi. Aynı bilinen esbuild/junction guard reddi tekrarlanmadı veya gevşetilmedi; yeni build hosted CI/artifact ile doğrulanacaktır.

Bağımsız yerel incelemeler: due-exception-backend-independent-review.json SHA8feec8eb6ce8a31ca106fa210499eb6e80dc0f83f3a1bb1875678b8b9e8811a3; due-exception-frontend-independent-review.json SHAc07ba77a2816b26d5dae2213f53eb03472a4fbd1f208b71147bc0ba398e70be1. Bunlar kaynak/fixture kanıtıdır; yeni vade için SQL/kurulum/normal GUI/insan kabulü yerine geçmez.
