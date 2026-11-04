# ERP1455 — işlev ve ekran incelemesi

Görev: ERP-FULL-FUNCTIONAL-GUI-AUDIT-20261102-1455. Mevcut ERP-DEC-086 / 49 özgün yaprak korunur. Bu kayıt inceleme kanıtıdır; yeni bitiş planı veya kabul listesi değildir.

## Gerçekte kullanılan ortam

Aktif PR54 worktree'sindeki üretim `createWorkSales/createBusinessSalesRead`, `createWorkReceiving`, `createWorkCatalog`, müşteri/tedarikçi, alış, tahsilat, sayım, alış iadesi, rapor ve sistem controllerları kendi geçici loopback uygulamasında çalıştırıldı. Session bağımlılıkları mevcut test DTO'larından sentetik adapter ile verildi; üretim doğrulayıcıları kaldırılmadı. İlk normal `ornek-akis.html` girişi oturum/backend bulunmadığı için kapalı kaldı. Ayrı genel `demoOperations` sayfası normal ekran kanıtı sayılmadı.

Geçici origin dışına bağlantı CSP ile kapalı; `/api/` ağ istekleri 503 döner. Adapter okuması JavaScript bağımlılık enjeksiyonudur, gerçek oturum veya SQL değildir. Ticari POST uygulanmadı. Cihazda hazırlık taslakları yalnız yeni geçici originin tarayıcı deposuna yazıldı. Eski journal, UUID/body, runtime, veri, roller, OS görevleri ve eski iki PowerShell WIP dosyası korunur. Görünen tarih/paket/bakiye/katalog sayıları fixture değeridir; güncel Vega veya kurulu TEST kimliği değildir.

## Ekranda bulunup düzeltilen kusurlar

1. **Rapor bağlantısının ilk hata sonrası toparlanması — B07/C15:** İlk context 503'ünden sonra Yenile yalnız sayfayı okuyordu; marka/tür seçenekleri kayıp kalıyordu. Context doğrulanana kadar tür sekmeleri ve sayfa yükleme kapalı; Yenile context'i tekrar okur. Aynı anda ikinci context isteği engellenir. Tarayıcıda aynı kesinti–düzelme–Yenile senaryosu tekrarlandı ve seçenekler geri geldi. Üç yeni test; önceki iki test eski kaynakta başarısızdı.
2. **Kişisel isimle sayım taslağı — C10/C11:** Yetkili taslak rolünün kişisel `displayName` değeri, örnek modelin rol listesine veriliyordu; düğme açık olmasına rağmen taslak açılmıyordu. Kayıt etiketi ile taslak çalışma rolü ayrıldı. Mevcut `canDraft`, counter/office whitelist, revision, replay ve native onay sınırları aynı. Başlatma/düzenleme/gönderimde kişisel ad korunur. Aynı kişisel isimle taslak açıldı, ürün satırı eklendi, kapat–yenile sonrası satır ve isim korundu; stok değişmedi. Serbest adın rol veya onay kazandırmadığı yeni negatif testlerle doğrulandı.

## 17 alanın bu turdaki kanıt sınırı

| Alan | Bu tur gözlenen sonuç | Kalan / sınırlama |
|---|---|---|
| Ana Sayfa | Üretim controllerı, ayrı döviz ve bilinmeyen tutar/boş iş görünümü | Gerçek bugünkü kaynak ve görev geçişlerinin tamamı doğrulanmadı |
| Ürün & Stok | Liste, detay, sıfırlı/çoklu barkod, fiyat/birim, boş ve 403 yanıtı | Gerçek SQL, fotoğraf indirme ve kaynak mutabakatı bu tur yok |
| Müşteriler | Kart açma, ayrı USD/EUR, bilinmeyen iletişim | Geçmiş adapterı eksik; genel kart oluşturma/vade/limit bağlı değil |
| Tedarikçiler | Kart, bilinmeyen/gerçek sıfır ayrımı; sentetik ödeme/borç geçmişi | Genel hareket adapterı eksik; kaynak kimliği/bakiye mutabakatı yok |
| Satış | Gerçek reader controllerı, müşteri/hesap, iki ürün, doğrulama, sakla–yenile–aç; sıfır adet reddi | Native taslak/finalize/iptal ve gerçek satış yok |
| Satış fişleri | Üretim bağımsız fiş listesi açıldı | Gerçek belge kalıcılığı / yazma yok |
| Mal Kabul | Yerel taslak, satır, yenileme, bilinmeyen barkod ve 403 | Ortak kayıt, İlker onayı ve native stok etkisi bu tur yok |
| Alış | Üretim alış controllerı, kabul seçimi ve tutar alanları | FX adapterı eksik; genel fatura/finalize yok |
| Tahsilat | Fiş seçimi, ayrı fiş kalan/cari bakiye ve hesap/tutar alanları | Önizleme/yazma/native finans yok; ad bilgisi eksik fişte belirsizlik korunur |
| Tedarikçi ödeme | Desteklenmeyen geçici origin açıkça reddedildi | Desteklenen izole hedef olmadan tam GUI denenmedi; guard gevşetilmedi |
| Kasa / banka | Kaynakta sabit altı hesap ve tarihli deneme profili incelendi | Tam GUI/native açılış yok; genel işletim kapsamı açık |
| Sayım | Üretim rendererı ve yeni kişisel ad düzeltmesi; taslak yenileme | Native gönderim/onay/ters stok etkisi yok |
| İade | Üretim tedarikçi iade ekranı, kaynak alış satırı/döviz/miktar | İade/ters kayıt yazması ve müşteri iadesi bu tur yok |
| Onaylar | Kaynak/özgün bitiş bağı incelendi | Bağımsız normal auth/backend consumerı hazır değil; GUI DENENMEDİ |
| Raporlar | Üretim boş/unknown/döviz görünümü; kesinti toparlama düzeltmesi | Gerçek DB/CSV dosyası veya bütün rapor türlerinin işletme kabulü yok |
| Ayarlar / yedek / başlangıç | Üretim salt okunur ekran; fiziksel kabul/backup/reboot bilinmiyor ayrımı | Gerçek yedek/restore/Windows logon yapılmadı |
| El terminali | Kaynak ve ortak controller bağı mevcut | Bu tur fiziksel Android/Zebra/oturum denenmedi; PASS yok |

