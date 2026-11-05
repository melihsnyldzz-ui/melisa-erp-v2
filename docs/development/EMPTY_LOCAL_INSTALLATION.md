# Boş yerel kurulum denemesi — 5 Kasım 2026

Kullanıcı yeni başlangıçta resim, stok, müşteri ve tedarikçi istemiyor. Bu kurulum mevcut verileri silmez veya eski bir veritabanını yeniden kullanmaz. Kaynak tabanı `93aeccbcc1f136f7e4347c45f5c1ea4258e58dba`, ayrı dal `codex/erp-empty-local-20261105` ve ayrı çalışma alanıdır. Eski aday çalışma ağacı ve kaydedilmemiş dosyaları korunur. GitHub Actions çalıştırılmaz.

İlk kontrol kapsamı normal parola doğrulamalı giriş ve mevcut uygulamanın yerel, boş ürün/müşteri/tedarikçi listeleridir. SQL hesabı yalnız kendi yeni veritabanında SELECT yapabilir. Bu başlangıç, bütün ERP modüllerinin yazma ve native işlevlerinin kurulduğu anlamına gelmez. Satış/finans/aktarımı veya otomatik peşin cari hazırlama bu aşamaya bağlanmaz.

## Sabit ayrım

| Nesne | Yeni kurulum |
|---|---|
| Veritabanı | `MELISA_ERP_EMPTY_TEST_20261105` |
| SQL uygulama hesabı | `melisa_empty_test_read_20261105` |
| Ortam kimliği | `94a8324f-124a-49e4-ad70-be3232989f47` |
| SQL sunucu kimliği | `Semih\MELISADEV` |
| API / WEB | `127.0.0.1:4294` / `127.0.0.1:5294` |
| Uygulama hesabı / rolü | `kurulum` / `empty_local_reader` |

Var olan hedef veya hesap devralınmaz, sıfırlanmaz ve yetkisi değiştirilmez. Yeni profil eski CLEAN/canonical guardlarını genişletmez. Vega, CRM, dış mesaj, ürün aktarımı, eski özel ayarlar ve medya dosyaları taşınmaz. Normal SQL bağlantısında sertifika doğrulaması kapatılmaz; Windows/firewall/güven deposu/servis/task değişikliği yapılmaz. Başarısız veya belirsiz SQL işlemi otomatik tekrarlanmaz; yalnız kendi yeni durum kaydı inceleme için korunur.

## Yedi adımın kanıtı

1. **Koruma:** seçili kaydedilmemiş 27 kaynak dosyası kopyalandı ve SHA256 karşılaştırıldı. Veritabanı/görsel/özel ayar yedeğinin yeterliliği bu işlemle doğrulanmış değildir. Tamamlandı denmez.
2. **Kaynak:** ayrı kaynak dalı `93aeccbc` tabanında oluşturuldu; önceki `dce0fff4` üzerine yerel 21 commit korunur. Eski WIP kaynaklarının kopyası ayrı saklanır, otomatik birleştirilmez. Güncel uzak GitHub durumu sorgulanmadı.
3. **Paket:** yalnız şema/sistem rolü ve boş yerel kaynak profili hazırlanır. Derleme, hedefli yerel test ve bağımsız inceleme kanıtları çalışma sonucunda ayrıca raporlanır; kaynak dosyası varlığı kurulum değildir.
4. **Veritabanı:** mevcut TEST'e bağlanmak yerine yalnız yeni hedef oluşturulur. Bütün ticari tablolar sıfır kayıt olmalıdır. Eski veritabanı veri/şeması değişmez.
5. **Açılış:** eski süreçlere dokunmadan kendi yeni API/WEB süreçleri kullanılır. Dinleyici açılmadan önce yeni SQL kimliği/marker/yetki ve boşluk doğrulanmalıdır. Otomatik tarayıcı açılmaz.
6. **Kontrol:** normal giriş ve sıfır liste sonuçları gerçek yeni hedefte doğrulanır. İlk aşama salt okunurdur; kalıcı ticari kayıt ve tüm iş akışlarının kabulü ayrı kalır.
7. **Kabul:** gerçek ekran ve kullanıcı kabulü kanıt olmadan PASS yazılmaz. Kurulum/bağlantı engelinde tamamlanan hazırlık ve tam engel raporlanır.

`source-preservation-20261105/receipt.json` çalışma alanındaki sınırlı kaynak korumasının makbuzudur; tam makine/veri yedeği değildir. Kaynak tabanı, eski GitHub adayı, yerel WIP, hazırlanan kod, çalışan kurulum ve insan kabulü ayrı durumlardır.
