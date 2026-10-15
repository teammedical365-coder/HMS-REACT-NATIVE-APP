/**
 * HMS OFFLINE PERSISTENCE — RECEPTION MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Reception screens:
 * - ReceptionDashboard (dashboard stats, OPD appointments queue, hospitalized admissions, reference catalogs, registration/intake drafts, vitals)
 * - ReceptionPatients (all appointments queue, patients directory, search & filters)
 * - ReceptionRefunds (cash refunds queue, refund history, handover safety)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant L1/L2 cache presentation + fresh background fetch
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Real clinical & patient data persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Full 5-step registration intake form saved as local draft with identity scope
 * - Vitals outbox queueing with automatic background sync when reconnected
 * - Financial & Server-Dependent Safety Gate: Real-time registration, booking, refunds, admissions remain strictly online-only
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  receptionAPI,
  hospitalAPI,
  publicAPI,
  bedAPI,
  admissionAPI,
  refundReceptionAPI,
  patientAPI,
  doctorAPI
} from '../../utils/api';
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
  RECEPTION_STATS: 'reception_stats',
  RECEPTION_APPOINTMENTS: 'reception_appointments',
  RECEPTION_ADMISSIONS: 'reception_admissions',
  RECEPTION_PATIENTS: 'reception_patients',
  RECEPTION_PATIENT_SEARCH: 'reception_patient_search',
  RECEPTION_PATIENT_PROFILE: 'reception_patient_profile',
  RECEPTION_CATALOG_DOCTORS: 'reception_catalog_doctors',
  RECEPTION_CATALOG_BEDS: 'reception_catalog_beds',
  RECEPTION_CATALOG_UPI: 'reception_catalog_upi',
  RECEPTION_HOSPITAL_CONTEXT: 'reception_hospital_context',
  RECEPTION_TRANSACTIONS: 'reception_transactions',
  RECEPTION_REFUNDS_PENDING: 'reception_refunds_pending',
  RECEPTION_REFUNDS_HISTORY: 'reception_refunds_history',
  RECEPTION_REGISTRATION_DRAFT: 'reception_registration_draft',
  RECEPTION_VITALS_OUTBOX: 'reception_vitals',
};

// ── Volatile Reception Session Memory Cache (RAM Only) ────────────────────────
// Holds in-memory session records during active reception session.
// Fails closed across restarts on web; wiped on user logout.
const _receptionSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Reception module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `rec_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for reception module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearReceptionSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _receptionSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _receptionSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _receptionSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated Reception context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getReceptionAuthContext() {
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
  const ctx = await getReceptionAuthContext();
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

// ── 1. Reception Dashboard & OPD Queue (Offline Read) ──────────────────────────
/**
 * Fetches dashboard data (appointments, admissions, stats, transactions) with offline support.
 */
