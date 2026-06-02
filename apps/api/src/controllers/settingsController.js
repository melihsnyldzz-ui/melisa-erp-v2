import { getSettingsOverview, updateSettings } from '../services/settingsService.js';
import { fail, ok } from '../utils/response.js';

function settingsFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Settings request failed',
  );
}

export async function getSettings(req, res) {
  try {
    const data = await getSettingsOverview();
    return ok(res, data, { source: 'sql-system-settings' });
  } catch (error) {
    return settingsFail(res, error, 'SETTINGS_OVERVIEW_FAILED');
  }
}

export async function putSettings(req, res) {
  try {
    const data = await updateSettings(req.body, req.user);
    return ok(res, data, { source: 'sql-system-settings' });
  } catch (error) {
    return settingsFail(res, error, 'SETTINGS_UPDATE_FAILED');
  }
}
