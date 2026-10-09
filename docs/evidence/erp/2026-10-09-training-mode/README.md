# Programı Öğren — Gelen Mal ilk dersi

9 Ekim 2026. Kullanıcının **bağımsız eğitim modu ajanı** talimatı kapsamında yalnız ilk ders teslim edildi. Ana ERP işi beklenmedi veya değiştirilmedi. İkinci ders başlanmadı. Teknik tarayıcı doğrulaması tamam; personelin insan kabulü **ERP-UA-TRAIN01 BEKLİYOR**.

## Aç ve dene

Bu bilgisayarda [Eğitim Modunu aç](http://127.0.0.1:5214/egitim.html). Normal ERP kaynak ekranına **Programı Öğren** bağlantısı eklendi; bu değişiklik TEST125'e dağıtılmadı. Bağımsız adres doğrudan kullanılabilir.

Eğitim, mevcut `createWorkReceiving`, `createWorkPurchases` ve `createWorkSuppliers` ekranlarını kullanır. Rehber açıklamaları, numaralar, sarı çerçeve ve büyük ok gerçek düğmeleri/alanları işaretler. Mobilde **İşaretli alanı göster** düğmesi ilgili alana götürür. Geri, kaldığı adıma dönüş, sayfa yenilemesinden devam ve geçmişi silmeden yeni alıştırma vardır.

## Personelin göreceği beş adım

1. **Gelen Mal ekranını aç.** İşaretli Gelen Mal düğmesine bas. Yeni sayım aç ve eğitim tedarikçisini seç.
2. **Fotoğrafı, kodu ve adedi kontrol et.** Gerçek `2401 BABY AURA` fotoğrafına bak; alıştırmada 2 adet say. Gerçek `4607 BABY ROSE` fotoğrafına bak; alıştırmada 3 adet say. İki ürünü sayımına ekle, adetleri yaz, kaydet ve kontrole gönder. Yanlış adetler gönderilemez; taslak düzeltilebilir kalır.
3. **Mal kabulünün stok etkisini gör.** Sayım göndermek stoğu artırmaz. Kabulü onayla; eğitim stokları `10 → 12` ve `10 → 13` olur. Kabulden faturaya geç.
4. **Bağlı alış faturasını incele.** Kabulü seç; `TSTB-EGITIM-001`, belge tarihi ve kabul edilen 2/3 adetleri gir. Tutarı kontrol et, taslağı kaydet ve kesinleştir. Fatura stoğu ikinci kez artırmaz.
5. **Tedarikçi borcunu gör.** Tedarikçi hareketini aç; kabul → alış faturası → borç artışı bağlantısını incele. Alıştırma borcu 500 TRY olur. Üç soruya doğru cevap vererek dersi tamamla; yanlış cevap açıklanır ve yeniden denenir.

**Veri ayrımı:** İki ürün kodu/adı ve fotoğrafı doğrulanmış mevcut kartlardan kopyalandı. Ürün-fotoğraf kimliği ve SHA-256 kontrol edildi. Tedarikçi **Eğitim tedarikçisi (örnek)**, başlangıç stokları, sayılan adetler ve 100 TRY birim fiyatları alıştırmadır; gerçek şirket alış fiyatı veya tedarikçi borcu değildir. Fotoğraf seed'i ve veritabanı Git'e alınmadı. Ekran görüntülerindeki tutarlar yalnız eğitim verisidir.

## Veritabanı ve süreç ayrımı

- Sunucu: ayrı Node.js süreç, yalnız `127.0.0.1:5214`. 5194/5204 kabul edilmez. Bu portların süreç ve başlama zamanları önce/sonra aynı: [izolasyon kanıtı](isolation-proof.json).
- Veri: `C:/Sirket/ERP/training-mode/data/erp-training.sqlite`, SQLite. SQL Server, Vega, ERP API, dotenv veya provider bağlantısı/import'u yok. Mevcut TEST veritabanları okunmadı/kopyalanmadı/yazılmadı. Satış, ödeme ve diğer ticari endpointler reddedilir.
- Kimlik: `MELISA_ERP_TRAINING_ONLY`, `application_id=1297371726`, şema sürümü 1, bütün şema tanımları ve `quick_check=ok`. Bilinmeyen mevcut dosya salt okunur incelenip değiştirilmeden reddedilir. Yeni dosya exclusive oluşturulur. Bağlı tek DB `main`: [bağımsız salt okunur veri doğrulaması](database-proof.json).
- Her cookie kendi alıştırmasına sahiptir. HttpOnly/SameSite=Strict cookie, CSRF, Host/Origin ve alıştırma kimliği kontrol edilir. Eski sekme, gecikmiş gövde ve eski işlem kimliği yeni alıştırmaya yazamaz. Başlıklı GET/fotoğraf okumaları da eski alıştırmada reddedilir; normal `<img>` yalnız güncel cookie fotoğrafını okuyabilir.
- Kabul tek transaction ile bir stok hareketi; fatura tek borç hareketi üretir. Taslaklar etki yaratmaz. Tekrar aynı UUID/gövde eski sonucu döndürür; farklı gövde veya başka alıştırma reddedilir. Adım atlama, tamamlanan adımı silme ve yanlış sınavla bitirme kapalıdır.
- Tekrar yeni alıştırma açar; geçmiş saklanır. İki tamamlanmış tarayıcı alıştırmasının 12/13 stok, 500 TRY borç, tek stok/tek fatura hareketi ve beş adımı SQLite üzerinden ayrıca doğrulandı.

## Çalışan paket ve doğrulama

Uygulama commit'i `8b904279bddc1b9bced8622bed91880eec767445`; dal `codex/erp-training-mode`. Ana taban `d1d1cfc52d5409fd8b0b135e9e90047187fc7504` / `codex/erp-finish-20261004`. Ayrı PR aynı feature tabanına yöneliktir; main merge/deploy yok.

Çalışan paket `C:/Sirket/ERP/training-mode/packages/TRAINING-20261009-8b90427`; manifest SHA-256 `d608dab682f603f9dcb2cc4804ef9fef0c9e2447bc4ebbcb6728ce7ca6d778cf`. Kaynak worktree canlı servis olarak kullanılmıyor; yeni bağımsız paket başlatıldı. Önceki eğitim DB korundu; şema değişikliği yapılmadı. TEST125 ve LIVE paketleri korunur; bu görevde güncel LIVE sürümü incelenmedi.

| Kontrol | Sonuç |
| --- | --- |
| Bağımsız backend / SQLite / HTTP güvenlik / eski sekme / gecikmiş body | 11/11 PASS, CI offline guard altında geçici dosya ve loopback port 0 |
| ERP workflow, eğitim adapter ve gerçek ekran sözleşmeleri | 699/699 PASS, offline guard; eski katalog/mal kabul sözleşmeleri korundu |
| Sites workflow production build | PASS; mevcut bundle boyutu/karma import uyarıları var |
| Masaüstü Edge Chromium 1440×1000 | Beş adım, fotoğraf, stok, borç, yanlış/doğru quiz, geri, tekrar ve yenileme PASS |
| Mobil Edge Chromium 390×844 / touch emülasyonu | Aynı tam akış PASS; yatay taşma yok |
| Tarayıcı hata/dış istek | 0 JavaScript hata, 0 başka origin isteği |
| Bağımsız read-only SQLite geri okuma | İki alıştırma stok 12/13, borç 500, tek hareketler ve korunan geçmiş PASS |
| Bağımsız reviewer | Üç P2 düzeltildi; kalan P0/P1/P2 yok. İnsan kabulü değildir. |
| Yerel Gitleaks uygulama commit taraması | İki uygulama commit'inde gizli bilgi bulunmadı; redacted rapor private |
| GitHub CI | [Uygulama head koşusu](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37920477835) başlamadan FAIL: hesap ödemesi/harcama limiti engeli. CI yeşil değildir. Son PR head'i ayrıca kontrol edilir. |

[Tarayıcı sonuçları](browser-results.json), [teknik özet](technical-summary.json). Mobil kontrol fiziksel telefon/Android kabulü değildir. Eğitim adresi bu bilgisayarın loopback adresidir; telefonun kendi `127.0.0.1` adresinden erişilemez. Personelin gerçek kullanım sonucu bekliyor; bu teslim LIVE onayı değildir.

Tekrar üretme: [sunucu kurulumu ve seed sözleşmesi](../../../../apps/training-server/README.md), [tarayıcı kabul yürüyüşü](../../../../scripts/training/browser-acceptance.mjs). Tarayıcı yürüyüşü yalnız bu dersin doğrulanmış gerçek iki-kart seed'ini ve ayrı 5214 eğitim sunucusunu kullanır; yeni eğitim alıştırmaları oluşturur. Playwright modülü `TRAINING_PLAYWRIGHT_MODULE` ile veya standart `playwright` kurulumu ile sağlanır.

## İlk dersin ekranları

| Adım | Masaüstü | Mobil |
| --- | --- | --- |
| 1 — Gelen Mal ekranını aç | [Ekran](desktop-step1.png) | [Ekran](mobile-step1.png) |
| 2 — Gerçek ürün fotoğrafları ve sayım | [Ekran](desktop-step2.png) | [Ekran](mobile-step2.png) |
| 3 — Kabul ve stok karşılaştırması | [Ekran](desktop-step3.png) | [Ekran](mobile-step3.png) |
| 4 — Bağlı kesinleşmiş alış faturası | [Ekran](desktop-step4.png) | [Ekran](mobile-step4.png) |
| 5 — Tedarikçi borcu ve sorular | [Ekran](desktop-step5.png) | [Ekran](mobile-step5.png) |
| Ders tamamlandı | [Ekran](desktop-completed.png) | [Ekran](mobile-completed.png) |

İlk ders sonunda duruldu. Sonraki dersler ve ana ERP'ye birleştirme ayrı kullanıcı talimatı bekler.
