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

API foundation `apps/api` altinda Node.js + Express ile baslatilir. Simdilik SQL Server, Vega ve auth database baglantisi kapalidir; endpointler mock veri doner.

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
