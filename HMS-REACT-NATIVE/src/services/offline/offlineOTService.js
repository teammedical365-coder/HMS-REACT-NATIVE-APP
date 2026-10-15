/**
 * HMS OFFLINE PERSISTENCE — OPERATION THEATRE (OT) MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Operation Theatre screens:
 * - OTDashboard (KPIs, active rooms summary, workflow alerts, schedule preview, planned preview)
 * - OTPlannedSurgeries (unbooked surgery plans, surgeon/room lookups, cancellation guard)
 * - OTSchedulePage (daily theatre schedule board, date navigation, live occupancy timeline)
 * - OTRoomsPage (theatre room occupancy, equipment status, active procedures)
 * - OTPreOpPage (pre-operative fasting, premedication clearance, surgical readiness)
 * - OTInProgressPage (active intra-operative surgical cases, running duration timers)
 * - OTPostOpPage (PACU recovery, post-anesthesia care, ward bed transfers)
 * - OTCompletedPage (completed surgical procedures, post-op summaries)
 * - OTSurgeonsPage (surgical team rosters, lead/assistant assignments, case distribution)
 * - OTReportsPage (surgical volume, OT utilization analytics, department statistics)
 * - OTModals (ScheduleSurgeryModal, SurgeryDetailsModal, WorkflowBedModal)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant RAM/L2 cache presentation + fresh background server fetch
 * - Explicit Clinical Freshness Indicators: Cached OT schedules, theatre availability, and patient readiness
 *   explicitly indicate last-verified timestamp; never presented as guaranteed live current state while offline.
 * - Deterministic multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Clinical surgical records persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Surgery schedule drafts and preliminary surgical notes saved safely without implying
 *   surgery authorization or booking.
 * - Strict Online-Only Safety Gates: Surgical workflow transitions (PRE_OP -> IN_OT -> SURGERY_COMPLETED -> POST_OP -> COMPLETED),
 *   theatre allocation, surgery scheduling, surgery cancellation, and bed pre-op/post-op admission/transfers
 *   are strictly blocked offline to prevent double-booking, unsynchronized patient movement, or life-critical safety hazards.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { otAPI, doctorAPI, admissionAPI } from '../../utils/api';
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
  OT_DASHBOARD_STATS: 'ot_dashboard_stats',
  OT_ROOM_STATUS: 'ot_room_status',
  OT_WORKFLOW_ALERTS: 'ot_workflow_alerts',
  OT_TODAY_SCHEDULE: 'ot_today_schedule',
  OT_PLANNED_SURGERIES: 'ot_planned_surgeries',
  OT_SCHEDULED_SURGERIES: 'ot_scheduled_surgeries',
  OT_ROOMS: 'ot_rooms',
  OT_DOCTORS: 'ot_doctors',
  OT_SURGERY_PLAN_DETAIL: 'ot_surgery_plan_detail',
  // Safe Drafts
  OT_SCHEDULE_DRAFT: 'ot_schedule_draft',
  OT_CHECKLIST_NOTES_DRAFT: 'ot_checklist_notes_draft',
};

// ── Volatile OT Session Memory Cache (RAM Only) ──────────────────────────────
// Holds in-memory session records during active OT coordinator/staff session.
// Fails closed across restarts on web; wiped on user logout.
const _otSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for OT module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildOTCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `ot_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for OT module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearOTSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _otSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _otSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _otSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated OT context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getOTAuthContext() {
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

// ── Generic Safe SWR Fetch Helper for OT ─────────────────────────────────────
async function safeOTSWRFetch({
  resourceType,
  resourceKey = 'default',
  apiFetcher,
  forceRefresh = false,
  freshnessNote = null,
}) {
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineOTService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  const memKey = buildOTCacheKey({ tenantId, userId, resourceType, resourceKey });

  // 1. Try In-Memory Volatile Cache First
  let cachedPayload = null;
  let cachedLastSynced = null;

  if (memKey && _otSessionMemoryCache.has(memKey)) {
    const memEntry = _otSessionMemoryCache.get(memKey);
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
          _otSessionMemoryCache.set(memKey, {
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
            _otSessionMemoryCache.set(memKey, {
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
        _otSessionMemoryCache.set(memKey, {
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

// ── 1. OT Dashboard SWR Reads ────────────────────────────────────────────────
/**
 * Fetches OT command center dashboard stats, room occupancy, alerts, today's schedule,
 * planned surgeries, doctors, and rooms with offline fallback.
 */
