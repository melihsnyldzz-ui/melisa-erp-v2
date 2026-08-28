import {
  assignTerminalEmployee,
  createEmployee,
  createTerminalDevice,
  getPersonnelOverview,
  updateEmployee,
} from '../services/personnelService.js';
import { created, fail, ok } from '../utils/response.js';

function personnelFail(res, error, fallbackCode) {
  return fail(
    res,
    error.statusCode || 503,
    error.code || fallbackCode,
    error.statusCode ? error.message : 'Personnel request failed',
  );
}

export async function getPersonnel(req, res) {
  try {
    return ok(res, await getPersonnelOverview(), { source: 'sql-personnel' });
  } catch (error) {
    return personnelFail(res, error, 'PERSONNEL_OVERVIEW_FAILED');
  }
}

export async function postEmployee(req, res) {
  try {
    return created(res, await createEmployee(req.body, req.user), {
      source: 'sql-write',
      audit: 'employee_created',
    });
  } catch (error) {
    return personnelFail(res, error, 'PERSONNEL_CREATE_FAILED');
  }
}

export async function patchEmployee(req, res) {
  try {
    return ok(res, await updateEmployee(req.params.id, req.body, req.user), {
      source: 'sql-write',
      audit: 'employee_updated',
    });
  } catch (error) {
    return personnelFail(res, error, 'PERSONNEL_UPDATE_FAILED');
  }
}

export async function postTerminalDevice(req, res) {
  try {
    return created(res, await createTerminalDevice(req.body, req.user), {
      source: 'sql-write',
      audit: 'terminal_device_created',
    });
  } catch (error) {
    return personnelFail(res, error, 'TERMINAL_DEVICE_CREATE_FAILED');
  }
}

export async function patchTerminalEmployee(req, res) {
  try {
    return ok(res, await assignTerminalEmployee(req.params.id, req.body, req.user), {
      source: 'sql-write',
      audit: 'terminal_employee_assigned',
    });
  } catch (error) {
    return personnelFail(res, error, 'TERMINAL_EMPLOYEE_ASSIGN_FAILED');
  }
}
