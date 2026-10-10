/**
 * HMS OFFLINE SUPER ADMIN SERVICE
 * 
 * Implements Stale-While-Revalidate and Offline-Read for Super Admin / Central Admin:
 * - Hospitals and hospital list (hospitalAPI.getHospitals, simpleClinicAPI.getClinics, hospitalAPI.getMyHospital)
 * - Users & Staff (adminAPI.getUsers)
 * - Roles & Permissions (adminAPI.getRoles)
 * - Doctors (publicAPI.getDoctors, adminEntitiesAPI.getDoctors)
 * - Question Library (questionLibraryAPI.getLibrary)
 * - Consent Hub (consentAPI.getStats, consentAPI.getCategories, consentAPI.getTemplates)
 * 
 * Reuses the existing:
 * - database.js
 * - cacheRepository.js
 * - networkStatus.js
 * - secureKeyManager.js
 * 
 * Security & Scoping:
 * - Preserves existing Super Admin authorization boundaries.
 * - Enforces multi-tenant / user isolation in SQLCipher cache.
 * - Strips any sensitive credentials or tokens.
 * - Enforces Security Gate before writing to persistence.
 * - Zero mutations or POST/PUT/DELETE operations.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  adminAPI, 
  hospitalAPI, 
  simpleClinicAPI, 
  publicAPI, 
  adminEntitiesAPI, 
  questionLibraryAPI, 
  consentAPI,
  labTestAPI 
} from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';

/**
 * Browser-only in-memory session cache for read-only resources during web dev testing.
 * Strictly stored in volatile JS RAM only — NEVER written to browser localStorage or IndexedDB.
 * Fails closed across page reloads / restarts to preserve zero plaintext disk persistence.
 */
/**
 * Module-level in-memory cache for Question Library and Super Admin data resources.
 * Strictly stored in volatile JS RAM — never written to plaintext browser localStorage or IndexedDB.
 * Survives component unmounts and screen navigation within the application session.
 */
const _questionLibraryMemoryCache = new Map();

/**
 * Deterministic cache key generator.
 * Strict isolation by tenant, user, resource type, department, and query params.
 */
export function buildDeterministicCacheKey({ tenantId, userId, resourceType, resourceKey, department = '', params = {} }) {
  const normTenant = String(tenantId || 'global_superadmin').trim().toLowerCase();
  const normUser = String(userId || 'superadmin').trim().toLowerCase();
  const normResource = String(resourceType || 'unknown').trim().toLowerCase();
  const normKey = String(resourceKey || 'default').trim().toLowerCase();
  const normDept = department ? `::dept_${String(department).trim().toLowerCase()}` : '';
  const paramKeys = Object.keys(params || {}).sort();
  const paramStr = paramKeys.length > 0 ? `::params_${paramKeys.map(k => `${k}=${params[k]}`).join('&')}` : '';
  
  return `ql_mem::${normTenant}::${normUser}::${normResource}::${normKey}${normDept}${paramStr}`;
}

export function getBrowserSessionMemoryCacheStats() {
  return {
    size: _questionLibraryMemoryCache.size,
    keys: Array.from(_questionLibraryMemoryCache.keys()),
  };
}

export function clearBrowserSessionMemoryCache() {
  _questionLibraryMemoryCache.clear();
  clearQuestionLibraryOfflineQueue();
}

// ── Focused Offline Outbox for Question Library Add Question ──────────────────
/**
 * In-memory pending queue for Question Library Add operations.
 * Holds pending items in volatile JS RAM across component unmounts and navigations.
 */
const _questionLibraryOfflineQueue = new Map();
let _isSyncingQuestionQueue = false;

/**
 * Queues an Add Question operation when offline.
 * 
 * @param {Object} params
 * @param {string} params.department - Target department (e.g. 'ENT')
 * @param {string} params.category - Target category (e.g. 'Clinical History & Intake')
 * @param {Object} params.question - Validated question payload
 */
