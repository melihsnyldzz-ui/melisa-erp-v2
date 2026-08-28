import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';

const serviceEmail = 'erp-service@melisa.local';
const serviceName = 'Melisa ERP Service';
const servicePassword = randomBytes(32).toString('base64url');
const passwordHash = await bcrypt.hash(servicePassword, 12);
const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.replace(/\s*$/, '')}\n${line}\n`;
}

const sql = `
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "createdAt", "updatedAt")
VALUES (
  ${sqlLiteral(randomUUID())},
  ${sqlLiteral(serviceName)},
  ${sqlLiteral(serviceEmail)},
  ${sqlLiteral(passwordHash)},
  'SALES',
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = 'SALES',
  "isActive" = TRUE,
  "updatedAt" = NOW();
`;

const databaseUpdate = spawnSync(
  'docker',
  [
    'exec', '-i', 'nakliyat-postgres-1', 'sh', '-lc',
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
  ],
  { encoding: 'utf8', input: sql, windowsHide: true },
);

if (databaseUpdate.status !== 0) {
  throw new Error('Nakliyat service account could not be created.');
}

let envText = readFileSync(envPath, 'utf8');
const settings = {
  NAKLIYAT_ENABLED: 'true',
  NAKLIYAT_API_BASE_URL: 'http://127.0.0.1:44555',
  NAKLIYAT_SERVICE_EMAIL: serviceEmail,
  NAKLIYAT_SERVICE_PASSWORD: servicePassword,
  NAKLIYAT_ALLOW_DRAFT_CREATE: 'true',
  NAKLIYAT_ALLOW_PRODUCTION_RATES: 'true',
  NAKLIYAT_ALLOW_CUSTOMER_QUOTE_CREATE: 'false',
  NAKLIYAT_ALLOW_FINALIZE: 'false',
};

for (const [key, value] of Object.entries(settings)) {
  envText = setEnvValue(envText, key, value);
}

writeFileSync(envPath, envText, 'utf8');
process.stdout.write(JSON.stringify({
  serviceAccount: serviceEmail,
  role: 'SALES',
  draftCreate: true,
  productionRates: true,
  customerQuoteCreate: false,
  finalize: false,
  passwordPrinted: false,
}));
