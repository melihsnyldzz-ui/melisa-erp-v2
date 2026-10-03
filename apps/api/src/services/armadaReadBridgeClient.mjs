import { readFile } from 'node:fs/promises';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isAbsolute } from 'node:path';
const mac = (key, value) => createHmac('sha256', key).update(value).digest('hex');
export async function readArmadaProfile() {
  const path = process.env.ARMADA_PROFILE_PATH;
  if (!isAbsolute(path || '')) throw Object.assign(new Error('Armada bağlantı profili yapılandırılmadı.'), { code: 'ARMADA_PROFILE_REQUIRED', statusCode: 503 });
  const profile = JSON.parse(await readFile(path, 'utf8'));
  if (profile.bridgeUrl !== 'http://192.168.1.42:4533/read' || !/^[a-f0-9]{64}$/.test(profile.key || '')
    || !Number.isSafeInteger(profile.terminalId) || profile.terminalId < 1) throw new Error('ARMADA_PROFILE_INVALID');
  return profile;
}
export async function queryArmadaBridge(profile, operation, uid, fetchImpl = fetch) {
  if (!['snapshot', 'link', 'units'].includes(operation)) throw new Error('ARMADA_BRIDGE_OPERATION_INVALID');
  if (operation === 'units' && (!Array.isArray(uid) || !uid.length || uid.length > 100
    || new Set(uid).size !== uid.length || uid.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647))) throw new Error('ARMADA_BRIDGE_UNITS_INVALID');
  const nonce = randomBytes(16).toString('hex'); const time = String(Date.now());
  const raw = JSON.stringify({ operation, terminalId: profile.terminalId,
    ...(operation === 'units' ? { unitIds: uid } : uid ? { uid } : {}) });
  const response = await fetchImpl(profile.bridgeUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Melisa-Time': time, 'X-Melisa-Nonce': nonce,
      'X-Melisa-Signature': mac(profile.key, `${time}\n${nonce}\n${raw}`) }, body: raw });
  if (!response.ok) throw new Error('ARMADA_BRIDGE_UNAVAILABLE');
  let body = ''; const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    body += decoder.decode(chunk, { stream: true });
    if (body.length > 65536) throw new Error('ARMADA_BRIDGE_RESPONSE_LIMIT');
  }
  body += decoder.decode();
  const signature = response.headers.get('x-melisa-signature');
  const expected = mac(profile.key, `${nonce}\n${body}`);
  if (!/^[a-f0-9]{64}$/.test(signature || '') || !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) throw new Error('ARMADA_BRIDGE_RESPONSE_UNTRUSTED');
  const payload = JSON.parse(body);
  if (payload.nonce !== nonce || payload.result?.ok !== true || !Array.isArray(payload.result.recordsets)
    || Math.abs(Date.now() - Date.parse(payload.result.readAt || '')) > 60000 || !Number.isFinite(Date.parse(payload.result.readAt || ''))) throw new Error('ARMADA_BRIDGE_READ_INVALID');
  return payload.result;
}
