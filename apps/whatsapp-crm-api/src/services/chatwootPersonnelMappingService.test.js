import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../config/env.js';
import { getChatwootPersonnelMapping } from './chatwootPersonnelMappingService.js';

test('ERP personnel maps to Chatwoot agents explicitly and by unique identity', async () => {
  const originalFetch = global.fetch;
  const originalErpBaseUrl = env.erpApi.baseUrl;
  const originalChatwoot = {
    ...env.chatwoot,
    agentPersonnelMap: new Map(env.chatwoot.agentPersonnelMap),
  };
  env.erpApi.baseUrl = 'http://erp.local';
  env.chatwoot.baseUrl = 'http://chatwoot.local';
  env.chatwoot.accountId = 2;
  env.chatwoot.apiAccessToken = 'test-token';
  env.chatwoot.agentPersonnelMap = new Map([[7, 19]]);

  global.fetch = async (url) => {
    if (String(url).includes('/api/personnel/overview')) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          employees: [
            { id: 70, userId: 7, username: 'ahmet', fullName: 'Ahmet Yilmaz', isActive: true },
            { id: 80, userId: 8, username: 'semih', fullName: 'Semih Kaya', isActive: true },
          ],
        },
      }), { status: 200 });
    }

    return new Response(JSON.stringify([
      { id: 19, name: 'Ahmet Agent', available_name: 'Ahmet', email: 'agent@example.com' },
      { id: 20, name: 'Semih', available_name: 'Semih', email: 'semih@example.com' },
    ]), { status: 200 });
  };

  try {
    const result = await getChatwootPersonnelMapping({ accessToken: 'erp-token' });
    assert.equal(result.summary.mapped, 2);
    assert.equal(result.mappings[0].mappingState, 'explicit');
    assert.equal(result.mappings[0].chatwootAgentId, 19);
    assert.equal(result.mappings[1].mappingState, 'automatic');
    assert.equal(result.mappings[1].chatwootAgentId, 20);
    assert.equal(result.readOnly, true);
  } finally {
    global.fetch = originalFetch;
    env.erpApi.baseUrl = originalErpBaseUrl;
    Object.assign(env.chatwoot, originalChatwoot);
  }
});
