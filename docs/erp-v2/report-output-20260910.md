# ERP rapor çıktı kabulü — 2026-09-10

Kod: `31c197c`. İzole commerce adayı; production aktarımı veya gerçek iş verisi yazımı yapılmadı.

## Düzeltmeler

Ortak Excel yardımcısı HTML'i `.xls` adıyla indiriyordu. Kurulu `xlsx` bağımlılığıyla artık gerçek `.xlsx` üretilir. Stok kodu gibi metinler metin, sayılar sayısal hücre olarak korunur; boş değerler sıfıra dönüştürülmez. Formüle benzeyen metin formül olarak çalıştırılmaz. Başlık workbook metadata'sında, kolonlar ve filtre çalışma sayfasındadır. Kaynağın zaten biçimlendirilmiş metin verdiği alanlar metin kalır; bu değişiklik onları tahmini sayıya dönüştürmez.

Blob URL indirme tıklamasından hemen sonra değil 60 saniye sonra bırakılır. Ortak yazdırmada iframe onload ve belgedeki inline script aynı belgeyi iki kez yazdırıyordu. Inline tetikleyiciler kaldırıldı; tek parent tetikleyici kullanılır, iframe `afterprint` sonrasında temizlenir. Liste raporu satır sayısı başlığa alındı; sırf satır sayısı için boş beşinci sayfa oluşturulması giderildi.

## Kanıt

- Yeni 3 ağ kapalı test: gerçek XLSX round-trip, indirme tipi/uzantısı/URL ömrü, tek yazdırma ve afterprint temizliği.
- Web regresyon: 218 smoke kontrolü + 24 Node testi = 242 PASS. Web checkJs: 184 kaynak, 0 tanı. Mevcut lint ve build PASS; mevcut bundle büyüklüğü uyarısı sürer.
- Gerçek ortak UI düğmesi, 123 sentetik satırla Codex uygulama içi tarayıcıdan İndirilenler klasörüne dosya oluşturdu. İndirilen dosya tekrar okundu: 123 satır, `0000`/`000122` metin kodları, sayısal sıfır, boş fiyat, TRY/USD, Türkçe metin PASS. Dosya 16890 byte; hash `b5a201e2e89f26d5d237f2ba721e0d50e6d902ca8fb073d53301f87ab37a9fbc`.
- Agent-browser CLI indirmeleri iptal oldu; normal yol denemeleri de çözmedi. Uzun Windows yolunun neden olduğuna ilişkin ilk yorum kesin kök neden olarak kabul edilmez. CUA download olayı da zaman aşımına uğradı fakat gerçek dosya diskte oluştu ve içeriği doğrulandı; başarı bekleme olayından çıkarılmadı.
- Yazdırma çağrısı tarayıcıda gözlemlendi: 1 çağrı, 124 tablo satırı (başlık dahil). Gerçek üretilen HTML tarayıcı PDF motoruyla işlendi; 4 sayfa, 123 kodun tamamı, Türkçe metin ve son sayfada `000122` PASS. İlk/son sayfa görsel olarak incelendi. Native yazıcı veya işletim sistemi PDF kaydet penceresi testi değildir.

## Sınır ve kalan işler

Bu, ortak çıktı yardımcısının sentetik veriyle gerçek dosya ve render kabulüdür. Her ticari rapor ekranının filtre, tüm sayfalar ve tarih/döviz kaynak verileriyle ayrı uçtan uca kabulü anlamına gelmez. ManagementReportsScreen ve ExportCenterScreen'in kaynak verileri yeniden ticari test ortamında karşılaştırılmalıdır. Geniş ERP/ürün/terminal/katalog/shipping hedefi IN_PROGRESS.

Test komutları: `node scripts/quality/test-web-commerce.mjs`, `node scripts/quality/typecheck.mjs web-admin`, `npm run lint`, `npm --prefix apps/web-admin run build`. Çıktı testleri web regresyon paketine eklendi. Ayrıntılı deliller DevOS `audit/commerce-no-messaging-20260908/report-output/` altında; yerel yeniden inceleme dosyaları `temp/report-output/` içindedir.
