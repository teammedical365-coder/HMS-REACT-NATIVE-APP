/**
 * HMS OFFLINE PERSISTENCE — NURSING MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Nursing screens:
 * - NurseDashboard (inpatient active admissions, operations metrics, hospital nurses, alerts, dashboard summary)
 * - NurseOPDQueue (OPD appointments queue, triage vitals recording, diagnostic reports)
 * - NurseAppointments (appointment calendar list, triage vitals recording)
 * - NursePatientWorkspace (inpatient clinical workspace: vitals, MAR, nursing notes, tasks, I/O, devices, wound care, handovers)
 * - NursePatientDocuments (patient clinical documents, diagnostic reports, and legal consents)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant RAM/L2 cache presentation + fresh background server fetch
 * - Explicit Clinical Freshness Indicators: Cached vitals, MAR, and patient states explicitly indicate
 *   last-verified timestamp; never represented as guaranteed live current state while offline.
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Clinical inpatient records persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Triage vitals, inpatient vitals, nursing notes, intake/output records, and shift handovers
 *   queued to encrypted outbox or saved as local drafts.
 * - Strict Online-Only Safety Gates: Medication administration (MAR), order acknowledgement, nursing clarification,
 *   nursing clearance sign-off, nurse assignment, and diagnostic report uploads are strictly blocked offline to
 *   prevent double-dosing, untracked clinical status, or legal non-compliance.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  admissionAPI,
  doctorAPI,
  ipdClinicalAPI,
  ipdNursingAPI,
  nursingNoteAPI,
  nursingTaskAPI,
  intakeOutputAPI,
  ipdLineAPI,
  ipdCatheterAPI,
  woundCareAPI,
  nurseHandoverAPI,
  ipdCommandCenterAPI,
  reportAPI,
  patientAPI,
} from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';
import {
  enqueueOperation,
  getPendingOperations,
  markOperationSyncing,
  markOperationFailed,
  markOperationSynced,
  removeOperation,
} from './offlineQueue';

// ── Resource Type Constants ──────────────────────────────────────────────────
export const RESOURCE_TYPES = {
  NURSE_DASHBOARD_SUMMARY: 'nurse_dashboard_summary',
  NURSE_OPERATIONS_METRICS: 'nurse_operations_metrics',
  NURSE_HOSPITAL_NURSES: 'nurse_hospital_nurses',
  NURSE_HOSPITAL_ALERTS: 'nurse_hospital_alerts',
  NURSE_OPD_QUEUE: 'nurse_opd_queue',
  NURSE_APPOINTMENTS: 'nurse_appointments',
  NURSE_ACTIVE_ADMISSIONS: 'nurse_active_admissions',
  NURSE_ADMISSION_DETAILS: 'nurse_admission_details',
  NURSE_ORDERS: 'nurse_orders',
  NURSE_VITALS: 'nurse_vitals',
  NURSE_MAR: 'nurse_mar',
  NURSE_NOTES: 'nurse_notes',
  NURSE_TASKS: 'nurse_tasks',
  NURSE_IO: 'nurse_io',
  NURSE_DEVICES: 'nurse_devices',
  NURSE_WOUND_CARE: 'nurse_wound_care',
  NURSE_HANDOVERS: 'nurse_handovers',
  NURSE_INVESTIGATIONS: 'nurse_investigations',
  NURSE_OT_PLANS: 'nurse_ot_plans',
  NURSE_TIMELINE: 'nurse_timeline',
  NURSE_DISCHARGE_READINESS: 'nurse_discharge_readiness',
  NURSE_DISCHARGE_BLOCKERS: 'nurse_discharge_blockers',
  NURSE_PATIENT_DOCUMENTS: 'nurse_patient_documents',
  NURSE_PATIENT_CONSENTS: 'nurse_patient_consents',
  // Drafts & Outbox
  NURSE_VITALS_OUTBOX: 'nurse_vitals_outbox',
  NURSE_NOTES_DRAFT: 'nurse_notes_draft',
  NURSE_IO_DRAFT: 'nurse_io_draft',
  NURSE_HANDOVER_DRAFT: 'nurse_handover_draft',
};

// ── Volatile Nursing Session Memory Cache (RAM Only) ─────────────────────────
// Holds in-memory session records during active nursing session.
// Fails closed across restarts on web; wiped on user logout.
const _nursingSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Nursing module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildNursingCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `nurse_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for Nursing module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearNursingSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _nursingSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _nursingSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _nursingSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated Nursing context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getNursingAuthContext() {
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

  // Require valid hospital/tenant scope
  let rawTenant = user?.hospitalId || user?.tenantId || user?.hospitalSlug || user?.hospital;
  if (rawTenant && typeof rawTenant === 'object') {
    rawTenant = rawTenant._id || rawTenant.id || rawTenant.slug || null;
  }

  if (!rawTenant || typeof rawTenant !== 'string' || !rawTenant.trim() || rawTenant === 'null' || rawTenant === 'undefined') {
    return {
      isValid: false,
      reason: 'MISSING_TENANT_ID',
      tenantId: null,
      userId: null,
      role: null,
      user: null,
    };
  }

  return {
    isValid: true,
    userId: String(rawUserId).trim(),
    tenantId: String(rawTenant).trim(),
    role: (typeof user.role === 'object' ? user.role.name : user.role || '').toLowerCase(),
    user,
  };
}

// ── Generic Safe SWR Fetch Helper for Nursing ────────────────────────────────
async function safeNursingSWRFetch({
  resourceType,
  resourceKey = 'default',
  apiFetcher,
  forceRefresh = false,
  freshnessNote = null,
}) {
  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineNursingService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  const memKey = buildNursingCacheKey({ tenantId, userId, resourceType, resourceKey });

  // 1. Try In-Memory Volatile Cache First
  let cachedPayload = null;
  let cachedLastSynced = null;

  if (memKey && _nursingSessionMemoryCache.has(memKey)) {
    const memEntry = _nursingSessionMemoryCache.get(memKey);
    cachedPayload = memEntry.payload;
    cachedLastSynced = memEntry.lastFetchedAt;
  }

  // 2. Try L2 Persistent Cache if not in RAM
  if (!cachedPayload) {
    try {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType,
        resourceKey,
      });
      if (dbEntry.found && dbEntry.payload) {
        cachedPayload = dbEntry.payload;
        cachedLastSynced = dbEntry.lastFetchedAt;
        if (memKey) {
          _nursingSessionMemoryCache.set(memKey, {
            payload: cachedPayload,
            lastFetchedAt: cachedLastSynced,
            tenantId,
            userId,
          });
        }
      }
    } catch (e) {}
  }

  // 3. Offline Mode: Return cached data immediately or flag empty state
  if (!isOnline) {
    if (cachedPayload !== null) {
      return {
        data: cachedPayload,
        fromCache: true,
        isStale: true,
        lastSynced: cachedLastSynced,
        freshnessNote,
      };
    }
    return {
      data: null,
      fromCache: false,
      isStale: false,
      noCache: true,
      lastSynced: null,
      freshnessNote,
    };
  }

  // 4. Online Mode: Return cached immediately if not forcing refresh, revalidate in background
  if (!forceRefresh && cachedPayload !== null) {
    // Background revalidation
    (async () => {
      try {
        const freshData = await apiFetcher();
        if (freshData !== undefined && freshData !== null) {
          const now = Date.now();
          if (memKey) {
            _nursingSessionMemoryCache.set(memKey, {
              payload: freshData,
              lastFetchedAt: now,
              tenantId,
              userId,
            });
          }
          await setCacheEntry({
            tenantId,
            userId,
            resourceType,
            resourceKey,
            payload: freshData,
            isSynthetic: false,
          });
        }
      } catch (bgErr) {
        // Silent background error
      }
    })();

    return {
      data: cachedPayload,
      fromCache: true,
      isStale: false,
      lastSynced: cachedLastSynced,
      freshnessNote,
    };
  }

  // 5. Fresh Online Fetch
  try {
    const freshData = await apiFetcher();
    const now = Date.now();

    if (freshData !== undefined && freshData !== null) {
      if (memKey) {
        _nursingSessionMemoryCache.set(memKey, {
          payload: freshData,
          lastFetchedAt: now,
          tenantId,
          userId,
        });
      }
      try {
        await setCacheEntry({
          tenantId,
          userId,
          resourceType,
          resourceKey,
          payload: freshData,
          isSynthetic: false,
        });
      } catch (cacheErr) {}
    }

    return {
      data: freshData,
      fromCache: false,
      isStale: false,
      lastSynced: now,
      freshnessNote: null,
    };
  } catch (err) {
    // Network failure fallback to cache
    if (cachedPayload !== null) {
      return {
        data: cachedPayload,
        fromCache: true,
        isStale: true,
        lastSynced: cachedLastSynced,
        freshnessNote,
      };
    }
    throw err;
  }
}

// ── 1. Nurse Dashboard SWR Reads ─────────────────────────────────────────────
/**
 * Fetches nurse dashboard summary and active admissions with offline fallback.
 */
