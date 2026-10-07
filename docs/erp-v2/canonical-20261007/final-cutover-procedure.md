# Final T0/T1 cutover — stok, fiyat ve ayrı döviz cari hesapları

7 Ekim 2026; ERP-DEC-025 / ERP-CUT01. Bu belge ortak kesim prosedürünün güncel kaydıdır. Gerçek T1 alınmadı; yeni stok/fiyat/cari yazması, servis değişikliği, Vega/LIVE işlemi veya geçiş yapılmadı.

Goal7.3: **TEST cari delta mekanizması teknik olarak kanıtlandı.** Kullanıcının üç tedarikçi örneğinde gördüğü döviz ayrımı, B/A ve uygulama mantığı uygundur. Sonraki Vega işlemlerinden kaynaklanan bakiye farkı normal kaynak driftidir; eski batch hatası veya aynı hesapları tekrar migrate etme gerekçesi değildir. **ERP-UA24 bekliyor; PASS verilmedi.** Eski native hareketlerin tek tek ekranda listelenmesi ayrıca kabul edilmedi; önceki SQL koruma kanıtı ve ekranın kaynak hareket özeti birbirinin yerine geçmez.

## Kullanıcı için geçiş günü — 10 adım

1. **Kapsamı kesinleştir:** Aktarılacak ürünleri ve müşteri/tedarikçi hesaplarını, çözülemeyen kayıtları ve son kabul edilmiş kaynak sürümlerini tek listede dondur. TEST provası ile gerçek geçiş onayını ayrı tut.
2. **Son işleri bitir:** Vega'da bekleyen mal kabul, satış, ödeme ve terminal işlemlerini tamamla; bütün offline cihazları ve entegrasyon kuyruklarını eşitle.
3. **Yazımları durdur:** Yetkili sorumlular Vega'nın bütün yazan uygulamalarını durdurup kesim saatini kaydetsin. Melisa işlemlerini de geçici duraklat; iki tarafta yeni işlem birikmesin.
4. **Geri dönüş yedeğini hazırla:** Hedef veritabanının yeni yedeğini doğrula ve ayrı veritabanına gerçekten geri yükleyip okuyabil. Aktif veritabanının üzerine restore yapma.
5. **Son T1 fotoğrafını al:** Duran Vega'dan stok, fiyat ve cari hesaplarını aynı kesim kapsamında oku. Müşteri/tedarikçi Döviz Bakiye değerlerini TRY/USD/EUR ve B/A yönüyle ayrı al.
6. **Yalnız kalan farkı hesapla:** T0→T1 değişiminden daha önce uygulanmış kaynak farklarını çıkar. Melisa'daki satış, alış, tahsilat, ödeme ve diğer yerel hareketleri koru; fiyatları kendi döviz/birim/kademe sürümüyle karşılaştır.
7. **Planı ve yetkiyi kontrol et:** Karantina, bilinmeyen değer, kimlik ve yerel fiyat çakışmalarını durdur. Kaynak/hedef hashleri, yedek ve hangi kayıtların uygulanacağı değişmez planda açık olsun; uygulama için ayrı onay al.
8. **Onaylı farkı bir kez uygula:** Stok, fiyat ve cari alt batch'lerini aynı kesim kimliğine bağla. Kesinti olursa kalıcı sonucu oku; aynı kimlik ve aynı içerik ikinci etki üretmesin.
9. **Sonuçları birlikte kontrol et:** Bağımsız stok/defter/fiyat/cari mutabakatını ve normal ekranları incele. TRY/USD/EUR birleşmesin; eski Melisa hareketleri korunsun. Sorun varsa yeni işlemleri açmadan yalnız batch etkisini kontrollü geri al.
10. **Tek sistemle devam et:** Kullanıcı açık geçiş kabulü verdikten sonra işlemleri Melisa'da aç. Vega'nın salt okunur arşive alınması ayrıca yetkili işlem olsun; otomatik geri açma veya çift yazma yapma.

## T0, önceki uygulamalar ve kalan T1 farkı

T0 tek bir tarih etiketi değildir: her atomun ilk kabul edilmiş kaynak değerini ve kimliğini saklayan immutable temel manifesttir. 30 Eylül açılışı ve 7 Ekim Goal7 T0 araştırması farklı kayıtlardır. Goal7'nin iki geçişli kaynak okuması ortak atomik T1 değildir. Güncel kesimin T0'ıymış gibi tekrar etiketlenmez.

Her atomda `sourceKey`, gerçek native hedef ID, ilk kabul edilmiş kaynak T0, son kabul edilmiş kaynak değeri, her committed uygulamanın run/hash/etkisi, native before-image/defter ve ayrı yerel etkiler bulunur. Toplam `acceptedBaselineHash` bu sürüm sicilini bağlar; atomların son kabul tarihi farklı olabilir. Yeni adapter bu bilgileri mevcut kaynak bağları, Goal7 journal/source-version ve Goal7.3 journal'ından okumalıdır; test fixture'ını gerçek kabul makbuzu sayamaz. Run kimlikleri değiştirilmez.

