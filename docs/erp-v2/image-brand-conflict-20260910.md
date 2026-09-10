# Fotoğraf içe aktarmada marka çelişkisi — 2026-09-10

Gerçek salt okunur örnekte 159414 / 4711 LEYLEK / PATİK kaydının fotoğrafı Mymio 4711 kıyafet takımını gösteriyor. Geçmişte bu kaydı hangi işlem oluşturduğuna dair kayıt henüz incelenmedi; olayın kök nedeni kesinleştirilmedi.

Kaynak incelemesinde `daily-vega-image-import.mjs`, marka eşleşmediğinde bile tek aktif model kodunu yüzde 95 güvenle otomatik seçiyordu. Bu yol aynı sayısal kodu kullanan farklı markaları karıştırabilir. Seçim saf `selectImageImportMatch` fonksiyonuna taşındı; `unique_active_code` artık yalnız tedarikçi/marka bilgisi boş olduğunda kullanılabilir. Rapor kural sürümü 3 oldu. Doğru marka+kod eşleşmesi ve açık manuel seçim korunur. Benzer marka ve yeni kart adayları mevcut ayrı kurallarıyla değerlendirilir; bunlar anlamsal fotoğraf doğruluğu garantisi değildir.

13 politika testi geçti: gerçek çelişkinin kayıt kimlikleriyle regresyon örneği, aynı numaralı doğru marka seçimi, markasız tekil/çoklu kod ve manuel seçim dahil. API 152 kaynak kökü checkJs sıfır hata; değişen üç dosya lint ve importer sözdizimi geçti. Web build geçti; mevcut bundle/use-client uyarıları sürüyor.

Importer çalıştırılmadı; SQL, gerçek görsel veya bağlantı yazılmadı. Düzeltme yalnız izole adayda. Mevcut yanlış eşleşmeler bu değişiklikle otomatik onarılmaz. Sonraki: geçmiş import raporundan kaynağı doğrulamak, mevcut bağlantıları salt okunur taramak ve kesin kimlik kanıtıyla düzeltme listesi hazırlamak. Canlı uygulama ve veri düzeltmesi ayrı onay gerektirir.
