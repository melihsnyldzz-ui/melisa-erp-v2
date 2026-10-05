# Gerçek sınıflandırma ve görselli katalog — teknik kabul

5 Ekim 2026. ERP-D04 normal katalog kapsamının kullanıcı tarafından istenen düzeltmesi. **ERP-UA04 bekliyor**; bu kayıt insan PASS değildir. Önceki ERP-UA02 ve ERP-UA03 PASS kayıtları korunur. CRM, LIVE, main merge ve sonraki finish işleri kapsam dışında; bu teslim sonunda durulur.

## Ortam ve gerçek kaynak

- TEST: http://127.0.0.1:5194/ornek-akis.html#stock; API4144 / native4146.
- Çalışan paket46: `CANONICAL-CATALOG-CLASSIFICATION-TEST-20261005-46`, uygulama source `7da6f2cfa799f6ff5709e0218ab2d28e8c3fc7b5`; izleyen belge commit'i deployment değildir.
- Semih\MELISADEV / MELISA_ERP_SIRKET_TEST_20260929_01, named TEST SQL login, sysadmin0/control0/LIVE erişimi0, dış işlemler kapalı; native salt okunur. LIVE süreç sahipleri değişmedi.
- [Uygulamadan önce tam kaynak analizi](catalog-classification-analysis.md): 30 Eylül fiziksel salt okunur F0102 snapshot, 16.622 kabul edilmiş + 54 karantina; güncel Vega/delta değildir. 71/341/74 delta uygulanmadı.
- Tüm kaynak kapsamı KOD1:16.615dolu/61boş/461distinct; KOD4:15.618dolu/1.058boş/49distinct. Kabul edilmiş kapsam:16.572dolu/50boş marka,15.575dolu/1.047boş tür. Dolu KOD4–MALINCINSI:2.772aynı/12.846farklı; kabul edilmişte2.768/12.807. MALINCINSI ayrıca korunur.
- 10.650 kaynak son eki güvenli; hold hariç **10.640 gösterim kodu** ayrılır. Kabul edilmiş5.982 ve54hold tam stok kodunu gösterir. Baştaki sıfırlar ve kaynak STOKKODU korunur.

## Normal ekran

Yedi sütun: Foto / Kod / Marka / Tür / Stok / Satış fiyatı / Durum. Marka KOD1, tür KOD4; boş değer Bilinmiyor. Detayda büyük fotoğraf, gösterim kodu, orijinal stok kodu, KOD1/KOD4, kaynak ürün adı, barkod, stok ve gerçek ERP fiyatı/döviz ayrı görünür. Fotoğraf üzerindeki fiyat kullanılmaz.

461 gerçek marka /49 gerçek tür; Fotoğraflı3830 /Fotoğrafsız12846 /Tümü16676. Filtreler current hold ve exact kaynak bağıyla uygulanır;67AMBIGUOUS ve4620LEYLEK fotoğraflı kapsama girmez. Stok/durum/sıralama mevcut SQL verisiyle çalışır. Varsayılan doğal **sayısal** gösterim kodu sırası; örnek0007/100/0161/0205/3344/8023, sıfırlar metinde korunur. İlk ve sonraki50 toplam100benzersiz ürün doğal sırada doğrulandı.

1440/1024/390 gerçek CSS genişlikleri tarayıcıda ölçüldü; yatay sayfa taşması yok. 390'da altı filtre ikili satırlarda161px genişlikte; arama, temizleme, kart açma/kapatma kullanılabilir. Masaüstü64px/mobil56px thumbnail; ekran dışında gereksiz indirme yok. Ağ kanıtında liste yalnız `variant=thumbnail` GET aldı; kart açılınca önizleme ayrı yüklenir. Yüklenen thumbnail doğal genişliği103px, kart617px; orijinal tam boy indirilmedi. Kullanıcı ekranına TEST/debug/performans metni eklenmedi.

## Gerçek örnekler

