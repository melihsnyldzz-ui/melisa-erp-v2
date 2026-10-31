# B5 — onaylı altı sentetik görev hesabı, 25 Ekim 2026

**Gerçek uygulama tamamlandı; insan/GUI kabulü değildir.** Bu ayrı işlem,
0907'nin kaynak/offline etkileriyle birleştirilmez.

Doğrudan kullanıcı yanıtı koordinatör kaydında salt okunur doğrulandı:
userMessage `01a17258-fbe6-7053-9171-fad80a9e06cc`,
call_b6bb57a97b664fcdb815411b57c75f6e:
“Bu altı sentetik TEST hesabını ve görev bağını oluşturmayı onaylıyorum.”
Yalnız Mehmet, Rüstem, İsmail, Yaman, Veronica ve Ahmet görevlerini temsil eden
ayrı sentetik ERP kullanıcı/personel çiftleri; mevcut rol30 ve görev sınırları.
Gerçek kişi kimliği veya gerçek personel hesabı devralınmadı.

## Gerçek sonuç

12:27 TR API4194 b9/native4196 035 ve clean DB/environment kimliği taze
doğrulandı: `MELISA_ERP_CLEAN_TEST_20261022`,
`e662fd94-d797-4b3b-938a-d143ad758b67`, synthetic=true/T1=false/external=false,
old/live erişimi0. İlgili port süreçleri aynı Windows sahibinde bulundu;
bu, kurulum için münhasır handoff iddiası değildir. Yeni paket bağımlılığı yok.

Mevcut normal auth-admin/personnel API yoluyla **6 kullanıcı + 6 personel bağı**
bir kez oluşturuldu; çakışma0. Ayrı normal GET geri okuması12:31 TR:
6 mevcut exact çift, eksik0, çakışma0, yeniden oluşturma0. Her hazırlık/uygulama/
geri okuma oturumunun kendi logout'u doğrulandı. Altı kez aynı normal ekran
testi tekrarlanmadı; bu yeni hesaplarla GUI, mobil veya fiziksel kabul yapılmadı.

| Sentetik görev | Kullanıcı ID | Personel ID | Rol | Satış | Bu altı içinde koli | Fiyat düzenleme |
| --- | --- | --- | --- | --- | --- | --- |
| Mehmet | 10025 | 5 | 30 | Açık | Açık | Kapalı |
| Rüstem | 10026 | 6 | 30 | Açık | Kapalı | Kapalı |
| İsmail | 10027 | 7 | 30 | Açık | Kapalı | Kapalı |
| Yaman | 10028 | 8 | 30 | Açık | Kapalı | Kapalı |
| Veronica | 10029 | 9 | 30 | Açık | Kapalı | Kapalı |
| Ahmet | 10030 | 10 | 30 | Açık | Kapalı | Kapalı |

Tümü aktif; azami iskonto0. Mal kabul/sayım mevcut personel rolünün kabul edilmiş
sınırlarıyla korunur; yeni rol veya izin değişikliği yapılmadı. Bağımsız native
SQL SELECT, bu6 exact kullanıcı/personel üyeliği ve rol/aktiflik/satış/koli/fiyat
alanlarını API ile eş doğruladı. İlk sqlcmd -h/-y argüman çakışması SQL çalışmadan
reddedildi; çakışma giderilip yeni ham dosyayla tek gerçek SELECT sonucu alındı.
Hiçbir oluşturma isteği hata nedeniyle tekrarlanmadı; bu bir Apply replay testi
değildir. Ayrı Readback yazmasızdır.

## Koruma ve kalan sınır

Mevcut before/verify-before/after yordamı eski hesaplar<=10024, personel<=4,
eski üyelikler, bütün rol/izin/mühür,53 katkı ve mevcut fiş etkisini kendi
tanımlı kapsamlarında eş buldu. Korunan config/süreç/CRM/koli dosyaları aynı.
Beklenen normal auth/audit ve yeni6 hesap/personel satırı bu değişmezlik
kapsamına katılmaz; bütün veritabanı eşliği iddia edilmedi.

Parolalar rastgele üretildi; yalnız owner'ın korumalı DPAPI tesliminde kaldı.
Parola/token/CLIXML veya ham eski kullanıcı envanteri bu rapora/GitHub'a
taşınmadı. Semih/Turgay10022/Angela10023/İlker10024 değiştirilmedi.
CRM hesabı/ataması,10021 pasifleştirme, özel envanter aktarımı, SQL metadata,
ticari/finansal/stok hareketi, restart/kurulum, LIVE/Vega/T1/main yok.

Çalışan uygulama APIb9/webb89/native035/CRM476;349/9614 pasif paketidir.
Normal ERP TEST: http://192.168.1.46:5244/ornek-akis.html
Yeni hesaplar yönetim kullanıcı/personel listelerinden okunabilir; bu tur
normal tarayıcıda yeni ekran görüntüsü alınmadı. B5'in ek finans paneli,
kurulum/handoff ve bağımsız kaynak review engelleri ayrı sürer. B5/insanE2
ve17/74 otomatik kapatılmadı.

Yerel özel makbuz öneki:
`runtime/semih-access-20261023/b5-six-personal-erp-approved-20261025-0927`.
Sırsız makine özeti mevcut `2026-10-24-b5-normal-access.json` içindeki
`sixSpecificApprovalApplied0927` kaydıdır.