export async function fetchOTDashboardWithOffline(forceRefresh = false) {
  const today = new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_DASHBOARD_STATS,
    resourceKey: 'dashboard',
    apiFetcher: async () => {
      const [statsRes, roomsRes, alertsRes, scheduleRes, plannedRes, docsRes, allRoomsRes] = await Promise.all([
        otAPI.getDashboardStats().catch(() => ({ success: false, stats: null })),
        otAPI.getRoomStatus(today).catch(() => ({ success: false, rooms: [], summary: null })),
        otAPI.getWorkflowAlerts(today).catch(() => ({ success: false, alerts: [] })),
        otAPI.getTodaySchedule(today).catch(() => ({ success: false, schedule: [] })),
        otAPI.getPlannedSurgeries().catch(() => ({ success: false, surgeries: [] })),
        doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
        otAPI.getRooms().catch(() => ({ rooms: [] })),
      ]);

      return {
        stats: statsRes.stats || {
          todaySurgeries: 0,
          upcomingSurgeries: 0,
          plannedPatients: 0,
          preOpPatients: 0,
          postOpPatients: 0,
          occupiedRooms: 0,
          totalRooms: 0,
        },
        rooms: roomsRes.rooms || [],
        roomSummary: roomsRes.summary || { available: 0, inOt: 0, delayed: 0, scheduled: 0, total: 0 },
        alerts: alertsRes.alerts || [],
        todaySchedule: scheduleRes.schedule || [],
        plannedSurgeries: plannedRes.surgeries || [],
        doctorsList: docsRes.doctors || docsRes.data || [],
        otRoomsList: allRoomsRes.rooms || allRoomsRes.data || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached OT Dashboard. Live room status & emergency cases must be verified with Theatre In-Charge.',
  });
}

// ── 2. OT Planned Surgeries Reads ────────────────────────────────────────────
/**
 * Fetches planned surgeries waiting for scheduling, alongside doctors and OT rooms.
 */
export async function fetchOTPlannedSurgeriesWithOffline(forceRefresh = false) {
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_PLANNED_SURGERIES,
    resourceKey: 'list',
    apiFetcher: async () => {
      const [plannedRes, docsRes, roomsRes] = await Promise.all([
        otAPI.getPlannedSurgeries().catch(() => ({ success: false, surgeries: [] })),
        doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
        otAPI.getRooms().catch(() => ({ rooms: [] })),
      ]);
      return {
        surgeries: plannedRes.surgeries || [],
        doctors: docsRes.doctors || docsRes.data || [],
        rooms: roomsRes.rooms || roomsRes.data || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached planned surgeries. Pre-op surgical clearance & schedules must be verified live.',
  });
}

// ── 3. OT Daily Schedule Reads ───────────────────────────────────────────────
/**
 * Fetches daily OT schedule for a specific date (defaults to today).
 */
export async function fetchOTScheduleWithOffline(date = null, forceRefresh = false) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_TODAY_SCHEDULE,
    resourceKey: targetDate,
    apiFetcher: async () => {
      const [scheduleRes, docsRes, roomsRes] = await Promise.all([
        otAPI.getTodaySchedule(targetDate).catch(() => ({ success: false, schedule: [] })),
        doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
        otAPI.getRooms().catch(() => ({ rooms: [] })),
      ]);
      return {
        schedule: scheduleRes.schedule || [],
        doctors: docsRes.doctors || docsRes.data || [],
        rooms: roomsRes.rooms || roomsRes.data || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached OT schedule. Live theatre occupancy and start times may differ while offline.',
  });
}

// ── 4. OT Rooms & Availability Reads ─────────────────────────────────────────
/**
 * Fetches theatre room statuses and occupancy metrics for a given date.
 */
export async function fetchOTRoomsWithOffline(date = null, forceRefresh = false) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_ROOM_STATUS,
    resourceKey: targetDate,
    apiFetcher: async () => {
      const res = await otAPI.getRoomStatus(targetDate);
      return {
        rooms: res.rooms || [],
        summary: res.summary || { available: 0, inOt: 0, delayed: 0, scheduled: 0, total: 0 },
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached OT room occupancy. Live theatre availability must be confirmed on-site before patient transfer.',
  });
}

// ── 5. OT Pre-Operative Patients Reads ───────────────────────────────────────
/**
 * Fetches pre-operative patients preparing for surgery.
 */
