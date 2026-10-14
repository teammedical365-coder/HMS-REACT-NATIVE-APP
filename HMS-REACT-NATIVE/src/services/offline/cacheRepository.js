/**
 * HMS OFFLINE CACHE REPOSITORY
 * 
 * Reusable, multi-tenant cache repository with:
 * - Strict tenant & user partition
 * - Security Gate enforcing SQLCipher database encryption before persisting identifiable clinical data
 * - Parameterized SQLite queries
 * - Atomic batch transactions
 * - Scrubbed/sanitized logs (never logs patient payloads or auth tokens)
 */

import { Platform } from 'react-native';
import {
  getDatabase,
  getDatabaseEncryptionStatus,
  getFirst,
  getAll,
  runQuery,
  withTransaction,
} from './database';

// Default TTL: 24 hours (86,400,000 ms)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ── Tier 1: High-Speed In-Memory L1 Cache ─────────────────────────────────────
// Holds recently accessed and active session records in volatile JS RAM.
// Never persists unencrypted clinical records to disk. Fails closed across restarts.
const _memoryCache = new Map();

function buildMemoryKey(tenantId, userId, resourceType, resourceKey) {
  return `${tenantId}::${userId}::${resourceType}::${resourceKey}`;
}

export function getMemoryCacheStats() {
  return {
    size: _memoryCache.size,
    keys: Array.from(_memoryCache.keys()),
  };
}

/**
 * Validates a single cache coordinate to ensure it is a non-empty, non-trivial string.
 * Strictly disallows null, undefined, empty strings, 'null', and 'undefined'.
 */
export function isValidCoordinate(val) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str.length > 0 && str !== 'null' && str !== 'undefined';
}

/**
 * Validates all required cache coordinates.
 */
export function validateCoordinates(tenantId, userId, resourceType, resourceKey) {
  return (
    isValidCoordinate(tenantId) &&
    isValidCoordinate(userId) &&
    isValidCoordinate(resourceType) &&
    isValidCoordinate(resourceKey)
  );
}

export function clearMemoryCache(userId = null, tenantId = null) {
  if (!userId && !tenantId) {
    _memoryCache.clear();
    return;
  }
  const normUser = isValidCoordinate(userId) ? String(userId) : null;
  const normTenant = isValidCoordinate(tenantId) ? String(tenantId) : null;

  for (const [key, entry] of _memoryCache.entries()) {
    const matchUser = !normUser || entry.userId === normUser;
    const matchTenant = !normTenant || entry.tenantId === normTenant;
    if (matchUser && matchTenant) {
      _memoryCache.delete(key);
    }
  }
}

/**
 * Strips auth tokens or credentials if present in a payload object at any nesting depth.
 */
