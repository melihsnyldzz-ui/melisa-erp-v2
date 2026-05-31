# Melisa ERP v2 Web Admin Demo Deploy Guide

## Amaç

Bu dokuman, `apps/web-admin` uygulamasini Vercel uzerinde sadece demo review mode ile yayinlamak icindir.

Bu deploy backend calistirmaz, SQL'e baglanmaz, migration calistirmaz ve secret gerektirmez. Uygulama yalnizca `VITE_DEMO_MODE=true` iken lokal demo verileriyle calisir.

## Vercel Proje Ayarlari

Vercel'de yeni proje olustururken GitHub reposu olarak `melihsnyldzz-ui/melisa-erp-v2` secilmelidir.

Build ayarlari:

- Framework Preset: `Vite`
- Root Directory: `apps/web-admin`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Repo root seviyesindeki `vercel.json`, proje yanlislikla repo kokunden import edilirse web-admin dizinine gecerek build alacak sekilde hazirlanmistir. Yine de onerilen ve temiz kurulum Vercel Project Settings icinde Root Directory alanini `apps/web-admin` yapmaktir.

## Environment Variables

Vercel Project Settings > Environment Variables alanina su degerler eklenmelidir:

```text
VITE_DEMO_MODE=true
VITE_API_BASE_URL=
```

Alternatif olarak API base URL bos birakilamiyorsa:

```text
VITE_API_BASE_URL=http://127.0.0.1:4100
```

Demo mode acikken frontend servisleri gercek API'ye fetch atmaz. Bu nedenle bu URL deployda kullanilmaz; sadece Vite env sozlesmesini acik tutmak icin tanimlanabilir.

Secret eklenmemelidir.

## Deploy Adimlari

1. Vercel dashboard'da `Add New Project` sec.
2. GitHub entegrasyonundan `melihsnyldzz-ui/melisa-erp-v2` reposunu sec.
3. Root Directory alanini `apps/web-admin` olarak ayarla.
4. Framework Preset olarak `Vite` secili oldugunu kontrol et.
5. Install Command alanini `npm install` yap.
6. Build Command alanini `npm run build` yap.
7. Output Directory alanini `dist` yap.
8. Environment Variables alanina `VITE_DEMO_MODE=true` ekle.
9. `VITE_API_BASE_URL` degerini bos veya `http://127.0.0.1:4100` olarak ekle.
10. Deploy'u baslat.

## Deploy Sonrasi Kontrol Listesi

- Login ekrani aciliyor mu?
- Herhangi bir kullanici adi/sifre ile demo login geciliyor mu?
- Ustte `DEMO MODE` banner'i gorunuyor mu?
- StatusBar'da `DEMO MODE`, `API kapali`, `SQL kapali` gorunuyor mu?
- Dashboard demo KPI'lari geliyor mu?
- Stok Listesi demo urunleri geliyor mu?
- Urun Karti aciliyor mu?
- Cari Listesi demo carileri geliyor mu?
- Cari Karti aciliyor mu?
- Satis Fisi aciliyor mu?
- Kaydet/Kesinlestir islemleri `Demo islem kaydedilmedi.` mesaji veriyor mu?
- Alis Fisi aciliyor mu?
- Import ekrani aciliyor mu?
- Browser network loglarinda `/api/*` istekleri olmadigi dogrulaniyor mu?

## Gercek API Modu

`VITE_DEMO_MODE=false` veya env eksikse uygulama gercek API modunda calisir. Bu durumda API kapaliysa login ve ekran servisleri network error vermelidir. Vercel demo deploy icin bu mod kullanilmamalidir.

## Guvenlik Sinirlari

- Backend deploy edilmez.
- SQL Server baglantisi kurulmaz.
- Migration calistirilmaz.
- Secret veya production credential eklenmez.
- Demo verileri gercek ticari veri gibi kabul edilmez.
- Demo mode sadece UI review amaclidir; kaydetme, finalize ve import commit islemleri kalici veri yazmaz.