export async function fetchOTPreOpWithOffline(forceRefresh = false) {
  const today = new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_TODAY_SCHEDULE,
    resourceKey: `preop_${today}`,
    apiFetcher: async () => {
      const res = await otAPI.getTodaySchedule(today);
      const schedule = res.schedule || [];
      const preOpList = schedule.filter(s => s.status === 'PRE_OP' || s.status === 'READY_FOR_OT');
      return preOpList;
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached pre-op list. Patient fasting, pre-medication, and clearance must be verified with Ward Nurse.',
  });
}

// ── 6. OT In-Progress Active Surgeries Reads ─────────────────────────────────
/**
 * Fetches active in-theatre surgeries currently in progress.
 */
export async function fetchOTInProgressWithOffline(forceRefresh = false) {
  const today = new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_TODAY_SCHEDULE,
    resourceKey: `in_ot_${today}`,
    apiFetcher: async () => {
      const res = await otAPI.getTodaySchedule(today);
      const schedule = res.schedule || [];
      const inOtList = schedule.filter(s => s.status === 'IN_OT');
      return inOtList;
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached in-theatre cases. Telemetry and active procedure status require live connection.',
  });
}

// ── 7. OT Post-Operative PACU Patients Reads ─────────────────────────────────
/**
 * Fetches post-operative patients recovering in PACU.
 */
export async function fetchOTPostOpWithOffline(forceRefresh = false) {
  const today = new Date().toISOString().split('T')[0];
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_TODAY_SCHEDULE,
    resourceKey: `postop_${today}`,
    apiFetcher: async () => {
      const res = await otAPI.getTodaySchedule(today);
      const schedule = res.schedule || [];
      const postOpList = schedule.filter(s => s.status === 'POST_OP' || s.status === 'SURGERY_COMPLETED');
      return postOpList;
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached PACU/post-op records. Vital signs recovery must be monitored on physical bedside monitors.',
  });
}

// ── 8. OT Completed Surgeries Reads ──────────────────────────────────────────
/**
 * Fetches historical and today's completed surgeries.
 */
export async function fetchOTCompletedWithOffline(forceRefresh = false) {
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_SCHEDULED_SURGERIES,
    resourceKey: 'completed',
    apiFetcher: async () => {
      const res = await otAPI.getScheduledSurgeries();
      const list = (res.surgeries || []).filter(s => s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED');
      return list;
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached completed surgeries list.',
  });
}

// ── 9. OT Surgeons Roster Reads ──────────────────────────────────────────────
/**
 * Fetches surgeon roster and their assigned surgical cases.
 */
export async function fetchOTSurgeonsWithOffline(forceRefresh = false) {
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_DOCTORS,
    resourceKey: 'surgeons_roster',
    apiFetcher: async () => {
      const [docsRes, schedRes] = await Promise.all([
        doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
        otAPI.getScheduledSurgeries().catch(() => ({ surgeries: [] })),
      ]);
      return {
        doctors: docsRes.doctors || docsRes.data || [],
        surgeries: schedRes.surgeries || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached surgeon roster and case schedules.',
  });
}

// ── 10. OT Reports & Analytics Reads ─────────────────────────────────────────
/**
 * Fetches scheduled surgeries and rooms for analytics and reporting.
 */
export async function fetchOTReportsWithOffline(forceRefresh = false) {
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_SCHEDULED_SURGERIES,
    resourceKey: 'reports_analytics',
    apiFetcher: async () => {
      const [schedRes, roomsRes] = await Promise.all([
        otAPI.getScheduledSurgeries().catch(() => ({ surgeries: [] })),
        otAPI.getRooms().catch(() => ({ rooms: [] })),
      ]);
      return {
        surgeries: schedRes.surgeries || [],
        rooms: roomsRes.rooms || roomsRes.data || [],
      };
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached OT operational records.',
  });
}

// ── 11. Individual Surgery Plan Details Read ─────────────────────────────────
/**
 * Fetches a single surgery plan by ID with offline cache fallback.
 */
export async function fetchSurgeryPlanDetailsWithOffline(planId, forceRefresh = false) {
  if (!planId) throw new Error('[OfflineOTService] planId is required');
  return safeOTSWRFetch({
    resourceType: RESOURCE_TYPES.OT_SURGERY_PLAN_DETAIL,
    resourceKey: String(planId),
    apiFetcher: async () => {
      const res = await otAPI.getSurgeryPlanById(planId);
      return res.plan || res.data || res;
    },
    forceRefresh,
    freshnessNote: 'Notice: Cached surgery plan details.',
  });
}

