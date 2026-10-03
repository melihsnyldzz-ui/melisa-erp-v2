# Melisa ERP v2

Melisa ERP v2, Melisa Baby'nin stok, alış, satış, cari, tahsilat/kasa ve terminal işlerini yöneten mevcut ERP uygulamasıdır.

## Güncel bitirme düzeni

**İlk okunacak kaynak: [ERP_FINISH_PLAN.md](ERP_FINISH_PLAN.md).** Günlük kısa durum [STATUS.md](STATUS.md), kaynak/ortam kanıtları [3 Ekim envanteri](docs/erp-v2/inventory-20261003.md) içindedir. Çalışan ERP baseline kabul edilir; geçmiş kabulü olan özellikler yeniden geliştirilmez.

GitHub `main`, çalışan LIVE kaynakla henüz eşleştirilmiş değildir. TEST/LIVE portları ve DB'leri için bitirme planını esas alın; aşağıdaki geliştirme komutlarını doğrudan üretim launcher'ı saymayın.

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

Repo çalışan API, web-admin, terminal ve Electron uygulama kodu içerir. Eski implementation roadmap ilk kuruluşun tarihsel kaydıdır; güncel iş sırası `ERP_FINISH_PLAN.md` içindedir.

## API Gelistirme

API `apps/api` altında Node.js + Express ile çalışır. SQL, Vega ve auth bağlantıları ortama bağlıdır; kapalı veya mock oldukları varsayılmaz. Aşağıdaki yollar geliştirme referansıdır; çalışan TEST/LIVE kaynağı ve DB eşlemesi bitirme planında takip edilir.

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

Örnek API yolları:

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