14 üretim ekranı/consumerı tarayıcıda gözlendi; ödeme bunlardan biri olup **BLOCKED** sonucudur. Diğer üç alanın tamamlanmış GUI sonucu yok. Açılmış sayfa uçtan uca ticari PASS değildir.

## Öncelikli kalanlar

- Genel günlük kasa/banka consumerı tarihli örnek profil ve altı hesapla sınırlı; hazırmış gibi ilan edilmez (C08/B06).
- Genel çok satırlı dövizli alış yerine dar mevcut FX kabul profili var; gerçek işletim kapsamı açık (C03/B05).
- Vade/limit/risk alanları DTO'ya bağlı değil; kayıtsız vade tahmin edilmez (C05).
- Müşteri kartı iletişim düzenleyicisi telefon/şehir/ülke ile sınırlı; genel kart oluşturma/düzenleme ayrı eksik (C06).
- Ödeme/kasa için desteklenen bağımsız TEST hedefi, onaylar ve terminal için normal session consumerı gerekir. Bu tur bu sınırlar değiştirilmedi.
- Gerçek DB integration, stok/cari/kasa etkisi, fiziksel cihaz, geniş insan kabulü ve LIVE ayrı durur. İnsan UA'ları BEKLİYOR.

## Test, inceleme ve görsel kanıt

- Rapor + sayım hedefleri: **51 PASS / 0 skip**. Yeni rapor26 ve kimlik3 testleri buna dahildir; ayrı toplam gibi eklenmez.
- Geniş mevcut Sites çevrimdışı taraması: **1.314 test, 1.313 PASS, 1 FAIL, 0 skip**. Tek hata değişmeyen `simpleWebRelease.test.mjs` Windows PowerShell child isteğinin `CI_OFFLINE_BOUNDARY` tarafından reddidir. Guard/timeout/workflow/skip değiştirilmedi; bu sonuç tam yeşil diye sunulmaz.
- Aynı offline guard ile Sites build: **7,30 s PASS**. Genel web-admin build tekrar denenmedi.
- Bağımsız salt okunur kaynak incelemesi: Reports ve Count için SOURCE GO, P1/P2 yok. İncelemeci testleri veya gerçek SQL'i çalıştırmadı.
- Yeni run ekranları private `C:\Sirket\ERP\evidence\ERP-FULL-FUNCTIONAL-GUI-AUDIT-20261102-1455` altında. `02–17`, `18b`, `19b`, `20–30` numaralı PNG'ler ve AX metinleri. `18/19` boş görüntüleri browser'a yanlışlıkla Node-only fixture import eden **test assembly hatasıdır**, üretim kusuru veya PASS kanıtı sayılmaz; düzeltildikten sonra `18b/19b` alındı.
- 390 katalog ve 1024 satış gerçek iframe CSS viewport'unda gözlendi; bu fiziksel cihaz veya tüm ekranlarda 1440/1024/390 kabulü değildir. Genel otomatik erişilebilirlik uygunluğu iddia edilmez.

Kurulum/paket/runtime değişmedi. Exact yeni source/CI sonucu PR54 ve STATUS'ta ayrı kaydedilir. ERP49, önceki kabuller ve sayaçlar değişmez.