| Kaynak stok kodu | Gösterim / marka / tür | Gerçek sonuç |
| --- | --- | --- |
| 3344 CONCEPT | 3344 / CONCEPT / TAKIM | Stok4ADET,8,55USD; fotoğraf bağlı değil. |
| 8023 CONCEPT | 8023 / CONCEPT / TAKIM | Thumbnail ve büyük fotoğraf; stok0,15,78USD. |
| 0161 MOLLY | 0161 MOLLY / Bilinmiyor / Bilinmiyor | Kaynak KOD1/KOD4 NULL; kod tahminle ayrılmaz,14ADET/9,66USD. |
| 0205 NAYİNOM | 0205 NAYİNOM / NAYINOM / YELEK | İ/I farkı nedeniyle kod ayrılmaz;0ADET/62,75TRY. |
| 2401 BABY AURA | 2401 / BABY AURA / TAKIM | MALINCINSI FİSTO BEBE YAKA 3 LÜ TAKIM ayrıca görünür;8ADET/253TRY. |
| 4607 BABY ROSE | 4607 / BABY ROSE / TAKIM | MALINCINSI KAŞE MANTOLU EKOSE ELBİSE TAKIM;0ADET/840TRY. |
| 1420 TİASİS | Tam kod / Bilinmiyor / Bilinmiyor | MALINCINSI TAKIM'dan kategori türetilmez;3ADET/243,1TRY. |
| 13410 MELİSA | Tam kod / MIZMIZ / BATTANİYE | Marka stok kodundan çıkarılmaz;37ADET/2,5USD. |
| 11361 ACABELLA + kaynak son boşluğu | Tam kaynak kodu / ACABELLA / TAKIM | Son boşluk otomatik temizlenmez; güvenli ayrıştırma yapılmaz. |
| 4620 LEYLEK | Tam kod / Bilinmiyor / Bilinmiyor | Eski hold/kaynak uyuşmazlığı korunur; fotoğraf yok, classification verified:false. |

İlk sekiz örnek gerçek tarayıcıda açıldı; kaynak son boşluğu ve hold API detayında ayrıca doğrulandı. Başında sıfır olan `01240465102508` barkod gerçek ekranda10290MURATBABY/ERP29880 ürününü getirdi;88ADET/4,65USD. CONCEPT+TAKIM filtresi643ürün, ikinci sayfa2/13 ve50satır. Büyük8023fotoğrafı gerçek ekranında tamamlandı. Ekran görüntüleri kullanıcı teslim alanında ve repo dışı kanıtta tutulur.

## Performans

Üç ardışık HTTP ölçümünün medyanı; aynı TEST/İlker16,50satır, response JSON tamamen okundu. Son paket46 ölçümü sırasında başka ağır SQL doğrulaması çalıştırılmadı. Önceki sıra ve yeni doğal sıra farklıdır; liste DTO hash eşitliği iddiası yok.

| İşlem | Bu tur önce paket42 | Son paket46 | Son min–max |
| --- | ---: | ---: | ---: |
| İlk50 | 410ms | 594ms | 584–622ms |
| Sonraki50 | 317ms | 616ms | 554–621ms |
| Kod8023CONCEPT | 404ms | 542ms | 525–552ms |
| Exact sıfırlı barkod | 182ms | 315ms | 292–316ms |
| Kart36724 | 165ms | 192ms | 163–202ms |

Kullanıcının paket42 önceki baseline'ı397/328/431/191/170ms idi. Yeni filtre/doğal sıra doğrulamaları ek maliyet getirdi: baseline birebir korunmadı; liste birkaç saniyeye dönmedi ve tüm son ölçümler1s altında. Paket44 sırasında paralel tam SQL snapshot alan ara ölçüm632/626/613/332/230ms ayrıca saklandı; son medyan yerine kullanılmadı. İlk reddedilen sorgu14–20s olduğundan yayımlanmadı; son SQL selected-page binding materialization ve bir kez başlangıç sınıflandırma doğrulamasıyla optimize edildi.

## Kullanıcının deneyeceği dört adım

