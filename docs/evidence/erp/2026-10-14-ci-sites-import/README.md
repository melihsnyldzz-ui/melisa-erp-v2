# Çalışan hosted CI — Sites test import çözümü

14 Ekim 2026; PR23 / codex/erp-finish-20261004. Yeni özellik veya çalışma ortamı değişikliği değildir.

## Gerçek hata

Exact kaynak08ea429fc7aded79572cb07bff0b563cba77798f, [CI38572980003](https://github.com/melihsnyldzz-ui/melisa-erp-v2/actions/runs/38572980003), quality job115882709616: Sites895 test,892PASS/3FAIL. Hatalı testler `workTrade.test.mjs`94,138,143; `ERR_UNSUPPORTED_RESOLVE_REQUEST` / `ERR_INVALID_URL`, input `./workCustomerContact.mjs`. Sır taraması ve Windows işi geçti. Önceki payment-limit annotation'ları bu yeni run'ın nedeni değildir.

`workCustomers.js` yeni iletişim modelini normal dosyadan import eder. Test controller'ı CSS'yi çıkarıp source'u `data:` URL olarak yükler; mevcut sonlu bağımlılık listesi diğer importları gerçek mutlak dosya URL'sine çevirirken bu modeli dışarıda bırakmıştı. Data URL'nin göreli dosya tabanı olmadığı için üç müşteri testi controller yüklenmeden duruyordu.

## Dar düzeltme ve doğrulama

Yalnız `workTrade.test.mjs` loadController listesine `workCustomerContact.mjs` eklendi. Model kendi gerçek dosya tabanından `workTradeModel.mjs` bağımlılığını çözer. Üretim kodu, mock davranışı, assertion, skip, süre sınırı veya CI koşulu değiştirilmedi.

- `node --test apps/sites-workflow/src/workflow/workTrade.test.mjs apps/sites-workflow/src/workflow/workCustomerContact.test.mjs`:36PASS/0FAIL/0SKIP.
- `node scripts/ci/run.mjs sites-workflow`:895PASS/0FAIL/0SKIP;18,51 saniye.
- Bağımsız inceleme: mevcut sonlu listeye tek dosya eklenmesi yeterli; kaynak dışı işlem yapılmadı.

Yerel suite çıktısı repo dışı reports alanında korunur. Önceden kabul edilmiş runtime/auth/SQL/restore/işletme kanıtları tekrarlanmadı; servis, hesap, rol, ticari veri, LIVE/Vega/CRM/main değişmedi. Yeni hosted CI exact teslim head'inden kontrol edilir; yerel başarı hosted CI veya insan kabulü değildir. CRM06 korumalı ilk tarayıcı giriş bileşeni ayrı açık kalır.
