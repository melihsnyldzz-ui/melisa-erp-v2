# Kurulum, veri kontrolü, yedek ve geri dönüş paketi — 11 Ekim 2026

Bu teslim mevcut çalışan paketler için **çalıştırılmış salt okunur denetim aracı**, exact SHA256 referans manifesti ve önceki uygulanmış kurtarma kanıtlarını bir araya getirir. Yeni kurulum/restart, migration, SQL yazması, yedek, restore, görev veya ağ değişikliği yapmaz. LIVE uygulaması ve gerçek T1 değildir. TEST125 ile DB02 birbirinden ayrı korunur.

## Kullanılabilir paket

Araç: `scripts/canonical/inspect-existing-transition-package.mjs`. Offline olumsuz/hedef kimliği kontrolleri: yanındaki `.test.mjs`.

Kullanıcıya uygulanabilir tek rehber ve provenance manifesti ayrıca `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\transition-delivery\` altında hazırlandı: `README.md`, `provenance-manifest.json`, mevcut denetim manifesti/sonucu ve aracın byte-eşit kopyaları. Rehber 12 final-gün adımı ve commit öncesi/sonrası, CAS çelişkisi ve ayrı restore için geri dönüş kararlarını ayırır. Beş mevcut release manifesti ve sekiz eski kanıtın hash'i yeniden eşleşti; bütün 17.655 paket dosyası bu düzenleme sırasında yeniden taranmadı. Kopyalanmış aracın 15 offline testi geçti. Orijinaller, yedek ve servisler değişmedi; özel ayarlar kopyalanmadı.

Son kaynak adayı **5b6cd0cf40ca4ea110fc9c9d14e31327656f0ebe**, release **CANONICAL-COMPLETE-TEST-20261011-5b6cd0cf40ca**, manifestSHA **66e73f1c188ede0462a0795e828a9918d5cfa02e3d1b81874e87c89b7aaa0820** olarak private teslimde sabitlendi;1.723 dosya hash doğrulaması geçti. Önceki b006 aday kaydı tarihsel referans olarak korundu. Private provenanceSHA **77aa367df7e757ecd070fa3fd7a0130176925e5e4ef27e1baeef4163a018b39f**,12adım rehberSHA **f36315f8fbb1a542ff9db8959403ad7c4cdb3b041ea9dc96b0aa5748c9df599f**. Bu paket yalnız geçici loopback/USB terminal çalışma yüzünde doğrulandı; HOME kaynağı shared API4184'e kurulmadı. Rehber `Start/install` yetkisi vermez; bütün installation/start alanları false ve stable hazırlığı donmuş kalır. Dört teslimin tümü ve insan kabulü tamamlandı sayılmaz.

Private referans manifesti ve gerçek denetim çıktısı:

- `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\transition-reference-manifest.json`
- `C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\transition-inspection.json`

Kanonik ERP kökünden yalnız aşağıdaki okuma yapılır:

```powershell
node scripts/canonical/inspect-existing-transition-package.mjs --manifest C:\Sirket\ERP\evidence\ERP-COMPLETION01-20261011\private\transition-reference-manifest.json
```

Çıktı JSON'dur; denetim hatasında exit code 2. Manifestin tam SHA256'sı private teslim makbuzunda saklanır. Referanslar daha sonra değişirse eski manifestin üzerine yeni kimlik uydurulmaz; yeni kontrollü manifest hazırlanır. Parola, token, bağlantı dizesi ve ham ticari kayıt GitHub'a taşınmaz.

**Gerçek denetim sonucu:** 11 Ekim 00:39:58 UTC'de başlayan ardışık, atomik olmayan okumada beş paketin 17.655 dosyasının SHA256'sı eşleşti: Hub 1.734, ERP API 1.688, CRM 2.273, native sipariş 10.379, TEST125 1.581. Dokuz portun paket/giriş/süreç eşlemesi doğru; Hub/API/native/native sipariş için dört exact sağlık cevabı ve CRM HTML hash'i eşleşti. Sekiz eski kanıt dosyasının hash/semantik kontrolleri geçti. Yedek mevcut ve boyutu aynı; yeniden SHA256/restore yapılmadı. `inspectionPassed=true`, `readyForLive=false`. Bu okumada SQL bağlantısı veya bütün ticari kayıtların önce/sonra eşitliği yeniden denetlenmedi. 15 hedefli offline test PASS; CI veya insan PASS değildir.

Araç yalnız onaylı sabit portlar, release kökleri ve DB02/copy kimliğini kabul eder. Her paket manifestinin SHA256'sı ve manifestteki bütün dosyalar karşılaştırılır; Node süreçlerinin gerçek giriş dosyası ve yaratılma zamanı portla eşlenir. Wrapper/eval/yabancı giriş kabul edilmez. Sağlık sorguları yalnız loopback `GET /test-health`; CRM ön yüzü yalnız `GET /` HTML hash kontrolüdür. Redirect/auth/cookie/provider veya ticari endpoint kullanılmaz. CRM'nin yalnız process/HTML eşleşmesi bağımsız SQL bağlantısı kanıtı sayılmaz. Tam process komut satırları rapora çıkarılmaz. Denetim aracı SQL'e bağlanmaz, ticari veri hesaplamaz ve rol üretmez.

## Korunan mevcut kimlikler

| Bileşen | Çalışan kaynak / port | Amaç |
|---|---|---|
| Eski TEST125 | edb3c8915ef0e8c80ef911ced83bc2c1d1dceb0d / 5194 | Önceki normal ERP; değişiklik yapılmaz |
| İzole ERP API / native | a51b1170ade29494b3b446a44a8a62974eef687b / 4184,4186 | DB02 |
| Güncel Hub web | 466ac2df217d508b3b7f2aedff7c54292f136934 / 5234 | DB02 normal yeşil ekran ve eğitim |
| CRM web / gateway / katalog / sipariş | 222a95f9a63763c39cb18630373a1f27a55c6f65 / 62700–62703 | Ortak katalog ve taslak bağlantısı |
| CRM native sipariş | 60e424b61febd062668be0ccf3595c546da263a0 / 62704 | DB02 dar native taslak |

Exact hedef `MELISA_ERP_CRM_SHARED_TEST_20261009_02`; copyId `e16b70f0-4057-428b-9abc-6bbcaf35fe82`; `actualT1=false`. Anlık süreç/hash/sağlık sonucu private JSON'dadır; tablo anlık uptime garantisi değildir. Yeni kaynak commit'i çalışan paket source'u sayılmaz. Sabit HTTPS/boot hazırlığı bu paketle aktive edilmez; donmuş yardımcılar ve aday paketler değiştirilmez.

## Önceki geri dönüş kanıtı: yeniden uygulanmadı

[Aşama 5 gerçek izole kurtarma](../2026-10-09-stage5/README.md) kaynak TEST125 yedeğini gerçekten ayrı `MELISA_ERP_STAGE05_INVERSE_TEST_20261009_01` veritabanına restore etmişti. Aktif TEST125 veya DB02 üzerine restore yapılmadı. Denetim eski receipt ve sonuç hash'lerini/semantik koşullarını kontrol eder; eski SQL testlerini yeniden çalıştırmaz.

- 343 ürün-depo stok ve 59 ayrı döviz hesabı kaynak katkısı telafi edildi.
- 46/47 fiyat ve 34/35 ana kart grubunda uygun alanlar geri alındı; sonraki manuel değişikliği bulunan üç CAS alanı korundu. Bu sayılar ürün toplamına eklenmez.
- Altı sonraki sentetik yerel kurtarma provası ve 17 etkisi korundu. Bunlar gerçek işletme hareketi sayılmaz.
- 72 kart,109 barkod,319 fiyat ve72 kaynak bağı,572 immutable yayın kapsamı satırı üzerinden geri çekildi; fiziksel belge/kart/geçmiş silinmedi.
- Commit öncesi kasıtlı hata gerçek native sınıra ulaşıp rollback oldu; tam önce/sonra hash eşleşti. Commit edilmiş aynı UUID/body tekrarı `REPLAY_NOOP`; farklı body `RECOVERY_UUID_BODY_CONFLICT`, ikinci commit etkisi0.
- Yazıcılar kapandıktan sonra22bağımsız SELECT/0yazma kontrolü geçti. Korunmuş16hesap,224no-op ve159hassasiyet kapsamı ayrıca kontrol edilmişti.

Bu kanıtın kapsamı izole Aşama5 kopyasıdır. Otomatik bütün geçmiş geri alma, sonraki gerçek hareketleri silen restore veya LIVE rollback kabulü değildir. Uygulama geri alınacaksa batch before/after-image + mevcut native değer karşılaştırması gerekir; sonraki değişiklikte ilgili alan ayrılır. Aktif DB'ye otomatik restore/reset veya eski inverse çağrısı yapılmaz.

## Yeni yedek: VERIFYONLY ile restore ayrımı

[10 Ekim final hazırlığı](../2026-10-10-final-preparation/README.md) DB02 için 13:58 UTC'de 9.204.334.592 byte COPY_ONLY/CHECKSUM yedek ve VERIFYONLY sonucu kaydetti. **Bu yeni yedek restore edilmedi.** Araç receipt SHA256/koşullarını ve yedek dosyasının varlık/boyutunu okur;9,2GBdosyanın SHA256'sını yeniden hesaplamaz. `sha256Recomputed=false`, `restorePerformed=false` açık kalır. Eski gerçek restore bu yeni yedeğe aktarılmaz.

Yeni restore için yeterli disk alanı, ayrı hedef dosyaları/veritabanı, exact yedek kimliği ve sonradan oluşmuş yerel hareketlerin korunma planı gerekir. Bu teslimde yeni backup/restore yapılmaz. Önceki satır sayısı/checksum kanıtı bütün veritabanının byte eşitliği değildir.

## Kurulum ve final geçişte uygulanacak sıra

1. Kullanılacak release/source ve ayrı DB hedefi exact manifestle sabitlenir; çalışan TEST125/DB02 korunur.
2. Salt okunur denetim çalıştırılır; değişmiş paket/hedef/yabancı süreç varsa kurulum yapılmaz.
3. Kullanılacak personel, İlker ve muhasebe kimlikleri mevcut rollerle doğrulanır; eksik kimliğe rol/parola uydurulmaz.
4. UNKNOWN belge, gerçek kasa/banka açılışı ve hesap-döviz kapsamı işletme kararıyla çözülür; TRY/USD/EUR ve B/A ayrı kalır.
5. İnsan mağaza turu ve gerçek Zebra optik/personel devri kabulü tamamlanır; teknik test insan PASS sayılmaz.
6. Kesim günü Vega yazıcı/kuyrukları açık işletme kararıyla durdurulur; T0/T1 kesin tarih/kapsamı kaydedilir. Şimdiki okumalar T1 sayılmaz.
7. Güncel yedek ayrı hedefte restore edilip bağımsız kritik tablo/journal/şema ve normal okuyucu kontrolü yapılır; aktif DB üzerine restore edilmez.
8. Mevcut batch kaynak katkıları ve sonraki yerel/TEST etkileri ayrılır; yalnız kaynak T0→T1 farkı kayıtbazında hesaplanır.
9. Kimlik/birim/döviz/hold/CAS engeli olan kayıt ayrılır; kesin alt kapsam mevcut transaction/replay/inverse yöntemiyle uygulanır.
10. Bağımsız native/API mutabakatı, ikinci-etki0 ve normal ekran kontrolünden sonra ayrı LIVE kararı alınır. Şimdilik bu adımlar icra edilmez.

## Kanıtı eksik kalanlar

| Madde | Kanıt / somut kalan |
|---|---|
| C13 Windows başlangıç | Hazırlanmış kaynak, gerçek boot/S4U/yeniden açılma sonucu değildir; etkinleştirme ve fiziksel kabul ayrı |
| C14 kurtarma | Eski restore/inverse kanıtlı; yeni9,2GByedek restore ve operatör ERP-UA22 sonucu eksik |
| D07 finalT1 | Freeze/soncapture/kayıtbazı mutabakat ve ayrı LIVE onayı yok |
| Günlük işletme kapsamı | 18 UNKNOWN belge;39native kasa/banka kaydında gerçek açılış otoritesi0;8kişi/hesap bağı eksik |
| Teknik günlük görünüm | HOME/profile günlük erişimi, mevcut sayım çıkış korumasının etkin paketi ve okuyucu hız regresyonu root teknik audit kapsamındadır |
| İnsan/cihaz | Geniş personel/İlker turu, sıfırlı gerçek optik etiket/otomatik Enter ve eğitim kabulleri bekler |
| GitHubCI | Hesap ödeme/harcama engeli; yerel kontroller CIyeşil yerine gösterilmez |

49unique finish yaprağı /9tamam /39kısmi /1açık mevcut auditten kullanılır; yeni satır veya insan PASS üretilmez. D10'un dar onaylı TEST committed rollback kabulü korunur ve yeniden yapılmaz. Yeni cari/stok/fiyat/maliyet/karantina yazması, ücretliAI/gerçekWhatsApp, CRM değişikliği, main merge veya LIVE/T1 yoktur.