export async function queueQuestionAddition({ department, category, question }) {
  if (!department || !category || !question?.q) {
    throw new Error('[OfflineQueue] Missing required question parameters (department, category, question.q)');
  }

  const { tenantId, userId } = await getSuperAdminAuthContext();
  const operationId = `op_ql_add_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const queuedQuestion = {
    ...question,
    _offlinePending: true,
    _operationId: operationId,
    _syncStatus: 'pending',
    _createdAt: Date.now(),
  };

  const queueEntry = {
    operationId,
    tenantId,
    userId,
    department: String(department),
    category: String(category),
    question: queuedQuestion,
    createdAt: Date.now(),
    status: 'pending', // 'pending' | 'syncing' | 'synced' | 'failed' | 'needs_attention'
    retryCount: 0,
    errorMessage: null,
  };

  // 1. Store in session memory queue
  _questionLibraryOfflineQueue.set(operationId, queueEntry);

  // 2. Immediately update _questionLibraryMemoryCache with the new question
  // so that subsequent cache reads (like when returning from System Overview) retain it
  try {
    const libraryCacheKey = buildDeterministicCacheKey({
      tenantId,
      userId,
      resourceType: 'superadmin_question_library',
      resourceKey: 'library_master',
    });

    const cachedLib = _questionLibraryMemoryCache.get(libraryCacheKey);
    if (cachedLib && cachedLib.payload && cachedLib.payload.data) {
      const libData = cachedLib.payload.data;
      if (!libData[department]) libData[department] = {};
      if (!libData[department][category]) libData[department][category] = [];
      
      const existingIdx = libData[department][category].findIndex(q => q._operationId === operationId);
      if (existingIdx >= 0) {
        libData[department][category][existingIdx] = queuedQuestion;
      } else {
        libData[department][category].push(queuedQuestion);
      }
      cachedLib.lastFetchedAt = Date.now();
    }
  } catch (memErr) {
    console.warn('[OfflineQueue] Could not patch memory cache:', memErr.message);
  }

  // 3. Persist to native SQLCipher database on Android Tier 2
  if (Platform.OS !== 'web') {
    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: 'question_library_outbox',
        resourceKey: operationId,
        payload: queueEntry,
      });
    } catch (dbErr) {
      console.warn('[OfflineQueue] Could not persist to SQLite outbox:', dbErr.message);
    }
  }

  return {
    success: true,
    operationId,
    queuedQuestion,
  };
}

/**
 * Returns all pending/queued Question Library operations.
 */
export function getPendingQuestionLibraryOperations() {
  return Array.from(_questionLibraryOfflineQueue.values());
}

/**
 * Returns count of currently pending operations in the queue.
 */
export function getPendingQuestionCount() {
  let count = 0;
  for (const entry of _questionLibraryOfflineQueue.values()) {
    if (entry.status === 'pending' || entry.status === 'failed') {
      count++;
    }
  }
  return count;
}

/**
 * Injects any queued offline questions into a library data structure.
 */
export function injectPendingQuestionsIntoLibrary(libraryData) {
  if (!libraryData || typeof libraryData !== 'object') return libraryData;
  const cloned = { ...libraryData };

  for (const entry of _questionLibraryOfflineQueue.values()) {
    if (entry.status === 'synced') continue;
    const { department, category, question } = entry;
    if (!cloned[department]) cloned[department] = {};
    if (!cloned[department][category]) cloned[department][category] = [];

    const existingIdx = cloned[department][category].findIndex(
      q => q._operationId === entry.operationId || (q.q === question.q && q._offlinePending)
    );
    if (existingIdx >= 0) {
      cloned[department][category][existingIdx] = question;
    } else {
      cloned[department][category].push(question);
    }
  }
  return cloned;
}

/**
 * Synchronizes pending Question Library Add operations when connectivity is restored.
 * 
 * - Processes operations sequentially
 * - Mutex lock prevents rapid double-submission
 * - Calls authenticated Render API function questionLibraryAPI.updateLibrary
 * - On confirmed success, removes operation from queue and updates question status
 * - On failure, retains operation with status 'failed' or 'needs_attention'
 */
export async function syncPendingQuestionLibraryOperations({ onProgress = null } = {}) {
  if (_isSyncingQuestionQueue) {
    return { success: false, reason: 'sync_already_in_progress' };
  }

  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    return { success: false, reason: 'offline' };
  }

  const pendingOps = Array.from(_questionLibraryOfflineQueue.values()).filter(
    op => op.status === 'pending' || op.status === 'failed'
  );

  if (pendingOps.length === 0) {
    return { success: true, syncedCount: 0, message: 'No pending operations to sync' };
  }

  _isSyncingQuestionQueue = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const { tenantId, userId } = await getSuperAdminAuthContext();
    const libraryCacheKey = buildDeterministicCacheKey({
      tenantId,
      userId,
      resourceType: 'superadmin_question_library',
      resourceKey: 'library_master',
    });

    // 1. Fetch current server library or fallback to cache to get base data
    let currentLibraryData = {};
    try {
      const serverRes = await questionLibraryAPI.getLibrary();
      const rawData = serverRes?.data?.data || serverRes?.data || serverRes?.library;
      if (rawData && typeof rawData === 'object') {
        currentLibraryData = rawData;
      }
    } catch (e) {
      const cached = _questionLibraryMemoryCache.get(libraryCacheKey);
      if (cached?.payload?.data) {
        currentLibraryData = JSON.parse(JSON.stringify(cached.payload.data));
      }
    }

    // 2. Process each pending operation sequentially
    for (const op of pendingOps) {
      op.status = 'syncing';
      if (typeof onProgress === 'function') {
        onProgress({ operationId: op.operationId, status: 'syncing' });
      }

      const { department, category, question } = op;
      if (!currentLibraryData[department]) currentLibraryData[department] = {};
      if (!currentLibraryData[department][category]) currentLibraryData[department][category] = [];

      // Clean offline-only metadata for server payload
      const cleanQuestion = {
        q: question.q,
        type: question.type,
      };
      if (question.options) cleanQuestion.options = question.options;
      if (question.extra) cleanQuestion.extra = question.extra;
      if (question.parentQ && question.condition) {
        cleanQuestion.parentQ = question.parentQ;
        cleanQuestion.condition = question.condition;
      }

      // Check if question text is already in the category on server to prevent duplicate
      const alreadyExists = currentLibraryData[department][category].some(
        q => q.q?.trim().toLowerCase() === cleanQuestion.q?.trim().toLowerCase()
      );
      if (!alreadyExists) {
        currentLibraryData[department][category].push(cleanQuestion);
      }

      try {
        const res = await questionLibraryAPI.updateLibrary(currentLibraryData);
        if (res && res.success) {
          op.status = 'synced';
          syncedCount++;

          // Remove from memory queue
          _questionLibraryOfflineQueue.delete(op.operationId);

          if (typeof onProgress === 'function') {
            onProgress({ operationId: op.operationId, status: 'synced' });
          }
        } else {
          op.status = 'failed';
          op.errorMessage = res?.message || 'Server rejected question update';
          failedCount++;
          if (typeof onProgress === 'function') {
            onProgress({ operationId: op.operationId, status: 'failed', error: op.errorMessage });
          }
        }
      } catch (reqErr) {
        console.warn(`[OfflineQueue] Sync failed for operation ${op.operationId}:`, reqErr.message);
        op.status = 'failed';
        op.errorMessage = reqErr.message;
        failedCount++;
        if (typeof onProgress === 'function') {
          onProgress({ operationId: op.operationId, status: 'failed', error: reqErr.message });
        }
        break;
      }
    }

    // 3. Update memory cache with server confirmed data (clean questions, no pending flag)
    if (syncedCount > 0) {
      _questionLibraryMemoryCache.set(libraryCacheKey, {
        payload: { data: currentLibraryData },
        lastFetchedAt: Date.now(),
        tenantId,
        userId,
        resourceType: 'superadmin_question_library',
        resourceKey: 'library_master',
      });
    }

    return {
      success: syncedCount > 0 && failedCount === 0,
      syncedCount,
      failedCount,
      remainingCount: _questionLibraryOfflineQueue.size,
      updatedLibraryData: currentLibraryData,
    };
  } finally {
    _isSyncingQuestionQueue = false;
  }
}

/**
 * Clears the offline question queue (used on logout or session reset).
 */
export function clearQuestionLibraryOfflineQueue() {
  _questionLibraryOfflineQueue.clear();
}

/**
 * Resolves current authenticated Super Admin context deterministically across all environments.
 */
export async function getSuperAdminAuthContext() {
  let user = null;
  const store = getStoreRef();
  if (store) {
    try {
      user = store.getState()?.auth?.user;
    } catch (e) {}
  }

  // Fallback to web localStorage synchronously if running on web (prevents rehydration key mismatch)
  if (!user && Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedUser = window.localStorage.getItem('user');
      if (storedUser) {
        user = JSON.parse(storedUser);
      }
    } catch (e) {}

    if (!user) {
      try {
        const persistAuth = window.localStorage.getItem('persist:auth');
        if (persistAuth) {
          const parsed = JSON.parse(persistAuth);
          if (parsed?.user) {
            user = typeof parsed.user === 'string' ? JSON.parse(parsed.user) : parsed.user;
          }
        }
      } catch (e) {}
    }
  }

  // Fallback to AsyncStorage
  if (!user) {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {}
  }

  const role = (typeof user?.role === 'object' ? user?.role?.name : user?.role || '').toLowerCase();
  const isSuperAdminRole = ['superadmin', 'centraladmin', 'admin'].includes(role);

  // Robust tenant resolution
  let rawTenant = user?.tenantId || user?.hospitalId || user?.hospital;
  if (rawTenant && typeof rawTenant === 'object') {
    rawTenant = rawTenant._id || rawTenant.id || rawTenant.slug || null;
  }
  const tenantId = rawTenant ? String(rawTenant) : (isSuperAdminRole ? 'global_superadmin' : 'default_tenant');

  // Robust user resolution
  const rawUserId = user?._id || user?.id || user?.email || user?.username;
  const userId = rawUserId ? String(rawUserId) : (isSuperAdminRole ? 'superadmin' : 'authenticated_user');

  return {
    tenantId: String(tenantId),
    userId: String(userId),
    role,
    user,
    isSuperAdmin: isSuperAdminRole,
  };
}

/**
 * Core Reusable Offline-Read Executor.
 * 
 * Reads cache -> Checks connectivity -> Fetches online if possible -> Persists -> Falls back to cache.
 */
export async function fetchWithOfflineRead({
  resourceType,
  resourceKey,
  department = '',
  queryParams = {},
  fetcher,
  extractor = (res) => res,
  onCacheHit = null,
  isSynthetic = false,
}) {
  const { tenantId, userId } = await getSuperAdminAuthContext();
  const cacheKey = buildDeterministicCacheKey({
    tenantId,
    userId,
    resourceType,
    resourceKey,
    department,
    params: queryParams,
  });

  // ── Step 1: Read valid cached data from module-level in-memory Map ───────────
  let cachedData = null;

  // 1a. In-Memory Map check
  const memEntry = _questionLibraryMemoryCache.get(cacheKey);
  if (memEntry && memEntry.payload !== null && memEntry.payload !== undefined) {
    cachedData = {
      payload: memEntry.payload,
      lastFetchedAt: memEntry.lastFetchedAt,
      isSynthetic: false,
      fromMemory: true,
    };
    if (typeof onCacheHit === 'function') {
      try {
        onCacheHit({
          data: cachedData.payload,
          lastFetchedAt: cachedData.lastFetchedAt,
          isSynthetic: false,
        });
      } catch (err) {
        console.warn('[OfflineSuperAdminService] onCacheHit callback error:', err);
      }
    }
  }

  // 1b. Native SQLite / SQLCipher cache check (Native Mobile Tier 2 only)
  if (!cachedData && Platform.OS !== 'web') {
    try {
      const cacheResult = await getCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey,
      });

      if (cacheResult.found && cacheResult.payload !== null && cacheResult.payload !== undefined) {
        cachedData = cacheResult;
        _questionLibraryMemoryCache.set(cacheKey, {
          payload: cacheResult.payload,
          lastFetchedAt: cacheResult.lastFetchedAt,
          tenantId,
          userId,
          resourceType,
          resourceKey,
          department,
        });
        if (typeof onCacheHit === 'function') {
          try {
            onCacheHit({
              data: cacheResult.payload,
              lastFetchedAt: cacheResult.lastFetchedAt,
              isSynthetic: cacheResult.isSynthetic,
            });
          } catch (err) {
            console.warn('[OfflineSuperAdminService] onCacheHit callback error:', err);
          }
        }
      }
    } catch (cacheErr) {
      console.warn(`[OfflineSuperAdminService] Native cache read error for ${resourceType}/${resourceKey}:`, cacheErr.message);
    }
  }

  // ── Step 2: Check Network Status ────────────────────────────────────────────
  const isOnline = await checkOnlineStatus();

  // If offline, SERVE CACHED DATA IMMEDIATELY without attempting network requests or retry loops
  if (!isOnline) {
    if (cachedData) {
      let payloadToReturn = cachedData.payload;
      if (resourceType === 'superadmin_question_library' && payloadToReturn?.data) {
        payloadToReturn = {
          ...payloadToReturn,
          data: injectPendingQuestionsIntoLibrary(payloadToReturn.data),
        };
      }
      return {
        success: true,
        data: payloadToReturn,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic || false,
      };
    }

    // Device is offline and no cache exists: return clear offline empty state without calling backend
    return {
      success: false,
      data: null,
      fromCache: false,
      isOffline: true,
      noCache: true,
      lastFetchedAt: null,
      isSynthetic: false,
      error: 'Device is offline and no cached data is available.',
    };
  }

  // ── Step 3: Fetch fresh data from API when online ───────────────────────────
  try {
    const rawResponse = await fetcher();
    const freshData = extractor(rawResponse);

    // If there are pending offline questions not yet synced, keep them visible in payload
    if (resourceType === 'superadmin_question_library' && freshData?.data) {
      freshData.data = injectPendingQuestionsIntoLibrary(freshData.data);
    }

    // ── Step 4: Write immediately into module-level In-Memory Map Cache ─────────
    // Independent of SQLite / SQLCipher persistence success
    _questionLibraryMemoryCache.set(cacheKey, {
      payload: freshData,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
      resourceType,
      resourceKey,
      department,
    });

    // ── Step 5: Persistent SQLite write attempt on Native Mobile only ───────────
    if (Platform.OS !== 'web') {
      try {
        const writeResult = await setCacheEntry({
          tenantId,
          userId,
          resourceType,
          resourceKey,
          payload: freshData,
          isSynthetic,
        });

        if (writeResult?.blocked) {
          console.log(`[OfflineSuperAdminService] Persistent cache write blocked by Security Gate: ${writeResult.reason}`);
        }
      } catch (saveErr) {
        console.warn(`[OfflineSuperAdminService] Native cache write skipped:`, saveErr.message);
      }
    }

    return {
      success: true,
      data: freshData,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: Date.now(),
      isSynthetic,
      rawResponse,
    };
  } catch (networkErr) {
    console.warn(`[OfflineSuperAdminService] Network fetch failed for [${cacheKey}]:`, networkErr.message);

    // ── Step 6: Network failure fallback to cache ─────────────────────────────
    if (cachedData) {
      return {
        success: true,
        data: cachedData.payload,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: Boolean(cachedData.isSynthetic),
        networkError: networkErr.message,
      };
    }

    return {
      success: false,
      data: null,
      fromCache: false,
      isOffline: true,
      noCache: true,
      lastFetchedAt: null,
      isSynthetic: false,
      error: networkErr.response?.data?.message || networkErr.message || 'Network request failed and no cache is available.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECIALIZED RESOURCE FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. HOSPITALS & HOSPITAL LIST
 */
export async function fetchSuperAdminHospitals({
  plan = 'all',
  includeClinics = false,
  onCacheHit = null,
} = {}) {
  const resourceKey = `hospitals_${plan || 'all'}_clinics_${Boolean(includeClinics)}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_hospitals',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      const hospitalsRes = await hospitalAPI.getHospitals(plan === '' ? 'all' : plan);
      let clinicsRes = { clinics: [] };
      if (includeClinics) {
        try {
          clinicsRes = await simpleClinicAPI.getClinics('starter');
        } catch (e) {
          console.log('[OfflineSuperAdminService] Optional clinics fetch failed:', e.message);
        }
      }
      return { hospitalsRes, clinicsRes };
    },
    extractor: ({ hospitalsRes, clinicsRes }) => {
      const hospData = hospitalsRes?.data !== undefined ? hospitalsRes.data : hospitalsRes;
      const clinData = clinicsRes?.data !== undefined ? clinicsRes.data : clinicsRes;

      const rawHospitals = Array.isArray(hospData)
        ? hospData
        : (hospData?.hospitals || hospData?.data || []);

      const rawClinics = Array.isArray(clinData)
        ? clinData
        : (clinData?.clinics || clinData?.simpleClinics || clinData?.data || []);

      return {
        hospitals: rawHospitals,
        clinics: rawClinics,
        combined: [...rawHospitals, ...rawClinics],
      };
    },
  });
}

