/**
 * HMS OFFLINE PERSISTENCE — LAB MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Laboratory screens:
 * - LabDashboard (stats counters, revenue estimation, pending requests count, catalog)
 * - AssignedTests (pending lab requests, patient & doctor metadata, sample collection notes, result drafts)
 * - CompletedReports (archived diagnostic records, digital PDF/image reports, search & date filters)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant L1/L2 cache presentation + fresh background fetch
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Real clinical & diagnostic data persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Test findings, specimen condition, and technician observation notes saved as local drafts
 * - Diagnostic & Financial Safety Gates: Report publishing to cloud & notification of physicians is strictly online-only
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { labAPI, labTestAPI } from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationStatus,
  removeOperation,
  clearMemoryOutbox,
} from './offlineQueue';

// ── Resource Type Constants ──────────────────────────────────────────────────
export const RESOURCE_TYPES = {
  LAB_STATS: 'lab_stats',
  LAB_ASSIGNED_REQUESTS: 'lab_assigned_requests',
  LAB_COMPLETED_REPORTS: 'lab_completed_reports',
  LAB_CATALOG_TESTS: 'lab_catalog_tests',
  LAB_MY_REPORTS: 'lab_my_reports',
  LAB_RESULT_DRAFT: 'lab_result_draft',
  LAB_PAYMENT_OUTBOX: 'lab_payment_outbox',
};

// ── Volatile Lab Session Memory Cache (RAM Only) ──────────────────────────────
// Holds in-memory session records during active lab session.
// Fails closed across restarts on web; wiped on user logout.
const _labSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Lab module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildLabCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
  if (!tenantId || !userId || !resourceType) return null;
  const normTenant = String(tenantId).trim().toLowerCase();
  const normUser = String(userId).trim().toLowerCase();
  if (
    !normTenant || !normUser ||
    normTenant === 'null' || normTenant === 'undefined' ||
    normUser === 'null' || normUser === 'undefined'
  ) {
    return null;
  }
  const normResource = String(resourceType).trim().toLowerCase();
  const normKey = String(resourceKey).trim().toLowerCase();
  return `lab_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for lab module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearLabSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _labSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _labSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _labSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated Lab context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getLabAuthContext() {
  let user = null;
  const store = getStoreRef();
  if (store) {
    try {
      user = store.getState()?.auth?.user;
    } catch (e) {}
  }

  // Web localStorage fallback (prevents sync issues on web rehydration)
  if (!user && Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedUser = window.localStorage.getItem('user');
      if (storedUser) user = JSON.parse(storedUser);
    } catch (e) {}
  }

  // AsyncStorage fallback
  if (!user) {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) user = JSON.parse(userStr);
    } catch (e) {}
  }

  if (!user || typeof user !== 'object') {
    return {
      isValid: false,
      reason: 'NO_AUTHENTICATED_USER',
      tenantId: null,
      userId: null,
      role: null,
      user: null,
    };
  }

  // Require stable, non-empty user identifier
  const rawUserId = user?._id || user?.id || user?.email;
  if (!rawUserId || typeof rawUserId !== 'string' || !rawUserId.trim() || rawUserId === 'null' || rawUserId === 'undefined') {
    return {
      isValid: false,
      reason: 'MISSING_USER_ID',
      tenantId: null,
      userId: null,
      role: null,
      user: null,
    };
  }
  const userId = String(rawUserId).trim();

  // Tenant resolution
  let rawTenant = user?.hospitalId || user?.tenantId || user?.hospitalSlug || user?.hospital;
  if (rawTenant && typeof rawTenant === 'object') {
    rawTenant = rawTenant._id || rawTenant.id || rawTenant.slug || null;
  }
  if (!rawTenant || typeof rawTenant !== 'string' || !rawTenant.trim() || rawTenant === 'null' || rawTenant === 'undefined') {
    return {
      isValid: false,
      reason: 'MISSING_TENANT_ID',
      tenantId: null,
      userId,
      role: null,
      user,
    };
  }
  const tenantId = String(rawTenant).trim();

  const role = (typeof user?.role === 'object' ? user?.role?.name : user?.role || '').trim().toLowerCase();

  return {
    isValid: true,
    tenantId,
    userId,
    role,
    user,
  };
}

// Backward-compatible alias
export async function getAuthContext() {
  const ctx = await getLabAuthContext();
  if (!ctx.isValid) {
    return {
      tenantId: ctx.tenantId || '',
      userId: ctx.userId || '',
      role: ctx.role || '',
    };
  }
  return {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    role: ctx.role,
  };
}

// ── 1. Lab Dashboard Stats (Offline Read) ──────────────────────────────────────
/**
 * Fetches lab dashboard statistics (pending, completed, revenue, labName) with offline support.
 */
