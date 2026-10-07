# Goal8 E02 — tek iş günü kapsam bağlantısı

7 Ekim2026; çalışan TEST86/source769031cb88de8ab26720266c62ce0e63d62d0877 üzerinde salt okunur API/native ön kontrol. Gerçek günlük zincir uygulanmış sayılmaz.

Private `C:\Sirket\ERP\evidence\ERP-GOAL8-20261007\private\day-audit.json`: `BLOCKED_PROFILE`, `connected:false`, `chainExecuted:false`, `technicalPass:false`. Çalışan uygulama paket kimliği CANONICAL-TEST-769031cb88de, release klasörü CANONICAL-GOAL73-TEST-20261007-86; bunlar farklı alanlardır.

API actor16/isolated_test_ilker, SQL TEST login=sysadmin0/CONTROL0/LIVE erişimi0 doğrulandı. Bu login immutable karantina tablosuna doğrudan SELECT alamaz; kapsam snapshot'ı ayrı mevcut Windows gözlemciyle yalnız allowlist SELECT olarak okundu. İzin/grant değiştirilmedi, ticari SQL yazması yok.

| Bağ | Gözlenen kopukluk |
| --- | --- |
| Mal kabul → satış | Mal kabul ürün325503; satış yalnız345504/345505. |
| Alış → tedarikçi ödeme | Alış tedarikçi13370; faturalı ödeme23381. |
| Tahsilat → ödeme kasası | Tahsilat hesabı20043; ödeme hesabı20045. |
| Yeni batch alış → iade | Mevcut iade adapter'ı legacy test_purchase_links okur; test_purchase_batch_links kaynak zinciri desteklenmez. |

Yeni `scripts/canonical/goal8-test-day.mjs` yalnız gerekli source/runtime/aktör/hold/provenance kontrolünü ve gözlenen native aşama sonuçlarının bağımsız tutarlılık doğrulamasını sunar. Enjekte edilen sentetik test sonucu gerçek SQL gününün yerine geçmez. `runSyntheticDay:true` bu mevcut kopuk kapsamda ilk yazmadan önce reddedilir. Normal modüllerin ayrı eski teknik kanıtları tek ürün/kasa/fatura bağlı iş günü kanıtı değildir.

En küçük tamamlanma bağımlılığı: eski NIGHT/FINOPS profillerini değiştirmeden açık Goal8 TEST profili, ortak ürün/fiyat/kasa, mevcut writer/context/effects/guard adapter'ı, yeni batch fatura-iade kaynak bağı ve her committed aşamada bağımsız native/report readback. İş algoritması, roller ve geçmiş test kayıtları korunmalı; varsayılan profile kapsamı genişletilmemeli.
