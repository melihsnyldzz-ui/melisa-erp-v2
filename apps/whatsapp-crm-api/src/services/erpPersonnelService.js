import { env } from '../config/env.js';

function personnelError(code, message, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

async function fetchPersonnelOverview(accessToken) {
  const response = await fetch(`${env.erpApi.baseUrl}/api/personnel/overview`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw personnelError(
      payload?.error?.code || 'WHATSAPP_CRM_PERSONNEL_LOOKUP_FAILED',
      payload?.error?.message || 'ERP personel listesi dogrulanamadi.',
      response.status || 503,
    );
  }

  return payload?.data || { employees: [] };
}

export async function listActivePersonnelUsers({ accessToken }) {
  const overview = await fetchPersonnelOverview(accessToken);
  return (overview.employees || [])
    .filter((item) => item.isActive && item.userId)
    .map((employee) => ({
      id: Number(employee.userId),
      username: employee.username || '',
      displayName: employee.fullName || employee.username || `Personel ${employee.userId}`,
      employeeId: employee.id,
    }));
}

export async function resolveActivePersonnelUser({ userId, accessToken }) {
  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId < 1) {
    throw personnelError('WHATSAPP_CRM_ASSIGNEE_INVALID', 'Gecerli bir personel secilmelidir.');
  }

  const employees = await listActivePersonnelUsers({ accessToken });

  const employee = employees.find((item) => item.id === numericUserId);
  if (!employee) {
    throw personnelError('WHATSAPP_CRM_ASSIGNEE_NOT_ACTIVE', 'Secilen personel aktif degil veya kullanici hesabi yok.', 409);
  }

  return {
    id: numericUserId,
    username: employee.username,
    displayName: employee.displayName,
    employeeId: employee.employeeId,
  };
}
