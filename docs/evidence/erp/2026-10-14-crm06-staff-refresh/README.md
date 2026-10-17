# CRM06 — ilk giriş ve bağımsız personel yenileme halkası

14 Ekim 2026. Kullanıcı: “Bu giriş engelini benden parola istemeden güvenli şekilde çözmenin yolunu bul ve CRM06’yı tamamla. CI düzeldi, aynı kontrolleri tekrar yapma.”

## Yeni gözlenen durum

CRM sahibi mevcut açık normal62700 formunda yalnız boolean kanıt aldı: usernameFieldLocated=true/usernameFilled=true/passwordFilled=false/usernameMatchesDedicatedManager=false/usernameMatchesDedicatedStaff=false/normalSubmitVisible=true/managerStaffRoleLabels=false. Parola, input değeri, token, cookie veya storage çıktıya alınmadı; submit0. Tarayıcıda hazır dedicated giriş yok. Önceki reader/API/sağlık/CI/işletme kanıtları yeniden çalıştırılmadı.

Korumalı credential-reference ilk GUI tüketimi için bağlı araçta destek bulunmadığı önceki makbuzla korunur. Yeni password/reset/account, eski Semih/helper, admin bypass, process shim, alternatif OS/browser, clipboard/HTTP bridge veya JWT injection uygulanmaz. İlk giriş gerçekleşmediğinden normal müşteri → tek talep → atanmış personel → reopen/mobil zinciri tamamlanmış sayılamaz.

## Bağımsız gerçek kaynak eksiği

KuruluCRM5b6 `normalRefreshSession.mjs` politikası yalnız eski agent3 personeline bağlıdır. Yeni ayrılmış agent2 personeli doğru mevcut personel/crm.view rolündedir ancak kendi normal refresh grant'ini alamaz. Issuer store patron/mudur+crm.manage içindir; personeli oraya eklemek uygun değildir.

CRM sahibi aynı mevcut refresh motoruyla ayrı kesin personel policy/store/routing kaynağını hazırlar. ERP kaynak tarafında şu sonlu optional tuple hazırlanmıştır:

- `CRM_ASSIGNED_STAFF_REFRESH_ENABLED=true`
- `CRM_ASSIGNED_STAFF_REFRESH_USER_ID=crm-crm06-staff-test-20261014`
- `CRM_ASSIGNED_STAFF_REFRESH_JOURNAL_PATH=C:\Sirket\CRM\runtime\CRM06-TEST-ACTORS-20261014\assigned-staff-refresh.json`

Tuple yalnız mevcut CRM06 baseline/audit bağlamı, eski normal refresh ve request feature aktifken; Semih yokken; send/live-send/bridge/incoming/paidAI=false ve AIoff koşuluyla kabul edilir. Kısmi tuple, başka ID, başka journal, eski aileyle alias veya traversal reddedilir. Mevcut yetki/kimlik/hesap/store seçimi değiştirilmez. Tuple yoksa mevcut davranış korunur.

## Dar doğrulama ve aktivasyon sınırı

`node --test --test-name-pattern="assigned staff refresh environment" scripts/canonical/crm06-owner-projection.test.mjs`:1PASS/0FAIL/0SKIP; geçerli tuple,14 negatif, legacy ret ve absent davranışı doğrulandı. Test ayrıca eski immutable provisioning makbuzunun extended activation'ı hâlâ reddettiğini kanıtlar. Bağımsız salt okunur reviewer GO; eski kabul edilmiş suite tekrar edilmedi.

`assertCrm06PreparedActorReceipt` değiştirilmedi. Eski baseline, original activation ve audit hashleri korunur. Gelecekte aktivasyon için önce original parent'ın exact doğrulaması, sonra yalnız reviewed yeni CRM package/source/manifest pinleri ile tuple farkını bağlayan ayrı immutable successor projection/makbuz gerekir. Env allowlist hazırlığı bu bağı doğrulamaz ve yeni5b6 davranışı oluşturmaz.

Bu tur source-only: yeni paket/aktivasyon/settings/task/journal, auth, credential, SQL veya ticari veri işlemi yapılmadı. Aynı makbuzdan runtime PASS türetilmez. RAM refresh, korumalı native reopen ve fiziksel/insan kabulü ayrı şartlardır. CRM06 ve CRM-UA11 açık; ERP09 başlamadı.
