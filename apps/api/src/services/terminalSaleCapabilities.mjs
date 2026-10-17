import { readArmadaProfile } from './armadaReadBridgeClient.mjs';

const result = (enabled, code, message, temporary = false) => ({ enabled, code, message, temporary });
const unavailable = () => result(false, 'TERMINAL_SALE_CAPABILITY_UNAVAILABLE',
  'Vega satış yetkisi şu an kontrol edilemiyor. Bağlantıyı kontrol edip yeniden deneyin.', true);
async function authorizeOperator(terminalCode, actorUserId) {
  const { getTerminalOperatorContext } = await import('./terminalService.js');
  return getTerminalOperatorContext(terminalCode, actorUserId);
}

// This endpoint describes only the authenticated person's Vega sale access.
// It does not grant access, read commercial rows or replace final live preflight.
export function createTerminalSaleCapabilityReader({ loadProfile = readArmadaProfile, authorize = authorizeOperator } = {}) {
  return async function readTerminalSaleCapabilities({ terminalCode, actor }) {
    if (!Number.isSafeInteger(Number(actor?.id)) || Number(actor.id) < 1 || !actor?.username) {
      return result(false, 'TERMINAL_OPERATOR_REQUIRED', 'Satış yetkisini kontrol etmek için personel girişi gerekli.');
    }
    const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
    if (!permissions.includes('terminal.sales.create')
      && !(permissions.includes('sales.create') && permissions.includes('sales.finalize'))) {
      return result(false, 'TERMINAL_SALE_PERMISSION_REQUIRED', 'Bu personelin Vega fişi gönderme yetkisi yok.');
    }
    if (typeof terminalCode !== 'string' || !terminalCode.trim() || terminalCode.length > 80) {
      return result(false, 'TERMINAL_CODE_REQUIRED', 'Terminal cihaz bilgisi bulunamadı. Bağlantı ayarlarını kontrol edin.');
    }
    let profile;
    try { profile = await loadProfile(); } catch { return unavailable(); }
    if (!profile || profile.dailyEnabled !== true) {
      return result(false, 'ARMADA_DAILY_DISABLED', 'Vega satış gönderimi şu anda kapalı. Fişlerinizi taslak olarak saklayabilirsiniz.');
    }
    if (String(actor.username).toLowerCase() !== profile.username || terminalCode !== profile.terminalCode) {
      return result(false, 'ARMADA_OPERATOR_MISMATCH', 'Bu personelin bu terminalde Vega gönderim eşleştirmesi tamamlanmadı.');
    }
    if (![profile.terminalId, profile.personnelId, profile.depotId].every((id) => Number.isSafeInteger(id) && id > 0)
      || !profile.personnelCode || !profile.depotCode || !/^[a-f0-9]{64}$/.test(profile.rateSigningKey || '')) {
      return result(false, 'TERMINAL_SALE_CONFIGURATION_REQUIRED', 'Vega gönderim ayarları eksik. Kurulum kontrolü gerekiyor.');
    }
    try { await authorize(terminalCode, Number(actor.id)); }
    catch (error) {
      const denied = {
        TERMINAL_EMPLOYEE_SALE_RESTRICTED: 'Bu personelin terminalden satış yapma yetkisi kapalı.',
        TERMINAL_EMPLOYEE_NOT_ASSIGNED: 'Kullanıcının aktif personel kaydı bulunamadı. Personel eşleştirmesi gerekiyor.',
        TERMINAL_DEVICE_NOT_ACTIVE: 'Bu terminal satışa açık değil. Cihaz kaydını kontrol edin.',
      };
      return denied[error.code] ? result(false, error.code, denied[error.code]) : unavailable();
    }
    return result(true, 'TERMINAL_VEGA_SALE_ALLOWED', 'Vega gönderim eşleştirmeniz hazır. Her fiş gönderilirken yeniden kontrol edilir.');
  };
}

export const getTerminalSaleCapabilities = createTerminalSaleCapabilityReader();
