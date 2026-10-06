# Goal6 teknik kanıtı — 6 Ekim 2026

Kullanıcı talimatı ERP-DEC-019 / CRM-DEC-006. İnsan kabulü bekler; LIVE/Vega/CRM provider/main/delta/Goal7 yok.

ERP source `257ab50b7a0b3339b8f585f8a9904c9c850aa912`, TEST75 `CANONICAL-GOAL6-TEST-20261006-75`, manifest `16E0BA3E1D83397A59960CC62BD51BFA368F0B989DF173D548BC084CC8FF947A`.
CRM source `77a2fa346b4c3653b77e33625e185c1259402af7`, immutable `crm-test-77a2fa346b4c3653b77e33625e185c1259402af7`, manifest `ccdaab18c33973ef5a7e95e28f696fb8ff0426c41c339faefc00bf9eb9929b31`.

## Veri ve rapor kapsamı

Yedi rapor yalnız Melisa ERP içinde oluşturulmuş kayıtlardır. Mevcut veritabanında geçmiş Vega belgeleri de bulunur; `is_migrated` ve hareket provenance filtreleriyle bu rapora dahil edilmez. Yeni historical import/delta yapılmadı. Görünen kaynak kapsamı 30 Eylül açılış verisi + Melisa ERP TEST hareketleridir. Türkiye kayıtlı belge günü DATE olarak seçilir; UTC yarı açık aralık kapsam bilgisidir.

Satış/alış kesinleşmiş fiş toplamlarıdır. Marka/tür/ürün kırılımı kayıtlı satır tutarlarını gösterir; fiş indirimi dağıtımı icat edilmez. Gerçek KOD1/KOD4 provenance kayıtları kullanılır. Tahsilat/ödeme belge dövizi tutarı, ters kayıtta negatif; genel cari hareketi hesap dövizi ve signed balance_effect olarak gösterilir. TRY/USD/EUR birleştirilmez. NULL maliyet sıfır değildir; personel maliyet/kâr alamaz. Yetkili görünümde işlem maliyeti bilinen/bilinmeyen satır sayısı ayrı, doğrulanmamış işlem maliyetinden kâr üretilmez. CSV aynı filtre/kapsam/toplam ve 10.000 satır sınırını taşır; normal DOM sayfası 50 satırdır.

## Gerçek backup / restore

[Backup sonucu](backup-result.json): 7.283.015.680 bayt, COPY_ONLY/CHECKSUM, 87,351 sn; VERIFYONLY 9,590 sn. Express sıkıştırmayı desteklemediği için sıkıştırmasız alındı. SHA256 `238D65006C7515CCEA30F79B1678AA65AFA6BB2A366EF4337F8CA6745C1EE47D`.

[Gerçek restore](restore-result.json): yalnız yeni `MELISA_ERP_GOAL6_RESTORE_TEST_20261006_01`, 17,823 sn; ONLINE/READ_ONLY. Aktif TEST üzerine restore, REPLACE, LIVE bağlantısı veya silme yok. Backup, MDF/LDF ve restore DB repo dışında korunur.

[33 kritik tablo ve 177 prosedür/trigger](restore-comparison.json) ile [iki native sipariş tablosu](native-order-comparison.json) kaynak önce/sonra/restore count/hash eşit: toplam35 kritik tablo. Bu kanıt tüm DB atomik hash iddiası değildir; kaynak durgun aralıkta ayrıca önce/sonra karşılaştırıldı.

[Bağımsız uygulama okuması](restore-application-read.json) gerçek doğrulanmış TEST74 source5972 connector'ünü ayrı geçici süreçte kullanır; çalışan hizmet config'i yönlendirilmedi. 16.622 katalog ürünü,63.774 fiyat,10.552 NULL maliyet;0161 sıfırı ve9,66USD/802315,78USD; native taslak9/25,44USD/two1qty, pending sayım43/iade44/mal kabul7 okundu. 1,031 sn connector doğrulaması UI HTTP ölçümü değildir.

[Backup sırasında eşzamanlı katalog okuması](backup-concurrent-read.json) ve [beş negatif](backup-restore-negatives.json). Yanlış kaynak başlığı gerçek ikinci backup değildir; üretim guard'ına kontrollü başlık girdisiyle reddedildi. Bozuk backup SQL HEADERONLY öncesi/restore olmadan reddedildi.

## Geri dönüş

ERP önceki TEST74 source5972f847; CRM önceki4eadb51 paketi değiştirilmeden korundu. Önceki launcher/config/task XML ve owner/creation/port kayıtları repo dışındaki `C:\Sirket\ERP\evidence\ERP-GOAL6-20261006\ops-rollback-before` içindedir. Sadece doğrulanmış TEST süreçlerinin mevcut owner/pin prosedürüyle geri dönüşü uygulanır; fiziksel logon/reboot kabulü ayrıdır.

## Doğrulama

467 API,609 workflow,8 startup/restore hedefli yerel test; syntax/build PASS. Exact uygulama kaynakları ERP/CRM GitHub CI SUCCESS. Gerçek paket ekran/process/hız sonuçları aşağıdaki nihai kanıtlarda kaydedilecektir.
