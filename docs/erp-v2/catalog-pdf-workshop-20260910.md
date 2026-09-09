# PDF katalog atölyesi — 2026-09-10

Kullanıcı isteği: katalog modülünü seçilen ürünleri farklı düzenlerde PDF hazırlamaya odakla.

## Davranış
- catalog-list çalışma alanı CatalogPdfScreen açar; eski CatalogListScreen dosyası ve kayıtlı kataloglar silinmedi. Mesajlaşma yolları değiştirilmedi/çalıştırılmadı.
- Mevcut yetkili fetchVegaProducts GET /api/vega/products sözleşmesi; activeOnly, with-image, 48 satırlık sayfalar, arama. Eski SQL katalog overview üzerindeki TOP80 ve boş maxPrice=0 sınırı yeni PDF akışında kullanılmaz. Legacy SQL ekranı ayrıca düzeltilmiş sayılmaz.
- Sayfa/arama değişiklikleri seçimi korur; görünür sayfa toplu seçim, tekil çıkarma, yukarı/aşağı sıralama; ürün kodu veya marka sıralaması.
- Vitrin 1, İkili 2, Klasik 4, Kompakt 9 ürün/A4; başlık, alt başlık, isteğe bağlı kapak, fiyat ve stok.
- PDF için DB taslağı/müşteri gerekmez. Seçim bellektedir; tam sayfa yenileme/modülden ayrılma sonrası kalıcı kayıt vaat edilmez.
- Sadece kimliği doğrulanmış ürün projeksiyonu; maliyet/müşteri alanı yok. Fiyat ancak pozitif tutar ve TRUSTED/ERP_SALE_UNIT para birimi kanıtıyla gösterilir; bilinmeyen fiyat teyit etiketi; kur dönüşümü/karma para toplamı yok. Stok kart miktarıdır, rezervasyon düşülmüş kullanılabilir stok değildir.
- Ürün görselleri contain ile kırpılmadan yerleşir. Eksik/bozuk/zaman aşımındaki görsel açık etiketle kalır. Önizleme görseller hazır olana kadar baskıyı kapatır; ayar/seçim değişikliği eski önizlemeyi iptal eder. Mobil önizleme ölçeklenir, A4 baskı ölçeği değişmez.
- PDF kaydet / Yazdır tarayıcının yazdırma penceresini açar: PDF olarak kaydet, A4, kenar boşluğu yok ve tarayıcı üst/alt bilgileri kapalı. Doğrudan sunucu PDF indirme veya native OS diyalogu otomasyon kanıtı yok.

## Kanıt
- 11 yeni birim testi: 97 seçilen ürün dört düzende eksiksiz/tekil, son sayfa, kimlik ve görsel URL sınırları, para birimi güveni, HTML escape, boş seçim.
- Web ticaret regression pack PASS; 187 web kaynak kökü typecheck 0; web ESLint PASS; Vite build PASS (mevcut büyük bundle ve lucide use-client uyarıları).
- Gerçek salt okunur API: 923 görselli aktif ürün, ilk iki 48 satırlık sayfa, sıfır kesişme; filtre with-image doğrulandı.
- Ayrı loopback örnek sunucu: gerçek ERP'den alınmış ilk 100 güvenli ürün alanı; gerçek fotoğraflar. UI 49 ürün seçimini sayfa ve sonuçsuz aramada korudu; kompakt önizleme 6 sayfa; düzen değişimi eski preview kaldırdı. 1440/1024/390 dış taşma yok, browser pageerror yok.
- Aynı HTML üreticisinden A4 PDF: 10 gerçek ürün/fotoğraf her düzende; Vitrin10, İkili5, Klasik kapak dahil4, Kompakt2 sayfa; her ürün kodu ve 10 image object kontrolü, sayfa görselleri incelendi. Native PDF kaydet diyalogu ayrı manuel kabul kalemi.
- Kaynak koruma: 66 depo, 2182 dosya, önceden onaylı6 menü istisnası, izinsiz değişiklik0.
- İndeks full8747 node/27698 edge, ilgili5 dosyada kayıtlı parse sorunu yok; metadata_changed sinyali doğrudan kaynakla telafi edildi. Cross refresh3 edge, canlı servis kanıtı değildir. API/backend sözleşmesi değişmedi; diğer tüketicilerde yeni zorunlu uyarlama yok.

Kanıt: Development OS audit/commerce-no-messaging-20260908/catalog-pdf. Örnek PDF: bu worktree output/pdf/katalog-{vitrin,ikili,klasik,kompakt}.pdf. Önizleme http://127.0.0.1:54473/temp/catalog-preview.html (100 ürünlük örnek).

## Açık sınır
Canlı ERP henüz değiştirilmedi; sadece izole aday. Merge/push/deploy yapılmadı. Yeni ekran eski kayıtlı taslakların yönetimini sunmaz; bu kayıtlar korunur. Nihai canlı auth + gerçek PDF kaydet kullanıcı kabulü deployment sonrası ayrıca gerekir. Genel beş proje hedefi IN_PROGRESS.
