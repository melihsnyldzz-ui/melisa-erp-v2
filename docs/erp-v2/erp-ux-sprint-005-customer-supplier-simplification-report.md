# ERP UX Sprint 005 - Musteri ve Tedarikci Sadelestirme

## Is Problemi

Musteri ve tedarikci listelerinde cok sayida filtre, kolon, komut ve ozet karti ayni anda gorunuyordu. Kart ekranlarinda 360 ozetleri, son hareket listeleri, duzenleme formlari ve detay tablolarinin birlikte acik olmasi temel bilginin bulunmasini zorlastiriyordu.

## Hedef

Mevcut cari ve tedarikci API davranisini, bakiye kurallarini ve kayit islemlerini degistirmeden liste aramasini ve kart ozetlerini ilk bakista anlasilir hale getirmek.

## Uygulanan Degisiklikler

- Musteri listesine kod, unvan, telefon, sehir ve ulkeyi birlikte tarayan tek hizli arama alani eklendi.
- Para birimi, durum ve bakiye filtreleri temel satirda tutuldu.
- Kod, unvan, telefon, sehir, ulke, cari tipi ve liste limiti ayrintili filtrelere tasindi.
- Excel, yazdir, kolonlar ve pasif kayitlar komutlari acilir diger islemler menusunde toplandi.
- Musteri ve tedarikci listelerinin varsayilan kolonlari gunluk kullanilan alanlara indirildi.
- Tedarikci listesindeki dort buyuk KPI karti tek satirlik kompakt ozete donusturuldu.
- Tedarikci filtrelerine tek komutla temizleme eklendi.
- Musteri ve tedarikci 360 ekranlarindaki son hareket ve urun listeleri acilir bolume tasindi.
- Kart bilgi formlari izleme modunda kapali, yeni kayit veya duzenleme modunda acik calisacak hale getirildi.
- Yeni stiller yalnizca musteri ve tedarikci ekranlarini etkileyen ayri bir dosyada tutuldu.

## Kapsam Disi

- Cari veya tedarikci API degisikligi
- Bakiye ve hareket hesaplama kurali
- Kayit, pasife alma veya belge yazma islemi
- Veritabani veya migration degisikligi
- Buyuk ekran tema degisikligi

## Kabul Kriterleri

- Temel liste arama ve filtreleri ilk bakista gorunur.
- Ikincil filtre ve komutlar kaybolmadan ihtiyac halinde acilir.
- Musteri ve tedarikci listeleri varsayilan olarak en fazla yedi temel kolon gosterir.
- Kartlarda 360 ozetleri gorunur, uzun iz listeleri ve bilgi formlari kontrollu acilir.
- 1366x768 ve 1920x1080 ekranlarda yatay tasma veya kontrol cakismasi bulunmaz.

## Dogrulama

- Web-admin production build: basarili, 1.896 modul donusturuldu.
- Entity UX smoke: 12/12 basarili.
- Layout smoke: tum kontroller basarili.
- List scope smoke: tum kontroller basarili.
- Action clarity regresyon smoke: tum kontroller basarili.
- Canli tarayicida musteri listesi 6, tedarikci listesi 7 varsayilan kolonla dogrulandi.
- Canli tarayicida ayrintili filtrelerin ve kart detaylarinin kapali basladigi dogrulandi.
- 1366x768 ve 1920x1080 kontrollerinde belge veya ekran yatay tasmasi bulunmadi.
- Kayit veya veritabani yazma islemi yapilmadi.

## Sonraki Sprint

ERP UX Sprint 006, stok liste ve urun kartinda tablo, filtre ve urun 360 bilgi yogunlugunu azaltacak.