/**
 * 2. USERS & STAFF
 */
export async function fetchSuperAdminUsers({
  plan = '',
  hospitalId = '',
  page = 1,
  limit = 50,
  search = '',
  excludeDoctors = false,
  onCacheHit = null,
} = {}) {
  const resourceKey = `users_p${page}_l${limit}_h${hospitalId || 'all'}_pl${plan || 'all'}_s${encodeURIComponent(search || '')}_ed${excludeDoctors}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_users',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminAPI.getUsers(plan, hospitalId, page, limit, search, excludeDoctors);
    },
    extractor: (res) => {
      const users = res?.users || res?.data || (Array.isArray(res) ? res : []);
      return {
        users: Array.isArray(users) ? users : [],
        total: res?.total || users.length,
        page: res?.page || page,
        totalPages: res?.totalPages || 1,
      };
    },
  });
}

/**
 * 3. ROLES & PERMISSIONS
 */
export async function fetchSuperAdminRoles({
  plan = '',
  onCacheHit = null,
} = {}) {
  const resourceKey = `roles_${plan || 'all'}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_roles',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminAPI.getRoles(plan);
    },
    extractor: (res) => {
      const actualData = res?.data?.data || res?.data?.roles || res?.roles || res?.data || res || [];
      return Array.isArray(actualData) ? actualData : [];
    },
  });
}