Cari atomu: **kaynak şirket/kart kimliği + müşteri/tedarikçi rolü + hesabın dövizi**. TRY/USD/EUR ayrı hesaplardır, ayrı cari kartlar değildir. Kaynak B pozitif, A negatif, doğrulanmış sıfır `ZERO`; unknown ve hareket yok ayrı kaynak durumlarıdır. Müşteride native işaret katsayısı +1, tedarikçide önceki doğrulanmış sözleşme gereği −1. Genel Bakiye/ham BAKIYE ve varsayılan kart dövizi hesap yerine kullanılmaz; kur dönüşümü yapılmaz.

```text
appliedSourceDelta = committed kaynak düzeltmelerinin toplamı (yerel hareketler hariç)
appliedSourceDelta = sign × (acceptedSourceLatest − sourceT0)
nativeBefore = nativeOpening + localEffects + appliedSourceDelta = nativeLedger
totalT0T1Delta = sign × (sourceT1 − sourceT0)
remainingDelta = totalT0T1Delta − appliedSourceDelta
               = sign × (sourceT1 − acceptedSourceLatest)
nativeAfter = nativeBefore + remainingDelta
```

Bu zincir uyuşmazsa yazma durur; eski tutar T1 tutarıyla ezilmez. Açılış hatası ayrı düzeltme kararı ister. No-op hesap hareket oluşturmaz. Native after değeri yerel işlemler nedeniyle kaynak T1 tutarına eşit olmak zorunda değildir; kontrol kaynak + korunmuş yerel etki denklemidir. B/A after yönü native tutar kaynak işaretine geri çevrilerek gösterilir.

Stok aynı hesabı birim doğrulamasıyla kullanır: `remaining = sourceT1 − acceptedSourceLatest`, `after = before + remaining`. Önceki Goal7 stok etkisi tekrar eklenmez. Defter/bakiye aynı olmalı; mevcut 3 basamak hassasiyet dışı miktar, temsil edilemeyen stok ve negatif sonuç tahminle yuvarlanmaz veya sıfırlanmaz.

Fiyat aritmetik delta değildir. Kimliği ürün + satış/alış türü + kaynak birim + kademe + dövizdir. Satış birimi/kademesi gerçek kaynak sözleşmesinden (1–6), alış kart fiyatı `CARD`/0 olarak korunur. Son kabul edilmiş sürümden T1'e immutable fiyat sürümü oluşturulur; native değer ve hash hâlâ beklenen önceki değer olmalıdır. Yerel fiyat düzenlemesi çakışırsa otomatik overwrite yok. NULL bilinmeyen, gerçek sıfır sıfırdır; kaynak fiyatın kaybolması ayrı karar ister. Tarihsel fatura/satış/alış fiyat snapshot'ları değiştirilmez. Kaynakta yeni fiyat dövizi/tuple veya silinmiş tuple bu hazırlık çekirdeğinde otomatik oluşturulmaz; ayrı adapter/kapsam kararı gerekir.

## Ortak capture ve kapsam

- Kaynak: `DESKTOP-KSRK0EQ` / `VEGA2026`, dönem `D0007`; müşteriler F0102, tedarikçiler F0103. Capture anındaki dönem/işletme tarihi ve raporun başlangıç-bitiş/tüm aktif-pasif/sıfır/döviz filtreleri mühürlü ortak kapsamda bulunmalı. 1 Ocak açılış/devir dönem hareketinden ayrılır; açılış ikinci kez eklenmez. 7 Ekim raporunun teyit edilmiş kapsamı final günün güncel bakiyesi değildir.
- Vega masaüstü, servis, görev, muhasebe entegrasyonu, şube ve terminal writer envanteri; offline kuyruğun boşaltılması ve Melisa pause kanıtı zorunlu. Capture freeze'den sonra başlar. Ortak SQL snapshot/izole yedek tercih edilir; değilse bütün yazıcıların durması + tüm capture öncesi/sonrası hash eşitliği gerekir. İki bağımsız SELECT eşitliği tek başına freeze kanıtı değildir.
- Aynı `cutoverId`, kapsam hash'i, bütün satırların canonical hash'i, zaman aralığı ve bütün stok/fiyat/cari alanlarını kapsayan before/after capture hash'i kullanılır. Hash doğru görünen bir fixture gerçek T1 kanıtı değildir; capture collector ve bağımsız reviewer gerçek kaynakla doğrular.
- Yeni/kaybolan kart, barkod, ürün ana veri ve birim değişiklikleri ortak manifestte ayrı atom ve bağımlılık olarak listelenmeli. Goal7 yeni kart/source-version yaklaşımı korunur; mevcut olmayan hedefi bu çekirdek oluşturmaz. Aynı source key başka hedefe veya held karta otomatik bağlanmaz. Normal kaynak drift yalnız T1'de ele alınır; eski Goal7.3 manifesti/raporu değiştirilmez.
- 122 belirsiz cari, eksik dört tedarikçi kartı, LL/$2, `(-)`, eksik kur/açılış/hassasiyet ve kanıtsız maliyet ayrı engel listesinde kalır. Hold topluca kaldırılmaz. Hariç tutma işletmece açık kabul edilmeden tüm cutover hazır sayılmaz; kritik müşteri/tedarikçi veya operasyon eksiği geçişi durdurabilir.

