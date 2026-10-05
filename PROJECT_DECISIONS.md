# ERP karar merkezi

Karar sahibi: kullanıcı; ChatGPT planlama ortağı, Codex uygulayıcıdır. Kayıt tarihi: **2026-10-05**. Kaynak: kullanıcının bu tarihli açık proje-yönetim talimatı ve [CRM ERP sohbeti](https://chatgpt.com/c/6ac01ba3-0444-83eb-9ea8-1bb9d7ae5012). Aşağıdaki kararlar **onaylıdır**; uygulanmış veya kullanıcı tarafından denenmiş anlamına gelmez.

## Tek kaynak düzeni

| Bilgi | Tek kayıt yeri |
| --- | --- |
| Kalıcı ürün/iş kararı | Bu dosya |
| Günlük onaylı iş sırası / iş durumu / bağımlılık | [DELIVERY_BOARD.md](DELIVERY_BOARD.md) |
| Kullanıcının gözle denemesi ve sonucu | [USER_ACCEPTANCE.md](USER_ACCEPTANCE.md) |
| Teknik gerçek durum, test/CI ve kanıt | [STATUS.md](STATUS.md) |
| Tam kapsam ve finish tree | [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md) |
| Devam döngüsü / işlem sınırları | [AGENTS.md](AGENTS.md) |

Karar sohbetten sonra açık kullanıcı talimatıyla bu dosyaya kaydedilir, ilgili pano satırı karar ID'sine bağlanır ve dar PR ile GitHub'a teslim edilir. Codex yeni ürün kararı üretmez; yalnız onaylı işin ilerleme durumunu kanıtla günceller. Karar değişecekse kullanıcı yeni kararı açıkça verir; yeni ID/tarih/gerekçeyle eklenir, eski satırın durumu `Superseded by <yeni ID>` olur, metni korunur. Durumlar: `Onaylı / Superseded by <ID>`; karar onayı uygulama kabulü değildir.

GitHub'daki ilgili PR/commit bu kayıtların sürümünü gösterir. Yerel checkout, main, çalışan TEST/LIVE paketi ayrı kimliklerdir. Açık doküman PR'si main'e birleşmiş veya runtime'a uygulanmış sayılmaz. İş tekrar açılmadan önce aynı kapsamın mevcut kabul kaydına bakılır; başka dosyaya karar metni veya ikinci günlük pano kopyalanmaz.

## Kalıcı kararlar

| ID | Tarih | Karar | Gerekçe | Etkilediği alan | Durum |
| --- | --- | --- | --- | --- | --- |
| ERP-DEC-011 | 2026-10-05 | Kullanıcının “bu projeyi sabit192.168 diye ip ver ki ağdakilerde girsin” talimatıyla yalnız mevcut ERP TEST çalışma yüzüne LAN erişimi hazırlanır. Mevcut Ethernet192.168.1.46:5194 / API4144 exactopt-in; normal hesapla giriş, loopback TESTADMIN LAN'a açılmaz. Native4146 ve LIVE korunur. | Ağdaki personelin aynı çalışma yüzünü açması. IP şu an DHCP; kalıcı modem rezervasyonu ayrıca doğrulanır, işletim sistemi/LIVE ağ adresi izinsiz değiştirilmez. | ERP TEST LAN / erişim | Onaylı |
| ERP-DEC-001 | 2026-10-05 | `apps/sites-workflow/ornek-akis.html` kullanıcıya dönük Melisa ERP çalışma yüzünün görsel/UX referansıdır. | İşletmenin kullanacağı yüz için ortak yönü sabitlemek. | ERP ekranları / UX | Onaylı |
| ERP-DEC-002 | 2026-10-05 | `is-akisi-taslagi.html` ve ilgili TEST akışları geliştirme/test laboratuvarıdır; sentetik ve dar kabul burada yapılabilir. | Kontrollü denemeyi günlük çalışma yüzünden ayırmak. | ERP TEST | Onaylı |
| ERP-DEC-003 | 2026-10-05 | TEST'te yeterince doğrulanan özellikler çalışma yüzüne terfi eder; teknik doğrulama ve kullanıcı kabulü ayrı kaydedilir. | Çalışma yüzüne güvenilir özellik teslim etmek. | TEST → çalışma yüzü | Onaylı |
| ERP-DEC-004 | 2026-10-05 | İlk ürün önceliği gerçek ürün/stok kataloğudur: ürün kodu, ad, barkod, stok, satış fiyatı, para birimi; sonra fotoğraflar. | CRM ve ERP için güvenilir ortak ürün temeli oluşturmak. | Ürün / stok / fiyat | Onaylı |
| ERP-DEC-005 | 2026-10-05 | CRM `ornek-akis.html` HTML'sini scrape etmez; ERP çalışma yüzü ve CRM aynı onaylanmış katalog API/sözleşmesini kullanır. | Ürün gerçeğini tek kaynakta tutmak. | ERP–CRM katalog sözleşmesi | Onaylı |
| ERP-DEC-006 | 2026-10-05 | Daha sonra CRM bu kaynaktan ürün/fotoğraf/fiyatı müşteriye gönderir ve sipariş taslağına ekler. | Kataloğu günlük satış akışına bağlamak. | CRM paylaşım / taslak sipariş | Onaylı |
| ERP-DEC-007 | 2026-10-05 | Canlı teslimi engellemeyen yeni fikirler ana teslim rotasını bölmez; `CANLIDAN SONRA`ya gider. | Mevcut canlı teslim hedefini tamamlamak. | Öncelik / kapsam | Onaylı |
| ERP-DEC-008 | 2026-10-05 | ERP-D03 planı kabul edildi. Yalnız 3.830 CONFIRMED fotoğraf TEST ERP'nin paketlerden bağımsız merkezi medya alanına kopyalanır; ERP metadata tutar, SQL'e binary/blob veya ikinci ticari ürün DB'si eklenmez. Kaynaklar salt okunur; her uygulamada güncel exact ürün/karantina/hash kontrolü yapılır. Bir ürüne ait tek CONFIRMED aday ana görsel olarak gösterilebilir. 67 belirsiz ve 4620 LEYLEK karantinası dışarıda; CRM/LIVE/main merge ve başka iş bu kapsamda yok. | Kullanıcının bu sohbetindeki açık ERP-D04 uygulama talimatı; Desktop bağımlılığını kaldırıp ortak medya kaynağı hazırlamak. | ERP medya / normal katalog / ERP-D04 | Onaylı |
| ERP-DEC-009 | 2026-10-05 | Kullanıcının “DÜZELTME” talimatı: marka gerçek Vega KOD1, ürün türü gerçek KOD4; MALINCINSI ayrıca korunur. STOKKODU değişmez; yalnız literal KOD1 ile güvenli son ek eşleşmesinde görüntü kodu ayrılır, sıfırlar korunur. Tam katalog analizi uygulamadan önce yapılır. Normal listede Foto/Kod/Marka/Tür/Stok/Satış fiyatı/Durum, 64px lazy thumbnail ve gerçek kaynak filtreleri; varsayılan doğal kod sırası ve 50 satır. Yalnız CONFIRMED merkezi medya görselli sayılır. CRM/LIVE/main merge yok; ERP-UA04 bekler, bu dilim bitince durulur. | Doğrudan kullanıcı düzeltmesi; marka/tür çıkarımı kaynak gerçeğinin yerine geçmez. Önceki sohbet UX çıkarımını supersede eder; ERP-DEC-001/004/005/008 korunur. | ERP-D04 katalog sunumu ve ortak sözleşme | Onaylı |

| ERP-DEC-010 | 2026-10-05 | Kullanıcı mevcut Ürün & Stok ekranını şimdilik kabul etti: ERP-UA04 PASS, ERP-D04 bu kapsamda tamam. Yalnız B01 normal Ana Sayfa / İş Sırası hazırlanır; yeşil görünüm korunur, bugünkü kayıtlı işler ve mevcut gerçek yetkilerle kısayollar gösterilir. Bilinmeyen kaynaklar boş kalır; TRY/USD/EUR ayrılır, teknik/demo metin normal ekrana taşınmaz. CRM/LIVE/main merge, diğer ekranları yeniden yapma ve başka finish işi yok; B01 tesliminden sonra durulur. | Bu sohbetin açık “ERP ANA SAYFA / GÜNLÜK İŞ SIRASI — B01” talimatı. ERP-DEC-009'un kabul bekleme ve o tur sonunda durma önceliğini yeni kullanıcı kararıyla supersede eder; gerçek sınıflandırma, medya ve güvenlik kuralları korunur. | ERP-UA04 / ERP-D04 / B01 | Onaylı |

ERP-DEC-009'un kaynak sınıflandırma kuralları yürürlüktedir; yalnız kabul bekleme ve sonraki iş sırası ERP-DEC-010 tarafından supersede edilmiştir. Eski karar metni ve geçmişi korunur.

Önceki ayrıntılı iş kuralları [karar defteri](docs/erp-v2/karar-defteri.md) içinde korunur; bu dosyada tekrar yazılmaz. Yeni kalıcı kararlar burada tutulur. Şirket kuralları [Melisa OS](https://github.com/melihsnyldzz-ui/melisa-os) içindedir. Bu iç ERP/CRM satış kataloğu kararı halka açık fiyat yayını kararı değildir.
