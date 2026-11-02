# C06/B03 — müşteri kartının üç ana alanı

2 Kasım 2026, mevcut ERP-CUSTOMER-CARD-FIX-20261102-1636. Kaynak ve sentetik uygulama dilimi; genel C06 kapanışı veya kurulu TEST teslimi değildir.

Normal `createWorkCustomers` kartına müşteri kodu, adı ve türü düzenleme formu bağlandı. Alanlar mevcut `customerService.js` ve `CustomerCardForm.jsx` sözleşmesinden gelir. Türler Müşteri/Toptan/Perakende/Karma; kod metindir ve baştaki sıfırlar korunur. Telefon/şehir/ülke editörü aynı kalır. Yeni müşteri oluşturma, adres/vergi/vade/risk alanları bu teslimde eklenmedi.

## Güvenli sözleşme

- Genel PUT revision/UUID taşımadığı için yeni forma bağlanmadı. Dar `/customers/:id/master` GET/POST ve UUID'ye bağlı GET recovery, mevcut auth + customer.view + customer.edit ile sınırlıdır; POST ayrıca mevcut karantina kapısından geçer.
- Body yalnız üç alan + expectedRevision + requestId içerir. Döviz/hesap/bakiye/kaynak/hold/aktör alanları reddedilir. Hesapların görünümü mevcut okuyucuda kalır.
- İnjected store işlemi atomik olarak aktör/kopya/kart/hold, replay-before-CAS, kod tekilliği ve audit ile bağlamalıdır. Bu dilimde gerçek native master writer **yoktur**; varsayılan adapter 503 ile kapalıdır. Mevcut contact-only prosedürlerinden master yetkisi türetilmedi. 5244'ün okuma/satış sınırları genişletilmedi.
- Bekleyen body ve ad/kod bellektedir. sessionStorage yalnız kopya/mühür/aktör/kart/UUID işaretini tutar. Otomatik retry veya yeni UUID ile atlama yoktur. Reload sonrası recovery yalnız GET'tir; kesinleşmeyen sonuç yeni yazma açmaz. Mükerrer kod kesin reddi formda düzeltilebilir; stale form tekrar kullanılmaz.
- İletişim kaydı beklerken ana form açılamaz. Ana form açıkken arama/kart değişimi/yenileme ve diğer editör kapalıdır. Yanıt kaybında aynı body/UUID korunur.

## Kanıt

126 hedefli offline test PASS, 0 skip; guardlı Sites build 8,22 saniye PASS. Bağımsız kaynak incelemesi GO; bulunan mükerrer kod kilitlenmesi düzeltildi ve regresyonla kanıtlandı. Son router kontrolü ve exact head CI ayrıca STATUS/PR54 kaydına bağlanır.

İlk kaynak 07edd2e4'ün PR CI41489530344 API testinde yeni statik hata kodunun logger sözlüğünde kayıtlı olmaması nedeniyle FAIL oldu; başarılı sayılmadı veya yeniden çalıştırılmadı. Beş sonlu CUSTOMER_MASTER kodu mevcut kapalı tanı sözlüğüne eklendi; özel müşteri metni, yeni kod ve private suffix hâlâ redacted. Test/guard/workflow/timeout/secret-scan istisnası değiştirilmedi. Düzeltmenin yeni exact CI sonucu ayrı doğrulanır.

İkinci1548a1f2/PR41490213938 API aşaması geçti; Sites'ta üç eski müşteri testi yeni master importunu data-URL yükleyicisinde çözemedi. Mevcut explicit test modül listesine yalnız `workCustomerMaster.mjs` eklendi; hiçbir assertion veya sınır gevşetilmedi.38 trade/master hedefi PASS/0skip ve bağımsız dar review GO. Geniş yerel guardlı Sites1327 test:1326PASS/1FAIL/0skip. Tek hata değişmeyen `simpleWebRelease.test.mjs` Windows PowerShell child isteğinin offline guard reddidir; önceki1455 ile aynı, genel yerel PASS ilan edilmez. Yeni exact hosted CI sonucu ayrıca okunur; eski koşular elle tekrarlanmadı.

Kendi geçici localhost uygulamasında gerçek üretim `createWorkCustomers` + kaynak service + açıkça sentetik bellek store kullanıldı. Normal formda boş ad reddi, 000155 kodu/Toptan türü, kaydet, reload/readback, mükerrer kod reddi ve formun düzeltilebilmesi görüldü. İkinci sentetik kaydın ACK'i kaybettirildi; reload sonrası kullanıcı eylemiyle GET recovery, 3 gönderim/2 kesin kayıt sayısını değiştirmedi. Salt okunur rolde düzenleme düğmeleri yoktu. 390/1024/1440 CSS iframe genişliklerinde alan/düğme görüntüleri alındı; fiziksel cihaz veya sayısal taşma ölçümü değildir.

Sentetik hesap tutarları storage before/after karşılaştırmasında değişmedi. GUI fixture'ın eksik hesap doğrulama DTO'su nedeniyle mevcut sunum TRY/USD için **Bilinmiyor** gösterdi; bu tur görünür sayısal bakiye mutabakatı iddia edilmez. Cari/finans sözleşmesi veya bilinmeyen tutar koruması değiştirilmedi.

Özel kanıt: `C:\Sirket\ERP\evidence\ERP-CUSTOMER-CARD-FIX-20261102-1636` — test/build kayıtları, sentetik before/after, AX ve PNG. Ham ticari bilgi veya seçilmiş Library görselleri GitHub'a alınmadı.

## Açık kalanlar

Kullanıcının seçtiği tasarım `libfile_65340f1292fc81918c611c3d3e2b0f7b`, karşılaştırma `libfile_240d1ae9996c8191a60a71f8c0c51dce`. Bu executor'ın çağrılabilir araç envanterinde Library read/prepare_materialize bulunmadı. Pikseller görülmedi; önerilen yeni görsel düzen uygulanmış veya birebir eşleşmiş sayılmaz. Form mevcut yeşil bileşen stillerini kullanır.

Native master writer/gerçek DB kurulum ve normal personel kaydet→yenile, seçilmiş tasarımın gerçek pikselleriyle uygulama/QA, insan kabulü BEKLİYOR. Vega/LIVE/CRM/SQL/OS-servis/config/credential/kurulum ve gerçek kayıt değişimi yok. Mevcut 49 yaprak sayacı değişmez.
