# Melisa ERP Muhasebe Kabul Test Akisi

Tarih: 2026-07-10

Amac: muhasebe ve operasyon ekibinin Melisa ERP v2'yi gercek is senaryosu gibi test etmesi, stok/cari/alis/satis/finans etkilerinin dogru calistigini kanitlamasi ve son kabul kararini yazili hale getirmesi.

Bu dokuman egitim ve kabul testi icindir. Test sirasinda gercek musteriler, gercek tedarikciler veya canli ticari kayitlar kullanilmamalidir. Test icin ayri test cari ve test urunleri acilmalidir.

## 1. Test Kurali

- Testi tek kisi yapabilir, ama muhasebe sorumlusu sonucu onaylamalidir.
- Her adimda beklenen sonuc kontrol edilmelidir.
- Sorun gorulurse isleme devam edilmeden not alinmalidir.
- Ekran goruntusu alinacaksa sifre, token, SQL bilgisi veya gizli bilgi gorunmemelidir.
- WhatsApp, dis mesaj, production deploy, backup/restore, reset, migration veya toplu import apply bu testin parcasi degildir.

## 2. Test Bilgileri

| Alan | Doldurulacak Bilgi |
|---|---|
| Test tarihi |  |
| Testi yapan kisi |  |
| Muhasebe sorumlusu |  |
| ERP adresi |  |
| API adresi |  |
| Test ortami | Lokal / Ic kullanim / Diger |
| Baslangic commit |  |
| Final karar | Gecti / Uyariyla gecti / Kaldi |

## 3. Kullanilacak Test Kayitlari

Bu isimler testte sabit kullanilsin. Boylece sonradan hareketleri bulmak kolay olur.

| Kayit tipi | Test adi | Para birimi | Not |
|---|---|---|---|
| Tedarikci | TEST TEDARIKCI MUHASEBE 001 | TRY | Alis ve odeme testi icin |
| Musteri | TEST MUSTERI MUHASEBE 001 | TRY | Satis ve tahsilat testi icin |
| Urun | TEST MUHASEBE URUN 001 | TRY | Stok, alis ve satis testi icin |
| Marka | TEST MARKA |  | Urun karti icin |
| Kategori | TEST KATEGORI |  | Urun karti icin |
| Kasa/Banka | Testte uygun kasa/banka secilecek | TRY | Tahsilat ve odeme icin |

Onerilen test tutarlari:

| Alan | Deger |
|---|---:|
| Alis miktari | 10 |
| Alis birim fiyat | 100 |
| Satis miktari | 4 |
| Satis birim fiyat | 150 |
| Musteri tahsilati | 300 |
| Tedarikci odemesi | 500 |

## 4. Baslangic Kontrolu

| No | Test | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | ERP'ye giris yap | Ana ekran acilmali |  |  |
| 2 | Stok Listesi ac | Liste veya bos durum net gorunmeli |  |  |
| 3 | Musteri Cari Listesi ac | Liste ve arama calismali |  |  |
| 4 | Tedarikci Cari Listesi ac | Liste ve arama calismali |  |  |
| 5 | Finans Ozeti ac | Ozet degerler okunabilir olmali |  |  |
| 6 | Operasyon Masasi ac | Kritik uyarilar ve son hareketler gorunmeli |  |  |
| 7 | Raporlar menusu ac | Rapor ekranlari hata vermeden acilmali |  |  |

## 5. Tedarikci Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Yeni tedarikci ac | Tedarikci karti kaydedilmeli |  |  |
| 2 | Tedarikci adi olarak `TEST TEDARIKCI MUHASEBE 001` gir | Aramada bu isimle bulunmali |  |  |
| 3 | Para birimini TRY sec | Tedarikci listesinde TRY gorunmeli |  |  |
| 4 | Tedarikci ekstresini ac | Baslangicta hareket olmamali veya onceki testler net ayrilmali |  |  |
| 5 | Tedarikci 360/ekstre ozetini kontrol et | Bakiye, alis, odeme alanlari okunabilir olmali |  |  |

## 6. Musteri Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Yeni musteri ac | Musteri karti kaydedilmeli |  |  |
| 2 | Musteri adi olarak `TEST MUSTERI MUHASEBE 001` gir | Aramada bu isimle bulunmali |  |  |
| 3 | Para birimini TRY sec | Musteri listesinde TRY gorunmeli |  |  |
| 4 | Musteri ekstresini ac | Baslangicta hareket olmamali veya onceki testler net ayrilmali |  |  |
| 5 | Musteri bakiye kolonunu kontrol et | Borc/alacak yonu anlasilir olmali |  |  |

