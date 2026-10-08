# Güncel cari aktarımı — sayısal onay hazırlığı

8 Ekim2026, ERP-DEC-030, ERP-CARICOMPLETION01. Kaynak karar [PR23 yorum6061357235](https://github.com/melihsnyldzz-ui/melisa-erp-v2/pull/23#issuecomment-6061357235). F0102 müşteri/F0103 tedarikçi; TRY/USD/EUR ayrı, exact B/A yönü korunur. Yalnız source324 ve379 exact LL müşteri hesabı dışarıda. Ad/varsayılan döviz/ham kart BAKIYE üzerinden hesap uydurulmaz.

## Kapsam ve bağımsız kaynak kanıtı

951 kaynak kart,967 kart-döviz hesabı ve102 kaynak bağlı native ek döviz hesabı:1069 toplam kapsam. 336 bağımsız sayısal rapor kapanışı=153 müşteri+183 tedarikçi. İki özgün XLS hash-eş;335 rapor gösterimi eş,1 sonraki typed ödeme ve bağımsız belge/kaynak hareketi güncel farkı açıklar. Raporun exact üretim saati bilinmiyor; rapor tutarı bugünkü bakiye olarak sabitlenmez. SELECT-only snapshot **2026-10-08T14:01:17.583Z**, iki geçiş sabit; D0007'nin eski tarihli hareketleri dahil, tarih kesmesi yok. SQL decimal38,9 hareket bölümü/toplamı ve en sonda28,8 dönüşümü yeniden doğrulanır; her hareketi8'e yuvarlayıp toplamak kullanılmaz.

Bu yöntem **yalnız336 rapor bağlı sayısal hesap için** bağımsız kanıt taşır; global source-method veya finans yazma yetkisi değildir.631 kaynak hesabı kapanış kanıtı edinmez. `(-)`, boş döviz/tutar, küçük exact tutar ve hareket yok ayrı tutulur; UNKNOWN sıfır olmaz.294 boş tedarikçi rapor satırı ayrı bilinmeyendir. Kaynak dışındaki102 native döviz hesabı korunur; bugünkü kaynak kapanış kanıtı olmadan silinmez/sıfırlanmaz.

## Tek onay paketi

| Kapsam | Sayı |
|---|---:|
| Sayısal onaya hazır müşteri hesabı |138|
| Sayısal onaya hazır tedarikçi hesabı |161|
| Hazır toplam |299|
| Önceden uygulanmış, korunmuş |16|
| Yeni sayısal onay bekleyen |283|
| Yeni defter farkı |59|
| Yeni defter no-op |224|
| Hassasiyet aşaması gerektiren |159|
| Exact ana kart gösterge eşitlemesi |157|
| Defter no-op içinde gösterge eşitlemesi |106|

Hazır=**tutar/kapsam onayına hazır**, uygulandı veya executable değildir. Önceki16 journal/native etkisi aynıdır; bunların2 sonraki kaynak drift'i finalT1'e ayrı kaydedildi, eski batch yeniden yapılmaz. Yeni fark eski migration/açılış ve committedGoal7.3 etkilerini birer kez çıkarır; localEffects değişmez. Dört local hesabın gerçek/sentetik kökeni net0 olsa da kanıtlanmadığından seçilmez (biri ayrıcaheld). Önceki Goal8 sentetik kanıtı kendi sealed kapsamıyla ayrıdır.

Mevcut ana kart scalar alanı decimal18,4, döviz hesabı decimal28,8. Kaynak hassasiyetini koruyan widening SQL ve157 exact gösterge eşitlemesi **hazırlanmıştır; çalıştırılmamıştır**. Lossless28,8 post-DDL tam SQLJSON/hash preimage, row_version hariç planlanan sonuç projeksiyonu/hash ve diğer işletme kolonlarının değişmediği witness ayrı sealed private fazda bulunur. Sadece defter no-op olan224 hesabın106'sı bu exact gösterge eşitlemesi ister; no-op yeni defter hareketi yazmaz anlamındadır, bütün pakette sıfır metadata etkisi demek değildir. Herhangi bir rounding veya drift görmezden gelme yok. Mevcut adapter güvenli olarak fail-closed kalır; onay, yeni yedek/doğrulama, taze source/native parmak izi, native yazma duraklatma, post-DDL CAS ve mevcut guard/adapter preflight kapanmadan uygulama yapılmaz. Bu paket finalT1/freeze değildir.

SQL, her gerçek UPDATE sırasında `row_version` değerini kendisi üretir. Bu otomatik sütun planlanan sonuç projeksiyonunda maskelidir; bütün işletme sütunları exact korunur. Uygulama sonrası tam SQLJSON ve gerçek hash bağımsız native readback ile alınarak journal'a yazılmadan aşama tamamlanmış sayılmaz. Plan gerçek sonuç hash'ini önceden bildiğini iddia etmez. DDL ve eşitleme tek sahipli transaction/rollback sınırında yürütülmelidir.

## Dışarıda kalan hesaplar

Birincil gerekçeler disjoint; bütün ikincil nedenler private manifestte korunur.

| Somut neden | Sayı |
|---|---:|
| Hareket yok; bağımsız doğrulanmış sıfır değil |443|
| Güncel döviz kapanış kanıtı tamam değil |78|
| Mevcut karantina/hold |123|
| Exact native kart/hesap kimliği yok |19|
| Yerel hareketin gerçek/sentetik kökeni kanıtlanmamış |3|
| Kaynak bağlı native ek döviz için güncel kapanış kanıtı yok |102|
| Exact iki LL hesabı, kullanıcı kararıyla dışarıda |2|
| Toplam |770|

## Koruma, test ve teslim

Yeni finans, bakiye, açılış, DDL, hold, rol, stok, maliyet, satış fiyatı, Vega/LIVE/CRM yazması **0**. Eski47 sayısal paket18 dosya ve önceki alış referansı teslimi korunur. Ham müşteri/tedarikçi adları, tutarları, source/native satırları, fotoğraf ve özel config GitHub'a çıkmaz.

Mevcut hazırlık modülü genişletildi; yeni motor kurulmadı. Exact report/source/raw SQL aritmetiği ve native defter/current_balance/importedBase/prior/local decomposition yeniden türetilir. Bütün kapsam hash/CAS/yanlış şirket-rol-döviz/hold/UNKNOWN/LL/sub-cent drift kontrollüdür. Eski replay sözleşmesi saf testte ikinci etkiyi reddeder; **yeni gerçek native batch/replay uygulanmadı**. Offline migration184/184; ekran652/652 ve build geçti. Normal yeşil kullanıcı yüzünde yalnız fiyat/bakiye gösterimi exact decimal ile iki Türkçe ondalık; küçük negatif -0,00/B-A kaybolmaz, kaynak hesaplaması/kur/miktar hassasiyeti değişmez. Son paket/UI/CI kanıtı [delivery-summary.json](delivery-summary.json) içinde tamamlanır; kendi hash'ini içeren commit üretilmez.

Private tek kapsam paketi `C:/Sirket/ERP/evidence/ERP-CARICOMPLETION01-20261008/private/MELIH_CURRENT_PARTY_APPROVAL_PACKET.md`; makine paketi `current-finance-approval-packet.json`, sealed faz `scalar-precision-phase-plan.json`. Yalnız kullanıcı incelemesi; public kanıt yalnız sayım ve nötr file/hash içerir. Sayısal onay olmadığı için executeAllowed=false, financialWriteAuthorized=false, executableNow=false. ERP-UA24/25 **bekliyor**. Bu hazırlıktan sonra DUR; onay olmadan aktarım veya başka goal yok.
