// Owner-private Sites entry. Platform identity stays separate from simulated test roles.
import { createApplication } from './application.mjs';
import { createD1Store, createD1Sessions } from './d1-store.mjs';

export function createWorker(assets = new Map()) {
  return {
    async fetch(request, env) {
      // Hosted access is enforced by Sites; an authenticated visitor is also required here.
      if (!request.headers.get('oai-authenticated-user-id')) return new Response('ChatGPT ile yetkili özel Site erişimi gerekli.', { status: 401 });
      let response;
      try {
        const path = new URL(request.url).pathname;
        if (path.startsWith('/api/cloud-test/')) {
          if (!env.DB) return new Response('Synthetic database binding unavailable', { status: 503 });
          const store = await createD1Store(env.DB, { schemaManaged: true });
          const sessions = await createD1Sessions(env.DB, { schemaManaged: true });
          response = await createApplication({ store, sessions })(request);
        } else if (['GET', 'HEAD'].includes(request.method)) {
          const alias = ({ '/': '/erp/cloud.html', '/erp/': '/erp/cloud.html', '/crm/': '/crm/cloud.html', '/terminal/': '/erp/cloud.html' })[path] ?? path;
          const asset = assets.get(alias);
          response = asset ? new Response(request.method === 'HEAD' ? null : asset.bytes, { headers: { 'Content-Type': asset.type, 'Cache-Control': 'no-store' } }) : new Response('Synthetic route unavailable', { status: 404 });
        } else response = new Response('Method not allowed', { status: 405 });
      } catch { response = new Response('Synthetic environment unavailable', { status: 503 }); }
      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'none'");
      return response;
    },
  };
}