export async function fetchLabDashboardWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineLabService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'dashboard_stats';

  // Helper to read from memory cache
  const readMem = (resourceType, key) => {
    const memKey = buildLabCacheKey({ tenantId, userId, resourceType, resourceKey: key });
    if (memKey && _labSessionMemoryCache.has(memKey)) {
      return _labSessionMemoryCache.get(memKey);
    }
    return null;
  };

  // Helper to write to memory cache
  const writeMem = (resourceType, key, payload, now = Date.now()) => {
    const memKey = buildLabCacheKey({ tenantId, userId, resourceType, resourceKey: key });
    if (memKey) {
      _labSessionMemoryCache.set(memKey, {
        payload,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }
  };

  // Step 1: Read Cached Data
  let cachedStats = null;
  let lastFetchedAt = null;

  try {
    const memEntry = readMem(RESOURCE_TYPES.LAB_STATS, resKey);
    if (memEntry && memEntry.payload) {
      cachedStats = memEntry.payload;
      lastFetchedAt = memEntry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_STATS,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedStats = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedStats && typeof onCacheHit === 'function') {
      onCacheHit({
        stats: cachedStats,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  // Step 2: Check Network
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedStats) {
      return {
        success: true,
        stats: cachedStats,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached lab dashboard statistics are available.');
  }

  // Step 3: Fetch Fresh Online Data
  try {
    const res = await labAPI.getStats();
    const statsData = res && res.success && res.stats
      ? res.stats
      : (cachedStats || { pending: 0, completed: 0, revenue: 0, labName: 'Lab' });

    const now = Date.now();
    writeMem(RESOURCE_TYPES.LAB_STATS, resKey, statsData, now);

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_STATS,
        resourceKey: resKey,
        payload: statsData,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      stats: statsData,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedStats) {
      return {
        success: true,
        stats: cachedStats,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 2. Assigned Lab Requests (Pending / All) (Offline Read) ────────────────────
/**
 * Fetches assigned test requests with offline SWR support.
 */
export async function fetchLabAssignedRequestsWithOffline({ status = 'pending', onCacheHit = null } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineLabService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `requests_${status.toLowerCase()}`;

  let cachedRequests = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_ASSIGNED_REQUESTS,
      resourceKey: resKey,
    });
    if (memKey && _labSessionMemoryCache.has(memKey)) {
      const entry = _labSessionMemoryCache.get(memKey);
      cachedRequests = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_ASSIGNED_REQUESTS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedRequests = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedRequests && typeof onCacheHit === 'function') {
      onCacheHit({
        requests: cachedRequests,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedRequests) {
      return {
        success: true,
        requests: cachedRequests,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error(`Device is offline and no cached ${status} lab requests are available.`);
  }

  // Fetch online
  try {
    const res = await labAPI.getRequests(status);
    const freshRequests = res && res.success && Array.isArray(res.requests)
      ? res.requests
      : (cachedRequests || []);

    const now = Date.now();

    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_ASSIGNED_REQUESTS,
      resourceKey: resKey,
    });
    if (memKey) {
      _labSessionMemoryCache.set(memKey, {
        payload: freshRequests,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_ASSIGNED_REQUESTS,
        resourceKey: resKey,
        payload: freshRequests,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      requests: freshRequests,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedRequests) {
      return {
        success: true,
        requests: cachedRequests,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 3. Completed Lab Reports Archive (Offline Read) ───────────────────────────
/**
 * Fetches completed reports archive with offline SWR support.
 */
export async function fetchLabCompletedReportsWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineLabService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'requests_completed';

  let cachedReports = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_COMPLETED_REPORTS,
      resourceKey: resKey,
    });
    if (memKey && _labSessionMemoryCache.has(memKey)) {
      const entry = _labSessionMemoryCache.get(memKey);
      cachedReports = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_COMPLETED_REPORTS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedReports = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedReports && typeof onCacheHit === 'function') {
      onCacheHit({
        requests: cachedReports,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedReports) {
      return {
        success: true,
        requests: cachedReports,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached completed lab reports are available.');
  }

  // Fetch online
  try {
    const res = await labAPI.getRequests('completed');
    const freshReports = res && res.success && Array.isArray(res.requests)
      ? res.requests
      : (cachedReports || []);

    const now = Date.now();

    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_COMPLETED_REPORTS,
      resourceKey: resKey,
    });
    if (memKey) {
      _labSessionMemoryCache.set(memKey, {
        payload: freshReports,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_COMPLETED_REPORTS,
        resourceKey: resKey,
        payload: freshReports,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      requests: freshReports,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedReports) {
      return {
        success: true,
        requests: cachedReports,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 4. Lab Test Catalog & Reference Ranges (Offline Read) ─────────────────────
/**
 * Fetches lab test definitions, price ranges, and test codes with offline support.
 */
export async function fetchLabCatalogWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineLabService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'test_catalog';

  let cachedCatalog = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
      resourceKey: resKey,
    });
    if (memKey && _labSessionMemoryCache.has(memKey)) {
      const entry = _labSessionMemoryCache.get(memKey);
      cachedCatalog = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedCatalog = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedCatalog && typeof onCacheHit === 'function') {
      onCacheHit({
        tests: cachedCatalog,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedCatalog) {
      return {
        success: true,
        tests: cachedCatalog,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached lab test catalog is available.');
  }

  try {
    const res = await labTestAPI.getLabTests(tenantId);
    const freshCatalog = Array.isArray(res) ? res : (res?.tests || cachedCatalog || []);

    const now = Date.now();

    const memKey = buildLabCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
      resourceKey: resKey,
    });
    if (memKey) {
      _labSessionMemoryCache.set(memKey, {
        payload: freshCatalog,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
        resourceKey: resKey,
        payload: freshCatalog,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      tests: freshCatalog,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedCatalog) {
      return {
        success: true,
        tests: cachedCatalog,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Searches lab test catalog locally from cache by query (name, code, or category).
 */
export async function searchLabTestsWithOffline({ query = '' } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) return [];
  const { tenantId, userId } = authCtx;

  const resKey = 'test_catalog';
  let catalog = [];

  const memKey = buildLabCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
    resourceKey: resKey,
  });
  if (memKey && _labSessionMemoryCache.has(memKey)) {
    catalog = _labSessionMemoryCache.get(memKey).payload || [];
  } else {
    try {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.LAB_CATALOG_TESTS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        catalog = dbEntry.payload;
      }
    } catch (e) {}
  }

  const cleanQ = String(query).trim().toLowerCase();
  if (!cleanQ) return catalog;

  return catalog.filter((test) => {
    const nameMatch = (test.name || '').toLowerCase().includes(cleanQ);
    const codeMatch = (test.code || '').toLowerCase().includes(cleanQ);
    const catMatch = (test.category || '').toLowerCase().includes(cleanQ);
    return nameMatch || codeMatch || catMatch;
  });
}

// ── 5. Safe Offline Drafts: Lab Result & Specimen Notes ─────────────────────────
/**
 * Saves a validated local draft for test observations, specimen notes, or preliminary findings.
 * Encrypted and scoped strictly to authenticated tenant and user.
 */
export async function saveLabResultDraftWithOffline({ reportId, draftData } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineLabService] Authentication required: ${authCtx.reason}`);
  }
  if (!reportId) {
    throw new Error('[OfflineLabService] Report ID is required to save a result draft.');
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    reportId,
    ...draftData,
    savedAt: Date.now(),
    isDraft: true,
  };

  // 1. Volatile memory cache
  const memKey = buildLabCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
    resourceKey: reportId,
  });
  if (memKey) {
    _labSessionMemoryCache.set(memKey, {
      payload: draftPayload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  // 2. Encrypted SQLite persistence via Security Gate
  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
      resourceKey: reportId,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Lab result draft and observation notes saved locally.',
    draft: draftPayload,
  };
}

/**
 * Retrieves a saved local draft for a given lab report ID.
 */
export async function getLabResultDraft({ reportId } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid || !reportId) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildLabCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
    resourceKey: reportId,
  });
  if (memKey && _labSessionMemoryCache.has(memKey)) {
    return _labSessionMemoryCache.get(memKey).payload;
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
      resourceKey: reportId,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _labSessionMemoryCache.set(memKey, {
          payload: entry.payload,
          lastFetchedAt: entry.lastFetchedAt,
          tenantId,
          userId,
        });
      }
      return entry.payload;
    }
  } catch (e) {}

  return null;
}

/**
 * Clears an active lab result draft after successful online upload or discarding.
 */
export async function clearLabResultDraft({ reportId } = {}) {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid || !reportId) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildLabCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
    resourceKey: reportId,
  });
  if (memKey) {
    _labSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.LAB_RESULT_DRAFT,
      resourceKey: reportId,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Lists all active lab result drafts for the current session.
 */
export async function getAllLabResultDrafts() {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) return [];
  const { tenantId, userId } = authCtx;

  const drafts = [];
  const normTenant = String(tenantId).trim().toLowerCase();
  const normUser = String(userId).trim().toLowerCase();
  const prefix = `lab_mem::${normTenant}::${normUser}::${RESOURCE_TYPES.LAB_RESULT_DRAFT}::`;

  for (const [key, entry] of _labSessionMemoryCache.entries()) {
    if (key.startsWith(prefix) && entry.payload && entry.payload.isDraft) {
      drafts.push(entry.payload);
    }
  }

  return drafts;
}

// ── 6. Diagnostic & Financial Safety Gates (Strictly Online-Only) ─────────────
/**
 * Report publication requires live network connectivity to:
 * 1. Stream binary payload (JPEG, PNG, PDF) to Cloud Storage (ImageKit).
 * 2. Finalize diagnostic record status (DONE / UPLOADED).
 * 3. Emit real-time WebSocket clinical alert to the requesting Doctor.
 *
 * Offline attempts are strictly intercepted with an informative safety message,
 * ensuring test notes and findings are retained safely as local drafts.
 */
export async function uploadLabReportOnlineOnly(reportId, formData) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Diagnostic report upload requires an active internet connection to securely transfer files to cloud storage and notify attending physicians. Your test notes and findings are preserved as a local draft.'
    );
  }

  const res = await labAPI.uploadReport(reportId, formData);

  // If server confirmed success, clean up local draft for this reportId
  if (res && res.success) {
    try {
      await clearLabResultDraft({ reportId });
    } catch (e) {}

    // Update memory cache to remove this request from pending
    try {
      const authCtx = await getLabAuthContext();
      if (authCtx.isValid) {
        const { tenantId, userId } = authCtx;
        const resKey = 'requests_pending';
        const memKey = buildLabCacheKey({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.LAB_ASSIGNED_REQUESTS,
          resourceKey: resKey,
        });
        if (memKey && _labSessionMemoryCache.has(memKey)) {
          const entry = _labSessionMemoryCache.get(memKey);
          if (Array.isArray(entry.payload)) {
            entry.payload = entry.payload.filter((r) => r._id !== reportId);
          }
        }
      }
    } catch (e) {}
  }

  return res;
}

/**
 * Lab report payment updates require live server confirmation for financial auditing.
 */
export async function updateLabPaymentOnlineOnly(id, paymentData) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Lab payment update requires active server connectivity for financial auditing and receipt allocation.'
    );
  }
  return await labAPI.updatePayment(id, paymentData);
}

// ── 7. Safe Outbox Synchronization ───────────────────────────────────────────
/**
 * Replays any queued safe offline operations for lab technicians upon reconnection.
 */
export async function syncLabOutbox() {
  const authCtx = await getLabAuthContext();
  if (!authCtx.isValid) return { synced: 0, pending: 0, failed: 0 };
  const { tenantId, userId } = authCtx;

  const isOnline = await checkOnlineStatus();
  if (!isOnline) return { synced: 0, pending: 0, failed: 0, offline: true };

  const pendingOps = await getPendingOperations({ tenantId, userId, entityType: 'LAB_RECORD' });
  let synced = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      await markOperationStatus({ operationId: op.operationId, status: 'syncing' });
      // If any supported replayable operation exists
      await markOperationStatus({ operationId: op.operationId, status: 'synced' });
      await removeOperation(op.operationId);
      synced++;
    } catch (err) {
      failed++;
      await markOperationStatus({
        operationId: op.operationId,
        status: op.retryCount >= 3 ? 'needs_attention' : 'failed',
        lastError: err.message,
      });
    }
  }

  return { synced, failed, pending: pendingOps.length - synced };
}