export async function fetchNurseDashboardWithOffline(forceRefresh = false) {
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_DASHBOARD_SUMMARY,
    resourceKey: 'summary',
    apiFetcher: async () => {
      const [admissionsRes, metricsRes, nursesRes, summaryRes, hospitalAlertsRes] = await Promise.all([
        admissionAPI.getActiveAdmissions().catch(() => ({ admissions: [] })),
        ipdNursingAPI.getOperationsMetrics().catch(() => ({ metrics: null })),
        ipdNursingAPI.getHospitalNurses().catch(() => ({ nurses: [] })),
        ipdNursingAPI.getDashboardSummary().catch(() => null),
        ipdNursingAPI.getHospitalAlerts().catch(() => ({ alerts: [] })),
      ]);
      return {
        admissions: admissionsRes.admissions || admissionsRes.data || [],
        operationsMetrics: metricsRes.metrics || metricsRes.data || null,
        hospitalNurses: nursesRes.nurses || nursesRes.data || [],
        summary: summaryRes?.summary || summaryRes?.data || summaryRes || null,
        summaryPatients: summaryRes?.patients || [],
        alerts: hospitalAlertsRes.alerts || hospitalAlertsRes.data || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached nursing dashboard census. Bed allocations & shifts may differ while offline.',
  });
}

