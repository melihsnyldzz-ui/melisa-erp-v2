# ERP-MIGPREP01 — migration veri hazırlığı, 8 Ekim 2026

ERP-DEC-027 kapsamı yalnız dört exact kaynak tedarikçisinin parasal etkisiz TEST kimliği ve mevcut 200 cari / 209 hesap için aktarım kanıtıdır. Yeni finans uygulaması, gerçek T1 veya LIVE geçişi değildir. Önceki Goal7.3 journal'ındaki 16 hesabın etkisi yeniden önerilmez. İnsan ERP-UA24 bekliyor; USER_ACCEPTANCE değiştirilmedi.

## Hesap bazındaki tek sonuç

| Nihai durum | Hesap |
|---|---:|
| UYGULANMIŞ | 16 |
| AKTARIM KANITI TAMAM — UYGULAMA ONAYI BEKLİYOR | 38 |
| TEKNİK KANIT EKSİK | 149 |
| İŞLETME KARARI BEKLİYOR | 2 |
| KART OLUŞTU — FİNANS DOĞRULAMASI BEKLİYOR | 4 |
| **Toplam** | **209** |

125 karantinalı hesap ve 83 hareketsiz hesap bu kapsamla örtüşür; toplamın üzerine eklenmez. Hareket yokluğu, doğrulanmış sıfır ve bilinmeyen bakiye ayrı durumlardır. Dövizler veya müşteri/tedarikçi rolleri birleştirilmez.

## Dört TEST kartı

Kaynak şirket/dönem/rol/UID/code tam eşleşmesi ve iki geçişli güncel salt okunur kaynak kontrolüyle dört supplier, dört party_entity, dört party_currency_account ve dört source_link oluşturuldu. Finans hesabı UNKNOWN/current_balance NULL; native kartın teknik scalar alanı doğrulanmış finansal sıfır değildir. Telefon/e-posta/vergi bilinmeyense NULL kalır. Kaynak kimlikleri ve kişiler private plandadır.

Yeni COPY_ONLY/CHECKSUM yedek 8.630.108.160 bayt, RESTORE VERIFYONLY başarılı. SHA256 `8782cd4a36456b0853292122eda7146d173e0412ac2f02d2f0b6b3b4d0c4131d`. Aktif veritabanına restore yapılmadı. Önceki ayrı restore provası korunur. Kart uygulama manifesti `4dd3285c2ade83e8823c37e951b01241dea3a9e72ff8bd6a11287bda250a5662`; committed aynı body replay sıfır etkili. Finans, stok, mevcut hareketler, hold/roller ve SQL izinlerini kapsayan 44 eski veri grubunun hashleri aynı kaldı. Kart inverse planı hazırlanmıştır; committed kartları geri alma uygulanmış/test edilmiş diye raporlanmaz.

Karantina kaynak bağlantısından yeni native kimliğe de çözülür. Tarihsel 176 hold / 172 native / 4 not-present kayıtları değiştirilmez. Dört kartın oluşması hold kaldırmaz. Mevcut 37 FIRST guard ve onları kullanan okuyucu/finans sözleşmeleri korunur; ek kaynak bağlantısı guard'ları ayrı mühürlü kanıtla doğrulanır. Normal ERP tasarımında veya rollerinde değişiklik yok.

## 38 yeni kanıtı tamamlanan hesap

- 30 hassasiyet konusunun 29'u, yalnız kendi kaynak sürümü ve özgün XLS satırına bağlı gösterim kanıtıyla çözüldü. Kalan bir hesapta rapordan sonraki yeni ödeme belgesi vardır.
- Üç `(-)` örneği aynı dar yöntemle ayrıldı: bir gerçek kaynak sıfırı, iki küçük negatif exact bakiye. Küçük bakiye silinmedi.
- 27 devir/başlangıç konusundan beş hesapta yeni hesap başlangıcı, tam hareket kapsamı ve 30 Eylül donmuş defter karşılaştırması kanıtlandı; 22 hesap bekler. Önceki yıl toplamı eklenmedi.
- Yedi zaman/sürüm konusundan bir hesabın mevcut exact kaynak yakalaması rapor satırıyla uyuştu. Diğer altı hesapta belge farklarının nedeni daraltıldı, fakat bağımsız rapor sürüm/kapsam kanıtı henüz yeterli değildir.

