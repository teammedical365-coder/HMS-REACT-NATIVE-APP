/**
 * HMS OFFLINE PERSISTENCE — DOCTOR MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Doctor screens:
 * - DoctorDashboard (stats & today's queue)
 * - Patient (appointment list & vitals recording)
 * - DoctorPatientDetails (patient details, clinical history, reference catalogs, session drafts)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant L1/L2 cache presentation + fresh background fetch
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Real clinical data persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Offline Clinical Forms: Safe local drafts for vitals and consultation notes
 * - Clinically Sensitive Actions: Prescription finalization is strictly online-only
 * - Safe Outbox Synchronization: Only idempotent safe drafts (e.g., vitals) auto-replay
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doctorAPI,
  labTestAPI,
  questionLibraryAPI,
  hospitalAPI,
  receptionAPI,
  patientAPI
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
  APPOINTMENTS: 'doctor_appointments',
  DASHBOARD_STATS: 'doctor_dashboard_stats',
  PATIENT_DETAILS: 'doctor_patient_details',
  PATIENT_HISTORY: 'doctor_patient_history',
  CATALOG_LABS: 'doctor_catalog_labs',
  CATALOG_MEDS: 'doctor_catalog_medicines',
  CATALOG_QUESTIONS: 'doctor_catalog_questions',
  HOSPITAL_CONTEXT: 'doctor_hospital_context',
  CLINICAL_DRAFT: 'doctor_clinical_draft',
  VITALS_OUTBOX: 'doctor_vitals',
};

// ── Volatile Doctor Session Memory Cache (RAM Only) ───────────────────────────
// Holds in-memory session records during active doctor session.
// Fails closed across restarts on web; wiped on user logout.
const _doctorSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Doctor module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildDoctorCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `doc_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for doctor module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearDoctorSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _doctorSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _doctorSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _doctorSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated Doctor context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getDoctorAuthContext() {
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

// Backward-compatible alias for existing callers
export async function getAuthContext() {
  const ctx = await getDoctorAuthContext();
  if (!ctx.isValid) {
    // If invalid, return coordinates with empty string or throw error depending on contract
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

// ── 1. Appointments & Today's Queue (Offline Read) ─────────────────────────────
/**
 * Fetch appointments with offline-read support.
 *
 * 1. Checks memory & cacheRepository for immediate cached data.
 * 2. Fetches fresh data from doctorAPI when online.
 * 3. Persists fresh response via Security Gate (SQLCipher on native).
 * 4. Falls back to cached data if network request fails.
 */
export async function fetchAppointmentsWithOffline({
  hasViewAllAccess = false,
  onCacheHit = null,
} = {}) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resourceKey = hasViewAllAccess ? 'all_appointments' : 'doctor_appointments';

  // Step 1: Read valid cached data
  let cachedData = null;
  try {
    const memKey = buildDoctorCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.APPOINTMENTS,
      resourceKey,
    });
    if (memKey && _doctorSessionMemoryCache.has(memKey)) {
      const memEntry = _doctorSessionMemoryCache.get(memKey);
      if (memEntry && Array.isArray(memEntry.payload)) {
        cachedData = {
          found: true,
          payload: memEntry.payload,
          lastFetchedAt: memEntry.lastFetchedAt,
          isSynthetic: Boolean(memEntry.isSynthetic),
        };
      }
    }

    if (!cachedData) {
      const cacheResult = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.APPOINTMENTS,
        resourceKey,
      });
      if (cacheResult.found && Array.isArray(cacheResult.payload)) {
        cachedData = cacheResult;
      }
    }

    if (cachedData && typeof onCacheHit === 'function') {
      onCacheHit({
        appointments: cachedData.payload,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic,
      });
    }
  } catch (cacheReadErr) {
    console.warn('[OfflineDoctorService] Cache read error:', cacheReadErr.message);
  }

  // Step 2: Check Network Connectivity
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedData) {
      return {
        success: true,
        appointments: cachedData.payload,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic,
      };
    }
    throw new Error('Device is offline and no cached appointment records are available.');
  }

  // Step 3: Fetch fresh data from existing service layer
  try {
    const res = hasViewAllAccess
      ? await doctorAPI.getAllAppointments()
      : await doctorAPI.getAppointments();

    const freshAppointments = (res && res.success && Array.isArray(res.appointments))
      ? res.appointments
      : (Array.isArray(res) ? res : []);

    const now = Date.now();

    // Update in-memory session cache
    const memKey = buildDoctorCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.APPOINTMENTS,
      resourceKey,
    });
    if (memKey) {
      _doctorSessionMemoryCache.set(memKey, {
        payload: freshAppointments,
        lastFetchedAt: now,
        tenantId,
        userId,
        isSynthetic: false,
      });
    }

    // Persist via Security Gate (SQLCipher native encrypted)
    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.APPOINTMENTS,
        resourceKey,
        payload: freshAppointments,
        isSynthetic: false,
      });
    } catch (saveErr) {
      console.warn('[OfflineDoctorService] Cache save skipped or blocked:', saveErr.message);
    }

    return {
      success: true,
      appointments: freshAppointments,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
      isSynthetic: false,
    };
  } catch (networkErr) {
    console.warn('[OfflineDoctorService] Network request failed, checking cache fallback:', networkErr.message);

    if (cachedData) {
      return {
        success: true,
        appointments: cachedData.payload,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic,
      };
    }
    throw networkErr;
  }
}