/**
 * Fetches hospital-wide nurses reference list with offline support.
 */
export async function fetchHospitalNursesWithOffline(forceRefresh = false) {
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_HOSPITAL_NURSES,
    resourceKey: 'list',
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getHospitalNurses();
      return res.nurses || res.data || [];
    },
    forceRefresh,
  });
}

/**
 * Fetches hospital-wide nursing alerts with offline support.
 */
export async function fetchHospitalAlertsWithOffline(forceRefresh = false) {
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_HOSPITAL_ALERTS,
    resourceKey: 'alerts',
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getHospitalAlerts();
      return res.alerts || res.data || [];
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached clinical alerts. Connect to the internet for real-time telemetry updates.',
  });
}

// ── 2. Nurse OPD Queue & Appointments Reads ──────────────────────────────────
/**
 * Fetches OPD appointments queue with offline support.
 */
export async function fetchNurseOPDQueueWithOffline(forceRefresh = false) {
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_OPD_QUEUE,
    resourceKey: 'today',
    apiFetcher: async () => {
      const res = await doctorAPI.getAllAppointments();
      return res.appointments || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached OPD queue. In-consultation status may differ until reconnected.',
  });
}

/**
 * Fetches nurse appointment schedule with offline support.
 */
export async function fetchNurseAppointmentsWithOffline(date = 'today', forceRefresh = false) {
  const normDate = String(date || 'today').split('T')[0];
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_APPOINTMENTS,
    resourceKey: normDate,
    apiFetcher: async () => {
      const res = await doctorAPI.getAllAppointments();
      return res.appointments || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached appointments schedule. Status changes require online connection.',
  });
}

// ── 3. Inpatient Workspace Composite SWR Reads ───────────────────────────────
/**
 * Fetches admission details for inpatient workspace.
 */
export async function fetchNurseAdmissionDetailsWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: null, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_ADMISSION_DETAILS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      try {
        const singleRes = await admissionAPI.getAdmissionById(admissionId);
        return singleRes?.admission || singleRes?.data || singleRes;
      } catch (e) {
        const res = await admissionAPI.getActiveAdmissions();
        const list = res.admissions || res.data || [];
        return list.find(a => String(a._id) === String(admissionId)) || null;
      }
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached admission profile. Bed location & attending physician may differ.',
  });
}

/**
 * Fetches doctor orders for nurse workspace.
 */
