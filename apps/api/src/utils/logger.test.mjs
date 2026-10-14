import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {logger, requestLogPath} from './logger.js';

const requestId = '11111111-2222-4333-8444-555555555555';
const marker = 'harmless-canary-unique-head-and-tail';
const redacted = '[REDACTED]';

test('SQL diagnostic numeric vocabulary retains exact bounded integers only',()=>{
 const original=console.error,lines=[];console.error=v=>lines.push(JSON.parse(v));
 try{
  logger.error('API error normalized',{sqlNumber:2147483647,sqlState:255,sqlClass:25,sqlLineNumber:1000000});
  assert.deepEqual(Object.fromEntries(Object.keys(lines[0]).filter(k=>k.startsWith('sql')).map(k=>[k,lines[0][k]])),{sqlNumber:2147483647,sqlState:255,sqlClass:25,sqlLineNumber:1000000});
  for(const [key,bad] of Object.entries({sqlNumber:[0,-1,2147483648,'51904',1.1],sqlState:[-1,256,'1',0.5],sqlClass:[-1,26,'16',1.5],sqlLineNumber:[-1,1000001,'30',0.5]}))for(const value of bad){logger.error('API error normalized',{[key]:value});assert.equal(lines.at(-1)[key],redacted);}
 }finally{console.error=original;}
});

function capture(run) {
  const lines = [];
  const original = {log: console.log, warn: console.warn, error: console.error};
  try {
    for (const method of Object.keys(original)) console[method] = line => lines.push(line);
    run();
  } finally {
    Object.assign(console, original);
  }
  return lines.map(line => ({line, payload: JSON.parse(line)}));
}

function noCanary(lines) {
  for (const {line} of lines) {
    // Check partial disclosure too, rather than only the whole original value.
    for (const part of [marker, 'harmless-canary', 'unique-head', 'and-tail']) assert.equal(line.includes(part), false);
  }
}

test('copy server-context diagnostic keeps only its exact closed code; synthetic and near-match codes remain redacted',()=>{
 const code='ISOLATED_COPY_SERVER_CONTEXT_REQUIRED';
 assert.equal(capture(()=>logger.error('API error normalized',{code}))[0].payload.code,code);
 for(const synthetic of [code+'_PRIVATE',code+'_SECRET','ISOLATED_COPY_SYNTHETIC_SCOPE','SYNTHETIC_CANARY_ABC123','GUARDED_HEADER_REACHED','STOP_HEADER','STOP_CARD','OFFLINE_TEST_FAILURE'])assert.equal(capture(()=>logger.error('API error normalized',{code:synthetic}))[0].payload.code,redacted);
});

test('serialized logs completely redact key variants, free text, Error and raw query', () => {
  const err = Object.assign(new Error(`Authorization: Bearer ${marker}`), {code: 'INTERNAL_ERROR'});
  const values = {};
  for (const key of ['password', 'apiKey', 'API_KEY', 'api-key', 'set-cookie', 'Authorization', 'connectionString', 'connection_string', 'clientSecret', 'accessToken', 'private-key', 'credentials', 'dsn']) {
    values[key] = {value: marker, statusCode: 200};
  }
  const lines = capture(() => {
    logger.info(`free text ${marker}`, {
      ...values, context: {message: marker, stack: marker, error: err},
      details: [`Password=${marker};Server=fixture`, err], warning: marker,
      query: {key: marker}, path: `/fixture?api_key=${marker}`,
      requestId: `key=${marker}`, code: `authorization=${marker}`,
    });
    logger.error(err, {statusCode: 500, error: err});
  });
  noCanary(lines);
  assert.equal(lines[0].payload.message, redacted);
  assert.equal(lines[0].payload.requestId, redacted);
  assert.equal(lines[0].payload.path, redacted);
  for (const key of Object.keys(values)) assert.equal(Object.hasOwn(lines[0].payload, key), false);
  assert.ok(lines[0].payload.omittedFields >= Object.keys(values).length);
  assert.equal(lines[1].payload.error.code, 'INTERNAL_ERROR');
  assert.equal(lines[1].payload.statusCode, 500);
});