// ── 2. Doctor Dashboard Aggregation (Stats & Today's Queue) ───────────────────
/**
 * Fetches appointments and computes doctor stats with offline caching.
 */
export async function fetchDoctorDashboardWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const statsKey = 'dashboard_stats';

  // Step 1: Read cached dashboard stats from memory or cacheRepository
  let cachedStats = null;
  const memKey = buildDoctorCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.DASHBOARD_STATS,
    resourceKey: statsKey,
  });

  if (memKey && _doctorSessionMemoryCache.has(memKey)) {
    const memEntry = _doctorSessionMemoryCache.get(memKey);
    if (memEntry && memEntry.payload) {
      cachedStats = memEntry;
    }
  }

  if (!cachedStats) {
    try {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.DASHBOARD_STATS,
        resourceKey: statsKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedStats = dbEntry;
      }
    } catch (e) {}
  }

  if (cachedStats && typeof onCacheHit === 'function') {
    onCacheHit(cachedStats.payload);
  }

  // Step 2: Fetch appointments using offline-aware method
  try {
    const aptResult = await fetchAppointmentsWithOffline({
      hasViewAllAccess: false,
    });

    const apts = aptResult.appointments || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayApts = apts.filter(a => a.appointmentDate && String(a.appointmentDate).startsWith(todayStr));
    const pendingApts = apts.filter(a => ['pending', 'confirmed', 'scheduled', 'in_progress'].includes(a.status));
    const completedApts = apts.filter(a => a.status === 'completed');

    const calculatedStats = {
      today: todayApts.length,
      pending: pendingApts.length,
      completed: completedApts.length,
      total: apts.length,
    };

    const dashboardPayload = {
      stats: calculatedStats,
      appointments: apts,
      todayAppointments: todayApts,
      fromCache: aptResult.fromCache,
      isOffline: aptResult.isOffline,
      lastFetchedAt: aptResult.lastFetchedAt,
      isSynthetic: aptResult.isSynthetic,
    };

    // Save stats to memory and cache
    if (memKey) {
      _doctorSessionMemoryCache.set(memKey, {
        payload: dashboardPayload,
        lastFetchedAt: Date.now(),
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.DASHBOARD_STATS,
        resourceKey: statsKey,
        payload: dashboardPayload,
        isSynthetic: false,
      });
    } catch (e) {}

    return dashboardPayload;
  } catch (err) {
    if (cachedStats && cachedStats.payload) {
      return {
        ...cachedStats.payload,
        fromCache: true,
        isOffline: true,
      };
    }
    throw err;
  }
}

// ── 3. Patient Details & Clinical History (Offline Read) ──────────────────────
/**
 * Fetches appointment details and patient clinical history with offline fallback.
 */