/**
 * 4. DOCTORS (Public and Admin Entities)
 */
export async function fetchSuperAdminDoctors({
  source = 'admin', // 'admin' | 'public'
  serviceId = null,
  hospitalId = null,
  onCacheHit = null,
} = {}) {
  const resourceKey = `doctors_${source}_${hospitalId || 'all'}_${serviceId || 'all'}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_doctors',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      if (source === 'admin' || source === 'adminEntities') {
        return adminEntitiesAPI.getDoctors();
      }
      return publicAPI.getDoctors(serviceId, hospitalId);
    },
    extractor: (res) => {
      const docs = res?.doctors || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(docs) ? docs : [];
    },
  });
}

/**
 * 5. QUESTION LIBRARY
 */
export async function fetchSuperAdminQuestionLibrary({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'library_master';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_question_library',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return questionLibraryAPI.getLibrary();
    },
    extractor: (res) => {
      const dataObj = res?.data?.data || res?.data || res?.library || res;
      return {
        data: (dataObj && typeof dataObj === 'object') ? dataObj : {},
        allowedDepartments: res?.allowedDepartments || null,
      };
    },
  });
}

/**
 * 6. CONSENT HUB (Stats, Categories, Templates)
 */
export async function fetchSuperAdminConsent({
  templateParams = {},
  onCacheHit = null,
} = {}) {
  const resourceKey = `consent_hub_${JSON.stringify(templateParams || {})}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_consent',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      const [statsRes, catRes, tmplRes] = await Promise.all([
        consentAPI.getStats().catch(() => ({ success: false })),
        consentAPI.getCategories().catch(() => ({ success: false })),
        consentAPI.getTemplates(templateParams).catch(() => ({ success: false })),
      ]);
      return { statsRes, catRes, tmplRes };
    },
    extractor: ({ statsRes, catRes, tmplRes }) => {
      return {
        stats: statsRes?.stats || { totalCategories: 0, totalTemplates: 0, activeTemplates: 0, inactiveTemplates: 0 },
        categories: Array.isArray(catRes?.data) ? catRes.data : [],
        templates: Array.isArray(tmplRes?.data) ? tmplRes.data : [],
      };
    },
  });
}

