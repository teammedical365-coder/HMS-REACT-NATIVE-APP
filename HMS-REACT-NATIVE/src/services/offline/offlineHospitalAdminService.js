/**
 * HMS OFFLINE PERSISTENCE — HOSPITAL ADMIN & REMAINING ROLES SERVICE (PHASE 9)
 *
 * Offline-aware data service for Hospital Admin, Clinic, Accountant, Cashier, and Patient roles:
 * - HospitalAdminDashboard (KPIs, hospital info, staff list, roles, inventory, lab pricing, UPIs, AI wallet)
 * - ClinicDashboard (KPIs, appointments, treatment plans, clinic config, patients)
 * - BedManagement (bed list, ward summaries, occupancy snapshot with staleness indicator)
 * - VialManagement (vial list, storage status, specimen tracking snapshot)
 * - HospitalAdminRefunds (refund requests, audit trail, status records)
 * - AdminMainDashboard (admin stats, role counts, doctor/patient counts)
 * - AccountantDashboard (financial statistics, revenues, costs, margins)
 * - CashierDashboard (billing patients, patient bills, facilities)
 * - PatientDashboard (profile, appointment history, clinical documents)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant RAM/L2 cache presentation + fresh background server fetch
 * - Explicit Freshness Indicators: Cached financial figures, room occupancy, bed availability,
 *   and mutable catalogs explicitly indicate last-verified timestamp; never presented as confirmed live.
 * - Deterministic multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Cached records persisted ONLY to verified SQLCipher storage on native
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB persistence)
 * - Safe Offline Drafts: Staff creation drafts, inventory item drafts, and bed setup drafts
 *   saved safely locally without implying server authorization or creation.
 * - Strict Online-Only Safety Gates: Consequential actions (staff account CRUD, role assignments,
 *   department UPI changes, inventory stock changes, lab test price modifications, vial specimen transfers/disposals,
 *   bed creation/mutation/deletion, refund approvals/rejections, payment processing, facility charges)
 *   are strictly blocked offline to prevent double-allocation, financial ledger desynchronization,
 *   or clinical specimen safety violations.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hospitalAPI,
  adminAPI,
  aiWalletAPI,
  clinicAPI,
  bedAPI,
  vialAPI,
  refundAdminAPI,
  financeAPI,
  billingAPI,
  patientAuthAPI,
  accountantAPI
} from '../../utils/api';
import api from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';

// ── Resource Type Constants ──────────────────────────────────────────────────
export const RESOURCE_TYPES = {
  HOSPITAL_INFO: 'hospital_info',
  HOSPITAL_STATS: 'hospital_stats',
  HOSPITAL_USERS: 'hospital_users',
  HOSPITAL_ROLES: 'hospital_roles',
  HOSPITAL_DEPARTMENT_UPIS: 'hospital_department_upis',
  HOSPITAL_INVENTORY: 'hospital_inventory',
  HOSPITAL_LAB_TESTS: 'hospital_lab_tests',
  AI_WALLET_TRACKING: 'ai_wallet_tracking',
  CLINIC_STATS: 'clinic_stats',
  CLINIC_APPOINTMENTS: 'clinic_appointments',
  CLINIC_TREATMENT_PLANS: 'clinic_treatment_plans',
  CLINIC_CONFIG: 'clinic_config',
  HOSPITAL_BEDS: 'hospital_beds',
  HOSPITAL_VIALS: 'hospital_vials',
  HOSPITAL_VIAL_STATS: 'hospital_vial_stats',
  HOSPITAL_REFUNDS: 'hospital_refunds',
  ADMIN_MAIN_DASHBOARD: 'admin_main_dashboard',
  ACCOUNTANT_STATS: 'accountant_stats',
  CASHIER_PATIENTS: 'cashier_patients',
  CASHIER_FACILITIES: 'cashier_facilities',
  PATIENT_BILLS: 'patient_bills',
  PATIENT_DASHBOARD_PROFILE: 'patient_dashboard_profile',
  PATIENT_DASHBOARD_APPOINTMENTS: 'patient_dashboard_appointments',
  PATIENT_DASHBOARD_DOCUMENTS: 'patient_dashboard_documents',
  // Safe Drafts
  STAFF_DRAFT: 'hospital_staff_draft',
  INVENTORY_DRAFT: 'hospital_inventory_draft',
  BED_DRAFT: 'hospital_bed_draft',
};

// ── Volatile Session Memory Cache (RAM Only) ─────────────────────────────────
// Holds in-memory session records during active Hospital Admin / staff session.
// Fails closed across restarts on web; wiped on user logout.
const _hospitalAdminSessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Hospital Admin & remaining roles.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildHospitalAdminCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `hadmin_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for Hospital Admin module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearHospitalAdminSessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _hospitalAdminSessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _hospitalAdminSessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _hospitalAdminSessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getHospitalAdminAuthContext() {
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

  // Allow patient or global admin with dedicated tenant identifier
  if (!rawTenant && (user.role === 'patient' || user.role === 'superadmin' || user.role === 'centraladmin')) {
    rawTenant = user.tenantId || user.hospitalId || 'tenant_main';
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

// ── Generic Safe SWR Fetch Helper ─────────────────────────────────────────────
async function safeHospitalAdminSWRFetch({
  resourceType,
  resourceKey = 'default',
  apiFetcher,
  forceRefresh = false,
  freshnessNote = null,
}) {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflineHospitalAdminService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const isOnline = await checkOnlineStatus();

  const memKey = buildHospitalAdminCacheKey({ tenantId, userId, resourceType, resourceKey });

  // 1. Try In-Memory Volatile Cache First
  let cachedPayload = null;
  let cachedLastSynced = null;

  if (memKey && _hospitalAdminSessionMemoryCache.has(memKey)) {
    const memEntry = _hospitalAdminSessionMemoryCache.get(memKey);
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
          _hospitalAdminSessionMemoryCache.set(memKey, {
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
            _hospitalAdminSessionMemoryCache.set(memKey, {
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
      } catch (err) {
        console.warn(`[OfflineHospitalAdminService] Background revalidate failed for ${resourceType}:${resourceKey}`, err?.message);
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

  // 5. Online & Fresh Fetch
  try {
    const freshData = await apiFetcher();
    const now = Date.now();
    if (memKey) {
      _hospitalAdminSessionMemoryCache.set(memKey, {
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

    return {
      data: freshData,
      fromCache: false,
      isStale: false,
      lastSynced: now,
      freshnessNote,
    };
  } catch (err) {
    // If online fetch failed, fallback to cached data if present
    if (cachedPayload !== null) {
      return {
        data: cachedPayload,
        fromCache: true,
        isStale: true,
        lastSynced: cachedLastSynced,
        freshnessNote: freshnessNote || 'Network request failed. Displaying previously cached administrative data.',
      };
    }
    throw err;
  }
}

// ── Hospital Admin SWR Fetchers ───────────────────────────────────────────────

/**
 * Fetches Hospital Admin Overview snapshot with SWR cache.
 */
export async function fetchHospitalAdminDashboardWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_INFO,
    resourceKey: 'main_overview',
    forceRefresh,
    freshnessNote: 'Offline snapshot: Staff counts, wallet, and hospital settings reflect last synchronized state.',
    apiFetcher: async () => {
      const [hospRes, usersRes, rolesRes, walletRes, transRes] = await Promise.allSettled([
        hospitalAPI.getMyHospital(),
        adminAPI.getUsers(),
        adminAPI.getRoles(),
        aiWalletAPI.getWallet(),
        aiWalletAPI.getTransactions(1, 50),
      ]);

      const hospital = hospRes.status === 'fulfilled' && hospRes.value?.success ? hospRes.value.hospital : null;
      const rawUsers = usersRes.status === 'fulfilled' ? (usersRes.value?.users || usersRes.value?.data || (Array.isArray(usersRes.value) ? usersRes.value : [])) : [];
      const roles = rolesRes.status === 'fulfilled' && rolesRes.value?.success ? rolesRes.value.data : [];
      const wallet = walletRes.status === 'fulfilled' && walletRes.value?.success ? walletRes.value.wallet : null;
      const transactions = transRes.status === 'fulfilled' && transRes.value?.success ? (transRes.value.transactions || []) : [];
      const doctorBreakdown = transRes.status === 'fulfilled' && transRes.value?.success ? (transRes.value.doctorBreakdown || []) : [];

      return {
        hospital,
        users: rawUsers,
        roles,
        wallet,
        transactions,
        doctorBreakdown,
        stats: {
          totalUsers: rawUsers.length,
          totalDoctors: rawUsers.filter(u => (u.role || u.roleName || '').toLowerCase().includes('doctor')).length,
          totalPatients: rawUsers.filter(u => (u.role || u.roleName || '').toLowerCase() === 'patient').length,
          totalRoles: roles.length,
        },
      };
    },
  });
}

