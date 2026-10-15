/**
 * HMS OFFLINE PERSISTENCE — IPD (INPATIENT DEPARTMENT) MODULE SERVICE
 *
 * Comprehensive offline-aware data service for IPD screens:
 * - IPDCommandCenter (census overview, flow board, ward breakdown, bed status, discharge blockers)
 * - DoctorIPDOrdersPanel (active inpatient admission, clinical orders, clarifications, discharge summary)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant L1/L2 cache presentation + fresh background server fetch
 * - Clear Inpatient Freshness Indicator: Cached census, beds, and admission records explicitly indicate
 *   last-verified timestamp; never represented as guaranteed live current bed availability while offline.
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Clinical inpatient records persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Clinical orders & discharge summary notes saved as local drafts
 * - Strict Online-Only Safety Gates: Bed allocation, admission creation, bed transfer, discharge
 *   finalization, bed reconciliation, and order cancellation are strictly blocked offline to prevent
 *   double bed reservation and clinical desync.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ipdCommandCenterAPI, ipdClinicalAPI, admissionAPI } from '../../utils/api';
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
  IPD_OVERVIEW: 'ipd_overview',
  IPD_FLOW_BOARD: 'ipd_flow_board',
  IPD_ACTIVE_ADMISSIONS: 'ipd_active_admissions',
  IPD_ADMISSION_DETAILS: 'ipd_admission_details',
  IPD_ORDERS: 'ipd_orders',
  IPD_DISCHARGE_SUMMARY: 'ipd_discharge_summary',
  IPD_DISCHARGE_BLOCKERS: 'ipd_discharge_blockers',
  IPD_ANALYTICS: 'ipd_analytics',
  IPD_CLINICAL_ORDER_DRAFT: 'ipd_clinical_order_draft',
  IPD_DISCHARGE_SUMMARY_DRAFT: 'ipd_discharge_summary_draft',
};

// ── Volatile IPD Session Memory Cache (RAM Only) ──────────────────────────────
// Holds in-memory session records during active IPD session.
// Fails closed across restarts on web; wiped on user logout.
const _ipdSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for IPD module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildIPDCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `ipd_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for IPD module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearIPDSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _ipdSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _ipdSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _ipdSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated IPD context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getIPDAuthContext() {
  let user = null;
  const store = getStoreRef();
  if (store) {
    try {
      user = store.getState()?.auth?.user;
    } catch (e) {}
  }

  // Web localStorage fallback
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

// ── 1. IPD Command Center Overview & Census (Offline Read) ────────────────────
/**
 * Fetches IPD command center overview (census, clinical workload, ward breakdown) with SWR support.
 */
export async function fetchIPDOverviewWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'overview';

  let cachedOverview = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_OVERVIEW,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedOverview = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_OVERVIEW,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedOverview = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedOverview && typeof onCacheHit === 'function') {
      onCacheHit({
        overview: cachedOverview,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
        isCensusEstimate: true,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedOverview) {
      return {
        success: true,
        overview: cachedOverview,
        census: cachedOverview.census,
        clinicalWorkload: cachedOverview.clinicalWorkload,
        wardBreakdown: cachedOverview.wardBreakdown,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
        isCensusEstimate: true,
      };
    }
    throw new Error('Device is offline and no cached IPD overview is available.');
  }

  try {
    const res = await ipdCommandCenterAPI.getOverview();
    const freshOverview = res && (res.success || res.census)
      ? res
      : (cachedOverview || {});

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_OVERVIEW,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshOverview,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_OVERVIEW,
        resourceKey: resKey,
        payload: freshOverview,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      overview: freshOverview,
      census: freshOverview.census,
      clinicalWorkload: freshOverview.clinicalWorkload,
      wardBreakdown: freshOverview.wardBreakdown,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
      isCensusEstimate: false,
    };
  } catch (err) {
    if (cachedOverview) {
      return {
        success: true,
        overview: cachedOverview,
        census: cachedOverview.census,
        clinicalWorkload: cachedOverview.clinicalWorkload,
        wardBreakdown: cachedOverview.wardBreakdown,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
        isCensusEstimate: true,
      };
    }
    throw err;
  }
}

