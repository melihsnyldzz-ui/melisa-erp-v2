# C06/B03 — müşteri kimliği ve yerel ana alan revizyonu

Görev: `ERP-CUSTOMER-IDENTITY-CONTRACT-FIX-20261102-1820`.
Bu teslim kaynak/offline ve kendi sentetik uygulamasıdır. Gerçek SQL, kurulum,
OS, servis, Vega, LIVE, CRM veya insan kabulü kanıtı değildir.

## Kaynak ile kullanıcı tarafından düzenlenen alanlar

`dbo.customers`, party/source bağlantıları, currency account ID'leri, döviz,
bakiye, hareketler, belgeler ve contact guardları değiştirilmez. Kaynak kod/ad
eşitliği C06 okuyucusunda aynen korunur. Ayrı para hesapları birleştirilmez.

Önerilen aynı-DB metadata tabloları:

| Tablo | Anahtar | İçerik |
|---|---|---|
| customer_master_local_v1 | copy + customer | yerel kod/ad/tür, kaynak kimliği hash'i, artan revizyon |
| customer_master_requests_v1 | copy + UUID | aktör, özgün canonical body/hash, commit revizyonu |
| customer_master_audit_v1 | copy + UUID | aynı işlemde önce/sonra yerel revizyon, aktör ve body hash'i |

Yeni bir ticari müşteri veritabanı veya ikinci müşteri kartı oluşturulmaz.
Metadata FK'ları mevcut customer ID'ye bağlanır. Tarihsel belgeler değiştirilmez.
Kaynak-native kodları yerel kod değişse bile başka kart için rezerve kalır.
Yeni yerel kodlar copy içinde, hedef kaynak kolonuyla aynı collation altında
tekildir. Kaynak bilinmiyorsa yetki veya sıfır bakiye üretilmez.

`customerMasterSqlContract.mjs` DDL ve parametrik SQL **metnidir**. Executor,
kurulum kaydı, otomatik DDL, GRANT veya runtime binding içermez.

## Okuma ve yazma sözleşmesi

1. Açıkça enjekte edilen store aynı SERIALIZABLE transaction ve copy applock
   içinde hedef/profile/seal, gerçek aktör/rol, kaynak reader hash'i ve metadata
   şemasını doğrular. Şema driftinde hata verir; kolon genişletmez.
2. Mevcut C06 SQL reader'ı ve `assembleCustomerCardRaw` kaynak/hesap/bakiye/hold
   doğrulamasını yapar. Aktör veya kaynak doğrulaması client flag'inden gelmez.
3. Projection varsa immutable tuple copy/seal/customer/party/source/original
   code/name/type/currency/account-ID/currency/source-account-key hash'iyle
   eşleşir. Exact bakiyeler ayrıca mevcut DTO tarafından doğrulanır.
4. Server WeakMap read receipt'i transaction tamamlanmadan etkin değildir.
   Commit hatasında iptal edilir. JSON `verified:true`, clone, değiştirilmiş raw
   veya başka karta taşınmış marker bu kanıtın yerine geçmez.
5. Doğrulanmış projection yokluğu original DTO'yu korur; unknown/unmapped
   kartları gizlemez ve master yazma yetkisi vermez. Mevcut projection bozuksa
   sessizce original görünüme dönerek başarılı okuma sunulmaz.
6. Context v2 yerel alanlardan ayrı `original` kod/ad taşır. Contact formu
   original kimlikle bağlanır; yalnız contact özeti güncellenir. Yeni master adı
   eski kaynak adıyla ezilmez. Client metadata yazma otoritesi değildir.
7. CAS, native tam-row revision + local version + immutable identity hash'idir.
   Contact/source değişikliği yeni isteği stale yapar. Aynı UUID/body başarılı
   journal'da önce çözülür; eski CAS ikinci ticari etki oluşturmaz. Farklı body,
   aktör, kart veya scope reddedilir. Yeni UUID ile atlama/otomatik replay yoktur.
8. Local revision, request ve audit tek transaction içindedir. Hata halinde
   birlikte geri alınır. Commit yanıtı kaybolduğunda explicit GET recovery
   journal/audit/local tutarlılığını okur; yeni kayıt göndermez.
9. Kod50/ad250/tür30 sınırları API, form ve typed adapter'da aynıdır. Baştaki
   sıfırlar korunur; 51/80 karakter kod kesilmez, reddedilir. Generic CRUD'un
   kod/tür parametreleri de kaynak genişliğine indirildi; o yol master forma
   bağlanmadı, generic güvenlik sınırları değiştirilmedi.
