# ERP-STAGE0501 — köken ve kasa/banka hazırlığı

9 Ekim 2026 · ERP-DEC-034 · okuma ve sınıflandırma, gerçek T1 değil.

## 22 belgenin sonucu

**4 sipariş taslağı teknik kanıtla çözüldü; 18 belgenin kökeni bilinmiyor.** Dört kayıt mevcut ERP içindeki korumalı TEST sipariş mekanizmasının exact request/body fingerprint, native başlık, sekiz satır ve sekiz SQL modül/guard hash'iyle eşleşti. Stok/cari/kasa/reservation etkileri yok; CRM'ye çağrı veya değişiklik yapılmadı. Tarih, personel, belge adı veya boş source key ile sınıflandırma yapılmadı.

Kalan 18: **11 tamamlanmış belge** (altı satış, beş alış) ve **yedi iptal edilmiş satış**. İptaller kendi ürün/hesap etkilerinde sıfır net kapanış gösterir; depo boyutu ve gerçek/deneme kökeni belirsiz olduğundan açılışa hazır sayılmaz. Daha sonra yapılmış deneme iadesi, özgün alış belgesini deneme ilan etmek için kullanılmadı. Eski terminal satışlarının tarihsel teknik kanıtı da gerçek işletme kökeni yerine konmadı.

Güncel dar native okuma eski kanıtla karşılaştırıldı: 22 başlık, 143 belge satırı, 140 stok, 21 müşteri, 10 tedarikçi ve altı kasa etkisi kapsamındaki tam SQL satır hashlerinde drift yok. Sipariş journal/satır ve modül bağları ayrıca doğrulandı. Bunlar atomik final kaynak görüntüsü değildir.

## Açılış engellerinin tekil dökümü

| Alan / neden | Boyut veya hesap satırı | Tekil ürün/hesap |
|---|---:|---:|
| Stok — UNKNOWN köken/artık | 127 | 124 |
| Stok — depo/birim kanıtı eksik | 202 | 202 |
| Stok — kaynak açılış otoritesi eksik | 11 | 6 |
| Cari — UNKNOWN köken/artık | 478 | 478 |
| Cari — kaynak otoritesi eksik | 294 | 294 |
| Kasa — UNKNOWN hareket/artık | 17 | 17 |
| Kasa — kaynak otoritesi eksik | 22 | 22 |

Toplam **1.151 engel satırı** private pakette hesap/ürün + döviz/depo/birim, bileşen, native kimlik ve hash ile kayıtlıdır. Nedenler aynı üründe örtüşebilir; tekil ürün sayıları birbirine eklenmez. **179 atanmayan cari hareket bağlantısı** ayrı korunur; bu sayı yukarıdaki hesap sayısına eklenmez. Dört taslağın çözülmesi hiçbir stok/cari/kasa etkisini yeniden sınıflandırmadı; önceki V02 READY **16.426 stok / 273 cari** alt kapsamı değişmedi. Bu sayı tüm işletmenin açılışının hazır olduğu anlamına gelmez.

## Kasa/banka

**39 hesap: TRY 24 / USD 8 / EUR 7. Gerçek açılışa hazır: 0.** Yeni izole TEST restore üzerindeki 39 master ve 16.839 kasa hareketinin tam satır hashleri/kesin etkileri eski kabul edilmiş envanter ve yeni source-before ile aynı. 39/39 matematiksel kapanış doğrulandı; bu işletme açılış otoritesi değildir.

17 UNKNOWN hesap = belirsiz etkin hareketi olan 13 + bakiye artığı olan 5 − ikisinde de bulunan 1. Diğer 22 hesapta gerçek kaynak açılış dayanağı yok. Altı UNKNOWN hesap net sıfır olsa da engellidir; sentetik/projection sıfırı doğrulanmış işletme sıfırı değildir.

Mevcut beş Vega isim-hash grubu dar SELECT-only okumayla 2026 D0007'de firma + kaynak isim hash'i + döviz üzerinden **5/5 tekil hareket grubuna** bağlandı. Bu fiziksel kasa kart UID'si değildir; hareket IND'si kasa UID'si yapılmadı. Banka kart UID/HESAPNO/MUHKODU alanları doğrulandı, yalnız ilgili grupların dar aday sorgusu sıfır sonuç verdi. Tüm işletmenin banka hesabı olmadığı söylenmez. Kaynak izinlerinde DML/DDL/EXEC yok; iki okuma stabildi, final T1 ilan edilmedi.

Kullanıcıdan teknik UID/tablo/kod istenmez. İşletme bilgisi üç gruptur:

1. Kalan 18 belgenin gerçek işlem/deneme kökeni ve mevcut belge bağı.
2. Gerçekte kullanılacak fiziksel kasalar/banka hesapları ve her hesabın dövizi.
3. Aynı kesim tarih/saatine ait kasa sayımı ve banka ekstresi; yoldaki ödeme/POS/havale ve devir kapsamı.

Mevcut generic finans hesabı açma/standardizasyon yolları kesin kaynak kimliği, exact8, replay ve CAS migration sözleşmesinin yerine kullanılmadı. Kanıtı hazır gerçek kasa açılışı bulunmadığı için yeni tutar yazması yapılmadı.

## Özel kanıt

`C:/Sirket/ERP/evidence/ERP-STAGE05-20261009/private/discovery/origin-review-v2.{json,md}` tekil işlem/hesap matrisidir. `BUSINESS_DECISIONS_REQUIRED.md` kullanıcıya okunabilir 18 belge listesidir. `private/cash/` güncel kaynak bağı, 39 hesap envanteri ve bağımsız hash kapanışını içerir. Ham cari/kasa bilgileri ve tutarlar GitHub'a yüklenmez; önceki Stage4 kanıtları değiştirilmedi.