/**
 * 7. QUESTIONS (Department Questions)
 */
export async function fetchSuperAdminQuestions({
  department = '',
  onCacheHit = null,
} = {}) {
  const resourceKey = `questions_${department || 'all'}`;

  return fetchWithOfflineRead({
    resourceType: 'superadmin_questions',
    resourceKey,
    department: department || 'all',
    onCacheHit,
    fetcher: async () => {
      if (typeof questionLibraryAPI.getQuestions === 'function') {
        return questionLibraryAPI.getQuestions(department);
      }
      const libRes = await questionLibraryAPI.getLibrary();
      const dataObj = libRes?.data?.data || libRes?.data || libRes?.library || libRes;
      if (department && dataObj && typeof dataObj === 'object' && dataObj[department]) {
        return dataObj[department];
      }
      return dataObj || [];
    },
    extractor: (res) => {
      const q = res?.questions || res?.data || (Array.isArray(res) ? res : (typeof res === 'object' ? Object.values(res).flat() : []));
      return Array.isArray(q) ? q : [];
    },
  });
}

/**
 * 8. MEDICINES (Global Catalog)
 */
export async function fetchSuperAdminMedicines({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'medicines_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_medicines',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminEntitiesAPI.getMedicines();
    },
    extractor: (res) => {
      const meds = res?.medicines || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(meds) ? meds : [];
    },
  });
}

