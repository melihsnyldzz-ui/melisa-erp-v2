# Melisa ERP v2 Production Readiness Checklist

Tarih: 2026-05-22

Bu checklist Melisa ERP v2'nin production'a yaklasirken gecmesi gereken teknik kontrol listesidir.

## Infra

- [ ] Production host secildi.
- [ ] Reverse proxy planlandi.
- [ ] API, web-admin ve SQL Server ayni network politikasinda tanimlandi.
- [ ] Windows service / process manager stratejisi belirlendi.
- [ ] Disk kapasitesi ve backup path planlandi.
- [ ] Saat/timezone senkronizasyonu kontrol edildi.

## DB

- [ ] Hedef database sadece `MELISA_ERP_V2`.
- [ ] Vega DB production akisi icin hedef degil.
- [ ] Production migration staging uzerinde denendi.
- [ ] SQL kullanicisi minimum yetkiyle tanimlandi.
- [ ] `SQL_TRUST_SERVER_CERTIFICATE` production icin gozden gecirildi.
- [ ] `DELETE`, `DROP`, `TRUNCATE` iceren operasyon scriptleri yok.
- [ ] `/api/sql/health` auth arkasinda calisiyor.

## Security

- [ ] Production secret'lar repo disinda tutuluyor.
- [ ] JWT secret'lar 32+ karakter ve guclu.
- [ ] CORS production origin listesi net.
- [ ] Secure headers aktif.
- [ ] API rate limit aktif.
- [ ] Request body limit kontrollu.
- [ ] Token/credential log masking aktif.
- [ ] Brute-force mitigation backlog'a alindi.

## Auth

- [ ] Login/logout calisiyor.
- [ ] `/api/auth/me` token gerektiriyor.
- [ ] Protected read/write endpointleri token gerektiriyor.
- [ ] Permission middleware kritik islemlerde aktif.
- [ ] Refresh token revoke calisiyor.
- [ ] Refresh token rotation production TODO listesinde.
- [ ] Session timeout politikasi belirlendi.

## Backup

- [ ] Nightly full SQL backup job kuruldu.
- [ ] Backup dosya adi standardi tanimlandi.
- [ ] Backup scripti insan onayi, `--execute` ve confirmation olmadan artifact uretmiyor.
- [ ] Backup scripti `SQL_DATABASE=MELISA_ERP_V2` guard'i olmadan calismiyor.
- [ ] `RESTORE VERIFYONLY` veya muadili dogrulama yapiliyor.
- [ ] Staging restore testi yapildi.
- [ ] Restore sonrasi smoke test listesi hazir.
- [ ] Backup saklama suresi ve erisim yetkisi belirlendi.
- [ ] Backup dosyalari Git, chat, e-posta ve herkese acik paylasim kanallari disinda tutuluyor.

## Monitoring

- [ ] `/api/health` uptime icin izleniyor.
- [ ] `/api/sql/health` DB connection icin izleniyor.
- [ ] `/api/monitoring/summary` auth arkasinda izleniyor.
- [ ] Pending terminal sync count takip ediliyor.
- [ ] Failed terminal sync count takip ediliyor.
- [ ] Import failure loglari takip ediliyor.
- [ ] Finalize failure loglari takip ediliyor.
- [ ] Audit anomaly review periyodu belirlendi.

## Deploy

- [ ] Web-admin build artifact uretildi.
- [ ] API start komutu production'da dogrulandi.
- [ ] Env dosyalari production hostta var.
- [ ] `NODE_ENV=production` ile smoke test yapildi.
- [ ] Rollback artifact ve backup hazir.
- [ ] Deploy notlari ve operator sorumlusu belirlendi.

## Terminal

- [ ] Expo Android build stratejisi belirlendi.
- [ ] Fiziksel cihazda API LAN URL test edildi.
- [ ] Android cleartext/LAN network policy dogrulandi.
- [ ] Terminal login/logout test edildi.
- [ ] Barkod scanner Enter davranisi test edildi.
- [ ] Offline queue bozulma senaryosu test edildi.
- [ ] Sync retry/backoff stratejisi backend ile uyumlu.
- [ ] Barcode flood rate-limit veya client guard planlandi.

## Import

- [ ] Import preview zorunlu.
- [ ] Validation fail olursa DB'ye yazma yok.
- [ ] Import body size limit tanimli.
- [ ] Dosya tipi ve kolon validation net.
- [ ] Duplicate detection calisiyor.
- [ ] Import commit transaction icinde.
- [ ] Import audit log yaziyor.
- [ ] `xlsx` paket advisory riski kabul/mitigate edildi.

## Rollback

- [ ] Migration oncesi backup zorunlu.
- [ ] Restore test edilmeden production rollback kabul edilmiyor.
- [ ] Destructive SQL rollback yontemi degil.
- [ ] Reset/restore/cleanup islemleri Melih onayi ve bakim penceresi olmadan calistirilmiyor.
- [ ] Reset scripti `--execute --confirm=MELISA_ERP_V2_SIFIRLA` olmadan destructive islem yapmiyor.
- [ ] Deploy onceki commit hash kayit altinda.
- [ ] Operator rollback sorumlusu belli.

## Logging

- [ ] Request id response header'a yaziliyor.
- [ ] Slow request warning aktif.
- [ ] Error response production'da stack trace dondurmuyor.
- [ ] Credential/token masking aktif.
- [ ] Auth/finalize/import hata kategorileri loglarda ayrilabiliyor.
- [ ] Log saklama ve arsiv politikasi belirlendi.

## HTTPS

- [ ] Reverse proxy HTTPS terminasyonu hazir.
- [ ] Production CORS sadece HTTPS origin kabul ediyor.
- [ ] Secure cookie/token storage politikasi belirlendi.
- [ ] HTTP -> HTTPS redirect planlandi.

## Production Secrets

- [ ] `.env.local` commit edilmiyor.
- [ ] Secret'lar deployment host secret store veya korumali dosyada.
- [ ] JWT secret rotation plani var.
- [ ] SQL password loglanmiyor.
- [ ] Terminal API URL secret degil ama ortam bazli tanimli.

## User Onboarding

- [ ] Admin kullanici sifresi production'da degistirildi.
- [ ] Roller ve permission matrisi kontrol edildi.
- [ ] Kullanici egitim notlari hazir.
- [ ] Kritik islem onaylari kullaniciya anlatildi.
- [ ] Backup/restore sorumlusu belirlendi.
- [ ] Terminal cihaz teslim ve cihaz kodu listesi hazir.