test('preserves typed diagnostics and prevents metadata from overriding trusted envelope', () => {
  const lines = capture(() => logger.warn('API request completed', {
    level: marker, message: marker, timestamp: marker,
    requestId, method: 'POST', path: requestLogPath({route: {path: '/fixture/:id'}}), code: 'VALIDATION_ERROR', eventCode: 'API_REQUEST_COMPLETED',
    category: 'api_request', statusCode: 201, durationMs: 15, port: 5234,
    apiVersion: 'v2', nodeEnv: 'test', signal: 'SIGTERM',
    sqlConfigured: false, vegaEnabled: false, authEnabled: true,
  }));
  noCanary(lines);
  const payload = lines[0].payload;
  assert.equal(payload.level, 'warn');
  assert.equal(payload.message, 'API request completed');
  assert.equal(Number.isNaN(Date.parse(payload.timestamp)), false);
  for (const [key, value] of Object.entries({requestId, method: 'POST', path: '/fixture/:id', code: 'VALIDATION_ERROR', eventCode: 'API_REQUEST_COMPLETED', statusCode: 201, durationMs: 15, authEnabled: true, apiVersion: 'v2'})) assert.equal(payload[key], value);
  const unknown = capture(() => logger.info('new free-form event', {eventCode: 'FIXTURE_NEW_EVENT', code: 'AUTH_REQUIRED', statusCode: 202}))[0].payload;
  assert.equal(unknown.message, redacted);
  assert.equal(unknown.eventCode, redacted);
  assert.equal(unknown.code, 'AUTH_REQUIRED');
  assert.equal(unknown.statusCode, 202);
});

test('format-compatible canaries are not accepted as known operation codes or categories', () => {
  const lines = capture(() => logger.error('API error normalized', {
    code: 'SYNTHETIC_CANARY_ABC123', category: 'synthetic_canary_abc123', eventCode: 'SYNTHETIC_CANARY_ABC123',
  }));
  assert.equal(lines[0].line.includes('SYNTHETIC_CANARY_ABC123'), false);
  assert.equal(lines[0].line.includes('synthetic_canary_abc123'), false);
  for (const key of ['code', 'category', 'eventCode']) assert.equal(lines[0].payload[key], redacted);
  for (const code of ['VALIDATION_ERROR', 'UNHANDLED_ERROR', 'AUTH_REQUIRED', 'EREQUEST', 'ETIMEOUT', 'ESOCKET', 'ELOGIN', 'CRM_V2_CRM_RATE_LIMITED', 'MIGRATION_ENTITY_QUARANTINED']) {
    assert.equal(capture(() => logger.error('API error normalized', {code}))[0].payload.code, code);
  }
});

test('offline price fixture errors stay outside the production diagnostic vocabulary', () => {
  for (const code of ['SYNTHETIC_PRIVATE_LEAF_INPUT_PIN', 'SYNTHETIC_PRIVATE_LEAF_MISSING', 'SYNTHETIC_PRICE_QUERY_NOT_MODELED', 'SYNTHETIC_PRICE_READ_PROC', 'SYNTHETIC_PRICE_INTENT_PROC', 'SYNTHETIC_CONFLICT', 'SYNTHETIC_STALE', 'SYNTHETIC_PRICE_STORE_PROC']) {
    const {payload, line} = capture(() => logger.error('API error normalized', {code}))[0];
    assert.equal(payload.code, redacted);
    assert.equal(line.includes(code), false);
  }
});

test('contact native diagnostics retain only the six closed codes and redact private or invented suffixes',()=>{
 for(const code of ['CUSTOMER_CONTACT_UNAVAILABLE','CUSTOMER_CONTACT_FORBIDDEN','CUSTOMER_CONTACT_SCOPE','CUSTOMER_CONTACT_STALE','CUSTOMER_CONTACT_REQUEST_CONFLICT','CUSTOMER_CONTACT_SOURCE_CHANGED'])assert.equal(capture(()=>logger.error('API error normalized',{code}))[0].payload.code,code);
 for(const code of ['CUSTOMER_CONTACT_PRIVATE_SOURCE','CUSTOMER_CONTACT_FORBIDDEN_SECRET','CUSTOMER_CONTACT_UNAVAILABLE_'+marker])assert.equal(capture(()=>logger.error('API error normalized',{code}))[0].payload.code,redacted);
});

