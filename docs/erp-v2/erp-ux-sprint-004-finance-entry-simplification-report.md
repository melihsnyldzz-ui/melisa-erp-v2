# ERP UX Sprint 004 - Tahsilat ve Odeme Sadelestirme

## Is Problemi

Tahsilat ve odeme ekraninda dort ozet karti, yedi form alani, ayri etki paneli ve on kolonlu hareket tablosu ayni anda gorunuyordu. Temel cari ve tutar girisi ikincil finans alanlari arasinda kayboluyor, ekran ilk bakista gereksiz derecede yogun algilaniyordu.

## Hedef

Mevcut finans API, yetki, cari bakiye ve kasa/banka kurallarini degistirmeden akisi cari secimi, tutar girisi, etki kontrolu ve kayit sirasina indirmek.

## Uygulanan Degisiklikler

- Ustteki dort tekrarli ozet karti kaldirildi.
- Musteri tahsilati ve tedarikci odemesi tek segmented kontrolde korundu.
- Cari secimi kod veya adla aranabilen tek onerili alana donusturuldu.
- Cari aramasinda ortak Turkce karakter normalizasyonu kullanildi.
- Tutar ve kaydet komutu temel form satirinda sabit tutuldu.
- Tarih, para birimi, islem yontemi, kasa/banka ve aciklama acilir Islem Ayrintilari bolumune tasindi.
- Secili cari, mevcut bakiye ve yontem tek satirlik baglam ozetinde toplandi.
- Mevcut bakiye, islem tutari ve islem sonrasi bakiye yatay onizleme akisi haline getirildi.
- Hareket tablosu on kolondan alti temel kolona indirildi.
- Cari turu, belge, para birimi ve aksiyonlar ilgili ana kolonlarda birlestirildi.
- Makbuz ve ilgili kayda gitme islemleri ikonlu, erisilebilir butonlarda korundu.
- 1450, 980 ve 680 piksel kirilimlari icin guvenli responsive duzen eklendi.

## Kapsam Disi

- Tahsilat veya odeme API davranisi
- Cari bakiye hesaplama kurali
- Kasa ve banka hesap secim kurali
- Finans yetkileri
- Gercek tahsilat veya odeme kaydi
- Veritabani degisikligi

## Kabul Kriterleri

- Kullanici once cariyi, sonra tutari gorur ve kayit etkisini kontrol edebilir.
- Cari secilmeden veya pozitif tutar girilmeden kaydetme aktif olmaz.
- Ikincil alanlar kaybolmaz ve Islem Ayrintilari altinda erisilebilir kalir.
- Musteri tahsilati ve tedarikci odemesi ayrimi korunur.
- Makbuz ve ilgili cari/fis navigasyonu korunur.
- Kompakt masaustu ve mobil genisliklerde alanlar birbirinin ustune binmez.

## Dogrulama

- Web-admin production build: basarili, 1.895 modul donusturuldu.
- Finance entry UX smoke: 12/12 basarili.
- Finance form smoke: tum kontroller basarili.
- Layout smoke: tum kontroller basarili.
- Action clarity regresyon smoke: tum kontroller basarili.
- Canli tarayicida tahsilat ve odeme modu kontrolu basarili.
- Canli tarayicida cari arama, tutar girisi ve bakiye onizleme kontrolu basarili.
- 1366x768 ve 1920x1080 ekranlarda yatay tasma ve alan cakismasi bulunmadi.
- Kaydetme veya veritabani yazma islemi yapilmadi.

## Sonraki Sprint

ERP UX Sprint 005, musteri ve tedarikci liste/kart ekranlarinda arama, ozet ve temel aksiyonlari sadelestirecek.
