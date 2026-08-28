# ERP UX Sprint 003 - Alis Fisi ve Toplu Alis Sadelestirme

## Is Problemi

Normal alis fisinde tedarikci ve urun icin hem arama hem secim alanlari bulunuyordu. Toplu alis ekraninda dokuz kontrol tek satira sigdiriliyor, Satir Ekle dugmesi dar ekranlarda kenara gomuluyor ve tedarikci/urun bilgileri birden fazla buyuk panelde tekrarlaniyordu.

## Hedef

Mevcut tedarikci-urun eslesme kurallarini koruyarak normal ve toplu alis girisini soldan saga ilerleyen tek bir is akisi haline getirmek.

## Uygulanan Degisiklikler

- Normal alis toolbar komutlari taslak ve kesinlesmis duruma gore ayrildi.
- Kesinlesmis veya iptal edilmis alis fisinde giris paneli gizlendi.
- Tedarikci arama/secim alanlari tek onerili giriste birlestirildi.
- Urun arama/secim alanlari tek barkod ve urun girisinde birlestirildi.
- Bos arama sonucunda ilk urunun otomatik secilmesi kaldirildi.
- Yeni fis acildiginda onceki urun secimi sifirlanir hale getirildi.
- Tekrarlanan karar kartlari ve tedarikci snapshot alani tek satirlik baglam ozetine donusturuldu.
- Kur, iskonto ve aciklama acilir fis ayarlari bolumune alindi.
- Alis urun tablosu varsayilan durumda temel kolonlara indirildi.
- Net ve birim TRY maliyetleri istege bagli Maliyet Detayi ile acilir hale getirildi.
- Toplamlar adet, satir ve genel toplamla kompakt hale getirildi.
- Toplu alista tedarikci ve urun arama/secimleri birlestirildi.
- Toplu alis girisi tarih, tedarikci, urun, miktar, fiyat, iskonto ve sabit Satir Ekle duzenine getirildi.
- Toplu alis tablosunda barkod ve para birimi urun alt bilgisinde birlestirildi.
- Sade gorunumun satis ve alis ana giris panellerini yanlislikla gizlemesi engellendi.

## Kapsam Disi

- Tedarikci-urun eslesme is kuralinin degistirilmesi
- Fis kaydetme veya kesinlestirme API davranisinin degistirilmesi
- Veritabani ve maliyet hesaplama degisikligi
- Alis/satis yetkilerinin degistirilmesi

## Kabul Kriterleri

- Normal alista tedarikci ve urun tek alanlardan secilebilir.
- Tedarikci secilmeden urun eklenemez.
- Ilk tedarikci veya ilk urun otomatik secilmez.
- Kesinlesmis alis fisi veri giris kontrolu gostermez.
- Toplu alista Satir Ekle dugmesi masaustu cozumlerinde gorunur kalir.
- Sade gorunum temel fis girisini gizlemez.
- Maliyet, iskonto ve kur bilgileri kaybolmaz; istege bagli ayrintilarda erisilebilir kalir.

## Dogrulama

- Web-admin production build: basarili, 1.894 modul donusturuldu.
- Purchase invoice UX smoke: 22/22 basarili.
- Sales invoice UX regresyon smoke: 13/13 basarili.
- Invoice boundary smoke: 7/7 basarili.
- Layout smoke: tum kontroller basarili.
- Canli tarayicida normal alista ADN CORAP ve 1071 / BEBE TULUM secimi kalici gorundu.
- Canli tarayicida toplu alista tedarikci ve urun secimi kalici gorundu; alan cakismasi bulunmadi.
- Canli tarayicida Sade gorunum temel alis ve satis girislerini gorunur tuttu.
- Kaydetme, kesinlestirme veya veritabani yazma islemi yapilmadi.

## Sonraki Sprint

ERP UX Sprint 004, tahsilat ve odeme akisini cari secimi, tutar girisi ve islem etkisi odaginda sadelestirecek.