export async function fetchReceptionDashboardWithOffline({
  listTab = 'queue',
  departmentFilter = '',
  debouncedSearch = '',
  onCacheHit = null,
} = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const queueKey = `tab_${listTab || 'queue'}_dept_${departmentFilter || 'all'}_s_${debouncedSearch || 'none'}`;

  // Helper to read from memory cache
  const readMem = (resourceType, resKey) => {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: resKey });
    if (memKey && _receptionSessionMemoryCache.has(memKey)) {
      return _receptionSessionMemoryCache.get(memKey);
    }
    return null;
  };

  // Helper to write to memory cache
  const writeMem = (resourceType, resKey, payload, now = Date.now()) => {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: resKey });
    if (memKey) {
      _receptionSessionMemoryCache.set(memKey, {
        payload,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }
  };

  // Step 1: Read Cached Data
  let cachedAppointments = null;
  let cachedAdmissions = null;
  let cachedStats = null;
  let cachedTransactions = null;
  let lastFetchedAt = null;

  try {
    const memAppts = readMem(RESOURCE_TYPES.RECEPTION_APPOINTMENTS, queueKey);
    if (memAppts && Array.isArray(memAppts.payload)) {
      cachedAppointments = memAppts.payload;
      lastFetchedAt = memAppts.lastFetchedAt;
    } else {
      const dbAppts = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS,
        resourceKey: queueKey,
      });
      if (dbAppts.found && Array.isArray(dbAppts.payload)) {
        cachedAppointments = dbAppts.payload;
        lastFetchedAt = dbAppts.lastFetchedAt;
      }
    }

    const memAdm = readMem(RESOURCE_TYPES.RECEPTION_ADMISSIONS, queueKey);
    if (memAdm && Array.isArray(memAdm.payload)) {
      cachedAdmissions = memAdm.payload;
    } else {
      const dbAdm = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_ADMISSIONS,
        resourceKey: queueKey,
      });
      if (dbAdm.found && Array.isArray(dbAdm.payload)) {
        cachedAdmissions = dbAdm.payload;
      }
    }

    const memStats = readMem(RESOURCE_TYPES.RECEPTION_STATS, 'dashboard_stats');
    if (memStats && memStats.payload) {
      cachedStats = memStats.payload;
    } else {
      const dbStats = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_STATS,
        resourceKey: 'dashboard_stats',
      });
      if (dbStats.found && dbStats.payload) {
        cachedStats = dbStats.payload;
      }
    }

    const memTx = readMem(RESOURCE_TYPES.RECEPTION_TRANSACTIONS, 'transactions_ledger');
    if (memTx && Array.isArray(memTx.payload)) {
      cachedTransactions = memTx.payload;
    } else {
      const dbTx = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_TRANSACTIONS,
        resourceKey: 'transactions_ledger',
      });
      if (dbTx.found && Array.isArray(dbTx.payload)) {
        cachedTransactions = dbTx.payload;
      }
    }

    if (cachedAppointments && typeof onCacheHit === 'function') {
      onCacheHit({
        appointments: cachedAppointments,
        admissions: cachedAdmissions || [],
        stats: cachedStats,
        transactions: cachedTransactions || [],
        lastFetchedAt,
        isSynthetic: false,
      });
    }
  } catch (cErr) {
    console.warn('[OfflineReceptionService] Cache read error:', cErr.message);
  }

  // Step 2: Check Network
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedAppointments || cachedAdmissions) {
      return {
        success: true,
        appointments: cachedAppointments || [],
        admissions: cachedAdmissions || [],
        stats: cachedStats,
        transactions: cachedTransactions || [],
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached reception records are available.');
  }

  // Step 3: Fetch Fresh Data Online
  try {
    const params = {
      all: listTab === 'all' ? 'true' : 'false',
      department: departmentFilter,
      search: debouncedSearch,
    };

    const [apptsRes, admRes, statsRes, txRes] = await Promise.allSettled([
      receptionAPI.getAllAppointments(params),
      admissionAPI.getActiveAdmissions(params),
      receptionAPI.getStats(),
      receptionAPI.getTransactions(),
    ]);

    const freshAppointments = (apptsRes.status === 'fulfilled' && apptsRes.value?.success && Array.isArray(apptsRes.value?.appointments))
      ? apptsRes.value.appointments
      : (cachedAppointments || []);

    const freshAdmissions = (admRes.status === 'fulfilled' && admRes.value?.success && Array.isArray(admRes.value?.admissions))
      ? admRes.value.admissions
      : (cachedAdmissions || []);

    const freshStats = (statsRes.status === 'fulfilled' && statsRes.value?.success)
      ? (statsRes.value.stats || statsRes.value)
      : cachedStats;

    const freshTransactions = (txRes.status === 'fulfilled' && txRes.value?.success && Array.isArray(txRes.value?.transactions))
      ? txRes.value.transactions
      : (cachedTransactions || []);

    const now = Date.now();

    // Cache to volatile memory
    writeMem(RESOURCE_TYPES.RECEPTION_APPOINTMENTS, queueKey, freshAppointments, now);
    writeMem(RESOURCE_TYPES.RECEPTION_ADMISSIONS, queueKey, freshAdmissions, now);
    if (freshStats) writeMem(RESOURCE_TYPES.RECEPTION_STATS, 'dashboard_stats', freshStats, now);
    if (freshTransactions) writeMem(RESOURCE_TYPES.RECEPTION_TRANSACTIONS, 'transactions_ledger', freshTransactions, now);

    // Persist to encrypted SQLite via Security Gate
    try {
      await Promise.all([
        setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS,
          resourceKey: queueKey,
          payload: freshAppointments,
          isSynthetic: false,
        }),
        setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_ADMISSIONS,
          resourceKey: queueKey,
          payload: freshAdmissions,
          isSynthetic: false,
        }),
        freshStats ? setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_STATS,
          resourceKey: 'dashboard_stats',
          payload: freshStats,
          isSynthetic: false,
        }) : Promise.resolve(),
        freshTransactions ? setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_TRANSACTIONS,
          resourceKey: 'transactions_ledger',
          payload: freshTransactions,
          isSynthetic: false,
        }) : Promise.resolve(),
      ]);
    } catch (dbErr) {}

    return {
      success: true,
      appointments: freshAppointments,
      admissions: freshAdmissions,
      stats: freshStats,
      transactions: freshTransactions,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (netErr) {
    if (cachedAppointments || cachedAdmissions) {
      return {
        success: true,
        appointments: cachedAppointments || [],
        admissions: cachedAdmissions || [],
        stats: cachedStats,
        transactions: cachedTransactions || [],
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw netErr;
  }
}

// ── 2. Reference Catalogs (Hospital, Doctors, Beds, UPI) ───────────────────────
/**
 * Fetches and caches reference catalogs used by reception workflows and registration.
 */
export async function fetchReceptionCatalogsWithOffline() {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const readCatalog = async (resourceType) => {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: 'catalog_master' });
    if (memKey && _receptionSessionMemoryCache.has(memKey)) {
      return _receptionSessionMemoryCache.get(memKey).payload;
    }
    try {
      const entry = await getCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey: 'catalog_master',
      });
      if (entry.found) return entry.payload;
    } catch (e) {}
    return null;
  };

  const writeCatalog = async (resourceType, payload) => {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: 'catalog_master' });
    if (memKey) {
      _receptionSessionMemoryCache.set(memKey, {
        payload,
        lastFetchedAt: Date.now(),
        tenantId,
        userId,
      });
    }
    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey: 'catalog_master',
        payload,
        isSynthetic: false,
      });
    } catch (e) {}
  };

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    const hospital = await readCatalog(RESOURCE_TYPES.RECEPTION_HOSPITAL_CONTEXT);
    const doctors = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_DOCTORS)) || [];
    const availableBeds = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_BEDS)) || [];
    const upiOptions = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_UPI)) || [];

    return {
      success: true,
      hospital,
      doctors,
      availableBeds,
      upiOptions,
      fromCache: true,
      isOffline: true,
    };
  }

  // Online Fetch
  const results = {
    hospital: null,
    doctors: [],
    availableBeds: [],
    upiOptions: [],
  };

  try {
    const hospRes = await hospitalAPI.getMyHospital().catch(() => null);
    if (hospRes?.success && hospRes.hospital) {
      results.hospital = hospRes.hospital;
      await writeCatalog(RESOURCE_TYPES.RECEPTION_HOSPITAL_CONTEXT, results.hospital);
    } else {
      results.hospital = await readCatalog(RESOURCE_TYPES.RECEPTION_HOSPITAL_CONTEXT);
    }
  } catch (e) {}

  const hid = results.hospital?._id || '';
  try {
    const docRes = await publicAPI.getDoctors(null, hid).catch(() => null);
    if (docRes?.success && Array.isArray(docRes.doctors)) {
      results.doctors = docRes.doctors;
      await writeCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_DOCTORS, results.doctors);
    } else {
      results.doctors = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_DOCTORS)) || [];
    }
  } catch (e) {}

  try {
    const bedRes = await bedAPI.getBeds({ status: 'AVAILABLE' }).catch(() => null);
    if (bedRes?.success && Array.isArray(bedRes.beds)) {
      results.availableBeds = bedRes.beds;
      await writeCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_BEDS, results.availableBeds);
    } else {
      results.availableBeds = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_BEDS)) || [];
    }
  } catch (e) {}

  try {
    const deptUpiRes = await hospitalAPI.getDepartmentUpiByRole('Reception').catch(() => null);
    if (deptUpiRes?.success && deptUpiRes.departmentUpi) {
      results.upiOptions = [{ label: deptUpiRes.departmentUpi.label, upiId: deptUpiRes.departmentUpi.upiId }];
      await writeCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_UPI, results.upiOptions);
    } else {
      const upiRes = await hospitalAPI.getUpiIds().catch(() => null);
      if (upiRes?.success && Array.isArray(upiRes.upiIds)) {
        results.upiOptions = upiRes.upiIds;
        await writeCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_UPI, results.upiOptions);
      } else {
        results.upiOptions = (await readCatalog(RESOURCE_TYPES.RECEPTION_CATALOG_UPI)) || [];
      }
    }
  } catch (e) {}

  return {
    success: true,
    ...results,
    fromCache: false,
    isOffline: false,
  };
}

