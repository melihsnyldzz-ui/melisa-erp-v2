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

## 5 Kasım yürütme sonucu

Kaynak hazırlığı yerel `d178ed40` commit'inde kaydedildi. Yeni kaynak alanına bağımlılıklar yalnız yerel npm önbelleğinden ve kurulum betikleri kapalı hazırlanmıştır. Arayüzün `empty-local` production derlemesi, 48 hedefli yerel test, bcrypt bağlayıcı kontrolü ve sır taraması geçti. Bağımsız kaynak incelemesindeki eksik ürün tedarikçi kolonu ve çalıştırılan bağımlılık envanteri düzeltildi. GitHub push/Actions yapılmadı.

İlk `bootstrap.ps1 -Apply` denemesi bağlantı nesnesi oluşturulurken `System.ArgumentException`, HRESULT `-2147024809`, desteklenmeyen `DataSource` anahtarı nedeniyle durdu. SQL bağlantısı açılmadı ve hiçbir DDL gönderilmedi. Sadece plan, Windows DPAPI ile korunan yeni deneme ayarları ve `sqlDdlState=not_attempted` hata makbuzu oluşturuldu. Bu üç dosya hashleri doğrulanarak çalışma alanındaki `empty-local-20261105-94a8324f-attempt1-preconnection-failure` dizininde korundu. Eski ERP veritabanı, gerçek hesap, Vega veya servis değiştirilmedi.

Bağlantı kurucusu kanonik anahtar indeksleri kullanacak şekilde düzeltildi. Ancak düzeltmeyi yalnız kapalı bağlantı nesneleriyle kontrol eden aşağıdaki normal Windows PowerShell 5.1 çağrısı, betik gövdesi çalışmadan güvenlik denetiminde reddedildi:

```text
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive -File C:\Sirket\ERP\worktrees\erp-empty-local-20261105\scripts\empty-local\launcher-construction.test.ps1
AuthorizationManager check failed / SecurityError / UnauthorizedAccess
```

Bu Windows PowerShell çalışma zamanı reddidir; araç çağrısının otomatik onay incelemesi reddi değildir. Ret sonrası aynı test başka host, komut biçimi, policy, hesap veya araçla çalıştırılmadı; yeni bootstrap denemesi, SQL, listener veya tarayıcı başlatılmadı. Ret kapsamı ve desteklenen izinli çalıştırma yolu henüz doğrulanmadı. Düzeltme kaynakta bulunuyor fakat yeni Windows regresyon testi **BLOCKED**, gerçek kurulum **BEKLİYOR** durumunda.

| Adım | Son doğrulanan durum |
|---|---|
| 1 Koruma | Kısmi: seçili 27 kaynak dosyasının kopya hashleri eşleşiyor; veri/görsel/özel ayar yedeği doğrulanmadı. |
| 2 Kaynak | Kısmi: 21 yerel commit yeni tabanda korunuyor, WIP kopyaları var; tam koruma koşulu kapanmadı. |
| 3 Paket | Kaynak/derleme/48 test hazır; son Windows çalıştırma testi güvenlik nedeniyle engelli. Kurulabilirliği tamamlandı sayılmaz. |
| 4 Boş DB | Oluşturulmadı. İlk deneme SQL öncesinde durdu. |
| 5 Açılış | Başlatılmadı; eski süreçler korunuyor. |
| 6 Akış kontrolü | Gerçek SQL/normal giriş/boş ekran kontrolü yapılmadı. |
| 7 Kabul | Bekliyor. |
