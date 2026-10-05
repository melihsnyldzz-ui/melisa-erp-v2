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
| ERP-DEC-001 | 2026-10-05 | `apps/sites-workflow/ornek-akis.html` kullanıcıya dönük Melisa ERP çalışma yüzünün görsel/UX referansıdır. | İşletmenin kullanacağı yüz için ortak yönü sabitlemek. | ERP ekranları / UX | Onaylı |
| ERP-DEC-002 | 2026-10-05 | `is-akisi-taslagi.html` ve ilgili TEST akışları geliştirme/test laboratuvarıdır; sentetik ve dar kabul burada yapılabilir. | Kontrollü denemeyi günlük çalışma yüzünden ayırmak. | ERP TEST | Onaylı |
| ERP-DEC-003 | 2026-10-05 | TEST'te yeterince doğrulanan özellikler çalışma yüzüne terfi eder; teknik doğrulama ve kullanıcı kabulü ayrı kaydedilir. | Çalışma yüzüne güvenilir özellik teslim etmek. | TEST → çalışma yüzü | Onaylı |
| ERP-DEC-004 | 2026-10-05 | İlk ürün önceliği gerçek ürün/stok kataloğudur: ürün kodu, ad, barkod, stok, satış fiyatı, para birimi; sonra fotoğraflar. | CRM ve ERP için güvenilir ortak ürün temeli oluşturmak. | Ürün / stok / fiyat | Onaylı |
| ERP-DEC-005 | 2026-10-05 | CRM `ornek-akis.html` HTML'sini scrape etmez; ERP çalışma yüzü ve CRM aynı onaylanmış katalog API/sözleşmesini kullanır. | Ürün gerçeğini tek kaynakta tutmak. | ERP–CRM katalog sözleşmesi | Onaylı |
| ERP-DEC-006 | 2026-10-05 | Daha sonra CRM bu kaynaktan ürün/fotoğraf/fiyatı müşteriye gönderir ve sipariş taslağına ekler. | Kataloğu günlük satış akışına bağlamak. | CRM paylaşım / taslak sipariş | Onaylı |
| ERP-DEC-007 | 2026-10-05 | Canlı teslimi engellemeyen yeni fikirler ana teslim rotasını bölmez; `CANLIDAN SONRA`ya gider. | Mevcut canlı teslim hedefini tamamlamak. | Öncelik / kapsam | Onaylı |

Önceki ayrıntılı iş kuralları [karar defteri](docs/erp-v2/karar-defteri.md) içinde korunur; bu dosyada tekrar yazılmaz. Yeni kalıcı kararlar burada tutulur. Şirket kuralları [Melisa OS](https://github.com/melihsnyldzz-ui/melisa-os) içindedir. Bu iç ERP/CRM satış kataloğu kararı halka açık fiyat yayını kararı değildir.
