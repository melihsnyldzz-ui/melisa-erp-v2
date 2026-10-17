# Goal7.1 — teknik teslim / insan kabulü bekliyor

7 Ekim 2026. ERP-DEC-021 ve kullanıcının açık Goal7.1 kapsamı; önceki PR23 6033375310 incelemesi tekrar edilmeden devam edildi. [Kaynak karşılaştırması ve aktarım planı](../../../erp-v2/canonical-20261005/party-currency-comparison-plan.md), [ERP-UA24](../../../../USER_ACCEPTANCE.md).

## Gerçek TEST bağlantısı

Başlangıçta 5194/4144/4146 listenerları yoktu; eski health dosyası ve açık tarayıcı güncel çalışma kanıtı sayılmadı. Pinli TEST83 mevcut launcher ile geri açıldı; source e2ffea6c'nin gerçek API/native/DB ve okuyucuları doğrulandı. Sonra yalnız ERP TEST paketi TEST84'e geçti.

- Uygulama commit'i: 07101548d4af1f4a9344fe7cf7f19e64ffa26edb.
- Paket: C:\Sirket\ERP\releases\CANONICAL-GOAL71-TEST-20261007-84; 1434 dosya, baseline rebuild kanıtı true.
- Manifest SHA256: 977add2668602776bdb2fd9385700df800b534d6a252f85aca5b1d2edb53c7a9.
- Web5194 / API4144 / native4146 READY; Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01.
- API/native kimliğinde sysadmin0, databaseControl0, liveDatabaseAccess0. Native4146 writesfalse; mevcut API named TEST operasyon sınırları değiştirilmedi.
- Normal customer/supplier workflow → /api/customer-cards veya /api/supplier-cards ve /api/customers/:id/card veya /api/suppliers/:id/card → CardService → CardReadStore → mevcut iki exact-hash SQL okuyucu. Eski Vega servisleri bu zincirde kullanılmıyor.
- Yeni karşılaştırma yalnız detay DTO'suna eklenir; başlangıçta exact TEST kimliği/hash ile doğrulanan private immutable indeks belleğe alınır. Liste/katalog sorgusu veya sayfa başına Vega kontrolü eklenmedi.

## Gerçek kabul kanıtları

200 kaynak cari / 209 ham döviz grubu; 196 kesin bağlı cari ayrıntısının **196/196** gerçek API cevabı indeksi, rolü, kaynak kimliğini ve hesapları birebir korudu. Dört bağsız kayıt başka karta gösterilmedi. 1045 native hesaptan oluşan ID/döviz ve miktar SHA256 tanık havuzuyla bu 196 kartın native hesap gösterimi denetlendi; 1045 hesabın tümünün bu kartlarda gösterildiği iddia edilmez.

Tutar+döviz+B/A; çoklu döviz/defaultcurrency, native tedarikçi işaret kuralı, kaynak işaretinin rol bağımsızlığı, exact sekiz basamak, yerel etki ve doğrulanmamış/held bilgiyi gizleme kontrol edildi. Missing auth401; mevcut personel15 supplier.view olmadan gerçek tedarikçi okuyucusuna403. Roller genişletilmedi.

12 finans/native tablosunun full-row count/SHA256 önce/sonra aynı; iki eski SQL okuyucunun definition hash'i aynı. Kullanıcı yetki projeksiyonu, rol/izinler ve hold tablolarının hashleri aynı. Mevcut oturum açmanın login timestamp/token etkileri finans kanıtı veya yetki değişikliği sayılmadı. İş bakiyesi/finans write0, holdlift0.

Normal tarayıcıda beş gerçek kart: müşteri üç dövizli hesap + doğrulanmamış EUR; karantinalı çoklu dövizli tedarikçi; küçük TRY ve USD ayrı tedarikçi; doğrulanmış sıfır; hareketi olmayan müşteri. B/A, kaynak açılış/yerel etki/güncel ERP ve yakalanan kaynak neti ayrı göründü; no-movement sıfır yapılmadı. Üç mevcut kullanıcı ekranı screenshot'ı private klasörde; ham ticari tutarlar GitHub'a konulmadı.

Private ekran kanıtları:

- C:\Sirket\ERP\evidence\ERP-GOAL7.1-20261007\runtime-private\customer-currency-84.png
- C:\Sirket\ERP\evidence\ERP-GOAL7.1-20261007\runtime-private\supplier-currency-84.png
- C:\Sirket\ERP\evidence\ERP-GOAL7.1-20261007\runtime-private\no-movement-84.png

## Test, süre ve korunan kapsam

484 API ve 617 workflow offline test PASS; guard/JS kalite/build PASS. Bağımsız reviewer salt okunur gösterimde P1 bulmadı. Altı private arithmetic testi ve kaynak 3799 satır/192 grup bağımsız hesap farkı0. Uygulama commit'inin push ve PR CI koşularında quality-build-test, windows-startup-test ve secret-scan SUCCESS:

- [Push CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37599788443)
- [PR CI](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/37599796483)

196 ayrıntının medyanı169ms. Ayrı üçer warm guarded GET medyanı:

| Yol | Goal7 kayıtlı baseline ms | TEST84 ms |
| --- | ---: | ---: |
| first50 | 777 | 850 |
| next50 | 723 | 744 |
| kod | 568 | 670 |
| başında sıfırlı barkod | 367 | 373 |
| ürün kartı | 233 | 202 |
| müşteri listesi | — | 316 |
| tedarikçi listesi | — | 440 |

Önceki tek cold katalog50 ölçümü1646ms'dir; medyan sayılmaz. Baseline ile aynı süre iddia edilmez; warm ilk/sonraki50 bir saniye altında. Katalog kodu değiştirilmedi.

LIVE5188/4114/4116/4200 ve CRM62400/4117 listener/PID karşılaştırması aynı. Kaynak feature branch korunur; main merge, Vega/LIVE/CRM değişikliği yok. Private konfigürasyonun önceki kopyaları korunur; TEST83'e geri paket dönmek gerekirse snapshot'taki iki yeni comparison config alanı önceki haliyle geri alınır, yalnız doğrulanmış ERP sahipli süreçler değiştirilir. Finans telafisi gerekmez, çünkü bu tur finans yazması yapılmadı.

## Kalan ve durma sınırı

Dört kesin native bağ, açılış/devir/iptal ve dönem tamlığı, tarihlendirilmiş aynı kapsamlı Döviz Bakiye raporu hâlâ teknik araştırmadır. İki LL hesabı tek gerçek işletme soru grubudur. 84 sayısal aday/77 fark, finans uygulanabilirliği tamamlanmış hesap0; 122hold aynen korunur. D02/D06 açık, finish49/9🟢/34🟡/6🔴 ve ERP-UA24 bekliyor. Teknik kanıt insan PASS değildir. Goal7.1 sonunda durulur.
