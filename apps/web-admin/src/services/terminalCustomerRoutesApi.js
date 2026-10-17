import { get, post, put } from './apiClient.js';

const basePath = '/api/terminal-admin/customer-routes';

// The endpoint returns complete references and assignments under one revision.
export function fetchTerminalCustomerRoutes() {
  return get(basePath);
}

export function createTerminalCustomerRoute(body) {
  return post(basePath, body);
}

export function updateTerminalCustomerRoute(routeId, body) {
  return put(`${basePath}/${encodeURIComponent(routeId)}`, body);
}

export function saveTerminalCustomerRouteAssignments(body) {
  return put(`${basePath}/assignments`, body);
}