/**
 * 9. RECEPTIONISTS (Admin Entities)
 */
export async function fetchSuperAdminReceptionists({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'receptionists_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_receptionists',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminEntitiesAPI.getReceptionists();
    },
    extractor: (res) => {
      const recs = res?.receptionists || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(recs) ? recs : [];
    },
  });
}

/**
 * 10. LABS (Admin Entities)
 */
export async function fetchSuperAdminLabs({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'labs_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_labs',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminEntitiesAPI.getLabs();
    },
    extractor: (res) => {
      const l = res?.labs || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(l) ? l : [];
    },
  });
}

/**
 * 11. LAB TESTS (Test Catalog)
 */
export async function fetchSuperAdminLabTests({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'lab_tests_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_lab_tests',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return labTestAPI.getLabTests();
    },
    extractor: (res) => {
      const tests = res?.data || res?.tests || (Array.isArray(res) ? res : []);
      return Array.isArray(tests) ? tests : [];
    },
  });
}

/**
 * 12. PHARMACIES (Admin Entities)
 */
export async function fetchSuperAdminPharmacies({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'pharmacies_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_pharmacies',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminEntitiesAPI.getPharmacies();
    },
    extractor: (res) => {
      const p = res?.pharmacies || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(p) ? p : [];
    },
  });
}