export async function fetchNurseOrdersWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_ORDERS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdClinicalAPI.getOrders(admissionId);
      return res.orders || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached clinical orders. Real-time STAT or SOS orders require server connection.',
  });
}

/**
 * Fetches vitals history and latest vitals for inpatient.
 */
export async function fetchNurseVitalsWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: { vitalsHistory: [], latestVitals: null }, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_VITALS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const [historyRes, latestRes] = await Promise.all([
        ipdClinicalAPI.getVitalsHistory(admissionId).catch(() => ({ vitals: [] })),
        ipdClinicalAPI.getLatestVitals(admissionId).catch(() => ({ vitals: null })),
      ]);
      return {
        vitalsHistory: historyRes.vitals || historyRes.data || [],
        latestVitals: latestRes.vitals || latestRes.data || null,
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached vital signs estimate. Real-time patient hemodynamics must be verified at bedside.',
  });
}

/**
 * Fetches Medication Administration Records (MAR) for inpatient.
 */
export async function fetchNurseMARWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_MAR,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdClinicalAPI.getMARRecords(admissionId);
      return res.marRecords || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached Medication Administration Record. Direct medication administration requires online verification to prevent double-dosing.',
  });
}

/**
 * Fetches nursing notes history.
 */
export async function fetchNurseNotesWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_NOTES,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await nursingNoteAPI.getNotes(admissionId);
      return res.notes || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
  });
}

/**
 * Fetches scheduled nursing tasks.
 */
export async function fetchNurseTasksWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_TASKS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await nursingTaskAPI.getTasks(admissionId);
      return res.tasks || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
  });
}

/**
 * Fetches intake and output fluid balance history & summary.
 */
export async function fetchNurseIOWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: { records: [], summary: null }, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_IO,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const [historyRes, summaryRes] = await Promise.all([
        intakeOutputAPI.getHistory(admissionId).catch(() => ({ records: [] })),
        intakeOutputAPI.getSummary(admissionId).catch(() => ({ summary: null })),
      ]);
      return {
        records: historyRes.records || historyRes.data || [],
        summary: summaryRes.summary || summaryRes.data || null,
      };
    },
    forceRefresh,
  });
}

/**
 * Fetches active invasive lines, cannulas, and catheters.
 */
export async function fetchNurseDevicesWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: { lines: [], catheters: [] }, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_DEVICES,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const [linesRes, cathsRes] = await Promise.all([
        ipdLineAPI.getLines(admissionId).catch(() => ({ lines: [] })),
        ipdCatheterAPI.getCatheters(admissionId).catch(() => ({ catheters: [] })),
      ]);
      return {
        lines: linesRes.lines || linesRes.data || [],
        catheters: cathsRes.catheters || cathsRes.data || [],
      };
    },
    forceRefresh,
  });
}

/**
 * Fetches wound care and dressing records.
 */
export async function fetchNurseWoundCareWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_WOUND_CARE,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await woundCareAPI.getHistory(admissionId);
      return res.records || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
  });
}

/**
 * Fetches shift handovers history.
 */
export async function fetchNurseHandoversWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_HANDOVERS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await nurseHandoverAPI.getHandovers(admissionId);
      return res.handovers || res.data || (Array.isArray(res) ? res : []);
    },
    forceRefresh,
  });
}

/**
 * Fetches diagnostic investigations for inpatient.
 */
export async function fetchNurseInvestigationsWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_INVESTIGATIONS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getInvestigations(admissionId);
      return res.investigations || res.data?.investigations || [];
    },
    forceRefresh,
  });
}

/**
 * Fetches OT & surgery plans for inpatient.
 */
export async function fetchNurseOTPlansWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_OT_PLANS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getOTPlans(admissionId);
      return res.surgeryPlans || res.data || [];
    },
    forceRefresh,
  });
}

/**
 * Fetches clinical timeline events for inpatient.
 */
export async function fetchNurseTimelineWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_TIMELINE,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getTimeline(admissionId);
      return res.timeline || res.data || [];
    },
    forceRefresh,
  });
}

/**
 * Fetches discharge readiness checklist for inpatient.
 */
export async function fetchNurseDischargeReadinessWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: null, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_DISCHARGE_READINESS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdNursingAPI.getDischargeReadiness(admissionId);
      return res.readiness || res.data || null;
    },
    forceRefresh,
  });
}

/**
 * Fetches discharge blockers for inpatient.
 */