/**
 * Fetches Hospital Analytics / Date Stats with SWR cache.
 */
export async function fetchHospitalStatsWithOffline(hospitalId, queryStart = '', queryEnd = '', forceRefresh = false) {
  const resourceKey = `stats_${hospitalId || 'hosp'}_${queryStart || 'all'}_${queryEnd || 'all'}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_STATS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached analytical report. Financial and admission totals must be verified online.',
    apiFetcher: async () => {
      const res = await hospitalAPI.getHospitalStats(hospitalId, queryStart, queryEnd);
      return res;
    },
  });
}

/**
 * Fetches Hospital Inventory Catalog with SWR cache.
 */
export async function fetchHospitalInventoryWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_INVENTORY,
    resourceKey: 'all_inventory',
    forceRefresh,
    freshnessNote: 'Notice: Cached pharmacy & hospital inventory. Stock quantities may have changed live.',
    apiFetcher: async () => {
      const res = await hospitalAPI.getInventory();
      return res?.success ? res.data : (Array.isArray(res) ? res : []);
    },
  });
}

/**
 * Fetches Hospital Lab Tests and pricing catalog with SWR cache.
 */
export async function fetchHospitalLabTestsWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_LAB_TESTS,
    resourceKey: 'all_lab_tests',
    forceRefresh,
    freshnessNote: 'Notice: Cached lab test directory and configured hospital pricing.',
    apiFetcher: async () => {
      const res = await hospitalAPI.getHospitalLabTests();
      return res?.success ? res.data : (Array.isArray(res) ? res : []);
    },
  });
}

/**
 * Fetches Department UPI accounts with SWR cache.
 */
export async function fetchDepartmentUpisWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_DEPARTMENT_UPIS,
    resourceKey: 'all_dept_upis',
    forceRefresh,
    freshnessNote: 'Notice: Cached department UPI collection points. Offline UPI modifications are forbidden.',
    apiFetcher: async () => {
      const [upiRes, staffRes] = await Promise.all([
        hospitalAPI.getDepartmentUpis(),
        hospitalAPI.getStaffForUpi(),
      ]);
      return {
        departmentUpis: upiRes?.success ? (upiRes.departmentUpis || []) : [],
        staffOptions: staffRes?.success ? (staffRes.staff || staffRes.data || []).filter(s => !s.hasUpiAssigned) : [],
      };
    },
  });
}

// ── Clinic Dashboard SWR Fetchers ─────────────────────────────────────────────

/**
 * Fetches Clinic Dashboard summary, appointments, plans, and config with SWR cache.
 */
export async function fetchClinicDashboardWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.CLINIC_STATS,
    resourceKey: 'clinic_overview',
    forceRefresh,
    freshnessNote: 'Notice: Offline Clinic Hub snapshot. Appointments and treatment plans reflect last sync.',
    apiFetcher: async () => {
      const [statsRes, apptRes, plansRes, cfgRes] = await Promise.allSettled([
        clinicAPI.getStats(),
        clinicAPI.getAppointments(),
        clinicAPI.getTreatmentPlans(),
        clinicAPI.getConfig(),
      ]);

      return {
        stats: statsRes.status === 'fulfilled' && statsRes.value?.success ? (statsRes.value.stats || statsRes.value.data || statsRes.value) : null,
        appointments: apptRes.status === 'fulfilled' && apptRes.value?.success ? (apptRes.value.appointments || apptRes.value.data || []) : [],
        treatmentPlans: plansRes.status === 'fulfilled' && plansRes.value?.success ? (plansRes.value.plans || plansRes.value.data || []) : [],
        config: cfgRes.status === 'fulfilled' && cfgRes.value?.success ? (cfgRes.value.config || cfgRes.value.data || cfgRes.value) : null,
      };
    },
  });
}

// ── Bed Management SWR Fetchers ───────────────────────────────────────────────

/**
 * Fetches Bed directory and occupancy snapshot with SWR cache.
 */
export async function fetchHospitalBedsWithOffline(params = {}, forceRefresh = false) {
  const resourceKey = `beds_${params.ward || 'all'}_${params.status || 'all'}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_BEDS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached bed occupancy snapshot. Bed availability and allocations must be confirmed live.',
    apiFetcher: async () => {
      const res = await bedAPI.getBeds(params);
      return res?.success ? (res.beds || []) : (Array.isArray(res) ? res : []);
    },
  });
}

