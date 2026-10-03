import { createHash } from 'node:crypto';

const CASH_CODES = new Set(['1-PEŞİN $', '2-PEŞİN TL', '3-PEŞİN €']);
const NATIVE_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);
const error = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode });
const invalid = (message) => error('TERMINAL_ROUTE_VALIDATION_FAILED', message);
const normalizeCode = (value) => typeof value === 'string' ? value.trim().toLocaleUpperCase('tr-TR') : '';
const positiveId = (value) => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

export function isTerminalCashCustomerCode(value) {
  return CASH_CODES.has(normalizeCode(value));
}

function id(value, label) {
  if (!positiveId(value)) {
    throw invalid(`${label} geçerli bir kimlik olmalıdır.`);
  }
  return Number(value);
}

function requireRevision(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw invalid('Ekranın güncel revision değeri gereklidir.');
  return value;
}

function routeFields(payload, creating) {
  const routeCode = normalizeCode(payload.routeCode);
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!routeCode || routeCode.length > 80 || /[\u0000-\u001f\u007f]/.test(routeCode)) throw invalid('Rota kodu 1–80 karakter olmalıdır.');
  if (!name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) throw invalid('Rota adı 1–200 karakter olmalıdır.');
  const isActive = creating && payload.isActive === undefined ? true : payload.isActive;
  if (typeof isActive !== 'boolean') throw invalid('Rota aktifliği true veya false olmalıdır.');
  return { routeCode, name, isActive };
}

