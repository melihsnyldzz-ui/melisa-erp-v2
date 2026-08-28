# WhatsApp CRM Transformation Sprint 001 Report

## Sprint Header

- **Sprint:** 001 - UI Foundation
- **Phase:** Foundation
- **Business Goal:** Tek WhatsApp hattının gelen kutusu, sohbet ve müşteri bağlamını aynı ekranda sıkışmadan göstermek.
- **Business Value:** High
- **Priority:** P1
- **Risk:** Medium, UI-only

## Completed Scope

- CRM için modül seviyesinde ayrı bir görsel katman eklendi.
- Varsayılan çalışma alanı `gelen kutusu + sohbet + müşteri bilgileri` olmak üzere üç ana kolona indirildi.
- Dördüncü bağlantı paneli yalnızca 1800 piksel ve üzerindeki geniş ekranlarda gösterilecek şekilde sınırlandı.
- CRM servis durumu üst başlıkta görünür hale getirildi.
- CRM vurgu rengi konuşma ve operasyon durumlarına uygun yeşil tona taşındı.
- Seçili konuşma, mesaj balonu ve hızlı aksiyon hiyerarşisi güçlendirildi.

## Out Of Scope

- Gerçek WhatsApp hattı bağlama veya mesaj gönderme.
- CRM API, veri tabanı veya ERP ticari iş kurallarını değiştirme.
- Demo konuşmalarını kaldırma; bu iş Sprint 002 kapsamındadır.

## Acceptance Result

- Web-admin build başarılı.
- WhatsApp güvenlik sınırı smoke testi `7/7 PASS`.
- CRM UI foundation smoke testi başarılı.
- Canlı tarayıcıda gelen kutusu, sohbet ve müşteri paneli birlikte doğrulandı.
- CRM API kapalı veya erişilemiyorsa mesaj gönderimi kapalı kalmaya devam ediyor.

## Files

- `apps/web-admin/src/modules/whatsapp-crm/WhatsappCrmInboxScreen.jsx`
- `apps/web-admin/src/modules/whatsapp-crm/whatsapp-crm-v2.css`
- `scripts/web-admin-crm-ui-foundation-smoke.mjs`
- `docs/erp-v2/whatsapp-crm-transformation-sprint-001-report.md`

## Next Sprint

Sprint 002 - Real Inbox Truth: demo/fallback konuşmalarının operasyon ekranından kaldırılması ve yalnızca CRM PostgreSQL/API verisinin gösterilmesi.