test('startup warnings retain distinct static diagnostic codes without accepting new text', () => {
  const warnings = [
    ['JWT_ACCESS_SECRET is missing or shorter than 32 characters', 'JWT_ACCESS_SECRET_WEAK'],
    ['JWT_REFRESH_SECRET is missing or shorter than 32 characters', 'JWT_REFRESH_SECRET_WEAK'],
    ['SQL connection is not configured', 'SQL_NOT_CONFIGURED'],
    ['SQL_TRUST_SERVER_CERTIFICATE=true should be reviewed for production', 'SQL_CERTIFICATE_TRUST_REVIEW'],
    ['CORS_ORIGINS contains localhost in production', 'CORS_LOCALHOST_IN_PRODUCTION'],
    ['JWT access secret is not configured; auth endpoints will fail closed', 'JWT_ACCESS_SECRET_MISSING'],
    ['JWT refresh secret is not configured; refresh endpoints will fail closed', 'JWT_REFRESH_SECRET_MISSING'],
    ['Nakliyat read-only health is enabled, but service credentials are missing; quote operations will fail closed', 'NAKLIYAT_CREDENTIALS_MISSING'],
  ];
  for (const [warning, code] of warnings) {
    const {payload, line} = capture(() => logger.warn('Startup readiness warning', {category: 'startup_warning', warning}))[0];
    assert.equal(payload.warningCode, code);
    assert.equal(payload.category, 'startup_warning');
    assert.equal(line.includes(warning), false);
  }
  const lines = capture(() => logger.warn('Startup readiness warning', {warning: `JWT_ACCESS_SECRET=${marker}`}));
  noCanary(lines);
  assert.equal(lines[0].payload.warningCode, redacted);
});

test('safe field names do not permit wrong types or unbounded text', () => {
  const payload = capture(() => logger.info('API request completed', {
    requestId: {value: marker}, method: marker, eventCode: marker, category: marker,
    statusCode: '200', durationMs: -1, port: 999999, retryAfterSeconds: 901,
    nodeEnv: marker, authEnabled: marker, apiVersion: marker, signal: marker,
  }))[0].payload;
  for (const key of ['requestId', 'method', 'eventCode', 'category', 'statusCode', 'durationMs', 'port', 'retryAfterSeconds', 'nodeEnv', 'authEnabled', 'apiVersion', 'signal']) assert.equal(payload[key], redacted);
});

test('cycles, depth, getters, toJSON, proxies and unsupported primitives fail closed without throwing', () => {
  let getterCalls = 0;
  let toJsonCalls = 0;
  const cycle = {}; cycle.context = cycle;
  const getter = Object.defineProperty({}, 'details', {enumerable: true, get() {getterCalls++; throw new Error(marker);}});
  const json = {toJSON() {toJsonCalls++; throw new Error(marker);}, details: marker};
  let deep = {details: marker}; for (let i = 0; i < 20; i++) deep = {context: deep};
  const proxy = new Proxy({}, {ownKeys() {throw new Error(marker);}});
  const lines = capture(() => {
    logger.error('API error normalized', {context: cycle, details: [getter, json, deep, proxy, 10n, Symbol(marker), Infinity]});
    logger.error('API error normalized', proxy);
    logger.error('API error normalized', Array(100).fill(marker));
  });
  noCanary(lines);
  assert.equal(getterCalls, 0);
  assert.equal(toJsonCalls, 0);
  assert.equal(lines[0].payload.context.context, redacted);
  assert.equal(lines[0].payload.details[0].details, redacted);
  assert.equal(lines[0].payload.details[3], redacted);
  assert.equal(lines[0].payload.details[4], redacted);
  assert.equal(lines.length, 3);
});

test('unknown key names are omitted and known field spelling is canonicalized', () => {
  const lines = capture(() => logger.info('API request completed', {
    [marker]: marker, context: {[marker]: marker, 'STATUS_CODE': 200},
    'request-id': requestId,
  }));
  noCanary(lines);
  assert.equal(lines[0].payload.omittedFields, 1);
  assert.equal(lines[0].payload.context.omittedFields, 1);
  assert.equal(lines[0].payload.context.statusCode, 200);
  assert.equal(lines[0].payload.requestId, requestId);
});

test('log route uses static matched template and does not copy URL, query or parameter values', () => {
  const routeLog = req => capture(() => logger.info('API request completed', {path: requestLogPath(req)}))[0].payload.path;
  assert.equal(routeLog({route: {path: '/fixture/:id'}, originalUrl: `/fixture/${marker}?key=${marker}`}), '/fixture/:id');
  assert.equal(routeLog({originalUrl: `/missing/${marker}?key=${marker}`}), '[unmatched route]');
  assert.equal(routeLog({route: {path: ['/one', '/two']}}), '[unmatched route]');
  const lines = capture(() => logger.error('API error normalized', {
    path: '/SYNTHETIC_CANARY_ABC123', details: {path: '/synthetic_canary_abc123'},
    context: {path: {toString: () => marker}},
  }));
  noCanary(lines);
  assert.equal(lines[0].line.includes('SYNTHETIC_CANARY_ABC123'), false);
  assert.equal(lines[0].line.includes('synthetic_canary_abc123'), false);
  assert.equal(lines[0].payload.path, redacted);
  assert.equal(lines[0].payload.details.path, redacted);
  assert.equal(lines[0].payload.context.path, redacted);
});

