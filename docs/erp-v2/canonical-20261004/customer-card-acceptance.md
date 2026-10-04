# Gerçek müşteri kartı — C06 TEST kabulü

## Kapsam ve kabul durumu

Normal Müşteriler ekranı, tek satış denemesi carisi yerine SQL müşteri kartlarını arama ve sayfalama ile açar. Her döviz hesabı kendi para biriminde ve müşteri borç/alacak işaretiyle gösterilir. Dövizler toplanmaz. Kaynak eşleşmesi, güncel bakiye mutabakatı ve karantina birbirinden ayrılır; NULL/bilinmeyen değer sıfır yapılmaz.

Bu dilim salt okunur gerçek TEST kartı kabulünü hazırlar. Yetkili kart düzenleme, gerçek ticari kart yazımı ve personel kabulü bu belge oluşturulduğunda tamamlanmamıştır. Teknik sonuç, paket ve gerçek ekran kanıtı doğrulandıktan sonra aşağıya kaydedilir. Genel C06 henüz tamam değildir.

Kaynak kesimi 30 Eylül 2026'dır; bugünkü canlı Vega verisi olarak sunulmaz. Güncellenmiş native hesapların eski migration etiketi taşıyabilmesi nedeniyle eşleşme yalnız migration_run_id alanından çıkarılmaz. Kaynak kimliği/firma/rol bağı tekil olmalıdır. Kaynakta bilinmeyen ve native geçmişte eşleşmeyen hesaplar açıkça gösterilir.

Normal görüntüleme `customer.view` gerektirir. Kart düzenleme yetkisi görüntüleme yetkisi yerine geçmez. Mevcut TEST kullanıcılarının izinleri değiştirilmez. Canonical TEST yazma politikası ve eski migration/karantina korumaları korunur.

## Personelin deneyeceği beş adım

1. [Müşteriler](http://127.0.0.1:5194/is-akisi-taslagi.html#customers) ekranında kendi bildiğiniz müşteri kodunu/adını arayın; sonraki sayfa ve aktif/pasif filtresini deneyin.
2. Bir kartı açın. TRY/USD/EUR hesaplarının ayrı olduğunu, borç/alacak işaretinin doğru olduğunu ve kaynağın 30 Eylül kesimi olarak belirtildiğini kontrol edin.
3. Doğrulanmamış veya bilinmeyen hesabın gerçek sıfırdan ayırt edildiğini görün. Kaynak eşleşmesinin tek başına güncel bakiye doğrulaması sayılmadığını kontrol edin.
4. Karantinadaki bir kartı inceleyin. Engel gerekçesi görünmeli; bu salt okunur karttan ticari işlem veya düzenleme yapılmamalı.
5. 1440/1024/390 genişlikte arama, kart açma/kapatma ve sayfa geçişini deneyin. Yenilemede kartlar SQL'den okunmalı; hata/boş sonuçta örnek veri gösterilmemeli.

## Teknik kanıt

Uygulama ve gerçek TEST ekran kabulü yürütülüyor; sonuç henüz doğrulanmadı. LIVE değişikliği, main merge, yeni kullanıcı yetkisi veya ticari müşteri yazması bu kapsamda yoktur.
