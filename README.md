> **MELISA ERP / SEMIH kanonik geliştirme kökü:** `C:\Sirket\ERP\melisa-erp-v2`. Önce [AGENTS.md](AGENTS.md), [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md) ve [STATUS.md](STATUS.md) oku. Aktif ajan dalı `codex/erp-agents-on-canonical-20261003`; kod tabanı `e82262b1d120f4c461a2456d67e34c115578d7ba`. Eski kaynaklar kanıt/arşivdir; çalışan runtime ayrı korunur.

# Melisa ERP v2

Melisa ERP v2, Melisa Bebe için web tabanlı, desktop-first ve Vega/Wolvox hissinde tasarlanacak yeni ERP projesidir.

## Hedef

- Web tabanlı web-admin deneyimi.
- Desktop-first, yoğun ERP çalışma alanı.
- İleride Electron'a uygun mimari.
- Android terminal app desteği.
- SQL Server uyumlu backend ve veri modeli.
- Çoklu döviz, stok, cari, satış, alış, katalog, audit ve terminal sync desteği.

## Repo Yapısı

```text
apps/
  web-admin/
  api/
  terminal-app/
packages/
  ui/
  shared/
docs/
  erp-v2/
scripts/
infra/
```

## Dokümantasyon

ERP v2 karar ve mimari dokümanları ana kaynak olarak [docs/erp-v2](docs/erp-v2/README.md) altında tutulur.

Kodlamaya başlamadan önce özellikle şu dosyalar okunmalıdır:

- [Karar Defteri](docs/erp-v2/karar-defteri.md)
- [UI Blueprint](docs/erp-v2/ui-blueprint.md)
- [Implementation Roadmap](docs/erp-v2/implementation-roadmap.md)

## Geliştirme Notu

Bu repo iskeleti henüz uygulama kodu veya package kurulumu içermez. İlk kod sprinti `docs/erp-v2/implementation-roadmap.md` içindeki Faz 1 kapsamına göre başlatılmalıdır.

## API Gelistirme

API foundation `apps/api` altinda Node.js + Express ile baslatilir. Vega ve auth database baglantisi kapalidir. `GET /api/products` ve `GET /api/customers` endpointleri `MELISA_ERP_V2` uzerinden SELECT-only SQL okuma yapar; diger endpointler simdilik mock veri doner.

```powershell
cd apps/api
npm install
npm run dev
npm run start
```

Varsayilan API adresi:

```text
http://127.0.0.1:4100/api
```

Ilk mock endpointler:

- `GET /api/health`
- `GET /api/version`
- `GET /api/dashboard/summary`
- `GET /api/products`
- `GET /api/customers`
- `GET /api/sales-invoices`
- `GET /api/purchase-invoices`

SQL SELECT-only endpoint ornekleri:

```text
GET /api/products?page=1&limit=20&activeOnly=true&search=tulum
GET /api/customers?page=1&limit=20&activeOnly=true&search=istanbul
GET /api/sql/health
GET /api/sql/tables-preview
```

`/api/products` ve `/api/customers` response alanlari barkod ve telefon gibi hassas degerleri maskeler. Liste limitleri en fazla `100` satirla sinirlidir ve sorgular parametreli SQL ile calisir.

## Terminal App v2

Android depo terminali foundation `apps/terminal-app` altinda Expo ile baslatilir.

```powershell
cd apps/terminal-app
npm install
npm run start
npm run android
```

Terminal app mevcut auth API ile login olur, `/api/products` uzerinden barkod/urun lookup yapar ve offline-first local queue/cache temelini kullanir. Fiziksel Android cihazda `EXPO_PUBLIC_API_BASE_URL` LAN IP ile verilmelidir.

## Production Readiness

Production hazirlik dokumanlari:

- [Backup / Restore Plan](docs/erp-v2/backup-restore-plan.md)
- [Production Readiness Checklist](docs/erp-v2/production-readiness-checklist.md)
- [QA Stabilization Report](docs/erp-v2/qa-stabilization-report.md)
