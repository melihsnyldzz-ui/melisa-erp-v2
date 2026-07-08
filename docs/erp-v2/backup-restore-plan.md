# Melisa ERP v2 Backup / Restore Plan

Tarih: 2026-05-22

Bu dokuman `MELISA_ERP_V2` icin production backup, restore, migration rollback ve operasyonel dogrulama standardini tanimlar. Vega veya `VEGA2026_WRITE_TEST` bu planin hedefi degildir.

## Kapsam

- Hedef database: `MELISA_ERP_V2`
- Backend: `apps/api`
- Web admin: `apps/web-admin`
- Terminal app: `apps/terminal-app`
- Yedek tipi: SQL Server full backup + opsiyonel differential/log backup
- Saklanacak dosyalar: SQL backup, deployment artifact, env key listesi, migration uygulama logu

## Kritik Kurallar

- Production secret backup dosyasi veya repo icine yazilmaz.
- Backup dosyasi dogrulanmadan restore planina guvenilmez.
- Restore islemi once test/staging database uzerinde denenir.
- Canli restore sadece onayli bakim penceresinde yapilir.
- Migration rollback planlanmadan production migration calistirilmaz.
- Vega DB'ye backup/restore ya da migration islemi yapilmaz.
- Backup dosyasi business data icerdigi icin backup alma islemi de insan onayi gerektirir.
- Reset, restore, migration, backup/restore cleanup ve production backup islemleri Melih onayi olmadan calistirilmaz.

## Sprint 007 Script Review

Reviewed script:

- `apps/api/scripts/backup-reset-melisa-db.mjs`

Observed safety guards:

- Target database is hardcoded as `MELISA_ERP_V2`.
- Script refuses to continue unless `SQL_DATABASE` is exactly `MELISA_ERP_V2`.
- Reset SQL contains an in-database `DB_NAME()` guard.
- Reset requires `--execute` and `--confirm=MELISA_ERP_V2_SIFIRLA`.
- Reset also requires `SQL_READ_ONLY=false`.
- Preview mode prints table counts and does not run backup or reset.
- Backup mode now also requires `--execute` and `--confirm=MELISA_ERP_V2_BACKUP_AL`.

Do not run this script from an AI session unless the exact operation has explicit Melih approval.

## Operator Runbook

### 1. Read-only preview

Purpose: confirm target, visible row counts, backup path candidate, and confirmation words.

```powershell
cd apps/api
npm run db:backup-reset:preview
```

Rules:

- This connects to SQL Server and reads counts.
- It must not be used to expose credentials or secrets.
- If `SQL_DATABASE` is not `MELISA_ERP_V2`, stop.
- If the preview output looks unexpected, stop and investigate before any write operation.

### 2. Approved backup

Purpose: create a SQL Server backup artifact after human approval.

Required approval:

- Melih must approve the backup operation.
- Backup destination must be known.
- Backup access must be restricted.

Command shape after approval:

```powershell
node scripts/backup-reset-melisa-db.mjs --backup --execute --confirm=MELISA_ERP_V2_BACKUP_AL
```

Notes:

- The package script `npm run db:backup` is intentionally locked unless the execute and confirmation flags are passed through.
- SQL backup files must stay outside Git.
- Do not paste backup file contents, database contents, or `.env.local` values into chat or docs.

### 3. Approved backup-reset

Purpose: create a backup and then reset operational ERP data.

Required approval:

- Melih must approve this exact destructive operation.
- Current target database must be verified as `MELISA_ERP_V2`.
- A maintenance window must be agreed.
- Services using the database must be stopped or isolated if needed.

Command shape after approval:

```powershell
node scripts/backup-reset-melisa-db.mjs --backup-reset --execute --confirm=MELISA_ERP_V2_SIFIRLA
```

Rules:

- Never run against Vega databases.
- Never run as a casual cleanup step.
- Preserve users, roles, permissions, currency rates, and system settings unless a separate approved plan says otherwise.

### 4. Restore verification plan

Restore is not automated by the reviewed script. A restore must be treated as an operator-controlled SQL Server action.

Minimum verification sequence:

1. Run `RESTORE VERIFYONLY` or the approved SQL Server equivalent on the backup file.
2. Restore first into `MELISA_ERP_V2_RESTORE_TEST` or another approved staging database.
3. Point a staging API environment at the staging database.
4. Run the restore smoke list below.
5. Record backup file name, restore target, date, operator, and smoke result.
6. Only then consider a production restore during an approved maintenance window.