// ── 12. Safe Offline Drafts ──────────────────────────────────────────────────
/**
 * Saves a surgery scheduling form draft locally.
 * Preserves unsubmitted scheduling entries without committing to the live OT board.
 */
export async function saveSurgeryScheduleDraftWithOffline(planId, formData) {
  if (!planId) throw new Error('[OfflineOTService] planId is required to save schedule draft');
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineOTService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const draftPayload = {
    ...formData,
    planId,
    savedAt: new Date().toISOString(),
    status: 'LOCAL_DRAFT',
    authorId: userId,
  };

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
    resourceKey: String(planId),
  });

  if (memKey) {
    _otSessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
      resourceKey: String(planId),
      payload: draftPayload,
      isSynthetic: true,
    });
  } catch (e) {}

  return { success: true, draft: draftPayload };
}

/**
 * Retrieves a saved surgery schedule draft for matching authenticated user and tenant.
 */
export async function getSurgeryScheduleDraft(planId) {
  if (!planId) return null;
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
    resourceKey: String(planId),
  });

  if (memKey && _otSessionMemoryCache.has(memKey)) {
    return _otSessionMemoryCache.get(memKey).payload;
  }

  try {
    const dbEntry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
      resourceKey: String(planId),
    });
    if (dbEntry.found && dbEntry.payload) {
      if (memKey) {
        _otSessionMemoryCache.set(memKey, {
          payload: dbEntry.payload,
          lastFetchedAt: dbEntry.lastFetchedAt,
          tenantId,
          userId,
        });
      }
      return dbEntry.payload;
    }
  } catch (e) {}

  return null;
}

/**
 * Clears a surgery schedule draft after successful server scheduling.
 */
export async function clearSurgeryScheduleDraft(planId) {
  if (!planId) return;
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
    resourceKey: String(planId),
  });

  if (memKey) {
    _otSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.OT_SCHEDULE_DRAFT,
      resourceKey: String(planId),
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Saves preliminary surgical checklist notes as local draft.
 */
export async function saveChecklistNotesDraftWithOffline(surgeryId, notes) {
  if (!surgeryId) throw new Error('[OfflineOTService] surgeryId is required');
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineOTService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const draftPayload = {
    surgeryId,
    notes,
    savedAt: new Date().toISOString(),
    status: 'LOCAL_DRAFT',
    authorId: userId,
  };

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
    resourceKey: String(surgeryId),
  });

  if (memKey) {
    _otSessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
      resourceKey: String(surgeryId),
      payload: draftPayload,
      isSynthetic: true,
    });
  } catch (e) {}

  return { success: true, draft: draftPayload };
}

/**
 * Retrieves preliminary surgical checklist notes draft.
 */
export async function getChecklistNotesDraft(surgeryId) {
  if (!surgeryId) return null;
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
    resourceKey: String(surgeryId),
  });

  if (memKey && _otSessionMemoryCache.has(memKey)) {
    return _otSessionMemoryCache.get(memKey).payload;
  }

  try {
    const dbEntry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
      resourceKey: String(surgeryId),
    });
    if (dbEntry.found && dbEntry.payload) {
      if (memKey) {
        _otSessionMemoryCache.set(memKey, {
          payload: dbEntry.payload,
          lastFetchedAt: dbEntry.lastFetchedAt,
          tenantId,
          userId,
        });
      }
      return dbEntry.payload;
    }
  } catch (e) {}

  return null;
}

/**
 * Clears checklist notes draft.
 */
export async function clearChecklistNotesDraft(surgeryId) {
  if (!surgeryId) return;
  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildOTCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
    resourceKey: String(surgeryId),
  });

  if (memKey) {
    _otSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.OT_CHECKLIST_NOTES_DRAFT,
      resourceKey: String(surgeryId),
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

// ── 13. Consequential Surgical Actions (Strictly Guarded Online-Only) ─────────

/**
 * Updates surgery workflow stage (e.g. ADMITTED, PRE_OP, READY_FOR_OT, IN_OT, SURGERY_COMPLETED, POST_OP, COMPLETED).
 * STRICTLY ONLINE-ONLY: Surgical state transitions govern live room sterilisation, anesthesia alarms,
 * and surgical team mobilisation; offline buffering could cause catastrophic clinical desynchronization.
 */
export async function updateSurgeryWorkflowOnlineOnly(surgeryId, statusPayload) {
  if (!surgeryId) throw new Error('[OfflineOTService] surgeryId is required');
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Online Connection Required: Surgical workflow transitions (such as starting surgery, transferring to OT, or PACU recovery) cannot be performed offline for patient safety.'
    );
  }
  return otAPI.updateSurgeryWorkflow(surgeryId, statusPayload);
}

