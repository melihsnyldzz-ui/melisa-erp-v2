# K10-02 / DES-19 satış onay sınırları

9 Kasım 2026. Bu çalışma PR119'un `00ef3887` kaynak tabanını ve PR120'nin rol matrisi incelemesini kullanır. PR121 ve PR122 sonraki satış/depo/mal kabul/finans hazırlıklarıdır; bunların varlığı kurulum veya kabul değildir.

## Kesin şirket kararı

Satışçı kendi kişi sınırına ve en fazla yüzde 3 indirime tabidir. Üzerindeki oran onay gerektirir. Müdür yüzde 5 dahil indirim ile müşteri limit/vade istisnasını onaylayabilir; yalnız bekleyen karar için gerekli cari bilgisini görebilir. Yüzde 5 üzeri indirim patrona aittir. Mevcut izin sistemi kullanılır; bu karar genel yönetici veya finans erişimi vermez. Önceki geniş birleşik onaylayıcı önerisi uygulanmaz.

Kararın yerel koordinasyon kaydı: `erp-koordinasyon-izleme.json` / `salesApproverDecision.approvedMatrix`; açıklama: `scopeClarification`. Bu belge yeni iş kararı veya yeni takip tablosu oluşturmaz.

## Bu kaynak değişikliği

- Canonical kişi politikası manager/boss için `sales.view` ile `canApproveUpToFive` üretir. `canApproveAboveFive` yalnız boss olarak kalır. Rolün adı yetki oluşturmaz; genel rol varsayılanları eklenmez.
- Müdür başka satışçının yalnız bekleyen, süresi geçmemiş, mevcut kişi politikasıyla bağlı ve en çok yüzde 5 olan indirim isteğini listeler, okur ve onaylar. Kendi isteğini onaylayamaz. Patronun mevcut davranışı korunur.
- Kararın tüketimi aynı talep, kişi, gövde, quote, yetki revizyonu, süre ve tek kullanım bağıyla tekrar doğrulanır. Satış kaydı güncel katalog/önizleme kanıtını ayrıca doğrular. Müdürün listesinde eski kararlar ve sınır dışındaki yabancı istekler açılmaz.
- Kredi onay yetkisi genel CHECKED fiş okuyucusu değildir. Yabancı cari özeti yalnız henüz karara bağlanmamış, fiş/bakiye/politika revizyonu güncel gerçek kredi talebine bağlı okunur. Genel hesap okuma `customer.view`, tanım yazma ayrıca `customer.edit` ister; bu haklar yeni onay rolüne eklenmez.
- Yalnız `sales.view` taşıyan kişi normal yeşil ekranın onay panellerine katalog veya satış giriş formu açılmadan ulaşır. UNKNOWN işlemler özgün UUID ve gövdeyi korur; yetki kaybı yeni POST üretmez, mevcut komutun opak sonucu çözülebilir.
- Çok sayıdaki eski veya geçersiz istek, daha eski geçerli bekleyen kararı gizlemez; dar kontrol, ilerlemesi doğrulanan keyset sayfaları üzerinde yapılır.

## Ayrı kalan vade ve kurulum kabulü

9 Kasım gerçek yerel kurulumda %5.0001 için müdür GET403/patron onayı, tam %5 için müdür onayı ve satışçının aynı onayla fiş19 taslak kaydı normal ekran/native journal üzerinden doğrulandı. Runtime2e43/paket299 ile offline SQL compiler873 ayrıdır. [Gerçek kanıt ve kalan sınırlar](../evidence/erp/2026-11-09-sales-approval-matrix/README.md).

Mevcut `saveTerms` kalıcı müşteri vadesi tanımıdır; fişe özel vade istisnası değildir. Mevcut kredi snapshot'ındaki `vadeStatus: unknown` bir istisna kabulü sayılmaz. Vade istisnasının fiş/kişi/terim revizyonuna bağlı ayrı protokolü ve olumlu normal ekran kanıtı henüz tamamlanmadı. Bu eksik genel cari düzenleme yetkisi verilerek kapatılmaz. K10-02 bu kaynak değişikliğiyle tamamlanmış sayılmaz.

Yeni dar TEST müdür/patron kimlikleri önce pasif hazırlanır; eski yüzde 5 adlı hesabın kind=sales olması şirket müdürü olduğu anlamına gelmez. Kişi politikası satırına ekleme bütün policy revizyonlarını değiştirdiğinden uygulama öncesi açık/belirsiz komutlar gözden geçirilir. Fiş18 ve tarihsel209 silinmez, yeniden gönderilmez veya kendiliğinden iptal/onay/sevk edilmez. Korunan eski taslağın değişmiş politika altında otomatik kesinleştirilebildiği iddia edilmez.

Teknik kaynak testleri, paket/kurulum, ayrı normal satışçı-müdür/patron oturumlarında aynı fişe bağlı karar ve kayıt, SQL tek etki kontrolü ve insan kabulü ayrı kanıtlardır. Gerçek ekran sonucu bulunmadan K10-02 veya bütün ERP için PASS yazılmaz. LIVE/Vega, SQL servisleri, eski ticari kayıtlar ve main bu çalışmanın değişiklik hedefi değildir.