29 + 3 + 5 + 1 = 38 yeni hazır hesap. Bağımsız SQL exact aggregate 38/38 uyuştu; önceki Goal7.3 16 hesapla kesişim sıfırdır. 203 mevcut native hesap ve mevcut local/ledger/provenance/journal ayrı kontrol edildi; dört yeni UNKNOWN kart finans kapsamına eklenmedi.

İki ondalıklı rapor sekiz ondalıklı kesin defter değildir. `BOUNDED_DISPLAY_ACCOUNT_V1`, özgün dosya/satır/scope hash'i + tam kaynak kimliği + hesap dövizi/B-A + exact kaynak sürümüne bağlıdır. Exact yarım-kuruş ve eksik yön/kur fail-closed kalır. Çalışan Vega binary'sinin genel yuvarlama algoritması kanıtlanmış değildir; eski DLL/FR3 güncel çalışma kanıtı sayılmadı. Bu hesaplara ait gözlenen gösterim mutabakatı diğer hesaplara genellenmez; exact defter tutarı yuvarlanmaz.

Mevcut readonly planner ile private yeni plan `27aefef1b8fe7e1595a1bdcf3ddf722c706554959c6ba66ee3a0abab5957091a`: dry-run READONLY_VERIFIED, aynı plan SAME_PLAN_REPLAY; farklı içerik PLAN_PAYLOAD_CONFLICT, kaynak sürümü RUN_OR_SOURCE_CONFLICT, hedef defter NATIVE_DRIFT. Yeni finans yazması 0; inverse vektörü yalnız gelecekteki onaylı uygulama planıdır. Mevcut Melisa yerel hareketleri kaynak açılışına gömülmez.

## Kalan somut engeller

149 teknik hesap: 119 karantina/finans kaynağı, 22 devir/başlangıç kapsamı, altı rapor-kaynak sürümü, bir yeni ödeme, bir EUR rapor-belge farkı. EUR farkının eski ölçümü korunur; 445 typed belge, kur/tarih/tekillik ve kronolojik kapsam kontrolleri açıklama üretmedi. Denkleştirme hareketi yok. Dört yeni kartın finans doğrulaması ayrıca bekler. İki LL hesabı için yeni sistem kullanım/arşiv kararı gerekir; LL'nin %5 fiyat denemesi açıklaması tekrar sorulmaz ve TL'ye çevirme/silme/sıfırlama yetkisi sayılmaz.

Tek yeni uygulama onayı yalnız private 38 hesap ve yukarıdaki plan hash'i için hazırlanır. Kaynak/hedef drift yeniden doğrulanmadan uygulanamaz. Genel Bakiye kullanılmaz; TRY/USD/EUR ayrı, hesabın B/A yönü ve cari rolü korunur. Migration bitmedi.

## Kanıt ve gizlilik

Yerel private kök: `C:\Sirket\ERP\evidence\ERP-MIGPREP01-20261008\private`. `MELIH_REVIEW.md` tek onay tablosunu; `account-matrix-current.json` 209 hesaplık tek durum listesini; `finance-transfer-plan.json` exact aktarım planını; `account-evidence/` özgün XLS hashleri, kaynak/doküman/devir ve bağımsız SQL kanıtlarını içerir. Adlar, tutarlar, ham raporlar, credentials ve private manifest GitHub'a alınmaz.

Paket/API/normal ekran ve exact GitHub CI teslim sonucu bu belgenin son teslim kaydında belirtilecektir. CRM/LIVE/Vega yazması, gerçek T1, main merge veya başka goal yok. Bu dilimden sonra durulur.