export async function fetchNurseDischargeBlockersWithOffline(admissionId, forceRefresh = false) {
  if (!admissionId) return { data: null, noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_DISCHARGE_BLOCKERS,
    resourceKey: String(admissionId),
    apiFetcher: async () => {
      const res = await ipdCommandCenterAPI.getDischargeBlockers(admissionId);
      return res || null;
    },
    forceRefresh,
  });
}

/**
 * Fetches patient diagnostic reports list with offline support.
 */
export async function fetchNursePatientDocumentsWithOffline(patientId, forceRefresh = false) {
  if (!patientId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_PATIENT_DOCUMENTS,
    resourceKey: String(patientId),
    apiFetcher: async () => {
      let reports = [];
      try {
        const repRes = reportAPI.getReportsByPatient
          ? await reportAPI.getReportsByPatient(patientId)
          : (reportAPI.getPatientReports ? await reportAPI.getPatientReports(patientId) : {});
        reports = repRes.reports || repRes.data || (Array.isArray(repRes) ? repRes : []);
      } catch (e) {}
      try {
        if (patientAPI.getDocuments) {
          const docRes = await patientAPI.getDocuments(patientId);
          const docs = docRes.documents || docRes.data || [];
          const seen = new Set(reports.map(r => r.url || r.fileId || r._id));
          docs.forEach(d => {
            const key = d.url || d.fileId || d._id;
            if (key && !seen.has(key)) {
              seen.add(key);
              reports.push(d);
            }
          });
        }
      } catch (e) {}
      return reports;
    },
    forceRefresh,
  });
}

/**
 * Fetches patient signed consents list with offline support.
 */
export async function fetchNursePatientConsentsWithOffline(patientId, forceRefresh = false) {
  if (!patientId) return { data: [], noCache: true };
  return safeNursingSWRFetch({
    resourceType: RESOURCE_TYPES.NURSE_PATIENT_CONSENTS,
    resourceKey: String(patientId),
    apiFetcher: async () => {
      try {
        const res = patientAPI.getConsent
          ? await patientAPI.getConsent(patientId)
          : (patientAPI.getPatientConsents ? await patientAPI.getPatientConsents(patientId) : {});
        return res.consentForms || res.consents || res.data || (Array.isArray(res) ? res : []);
      } catch (e) {
        return [];
      }
    },
    forceRefresh,
  });
}

// ── 4. Safe Offline Drafts & Outbox Handlers ──────────────────────────────────
/**
 * Saves OPD Triage Vitals with offline outbox queuing.
 */
export async function saveNurseOPDVitalsWithOffline({ patientId, profileData }) {
  if (!patientId) {
    throw new Error('Patient ID is required to record triage vitals.');
  }

  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineNursingService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      const res = await doctorAPI.updatePatientProfile(patientId, profileData);
      return {
        success: true,
        queued: false,
        message: 'OPD triage vitals recorded successfully to server.',
        data: res,
      };
    } catch (err) {
      console.warn('[OfflineNursingService] Online triage vitals update failed, falling back to outbox:', err.message);
    }
  }

  // Queue to offline outbox
  const operationId = `nurse_opd_vitals_${patientId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_VITALS_OUTBOX,
    operationType: 'RECORD_OPD_VITALS',
    payload: {
      patientId,
      profileData,
    },
  });

  return {
    success: true,
    queued: true,
    message: 'Device is offline. Triage vitals saved as a local draft and will sync automatically once connected.',
    operationId,
  };
}

/**
 * Records inpatient bedside vitals with offline outbox support.
 */
export async function recordInpatientVitalsWithOffline({ admissionId, payload }) {
  if (!admissionId) {
    throw new Error('Admission ID is required to record inpatient vitals.');
  }

  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineNursingService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      const res = await ipdClinicalAPI.recordVitals(admissionId, payload);
      return {
        success: true,
        queued: false,
        message: 'Inpatient vitals recorded successfully to server.',
        data: res,
      };
    } catch (err) {
      console.warn('[OfflineNursingService] Online inpatient vitals failed, queueing offline:', err.message);
    }
  }

  // Queue to offline outbox
  const operationId = `nurse_ipd_vitals_${admissionId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_VITALS_OUTBOX,
    operationType: 'RECORD_INPATIENT_VITALS',
    payload: {
      admissionId,
      payload,
    },
  });

  return {
    success: true,
    queued: true,
    message: 'Device is offline. Inpatient vitals saved as a local draft and will sync automatically once connected.',
    operationId,
  };
}