export async function fetchPatientDetailsWithOffline({
  appointmentId,
  patientId,
  department = 'Unassigned',
} = {}) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const detailKey = appointmentId ? `appt_${appointmentId}` : `pt_${patientId}`;
  const historyKey = patientId ? `hist_${patientId}_${department}` : null;

  // Step 1: Check cached details
  let cachedDetail = null;
  let cachedHistory = [];
  let lastFetchedAt = null;

  try {
    const memDetailKey = buildDoctorCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PATIENT_DETAILS,
      resourceKey: detailKey,
    });
    if (memDetailKey && _doctorSessionMemoryCache.has(memDetailKey)) {
      const entry = _doctorSessionMemoryCache.get(memDetailKey);
      cachedDetail = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PATIENT_DETAILS,
        resourceKey: detailKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedDetail = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (historyKey) {
      const memHistKey = buildDoctorCacheKey({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PATIENT_HISTORY,
        resourceKey: historyKey,
      });
      if (memHistKey && _doctorSessionMemoryCache.has(memHistKey)) {
        cachedHistory = _doctorSessionMemoryCache.get(memHistKey).payload || [];
      } else {
        const dbHist = await getCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.PATIENT_HISTORY,
          resourceKey: historyKey,
        });
        if (dbHist.found && Array.isArray(dbHist.payload)) {
          cachedHistory = dbHist.payload;
        }
      }
    }
  } catch (cacheErr) {
    console.warn('[OfflineDoctorService] Patient cache read error:', cacheErr.message);
  }

  // Step 2: Check Network
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedDetail) {
      return {
        success: true,
        appointment: cachedDetail.appointment || cachedDetail,
        intakeData: cachedDetail.intakeData || {},
        history: cachedHistory,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached records exist for this patient.');
  }

  // Step 3: Fetch fresh data online
  try {
    let freshAppointment = null;
    let freshIntakeData = {};
    let freshHistory = [];

    if (appointmentId) {
      const res = await doctorAPI.getAppointmentDetails(appointmentId);
      if (res && res.success && res.appointment) {
        freshAppointment = res.appointment;
        const cp = res.appointment.clinicPatientId || {};
        const fert = res.appointment.userId?.fertilityProfile || {};
        freshIntakeData = {
          ...cp,
          ...fert,
          ...(cp.vitals || {}),
          age: cp.age || fert.age || res.appointment.userId?.age || '',
          gender: cp.gender || fert.gender || res.appointment.userId?.gender || '',
          bloodGroup: cp.bloodGroup || fert.bloodGroup || '',
          address: cp.address || fert.address || '',
          allergies: cp.allergies || fert.allergies || '',
          chronicConditions: cp.chronicConditions || fert.chronicConditions || '',
        };
      }
    }

    const resolvedPtId = patientId || freshAppointment?.clinicPatientId?._id || freshAppointment?.userId?._id;
    if (resolvedPtId) {
      try {
        const histRes = await doctorAPI.getPatientHistory(resolvedPtId, department);
        if (histRes && histRes.success) {
          freshHistory = histRes.history || histRes.data || [];
        }
      } catch (hErr) {}
    }

    const now = Date.now();
    const detailPayload = {
      appointment: freshAppointment,
      intakeData: freshIntakeData,
    };

    // Cache to session memory
    const memDetailKey = buildDoctorCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PATIENT_DETAILS,
      resourceKey: detailKey,
    });
    if (memDetailKey) {
      _doctorSessionMemoryCache.set(memDetailKey, {
        payload: detailPayload,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    if (historyKey) {
      const memHistKey = buildDoctorCacheKey({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PATIENT_HISTORY,
        resourceKey: historyKey,
      });
      if (memHistKey) {
        _doctorSessionMemoryCache.set(memHistKey, {
          payload: freshHistory,
          lastFetchedAt: now,
          tenantId,
          userId,
        });
      }
    }

    // Persist to encrypted SQLite via Security Gate
    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PATIENT_DETAILS,
        resourceKey: detailKey,
        payload: detailPayload,
        isSynthetic: false,
      });
      if (historyKey) {
        await setCacheEntry({
          tenantId,
          userId,
          resourceType: RESOURCE_TYPES.PATIENT_HISTORY,
          resourceKey: historyKey,
          payload: freshHistory,
          isSynthetic: false,
        });
      }
    } catch (e) {}

    return {
      success: true,
      appointment: freshAppointment,
      intakeData: freshIntakeData,
      history: freshHistory,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (networkErr) {
    if (cachedDetail) {
      return {
        success: true,
        appointment: cachedDetail.appointment || cachedDetail,
        intakeData: cachedDetail.intakeData || {},
        history: cachedHistory,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw networkErr;
  }
}

// ── 4. Doctor Reference Catalogs (Labs, Meds, Question Forms) ─────────────────
/**
 * Fetches and caches clinical reference catalogs with offline retrieval.
 */
export async function fetchDoctorCatalogsWithOffline() {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  // Function to get from memory or SQLite
  const readCachedCatalog = async (resourceType) => {
    const memKey = buildDoctorCacheKey({ tenantId, userId, resourceType, resourceKey: 'catalog_master' });
    if (memKey && _doctorSessionMemoryCache.has(memKey)) {
      return _doctorSessionMemoryCache.get(memKey).payload;
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

  const writeCachedCatalog = async (resourceType, payload) => {
    const memKey = buildDoctorCacheKey({ tenantId, userId, resourceType, resourceKey: 'catalog_master' });
    if (memKey) {
      _doctorSessionMemoryCache.set(memKey, {
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
    const cachedLabs = await readCachedCatalog(RESOURCE_TYPES.CATALOG_LABS) || [];
    const cachedMeds = await readCachedCatalog(RESOURCE_TYPES.CATALOG_MEDS) || [];
    const cachedQuestions = await readCachedCatalog(RESOURCE_TYPES.CATALOG_QUESTIONS) || null;
    const cachedHospital = await readCachedCatalog(RESOURCE_TYPES.HOSPITAL_CONTEXT) || null;

    return {
      success: true,
      labs: cachedLabs,
      medicines: cachedMeds,
      questionLibrary: cachedQuestions,
      hospital: cachedHospital,
      fromCache: true,
      isOffline: true,
    };
  }

  // Fetch online
  const results = {
    labs: [],
    medicines: [],
    questionLibrary: null,
    hospital: null,
  };

  try {
    const labRes = await labTestAPI.getLabTests().catch(() => null);
    if (labRes?.success) {
      results.labs = labRes.data || [];
      await writeCachedCatalog(RESOURCE_TYPES.CATALOG_LABS, results.labs);
    } else {
      results.labs = (await readCachedCatalog(RESOURCE_TYPES.CATALOG_LABS)) || [];
    }
  } catch (e) {}

  try {
    const medRes = await doctorAPI.getMedicines().catch(() => null);
    if (medRes?.success) {
      results.medicines = medRes.medicines || [];
      await writeCachedCatalog(RESOURCE_TYPES.CATALOG_MEDS, results.medicines);
    } else {
      results.medicines = (await readCachedCatalog(RESOURCE_TYPES.CATALOG_MEDS)) || [];
    }
  } catch (e) {}

  try {
    const libRes = await questionLibraryAPI.getLibrary().catch(() => null);
    if (libRes?.success && libRes?.data?.data) {
      results.questionLibrary = libRes.data.data;
      await writeCachedCatalog(RESOURCE_TYPES.CATALOG_QUESTIONS, results.questionLibrary);
    } else {
      results.questionLibrary = await readCachedCatalog(RESOURCE_TYPES.CATALOG_QUESTIONS);
    }
  } catch (e) {}

  try {
    const hospRes = await hospitalAPI.getMyHospital().catch(() => null);
    if (hospRes?.success) {
      results.hospital = hospRes.hospital;
      await writeCachedCatalog(RESOURCE_TYPES.HOSPITAL_CONTEXT, results.hospital);
    } else {
      results.hospital = await readCachedCatalog(RESOURCE_TYPES.HOSPITAL_CONTEXT);
    }
  } catch (e) {}

  return {
    success: true,
    ...results,
    fromCache: false,
    isOffline: false,
  };
}

// ── 5. Safe Clinical Form Drafts (Vitals & Consultation Notes) ────────────────
/**
 * Saves patient vitals with offline draft outbox support.
 *
 * - If online: persists to server immediately via doctorAPI.updatePatientProfile.
 * - If offline: enqueues RECORD_VITALS operation in offline outbox (encrypted SQLite on native)
 *   and saves locally as a pending draft.
 */
export async function saveVitalsWithOffline({
  patientId,
  appointmentId = null,
  vitalsData,
  notes = '',
  chiefComplaint = '',
}) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
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
    chiefComplaint: chiefComplaint || '',
    recordedAt: Date.now(),
  };

  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      await doctorAPI.updatePatientProfile(patientId, {
        vitals: payload.vitals,
      });

      if (appointmentId && (chiefComplaint || notes)) {
        try {
          await doctorAPI.updateSession(appointmentId, {
            notes: `Chief Complaint: ${chiefComplaint}\nNurse/Doctor Notes: ${notes}`,
          });
        } catch (e) {}
      }

      return {
        success: true,
        isDraft: false,
        message: 'Vitals saved successfully to server.',
      };
    } catch (err) {
      console.warn('[OfflineDoctorService] Online vitals save failed, queuing offline draft:', err.message);
    }
  }

  // Device is offline or online request failed => Enqueue into encrypted offline outbox
  const operationId = `vitals_${patientId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.VITALS_OUTBOX,
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
 * Saves consultation notes, diagnosis, and medicines as a safe local draft.
 * Does NOT finalize the appointment on the server (preserves clinical safety).
 */
export async function saveConsultationDraftWithOffline({
  appointmentId,
  patientId,
  sessionData,
  intakeData = {},
}) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineDoctorService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const draftKey = `draft_${appointmentId || patientId}`;

  const draftPayload = {
    appointmentId,
    patientId,
    sessionData,
    intakeData,
    savedAt: Date.now(),
    isDraft: true,
  };

  // 1. Save in volatile session memory
  const memKey = buildDoctorCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.CLINICAL_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _doctorSessionMemoryCache.set(memKey, {
      payload: draftPayload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  // 2. Persist in encrypted SQLite cache (via Security Gate)
  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.CLINICAL_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Consultation notes saved locally as a draft.',
    draft: draftPayload,
  };
}

/**
 * Retrieves an active consultation draft for a patient/appointment.
 */
export async function getConsultationDraft({ appointmentId, patientId }) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;
  const draftKey = `draft_${appointmentId || patientId}`;

  const memKey = buildDoctorCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.CLINICAL_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _doctorSessionMemoryCache.has(memKey)) {
    return _doctorSessionMemoryCache.get(memKey).payload;
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.CLINICAL_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      return entry.payload;
    }
  } catch (e) {}

  return null;
}

/**
 * Discards or clears a consultation draft.
 */
export async function clearConsultationDraft({ appointmentId, patientId }) {
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;
  const draftKey = `draft_${appointmentId || patientId}`;

  const memKey = buildDoctorCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.CLINICAL_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _doctorSessionMemoryCache.delete(memKey);
  }
}

/**
 * CLINICAL SAFETY GATE: Finalizes prescription & marks consultation completed.
 * Strictly ONLINE-ONLY. Rejects execution if offline to ensure clinical integrity.
 */
export async function finalizePrescriptionOnlineOnly({
  appointmentId,
  payload,
  patientId = null,
  intakeData = null,
}) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'PRESCRIPTION_FINALIZATION_OFFLINE_BLOCKED: Prescription finalization and diagnosis locking require an active network connection for clinical safety. Your notes have been saved as a local draft.'
    );
  }

  // 1. Update patient profile if provided
  if (patientId && intakeData && typeof intakeData === 'object') {
    try {
      await doctorAPI.updatePatientProfile(patientId, intakeData);
    } catch (profErr) {
      console.warn('[OfflineDoctorService] Patient profile update notice:', profErr.message);
    }
  }

  // 2. Finalize session on server
  const response = await doctorAPI.updateSession(appointmentId, payload);

  // 3. Clear draft upon confirmed server finalization
  await clearConsultationDraft({ appointmentId, patientId });

  return response;
}

// ── 6. Outbox Synchronization (Safe Idempotent Operations Only) ───────────────
let _isSyncingDoctorOutbox = false;

/**
 * Synchronizes pending doctor outbox operations when network returns.
 * Only processes safe, idempotent operations (RECORD_VITALS).
 * Retains failed operations for review with retry counts.
 */
export async function syncDoctorOutbox() {
  if (_isSyncingDoctorOutbox) return { syncing: true };
  const authCtx = await getDoctorAuthContext();
  if (!authCtx.isValid) return { success: false, reason: 'unauthenticated' };

  const isOnline = await checkOnlineStatus();
  if (!isOnline) return { success: false, reason: 'offline' };

  _isSyncingDoctorOutbox = true;
  let synced = 0;
  let failed = 0;

  try {
    const { tenantId, userId } = authCtx;
    const pendingOps = await getPendingOperations({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.VITALS_OUTBOX,
    });

    for (const op of pendingOps) {
      if (op.operationType === 'RECORD_VITALS') {
        try {
          await markOperationStatus({
            tenantId,
            userId,
            operationId: op.operationId,
            status: 'syncing',
          });

          const p = op.payload;
          if (p?.patientId && p?.vitals) {
            await doctorAPI.updatePatientProfile(p.patientId, {
              vitals: p.vitals,
            });
            if (p.appointmentId && (p.chiefComplaint || p.notes)) {
              try {
                await doctorAPI.updateSession(p.appointmentId, {
                  notes: `Chief Complaint: ${p.chiefComplaint}\nNotes: ${p.notes}`,
                });
              } catch (e) {}
            }
          }

          await markOperationStatus({
            tenantId,
            userId,
            operationId: op.operationId,
            status: 'synced',
          });
          await removeOperation({
            tenantId,
            userId,
            operationId: op.operationId,
          });
          synced++;
        } catch (err) {
          failed++;
          const newRetryCount = (op.retryCount || 0) + 1;
          const newStatus = newRetryCount >= 5 ? 'needs_attention' : 'failed';
          await markOperationStatus({
            tenantId,
            userId,
            operationId: op.operationId,
            status: newStatus,
            errorMessage: err.message,
          });
        }
      }
    }

    return {
      success: true,
      synced,
      failed,
      remaining: pendingOps.length - synced,
    };
  } finally {
    _isSyncingDoctorOutbox = false;
  }
}

// ── Synthetic Testing Seed Helper ─────────────────────────────────────────────
export async function seedSyntheticAppointmentsForTesting() {
  const { tenantId, userId } = await getAuthContext();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const syntheticList = [
    {
      _id: 'synth_appt_001',
      patientId: 'SYNTH-P-01',
      patientName: 'Aarav Patel (Synthetic Test Patient)',
      phone: '+91 98765 00001',
      age: 38,
      gender: 'Male',
      appointmentDate: `${todayStr}T09:30:00.000Z`,
      timeSlot: '09:30 AM',
      status: 'confirmed',
      department: 'General Medicine',
      type: 'OPD Regular',
      reason: 'Periodic clinical assessment (Synthetic Offline Pilot)',
      tokenNumber: 'A-101',
      isSynthetic: true,
    },
    {
      _id: 'synth_appt_002',
      patientId: 'SYNTH-P-02',
      patientName: 'Priya Sharma (Synthetic Test Patient)',
      phone: '+91 98765 00002',
      age: 29,
      gender: 'Female',
      appointmentDate: `${todayStr}T10:15:00.000Z`,
      timeSlot: '10:15 AM',
      status: 'in_progress',
      department: 'Cardiology',
      type: 'Follow-up',
      reason: 'Routine ECG review (Synthetic Offline Pilot)',
      tokenNumber: 'A-102',
      isSynthetic: true,
    },
  ];

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.APPOINTMENTS,
    resourceKey: 'doctor_appointments',
    payload: syntheticList,
    isSynthetic: true,
  });

  return syntheticList;
}

export default {
  getDoctorAuthContext,
  getAuthContext,
  fetchAppointmentsWithOffline,
  fetchDoctorDashboardWithOffline,
  fetchPatientDetailsWithOffline,
  fetchDoctorCatalogsWithOffline,
  saveVitalsWithOffline,
  saveConsultationDraftWithOffline,
  getConsultationDraft,
  clearConsultationDraft,
  finalizePrescriptionOnlineOnly,
  syncDoctorOutbox,
  clearDoctorSessionMemoryCache,
  seedSyntheticAppointmentsForTesting,
};