1. 3344CONCEPT ve8023CONCEPT arayın: ayrı kod/marka/tür ve detayda tam kaynak kodunu görün;8023fotoğrafı ve15,78USD ERP fiyatını karşılaştırın.
2. 0161MOLLY ve0205NAYİNOM açın: boş marka/tür ve exact uyuşmayan marka nedeniyle tam kodun kaldığını görün;2401/4607 kaynak adlarının türden ayrı olduğunu inceleyin.
3. Fotoğraflı3830 filtresini ve CONCEPT+TAKIM643 filtresini deneyin; sonraki50 ürün ve büyük kart kullanılabilir olsun.
4. 01240465102508 barkodunu başındaki sıfırla arayın; dar ekranda filtreleri ve kartı açıp kapatın. ERP-UA04 için kullanıcı sonucu bekleniyor.

## Güvenlik, doğrulama ve geri dönüş

Tam sınıflandırma indeksinin7.789.838bytes SHA256 pin'i `aedfd8d7557cc7440572dcc5a70e7ba5467af07eedca020dda280cf53659cff8`; source hash ayrıca pinli. Yalnız immutable kimlik/sınıflandırma/rank/facet cache; güncel stok/fiyat/rol/hold cache'e alınmaz. Başlangıç16622kabul bağını/stage/native/binding/unit/currency/price-count'u tam doğrular; SERIALIZABLE ve tüm güvenlik hashleri korunur. Normal istekte güncel yetki/hold/source-both-directions/media-alias ve seçili sayfa tam binding hash kontrol edilir. Güvensiz aday, eksik/duplicate rank/ID veya kaynak drift fail closed olur.

SQL reader647F16AD5713D96634096136A48FD970123CB0B75FAA50D4DB0EDDF2FEC0CFC9. SQL installer yalnız bu named TEST reader metadata'sını1kez yükseltti; tekrar NOOP0, index/ticari veri yazması0. 28ticari tablo tam-row SHA/count/maxID,142module hash (reader hariç141diğeri) ve555permission snapshot'ı değişmedi. Merkezi3.830fotoğraf index SHA değişmedi; Desktop orijinallerine dokunulmadı.

Paket43 Windows Git archive CRLF/procedure pin farkında ve ilk44başlangıç doğrulaması reddinde otomatik42geri dönüşü çalıştı. Installer dinamik body LF normalizasyonu hash pin'i değiştirmeden düzeltildi; gerçek paket SQL8case trial + exact physical old-hash rollback PASS. Gerçek namedSQLlogin fullindex/proof doğrulaması7,1–8,6s PASS; önceki genel başlangıç hatasının ETIMEOUT olduğu **kanıtlanmadı**. Tam startup kontrolüne uygun60s request bütçesi eklendi; normal identity/sayfa okumaları10s aynı. Paket46 doğrudan başladı; son geçiş SQL/config yazması0, LIVE sahipleri aynı. Eski42/43/44/45 paketler ve exact reader/config/launcher yedekleri korunur;42geri dönüşünde SQL reader4C0702 pin'i ve config/launcher birlikte geri alınır.

API katalog6suite53hedefli test + frontend4suite38test önce PASS; startup-budget read/classification/warmup13PASS ve bağımsız2testPASS. Son gerçek API kabulü10kartın displayCode/classification dışındaki tüm alanlarının before-image'ıyla birebir eşitliğini,100ürün sırası/benzersizliği,461/49faceti,3830görselli,12846görselsizi,643marka+türü,leading-zero barkodu,unknownbrand0 ve3hatalı sorgu400'ü doğruladı. Ek gerçek API kontrolde pozitif stok50satır, pasif50satır ve stock-desc50satır doğru bulundu. Hosted CI offline kontrollerdir, gerçek ekran/kullanıcı kabulü değildir.

Repo dışı kanıt: `C:\Sirket\ERP\evidence\ERP-CLASSIFICATION-20261005` (`before/after-timing.json`, `after-acceptance.json`, SQL snapshot/trial, runtime-switch-classification-44/46.json); kaynak keşfi ayrıca `ERP-CATALOG-CLASSIFICATION-20261005`. Dal `codex/erp-finish-20261004`, [Draft PR23](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23); tam teslim CI sonucu PR head üzerinden izlenir. Kullanıcı kabulü [ERP-UA04](../../../USER_ACCEPTANCE.md) bekliyor; başka iş başlatılmaz.


