# B02 + A01 — normal stok ekranı TEST kabulü

5 Ekim 2026. Teknik TEST hazırlığı tamam; personel/günlük işletme kabulü bekliyor. B02 ve A01 🟡. Fotoğraf A03, genel ürün yazması, güncel Vega deltası, terminal ve LIVE kabulü bu kayda eklenmez.

## Kullanıcının açacağı ekran

[Ürün & stok](http://127.0.0.1:5194/is-akisi-taslagi.html#stock), [üç genişlik kontrolü](http://127.0.0.1:5194/responsive-acceptance.html). Mevcut TEST ADMIN açılışı korunur; `Kullanıcı değiştir` gerçek kayıtlı hesapla kabul içindir.

1. Ürün adıyla `BATTANİYE`, kodla `00001 BEBİTOF BABY` arayın; kartı açıp stok, birim ve barkodu kontrol edin.
2. Kesin barkoda `0000000000000` yazın: tek sonuç. İlk sıfırı kaldırınca aynı ürün bulunmamalı. Stok ve aktif/pasif filtrelerini deneyin.
3. `1052 LAY LAY` kartında karantina nedeni, işlem kapalı ve bilinmeyen birim görünmeli. `2978 MY MİO` birim/çarpanını doğrulanmış ADET×1 gibi göstermemeli.
4. TEST ADMIN/İlker fiyat ve maliyeti kart detayında görebilir; salt okunur kullanıcı stok kartını açar, finans alanlarını görmez. Bilinmeyen ile gerçek sıfır farklı kalır.
5. 1440/1024/390 genişlikte arama, kart aç/kapat ve sayfalama deneyin; personel kendi günlük kartlarıyla kullanılabilirliği onaylasın. Fiziksel scanner/terminal kabulü ayrıca açıktır.

## Gerçek veri ve sınırlar

- Katalog ayrı kapsamlarla **16.622 kabul edilmiş açılış + 54 karantina + 3 açık sentetik TEST = 16.679 kart**. Karantina kartlarının gösterilmesi onları migration veya ticari işlem açısından kabul edilmiş yapmaz.
- Kod/ad, native TEST stok, gerçek barkod ve kaynak bağı okunur. Kaynak kabulü **30 Eylül 2026**; okuma anındaki TEST stok ayrı belirtilir. Güncel Vega/LIVE stok bağlantısı değildir. 71 yeni/341 değişmiş ürün ve74 cari delta uygulanmadı.
- Kabul edilmiş kartların16.536 birimi ADET/faktör1 kanıtlı;86 kartta birim/faktör/main-unit kanıtı eksik ve nullable. Karantina kartlarına birim/fiyat/maliyet doğruluğu yakıştırılmaz.
- Finans `product.view` girişinden bağımsızdır; gerçek DB `purchase.view` ile yetkili detayda typed tür/birim/kademe/döviz ve exact8 değerler görünür. Liste finans payloadını yüklemez. Alış fiyatı maliyet değildir; NULL bilinmiyor, gerçek0 sıfırdır.
- 301986 sentetik kartı güncel immutable C09 fiyat sürümleriyle okunur: USD alış1,34567890; EUR bilinmiyor; TRY satış2,34567890. Stok31. Bu değerler Vega açılış fiyatı değildir.
- Kabul edilmiş native kartlarda kayıtlı fotoğraf0; ekran `Kayıtlı ürün görseli yok / doğrulanmadı` gösterir. Yeni fotoğraf bağlanmadı. Gerçek kaynakta yinelenen barkod değeri0 bulundu; çoklu eşleşme davranışı sentetik kaynak testidir, gerçek çoklu-barkod kabulü değildir.

## Normal ekran ve teknik kanıt

Normal ekran TEST ADMIN ve gerçek TEST14 salt okunur hesapla denendi. Ürün adı/kod araması, baştaki sıfırlı barkod, gerçek kart açma/kapatma, karantina nedeni ve boş sonuç görüldü. TEST14 finansı görmeden kartı açtı; TEST ADMIN kabul edilmiş kartın maliyet/typed fiyat ayrıntısını gördü. Gerçek API'de27 okuma/olumsuz kontrol geçti: sayfa, stok işareti, aktiflik, literal arama, exact barkod, bilinmeyen birim, hold, C09 sürümü, finance ayrımı, anonim401, invalid400, bulunamayan404 ve yazma405. Ticari yazma0.

Hedefli kaynak kontrolleri: API10, stok UI9, gerçek dispatcher4, SQL14. Bağımsız SQL/API/UI incelemesi tamam. Kaynak hatası/retry ve geç sonuç/oturum yarışı sentetik kaynak testleriyle doğrulandı; gerçek servis kesintisi yaratılmadı ve hata ekranı için gerçek işletme PASS iddiası yok.

Gerçek iframe1440/1024/390 ölçümleri client=scroll1427/1011/377; yatay taşma0, işlem düğmeleri CSS44px/ölçüm43,992px. Mobil gerçek kart detayı377 genişlikte taşmadı. Son34pakette mobil seçici doğru `Ürün & stok` değerini gösterir. Dış ekran görüntüleri ölçeklidir; fiziksel cihaz/personel kabulü değildir.

İlk listede tekrarlanan alias tam taramaları gerçek Statistics IO ile bulundu. Runtime tek alias taraması ve geçici indeksli pair/product/source sayımları kullanır; duplicate/orphan/NULL sahiplik semantiği korunur. Aynı25satır listesi önce20.560ms, son SQL ölçümü3.891ms; gerçek27API denemesinin en yavaşı3.476ms. Bunlar ölçülen TEST süreleridir, her yükte süre garantisi değildir. Liste fiyat okumaz; yetkili detay fiyatın kendi bağlarını denetler.

## SQL ve korunmuş durum

Yalnız yeni `dbo.usp_read_stock_products` owner okuyucusu ve iki mevcut TEST principal'a dar EXECUTE kuruldu. Mevcut ticari tablolar/writer/guard/index veya DB rol yetkileri değiştirilmedi. SERIALIZABLE transaction, gerçek hedef/aktör/rol,20 eski definition pin, kaynak mühür ve returned-row binding doğrulamaları korunur. Fiyat detayı C09 immutable sürüm kanıtını kullanır.

SQL Server'ın sakladığı `CREATE   PROCEDURE` başlığı geri alınan gerçek derlemeyle doğrulandı; expected hash ham CREATE OR ALTER metninden türetilmez. Final SQL artifact SHA256 `F949F4173A81AE63AF75C9416304CAC435BBB57ACE57A69F8837EC2BC90F10CD`, gerçek owner tanımı `B39AF5827F604777DAC4EC91F074038AC7A459810837DBF2AD1C163937EE3E09`. Strict önceki2CD tanımından kontrollü UPGRADED1, replay NOOP0; dış transaction rollback ve iki gerçek rol DTO kontratı geçti. Eski body/grant drift sessiz onarılmaz.

28 eski ticari tablonun mevcut tüm satır digestleri ve diğer136 izin aynı. Tam SQL metadata okuyucusuyla bütün489 eski nesnenin tanım/disabled/FIRST özellikleri aynı, toplam490 (tek yeni stock reader). Kısa/truncated metadata çıktısı489 nesne kabulü yerine kullanılmadı. Veri snapshotları runtime33 kabulünden sonra alındı; final34 yalnız mobil seçici/dispatcher test değişimidir, API/SQL/stock modül kodları aynı. Korunmuş C03/C07/C09 işlerini yeniden ticari işlemle ispatlama yapılmadı.

## Çalışan paket ve GitHub

- Son çalışan **paket34**, `C:\Sirket\ERP\releases\CANONICAL-FINISH-STOCK-TEST-20261005-34`; app/source `fab3e1dbeae8fca83110d20b3a04ac88a52da8b5`,1248manifest dosyası ve16977 bağımlılık dosyası bytehash doğrulandı. Stok API kabul kaynağı `b3c1bb91261e0eae884240d6f96bd487b2109dc0`; final34 API/SQL/stok UI aynı, mobil seçici düzeltmesi gerçek ekranda ayrıca doğrulandı.
- 5194 web /4144 API /4146 native → `Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01`; native readonly, dış işlemler kapalı, sysadmin/control/LIVE DB erişimi0. Yalnız üç doğrulanmış TEST süreci değişti; LIVE5188/4114/4116 süreç sahipleri aynı. LIVE commit bu işte doğrulanmadı.
- Eski paketler ve önceki launcher kayıtları korunur. Önceki C09paket29 ve TEST ADMINpaket32 kabulleri tarihsel kanıt olarak kalır. Restore/committed uygulama rollback provası yapılmadı; kaynak checkout deployment değildir. Salt okunur başlangıç raporu değiştirilmedi.
- Dal `codex/erp-finish-20261004`, [Draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23). Sourcefab3e1d push37290571595/PR37290576008 quality-build-test/secret-scan dört hostedjobSUCCESS. İzleyen belge head CI ayrıca PR23'ten doğrulanır. Main merge, LIVE deploy, Vega yazması ve credential değişikliği yok.

## Kalan ve sıradaki somut iş

Finish tree49: 🟢5 / 🟡22 / 🔴22. Bu sayım LIVE hazırlık yüzdesi değildir. B02 teknik hazır; personel/günlük kabulü, gerçek fotoğraf, eksik birim/maliyet,54ürün/122cari belirsizliği, delta/cutover/restore ve cihaz açık.

**A03 ilk tek fotoğraf:** salt okunur TEST keşfinde mevcut `vega_product_images` kaydı Vega161167 /8023 CONCEPT ve tek native alias36724 ile eşleşti. İzleyen salt okunur keşifte gerçek TEST data uploads dosyası157308byte, source scriptinde pinnedSHA E3958384A78F3D39EA929DFFC2274CE2210DCC5E29C659335D452700D8BE9067 ile eşleşti; görsel8023CONCEPT olarak incelendi. Normal stock detail36724 RUN06 accepted-opening/verified ve holdfalse döndü. Fotoğraftaki16,90USD eski katalog baskısıdır, ERP fiyatı olarak alınmaz. Sırada yalnız bu doğrulanmış görseli normal kart için dar ve geri alınabilir TEST bağlantısıyla sunmak var; native/UI fotoğraf hâlâ yok. Fuzzy ad/kod benzerliği fotoğraf kabulü değildir.
