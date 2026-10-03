import { get, patch, post } from './apiClient.js';

export async function fetchPersonnelOverview() {
  return get('/api/personnel/overview');
}

export async function createPersonnelEmployee(payload) {
  return post('/api/personnel/employees', payload);
}

export async function updatePersonnelEmployee(id, payload) {
  return patch(`/api/personnel/employees/${id}`, payload);
}

export async function createPersonnelTerminal(payload) {
  return post('/api/personnel/terminals', payload);
}

export async function assignTerminalEmployee(deviceId, employeeId) {
  return patch(`/api/personnel/terminals/${deviceId}/employee`, { employeeId });
}