## 7. Urun ve Stok Karti Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Yeni urun karti ac | Urun karti kaydedilmeli |  |  |
| 2 | Urun adini `TEST MUHASEBE URUN 001` gir | Stok listesinde bulunmali |  |  |
| 3 | Marka `TEST MARKA` gir | Marka alaninda dogru gorunmeli |  |  |
| 4 | Kategori `TEST KATEGORI` gir | Kategori alaninda dogru gorunmeli |  |  |
| 5 | Ana tedarikciyi test tedarikci sec | Alis fisinde tedarikci-urun uyumu saglanmali |  |  |
| 6 | Alis fiyatini 100 gir | Urun kartinda alis fiyati dogru gorunmeli |  |  |
| 7 | Satis fiyatini 150 gir | Urun kartinda satis fiyati dogru gorunmeli |  |  |
| 8 | Urun 360 ac | Stok, fiyat, tedarikci ve son hareket alanlari okunmali |  |  |

## 8. Alis Fisi Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Yeni alis fisi ac | Bos alis fisi acilmali |  |  |
| 2 | Tedarikci olarak test tedarikciyi sec | Fis tedarikciye baglanmali |  |  |
| 3 | Test urununu ekle | Urun satira gelmeli |  |  |
| 4 | Miktar 10, alis fiyat 100 gir | Fis tutari 1000 TRY olmali |  |  |
| 5 | Fisi taslak olarak kaydet | Taslak stok ve bakiye etkisi yaratmamali |  |  |
| 6 | Urun stokunu kontrol et | Taslak asamasinda stok artmamali |  |  |
| 7 | Tedarikci ekstresini kontrol et | Taslak asamasinda tedarikci borcu artmamali |  |  |
| 8 | Alis fisini kesinlestir | Fis finalized/kesin durumuna gecmeli |  |  |
| 9 | Urun stokunu kontrol et | Stok 10 adet artmali |  |  |
| 10 | Tedarikci ekstresini kontrol et | Tedarikci alacak/bakiye etkisi 1000 TRY gorunmeli |  |  |
| 11 | Finans/rapor ekranini kontrol et | Alis hareketi raporlarda izlenebilir olmali |  |  |

## 9. Satis Fisi Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Yeni satis fisi ac | Bos satis fisi acilmali |  |  |
| 2 | Musteri olarak test musteriyi sec | Fis musteriye baglanmali |  |  |
| 3 | Test urununu ekle | Urun satira gelmeli |  |  |
| 4 | Miktar 4, satis fiyat 150 gir | Fis tutari 600 TRY olmali |  |  |
| 5 | Fisi taslak olarak kaydet | Taslak stok ve bakiye etkisi yaratmamali |  |  |
| 6 | Urun stokunu kontrol et | Taslak asamasinda stok azalmamali |  |  |
| 7 | Musteri ekstresini kontrol et | Taslak asamasinda musteri borcu artmamali |  |  |
| 8 | Satis fisini kesinlestir | Fis finalized/kesin durumuna gecmeli |  |  |
| 9 | Urun stokunu kontrol et | Stok 4 adet azalmali, alistan kalan stok 6 olmali |  |  |
| 10 | Musteri ekstresini kontrol et | Musteri borcu/bakiye etkisi 600 TRY gorunmeli |  |  |
| 11 | Kar/rapor ekranini kontrol et | Satis hareketi ve maliyet etkisi anlasilir olmali |  |  |

## 10. Tahsilat Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Tahsilat/Odeme ekranini ac | Ekran acilmali |  |  |
| 2 | Musteri tahsilati sec | Musteri secimi aktif olmali |  |  |
| 3 | Test musteriyi sec | Mevcut bakiye 600 TRY civarinda gorunmeli |  |  |
| 4 | Tahsilat tutari 300 TRY gir | Islem etkisi onizlemede bakiye azalmasi olarak gorunmeli |  |  |
| 5 | Tahsilati kaydet | Musteri bakiyesi 300 TRY azalmalidir |  |  |
| 6 | Musteri ekstresini kontrol et | Tahsilat hareketi gorunmeli |  |  |
| 7 | Finans hareketlerini kontrol et | Kasa/banka hareketi gorunmeli |  |  |

## 11. Tedarikci Odeme Testi

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Tedarikci odemesi sec | Tedarikci secimi aktif olmali |  |  |
| 2 | Test tedarikciyi sec | Mevcut bakiye 1000 TRY civarinda gorunmeli |  |  |
| 3 | Odeme tutari 500 TRY gir | Islem etkisi onizlemede bakiye azalmasi olarak gorunmeli |  |  |
| 4 | Odemeyi kaydet | Tedarikci bakiyesi 500 TRY azalmalidir |  |  |
| 5 | Tedarikci ekstresini kontrol et | Odeme hareketi gorunmeli |  |  |
| 6 | Finans hareketlerini kontrol et | Kasa/banka cikis hareketi gorunmeli |  |  |

## 12. Iptal ve Ters Kayit Testi

Bu bolum dikkatli yapilmalidir. Iptal edilen fislerin stok ve cari etkisi dogru terslenmelidir.

