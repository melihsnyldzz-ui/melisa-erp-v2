# Gerçek Vega sınıflandırması — tam katalog analizi

5 Ekim 2026. **Uygulamadan önce salt okunur analiz**: fiziksel salt okunur VEGA_CAPTURE_20260930_01 / F0102TBLSTOKLAR, IND kaynak kimliği üzerinden RUN06 stage ve mevcut ERP katalog kapsamı. 16.622 kabul edilmiş + 54 karantina = **16.676**; sentetik ürün yok. Bu değerler 30 Eylül snapshot'ıdır; güncel Vega veya uygulanmış delta değildir. Kaynak kontrolündeki 3344 CONCEPT kaydı snapshot ile birebir uyuşur. 71/341/74 delta bu teslimde uygulanmaz.

Tam 16.676 kaynak IND ve stage eşleşmesi var. Kabul edilmiş 16.622 ürünün kaynak/native stok kodu, MALINCINSI, KOD1 ve KOD4 alanları birebir aynı; stage ve nested kaynak brand/category farkı sıfır. Full-row/stage/provenance guard'ları uygulama okumasında sürer. Toplam sınıflandırma sayıları kaynak alanlarıdır; karantina alanlarını doğrulanmış native özellik saymaz.

| Ölçüm | Tüm kaynak kapsamı | Doğrulanmış kabul edilmiş kapsam |
| --- | ---: | ---: |
| Ürün | 16.676 | 16.622 |
| KOD1 dolu / boş | 16.615 / 61 | 16.572 / 50 |
| KOD1 NULL / boş metin | 45 / 16 | Boşlar NULL olarak gösterilir |
| Distinct KOD1 (ordinal, literal) | 461 | 461 |
| KOD4 dolu / boş | 15.618 / 1.058 | 15.575 / 1.047 |
| KOD4 NULL / boş metin | 1.048 / 10 | Boşlar NULL olarak gösterilir |
| Distinct KOD4 (ordinal, literal) | 49 | 49 |
| Dolu KOD4 == MALINCINSI | 2.772 | 2.768 |
| Dolu KOD4 != MALINCINSI | 12.846 | 12.807 |
| Tüm nullable literal KOD4 == MALINCINSI | 2.780 (8 boş/NULL eşit) | Boşlar doğrulanmış tür değildir |
| Güvenli KOD1 son eki | 10.650 | 10.640 |
| Güvenli ayrıştırılamayan | 6.026 | 5.982 |
| Güvenli kodu başında sıfır taşıyan | 359 | Metin olarak korunur |

KOD4 boş 1.058 kayıt dolu-alan eşit/farklı karşılaştırmasına dahil değildir. Her iki alan da dolu 15.615 kayıtta 2.772 aynı / 12.843 farklıdır; KOD4 dolu ancak MALINCINSI boş 3 kaynak kaydı ayrıca farklı grubundadır. Farklı MALINCINSI ürün adı olarak ayrıca korunur; KOD4 değiştirilmez. KOD1/KOD4 dolu değerlerde trim/casefold/dil düzeltmesi yapılmaz. Distinct ve filtre eşitliği binary literal karşılaştırmadır; örneğin NAYINOM ve NAYİNOM eşdeğer sayılmaz.

## Güvenli kod kuralı ve gerçek istisnalar

STOKKODU kaynakta ve detayda aynen korunur. Yalnız doğrulanmış dolu KOD1 için exact tek ASCII boşluk + KOD1 son eki, boş olmayan ve boşlukla bitmeyen ürün kodu öneki varsa görüntü kodu üretilir. Number dönüşümü yok; baştaki sıfırlar korunur. Uygun olmayan kod bütünüyle gösterilir. Karantina kartı ayrıştırılmaz.

| ERP ID | Orijinal STOKKODU | KOD1 | KOD4 | MALINCINSI | Gösterim |
| --- | --- | --- | --- | --- | --- |
| 30226 | `3344 CONCEPT` | `CONCEPT` | `TAKIM` | `TAKIM` | `3344` |
| 34225 | `2532 AMANTE` | `AMANTE` | `ELBİSE` | `FİYONKLU  KATLI ELBİSE` | `2532` |
| 34765 | `0161 MOLLY` | Bilinmiyor | Bilinmiyor | `PENYE SİMLİ DÜZ KUNDAK` | `0161 MOLLY` |
| 36724 | `8023 CONCEPT` | `CONCEPT` | `TAKIM` | `TAKIM` | `8023` |
| 38919 | `0205 NAYİNOM` | `NAYINOM` | `YELEK` | `ÇİLEK DESEN YELEK` | `0205 NAYİNOM` |
| 41111 | `11361 ACABELLA ` | `ACABELLA` | `TAKIM` | `BENAN TAKIM ` | `11361 ACABELLA ` |

