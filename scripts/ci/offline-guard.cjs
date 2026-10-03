// Loaded before application imports, including in Node test workers.
// CI may use only in-memory fixtures and loopback servers created here on port 0.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const Module = require('node:module');
const net = require('node:net');
const tls = require('node:tls');
const dns = require('node:dns');
const http = require('node:http');
const https = require('node:https');
const childProcess = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const allowedPorts = new Set();
const deny = () => { throw Object.assign(new Error('CI_OFFLINE_BOUNDARY: external access denied'), { code: 'CI_OFFLINE_BOUNDARY' }); };

// Do not inherit SQL, provider, token, print or host configuration from a shell.
for (const name of Object.keys(process.env)) {
  if (/^(SQL_|VEGA_|JWT_|WHATSAPP_|WAAPI_|EVOLUTION_|CHATWOOT_|NAKLIYAT_|MELISA_|NATIVE_|TERMINAL_|VITE_)/i.test(name)) delete process.env[name];
}
Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV === 'production' ? 'production' : 'test', SQL_READ_ONLY: 'true', WHATSAPP_ENABLED: 'false', NAKLIYAT_ENABLED: 'false', TERMINAL_RECEIPT_PRINT_ENABLED: 'false' });

function safePath(value) {
  const filename = value instanceof URL ? fileURLToPath(value) : Buffer.isBuffer(value) ? value.toString() : value;
  if (typeof filename === 'string' && /^\.env(?:\.|$)/i.test(path.basename(filename))) deny();
}
for (const method of ['readFileSync', 'readFile', 'openSync', 'open']) {
  const original = fs[method];
  fs[method] = function (filename, ...args) { safePath(filename); return original.call(this, filename, ...args); };
}
for (const method of ['readFile', 'open']) {
  const original = fs.promises[method];
  fs.promises[method] = async function (filename, ...args) { safePath(filename); return original.call(this, filename, ...args); };
}

function checkTarget(host, port) {
  if (!['127.0.0.1', '::1'].includes(host) || !allowedPorts.has(Number(port))) deny();
}
function checkConnect(args) {
  if (Array.isArray(args[0])) args = args[0];
  const first = args[0];
  if (first && typeof first === 'object') { if (first.path) deny(); checkTarget(first.host || 'localhost', first.port); }
  else checkTarget(typeof args[1] === 'string' ? args[1] : 'localhost', first);
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) { checkConnect(args); return connect.apply(this, args); };
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const first = args[0];
  const port = typeof first === 'object' ? first.port : first;
  const host = typeof first === 'object' ? first.host : args[1];
  if (port !== 0 || !['127.0.0.1', '::1'].includes(host)) deny();
  let registeredPort;
  this.once('listening', () => { registeredPort = this.address().port; allowedPorts.add(registeredPort); });
  this.once('close', () => allowedPorts.delete(registeredPort));
  return listen.apply(this, args);
};
tls.connect = deny;
const lookup = dns.lookup;
for (const method of ['lookup', 'resolve', 'resolve4', 'resolve6', 'reverse', 'lookupService']) {
  dns[method] = deny;
  if (dns.promises[method]) dns.promises[method] = deny;
}
dns.lookup = function (hostname, ...args) {
  if (!['127.0.0.1', '::1'].includes(hostname)) deny();
  return lookup.call(this, hostname, ...args);
};
for (const name of Object.keys(dns)) if (name.startsWith('resolve') && typeof dns[name] === 'function') dns[name] = deny;
for (const name of Object.keys(dns.promises)) if (name.startsWith('resolve')) dns.promises[name] = deny;
const fetch = globalThis.fetch;
globalThis.fetch = function (input, ...args) { const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); checkTarget(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80)); return fetch.call(this, input, ...args); };
const request = http.request;
http.request = function (...args) {
  const first = args[0];
  if (typeof first === 'string' || first instanceof URL) { const url = new URL(first); checkTarget(url.hostname, url.port || 80); }
  else checkTarget(first.hostname || first.host || 'localhost', first.port || 80);
  return request.apply(this, args);
};
http.get = function (...args) { const req = http.request(...args); req.end(); return req; };
https.request = deny;
https.get = deny;
require('node:dgram').createSocket = deny;
require('node:http2').connect = deny;

// ODBC is intentionally absent on GitHub Linux. Keep the real mssql JS wrappers
// for driver-selection assertions; replace only the native binding and reject
// every native operation. No SQL connection can cross this boundary.
const load = Module._load;
const nativeBinding = new Proxy({}, { get() { return deny; } });
Module._load = function (name, ...args) {
  if (name === 'msnodesqlv8') return nativeBinding;
  return load.call(this, name, ...args);
};

// Node workers must retain this preload. Only esbuild's installed helper is
// allowed as a non-Node child; arbitrary shell commands are never allowed.
const esbuildPaths = ['api', 'web-admin', 'sites-workflow'].flatMap(app => [
  path.join(root, 'apps', app, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild'),
  path.join(root, 'apps', app, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
]);
function childOptions(command, args, options = {}) {
  if (options.shell) deny();
  if (path.resolve(command) === process.execPath) {
    if (!Array.isArray(args) || !args.includes('--require') || !args.includes(__filename)) deny();
    return { ...options, env: { ...process.env, ...options.env, NODE_OPTIONS: `--require="${__filename.replaceAll('\\', '/')}"` } };
  }
  if (!esbuildPaths.includes(path.resolve(command))) deny();
  if (!Array.isArray(args) || !/^--service=\d+\.\d+\.\d+$/.test(args[0]) || args.slice(1).some(arg => arg !== '--ping')) deny();
  return options;
}
for (const method of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
  const original = childProcess[method];
  childProcess[method] = function (command, args, options, callback) {
    const checked = childOptions(command, args, typeof options === 'function' ? {} : options);
    return original.call(this, command, args, checked, typeof options === 'function' ? options : callback);
  };
}
childProcess.exec = function (command, ...args) {
  // Vite probes Windows drive maps during local validation. Do not run that
  // host command: the isolated source snapshot has no mapped drives.
  if (process.platform === 'win32' && command === 'net use' && typeof args.at(-1) === 'function') {
    queueMicrotask(() => args.at(-1)(null, '', ''));
    return { kill() {} };
  }
  deny();
};
childProcess.execSync = deny;
childProcess.fork = deny;
Module.syncBuiltinESMExports();