| No | Islem | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Kesinlesmis satis fisini ac | Fis detayinda iptal islemi anlasilir olmali |  |  |
| 2 | Satis fisini iptal et | Stok geri gelmeli, musteri bakiyesi terslenmeli |  |  |
| 3 | Urun stokunu kontrol et | Satisla dusen 4 adet geri eklenmeli |  |  |
| 4 | Musteri ekstresini kontrol et | Iptal/ters hareket gorunmeli |  |  |
| 5 | Kesinlesmis alis fisini ac | Fis detayinda iptal islemi anlasilir olmali |  |  |
| 6 | Alis fisini iptal et | Stok azaltilmali, tedarikci bakiyesi terslenmeli |  |  |
| 7 | Urun stokunu kontrol et | Alisla gelen 10 adet geri dusmeli |  |  |
| 8 | Tedarikci ekstresini kontrol et | Iptal/ters hareket gorunmeli |  |  |
| 9 | Finans raporunu kontrol et | Iptal edilen islemler raporlarda karisik gorunmemeli |  |  |

## 13. Rapor ve Ekstre Mutabakati

| No | Kontrol | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Musteri ekstresi | Satis, tahsilat ve varsa iptal hareketleri sirali gorunmeli |  |  |
| 2 | Tedarikci ekstresi | Alis, odeme ve varsa iptal hareketleri sirali gorunmeli |  |  |
| 3 | Finans ozeti | Tahsilat ve odeme etkileri anlasilir olmali |  |  |
| 4 | Stok hareketleri | Alis giris, satis cikis ve iptal tersleri gorunmeli |  |  |
| 5 | Stok degerleme | Test urunun miktar ve maliyet etkisi mantikli olmali |  |  |
| 6 | Gunluk alis/satis raporu | Test fisleri dogru tarihte gorunmeli |  |  |
| 7 | Export/Excel/PDF | Cikti alinirsa bilgiler ekrandakiyle uyumlu olmali |  |  |

## 14. Hata ve Uyari Testleri

Bu adimlar sistemin hatali islemleri engelleyip engellemedigini kontrol eder.

| No | Deneme | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Musteri secmeden satis kaydetmeyi dene | Sistem kayda izin vermemeli |  |  |
| 2 | Tedarikci secmeden alis kaydetmeyi dene | Sistem kayda izin vermemeli |  |  |
| 3 | Urun secmeden fis kesinlestirmeyi dene | Sistem kayda izin vermemeli |  |  |
| 4 | Sifir veya negatif miktar gir | Sistem uyari vermeli |  |  |
| 5 | Bos tutarla tahsilat/odeme kaydetmeyi dene | Sistem uyari vermeli |  |  |
| 6 | Farkli tedarikciye bagli urunu alis fisine eklemeyi dene | Sistem engellemeli veya acik uyari vermeli |  |  |
| 7 | Iptal edilmis fisi tekrar iptal etmeyi dene | Sistem tekrar ters kayit uretmemeli |  |  |

## 15. Test Sonu Kontrolu

| No | Kontrol | Beklenen sonuc | Gecti/Kaldi | Not |
|---|---|---|---|---|
| 1 | Test musteri karti | Hareketler ve bakiye beklenen durumda |  |  |
| 2 | Test tedarikci karti | Hareketler ve bakiye beklenen durumda |  |  |
| 3 | Test urun karti | Stok ve hareketler beklenen durumda |  |  |
| 4 | Finans hareketleri | Tahsilat/odeme hareketleri gorunuyor |  |  |
| 5 | Raporlar | Test hareketleri raporlarda uyumlu |  |  |
| 6 | Bulunan sorunlar | Hepsi not edildi |  |  |
| 7 | Son karar | Gecti / Uyariyla gecti / Kaldi |  |  |

## 16. Sorun Kayit Formati

Her sorun icin asagidaki format kullanilsin:

| Alan | Bilgi |
|---|---|
| Sorun ID | ACC-001 |
| Ekran |  |
| Yapilan islem |  |
| Beklenen sonuc |  |
| Gercek sonuc |  |
| Onem | P0 / P1 / P2 / P3 |
| Ekran goruntusu var mi | Evet / Hayir |
| Testi yapan |  |
| Tarih |  |

Onem kurali:

- P0: para, stok veya cari bakiyeyi yanlis yaziyor; test durur.
- P1: islem yapiliyor ama muhasebe icin guven kaybi olusturuyor; final kabulden once cozulmeli.
- P2: kullanim zorlugu veya rapor anlasilirligi; ic kullanimda takip edilebilir.
- P3: kozmetik veya gelecekte iyilestirme.

## 17. Kabul Karari

| Karar | Anlam |
|---|---|
| Gecti | Muhasebe test akisi tamamlandi, bloklayici sorun yok |
| Uyariyla gecti | Ana isleyis dogru, ama not edilen P2/P3 iyilestirmeler var |
| Kaldi | P0/P1 sorun var, duzeltilmeden kullanima alinmamali |

Muhasebe sorumlusu:

Ad Soyad:

Imza/Onay:

Tarih:

Melih son karar:

Ad Soyad:

Imza/Onay:

Tarih:
