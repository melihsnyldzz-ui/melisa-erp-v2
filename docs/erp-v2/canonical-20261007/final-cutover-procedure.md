# Final T0/T1 cutover — stok, fiyat ve ayrı döviz cari hesapları

7 Ekim 2026; ERP-DEC-025 / ERP-CUT01. Bu belge ortak kesim prosedürünün güncel kaydıdır. Goal8 kapsamında kaynak adapter'ları hazırlandı ve yalnız ayrı sentetik TEST şemalarında SQL motoru provası yapıldı. Gerçek T1 alınmadı; ticari stok/fiyat/cari tablolarına cutover yazması, hold kaldırma, Vega/LIVE işlemi veya gerçek geçiş yapılmadı. Normal FINAL runtime/API/ekran ve CRM aktivasyonu bu kanıtların kapsamında değildir.

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

Her atomda `sourceKey`, gerçek native hedef ID, ilk kabul edilmiş kaynak T0, son kabul edilmiş kaynak değeri, her committed uygulamanın run/hash/etkisi, native before-image/defter ve ayrı yerel etkiler bulunur. Toplam `acceptedBaselineHash` bu sürüm sicilini bağlar; atomların son kabul tarihi farklı olabilir. Hazırlanan adapter mevcut kaynak bağlarını, Goal7 journal/source-version ve Goal7.3 journal'ını kullanır; önceki committed etkileri hem journal hem native hareketle doğrular. Test fixture'ı gerçek kabul makbuzu değildir. Run kimlikleri değiştirilmez.

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

Fiyat aritmetik delta değildir. Kimliği ürün + satış/alış türü + kaynak birim + kademe + dövizdir. Satış birimi/kademesi gerçek kaynak sözleşmesinden (1–6), alış kart fiyatı `CARD`/0 olarak korunur. Son kabul edilmiş sürümden T1'e immutable fiyat sürümü oluşturulur; native değer ve hash hâlâ beklenen önceki değer olmalıdır. Yerel fiyat düzenlemesi çakışırsa otomatik overwrite yok. NULL bilinmeyen, gerçek sıfır sıfırdır; kaynak fiyatın kaybolması ayrı karar ister. Mevcut `accepted_price_values` ve `goal7_source_version_prices.price_exact` alanları NOT NULL olduğundan üretim publisher'ının `preflight` kontrolü bağlanmış NULL fiyatı ve eksik kabul edilmiş tuple'ı **ilk stok/fiyat/cari yazmasından önce** reddeder. Bağlanmamış bilinmeyen native NULL korunur ve mühürlü fiyat satırına eklenmez; doğrulanmış sıfır ayrı, gerçek bir fiyat olarak saklanır. Tarihsel fatura/satış/alış fiyat snapshot'ları değiştirilmez. Kaynakta yeni fiyat dövizi/tuple veya silinmiş tuple bu hazırlık çekirdeğinde otomatik oluşturulmaz; ayrı adapter/kapsam kararı gerekir.

## Ortak capture ve kapsam

- Kaynak: `DESKTOP-KSRK0EQ` / `VEGA2026`, dönem `D0007`; müşteriler F0102, tedarikçiler F0103. Capture anındaki dönem/işletme tarihi ve raporun başlangıç-bitiş/tüm aktif-pasif/sıfır/döviz filtreleri mühürlü ortak kapsamda bulunmalı. 1 Ocak açılış/devir dönem hareketinden ayrılır; açılış ikinci kez eklenmez. 7 Ekim raporunun teyit edilmiş kapsamı final günün güncel bakiyesi değildir.
- Vega masaüstü, servis, görev, muhasebe entegrasyonu, şube ve terminal writer envanteri; offline kuyruğun boşaltılması ve Melisa pause kanıtı zorunlu. Capture freeze'den sonra başlar. Ortak SQL snapshot/izole yedek tercih edilir; değilse bütün yazıcıların durması + tüm capture öncesi/sonrası hash eşitliği gerekir. İki bağımsız SELECT eşitliği tek başına freeze kanıtı değildir.
- Aynı `cutoverId`, kapsam hash'i, bütün satırların canonical hash'i, zaman aralığı ve bütün stok/fiyat/cari alanlarını kapsayan before/after capture hash'i kullanılır. Hash doğru görünen bir fixture gerçek T1 kanıtı değildir; capture collector ve bağımsız reviewer gerçek kaynakla doğrular.
- Hazırlanan collector varsayılan olarak sentetik hazırlık üretir; gerçek `FROZEN_SOURCE` yolu yalnız açık `READ_FROZEN_T1` yetkisi, durdurulmuş writer/boş kuyruk ve native pause kanıtı, doğrulanmış kaynak/hedef kimliği ile açılır. Capture öncesi/sonrası tüm alanların fingerprint'i eşit olmalı; pause/freeze yeniden kontrol edilip plan ve collector makbuzu birlikte mühürlenir. Bu kaynak yolu mevcut olmasıyla gerçek T1 alınmış sayılmaz.
- Yeni/kaybolan kart, barkod, ürün ana veri ve birim değişiklikleri ortak manifestte ayrı atom ve bağımlılık olarak listelenmeli. Goal7 yeni kart/source-version yaklaşımı korunur; mevcut olmayan hedefi bu çekirdek oluşturmaz. Aynı source key başka hedefe veya held karta otomatik bağlanmaz. Normal kaynak drift yalnız T1'de ele alınır; eski Goal7.3 manifesti/raporu değiştirilmez.
- 122 belirsiz cari, eksik dört tedarikçi kartı, LL/$2, `(-)`, eksik kur/açılış/hassasiyet ve kanıtsız maliyet ayrı engel listesinde kalır. Hold topluca kaldırılmaz. Hariç tutma işletmece açık kabul edilmeden tüm cutover hazır sayılmaz; kritik müşteri/tedarikçi veya operasyon eksiği geçişi durdurabilir.

## Ortak uygulama, replay ve inverse sözleşmesi

Hazırlanan runtime'ın kalıcı parent durumları: `PREPARED → APPLYING_STOCK → APPLYING_PRICE → APPLYING_ACCOUNT → RECONCILED`; kesintide `STOPPED`, ters uygulamada `INVERSE_ACCOUNT → INVERSE_PRICE → INVERSE_STOCK → INVERSED` ve kesintide `STOPPED_INVERSE`. Parent/child journal'ı yalnız sentetik fixture şemalarında çalıştırıldı; ticari şemaya gerçek cutover kurulmadı. Alt batch'ler bağımlılık sırasıyla uygulanır; fiyat altındaki yeni ürün ihtiyacı önce master/source bağıyla çözülmeli. Her alt batch kendi atomik transaction'ını kullanır. Parent tamamlanmadan personel yazımları açılmaz; kullanıcı geçiş kabulü ayrı kayıttır.

Her atomda plan hash, kaynak/native witness, hold, kimlik, hedef DB ve roller işlem anında yeniden doğrulanır. Uygulama yetkisi aynı collector/plan, şema/guard hash'leri, actor ve gerçek bağlantı kimliğine bağlıdır; gerçek uygulama taze yedek ve ayrı restore kanıtı ister. Hesap/defter/audit/journal alt transaction'da atomiktir; dar plan/satır guard'ları aynı transaction içinde kurulup özgün guard tanımları ve sıraları geri getirilir. Ana döviz kart scalar'ı deftere eşit değilse veya aktif bir hareketin iki bakiye etkisi de bilinmiyorsa yazma durur. Aynı UUID+aynı hash committed makbuzdan no-op; aynı UUID+farklı body reddi. Yanıt kaybında yeni UUID üretmeden kalıcı orijinal plan/collector ve committed çocuk makbuzları okunur. `STOPPED` sonrası ayrı `RESUME` ile aynı plan devam ettirilir veya inverse seçilir; bir inverse çocuk/durum kaydı varsa ileri `RESUME` reddedilir ve yalnız inverse toparlaması mümkündür.

Fiyat alt batch'i native typed fiyat değişikliğini yeni mühürlü FINAL source-version, okuyucu tanımları ve hash'leriyle yayımlar; no-op fiyat kapsamı da cari plan bağını taşıyan yeni sürüm yayımlar. Normal SQL okuyucularının native fiyat/tuple ve yayın bağını doğrulaması zorunludur; replay, parent mutabakatı ve inverse de bu bağı yeniden kontrol eder. Eski Goal7 sürüm/hash'leri değiştirilmez. Inverse, geri getirilen native fiyatlar için ayrı mühürlü restoration sürümü yayımlar. Yayınlanan `versionContext` tek başına çalışan API sürecini değiştirmez: gerçek kesimde, parent sonucu ve hash'leri eşleştikten sonra normal API'nin FINAL context'i açıkça yüklenmeli; müşteri/tedarikçi okuyucusunun ayrı party bağını da doğruladığı normal ekranlar ve CRM akışı ayrıca görülmelidir.

Stok/cari inverse, bugünkü native değerden **yalnız uygulanan batch delta'sını çıkarır**; sonraki yerel hareketleri silmez. Telafi için ayrı idempotent run/etki bağları ve bağımsız scalar=ledger kontrolü gerekir. Fiyat inverse sadece değer+hash hâlâ batch after sürümüyse önceki sürümü geri getirir; daha sonraki fiyat değişikliğinde durur. Yeni master/hesap/bağlar kendi inverse sözleşmesi olmadan silinmez. Aktif DB üstüne restore veya Vega yazımlarını otomatik açma yok; gerçek geçiş sonrası geri dönüş ayrıca işletme kararıdır.

## Bu tur hazır olan ile bekleyen

