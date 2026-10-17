// The dedicated CRM draft service never mounts the daily ERP write surface.
export function isCrmOrderTestRouteAllowed(method, path) {
  if (method === 'POST' && path === '/api/auth/login') return true;
  if (method === 'GET' && path === '/api/auth/me') return true;
  if (method === 'POST' && path === '/api/test/crm/orders/drafts') return true;
  if (method === 'POST' && path === '/api/test/crm/orders/v2/drafts') return true;
  if (method === 'GET' && path === '/api/test/crm/orders/v2/customers') return true;
  if (method === 'GET' && /^\/api\/test\/crm\/orders\/v2\/drafts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) return true;
  return method === 'GET'
    && /^\/api\/test\/crm\/orders\/(?:context|drafts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(path);
}