0161 MOLLY kaynak KOD1/KOD4 NULL: marka stok kodundan türetilmez ve tam kod görünür. 0205 NAYİNOM / KOD1 NAYINOM birebir uyuşmaz: tam kod görünür; gerçek tür YELEK'tir. 11361 ACABELLA sonunda kaynak boşluğu vardır: otomatik kırpılıp ayrıştırılmaz. Ayrıca 13410 MELİSA / KOD1 MIZMIZ, 19103 AYLİN BEBE / KOD1 AYLİN gibi gerçek istisnalar vardır.

54 hold kaydında 1 kaynak/native kod ve 20 ad farkı vardır. Özellikle **4620 LEYLEK / native40451** kaydı source148366 üzerinden captured14126 TİASİS'e bağlıdır; bu eski karantina düzeltilmez, fotoğraf bağlanmaz, sınıflandırma doğrulanmış diye sunulmaz. Hold sınıflandırması NULL/verified:false ve tam stok kodudur. Raw kaynakta güvenli görünen 10 hold kodu kullanıcı ekranında ayrıştırılmaz.

## En çok kullanılan ilk 30 KOD1

| Kaynak değer (son boşluklar korunur) | Ürün |
| --- | ---: |
| `MURAT BABY` | 1760 |
| `NECIXS` | 1030 |
| `CONCEPT` | 643 |
| `DONİNO` | 434 |
| `LEYLEK` | 431 |
| `GAYE BEBE` | 426 |
| `NAYINOM` | 378 |
| `MY MİO ` | 345 |
| `PAKEL` | 319 |
| `BEBESSİ` | 307 |
| `BABY ROSE` | 278 |
| `MİNİWORLD` | 256 |
| `SÜPERMİNİ BABY` | 256 |
| `NOY NOY` | 233 |
| `HİPPIL ` | 192 |
| `CAYZEN` | 191 |
| `BEBEDEX'S` | 190 |
| `MİRKON` | 183 |
| `FLEXI` | 164 |
| `MAİBELLA` | 162 |
| `BEBİKAN` | 160 |
| `LİLAX` | 157 |
| `PAPULİN` | 157 |
| `BEYAZ BEBEK` | 148 |
| `FINDIK BABY` | 145 |
| `BEBİTOF BABY` | 144 |
| `BABYLİNE` | 139 |
| `GÜVENİR` | 136 |
| `BELLOJOY` | 127 |
| `DEMİRDAĞ TEKSTİL` | 122 |

## Tüm distinct KOD4 değerleri

| Kaynak değer (son boşluklar korunur) | Ürün |
| --- | ---: |
| `TAKIM` | 7877 |
| `TULUM` | 2391 |
| `ELBİSE` | 1594 |
| `BATTANİYE` | 867 |
| `BADİ` | 579 |
| `PATİK` | 456 |
| `TAKIM SET` | 419 |
| `HAVLU` | 297 |
| `ÇORAP` | 122 |
| `PANTOLON` | 113 |
| `KUNDAK` | 106 |
| `BORNOZ` | 104 |
| `ŞAPKA` | 104 |
| `TEKALT` | 100 |
| `YELEK` | 83 |
| `ÇANTA` | 57 |
| `TEKÜST` | 53 |
| `MONT` | 44 |
| `KAZAK` | 34 |
| `SAÇ BANDI` | 30 |
| `TRİKO` | 27 |
| `ALT AÇMA` | 25 |
| `ÖNLÜK` | 21 |
| `ŞORT` | 18 |
| `HIRKA` | 13 |
| `TAŞIMA SEPETİ` | 12 |
| `ALIŞTIRMA KÜLOTU` | 11 |
| `YAĞMURLUK` | 9 |
| `MENDİL` | 6 |
| `NEVRESİM TAKIMI` | 6 |
| `UYKU SETİ` | 6 |
| `ELDİVEN` | 5 |
| `BANDANA` | 4 |
| `PAPYON` | 4 |
| `CEKET` | 3 |
| `KANGRU` | 2 |
| `KOT PANTOLON` | 2 |
| `PANTOLON ASKISI` | 2 |
| `YASTIK` | 2 |
| `ATLET` | 1 |
| `BOXER` | 1 |
| `EMZİK TUTACAK` | 1 |
| `EŞARP` | 1 |
| `KEMER` | 1 |
| `KOT ETEK` | 1 |
| `KRAVAT` | 1 |
| `TESTGRUP` | 1 |
| `YORGAN` | 1 |
| `İÇ ÇAMAŞIRI` | 1 |

## Kanıt

Repo dışı salt okunur kayıt: C:\Sirket\ERP\evidence\ERP-CATALOG-CLASSIFICATION-20261005\captured-classification-16676.json. SHA256 **361f9f19e0b55f17bf024e8ff51a5bfb3307fce6b21dc696e46468ed578e8d99**; ölçüm UTC 2026-10-05T15:09:23.7230292Z. Aggregate kanıt aynı klasörde captured-classification-summary.json. Fotoğraf/fiyat/ürün kaydı yazılmadı; CRM/LIVE değişmedi. Bu analiz teknik kanıttır; **ERP-UA04 bekliyor**.