| Parça | Durum |
| --- | --- |
| Goal7.3 sabit 16 hesap writer/replay/inverse kanıtı | Önceki kanıt korunur; tekrar uygulanmadı veya tekrar test edilmedi. Writer/reader kapsamı ve mevcut roller değişmedi. |
| Ortak saf hazırlık çekirdeği | `scripts/migration/final-cutover-plan.mjs`: mevcut Goal7.3 exact decimal, replay ve inverse yardımcıları yeniden kullanılır; stok/cari residual, typed fiyat, capture/native guard ve mühürlü plan. SQL/dosya/ağ/CLI yazıcısı yok. |
| Planın çalıştırılması | Saf plan mevcut mühürlü biçimini korur: `financialWriteAuthorized:false`, `executeAllowed:false`, `runtimeAdapter:NOT_IMPLEMENTED_OR_AUTHORIZED`. Bu etiketler planı yazma yetkisine dönüştürmez; yeni runtime ayrı doğrulanmış collector/onay ister ve varsayılan `PLAN` yolu sıfır yazmadır. Hedef yalnız kanonik TEST DB; gerçek cutover veya LIVE writer açılmadı. |
| Collector / native adapter / parent recovery | `final-cutover-collector.mjs`, `final-cutover-runtime.mjs`, `final-cutover-sql.mjs` hazır: ortak capture mühürü, önceki makbuz/native etki bağlayıcısı, iki rol ve üç döviz, stok/typed fiyat, journal/audit, replay/mutabakat ve kalıcı inverse yönü. Yeni master/hesap/fiyat tuple oluşturma otomatik kapsamda değildir. |
| FINAL fiyat ve cari okuyucu kaynak entegrasyonu | `final-cutover-price-reader.mjs` ve `finalPartyDeltaRead.mjs` hazır; üretim fiyat preflight'ı, immutable FINAL yayın/restoration sürümü ve optional normal API reader dispatch'i eklendi. Cari okuyucu FINAL journal/native hareket/audit bağını doğrular; Goal7.3 sabit 16 reader/writer varsayılanı korunur. Gerçek FINAL context ile çalışan runtime/API/browser/CRM aktivasyonu henüz kanıtlanmadı. |
| Offline doğrulama | Saf planın 13 testi korunur; collector/runtime/native SQL guard, parent kesintisi, replay, inverse/CAS, okuyucu bağları ve yazma öncesi fiyat preflight'ı için hedefli offline testler de geçti. Teknik model ve otomatik testler insan kabulü değildir. |
| İzole native SQL cutover provası | [Native fixture kanıtı](../../evidence/erp/2026-10-07-goal8/cutover-native-proof.json): önceki cari/stok committed deltasının bir kez çıkarılması, iki rol ve TRY/USD/EUR, yerel hareketlerin korunması, apply/replay sıfır etki, hold/scalar/NULL/CAS negatifleri, yanıt kaybı ve kesilmiş inverse toparlaması doğrulandı. [Cari okuyucu kanıtı](../../evidence/erp/2026-10-07-goal8/cutover-party-reader-proof.json): gerçek SQL owner reader'ında altı sentetik hesabın apply+inverse net etkisi ve native/audit kaynağı doğrulandı. Ticari tablolar korunmuş, `actualT1:false`. |
| Tam kapsamlı FINAL SQL okuyucu provası | [Tam okuyucu kanıtı](../../evidence/erp/2026-10-07-goal8/cutover-full-reader-proof.json): ayrı anonim sentetik şemalarda 16.671 ürün / 63.775 fiyat, 54 hold, forward/inverse mühürlü yayın ve normal SQL reader çalışması doğrulandı; native NULL korundu, bağlanmış NULL dışlandı. Immutable sürüm, native drift, actor ve typed tuple negatifleri geçti; ticari tablolar korunmuş, `actualT1:false`, normal ERP runtime aktivasyonu yok. |
| Kesim onayları | Writer sahipleri/offline fiziksel senkron, güncel kapsam/işletme engelleri, taze backup+gerçek ayrı restore, final T1 mutabakatı ve açık uygulama/geçiş onayı bekler. ERP-UA24 PASS değildir. |

Gizli ham raporlar, cari adları/bakiyeleri ve gerçek manifestler GitHub'a konmaz. Önceki TEST86/source `769031c` dayanağı korunur; yeni kaynak ve sentetik SQL kanıtı gerçek FINAL runtime aktivasyonu değildir. Sentetik namespace before-image/checkpoint kanıtı taze ticari yedek/restore yerine geçmez. Gerçek T1, hold kaldırma, ticari cutover yazması veya LIVE geçişi bu prosedürün güncellenmesiyle başlamaz.

Önceki dayanaklar: [Goal7 cutover/arşiv](goal7-cutover-archive-plan.md), [Goal7.3 kanıtı](../canonical-20261005/goal73-supplier-delta.md), [kararlar](../../../PROJECT_DECISIONS.md), [kullanıcı kabulü](../../../USER_ACCEPTANCE.md).
