# Dashboard: eksik ticari veri gösterimi — 2026-09-10

Eksik müşteri/ürün/stok sayaçları ve satış/kâr/cari alt bilgileri sıfır olarak gösterilmiyor. Undefined Veri yok, null veya geçersiz değer Hesaplanamadı; gerçek sıfır korunur. Brüt oran yalnız bilinen tutarlar ve pozitif satış üzerinden hesaplanır; açık null başka sayıya düşmez. Eksik stok/kâr için yeşil başarı tonu kullanılmaz. Statik stok temiz/eksi stok yok iddiaları nötr rapor bağlantılarına çevrildi.

11 para/sayaç testi ve tüm sınırlı web ticaret paketi PASS; eski loading testi eksik diziyi sıfır bekliyordu, yeni doğruluk kuralına göre güncellendi. Web typecheck 187 kök/0 hata, değişen kaynak lint PASS, build 3.69s PASS (mevcut büyük chunk uyarısı). Gerçek AppShell + sentetik loopback summary/alerts üzerinden tarayıcıda Veri yok etiketleri doğrulandı; 390px ekran görüntüsü incelendi, JS hatası yok. Test sunucuları ve tarayıcı kapatıldı. Gerçek iş verisi okunmadı/yazılmadı; mesajlaşma metrikleri değiştirilmedi.

Kanıt: temp/dashboard-unknown-{tests,type,build}.log; temp/dashboard-unknown/mobile.png ve requests.jsonl. Koruma 66 repo/2182 dosya/6 önceden onaylı istisna, değişen 0. Katalog 16 test PASS; native yazdırma penceresi kabulü ve production geçişi açık. Genel hedef devam ediyor.