// ── Vial Management SWR Fetchers ──────────────────────────────────────────────

/**
 * Fetches Vial Inventory and storage statistics with SWR cache.
 */
export async function fetchHospitalVialsWithOffline(params = {}, forceRefresh = false) {
  const resourceKey = `vials_${params.page || 1}_${params.status || 'all'}_${params.vialType || 'all'}_${params.search || ''}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_VIALS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached specimen vial inventory. Vial movements and retrievals require active connection.',
    apiFetcher: async () => {
      const [statsRes, vialsRes] = await Promise.allSettled([
        vialAPI.getStats(),
        vialAPI.getAll(params),
      ]);

      return {
        stats: statsRes.status === 'fulfilled' && statsRes.value?.success ? statsRes.value.stats : {
          totalVials: 0,
          currentlyStored: 0,
          retrievedCount: 0,
          discardedCount: 0,
        },
        vials: vialsRes.status === 'fulfilled' && vialsRes.value?.success ? (vialsRes.value.vials || []) : [],
        pagination: vialsRes.status === 'fulfilled' && vialsRes.value?.pagination ? vialsRes.value.pagination : null,
      };
    },
  });
}

// ── Hospital Admin Refunds SWR Fetchers ───────────────────────────────────────

/**
 * Fetches Hospital Admin refund requests with SWR cache.
 */
export async function fetchHospitalRefundsWithOffline(params = {}, forceRefresh = false) {
  const resourceKey = `refunds_${params.status || 'all'}_${params.page || 1}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.HOSPITAL_REFUNDS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached refund request list. Authorizations and rejections require active server connection.',
    apiFetcher: async () => {
      const res = await refundAdminAPI.getRefunds(params);
      if (res?.success && res.data) {
        return {
          refunds: res.data.refunds || [],
          pagination: res.data.pagination || null,
        };
      }
      return {
        refunds: Array.isArray(res) ? res : (res?.refunds || []),
        pagination: null,
      };
    },
  });
}

// ── Central Admin Main Dashboard SWR Fetchers ─────────────────────────────────

/**
 * Fetches Central Admin Main Dashboard stats with SWR cache.
 */
export async function fetchAdminMainDashboardWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.ADMIN_MAIN_DASHBOARD,
    resourceKey: 'main_stats',
    forceRefresh,
    freshnessNote: 'Notice: Cached system overview. Active user and role metrics reflect last verified sync.',
    apiFetcher: async () => {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('/api/admin/users').catch(() => ({ data: { success: false, users: [] } })),
        api.get('/api/admin/roles').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      const users = usersRes.data?.success ? usersRes.data.users : [];
      const roles = rolesRes.data?.success ? rolesRes.data.data : [];

      return {
        totalUsers: users.length,
        totalRoles: roles.length,
        totalDoctors: users.filter(u => (u.role || '').toLowerCase().includes('doctor')).length,
        totalPatients: users.filter(u => (u.role || '').toLowerCase() === 'patient').length,
      };
    },
  });
}

// ── Accountant Dashboard SWR Fetchers ─────────────────────────────────────────

/**
 * Fetches Financial & Accounting statistics with SWR cache.
 */