export function terminalRouteOverview(state) {
  // Legacy terminal rows may have ID 0. Keep their identity visible without
  // making them assignable or weakening customer/route/assignment ID checks.
  for (const route of state.routes) id(route.id, 'Rota');
  for (const customer of state.customers) id(customer.id, 'Müşteri');
  const routes = [...state.routes].sort((a, b) => a.id - b.id);
  const customerAssignments = [...state.customerAssignments].sort((a, b) => a.customerId - b.customerId);
  const devices = state.devices.filter((device) => positiveId(device.id)).sort((a, b) => a.id - b.id);
  const unassignableDevices = state.devices.filter((device) => !positiveId(device.id)).map((device) => ({
    legacyId: String(device.id ?? ''), deviceCode: String(device.deviceCode ?? ''),
    deviceName: String(device.deviceName ?? ''), isActive: Boolean(device.isActive), reason: 'LEGACY_INVALID_DEVICE_ID',
  })).sort((a, b) => a.legacyId.localeCompare(b.legacyId) || a.deviceCode.localeCompare(b.deviceCode));
  if (state.deviceAssignments.some((assignment) => !positiveId(assignment.deviceId) || !devices.some((device) => Number(device.id) === Number(assignment.deviceId)))) {
    throw error('TERMINAL_ROUTE_DEVICE_REFERENCE_INVALID', 'Geçersiz veya bulunamayan cihaz kaydına bağlı rota ataması var. Kayıtlar incelenmeden rota yönetimi kullanılamaz.', 503);
  }
  const customers = state.customers.map((customer) => ({
    ...customer,
    isCash: isTerminalCashCustomerCode(customer.code),
    isAssignable: customer.isActive && !customer.isDeleted && !isTerminalCashCustomerCode(customer.code) && NATIVE_CURRENCIES.has(customer.currency),
  })).sort((a, b) => a.id - b.id);
  const deviceAssignments = devices.map((device) => ({
    deviceId: device.id,
    routeIds: [...(state.deviceAssignments.find((item) => item.deviceId === device.id)?.routeIds || [])].sort((a, b) => a - b),
  }));
  const snapshot = { routes, customers, devices, customerAssignments, deviceAssignments };
  return { ...snapshot, unassignableDevices, revision: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') };
}

function validateAssignments(payload, before) {
  const customerAssignments = payload.customerAssignments ?? [];
  const deviceAssignments = payload.deviceAssignments ?? [];
  if (!Array.isArray(customerAssignments) || !Array.isArray(deviceAssignments) || customerAssignments.length + deviceAssignments.length < 1 || customerAssignments.length + deviceAssignments.length > 10000) {
    throw invalid('En az bir müşteri veya cihaz atama değişikliği gereklidir (en fazla 10000).');
  }
  const seenCustomers = new Set();
  const seenDevices = new Set();
  const requireActiveRoute = (routeId) => {
    if (!before.routes.some((route) => route.id === routeId && route.isActive)) throw invalid('Atanan rota mevcut ve aktif olmalıdır.');
  };
  const customers = customerAssignments.map((item) => {
    const customerId = id(item?.customerId, 'Müşteri');
    if (seenCustomers.has(customerId)) throw invalid('Aynı müşteri değişiklik listesinde yalnız bir kez bulunabilir.');
    seenCustomers.add(customerId);
    const customer = before.customers.find((entry) => entry.id === customerId);
    if (!customer) throw invalid('Müşteri bulunamadı.');
    if (item.routeId === null) return { customerId, routeId: null };
    const routeId = id(item.routeId, 'Rota');
    if (!customer.isAssignable) throw invalid('Peşin, pasif, silinmiş veya TRY/USD/EUR dışında dövizli müşteri rotaya atanamaz.');
    requireActiveRoute(routeId);
    return { customerId, routeId };
  });
  const devices = deviceAssignments.map((item) => {
    const deviceId = id(item?.deviceId, 'Cihaz');
    if (seenDevices.has(deviceId)) throw invalid('Aynı cihaz değişiklik listesinde yalnız bir kez bulunabilir.');
    seenDevices.add(deviceId);
    const device = before.devices.find((entry) => entry.id === deviceId);
    if (!device) throw invalid('Cihaz bulunamadı.');
    if (!Array.isArray(item.routeIds) || item.routeIds.length > 10000) throw invalid('Cihaz rotaları liste olmalıdır.');
    const routeIds = item.routeIds.map((value) => id(value, 'Rota'));
    if (new Set(routeIds).size !== routeIds.length) throw invalid('Cihaza aynı rota iki kez atanamaz.');
    if (routeIds.length && !device.isActive) throw invalid('Pasif cihaza rota atanamaz.');
    routeIds.forEach(requireActiveRoute);
    return { deviceId, routeIds: routeIds.sort((a, b) => a - b) };
  });
  return { customerAssignments: customers, deviceAssignments: devices };
}

// The repository boundary lets the same transaction orchestration run in DB-free tests.
export function createTerminalCustomerRoutesService({ repository, assertWriteEnabled }) {
  async function mutate(payload, actor, operation) {
    assertWriteEnabled();
    if (!actor?.id || !actor.permissions?.includes('settings.manage')) throw error('AUTH_PERMISSION_DENIED', 'Rota yönetimi için settings.manage yetkisi gereklidir.', 403);
    const revision = requireRevision(payload?.revision);
    return repository.transaction(async (transaction) => {
      const before = terminalRouteOverview(await transaction.readState());
      if (before.revision !== revision) throw error('TERMINAL_ROUTE_REVISION_STALE', 'Rotalar veya ilgili kartlar değişti. Taslağınızı koruyup güncel kayıtları yeniden yükleyin.', 409);
      await operation(transaction, before);
      return terminalRouteOverview(await transaction.readState());
    }, { write: true });
  }
  return {
    overview: () => repository.transaction(async (transaction) => terminalRouteOverview(await transaction.readState()), { write: false }),
    create: (payload, actor) => mutate(payload, actor, async (transaction, before) => {
      const fields = routeFields(payload, true);
      if (before.routes.some((route) => normalizeCode(route.routeCode) === fields.routeCode)) throw error('TERMINAL_ROUTE_CODE_EXISTS', 'Bu rota kodu zaten kullanılıyor.', 409);
      const route = await transaction.createRoute(fields);
      await transaction.audit({ action: 'terminal_customer_route_created', entityType: 'customer_route', entityId: route.id, afterSnapshot: route, actor });
    }),
    update: (routeIdValue, payload, actor) => mutate(payload, actor, async (transaction, before) => {
      const routeId = id(routeIdValue, 'Rota');
      const previous = before.routes.find((route) => route.id === routeId);
      if (!previous) throw error('TERMINAL_ROUTE_NOT_FOUND', 'Rota bulunamadı.', 404);
      const fields = routeFields(payload, false);
      if (before.routes.some((route) => route.id !== routeId && normalizeCode(route.routeCode) === fields.routeCode)) throw error('TERMINAL_ROUTE_CODE_EXISTS', 'Bu rota kodu zaten kullanılıyor.', 409);
      const route = await transaction.updateRoute(routeId, fields);
      await transaction.audit({ action: 'terminal_customer_route_updated', entityType: 'customer_route', entityId: routeId, beforeSnapshot: previous, afterSnapshot: route, actor });
    }),
    assign: (payload, actor) => mutate(payload, actor, async (transaction, before) => {
      // Validate the entire patch before the first change. Missing entities stay untouched.
      const patch = validateAssignments(payload, before);
      const previous = {
        customerAssignments: patch.customerAssignments.map(({ customerId }) => ({ customerId, routeId: before.customerAssignments.find((item) => item.customerId === customerId)?.routeId ?? null })),
        deviceAssignments: patch.deviceAssignments.map(({ deviceId }) => ({ deviceId, routeIds: before.deviceAssignments.find((item) => item.deviceId === deviceId)?.routeIds || [] })),
      };
      await transaction.applyAssignments(patch);
      await transaction.audit({ action: 'terminal_customer_routes_assigned', entityType: 'terminal_customer_routes', entityId: null, beforeSnapshot: previous, afterSnapshot: patch, actor });
    }),
  };
}

function routeDto(row) {
  return { id: Number(row.id), routeCode: row.route_code, name: row.name, isActive: Boolean(row.is_active), createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function createTerminalCustomerRoutesSqlRepository(dependencies) {
  // Lazy imports ensure pure tests never load DB configuration or connect to SQL.
  const { getSqlPool, getSqlDriver } = dependencies || await import('../config/database.js');
  const { writeAuditLog } = dependencies || await import('./auditService.js');
  const sql = getSqlDriver();
  return {
    async transaction(callback, { write }) {
      const pool = await getSqlPool();
      const schema = await pool.request().query(`
        SELECT CASE WHEN OBJECT_ID(N'dbo.customer_routes', N'U') IS NOT NULL
          AND OBJECT_ID(N'dbo.customer_route_assignments', N'U') IS NOT NULL
          AND OBJECT_ID(N'dbo.terminal_device_customer_routes', N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready;
      `);
      if (!schema.recordset[0]?.ready) throw error('TERMINAL_ROUTE_SCHEMA_REQUIRED', 'Terminal rotaları kurulumu gerekli. 0018 geçişi henüz uygulanmamış; SQL çalıştırmak için ayrı onay gerekir.', 503);
      const transaction = new sql.Transaction(pool);
      await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      const request = () => new sql.Request(transaction);
      const lock = write ? 'WITH (UPDLOCK, HOLDLOCK)' : 'WITH (HOLDLOCK)';
      const adapter = {
        async readState() {
          // Identical lock order for every admin mutation, including an empty route table.
          const result = await request().query(`
            SELECT id, route_code, name, is_active, created_at, updated_at FROM dbo.customer_routes ${lock} ORDER BY id;
            SELECT customer_id, route_id FROM dbo.customer_route_assignments ${lock} ORDER BY customer_id;
            SELECT terminal_device_id, route_id FROM dbo.terminal_device_customer_routes ${lock} ORDER BY terminal_device_id, route_id;
            SELECT c.id, c.customer_code, c.name, c.currency_code, c.is_active, c.is_deleted
            FROM dbo.customers c ${lock}
            WHERE c.is_deleted = 0 OR EXISTS (SELECT 1 FROM dbo.customer_route_assignments a WHERE a.customer_id = c.id) ORDER BY c.id;
            SELECT id, device_code, device_name, is_active FROM dbo.terminal_devices ${lock} ORDER BY id;
          `);
          const [routes, customers, devices, references, terminals] = result.recordsets;
          const groupedDevices = new Map();
          for (const row of devices) {
            const deviceId = Number(row.terminal_device_id);
            if (!groupedDevices.has(deviceId)) groupedDevices.set(deviceId, []);
            groupedDevices.get(deviceId).push(Number(row.route_id));
          }
          return {
            routes: routes.map(routeDto),
            customerAssignments: customers.map((row) => ({ customerId: Number(row.customer_id), routeId: Number(row.route_id) })),
            deviceAssignments: [...groupedDevices].map(([deviceId, routeIds]) => ({ deviceId, routeIds })),
            customers: references.map((row) => ({ id: Number(row.id), code: row.customer_code, name: row.name, currency: row.currency_code, isActive: Boolean(row.is_active), isDeleted: Boolean(row.is_deleted) })),
            devices: terminals.map((row) => ({ id: Number(row.id), deviceCode: row.device_code, deviceName: row.device_name, isActive: Boolean(row.is_active) })),
          };
        },
        async createRoute(fields) {
          const result = await request().input('code', sql.NVarChar(80), fields.routeCode).input('name', sql.NVarChar(200), fields.name).input('active', sql.Bit, fields.isActive).query(`
            INSERT INTO dbo.customer_routes (route_code, name, is_active)
            OUTPUT inserted.id, inserted.route_code, inserted.name, inserted.is_active, inserted.created_at, inserted.updated_at
            VALUES (@code, @name, @active);
          `);
          return routeDto(result.recordset[0]);
        },
        async updateRoute(routeId, fields) {
          const result = await request().input('id', sql.BigInt, routeId).input('code', sql.NVarChar(80), fields.routeCode).input('name', sql.NVarChar(200), fields.name).input('active', sql.Bit, fields.isActive).query(`
            UPDATE dbo.customer_routes SET route_code = @code, name = @name, is_active = @active, updated_at = SYSUTCDATETIME()
            OUTPUT inserted.id, inserted.route_code, inserted.name, inserted.is_active, inserted.created_at, inserted.updated_at
            WHERE id = @id;
          `);
          return routeDto(result.recordset[0]);
        },
        async applyAssignments(patch) {
          for (const item of patch.customerAssignments) {
            const current = request().input('customerId', sql.BigInt, item.customerId);
            if (item.routeId === null) await current.query('DELETE FROM dbo.customer_route_assignments WHERE customer_id = @customerId;');
            else await current.input('routeId', sql.BigInt, item.routeId).query(`
              UPDATE dbo.customer_route_assignments SET route_id = @routeId WHERE customer_id = @customerId;
              IF @@ROWCOUNT = 0 INSERT INTO dbo.customer_route_assignments (customer_id, route_id) VALUES (@customerId, @routeId);
            `);
          }
          for (const item of patch.deviceAssignments) {
            await request().input('deviceId', sql.BigInt, item.deviceId).query('DELETE FROM dbo.terminal_device_customer_routes WHERE terminal_device_id = @deviceId;');
            for (const routeId of item.routeIds) await request().input('deviceId', sql.BigInt, item.deviceId).input('routeId', sql.BigInt, routeId).query('INSERT INTO dbo.terminal_device_customer_routes (terminal_device_id, route_id) VALUES (@deviceId, @routeId);');
          }
        },
        audit: (entry) => writeAuditLog(request(), entry),
      };
      try {
        // Native takes Shared on this same resource before locking the sale customer.
        // Acquire before all graph/customer reads, so differing table orders cannot cycle.
        const lockResult = await request().query(`
          DECLARE @routeLockResult INT;
          EXEC @routeLockResult = sys.sp_getapplock
            @Resource = N'melisa-terminal-customer-routes-v1',
            @LockMode = N'${write ? 'Exclusive' : 'Shared'}',
            @LockOwner = N'Transaction', @LockTimeout = 5000;
          SELECT @routeLockResult AS lock_result;
        `);
        const lockStatus = lockResult.recordset[0]?.lock_result;
        if (!Number.isInteger(lockStatus) || lockStatus < 0) throw error('TERMINAL_ROUTE_LOCK_UNAVAILABLE', 'Rota kapsamı başka bir işlemde kullanılıyor. Kaydedilmedi; yeniden deneyin.', 503);
        const result = await callback(adapter);
        await transaction.commit();
        return result;
      } catch (cause) {
        try { await transaction.rollback(); } catch { /* Preserve the original failure; never retry a mutation. */ }
        if ([2601, 2627].includes(Number(cause.number))) throw error('TERMINAL_ROUTE_CODE_EXISTS', 'Rota kodu veya atama zaten mevcut. Listeyi yenileyin.', 409);
        throw cause;
      }
    },
  };
}

let defaultService;
async function service() {
  if (!defaultService) defaultService = (async () => {
    const { assertMelisaWriteEnabled } = await import('./writeGuardService.js');
    return createTerminalCustomerRoutesService({ repository: await createTerminalCustomerRoutesSqlRepository(), assertWriteEnabled: assertMelisaWriteEnabled });
  })().catch((cause) => { defaultService = undefined; throw cause; });
  return defaultService;
}

export const getTerminalCustomerRoutes = async () => (await service()).overview();
export const createTerminalCustomerRoute = async (payload, actor) => (await service()).create(payload, actor);
export const updateTerminalCustomerRoute = async (routeId, payload, actor) => (await service()).update(routeId, payload, actor);
export const updateTerminalCustomerRouteAssignments = async (payload, actor) => (await service()).assign(payload, actor);
