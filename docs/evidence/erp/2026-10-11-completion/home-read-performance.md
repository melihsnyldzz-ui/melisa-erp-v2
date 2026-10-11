# B01 — günlük Ana Sayfa okuma süresi

11 Ekim 2026. ERP-COMPLETE01 kapsamında yalnız salt okunur HOME yolu düzeltildi. Günlük ticari kapsam genişletilmedi; TEST125, DB02 kaynağı, roller, aktarımlar ve karantina korundu.

## Gerçek önce / sonra

Normal mevcut İlker16 ve personel15 oturumlarıyla aynı DB02 üzerinde eski immutable8ca0122 okuyucusu ve yeni okuyucu dönüşümlü üçer kez çalıştırıldı. Sabit saat kullanılarak iki sürümün tüm DTO alanları birebir karşılaştırıldı. Ayrı normal API raporlarıyla satış/tahsilat/ödemenin4 kapsamı tutar ve kayıt sayısında exact8hane uydu; ham ticari bilgiler private alandadır.

| Normal rol | Önce üç okuma, ms | Sonra üç okuma, ms | Medyan önce → sonra |
|---|---|---|---|
| İlker16 | 2768 / 2860 / 2795 | 1783 / 1763 / 1715 | 2795 → 1763 ms |
| Personel15 | 2870 / 2886 / 3000 | 1688 / 1682 / 1779 | 2886 → 1688 ms |

Yeni paket üzerinden gerçek HTTP örnekleri İlker16 **1759/1695/1736ms**, personel15 **1702/1657/1717ms**. Bu süreler native doğrulama dahil HOME isteğidir; ekran çizimi, katalog veya ilk uygulama açılışı değildir. Bir saniye hedefi henüz sağlanmadı.

## Dar düzeltme ve korunmuş kontroller

Gerçek stored context tanımı her çağrıda koşulsuz `usp_stage4_copy_ready` çalıştırıyor. Genel okuyucu bunu dışarıdan da çağırdığı için HOME'da iki tam kontrol vardı. Yeni server-only `readHome` yalnız DB02/inbound/read-only, gerçek server WeakMap v4/v5 kaydı ve incelenmiş ham context hash'i için dış tekrarı kaldırır. JSON/client bayrağı veya TTL cache yoktur. v6/unknown/unregistered kapsam eski yolu kullanır; tanınan kapsamda drift hata verir, eski yola sessizce dönmez.

Her istekte aynı SERIALIZABLE transaction ve Shared applock altında güncel profil, bütün8v4+3v5 modül/registry pinleri ve iki immutable trigger hash/enabled durumu tekrar doğrulanır. Context içindeki **tam READY**, güncel aktör/izin/readProof, iki trusted FK ve commit öncesi DB kimliği korunur. Genel `read/context/mutate` ve işlem matematiği değişmedi. İlker/personel yetkileri genişletilmedi.

Native A/B ölçümünde dış READY6→0 çağrı, context her sürümde6 çağrı; yeni metadata preflight10–16ms, context1533–1638ms, aggregate15–52ms. Gerçek SQL meta transactionCount1/state1/isolation4/Shared doğrulandı. Ticari POST, kalıcı SQL, rol ve korunan servis değişikliği0; mevcut normal giriş/TEST aktör seçimi auth audit üretebilir.

Mevcut5hedefli suite91/91 ve guard/framework4suite46/46 PASS; bu örtüşebilen gruplar toplanmaz. Bağımsız kaynak incelemesi GO. Drift, fullREADY/FK/rol/readProof/kimlik/lock reddi, yazma/journal engeli, v6 fallback ve exact SQL allowlist hedefli testlerle kontrol edildi; testlerdeki emülasyon gerçek SQL bozulması veya insan kabulü diye sunulmaz.

## Paket ve GitHub

Application source **181de5ac4102904104c056c9c270b9c6a7ef990d**, immutable paket **CANONICAL-COMPLETE-TEST-20261011-181de5a**, manifestSHA **c439b971ab1e71f4dd96a5f10134713ed9a65a21972e4f187a7c63742de47166**. Tam BUSINESS build/baseline,1737dosya/0hashfarkı/25kapalı transitive kaynakpini doğrulandı. Native proof'un4backend dosyası byte eşit;2starter dosyasında yalnız LF/CRLF farkı doğrulandı. PaketHTTP'nin6 DTO'su eski sonuçla bütün iş/izin alanlarında eşit; yalnız okuma zaman damgası karşılaştırma dışında tutuldu.

Yalnız geçici loopback5264 PID35248 güncellendi; mevcut cihazUSB5234→5264 bağlantısı korunur. Korunan16port/PID/adres kaydında0fark; TEST125/ortak API4184/native4186/Hub5234/CRM ve sabit boot değiştirilmedi. Host5264 normal masaüstü oturum URL'si diye sunulmaz; ortak API CORS genişletilmedi. Normal ERP HOME cihaz görseli önceki politika reddi nedeniyle NOT_RUN kalır, alternatif yoldan aşılmadı.

İki normalrol için6paket HTTP okuması ve actorsız401/POST405/yabancıOrigin403/query404/geçersiztoken401 tamamlandı. Protected config/API aynı. PR23 source181de5ac için CI38127901606/38127899434 requiredjob0steps; annotation hesap ödemesi/harcama limiti nedeniyle başlamadığını doğruladı. Yerel build veya testler CI yeşili diye sunulmaz. Belge teslim commit'i application source'dan ayrıdır.

Private kanıtlar: `home-ready-dedup-2026-10-11T091649254Z.json` SHA256 **9089eae3ac550e448cd91e9564e2ee71e795b3ac83ad373fdc574d585896867d**,4API `-comparison.json`, `packaged-home-ready-dedup-http-2026-10-11T092027836Z.json` SHA256 **6258d75723d962f99f953682c7b8922b59bbff0ccd69cb8cbc41d85cbed554a6**, `home-ready-dedup-package-equivalence.json`, `home-ready-dedup-package-final-verification.json`, `home-ready-dedup-protected-ports-after.json`. Ham makbuzlar GitHub'a alınmadı.

## Katalog ve kalan gerçek kapsam

Katalog için ayrı gerçek source/HTTP üçer örnek ölçüldü: first50 medyan2069/2021ms,next50 1893/1876ms,tamkod1858/1792ms,başta sıfırlı doğrulanmış barkod1767/1688ms,kart+fiyat1515/1523ms. Kimlik1ms, sıcak fiyat istisnası53–86ms; bağlı katalog procedure1414–2345ms baskın. Başlangıç sınıflandırması13676ms ayrı kaydedildi, sayfa sürelerine eklenmedi. Katalogda tek READY var; HOME çift çağrı düzeltmesi kataloğa genellenmez. Private faz makbuzu SHA256 **feb8adc83b83390d67ed48df067f99ceb5b69edfb074b5c5765e1ef0c1c2da4d**.

**Sıradaki tek teknik iş: katalog procedure içindeki maliyeti ayırıp güvenlik sınırlarını koruyarak azaltmak.** Sonlu iki ürün/TRY günlük akışını bütün işletme kapsamı yapma işi ve kalan gereksinimler ayrıca açık. Dört teslim bütünü tamamlanmadı; ERP-UA32 insan kabulü bekliyor,49/9/39/1 aynı. Mevcut cihaz/APK, dört eğitim videosu ve geri dönüşlü hazırlık kanıtları korunur; Vega/LIVE/T1/main/gerçek mesaj/ücretli AI yok.
