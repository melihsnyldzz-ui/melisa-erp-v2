# Melisa ERP v2 QA Full Sweep - 2026-06-02

## Scope

- Web-admin login was tested with the real local API.
- 26 menu screens were opened through the command palette/sidebar flow.
- API health and core read endpoints were tested against SQL.
- Non-destructive screen buttons were visually checked for presence.
- Destructive/write buttons were not blindly clicked unless they had already been covered by safe no-op/API checks, to avoid creating unintended accounting records.

## Green - Passed

- Login/auth opens the ERP shell.
- 26/26 registered menu screens open.
- No registered menu screen falls into the unmapped screen fallback.
- No permission-denied screen appeared for admin.
- Web-admin production build passed.
- API live read sweep passed: 11/11.
- Old dashboard text `Demo/SQL verisi bekleniyor.` was removed.
- Navigation labels are clean Turkish UTF-8.
- Inputs now use green-focused visual treatment.
- Output/result/total/risk values now use stronger red visual treatment.

## Yellow - Needs Manual Write QA With Test Records

- Save/update/finalize/cancel buttons should be tested with intentional QA records only.
- Import preview/commit should be tested with a real CSV/XLSX file.
- Excel/print buttons are present; browser download/print dialog behavior needs manual confirmation.
- Clipboard copy in WhatsApp planner depends on browser permission.

## Red - Product Gaps

- Real WhatsApp sending integration is not implemented.
- Physical image upload/storage is still limited to URL/path style image records.
- Full bank/cash/check/note accounting modules are not yet implemented.

## Menu Screen Result

- Operasyon Masası: opened, API-backed, remaining empty panels show neutral empty state.
- Stok Listesi: opened.
- Ürün Kartı: opened.
- Fiyat Listesi: opened.
- Stok Hareketleri: opened.
- Cari Kart Listesi: opened.
- Cari Kart: opened.
- Cari Hareketler: opened.
- Cari Ekstre: opened.
- Yeni Satış Fişi: opened.
- Satış Fişleri: opened.
- Teklifler: opened.
- Siparişler: opened.
- Yeni Alış Fişi: opened.
- Alış Fişleri: opened.
- Finans Özeti: opened.
- Tahsilatlar: opened.
- Katalog Listesi: opened.
- WhatsApp Paylaşım: opened.
- Terminal Ekranları: opened.
- Excel / CSV Aktarım: opened.
- Rapor Merkezi: opened.
- Tanım Listeleri: opened.
- Sistem Ayarları: opened.
- Döviz Kurları: opened.
- Yetki ve Denetim: opened.
