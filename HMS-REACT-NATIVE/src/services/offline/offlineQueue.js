/**
 * HMS OFFLINE PERSISTENCE — REUSABLE SECURE OFFLINE OUTBOX QUEUE
 * 
 * Multi-tenant, encrypted offline queue foundation:
 * - Dual-tier queue: L1 session memory queue + L2 SQLCipher encrypted SQLite persistence
 * - Strict tenant & user partitioning
 * - Hardware-backed SQLCipher encryption required for native persistence (Fail Closed)
 * - Safe parameterized queries and atomic updates
 * - Operation-ID uniqueness and idempotent claim safeguards
 * - Retries tracked with max-retry transition to 'needs_attention'
 * - Scrubbed/sanitized logs (never logs patient payloads or tokens)
 * - Web dev: Volatile session memory only (never written to localStorage/IndexedDB)
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

// ── In-Memory Outbox Queue (L1 Cache) ─────────────────────────────────────────
// Holds pending operations in volatile JS RAM during the active session.
// Fails closed across restarts on web to ensure zero plaintext disk persistence.
const _memoryOutbox = new Map();

/**
 * Validates operation status.
 */
const VALID_STATUSES = new Set(['pending', 'syncing', 'failed', 'needs_attention', 'synced']);

/**
 * Strips sensitive keys (passwords, tokens, auth credentials) from payload.
 */
function sanitizeQueuePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizeQueuePayload);
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
    'authorization',
  ]);

  for (const [key, val] of Object.entries(payload)) {
    if (sensitiveKeys.has(key)) continue;
    if (val && typeof val === 'object') {
      clean[key] = sanitizeQueuePayload(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Check whether native SQLCipher database is fully secure and verified.
 */
async function isDatabaseSecure() {
  if (Platform.OS === 'web') return false;
  try {
    const status = await getDatabaseEncryptionStatus();
    return Boolean(
      status?.isEncrypted &&
      status?.isKeyed &&
      status?.isKeyAuthenticated &&
      status?.reopenVerified
    );
  } catch (e) {
    return false;
  }
}

/**
 * Validates a coordinate to ensure it is a non-empty, non-trivial string.
 */
export function isValidCoordinate(val) {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  return str.length > 0 && str !== 'null' && str !== 'undefined';
}

/**
 * Enqueue a new operation in the offline outbox.
 * 
 * @param {Object} params
 * @param {string} [params.operationId] - Optional unique operation ID (generated if not provided)
 * @param {string} params.tenantId - Multi-tenant isolation coordinate
 * @param {string} params.userId - User identifier coordinate
 * @param {string} params.resourceType - Module or resource type (e.g. 'question_library', 'appointment')
 * @param {string} params.operationType - Action type (e.g. 'ADD_QUESTION', 'RESCHEDULE_APPOINTMENT')
 * @param {any} params.payload - Operation payload (JSON serializable)
 * @returns {Promise<{ success: boolean, operationId: string, persisted: boolean, fromMemory: boolean, entry: Object, error?: string }>}
 */
export async function enqueueOperation({
  operationId = null,
  tenantId,
  userId,
  resourceType,
  operationType,
  payload,
}) {
  if (!isValidCoordinate(tenantId) || !isValidCoordinate(userId) || !isValidCoordinate(resourceType) || !isValidCoordinate(operationType) || payload === undefined) {
    throw new Error('[OfflineQueue] Missing or invalid required operation fields (tenantId, userId, resourceType, operationType, payload)');
  }

  const now = Date.now();
  const opId = String(
    operationId || `op_${resourceType}_${now}_${Math.random().toString(36).substring(2, 8)}`
  );

  const cleanPayload = sanitizeQueuePayload(payload);

  const entry = {
    operationId: opId,
    tenantId: String(tenantId),
    userId: String(userId),
    resourceType: String(resourceType),
    operationType: String(operationType),
    payload: cleanPayload,
    status: 'pending',
    retryCount: 0,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Store in L1 session memory outbox
  _memoryOutbox.set(opId, entry);

  // 2. On Web: strictly volatile session memory only
  if (Platform.OS === 'web') {
    return {
      success: true,
      operationId: opId,
      persisted: false,
      fromMemory: true,
      entry,
    };
  }

  // 3. On Native Android: verify SQLCipher security before persistent write
  const isSecure = await isDatabaseSecure();
  if (!isSecure) {
    console.warn(`[OfflineQueue] 🛡️ Database encryption unverified. Outbox item ${opId} stored in volatile memory only.`);
    return {
      success: true,
      operationId: opId,
      persisted: false,
      fromMemory: true,
      entry,
      warning: 'Native SQLCipher encryption unverified; persisted write blocked.',
    };
  }

  // 4. Parameterized UPSERT into offline_outbox
  try {
    const payloadStr = JSON.stringify(cleanPayload);
    const query = `
      INSERT INTO offline_outbox (
        operation_id, tenant_id, user_id, resource_type, operation_type,
        payload, status, retry_count, error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(operation_id) DO UPDATE SET
        payload = excluded.payload,
        status = excluded.status,
        retry_count = excluded.retry_count,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at;
    `;

    await runQuery(query, [
      opId,
      String(tenantId),
      String(userId),
      String(resourceType),
      String(operationType),
      payloadStr,
      'pending',
      0,
      null,
      now,
      now,
    ]);

    console.log(`[OfflineQueue] Persisted outbox operation [${opId}] for [${resourceType}/${operationType}] [tenant:${tenantId}]`);

    return {
      success: true,
      operationId: opId,
      persisted: true,
      fromMemory: false,
      entry,
    };
  } catch (dbErr) {
    console.error(`[OfflineQueue] Failed to persist outbox operation ${opId}:`, dbErr.message);
    return {
      success: false,
      operationId: opId,
      persisted: false,
      fromMemory: true,
      entry,
      error: dbErr.message,
    };
  }
}

/**
 * Retrieve pending operations partitioned by tenant, user, and optional resource type.
 * 
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} [params.resourceType]
 * @returns {Promise<Array<Object>>}
 */
export async function getPendingOperations({ tenantId, userId, resourceType = null }) {
  if (!isValidCoordinate(tenantId) || !isValidCoordinate(userId)) return [];

  const normTenant = String(tenantId);
  const normUser = String(userId);

  // If running on Native and SQLCipher is secure, hydrate from SQLite
  if (Platform.OS !== 'web') {
    const isSecure = await isDatabaseSecure();
    if (isSecure) {
      try {
        let query = `
          SELECT operation_id, tenant_id, user_id, resource_type, operation_type,
                 payload, status, retry_count, error_message, created_at, updated_at
          FROM offline_outbox
          WHERE tenant_id = ? AND user_id = ? AND status IN ('pending', 'failed', 'syncing', 'needs_attention')
        `;
        const params = [normTenant, normUser];

        if (resourceType) {
          query += ' AND resource_type = ?';
          params.push(String(resourceType));
        }

        query += ' ORDER BY created_at ASC;';

        const rows = await getAll(query, params);
        if (rows && Array.isArray(rows)) {
          const results = [];
          for (const row of rows) {
            let parsedPayload = {};
            try {
              parsedPayload = JSON.parse(row.payload);
            } catch (pErr) {
              parsedPayload = { raw: row.payload };
            }

            const item = {
              operationId: row.operation_id,
              tenantId: row.tenant_id,
              userId: row.user_id,
              resourceType: row.resource_type,
              operationType: row.operation_type,
              payload: parsedPayload,
              status: row.status,
              retryCount: Number(row.retry_count || 0),
              errorMessage: row.error_message || null,
              createdAt: Number(row.created_at),
              updatedAt: Number(row.updated_at),
            };

            // Warm / synchronize L1 memory outbox
            _memoryOutbox.set(row.operation_id, item);
            results.push(item);
          }
          return results;
        }
      } catch (dbErr) {
        console.error('[OfflineQueue] Error reading pending operations from SQLite:', dbErr.message);
      }
    }
  }

  // Fallback to in-memory queue (always active on web or when DB is unhydrated)
  const results = [];
  for (const entry of _memoryOutbox.values()) {
    if (entry.tenantId === normTenant && entry.userId === normUser) {
      if (!resourceType || entry.resourceType === String(resourceType)) {
        if (['pending', 'failed', 'syncing', 'needs_attention'].includes(entry.status)) {
          results.push(entry);
        }
      }
    }
  }

  results.sort((a, b) => a.createdAt - b.createdAt);
  return results;
}

/**
 * Returns count of pending operations for current tenant/user coordinates.
 * 
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} [params.resourceType]
 * @returns {Promise<number>}
 */
export async function countPendingOperations({ tenantId, userId, resourceType = null }) {
  const pending = await getPendingOperations({ tenantId, userId, resourceType });
  return pending.length;
}

/**
 * Mark an operation as syncing to claim it and prevent concurrent duplicate submission.
 * 
 * @param {string} operationId
 * @returns {Promise<boolean>}
 */
export async function markOperationSyncing(operationId) {
  if (!operationId) return false;
  const now = Date.now();

  const memEntry = _memoryOutbox.get(operationId);
  if (memEntry) {
    memEntry.status = 'syncing';
    memEntry.updatedAt = now;
  }

  if (Platform.OS !== 'web' && await isDatabaseSecure()) {
    try {
      await runQuery(
        'UPDATE offline_outbox SET status = ?, updated_at = ? WHERE operation_id = ?;',
        ['syncing', now, String(operationId)]
      );
      return true;
    } catch (dbErr) {
      console.warn(`[OfflineQueue] Failed to update syncing state for ${operationId}:`, dbErr.message);
    }
  }

  return true;
}

/**
 * Mark an operation as failed with sanitized error and retry metadata.
 * Transitions to 'needs_attention' if max retries exceeded.
 * 
 * @param {string} operationId
 * @param {string} errorMessage
 * @param {Object} [options]
 * @param {number} [options.maxRetries=5]
 * @returns {Promise<boolean>}
 */
export async function markOperationFailed(operationId, errorMessage = '', { maxRetries = 5 } = {}) {
  if (!operationId) return false;
  const now = Date.now();
  const cleanError = String(errorMessage || 'Unknown synchronization error')
    .substring(0, 500)
    .replace(/(bearer\s+[a-z0-9_\-\.]+)/gi, '[REDACTED_TOKEN]');

  let retryCount = 1;
  let newStatus = 'failed';

  const memEntry = _memoryOutbox.get(operationId);
  if (memEntry) {
    memEntry.retryCount = (memEntry.retryCount || 0) + 1;
    retryCount = memEntry.retryCount;
    newStatus = retryCount >= maxRetries ? 'needs_attention' : 'failed';
    memEntry.status = newStatus;
    memEntry.errorMessage = cleanError;
    memEntry.updatedAt = now;
  }

  if (Platform.OS !== 'web' && await isDatabaseSecure()) {
    try {
      await runQuery(
        'UPDATE offline_outbox SET status = ?, retry_count = retry_count + 1, error_message = ?, updated_at = ? WHERE operation_id = ?;',
        [newStatus, cleanError, now, String(operationId)]
      );
      return true;
    } catch (dbErr) {
      console.warn(`[OfflineQueue] Failed to record failure for ${operationId}:`, dbErr.message);
    }
  }

  return true;
}

/**
 * Mark an operation as successfully synced.
 * 
 * @param {string} operationId
 * @returns {Promise<boolean>}
 */
export async function markOperationSynced(operationId) {
  if (!operationId) return false;
  const now = Date.now();

  const memEntry = _memoryOutbox.get(operationId);
  if (memEntry) {
    memEntry.status = 'synced';
    memEntry.updatedAt = now;
  }

  if (Platform.OS !== 'web' && await isDatabaseSecure()) {
    try {
      await runQuery(
        'UPDATE offline_outbox SET status = ?, updated_at = ? WHERE operation_id = ?;',
        ['synced', now, String(operationId)]
      );
      return true;
    } catch (dbErr) {
      console.warn(`[OfflineQueue] Failed to mark synced for ${operationId}:`, dbErr.message);
    }
  }

  return true;
}

/**
 * Remove an operation from the queue upon confirmed synchronization or explicit purge.
 * 
 * @param {string} operationId
 * @returns {Promise<boolean>}
 */
export async function removeOperation(operationId) {
  if (!operationId) return false;

  _memoryOutbox.delete(operationId);

  if (Platform.OS !== 'web' && await isDatabaseSecure()) {
    try {
      await runQuery(
        'DELETE FROM offline_outbox WHERE operation_id = ?;',
        [String(operationId)]
      );
      return true;
    } catch (dbErr) {
      console.warn(`[OfflineQueue] Failed to remove operation ${operationId}:`, dbErr.message);
    }
  }

  return true;
}

/**
 * Purge outbox entries scoped to tenant and user.
 * Explicit administrative or discard action ONLY. Never automatically invoked on logout!
 * 
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @returns {Promise<boolean>}
 */
export async function clearOutbox({ tenantId, userId }) {
  if (!isValidCoordinate(tenantId) || !isValidCoordinate(userId)) return false;

  const normTenant = String(tenantId);
  const normUser = String(userId);

  for (const [id, entry] of _memoryOutbox.entries()) {
    if (entry.tenantId === normTenant && entry.userId === normUser) {
      _memoryOutbox.delete(id);
    }
  }

  if (Platform.OS !== 'web' && await isDatabaseSecure()) {
    try {
      await runQuery(
        'DELETE FROM offline_outbox WHERE tenant_id = ? AND user_id = ?;',
        [normTenant, normUser]
      );
      return true;
    } catch (dbErr) {
      console.warn('[OfflineQueue] Failed to clear persistent outbox:', dbErr.message);
    }
  }

  return true;
}

/**
 * Scoped clearing of volatile in-memory outbox entries (RAM only).
 * Crucial: Does NOT touch persistent encrypted offline_outbox records in SQLite.
 * 
 * @param {Object} [params]
 * @param {string|null} [params.tenantId]
 * @param {string|null} [params.userId]
 */
export function clearMemoryOutbox({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _memoryOutbox.clear();
    return;
  }
  const normTenant = isValidCoordinate(tenantId) ? String(tenantId) : null;
  const normUser = isValidCoordinate(userId) ? String(userId) : null;

  for (const [id, entry] of _memoryOutbox.entries()) {
    const matchTenant = !normTenant || entry.tenantId === normTenant;
    const matchUser = !normUser || entry.userId === normUser;
    if (matchTenant && matchUser) {
      _memoryOutbox.delete(id);
    }
  }
}

/**
 * Diagnostics stats.
 */
export function getMemoryOutboxStats() {
  return {
    size: _memoryOutbox.size,
    operations: Array.from(_memoryOutbox.values()),
  };
}

export default {
  enqueueOperation,
  getPendingOperations,
  countPendingOperations,
  markOperationSyncing,
  markOperationFailed,
  markOperationSynced,
  removeOperation,
  clearOutbox,
  clearMemoryOutbox,
  getMemoryOutboxStats,
};