// ── 2. IPD Flow Board & Active Inpatients (Offline Read) ──────────────────────
/**
 * Fetches IPD Flow Board (Kanban cards, inpatient stages, ward census) with SWR support.
 */
export async function fetchIPDFlowBoardWithOffline({
  ward = 'ALL',
  search = '',
  stageFilter = 'ALL',
  onCacheHit = null,
} = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `board_${ward}_${stageFilter}_${String(search).trim()}`;
  const masterKey = 'board_master_cards';

  let cachedBoard = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
      resourceKey: resKey,
    });
    const masterMemKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
      resourceKey: masterKey,
    });

    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedBoard = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else if (masterMemKey && _ipdSessionMemoryCache.has(masterMemKey)) {
      const entry = _ipdSessionMemoryCache.get(masterMemKey);
      cachedBoard = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedBoard = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      } else {
        const masterDbEntry = await getCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
          resourceKey: masterKey,
        });
        if (masterDbEntry.found && masterDbEntry.payload) {
          cachedBoard = masterDbEntry.payload;
          lastFetchedAt = masterDbEntry.lastFetchedAt;
        }
      }
    }

    if (cachedBoard && typeof onCacheHit === 'function') {
      onCacheHit({
        board: cachedBoard.board || cachedBoard,
        cards: cachedBoard.cards || [],
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedBoard) {
      // Client-side filtering over cached cards if specific filters were requested offline
      let cards = cachedBoard.cards || [];
      if (ward !== 'ALL') {
        cards = cards.filter((c) => (c.wardName || '').toLowerCase() === String(ward).toLowerCase());
      }
      if (stageFilter !== 'ALL') {
        cards = cards.filter((c) => (c.stage || '').toLowerCase() === String(stageFilter).toLowerCase());
      }
      if (search && search.trim()) {
        const cleanS = search.trim().toLowerCase();
        cards = cards.filter((c) =>
          (c.patientName || '').toLowerCase().includes(cleanS) ||
          (c.ipdId || '').toLowerCase().includes(cleanS) ||
          (c.mrn || '').toLowerCase().includes(cleanS) ||
          (c.bedNumber || '').toLowerCase().includes(cleanS) ||
          (c.diagnosis || '').toLowerCase().includes(cleanS)
        );
      }

      return {
        success: true,
        board: cachedBoard.board || {},
        cards,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached IPD flow board records are available.');
  }

  try {
    const res = await ipdCommandCenterAPI.getFlowBoard({
      ward,
      search,
      stageFilter,
    });
    const freshBoard = res && (res.success || res.board)
      ? res
      : (cachedBoard || { board: {}, cards: [] });

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshBoard,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    // If master query, also store as masterKey for offline filter fallback
    if (ward === 'ALL' && (!search || !search.trim()) && stageFilter === 'ALL') {
      const masterMemKey = buildIPDCacheKey({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
        resourceKey: masterKey,
      });
      if (masterMemKey) {
        _ipdSessionMemoryCache.set(masterMemKey, {
          payload: freshBoard,
          lastFetchedAt: now,
          tenantId,
          userId,
        });
      }
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_FLOW_BOARD,
        resourceKey: resKey,
        payload: freshBoard,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      board: freshBoard.board || {},
      cards: freshBoard.cards || [],
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedBoard) {
      return {
        success: true,
        board: cachedBoard.board || {},
        cards: cachedBoard.cards || [],
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 3. Active Inpatient Admissions & Details (Offline Read) ───────────────────
/**
 * Fetches active inpatient admissions list with SWR support.
 */
export async function fetchActiveAdmissionsWithOffline({ params = {}, onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'active_list';

  let cachedAdmissions = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ACTIVE_ADMISSIONS,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedAdmissions = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ACTIVE_ADMISSIONS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedAdmissions = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedAdmissions && typeof onCacheHit === 'function') {
      onCacheHit({
        admissions: cachedAdmissions,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedAdmissions) {
      return {
        success: true,
        admissions: cachedAdmissions,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached active admissions are available.');
  }

  try {
    const res = await admissionAPI.getActiveAdmissions(params);
    const freshAdmissions = res && (res.success || Array.isArray(res) || res.admissions)
      ? (res.admissions || (Array.isArray(res) ? res : res.data || []))
      : (cachedAdmissions || []);

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ACTIVE_ADMISSIONS,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshAdmissions,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ACTIVE_ADMISSIONS,
        resourceKey: resKey,
        payload: freshAdmissions,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      admissions: freshAdmissions,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedAdmissions) {
      return {
        success: true,
        admissions: cachedAdmissions,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Fetches specific admission details by ID with offline SWR support.
 */
export async function fetchAdmissionDetailsWithOffline(admissionId, { onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `admission_${admissionId}`;

  let cachedAdmission = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ADMISSION_DETAILS,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedAdmission = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ADMISSION_DETAILS,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedAdmission = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedAdmission && typeof onCacheHit === 'function') {
      onCacheHit({
        admission: cachedAdmission,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedAdmission) {
      return {
        success: true,
        admission: cachedAdmission,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    // Fallback: search in active admissions cache
    try {
      const activeEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ACTIVE_ADMISSIONS,
        resourceKey: 'active_list',
      });
      if (activeEntry.found && Array.isArray(activeEntry.payload)) {
        const found = activeEntry.payload.find((a) => a._id === admissionId || a.id === admissionId);
        if (found) {
          return {
            success: true,
            admission: found,
            fromCache: true,
            isOffline: true,
            lastFetchedAt: activeEntry.lastFetchedAt,
          };
        }
      }
    } catch (e) {}

    throw new Error('Device is offline and admission details are not cached.');
  }

  try {
    const res = await admissionAPI.getAdmissionById(admissionId);
    const freshAdmission = res && (res.success || res.admission || res.data)
      ? (res.admission || res.data || res)
      : cachedAdmission;

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ADMISSION_DETAILS,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshAdmission,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ADMISSION_DETAILS,
        resourceKey: resKey,
        payload: freshAdmission,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      admission: freshAdmission,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedAdmission) {
      return {
        success: true,
        admission: cachedAdmission,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 4. Inpatient Clinical Orders (Offline Read) ───────────────────────────────
/**
 * Fetches inpatient clinical orders for an admitted patient with SWR support.
 */
export async function fetchIPDOrdersWithOffline(patientId, { onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `orders_${patientId}`;

  let cachedOrders = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ORDERS,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedOrders = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ORDERS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedOrders = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedOrders && typeof onCacheHit === 'function') {
      onCacheHit({
        orders: cachedOrders,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedOrders) {
      return {
        success: true,
        orders: cachedOrders,
        data: cachedOrders,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached inpatient orders are available.');
  }

  try {
    const res = await ipdClinicalAPI.getPatientOrders(patientId);
    const freshOrders = res && (res.success || Array.isArray(res))
      ? (res.data || (Array.isArray(res) ? res : []))
      : (cachedOrders || []);

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ORDERS,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshOrders,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ORDERS,
        resourceKey: resKey,
        payload: freshOrders,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      orders: freshOrders,
      data: freshOrders,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedOrders) {
      return {
        success: true,
        orders: cachedOrders,
        data: cachedOrders,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 5. Inpatient Discharge Summary & Blockers (Offline Read) ──────────────────
/**
 * Fetches discharge summary for an admitted patient with SWR support.
 */
export async function fetchIPDDischargeSummaryWithOffline(admissionId, { onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `summary_${admissionId}`;

  let cachedSummary = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedSummary = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedSummary = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedSummary && typeof onCacheHit === 'function') {
      onCacheHit({
        dischargeSummary: cachedSummary,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedSummary) {
      return {
        success: true,
        dischargeSummary: cachedSummary,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached discharge summary is available.');
  }

  try {
    const res = await ipdClinicalAPI.getDischargeSummary(admissionId);
    const freshSummary = res && (res.success || res.dischargeSummary)
      ? (res.dischargeSummary || res.data || res)
      : (cachedSummary || null);

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshSummary,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY,
        resourceKey: resKey,
        payload: freshSummary,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      dischargeSummary: freshSummary,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedSummary) {
      return {
        success: true,
        dischargeSummary: cachedSummary,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Fetches discharge blockers for an admitted patient with SWR support.
 */
export async function fetchDischargeBlockersWithOffline(admissionId, { onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `blockers_${admissionId}`;

  let cachedBlockers = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_BLOCKERS,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedBlockers = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_DISCHARGE_BLOCKERS,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedBlockers = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedBlockers && typeof onCacheHit === 'function') {
      onCacheHit({
        blockers: cachedBlockers,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedBlockers) {
      return {
        success: true,
        ...cachedBlockers,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and discharge blockers are not cached.');
  }

  try {
    const res = await ipdCommandCenterAPI.getDischargeBlockers(admissionId);
    const freshBlockers = res && (res.success || res.blockers)
      ? res
      : (cachedBlockers || {});

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_BLOCKERS,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshBlockers,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_DISCHARGE_BLOCKERS,
        resourceKey: resKey,
        payload: freshBlockers,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      ...freshBlockers,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedBlockers) {
      return {
        success: true,
        ...cachedBlockers,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Fetches census analytics and nurse workload with SWR support.
 */
export async function fetchIPDAnalyticsWithOffline({ days = 14, onCacheHit = null } = {}) {
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = `analytics_${days}`;

  let cachedAnalytics = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ANALYTICS,
      resourceKey: resKey,
    });
    if (memKey && _ipdSessionMemoryCache.has(memKey)) {
      const entry = _ipdSessionMemoryCache.get(memKey);
      cachedAnalytics = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ANALYTICS,
        resourceKey: resKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedAnalytics = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedAnalytics && typeof onCacheHit === 'function') {
      onCacheHit({
        analytics: cachedAnalytics,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedAnalytics) {
      return {
        success: true,
        ...cachedAnalytics,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached IPD analytics are available.');
  }

  try {
    const [trendsRes, nursesRes] = await Promise.all([
      ipdCommandCenterAPI.getCensusTrends({ days }).catch(() => ({ success: false })),
      ipdCommandCenterAPI.getNurseWorkload().catch(() => ({ success: false })),
    ]);

    const freshAnalytics = {
      trends: trendsRes?.success ? trendsRes : cachedAnalytics?.trends,
      workload: nursesRes?.success ? nursesRes.workload : cachedAnalytics?.workload,
    };

    const now = Date.now();

    const memKey = buildIPDCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_ANALYTICS,
      resourceKey: resKey,
    });
    if (memKey) {
      _ipdSessionMemoryCache.set(memKey, {
        payload: freshAnalytics,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.IPD_ANALYTICS,
        resourceKey: resKey,
        payload: freshAnalytics,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      ...freshAnalytics,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedAnalytics) {
      return {
        success: true,
        ...cachedAnalytics,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 6. Safe Offline Drafts: Clinical Orders & Discharge Summaries ─────────────
/**
 * Saves a local draft for an inpatient clinical order.
 * Tagged strictly as a DRAFT. Does NOT mutate active orders or notify nursing while offline.
 */
export async function saveIPDClinicalOrderDraftWithOffline(arg1, arg2) {
  let draftKey = 'active_ipd_order';
  let draftData = {};
  if (typeof arg1 === 'string') {
    draftKey = arg1;
    draftData = arg2 || {};
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    draftKey = arg1.draftKey || arg1.patientId || 'active_ipd_order';
    draftData = arg1.draftData || arg1;
  }

  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    draftKey,
    ...draftData,
    savedAt: Date.now(),
    isDraft: true,
  };

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _ipdSessionMemoryCache.set(memKey, {
      payload: draftPayload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Inpatient clinical order saved locally as a draft.',
    draft: draftPayload,
    data: draftPayload,
  };
}

/**
 * Retrieves the saved inpatient clinical order draft.
 */
export async function getIPDClinicalOrderDraft(arg = {}) {
  const draftKey = typeof arg === 'string' ? arg : (arg?.draftKey || arg?.patientId || 'active_ipd_order');
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _ipdSessionMemoryCache.has(memKey)) {
    const p = _ipdSessionMemoryCache.get(memKey).payload;
    return { success: true, data: p, draft: p, ...p };
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _ipdSessionMemoryCache.set(memKey, {
          payload: entry.payload,
          lastFetchedAt: entry.lastFetchedAt,
          tenantId,
          userId,
        });
      }
      return { success: true, data: entry.payload, draft: entry.payload, ...entry.payload };
    }
  } catch (e) {}

  return null;
}

/**
 * Clears the clinical order draft upon online submission.
 */
export async function clearIPDClinicalOrderDraft(arg = {}) {
  const draftKey = typeof arg === 'string' ? arg : (arg?.draftKey || arg?.patientId || 'active_ipd_order');
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _ipdSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_CLINICAL_ORDER_DRAFT,
      resourceKey: draftKey,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Saves a local draft for an inpatient discharge summary.
 */
export async function saveDischargeSummaryDraftWithOffline(arg1, arg2) {
  let draftKey = 'active_discharge_summary';
  let draftData = {};
  if (typeof arg1 === 'string') {
    draftKey = arg1;
    draftData = arg2 || {};
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    draftKey = arg1.draftKey || arg1.admissionId || 'active_discharge_summary';
    draftData = arg1.draftData || arg1;
  }

  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineIPDService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    draftKey,
    ...draftData,
    savedAt: Date.now(),
    isDraft: true,
  };

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _ipdSessionMemoryCache.set(memKey, {
      payload: draftPayload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Discharge summary saved locally as a draft.',
    draft: draftPayload,
    data: draftPayload,
  };
}

/**
 * Retrieves the saved discharge summary draft.
 */
export async function getDischargeSummaryDraft(arg = {}) {
  const draftKey = typeof arg === 'string' ? arg : (arg?.draftKey || arg?.admissionId || 'active_discharge_summary');
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _ipdSessionMemoryCache.has(memKey)) {
    const p = _ipdSessionMemoryCache.get(memKey).payload;
    return { success: true, data: p, draft: p, ...p };
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _ipdSessionMemoryCache.set(memKey, {
          payload: entry.payload,
          lastFetchedAt: entry.lastFetchedAt,
          tenantId,
          userId,
        });
      }
      return { success: true, data: entry.payload, draft: entry.payload, ...entry.payload };
    }
  } catch (e) {}

  return null;
}

/**
 * Clears the discharge summary draft upon online submission.
 */
export async function clearDischargeSummaryDraft(arg = {}) {
  const draftKey = typeof arg === 'string' ? arg : (arg?.draftKey || arg?.admissionId || 'active_discharge_summary');
  const authCtx = await getIPDAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildIPDCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _ipdSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.IPD_DISCHARGE_SUMMARY_DRAFT,
      resourceKey: draftKey,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

// ── 7. Strict Online-Only Safety Gates ────────────────────────────────────────
/**
 * Admitting a patient and allocating/reserving a bed is strictly online-only.
 * Prevents double bed booking and census race conditions across devices.
 */
export async function createAdmissionOnlineOnly(payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Patient admission, bed reservation, and allocation require active server connectivity to prevent double-booking hospital beds.'
    );
  }
  return await admissionAPI.createAdmission(payload);
}

/**
 * Bed transfer and room reallocation require active server connectivity.
 */
export async function transferBedOnlineOnly(admissionId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Bed transfer and room reallocation require active server connectivity to maintain accurate bed occupancy.'
    );
  }
  return await admissionAPI.transferBed(admissionId, payload);
}

/**
 * Finalizing inpatient discharge and vacating bed is strictly online-only.
 */
export async function dischargePatientOnlineOnly(admissionId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Finalizing inpatient discharge and vacating bed require active server connectivity.'
    );
  }
  return await admissionAPI.dischargePatient(admissionId, payload);
}

/**
 * Bed census reconciliation algorithm requires live server database access.
 */
export async function reconcileBedsOnlineOnly() {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Bed census reconciliation requires active server connectivity to sync physical beds with live billing and admission registries.'
    );
  }
  return await ipdCommandCenterAPI.reconcileBeds();
}

/**
 * Finalizing a clinical discharge order and authorization requires active server connectivity.
 */
export async function finalizeDischargeOrderOnlineOnly(admissionId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Finalizing a clinical discharge order and medical authorization requires active server connectivity.'
    );
  }
  return await ipdClinicalAPI.createDischargeOrder(admissionId, payload);
}

/**
 * Cancelling an inpatient medication / clinical order requires active server connectivity.
 */
export async function cancelIPDOrderOnlineOnly(orderId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Cancelling an active clinical inpatient order requires active server connectivity to notify nursing and pharmacy units immediately.'
    );
  }
  const body = typeof payload === 'string' ? { status: 'CANCELLED', cancellationReason: payload } : payload;
  return await ipdClinicalAPI.updateOrder(orderId, body);
}