function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  const clean = {};
  const sensitiveKeys = new Set([
    'token',
    'authToken',
    'patientToken',
    'password',
    'secret',
    'preAuthToken',
    'refreshToken',
  ]);

  for (const [key, val] of Object.entries(payload)) {
    if (sensitiveKeys.has(key)) {
      continue;
    }
    if (val && typeof val === 'object') {
      clean[key] = sanitizePayload(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * SECURITY GATE CHECK
 * 
 * Enforces that identifiable clinical or patient data is ONLY persisted if the underlying
 * SQLite database is encrypted with SQLCipher (AES-256).
 * 
 * If database is unencrypted, persists ONLY synthetic test benchmarks and blocks real clinical data.
 */
async function enforceSecurityGate(isSynthetic = false) {
  if (Platform.OS === 'web') {
    return {
      allowed: false,
      isEncrypted: false,
      reason: 'WEB_ENVIRONMENT: Web platform uses session volatile memory only; persistent SQLite is disabled.',
    };
  }

  const encryption = await getDatabaseEncryptionStatus();

  // Fail closed if any aspect of SQLCipher encryption or authentication or reopen verification is missing
  const isFullySecured = Boolean(
    encryption?.isEncrypted &&
    encryption?.isKeyed &&
    encryption?.isKeyAuthenticated &&
    encryption?.reopenVerified
  );

  if (isFullySecured) {
    return { allowed: true, isEncrypted: true };
  }

  // Database is NOT fully encrypted and authenticated
  if (isSynthetic) {
    // Synthetic benchmarking records are allowed for foundation testing
    return {
      allowed: true,
      isEncrypted: false,
      notice: 'Persisting synthetic data on unencrypted storage for testing purposes only.',
    };
  }

  // FAIL CLOSED: Real clinical or patient data cannot be written to or read from unverified storage
  return {
    allowed: false,
    isEncrypted: false,
    reason: `SECURITY_GATE_VIOLATION: ${encryption?.reason || 'Database is not verified encrypted with SQLCipher.'} Real identifiable patient/clinical data cannot be persisted to or read from unencrypted storage.`,
  };
}

/**
 * Save an item to the offline cache.
 * 
 * Dual-tier write:
 * 1. Immediately populates fast L1 in-memory cache for instant UI rendering.
 * 2. Enforces Security Gate before writing to persistent L2 SQLite/SQLCipher storage.
 * 
 * @param {Object} params
 * @param {string} params.tenantId - Multi-tenant isolation scope
 * @param {string} params.userId - User or role isolation scope
 * @param {string} params.resourceType - E.g. 'doctor_appointments', 'patients', 'queue'
 * @param {string} params.resourceKey - Unique key or query hash (e.g. 'list_all', 'date_2026-10-09')
 * @param {any} params.payload - Data to store (will be JSON serialized)
 * @param {boolean} [params.isSynthetic=false] - Whether record is synthetic test data
 * @param {string} [params.etag] - Optional HTTP ETag
 * @returns {Promise<{ success: boolean, blocked?: boolean, fromMemory?: boolean, persisted?: boolean, reason?: string, error?: string }>}
 */
export async function setCacheEntry({
  tenantId,
  userId,
  resourceType,
  resourceKey,
  payload,
  isSynthetic = false,
  etag = null,
}) {
  if (!validateCoordinates(tenantId, userId, resourceType, resourceKey)) {
    console.warn('[CacheRepository] Rejected cache write with invalid coordinates:', { tenantId, userId, resourceType, resourceKey });
    return {
      success: false,
      persisted: false,
      fromMemory: false,
      error: 'INVALID_CACHE_COORDINATES: tenantId, userId, resourceType, and resourceKey must be valid non-empty strings',
      isSynthetic: Boolean(isSynthetic),
    };
  }

  const now = Date.now();
  const sanitized = sanitizePayload(payload);

  // 1. Update L1 In-Memory Cache immediately
  const memKey = buildMemoryKey(tenantId, userId, resourceType, resourceKey);
  _memoryCache.set(memKey, {
    payload: sanitized,
    lastFetchedAt: now,
    etag,
    isSynthetic: Boolean(isSynthetic),
    tenantId: String(tenantId),
    userId: String(userId),
    resourceType: String(resourceType),
    resourceKey: String(resourceKey),
  });

  // On Web, L1 RAM cache is successfully updated for navigation; web clinical data is strictly volatile memory
  if (Platform.OS === 'web') {
    return {
      success: true,
      persisted: false,
      fromMemory: true,
      isSynthetic: Boolean(isSynthetic),
    };
  }

  // 2. Enforce Security Gate before L2 disk persistence
  const gateCheck = await enforceSecurityGate(isSynthetic);
  if (!gateCheck.allowed) {
    console.warn(`[CacheRepository] 🛡️ Security Gate blocked persistent write for ${resourceType}/${resourceKey}: ${gateCheck.reason}`);
    return {
      success: true, // Successfully cached in L1 memory for current session
      persisted: false,
      blocked: true,
      fromMemory: true,
      reason: gateCheck.reason,
      isSynthetic: Boolean(isSynthetic),
    };
  }

  // 3. Parameterized UPSERT into SQLite/SQLCipher
  try {
    const payloadStr = JSON.stringify(sanitized);
    const query = `
      INSERT INTO offline_cache (
        tenant_id, user_id, resource_type, resource_key,
        payload, last_fetched_at, etag, is_synthetic, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, user_id, resource_type, resource_key)
      DO UPDATE SET
        payload = excluded.payload,
        last_fetched_at = excluded.last_fetched_at,
        etag = excluded.etag,
        is_synthetic = excluded.is_synthetic,
        updated_at = excluded.updated_at;
    `;

    await runQuery(query, [
      String(tenantId),
      String(userId),
      String(resourceType),
      String(resourceKey),
      payloadStr,
      now,
      etag,
      isSynthetic ? 1 : 0,
      now,
      now,
    ]);

    // Log safe metadata only (NEVER patient details or clinical data)
    console.log(`[CacheRepository] Saved cache entry [tenant:${tenantId}] [user:${userId}] [${resourceType}/${resourceKey}] (size: ${payloadStr.length} bytes, synthetic: ${isSynthetic}, persisted: true)`);

    return { success: true, persisted: true, fromMemory: false, isSynthetic: Boolean(isSynthetic) };
  } catch (dbErr) {
    console.error(`[CacheRepository] Failed to persist cache entry for ${resourceType}/${resourceKey}:`, dbErr.message);
    return {
      success: false,
      persisted: false,
      fromMemory: true,
      error: dbErr.message,
      isSynthetic: Boolean(isSynthetic),
    };
  }
}

/**
 * Retrieve a cached item partitioned by tenant and user.
 * 
 * Order of resolution:
 * 1. Tier 1: Check In-Memory L1 Cache first (sub-millisecond, zero disk I/O)
 * 2. Tier 2: Check SQLite/SQLCipher L2 Storage (across app restarts on native Android)
 *    Enforces Security Gate on reads — never reads potentially unencrypted clinical data from SQLite.
 * 
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.resourceType
 * @param {string} params.resourceKey
 * @param {number} [params.maxAgeMs=DEFAULT_TTL_MS]
 * @returns {Promise<{ found: boolean, payload: any, lastFetchedAt: number | null, isStale: boolean, isSynthetic: boolean, fromMemory: boolean, blockedBySecurityGate?: boolean }>}
 */
export async function getCacheEntry({
  tenantId,
  userId,
  resourceType,
  resourceKey,
  maxAgeMs = DEFAULT_TTL_MS,
}) {
  if (!validateCoordinates(tenantId, userId, resourceType, resourceKey)) {
    return { found: false, payload: null, lastFetchedAt: null, isStale: true, isSynthetic: false, fromMemory: false, error: 'INVALID_CACHE_COORDINATES' };
  }

  // ── Tier 1: In-Memory L1 Cache Check ─────────────────────────────────────────
  const memKey = buildMemoryKey(tenantId, userId, resourceType, resourceKey);
  const memEntry = _memoryCache.get(memKey);
  if (memEntry && memEntry.payload !== null && memEntry.payload !== undefined) {
    if (memEntry.tenantId === String(tenantId) && memEntry.userId === String(userId)) {
      const isStale = (Date.now() - memEntry.lastFetchedAt) > maxAgeMs;
      return {
        found: true,
        payload: memEntry.payload,
        lastFetchedAt: memEntry.lastFetchedAt,
        isStale,
        isSynthetic: Boolean(memEntry.isSynthetic),
        fromMemory: true,
      };
    }
  }

  // On Web, persistent SQLite storage is not supported; session memory only
  if (Platform.OS === 'web') {
    return { found: false, payload: null, lastFetchedAt: null, isStale: true, isSynthetic: false, fromMemory: false };
  }

  // ── Tier 2: Persistent SQLite/SQLCipher Cache Check ──────────────────────────
  // Enforce Security Gate on reads: do NOT read clinical data from unverified database
  const gateCheck = await enforceSecurityGate(false);
  if (!gateCheck.allowed) {
    return {
      found: false,
      payload: null,
      lastFetchedAt: null,
      isStale: true,
      isSynthetic: false,
      fromMemory: false,
      blockedBySecurityGate: true,
    };
  }

  try {
    const query = `
      SELECT payload, last_fetched_at, is_synthetic, updated_at
      FROM offline_cache
      WHERE tenant_id = ? AND user_id = ? AND resource_type = ? AND resource_key = ?;
    `;

    const row = await getFirst(query, [
      String(tenantId),
      String(userId),
      String(resourceType),
      String(resourceKey),
    ]);

    if (!row) {
      return { found: false, payload: null, lastFetchedAt: null, isStale: true, isSynthetic: false, fromMemory: false };
    }

    const payload = JSON.parse(row.payload);
    const lastFetchedAt = Number(row.last_fetched_at);
    const isStale = (Date.now() - lastFetchedAt) > maxAgeMs;
    const isSynthetic = Boolean(row.is_synthetic);

    // Warm L1 in-memory cache on L2 hit
    _memoryCache.set(memKey, {
      payload,
      lastFetchedAt,
      isSynthetic,
      tenantId: String(tenantId),
      userId: String(userId),
      resourceType: String(resourceType),
      resourceKey: String(resourceKey),
    });

    return {
      found: true,
      payload,
      lastFetchedAt,
      isStale,
      isSynthetic,
      fromMemory: false,
    };
  } catch (err) {
    console.error(`[CacheRepository] Failed to read/parse cached payload for ${resourceType}/${resourceKey}:`, err.message);
    return { found: false, payload: null, lastFetchedAt: null, isStale: true, isSynthetic: false, fromMemory: false };
  }
}

/**
 * Atomic batch save in a single transaction.
 */
export async function batchSetCacheEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return { success: true, count: 0 };

  if (Platform.OS === 'web') {
    let savedCount = 0;
    for (const entry of entries) {
      const res = await setCacheEntry(entry);
      if (res.success) savedCount++;
    }
    return { success: true, count: savedCount, persisted: false, fromMemory: true };
  }

  const gateCheck = await enforceSecurityGate(false);
  if (!gateCheck.allowed) {
    let savedCount = 0;
    for (const entry of entries) {
      const res = await setCacheEntry(entry);
      if (res.success) savedCount++;
    }
    return { success: true, count: savedCount, persisted: false, fromMemory: true, reason: gateCheck.reason };
  }

  let savedCount = 0;
  try {
    await withTransaction(async () => {
      for (const entry of entries) {
        const result = await setCacheEntry(entry);
        if (result.persisted) savedCount++;
      }
    });
    return { success: true, count: savedCount, persisted: true };
  } catch (txErr) {
    console.error('[CacheRepository] Batch transaction failed:', txErr.message);
    return { success: false, count: 0, persisted: false, error: txErr.message };
  }
}

/**
 * Invalidate a specific cache entry from both L1 RAM and L2 SQLite.
 */
export async function invalidateCache({ tenantId, userId, resourceType, resourceKey }) {
  if (!validateCoordinates(tenantId, userId, resourceType, resourceKey)) {
    return { success: false, changes: 0, reason: 'INVALID_CACHE_COORDINATES' };
  }

  const memKey = buildMemoryKey(tenantId, userId, resourceType, resourceKey);
  _memoryCache.delete(memKey);

  if (Platform.OS === 'web') {
    return { success: true, changes: 0, fromMemory: true };
  }

  const gate = await enforceSecurityGate(false);
  if (!gate.allowed) {
    return { success: true, changes: 0, persisted: false, reason: gate.reason };
  }

  try {
    const query = `
      DELETE FROM offline_cache
      WHERE tenant_id = ? AND user_id = ? AND resource_type = ? AND resource_key = ?;
    `;
    const res = await runQuery(query, [String(tenantId), String(userId), String(resourceType), String(resourceKey)]);
    return { success: true, changes: res?.changes || 0, persisted: true };
  } catch (err) {
    return { success: false, changes: 0, error: err.message };
  }
}

/**
 * Clear all cached data for a specific user upon logout from both L1 RAM and L2 SQLite.
 */
export async function clearUserCache(userId, tenantId = null) {
  if (!isValidCoordinate(userId)) return { success: true, changes: 0 };

  const normUser = String(userId);
  const normTenant = isValidCoordinate(tenantId) ? String(tenantId) : null;

  for (const [key, entry] of _memoryCache.entries()) {
    if (entry.userId === normUser) {
      if (!normTenant || entry.tenantId === normTenant) {
        _memoryCache.delete(key);
      }
    }
  }

  if (Platform.OS === 'web') {
    return { success: true, changes: 0, fromMemory: true };
  }

  const gate = await enforceSecurityGate(false);
  if (!gate.allowed) {
    return { success: true, changes: 0, persisted: false, reason: gate.reason };
  }

  try {
    let query = 'DELETE FROM offline_cache WHERE user_id = ?';
    const params = [normUser];

    if (normTenant) {
      query += ' AND tenant_id = ?';
      params.push(normTenant);
    }

    const res = await runQuery(query, params);
    console.log(`[CacheRepository] Cleared cache for user [${normUser}] (deleted ${res?.changes || 0} rows)`);
    return { success: true, changes: res?.changes || 0, persisted: true };
  } catch (err) {
    return { success: false, changes: 0, error: err.message };
  }
}

/**
 * Clear all cached data for a specific tenant from both L1 RAM and L2 SQLite.
 */
export async function clearTenantCache(tenantId) {
  if (!isValidCoordinate(tenantId)) return { success: true, changes: 0 };

  const normTenant = String(tenantId);

  for (const [key, entry] of _memoryCache.entries()) {
    if (entry.tenantId === normTenant) {
      _memoryCache.delete(key);
    }
  }

  if (Platform.OS === 'web') {
    return { success: true, changes: 0, fromMemory: true };
  }

  const gate = await enforceSecurityGate(false);
  if (!gate.allowed) {
    return { success: true, changes: 0, persisted: false, reason: gate.reason };
  }

  try {
    const query = 'DELETE FROM offline_cache WHERE tenant_id = ?;';
    const res = await runQuery(query, [String(tenantId)]);
    console.log(`[CacheRepository] Cleared cache for tenant [${tenantId}] (deleted ${res?.changes || 0} rows)`);
    return { success: true, changes: res?.changes || 0, persisted: true };
  } catch (err) {
    return { success: false, changes: 0, error: err.message };
  }
}

/**
 * Retrieve metadata counts (safe aggregate for diagnosis).
 */
export async function getCacheStats(tenantId = null) {
  let query = `
    SELECT 
      tenant_id, 
      resource_type, 
      COUNT(*) as count, 
      SUM(is_synthetic) as synthetic_count,
      MAX(last_fetched_at) as latest_fetch
    FROM offline_cache
  `;
  const params = [];

  if (tenantId) {
    query += ' WHERE tenant_id = ?';
    params.push(String(tenantId));
  }

  query += ' GROUP BY tenant_id, resource_type;';

  const rows = await getAll(query, params);
  return rows || [];
}

export default {
  setCacheEntry,
  getCacheEntry,
  batchSetCacheEntries,
  invalidateCache,
  clearUserCache,
  clearTenantCache,
  getCacheStats,
  getMemoryCacheStats,
  clearMemoryCache,
};