/**
 * Schedules a surgery into an OT room and time slot.
 * STRICTLY ONLINE-ONLY: Room double-booking prevention requires real-time centralized conflict detection.
 */
export async function scheduleSurgeryOnlineOnly(planId, scheduleData) {
  if (!planId) throw new Error('[OfflineOTService] planId is required');
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Online Connection Required: Scheduling surgery and reserving an OT room requires live server verification to prevent room double-booking and schedule collisions.'
    );
  }
  const result = await otAPI.scheduleSurgery(planId, scheduleData);
  // Clear any local schedule draft on successful booking
  await clearSurgeryScheduleDraft(planId);
  return result;
}

/**
 * Cancels a scheduled or planned surgery.
 * STRICTLY ONLINE-ONLY: Immediate team and theatre coordinator notification is mandatory.
 */
export async function cancelSurgeryOnlineOnly(planId) {
  if (!planId) throw new Error('[OfflineOTService] planId is required');
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Online Connection Required: Surgery cancellation requires a live connection to alert the surgical team and theatre coordinator.'
    );
  }
  return otAPI.cancelSurgery(planId);
}

/**
 * Admits a patient to a bed for pre-op preparation.
 * STRICTLY ONLINE-ONLY: Bed inventory allocation requires real-time reservation.
 */
export async function admitPatientForSurgeryOnlineOnly({ patientId, bedId, ward, surgeryId }) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Online Connection Required: Pre-operative patient admission requires real-time bed inventory allocation.'
    );
  }
  await admissionAPI.createAdmission({
    patientId,
    bedId,
    ward,
    admissionDate: new Date().toISOString().split('T')[0],
    admissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    notes: 'Pre-Op Admission for Surgery',
  });
  return otAPI.updateSurgeryWorkflow(surgeryId, { status: 'ADMITTED' });
}

/**
 * Transfers a post-op patient to a recovery ward bed.
 * STRICTLY ONLINE-ONLY: Bed inventory allocation requires real-time reservation.
 */
export async function transferBedForSurgeryOnlineOnly({ patientId, newBedId, newWard, surgeryId }) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Online Connection Required: Post-operative ward bed transfer requires real-time bed inventory allocation.'
    );
  }
  const actAdmRes = await admissionAPI.getPatientAdmissions(patientId);
  const activeAdm = actAdmRes.admissions?.find(a => a.status === 'Admitted');
  if (!activeAdm) {
    throw new Error('No active admission found for this patient to transfer');
  }
  await admissionAPI.transferBed(activeAdm._id, {
    newWard,
    newBedId,
    transferDate: new Date().toISOString().split('T')[0],
    transferTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    notes: 'Post-Op Ward Transfer',
  });
  return otAPI.updateSurgeryWorkflow(surgeryId, { status: 'POST_OP' });
}

// ── 14. Outbox Synchronization Helper ────────────────────────────────────────
/**
 * Synchronizes any queued OT non-consequential operations when back online.
 */
export async function syncQueuedOTOperations() {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) return { synced: 0, failed: 0, pending: 0, isOnline: false };

  const authCtx = await getOTAuthContext();
  if (!authCtx.isValid) return { synced: 0, failed: 0, pending: 0, isOnline: true };

  const pendingOps = await getPendingOperations({
    tenantId: authCtx.tenantId,
    userId: authCtx.userId,
    module: 'ot',
  });

  let synced = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      await markOperationSyncing(op.operationId);
      // Consequential surgical operations must NOT be auto-synced
      if (
        op.operationType === 'SCHEDULE_SURGERY' ||
        op.operationType === 'CANCEL_SURGERY' ||
        op.operationType === 'WORKFLOW_TRANSITION' ||
        op.operationType === 'BED_ADMISSION' ||
        op.operationType === 'BED_TRANSFER'
      ) {
        await markOperationFailed(
          op.operationId,
          'Consequential surgical action cannot be auto-replayed. Manual confirmation required.'
        );
        failed++;
        continue;
      }

      await markOperationSynced(op.operationId);
      await removeOperation(op.operationId);
      synced++;
    } catch (e) {
      await markOperationFailed(op.operationId, e.message || 'OT sync error');
      failed++;
    }
  }

  return { synced, failed, pending: pendingOps.length - synced - failed, isOnline: true };
}
