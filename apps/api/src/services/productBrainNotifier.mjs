import { readFile } from 'node:fs/promises';
import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import { homedir } from 'node:os';

const route = '/internal/media-changed';
const deferredMessage = 'PRODUCT_BRAIN_HINT_DEFERRED_TO_RECONCILIATION';

// Dependency injection keeps fixture tests away from SQL, real keys and HTTP.
export function createProductBrainNotifier({
  environment = process.env,
  readKeyFile = readFile,
  send = (input, init) => fetch(input, init),
  warn = (message) => console.warn(message),
  now = Date.now,
  eventId = randomUUID,
} = {}) {
  return function notifyProductBrain(sourceId) {
    if (environment.PB_NOTIFIER_ENABLED !== 'true') return;
    const id = String(sourceId);
    if (!/^[1-9][0-9]{0,14}$/.test(id)) return;

    // Begin in a microtask, so even a synchronous dependency failure is isolated
    // from the already committed ERP transaction. Never return/await this work.
    void Promise.resolve().then(async () => {
      const keyPath = environment.PB_EVENT_KEY_PATH
        || path.join(homedir(), '.melisa-ai', 'product-brain', 'event-key');
      const key = (await readKeyFile(keyPath, 'utf8')).trim();
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('EVENT_KEY_INVALID');
      const stamp = String(now());
      const body = JSON.stringify({ eventId: eventId(), sourceId: id, kind: 'MEDIA_CHANGED' });
      const signature = createHmac('sha256', key).update(`POST\n${route}\n${stamp}\n${body}`).digest('hex');
      const response = await send(`http://127.0.0.1:4324${route}`, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          'x-pb-timestamp': stamp,
          'x-pb-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(1200),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error('NOTIFY_FAILED');
    }).catch(() => warn(deferredMessage));
  };
}

export const notifyProductBrain = createProductBrainNotifier();