## SQL Backup Strategy

### Nightly full backup

Onerilen zaman: her gece operasyon disi saat.

Backup adi:

```text
MELISA_ERP_V2_FULL_YYYYMMDD_HHMMSS.bak
```

Onerilen saklama:

- Lokal SQL backup path: son 7 gun
- Harici disk/NAS: son 30 gun
- Aylik arsiv: 6-12 ay

### Differential backup

Yuksek veri hacmi basladiginda gunde 2-4 kez differential backup alinabilir.

```text
MELISA_ERP_V2_DIFF_YYYYMMDD_HHMMSS.bak
```

### Transaction log backup

Recovery model `FULL` yapilirsa transaction log backup planlanmalidir. Ilk production fazinda isletme operasyonu basit tutulacaksa `SIMPLE` recovery ile baslamak kabul edilebilir; bu karar production'a gecmeden once netlestirilmelidir.

## Backup Dogrulama

Her backup sonrasi en az su kontroller yapilmalidir:

| Kontrol | Beklenen |
| --- | --- |
| Dosya olustu mu | Evet |
| Dosya boyutu makul mu | Evet |
| `RESTORE VERIFYONLY` basarili mi | Evet |
| Backup tarihi dogru mu | Evet |
| Hedef database adi `MELISA_ERP_V2` mi | Evet |
| Backup loglandi mi | Evet |

Boyut benzerligi tek basina dogrulama sayilmaz.

## Restore Strategy

### Staging restore

Production backup ilk once staging/test database'e restore edilir.

Onerilen test restore adi:

```text
MELISA_ERP_V2_RESTORE_TEST
```

Kontroller:

- Database online mi?
- Ana tablolar var mi?
- Kullanici/rol tablolarinda veri var mi?
- Urun/cari/fiş sayilari makul mu?
- Son audit log tarihi beklenen aralikta mi?
- API `.env.local` staging database'e bakarken `/api/sql/health` calisiyor mu?

### Production restore

Production restore sadece su sartlarda yapilir:

- Isletme onayi var.
- Bakim penceresi acildi.
- Mevcut production database icin son durum backup'i alindi.
- Restore edilecek backup staging uzerinde dogrulandi.
- Uygulama servisleri durduruldu.
- Restore sonrasi smoke test listesi hazir.

## Restore Sonrasi Smoke Test

- `/api/health`
- `/api/sql/health`
- `/api/auth/login`
- `/api/auth/me`
- `/api/products?page=1&limit=5`
- `/api/customers?page=1&limit=5`
- `/api/dashboard/summary`
- `/api/monitoring/summary`
- Web-admin login
- Stok listesi
- Cari listesi
- Dashboard KPI
- Terminal app login
- Terminal product lookup

## Migration Rollback Notlari

Migration rollback icin genel kural:

1. Migration oncesi full backup al.
2. Migration scriptini staging uzerinde calistir.
3. Smoke test gecmeden production migration calistirma.
4. Production migration sonrasi tekrar smoke test yap.
5. Geri donus gerekiyorsa destructive SQL ile elle geri alma yerine dogrulanmis backup restore planini kullan.

Bu repo production'da `DROP`, `TRUNCATE`, kontrolsuz `DELETE` mantigini normal rollback yontemi olarak kabul etmez.

## Backup Saklama ve Erisim

- Backup klasoru sadece yetkili admin tarafindan erisilebilir olmalidir.
- Backup dosyalari mumkunse disk seviyesinde sifreli alanda tutulmalidir.
- Offsite/NAS kopyasi icin erisim loglari tutulmalidir.
- Backup dosyalari e-posta veya mesajlasma uygulamasiyla paylasilmamalidir.

## Production Riskleri

- SQL backup job kurulmadan canli kullanima gecilmemeli.
- Restore testi yapilmamis backup guvenli kabul edilmemeli.
- `.env.local` veya secret dosyalari backup artifact icine karismamali.
- Terminal offline queue verisi cihaz lokalinde kaldigi icin cihaz kaybi senaryosu ayri ele alinmali.
- Import dosyalari ve upload gecici dosyalari backup stratejisine dahil edilmemeli; audit/import sonuc kayitlari yeterli olmalidir.