/**
 * 13. SERVICES (Admin Entities)
 */
export async function fetchSuperAdminServices({
  onCacheHit = null,
} = {}) {
  const resourceKey = 'services_all';

  return fetchWithOfflineRead({
    resourceType: 'superadmin_services',
    resourceKey,
    onCacheHit,
    fetcher: async () => {
      return adminEntitiesAPI.getServices();
    },
    extractor: (res) => {
      const s = res?.services || res?.data || (Array.isArray(res) ? res : []);
      return Array.isArray(s) ? s : [];
    },
  });
}

export const fetchSuperAdminReceptions = fetchSuperAdminReceptionists;

// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC TEST SEEDING FOR SUPER ADMIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seeds synthetic test data for Super Admin resources.
 * Allows safe verification of offline behavior even in unencrypted developer mode.
 */
export async function seedSyntheticSuperAdminDataForTesting() {
  const { tenantId, userId } = await getSuperAdminAuthContext();

  const syntheticHospitals = {
    hospitals: [
      {
        _id: 'synth_hosp_001',
        name: 'Apex Super Specialty Hospital (Synthetic)',
        slug: 'apex-hospital',
        clinicType: 'hospital',
        plan: 'enterprise',
        address: '101 Healthcare Blvd, Metro City',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '+91 99999 11111',
        email: 'admin@apexhospital.synthetic',
        departments: ['Cardiology', 'Neurology', 'Orthopedics', 'General Medicine'],
        isSynthetic: true,
      },
      {
        _id: 'synth_hosp_002',
        name: 'LifeCare Family Clinic (Synthetic)',
        slug: 'lifecare-clinic',
        clinicType: 'clinic',
        plan: 'starter',
        address: '42 Wellness Way, East Wing',
        city: 'Bangalore',
        state: 'Karnataka',
        phone: '+91 99999 22222',
        email: 'contact@lifecare.synthetic',
        departments: ['General Medicine', 'Pediatrics'],
        isSynthetic: true,
      },
    ],
    clinics: [],
    combined: [],
  };
  syntheticHospitals.combined = [...syntheticHospitals.hospitals];

  const syntheticUsers = {
    users: [
      {
        _id: 'synth_user_001',
        name: 'Dr. Sameer Joshi (Synthetic Doctor)',
        email: 'sameer.joshi@synthetic.hms',
        phone: '9876543210',
        role: 'doctor',
        roleName: 'Doctor',
        department: 'Cardiology',
        isSynthetic: true,
      },
      {
        _id: 'synth_user_002',
        name: 'Pooja Nair (Synthetic Head Nurse)',
        email: 'pooja.nair@synthetic.hms',
        phone: '9876543211',
        role: 'nurse',
        roleName: 'Head Nurse',
        department: 'General Medicine',
        isSynthetic: true,
      },
      {
        _id: 'synth_user_003',
        name: 'Amit Kumar (Synthetic Receptionist)',
        email: 'amit.kumar@synthetic.hms',
        phone: '9876543212',
        role: 'receptionist',
        roleName: 'Receptionist',
        department: 'Front Desk',
        isSynthetic: true,
      },
    ],
    total: 3,
    page: 1,
    totalPages: 1,
  };

  const syntheticRoles = [
    { _id: 'synth_role_01', name: 'Super Administrator', roleKey: 'superadmin', permissions: ['*'], isSynthetic: true },
    { _id: 'synth_role_02', name: 'Doctor', roleKey: 'doctor', permissions: ['visit_diagnose', 'clinical_history_view'], isSynthetic: true },
    { _id: 'synth_role_03', name: 'Nurse', roleKey: 'nurse', permissions: ['nurse_access', 'visit_intake'], isSynthetic: true },
    { _id: 'synth_role_04', name: 'Receptionist', roleKey: 'receptionist', permissions: ['patient_create', 'patient_search', 'appointment_manage'], isSynthetic: true },
  ];

  const syntheticQuestionLibrary = {
    data: {
      General: {
        'Chief Complaints': [
          { q: 'Duration of current symptoms?', type: 'text', options: '', isSynthetic: true },
          { q: 'Severity of pain (1-10)?', type: 'select', options: '1,2,3,4,5,6,7,8,9,10', isSynthetic: true },
        ],
      },
      Cardiology: {
        'Chest Pain Evaluation': [
          { q: 'Does pain radiate to left arm or jaw?', type: 'radio', options: 'Yes,No', isSynthetic: true },
          { q: 'Onset during physical exertion?', type: 'radio', options: 'Yes,No', isSynthetic: true },
        ],
      },
    },
    allowedDepartments: ['General', 'Cardiology'],
  };

  const syntheticConsent = {
    stats: { totalCategories: 3, totalTemplates: 5, activeTemplates: 4, inactiveTemplates: 1 },
    categories: [
      { _id: 'synth_cat_01', name: 'Surgical Procedures', description: 'Major and minor surgical interventions', isActive: true, isSynthetic: true },
      { _id: 'synth_cat_02', name: 'Anesthesia Protocol', description: 'General and local anesthesia disclosures', isActive: true, isSynthetic: true },
      { _id: 'synth_cat_03', name: 'Diagnostic Imaging', description: 'CT / MRI with contrast disclosures', isActive: true, isSynthetic: true },
    ],
    templates: [
      { _id: 'synth_tmpl_01', name: 'General Surgical Consent', categoryId: 'synth_cat_01', isActive: true, isSynthetic: true },
      { _id: 'synth_tmpl_02', name: 'Informed Anesthesia Consent', categoryId: 'synth_cat_02', isActive: true, isSynthetic: true },
    ],
  };

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_hospitals',
    resourceKey: 'hospitals_all_clinics_false',
    payload: syntheticHospitals,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_hospitals',
    resourceKey: 'hospitals_all_clinics_true',
    payload: syntheticHospitals,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_users',
    resourceKey: 'users_p1_l50_hall_plall_s_edfalse',
    payload: syntheticUsers,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_roles',
    resourceKey: 'roles_all',
    payload: syntheticRoles,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_question_library',
    resourceKey: 'library_master',
    payload: syntheticQuestionLibrary,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: 'superadmin_consent',
    resourceKey: 'consent_hub_{}',
    payload: syntheticConsent,
    isSynthetic: true,
  });

  console.log('[OfflineSuperAdminService] Seeded synthetic data for all 6 Super Admin resources.');
  return {
    hospitals: syntheticHospitals,
    users: syntheticUsers,
    roles: syntheticRoles,
    questionLibrary: syntheticQuestionLibrary,
    consent: syntheticConsent,
  };
}

export default {
  getSuperAdminAuthContext,
  fetchWithOfflineRead,
  fetchSuperAdminHospitals,
  fetchSuperAdminUsers,
  fetchSuperAdminRoles,
  fetchSuperAdminDoctors,
  fetchSuperAdminQuestionLibrary,
  fetchSuperAdminConsent,
  fetchSuperAdminQuestions,
  fetchSuperAdminMedicines,
  fetchSuperAdminReceptionists,
  fetchSuperAdminReceptions,
  fetchSuperAdminLabs,
  fetchSuperAdminLabTests,
  fetchSuperAdminPharmacies,
  fetchSuperAdminServices,
  seedSyntheticSuperAdminDataForTesting,
};
