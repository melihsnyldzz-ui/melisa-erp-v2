# CRM06 — paket ve original-parent bağlı staff successor hazırlığı

14 Ekim 2026. Aynı CRM06/sabit55/ortak21; ilk GUI girişi araştırması, eski auth/health/restore/CI/kabul tekrarı değildir.

## Kaynak ve incelenebilir paket

CRM exact uygulama kaynağı `b2985d2295c022848c769ea5f494012c1eb3fa00`. CRM sahibi mevcut commit-seçimli builder ile immutable `crm-shared-test-b2985d2295c022848c769ea5f494012c1eb3fa00` paketini hazırladı: manifest `7b44c381975fa54fad1a45dcbd4105ee31df836714ba34afba2f11fac29c01eb`,2289 payload dosyası/23.926.692 bayt,183/183 kaynak blobu eşleşir. [CRM paket makbuzu](https://github.com/melihsnyldzz-ui/melisa-crm/pull/3#issuecomment-6171271864). Private ayar/env/DB paket içinde değildir. Paket kurulu değildir; DB02 kimliği frontend'deki eski literal DB01 fallback'ten çıkarılmaz, mevcut native/owner guard'ına bağlıdır.

ERP staff-feature base `140fac3aa2a9293b63fdf7a6998acf4aaa814d77`; yeni successor helper'ları bu base commit'te bulunmadığından kendi yeni source/manifest'iyle ayrı supervisor paketi gerektirir. ERP/native/Hub uygulama binary source7a41 ve originalCRM5b6 paketi korunur.

## Ardıl makbuz güvenliği

`crm06-staff-refresh-successor.mjs` önce original parent settings/activation ve baseline/audit'i doğrular; audit.nextActivationHash original activation'a bağlıdır. Parent yeni activation'dan anahtar çıkarılarak uydurulmaz; original dosyalar değiştirilmez.

Child yalnız reviewed CRM source/package/manifest ve kopya CRM_TEST pinleri ile üç exact staff key farkından türetilir. ERP/native, roller/eski7+2profil, baseline/audit/catalog erişimi, eski agent3/issuer/request kayıtları ve provider-off sınırları korunur. Ayrı successor makbuzu gerçek child receipt hash'iyle ayarlara bağlıdır; self-reference yalnız projection digest'inden çıkarılır, actual receipt dosya hash'i ayrıca zorunludur. Rollback original settings/activation/Hub/supervisor/package referanslarını korur; otomatik restore/reset veya ticari ters işlem yok.

Hub CRM source/index pinini yalnız başlangıçta okuduğundan yeni Hub pin ve startup metadata da hazırlanır: yalnız crmSource/index ve HubConfigPath değişebilir; Hub binary, ERP source/operation ve sekiz eğitim dosyası korunur. Aktivasyonda sahipliği doğrulanmış Hub reload/aynı task metadata geçişi gerekir; yalnız core sağlık sonucu yüklenmiş Hub pini kanıtı değildir.

## Yeni journal'ın gerçek fiziksel hazırlığı

Yeni exact personel journal'ı metadata-only WindowsPS5.1/Win32 kontrolüyle sınandı: protected actorRoot, actual caller/owner/SYSTEM, yabancı Allow0, reparse/ADS/trailing-dot-space0; bütün10 referansın kimliği ve hardlink sayısı kontrol edilir. İlk çağrıda PS5 nested-JSON argv PARAMETERS biçim hatası verdi; güvenlik kontrolleri kaldırılmadan PS'nin bağımsız sabit10referans listesi kullanıldı, JS giriş ve çıktı whitelist'i korunur. Güvenli tanı yalnız9kapalı phase kodudur.

Gerçek PREPARE_REQUIRED sonrası root tek yazıcı olarak yalnız yeni boş `{schema:1,grants:[]}` dosyasını CreateNew/wx ve fsync ile hazırladı. Taze gerçek sonuç READY: journal single-link, parent protected, foreignAllow=false; mevcut8 referansın dosya kimlikleri aynı, application grant0. İçerik/DPAPI/token okunmadı. Aynı handle kimlik/ACL denetimi kurulum öncesi snapshot'tır; kalıcı oturum veya işletme yetkisi değildir. Runtime başlangıcı hem pinned READY hazırlığını hem taze fiziksel READY'yi zorunlu tutar. Gelecekte normal refresh'in atomic rename işlemi fileID değiştirebilir; bunun için preparation fileID'si kalıcı grant gibi kullanılmaz.

Yeni15 hedefli test PASS/0FAIL/0SKIP:5successor +10physical/diagnostic/transport test. Bağımsız kaynak incelemeleri GO; actualPS5.1 AST temiz. Original verifier değiştirilmedi. Paket/settings/task aktivasyonu ve yeni kurulu runtime henüz kanıtlanmadı. Yeni hazırlığın package/pin/ACL/rollback ve Hub geçiş koşulları doğrulanmadan çalışma paketleri değiştirilmez. Normal GUI/insan kabulü ve CRM06 kapanışı açık kalır.

# Later actual installation

The prepared successor was subsequently installed under the root-only shared TEST transition. Actual source/package/process/index/DB02/Hub readback and only the new staff official API session passed. The original parent, roles and old journals were preserved. [Installed result and remaining first-GUI component](installed.md) distinguish the recovered TEST runtime from source preparation and human acceptance. No old CI or acceptance was repeated; CRM06 remains open.