test('all current application logger callsites retain their static diagnostic message', async () => {
  const calls = [];
  const sourceCodes = new Set();
  let callCount = 0;
  const codePattern = /(?:\bcode\s*[:=]\s*|\bfail\([^,\r\n]+,\s*[^,\r\n]+,\s*)['"]([A-Z][A-Z0-9_]{1,63})['"]|\b\w*(?:Error|error|Fail|fail)\s*\([^;\r\n)]*?['"]([A-Z][A-Z0-9_]{1,63})['"]/g;
  async function scan(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (entry.name === 'config') continue;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) await scan(url);
      // Offline module doubles use .test-fixture.mjs and are not application
      // callsites. Their synthetic errors must remain redacted by the logger.
      else if (/\.(js|mjs)$/.test(entry.name) && !/\.test(?:-fixture)?\.(?:js|mjs)$/.test(entry.name)) {
        const source = await readFile(url, 'utf8');
        callCount += [...source.matchAll(/logger\.(info|warn|error)\(/g)].length;
        for (const match of source.matchAll(/logger\.(info|warn|error)\(\s*(['"])(.*?)\2/g)) calls.push({level: match[1], message: match[3]});
        if (entry.name !== 'logger.js') for (const match of source.matchAll(codePattern)) sourceCodes.add(match[1] || match[2]);
      }
    }
  }
  await scan(new URL('../', import.meta.url));
  assert.equal(calls.length, 7, 'Review new logger events and their safe operation code when adding a callsite');
  assert.equal(callCount, calls.length, 'Application logger messages must be static');
  const lines = capture(() => {for (const {level, message} of calls) logger[level](message);});
  assert.deepEqual(lines.map(({payload}) => payload.message), calls.map(({message}) => message));
  for (const code of sourceCodes) assert.equal(capture(() => logger.error('API error normalized', {code}))[0].payload.code, code, 'Review and register a new static operation code');
});

// Isolate middleware from application configuration: no .env, DB, network or provider access.
async function loadMiddleware(name) {
  const url = new URL(`../middleware/${name}.js`, import.meta.url);
  let source = await readFile(url, 'utf8');
  source = source.replace("import { env } from '../config/env.js';", "const env = {nodeEnv: 'production', slowRequestMs: 100000};");
  source = source.replace("'../utils/logger.js'", JSON.stringify(new URL('./logger.js', import.meta.url).href));
  source = source.replace("'../services/operationQuarantineError.mjs'", JSON.stringify(new URL('../services/operationQuarantineError.mjs', import.meta.url).href));
  source = source.replace("'../config/isolatedOperationCopyRuntime.mjs'", JSON.stringify(new URL('../config/isolatedOperationCopyRuntime.mjs', import.meta.url).href));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('request and normalized-error middleware serialize safe routes while retaining public response', async () => {
  const {requestContext} = await loadMiddleware('requestContext');
  const {errorHandler} = await loadMiddleware('errorHandler');
  let finish;
  let response;
  let responseStatus;
  const headers = {};
  const req = {get: () => requestId, method: 'GET', originalUrl: `/fixture/${marker}?authorization=${marker}`, route: {path: '/fixture/:id'}};
  const res = {statusCode: 500, headersSent: false, setHeader(key, value) {headers[key] = value;}, on(event, callback) {if (event === 'finish') finish = callback;}, status(value) {responseStatus = value; return this;}, json(value) {response = value; return value;}};
  const lines = capture(() => {
    requestContext(req, res, () => {});
    finish();
    errorHandler(Object.assign(new Error(marker), {code: 'INTERNAL_ERROR', statusCode: 500}), req, res, () => assert.fail('unexpected next'));
  });
  noCanary(lines);
  assert.equal(lines.length, 2);
  for (const {payload} of lines) {assert.equal(payload.path, '/fixture/:id'); assert.equal(payload.requestId, requestId); assert.equal(payload.statusCode, 500);}
  assert.equal(headers['x-request-id'], requestId);
  assert.equal(responseStatus, 500);
  assert.deepEqual(response, {success: false, error: {code: 'INTERNAL_ERROR', message: 'Unexpected server error'}, meta: {requestId}});
  capture(() => errorHandler(Object.assign(new Error('fixture public message'), {code: 'CRM_V2_CRM_RATE_LIMITED', statusCode: 429, retryAfterSeconds: 17}), req, res, () => {}));
  assert.equal(headers['Retry-After'], '17');
  assert.equal(response.error.message, 'fixture public message');
  assert.equal(response.meta.retryAfterSeconds, 17);
});
