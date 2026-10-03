import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const blocked = () => { throw Object.assign(new Error('TEST_EXTERNAL_OPERATION_DISABLED'), { code: 'TEST_EXTERNAL_OPERATION_DISABLED' }); };
const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const allowedPorts = new Set([1433, 4144, 4146, 5194]);
function assertDestination(args) {
  const first = args[0];
  let host, port;
  if (typeof first === 'object' && first !== null) {
    host = first.hostname || first.host || 'localhost';
    port = Number(first.port || (first.protocol === 'https:' ? 443 : 80));
    if (first.path && !first.port && !first.host && !first.hostname) blocked();
  } else if (typeof first === 'string' && /^https?:/.test(first)) {
    const u = new URL(first); host = u.hostname; port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
  } else {
    port = Number(first); host = typeof args[1] === 'string' ? args[1] : 'localhost';
  }
  if (!allowedHosts.has(String(host).replace(/^\[|\]$/g, '')) || !allowedPorts.has(port)) blocked();
}
for (const [owner, keys] of [[http, ['request', 'get']], [https, ['request', 'get']], [net, ['connect', 'createConnection']], [tls, ['connect']]]) {
  for (const key of keys) { const original = owner[key]; owner[key] = function (...args) { assertDestination(args); return original.apply(this, args); }; }
}
for (const key of ['exec', 'execFile', 'execSync', 'execFileSync', 'spawn', 'spawnSync', 'fork']) childProcess[key] = blocked;
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, options) { assertDestination([typeof input === 'string' || input instanceof URL ? String(input) : input.url]); return originalFetch(input, options); };
syncBuiltinESMExports();

export const networkPolicy = Object.freeze({ hosts: [...allowedHosts], ports: [...allowedPorts], subprocesses: false, externalMessages: false });