// ── 3. Reception Patients Directory (All Queue & Directory) ────────────────────
/**
 * Fetches all appointments & patients directory with offline retrieval.
 * Used by ReceptionPatients.js
 */
export async function fetchReceptionPatientsWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const apptsKey = 'all_patients_queue';
  const directoryKey = 'all_patients_directory';

  let cachedAppts = null;
  let cachedPatients = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS, resourceKey: apptsKey });
    if (memKey && _receptionSessionMemoryCache.has(memKey)) {
      const entry = _receptionSessionMemoryCache.get(memKey);
      cachedAppts = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS,
        resourceKey: apptsKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedAppts = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    const memDirKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS, resourceKey: directoryKey });
    if (memDirKey && _receptionSessionMemoryCache.has(memDirKey)) {
      cachedPatients = _receptionSessionMemoryCache.get(memDirKey).payload;
    } else {
      const dbDir = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS,
        resourceKey: directoryKey,
      });
      if (dbDir.found && Array.isArray(dbDir.payload)) {
        cachedPatients = dbDir.payload;
      }
    }

    if ((cachedAppts || cachedPatients) && typeof onCacheHit === 'function') {
      onCacheHit({
        appointments: cachedAppts || [],
        patients: cachedPatients || [],
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedAppts || cachedPatients) {
      return {
        success: true,
        appointments: cachedAppts || [],
        patients: cachedPatients || [],
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached patient queue is available.');
  }

  // Fetch online
  try {
    const [apptsRes, ptsRes] = await Promise.allSettled([
      receptionAPI.getAllAppointments({ all: 'true' }),
      receptionAPI.getAllPatients(),
    ]);

    const freshAppts = (apptsRes.status === 'fulfilled' && apptsRes.value?.success && Array.isArray(apptsRes.value?.appointments))
      ? apptsRes.value.appointments
      : (cachedAppts || []);

    const freshPts = (ptsRes.status === 'fulfilled' && ptsRes.value?.success && Array.isArray(ptsRes.value?.patients))
      ? ptsRes.value.patients
      : (cachedPatients || []);

    const now = Date.now();

    // Cache in RAM
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS, resourceKey: apptsKey });
    if (memKey) _receptionSessionMemoryCache.set(memKey, { payload: freshAppts, lastFetchedAt: now, tenantId, userId });

    const memDirKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS, resourceKey: directoryKey });
    if (memDirKey) _receptionSessionMemoryCache.set(memDirKey, { payload: freshPts, lastFetchedAt: now, tenantId, userId });

    // Persist to encrypted SQLite
    try {
      await Promise.all([
        setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_APPOINTMENTS,
          resourceKey: apptsKey,
          payload: freshAppts,
          isSynthetic: false,
        }),
        setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS,
          resourceKey: directoryKey,
          payload: freshPts,
          isSynthetic: false,
        }),
      ]);
    } catch (e) {}

    return {
      success: true,
      appointments: freshAppts,
      patients: freshPts,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedAppts || cachedPatients) {
      return {
        success: true,
        appointments: cachedAppts || [],
        patients: cachedPatients || [],
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 4. Offline Patient Search ─────────────────────────────────────────────────
/**
 * Performs patient search with fallback to cached queries and local patient directory.
 */
export async function searchPatientsWithOffline(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: true, patients: [] };
  }
  const cleanQ = query.trim().toLowerCase();

  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const searchKey = `search_${cleanQ}`;

  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      const res = await receptionAPI.searchPatients(cleanQ);
      const patients = (res && res.success && Array.isArray(res.patients)) ? res.patients : [];

      // Cache this search result
      const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_SEARCH, resourceKey: searchKey });
      if (memKey) {
        _receptionSessionMemoryCache.set(memKey, { payload: patients, lastFetchedAt: Date.now(), tenantId, userId });
      }
      try {
        await setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_SEARCH,
          resourceKey: searchKey,
          payload: patients,
          isSynthetic: false,
        });
      } catch (e) {}

      return {
        success: true,
        patients,
        fromCache: false,
        isOffline: false,
      };
    } catch (e) {
      console.warn('[OfflineReceptionService] Online patient search failed, falling back to local cache:', e.message);
    }
  }

  // Device is offline or online call failed => Fallback to cached query or cached patient list
  // 1. Direct query cache check
  const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_SEARCH, resourceKey: searchKey });
  if (memKey && _receptionSessionMemoryCache.has(memKey)) {
    return {
      success: true,
      patients: _receptionSessionMemoryCache.get(memKey).payload,
      fromCache: true,
      isOffline: true,
    };
  }

  try {
    const dbSearch = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_SEARCH,
      resourceKey: searchKey,
    });
    if (dbSearch.found && Array.isArray(dbSearch.payload)) {
      return {
        success: true,
        patients: dbSearch.payload,
        fromCache: true,
        isOffline: true,
      };
    }
  } catch (e) {}

  // 2. Local search across cached patients directory and appointments
  let candidatePatients = [];
  try {
    const memDirKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS, resourceKey: 'all_patients_directory' });
    if (memDirKey && _receptionSessionMemoryCache.has(memDirKey)) {
      candidatePatients = _receptionSessionMemoryCache.get(memDirKey).payload || [];
    } else {
      const dbDir = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_PATIENTS,
        resourceKey: 'all_patients_directory',
      });
      if (dbDir.found && Array.isArray(dbDir.payload)) {
        candidatePatients = dbDir.payload;
      }
    }
  } catch (e) {}

  const matches = candidatePatients.filter((p) => {
    const name = String(p.name || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase();
    const phone = String(p.phone || p.mobile || '');
    const mrn = String(p.patientId || p.mrn || p._id || '').toLowerCase();
    const aadhaar = String(p.aadhaar || '');
    return name.includes(cleanQ) || phone.includes(cleanQ) || mrn.includes(cleanQ) || aadhaar.includes(cleanQ);
  });

  return {
    success: true,
    patients: matches,
    fromCache: true,
    isOffline: true,
  };
}

