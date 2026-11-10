# K10-02 / DES-19 satış onay sınırları

## 9 Kasım güncel kurulum ve normal vade ekranı

Kaynak6c0d64ce/paket59f149b1,317runtime kaynak ile aynı TEST'te kurulu; push42628201898 ve PR42628212029 toplam8iş/104adım SUCCESS. Normal operatör30002'nin müşteri104/hesap110 için ürün10+11 içeren24.0000TRY fiş20'si CHECKED → talep232 → mevcut müdür30016 onayı → operatörün açık232 seçimi → tek DISPATCH POST201 zincirini tamamladı. Ekranda Tamamlandı ve Vade2026-12-09 görüldü; istek COMMITTED/replayed=false. Ardından aynı operatörün tek1TRY tahsilatı normalPOST201/COMMITTED/replayed=false ile fiş20'ye tahsis edildi; vade2026-12-09, kalan23TRY. Böylece seçili fişe özel vade/satış/tahsilat zincirinin olumlu normal ekran ve bağımsız native kanıtı oluştu. [Kurulu paket, UUID'ler ve kanıt sınırı](../evidence/erp/2026-11-09-sales-approval-matrix/README.md).

Kurulumun47native alan/5korunan küme eşliği sonraki satışın ticari etkisinin kanıtı değildir. Fiş20 sonrası v4 native gözlem/v3 doğrulama request232/approval233/consume234/v2snapshot235, tam DISPATCH gövde hash'i, iki stok hareketi ve tek cari borç/tahsilat tahsisini doğruladı. Genel müşteri vade/kredi tanımı yazılmadı. Eski208/209audit ve dört güvenlik kümesi korundu; yalnız seçili iki yeni kalem karşılaştırıldı. Hedef zincir atomik, toplam üç okumanın birleşimi atomik değil. İlk gözlemci207hatası yalnız okuma sorgusunda giderildi; uygulama/şema kusuru veya değişikliği olarak gösterilmez. K10-02/bütünERP, boş son kurulum/LAN/personel ve insan kabulü kapatılmaz. Ölçülen ham/ayrı-IF sorgu süreleri sınırlı örnektir; evrensel hız veya cache soğukluğu kanıtı değildir. Doküman successor'ı kurulu6c0d kaynak head'iyle aynı şey değildir.

**9 Kasım önceki B81 aşaması:** B81/paketd961 TEST'e kuruldu; vade denemesi yeni müşteri104 cari okumasında401/10.091sn ile durdu, yeni fiş/sevk gönderilmedi. Kaynaktaki okuma iyileştirmesi aynı transaction'da tam doğrulamayı koruyup ayrı yinelenen taramayı kaldırır(3→2); V7statik guard12IF/203predicate yerine aynı203predicate/THROW'u ayrı IF'lerde çalıştırır. SQLmetadata/literal/manifest/yetki/timeout/UUID aynı; bağımsız AST byte/sıra eşliğini doğruladı. Birleşik51hedefPASS; yeniCI/native hız/kurulum/normal vade kabulü ayrıca açık. Bu,401çözümü veya tamamlanmış ERP iddiası değildir.

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

Mevcut `saveTerms` kalıcı müşteri vadesi tanımıdır; fişe özel vade istisnası değildir. Mevcut kredi snapshot'ındaki `vadeStatus: unknown` bir istisna kabulü sayılmaz. 2e43 aşamasında ayrı vade protokolü ve olumlu normal ekran kanıtı bekliyordu. Güncel6c0d kurulumu/fiş20 ekran sonucu yukarıda; seçili vade/satış/tahsilatın normal ekran ve native tek etki doğrulaması oluştu, insan ve bütünERP kabulü hâlâ açıktır. Bu karar genel cari düzenleme yetkisi eklemez. K10-02 bu kaynak değişikliğiyle tamamlanmış sayılmaz.

Yeni dar TEST müdür/patron kimlikleri önce pasif hazırlanır; eski yüzde 5 adlı hesabın kind=sales olması şirket müdürü olduğu anlamına gelmez. Kişi politikası satırına ekleme bütün policy revizyonlarını değiştirdiğinden uygulama öncesi açık/belirsiz komutlar gözden geçirilir. Fiş18 ve tarihsel209 silinmez, yeniden gönderilmez veya kendiliğinden iptal/onay/sevk edilmez. Korunan eski taslağın değişmiş politika altında otomatik kesinleştirilebildiği iddia edilmez.

Teknik kaynak testleri, paket/kurulum, ayrı normal satışçı-müdür/patron oturumlarında aynı fişe bağlı karar ve kayıt, SQL tek etki kontrolü ve insan kabulü ayrı kanıtlardır. Gerçek ekran sonucu bulunmadan K10-02 veya bütün ERP için PASS yazılmaz. LIVE/Vega, SQL servisleri, eski ticari kayıtlar ve main bu çalışmanın değişiklik hedefi değildir.

## Fişe özel vade istisnası uygulama sözleşmesi

Aşağıdaki sözleşme güncel6c0d/paket59f1 TEST kurulumunda bulunur; önceki2e43/paket299 kaynak-hazırlık sınırı tarihsel kayıttır. Kalıcı müşteri vadesi değiştirilmez. Tanımsız vadenin bütün satışları engellemesi veya geçmiş borcun sevki genel olarak durdurması gibi kararlaştırılmamış kurallar eklenmez.

- CHECKED fiş sahibi, güncel fiş/workflow ve taban vade revizyonuyla istenen gün sayısını ve gerekçeyi gönderir. Gün sayısı mevcut kuralla güvenli, negatif olmayan tam sayıdır; gerçek belge tarihinden hesaplanan tarih katı Gregorian doğrulamasından geçer. Yeni ticari gün üst sınırı icat edilmez.
- `/api/desktop-credit/invoices/:invoiceId/due-exception` ayrı dar bağlamı okur. `/due-requests` GET/POST ve `/due-requests/:id/approve` POST aynı base altında ayrıdır. Eski kredi/kalıcı vade DTO'ları genişletilmez.
- Create gövdesi tam olarak requestId/invoiceId/expectedVersion/expectedTermsRevision/requestedTermDays/reason taşır. Taban vade tanımı yoksa beklenen revizyon null'dır. Sunucu müşteri/hesap/döviz/tarih/tutar ve hesaplanan tarihi kendi kilitli kayıtlarından bağlar.
- Müdür/patron yalnız güncel ve süresi geçmemiş yabancı bekleyen talebin gerekli bilgilerini görür. Müdür kendi talebini onaylayamaz; patronun bu ayrımı yalnız mevcut açık boss kişi tanımından türetilir. Genel müşteri/finans hakkı verilmez.
- Onay mevcut10dakika örneğine, güncel onaylayan yetki revizyonuna ve tek kullanıma bağlıdır. Satışçı aynı fişin dispatch gövdesine açık dueExceptionRequestId seçer; en son onay kendiliğinden seçilmez. Alan yoksa eski dispatch gövdesi/hash'i değişmez.
- Aynı SERIALIZABLE kesinleştirme işleminde fiş, kişi, workflow, hesap/döviz/tarih/tutar, taban vade ve onay yetki revizyonları/süre yeniden doğrulanır. Kredi ve vade tüketimleri ayrı sonlu kayıt ad alanları kullanır. Vade tüketimi, immutable vade snapshot'ı, stok/cari etkileri ve workflow journal birlikte commit veya rollback olur.
- Yanıt kaybında UUID ve tam gövde korunur. Mevcut komut kuyruğu/resolver yeni dar kind'ları taşır; yetki kaybı yeni onay POST'u oluşturmaz.

`invoice.due.snapshot` v1'in tam12alanlı şekli korunur. Yalnız onaylı istisna v2 yazar; effective termDays/dueDate ile nullable taban termsRevision ayrı anlam taşır. Ek exception alanı requestRecordId/approvalId/consumeId/snapshotHash/approverId/authorityRevision/approvedAt/expiresAt/baseTermDays kökenini tutar. Workflow okuyucusu ve tahsilat tahsis okuyucusu aynı katı ortak validator ile v1/v2 kabul eder; tanımsız tarihli v1 tahsilat tahsisi için kabul edilmiş sayılmaz.

DDL/DCL, yeni kullanıcı/rol veya grant gerekmez. Kaynak, bağımsız inceleme/CI, kurulum ve yeni normal vade akışı kabulü ayrı tutulur; mevcut18/19 ve209/223/225 kayıtları değiştirilmez.

Kaynak doğrulaması: API/shared49 ve frontend126 hedef PASS; bağımsız backend42 ve frontend111 hedef PASS/0skip ve GO. Normal auth+gerçek servis+sentetik driver/HTTP, çift tüketim rollback'i, eski dispatch hash'i, v1/v2 okuyucuları, UNKNOWN/reload/aynıUUID/gövde ve rol sınırları kapsandı. İlgili ekran düzeltmeleri: ilk yüklemede onay düğmesi devre dışı/yükleme durumu; onaylı TRY cari yüklemesi ve FX override koruması; kayıtlı fişte boss kendi onayı için politika yüklenmesi. Aynı bilinen esbuild/junction guard reddi tekrarlanmadı veya gevşetilmedi; yeni build hosted exact6c0d CI/artifact ile doğrulanıp kuruldu; yerel reddin atlandığı iddia edilmez.

Bağımsız yerel incelemeler: due-exception-backend-independent-review.json SHA8feec8eb6ce8a31ca106fa210499eb6e80dc0f83f3a1bb1875678b8b9e8811a3; due-exception-frontend-independent-review.json SHAc07ba77a2816b26d5dae2213f53eb03472a4fbd1f208b71147bc0ba398e70be1. Bunlar kaynak/fixture kanıtıdır; yeni vade için SQL/kurulum/normal GUI/insan kabulü yerine geçmez.

## 10 November: approval queue availability and pinned request revalidation

Approval-list reads classify only a missing target or an otherwise valid,
explicitly inactive target as unavailable through a narrow internal opt-in.
Such a request is ineligible and does not hide unrelated valid requests.
Malformed or duplicate rows, database/driver errors and authorization guards
still reject the operation. Current actor checks and approval/consumption
defaults remain strict; this adds no public request parameter or permission.

Refreshing the approval panel clears old actions first. A pinned request found
in the new list uses that fresh row; one outside the latest 50 is read again by
its exact normal request ID. Only the revalidated result restores its action
and core cache entry. A failed exact-ID read clears the old cached entry and
does not leave an apparently actionable old request. Actor, session generation,
policy, scope, expiry and UNKNOWN UUID/body rules remain in force.

Targeted pricing/auth and real-core plus DOM regression evidence is recorded in
STATUS. These source checks do not establish installation, real personnel or
the missing role acceptance.