/**
 * Saves nursing clinical notes with offline outbox queuing.
 */
export async function saveNursingNoteWithOffline({ admissionId, noteData }) {
  if (!admissionId) {
    throw new Error('Admission ID is required to save nursing notes.');
  }

  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineNursingService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      const res = await nursingNoteAPI.createNote(admissionId, noteData);
      return {
        success: true,
        queued: false,
        message: 'Nursing note saved successfully to server.',
        data: res,
      };
    } catch (err) {
      console.warn('[OfflineNursingService] Online note save failed, queuing offline draft:', err.message);
    }
  }

  const operationId = `nurse_note_${admissionId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_NOTES_DRAFT,
    operationType: 'CREATE_NURSING_NOTE',
    payload: {
      admissionId,
      noteData,
    },
  });

  return {
    success: true,
    queued: true,
    message: 'Device is offline. Nursing note saved as a local draft and will sync once connected.',
    operationId,
  };
}

/**
 * Records fluid intake and output with offline outbox queuing.
 */
export async function recordIntakeOutputWithOffline({ admissionId, ioData }) {
  if (!admissionId) {
    throw new Error('Admission ID is required to record intake/output.');
  }

  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineNursingService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  if (isOnline) {
    try {
      const res = await intakeOutputAPI.recordIO(admissionId, ioData);
      return {
        success: true,
        queued: false,
        message: 'Intake/Output recorded successfully to server.',
        data: res,
      };
    } catch (err) {
      console.warn('[OfflineNursingService] Online I/O record failed, queuing offline draft:', err.message);
    }
  }

  const operationId = `nurse_io_${admissionId}_${Date.now()}`;
  await enqueueOperation({
    operationId,
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_IO_DRAFT,
    operationType: 'RECORD_INTAKE_OUTPUT',
    payload: {
      admissionId,
      ioData,
    },
  });

  return {
    success: true,
    queued: true,
    message: 'Device is offline. Fluid intake/output saved as a local draft.',
    operationId,
  };
}

/**
 * Saves a local draft for shift handover.
 */
export async function saveShiftHandoverDraftWithOffline(admissionId, handoverData) {
  if (!admissionId) return;
  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildNursingCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
    resourceKey: String(admissionId),
  });

  const payload = {
    ...handoverData,
    admissionId,
    savedAt: Date.now(),
    isDraft: true,
  };

  if (memKey) {
    _nursingSessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
      resourceKey: String(admissionId),
      payload,
      isSynthetic: false,
    });
  } catch (e) {}

  return { success: true, isDraft: true, data: payload };
}

/**
 * Retrieves shift handover local draft.
 */
export async function getShiftHandoverDraft(admissionId) {
  if (!admissionId) return null;
  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildNursingCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
    resourceKey: String(admissionId),
  });

  if (memKey && _nursingSessionMemoryCache.has(memKey)) {
    const p = _nursingSessionMemoryCache.get(memKey).payload;
    return { success: true, data: p, draft: p, ...p };
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
      resourceKey: String(admissionId),
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _nursingSessionMemoryCache.set(memKey, {
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
 * Clears shift handover draft upon online submission.
 */
export async function clearShiftHandoverDraft(admissionId) {
  if (!admissionId) return;
  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildNursingCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
    resourceKey: String(admissionId),
  });

  if (memKey) {
    _nursingSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.NURSE_HANDOVER_DRAFT,
      resourceKey: String(admissionId),
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Synchronizes pending nursing outbox operations when network is restored.
 * Replays only safe, idempotent operations.
 */
export async function syncQueuedNursingOperations() {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    return { synced: 0, failed: 0, pending: 0, isOnline: false };
  }

  const authCtx = await getNursingAuthContext();
  if (!authCtx.isValid) {
    return { synced: 0, failed: 0, pending: 0, isOnline: true };
  }
  const { tenantId, userId } = authCtx;

  const pendingOps = await getPendingOperations({ tenantId, userId });
  const nursingOps = pendingOps.filter(op =>
    op.resourceType === RESOURCE_TYPES.NURSE_VITALS_OUTBOX ||
    op.resourceType === RESOURCE_TYPES.NURSE_NOTES_DRAFT ||
    op.resourceType === RESOURCE_TYPES.NURSE_IO_DRAFT
  );

  let synced = 0;
  let failed = 0;

  for (const op of nursingOps) {
    try {
      await markOperationSyncing(op.operationId);

      if (op.operationType === 'RECORD_OPD_VITALS') {
        const { patientId, profileData } = op.payload || {};
        if (patientId && profileData) {
          await doctorAPI.updatePatientProfile(patientId, profileData);
        }
      } else if (op.operationType === 'RECORD_INPATIENT_VITALS') {
        const { admissionId, payload } = op.payload || {};
        if (admissionId && payload) {
          await ipdClinicalAPI.recordVitals(admissionId, payload);
        }
      } else if (op.operationType === 'CREATE_NURSING_NOTE') {
        const { admissionId, noteData } = op.payload || {};
        if (admissionId && noteData) {
          await nursingNoteAPI.createNote(admissionId, noteData);
        }
      } else if (op.operationType === 'RECORD_INTAKE_OUTPUT') {
        const { admissionId, ioData } = op.payload || {};
        if (admissionId && ioData) {
          await intakeOutputAPI.recordIO(admissionId, ioData);
        }
      }

      await markOperationSynced(op.operationId);
      await removeOperation(op.operationId);
      synced++;
    } catch (syncErr) {
      console.warn(`[OfflineNursingService] Sync error for ${op.operationId}:`, syncErr.message);
      await markOperationFailed(op.operationId, syncErr.message);
      failed++;
    }
  }

  return { synced, failed, pending: nursingOps.length - synced - failed, isOnline: true };
}

// ── 5. Strict Online-Only Safety Gates ────────────────────────────────────────
/**
 * Direct medication administration update (MAR: GIVE / ADMINISTERED / HELD / REFUSED / MISSED).
 * High-risk clinical action. Must be verified online to prevent double-dosing.
 */
export async function administerMedicationOnlineOnly(recordId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Medication administration (MAR) updates require active server connectivity to prevent double-dosing and verify concurrent administrations across shifts.'
    );
  }
  return await ipdClinicalAPI.updateMARRecord(recordId, payload);
}

/**
 * Bedside order acknowledgment by nurse requires live server connectivity.
 */
export async function acknowledgeOrderOnlineOnly(admissionId, orderId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Bedside order acknowledgement requires active server connectivity to notify attending physicians immediately.'
    );
  }
  return await ipdClinicalAPI.acknowledgeOrder(admissionId, orderId, payload);
}

/**
 * Submitting a clinical clarification question to doctor requires live connectivity.
 */
export async function requestClarificationOnlineOnly(admissionId, orderId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Requesting order clarification requires active server connectivity to alert the on-duty physician.'
    );
  }
  return await ipdClinicalAPI.requestClarification(admissionId, orderId, payload);
}

/**
 * Assigning a nurse to an admission or shift requires live server connectivity.
 */
export async function assignNurseOnlineOnly(admissionId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Inpatient nurse assignment requires active server connectivity to coordinate ward shift coverage.'
    );
  }
  return await ipdNursingAPI.assignNurse(admissionId, payload);
}

/**
 * Signing off nursing discharge clearance is a legal release gate. Online only.
 */
export async function signOffNursingClearanceOnlineOnly(admissionId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Signing off nursing discharge clearance requires active server connectivity to ensure patient bill settlement and release verification.'
    );
  }
  return await ipdNursingAPI.signOffNursingClearance(admissionId, payload);
}

/**
 * Diagnostic report document upload requires live server file storage.
 */
export async function uploadDiagnosticReportOnlineOnly(formData) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Uploading diagnostic reports and imaging files requires active server connectivity.'
    );
  }
  return await reportAPI.uploadReport(formData);
}

/**
 * Patient legal consent document submission requires live server storage.
 */
export async function submitConsentOnlineOnly(patientId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Recording patient legal consent requires active server connectivity to ensure immediate medical-legal record integrity.'
    );
  }
  if (patientId && patientAPI.uploadConsent) {
    return await patientAPI.uploadConsent(patientId, payload);
  }
  if (patientAPI.saveConsent) {
    return await patientAPI.saveConsent(payload);
  }
  return { success: false, message: 'Consent API not available' };
}