// ── 4.5. Offline Patient Profile & Full History ──────────────────────────────
/**
 * Fetches patient full history and demographics with offline caching.
 */
export async function fetchPatientProfileWithOffline({ patientId, department = 'Unassigned' }) {
  if (!patientId) throw new Error('Patient ID is required.');
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const profileKey = `profile_${patientId}_${department || 'all'}`;

  let cachedProfile = null;
  const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_PROFILE, resourceKey: profileKey });
  if (memKey && _receptionSessionMemoryCache.has(memKey)) {
    cachedProfile = _receptionSessionMemoryCache.get(memKey).payload;
  } else {
    try {
      const entry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_PROFILE,
        resourceKey: profileKey,
      });
      if (entry.found && entry.payload) cachedProfile = entry.payload;
    } catch (e) {}
  }

  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    if (cachedProfile) {
      return { success: true, ...cachedProfile, fromCache: true, isOffline: true };
    }
    throw new Error('Device is offline and no cached profile is available for this patient.');
  }

  try {
    const res = await patientAPI.getFullHistory(patientId, department);
    if (res && res.success && res.user) {
      const payload = { user: res.user, timeline: res.timeline || [] };
      if (memKey) _receptionSessionMemoryCache.set(memKey, { payload, lastFetchedAt: Date.now(), tenantId, userId });
      try {
        await setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.RECEPTION_PATIENT_PROFILE,
          resourceKey: profileKey,
          payload,
          isSynthetic: false,
        });
      } catch (e) {}
      return { success: true, ...payload, fromCache: false, isOffline: false };
    }
    return res;
  } catch (err) {
    if (cachedProfile) {
      return { success: true, ...cachedProfile, fromCache: true, isOffline: true };
    }
    throw err;
  }
}

