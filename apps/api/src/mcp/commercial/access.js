import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fail } from './policy.js';

export const requestAccess = new AsyncLocalStorage();
const customerTools = new Set(['search_catalog', 'get_product_image']);
export function sameSecret(left, right) {
  const a = Buffer.from(left || ''), b = Buffer.from(right || '');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function authenticate(authorization, adminToken, customerToken) {
  const token = /^Bearer ([^\s]+)$/i.exec(authorization || '')?.[1];
  if (sameSecret(token, adminToken)) return 'administrator';
  if (sameSecret(token, customerToken)) return 'customer';
  return null;
}
export function allowedTool(role, name) {
  return role === 'administrator' || (role === 'customer' && customerTools.has(name));
}
export function assertAdministrator() {
  // Direct imports in opt-in local audits have no HTTP principal. HTTP calls
  // always run inside requestAccess; caller-supplied arguments cannot set roles.
  const role = requestAccess.getStore()?.role;
  if (role && role !== 'administrator') throw fail('ACCESS_DENIED');
}