## Ortak uygulama, replay ve inverse sözleşmesi

Parent kesim durumları: `PREPARED → APPLYING_STOCK → APPLYING_PRICE → APPLYING_PARTY → RECONCILED → ACCEPTED`. Bunlar önerilen orchestration sözleşmesidir; mevcut DB'ye bu tur eklenmedi. Alt batch'ler bağımlılık sırasıyla uygulanır; fiyat altındaki yeni ürün ihtiyacı önce master/source bağıyla çözülmeli. Ayrı writer'ların ortak tek SQL transaction'ı olduğu iddia edilmez. Parent tamamlanmadan personel yazımları açılmaz.

Her atomda plan hash, kaynak/native witness, hold, kimlik, hedef DB ve roller işlem anında yeniden doğrulanmalı. Hesap/defter/audit/journal alt transaction'da atomik olmalı. Aynı UUID+aynı hash committed makbuzdan no-op; aynı UUID+farklı body reddi; yanıt kaybında yeni UUID üretmeden durum/readback ile toparlama. Kısmi parent başarısında yeni alt batch başlamaz; `STOPPED` durumundan makbuzlarla devam veya ters bağımlılık sırasıyla telafi kararı gerekir.

Stok/cari inverse, bugünkü native değerden **yalnız uygulanan batch delta'sını çıkarır**; sonraki yerel hareketleri silmez. Telafi için ayrı idempotent run/etki bağları ve bağımsız scalar=ledger kontrolü gerekir. Fiyat inverse sadece değer+hash hâlâ batch after sürümüyse önceki sürümü geri getirir; daha sonraki fiyat değişikliğinde durur. Yeni master/hesap/bağlar kendi inverse sözleşmesi olmadan silinmez. Aktif DB üstüne restore veya Vega yazımlarını otomatik açma yok; gerçek geçiş sonrası geri dönüş ayrıca işletme kararıdır.

## Bu tur hazır olan ile bekleyen

| Parça | Durum |
| --- | --- |
| Goal7.3 sabit 16 hesap writer/replay/inverse kanıtı | Önceki kanıt korunur; tekrar uygulanmadı veya tekrar test edilmedi. Writer/reader kapsamı ve mevcut roller değişmedi. |
| Ortak saf hazırlık çekirdeği | `scripts/migration/final-cutover-plan.mjs`: mevcut Goal7.3 exact decimal, replay ve inverse yardımcıları yeniden kullanılır; stok/cari residual, typed fiyat, capture/native guard ve mühürlü plan. SQL/dosya/ağ/CLI yazıcısı yok. |
| Planın çalıştırılması | Her çıktıda `financialWriteAuthorized:false`, `executeAllowed:false`, `runtimeAdapter:NOT_IMPLEMENTED_OR_AUTHORIZED`. Hedef sadece mevcut kanonik TEST DB. Genel müşteri/tedarikçi veya LIVE writer açılmadı. |
| Offline doğrulama | 13 yeni sentetik test geçti: önceki delta çıkarımı/yerel koruma, ayrı rol-döviz-B/A, sıfır/no-op/unknown, freeze/drift, hold/ledger, typed fiyat, duplicate, hash değişikliği, replay, inverse/CAS, stok hassasiyeti, mevcut run kimliği. CI offline allowlist'ine eklendi. Teknik model insan kabulü değildir. |
| Final runtime adapter / reader | Son T1 collector, gerçek committed makbuz bağlayıcısı, müşteri+tedarikçi writer/okuyucu, yeni master/fiyat tuple ve parent recovery/inverse entegrasyonu henüz uygulanmadı. Mevcut Goal7.3 reader'ını genel T1 journal'ını okuyormuş gibi kabul etmeyiz. Bunlar ayrıca kapsamlandırılacak; bu tur yeni migration başlamaz. |
| Kesim onayları | Writer sahipleri/offline fiziksel senkron, güncel kapsam/işletme engelleri, taze backup+gerçek ayrı restore, final T1 mutabakatı ve açık uygulama/geçiş onayı bekler. ERP-UA24 PASS değildir. |

Gizli ham raporlar, cari adları/bakiyeleri ve gerçek manifestler GitHub'a konmaz. TEST86/source `769031c` aynen korunur; bu source-only hazırlık runtime paketi değildir. Sonraki işler ve gerçek uygulama kendiliğinden başlatılmaz.

Önceki dayanaklar: [Goal7 cutover/arşiv](goal7-cutover-archive-plan.md), [Goal7.3 kanıtı](../canonical-20261005/goal73-supplier-delta.md), [kararlar](../../../PROJECT_DECISIONS.md), [kullanıcı kabulü](../../../USER_ACCEPTANCE.md).