// ── 5. Reception Refunds (Cash Queue & History) ────────────────────────────────
/**
 * Fetches cash refund queue or history with offline support.
 */
export async function fetchReceptionRefundsWithOffline({ viewTab = 'PENDING' } = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resourceType = viewTab === 'PENDING'
    ? RESOURCE_TYPES.RECEPTION_REFUNDS_PENDING
    : RESOURCE_TYPES.RECEPTION_REFUNDS_HISTORY;
  const resKey = `refunds_${viewTab.toLowerCase()}`;

  let cachedRefunds = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: resKey });
    if (memKey && _receptionSessionMemoryCache.has(memKey)) {
      const entry = _receptionSessionMemoryCache.get(memKey);
      cachedRefunds = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedRefunds = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedRefunds) {
      return {
        success: true,
        refunds: cachedRefunds,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error(`Device is offline and no cached ${viewTab.toLowerCase()} refunds are available.`);
  }

  // Fetch online
  try {
    const res = viewTab === 'PENDING'
      ? await refundReceptionAPI.getCashRefunds(false)
      : await refundReceptionAPI.getRefundHistory();

    const freshRefunds = (res && res.success && Array.isArray(res.data))
      ? res.data
      : (cachedRefunds || []);

    const now = Date.now();

    const memKey = buildReceptionCacheKey({ tenantId, userId, resourceType, resourceKey: resKey });
    if (memKey) {
      _receptionSessionMemoryCache.set(memKey, { payload: freshRefunds, lastFetchedAt: now, tenantId, userId });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey: resKey,
        payload: freshRefunds,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      refunds: freshRefunds,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedRefunds) {
      return {
        success: true,
        refunds: cachedRefunds,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 6. Safe Offline Drafts: Patient Registration & Booking Form ────────────────
/**
 * Saves the entire 5-step registration intake form state locally as an encrypted draft.
 * Prevents loss of entered demographic, clinical, slot, and payment data in poor connectivity.
 */
export async function saveRegistrationDraftWithOffline({
  draftKey = 'active_intake',
  intakeForm,
  currentStep = 1,
  selectedPatientId = null,
  isEditingProfileOnly = false,
  followupStatus = null,
} = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    intakeForm,
    currentStep,
    selectedPatientId,
    isEditingProfileOnly,
    followupStatus,
    savedAt: Date.now(),
    isDraft: true,
  };

  // 1. Volatile memory cache
  const memKey = buildReceptionCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _receptionSessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Patient registration form saved locally as a draft.',
    draft: draftPayload,
  };
}

/**
 * Retrieves the active registration draft for current tenant and user.
 */
export async function getRegistrationDraft({ draftKey = 'active_intake' } = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildReceptionCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _receptionSessionMemoryCache.has(memKey)) {
    return _receptionSessionMemoryCache.get(memKey).payload;
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _receptionSessionMemoryCache.set(memKey, {
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
 * Clears an active registration draft after successful online registration & booking.
 */
export async function clearRegistrationDraft({ draftKey = 'active_intake' } = {}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildReceptionCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _receptionSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.RECEPTION_REGISTRATION_DRAFT,
      resourceKey: draftKey,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

// ── 7. Safe Offline Drafts: Reception Vitals Recording ─────────────────────────
/**
 * Saves patient vitals with offline draft outbox support.
 * - If online: persists to server immediately.
 * - If offline: enqueues RECORD_VITALS operation in offline outbox.
 */
export async function saveReceptionVitalsWithOffline({
  patientId,
  appointmentId = null,
  vitalsData,
  notes = '',
}) {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineReceptionService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  if (!patientId) {
    throw new Error('Patient ID is required to record vitals.');
  }

  const payload = {
    patientId,
    appointmentId,
    vitals: {
      ...vitalsData,
      lastRecorded: new Date().toISOString(),
    },
    notes: notes || '',
    recordedAt: Date.now(),
  };

  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      await doctorAPI.updatePatientProfile(patientId, {
        vitals: payload.vitals,
      });

      return {
        success: true,
        isDraft: false,
        message: 'Vitals saved successfully to server.',
      };
    } catch (err) {
      console.warn('[OfflineReceptionService] Online vitals save failed, queuing offline draft:', err.message);
    }
  }

  // Device is offline or online request failed => Enqueue into encrypted offline outbox
  const operationId = `rec_vitals_${patientId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.RECEPTION_VITALS_OUTBOX,
    operationType: 'RECORD_VITALS',
    payload,
  });

  return {
    success: true,
    isDraft: true,
    operationId,
    message: 'Device is offline. Vitals saved as a local draft and will sync automatically once connected.',
  };
}

/**
 * Replays queued vitals operations from outbox when connectivity is restored.
 */
export async function syncReceptionOutbox() {
  const authCtx = await getReceptionAuthContext();
  if (!authCtx.isValid) return { synced: 0, pending: 0, failed: 0 };
  const { tenantId, userId } = authCtx;

  const isOnline = await checkOnlineStatus();
  if (!isOnline) return { synced: 0, pending: 0, failed: 0, offline: true };

  const pendingOps = await getPendingOperations({ tenantId, userId });
  let synced = 0;
  let failed = 0;

  for (const op of pendingOps) {
    if (op.operationType === 'RECORD_VITALS' && op.payload?.patientId) {
      try {
        await markOperationStatus({ operationId: op.operationId, status: 'syncing' });
        await doctorAPI.updatePatientProfile(op.payload.patientId, {
          vitals: op.payload.vitals,
        });
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
  }

  return { synced, failed, pending: pendingOps.length - synced };
}

// ── 8. Clinical, Financial & Inventory Safety Gates ───────────────────────────
/**
 * Strict safety gates for operations requiring live server validation,
 * sequence locking, concurrency checks, or financial auditing.
 */

export async function registerPatientOnlineOnly(regPayload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Patient registration requires an active internet connection to allocate official MRN and verify duplicates. Your form data has been preserved as a Local Draft.'
    );
  }
  return await receptionAPI.registerPatient(regPayload);
}

export async function bookAppointmentOnlineOnly(bookPayload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Appointment booking requires active server confirmation for token generation and doctor schedule locking. Your booking details are preserved in the Local Draft.'
    );
  }
  return await receptionAPI.bookAppointment(bookPayload);
}

export async function handOverRefundCashOnlineOnly(refundId) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Cash refund handover requires active server connectivity for financial auditing and authorization.'
    );
  }
  return await refundReceptionAPI.handOverCash(refundId);
}

export async function admitPatientOnlineOnly(admissionPayload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Hospital admission requires active server connectivity for bed allocation and inventory locking.'
    );
  }
  return await admissionAPI.createAdmission(admissionPayload);
}

export async function transferBedOnlineOnly(admissionId, transferPayload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Bed transfer requires active server connectivity for live room and bed inventory management.'
    );
  }
  return await admissionAPI.transferBed(admissionId, transferPayload);
}

export async function dischargePatientOnlineOnly(admissionId, dischargePayload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Patient discharge requires active server connectivity for final billing and bed clearance.'
    );
  }
  return await admissionAPI.dischargePatient(admissionId, dischargePayload);
}

export async function cancelAppointmentOnlineOnly(appointmentId) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Appointment cancellation requires active server connectivity.'
    );
  }
  return await receptionAPI.cancelAppointment(appointmentId);
}

export async function confirmPaymentOnlineOnly(appointmentId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Payment collection and invoice finalization require active server connectivity.'
    );
  }
  return await receptionAPI.confirmPayment(appointmentId, payload);
}