10. Effective kod/ad arama, original kod alias'ı, literal özel karakterler,
    status/hold filtresi, toplam ve sayfa aynı SQL candidate sorgusundadır.
    Seçilmiş C06 kartları aynı transaction'da doğrulanır. Sayfa alındıktan sonra
    JavaScript ile filtreleyerek yanlış toplam/sayfa üretilmez.

## Yapılan doğrulama

- 180 hedefli test PASS, 0 skip; offline guard açık. Yeni 14 test bu adapter'ın
  gerçek kaynak reader/DTO/service/typed SQL metinlerini sürücü modeliyle tüketir.
  Sürücü modeli SQL Server motoru değildir; lock/DDL/native transaction provası
  diye sunulmaz. Pure reader hash'i değişmedi.
- Guardlı Sites build geçti (7,51s Vite / 8,22s toplam).
- Bağımsız readonly review ilk arama P2'sini buldu; yukarıdaki candidate sorgusu
  ve arama/count/page regresyon testleri sonrası SOURCE GO verdi.
- Normal `createWorkCustomers` + master controller + service + SQL adapter,
  yalnız sentetik driver ile gerçek tarayıcıda kullanıldı: kaydet, refresh,
  yeni adla arama, leading-zero kod, Toptan türü, contact aç/iptal, boş ad,
  mükerrer kod, ACK kaybı, reload ve GET recovery, salt okunur rol.
- GUI'de 3 POST denemesi / 2 kesin yerel revizyon ve 2 journal; GET recovery
  sayıları artırmadı. Kaynak iki kartın tüm ham değerleri aynı kaldı. Üç ayrı
  döviz bakiyesi/sıfır/yönü korundu. Gerçek ticari hareket oluşturulmadı.
- Private kanıt: `C:\Sirket\ERP\evidence\ERP-CUSTOMER-IDENTITY-CONTRACT-FIX-20261102-1820`.
  Sentetik before/after, AX/screenshot, hedef test/build ve teslim receipt'i
  oradadır. Ham gerçek cari verisi bu depoya konulmadı.

## Gerçek DB bağlantısı için somut eksikler

Varsayılan `customerMasterService` hâlâ **503** döner. Yeni store fabrikası ve
projection seam'i runtime'a bağlanmadı. Yeni kurulu sürüm iddiası yoktur.

- Yetkili bağımsız hedefin güncel DB/server/login/copy/profile/seal ve native
  source reader/guard/actor izin kanıtları gerekir. Tarihsel 14 Ekim metadata
  capture güncel hedef kanıtı değildir; mevcut sonlu copy modeli genişletilmedi.
- Aynı DB'de bu üç yeni metadata tablosunun onaylı oluşturulması, gerçek kolon,
  PK/FK/unique/collation ve görünürlük sonuçları frozen karşılaştırılmalıdır.
  DB default collation kaynak customer_code ile farklıysa DDL körlemesine
  uygulanmaz; exact kaynak collation için ayrıca somut migration hazırlanır.
- Dar SQL service principal: gerekli kaynak SELECT/reader EXEC ve metadata
  view-definition; local projection için SELECT/INSERT/UPDATE, request/audit
  için SELECT/INSERT. Journal/audit UPDATE/DELETE ve native ticari DML yetkisi
  verilmez. Bu teslim böyle bir grant/credential oluşturmaz. Native engine
  üzerinde transaction/replay/rollback/ACK-loss/permission denial kanıtlanmalıdır.
- Mevcut C06 source-only metadata SQL'i sonradan cari deltalara bağlanan daha
  yeni reader zinciri varsa aynı güncel final/current finance proof'larıyla
  birlikte ele alınmalıdır; bu kaynak fabrikası o yeni runtime'ı varsaymaz.
- Optional card projection/list injection yalnız gerekli native admission
  tamamlandıktan sonra bağlanabilir. Listede seçilen her kartın C06 okuması
  bulunduğu için gerçek hedef sorgu planı ve süre ölçümü ayrıca gerekir;
  kurulu katalog performansı için bu tur ölçülmüş iyileşme iddia edilmez.
- Seçilmiş Library pikselleri erişilemedi: görsel fidelity uygulanmış değildir.
  Fiziksel cihaz ve gerçek personel kabulü özgün UA kayıtlarında BEKLİYOR.

49 yaprak ve kabul sayaçları değişmedi. Eski kurulum/restart/archive işi
yeniden açılmadı. Bu kaynak tesliminden sonra gerçek kurulum kendiliğinden
başlatılmaz.