export async function fetchAccountantDashboardWithOffline(queryStart = '', queryEnd = '', forceRefresh = false) {
  const resourceKey = `acct_${queryStart || 'all'}_${queryEnd || 'all'}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.ACCOUNTANT_STATS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached financial metrics. Revenue and profit values must be verified online.',
    apiFetcher: async () => {
      const res = await financeAPI.getDashboardStats(queryStart, queryEnd);
      return res?.success ? res.data : null;
    },
  });
}

// ── Cashier & Billing Dashboard SWR Fetchers ──────────────────────────────────

/**
 * Fetches Cashier patient list and hospital facilities with SWR cache.
 */
export async function fetchCashierDashboardWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.CASHIER_PATIENTS,
    resourceKey: 'cashier_overview',
    forceRefresh,
    freshnessNote: 'Notice: Cached cashier directory. Payment settlements must be processed online.',
    apiFetcher: async () => {
      const [patientsRes, hospRes] = await Promise.allSettled([
        billingAPI.getPatients(),
        hospitalAPI.getMyHospital(),
      ]);

      const patients = patientsRes.status === 'fulfilled' && patientsRes.value?.success ? (patientsRes.value.patients || []) : [];
      const facilities = hospRes.status === 'fulfilled' && hospRes.value?.success && hospRes.value.hospital?.facilities?.length > 0
        ? hospRes.value.hospital.facilities
        : [];

      return {
        patients,
        facilities,
      };
    },
  });
}

/**
 * Fetches Patient Bills for a specific identifier with SWR cache.
 */
export async function fetchPatientBillsWithOffline(identifier, forceRefresh = false) {
  if (!identifier) throw new Error('[OfflineHospitalAdminService] identifier is required');
  const resourceKey = `bill_${String(identifier).trim().toLowerCase()}`;
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.PATIENT_BILLS,
    resourceKey,
    forceRefresh,
    freshnessNote: 'Notice: Cached patient dues snapshot. Final settlements require active connection.',
    apiFetcher: async () => {
      const res = await billingAPI.getPatientBills(identifier);
      return res?.success ? res : null;
    },
  });
}

// ── Patient Self-Service Dashboard SWR Fetchers ───────────────────────────────

/**
 * Fetches Patient Dashboard (profile, appointments, documents) with SWR cache.
 */
export async function fetchPatientDashboardWithOffline(forceRefresh = false) {
  return safeHospitalAdminSWRFetch({
    resourceType: RESOURCE_TYPES.PATIENT_DASHBOARD_PROFILE,
    resourceKey: 'patient_self_view',
    forceRefresh,
    freshnessNote: 'Notice: Offline Patient Portal snapshot. Recent reports or new appointments reflect last sync.',
    apiFetcher: async () => {
      const [profRes, apptRes, docRes] = await Promise.allSettled([
        patientAuthAPI.getPatientProfile(),
        patientAuthAPI.getPatientAppointments(),
        patientAuthAPI.getPatientDocuments(),
      ]);

      return {
        profile: profRes.status === 'fulfilled' && profRes.value?.success ? profRes.value.profile : null,
        appointments: apptRes.status === 'fulfilled' && apptRes.value?.success ? (apptRes.value.appointments || []) : [],
        documents: docRes.status === 'fulfilled' && docRes.value?.success ? (docRes.value.documents || []) : [],
      };
    },
  });
}

// ── Safe Offline Drafts ───────────────────────────────────────────────────────

/**
 * Saves Staff creation form as local encrypted draft.
 */
export async function saveStaffDraftWithOffline(draftData) {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) throw new Error(`[OfflineHospitalAdminService] Authentication required: ${authCtx.reason}`);
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.STAFF_DRAFT,
    resourceKey: 'active_draft',
  });

  const payload = {
    ...draftData,
    savedAt: Date.now(),
  };

  if (memKey) {
    _hospitalAdminSessionMemoryCache.set(memKey, {
      payload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.STAFF_DRAFT,
    resourceKey: 'active_draft',
    payload,
    isSynthetic: true,
  });

  return { success: true, savedAt: payload.savedAt };
}

/**
 * Retrieves saved Staff creation draft.
 */
export async function getStaffDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.STAFF_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey && _hospitalAdminSessionMemoryCache.has(memKey)) {
    return _hospitalAdminSessionMemoryCache.get(memKey).payload;
  }

  try {
    const dbEntry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.STAFF_DRAFT,
      resourceKey: 'active_draft',
    });
    if (dbEntry.found && dbEntry.payload) {
      if (memKey) {
        _hospitalAdminSessionMemoryCache.set(memKey, {
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
 * Clears saved Staff draft.
 */
export async function clearStaffDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.STAFF_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey) {
    _hospitalAdminSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.STAFF_DRAFT,
      resourceKey: 'active_draft',
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Saves Inventory item form as local draft.
 */
export async function saveInventoryDraftWithOffline(draftData) {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) throw new Error(`[OfflineHospitalAdminService] Authentication required: ${authCtx.reason}`);
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
    resourceKey: 'active_draft',
  });

  const payload = { ...draftData, savedAt: Date.now() };

  if (memKey) {
    _hospitalAdminSessionMemoryCache.set(memKey, {
      payload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
    resourceKey: 'active_draft',
    payload,
    isSynthetic: true,
  });

  return { success: true, savedAt: payload.savedAt };
}

/**
 * Retrieves saved Inventory item draft.
 */
export async function getInventoryDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey && _hospitalAdminSessionMemoryCache.has(memKey)) {
    return _hospitalAdminSessionMemoryCache.get(memKey).payload;
  }

  try {
    const dbEntry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
      resourceKey: 'active_draft',
    });
    if (dbEntry.found && dbEntry.payload) {
      if (memKey) {
        _hospitalAdminSessionMemoryCache.set(memKey, {
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
 * Clears saved Inventory draft.
 */
export async function clearInventoryDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey) {
    _hospitalAdminSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.INVENTORY_DRAFT,
      resourceKey: 'active_draft',
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Saves Bed creation/edit form as local draft.
 */
export async function saveBedDraftWithOffline(draftData) {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) throw new Error(`[OfflineHospitalAdminService] Authentication required: ${authCtx.reason}`);
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.BED_DRAFT,
    resourceKey: 'active_draft',
  });

  const payload = { ...draftData, savedAt: Date.now() };

  if (memKey) {
    _hospitalAdminSessionMemoryCache.set(memKey, {
      payload,
      lastFetchedAt: Date.now(),
      tenantId,
      userId,
    });
  }

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.BED_DRAFT,
    resourceKey: 'active_draft',
    payload,
    isSynthetic: true,
  });

  return { success: true, savedAt: payload.savedAt };
}

/**
 * Retrieves saved Bed draft.
 */
export async function getBedDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.BED_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey && _hospitalAdminSessionMemoryCache.has(memKey)) {
    return _hospitalAdminSessionMemoryCache.get(memKey).payload;
  }

  try {
    const dbEntry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.BED_DRAFT,
      resourceKey: 'active_draft',
    });
    if (dbEntry.found && dbEntry.payload) {
      if (memKey) {
        _hospitalAdminSessionMemoryCache.set(memKey, {
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
 * Clears saved Bed draft.
 */
export async function clearBedDraftWithOffline() {
  const authCtx = await getHospitalAdminAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildHospitalAdminCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.BED_DRAFT,
    resourceKey: 'active_draft',
  });

  if (memKey) {
    _hospitalAdminSessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.BED_DRAFT,
      resourceKey: 'active_draft',
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

// ── Consequential Actions Safety Gate ─────────────────────────────────────────

/**
 * Strictly blocks consequential actions while offline.
 * Returns { allowed: true } when online.
 * Throws or returns { allowed: false, message: ... } when offline.
 */
export async function assertHospitalAdminActionAllowed(actionName) {
  const isOnline = await checkOnlineStatus();
  if (isOnline) {
    return { allowed: true };
  }

  let message = `Action Blocked (${actionName}): This administrative operation requires an active server connection to maintain security parity and data integrity.`;

  switch (actionName) {
    case 'CREATE_STAFF':
    case 'UPDATE_STAFF':
    case 'DELETE_STAFF':
      message = 'Action Blocked (Offline): Creating, updating, or deleting staff credentials requires an authoritative server check to enforce role boundaries and tenant permissions.';
      break;
    case 'MANAGE_UPI':
      message = 'Action Blocked (Offline): Configuring department UPI collection endpoints requires live server verification to safeguard financial routing.';
      break;
    case 'MANAGE_INVENTORY':
      message = 'Action Blocked (Offline): Creating or modifying medication/inventory items requires online synchronization to prevent stock ledger drift.';
      break;
    case 'MANAGE_LAB_PRICE':
      message = 'Action Blocked (Offline): Updating lab test pricing catalogs requires live verification across all diagnostic departments.';
      break;
    case 'MANAGE_BEDS':
      message = 'Action Blocked (Offline): Bed creation, modification, or deletion requires live connectivity to prevent bed double-allocation.';
      break;
    case 'VIAL_MUTATION':
      message = 'Action Blocked (Offline): Biological sample storage, movement, retrieval, or disposal requires synchronized chain-of-custody tracking on the central server.';
      break;
    case 'AUTHORIZE_REFUND':
    case 'REJECT_REFUND':
      message = 'Action Blocked (Offline): Approving or rejecting refund requests modifies financial ledgers and must be processed authoritatively online.';
      break;
    case 'PROCESS_PAYMENT':
    case 'ADD_FACILITY_CHARGE':
      message = 'Action Blocked (Offline): Processing payments and recording patient facility charges requires live financial ledger synchronization.';
      break;
    case 'UPDATE_PROFILE':
      message = 'Action Blocked (Offline): Profile updates require an active server connection to synchronize personal health records.';
      break;
  }

  return { allowed: false, message };
}
