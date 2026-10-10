/**
 * HMS OFFLINE SERVICE — PILOT FOR DOCTOR APPOINTMENTS / PATIENT QUEUE
 * 
 * Implements Stale-While-Revalidate and Offline-Read for:
 * doctorAPI.getAppointments() and doctorAPI.getAllAppointments()
 * 
 * Adheres strictly to Phase 1 rules:
 * - Does NOT intercept global fetch/Axios
 * - Preserves existing API contracts & return types
 * - Enforces tenant/user partitioning
 * - Enforces Security Gate on persistence
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doctorAPI } from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';

const RESOURCE_TYPE = 'doctor_appointments';

/**
 * Resolves current authenticated tenant and user identifiers safely.
 */
export async function getAuthContext() {
  let user = null;
  const store = getStoreRef();
  if (store) {
    user = store.getState()?.auth?.user;
  }

  if (!user) {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) user = JSON.parse(userStr);
    } catch (e) {}
  }

  const tenantId = user?.hospitalId || user?.tenantId || user?.hospitalSlug || 'default_tenant';
  const userId = user?._id || user?.id || user?.email || 'default_user';

  return {
    tenantId: String(tenantId),
    userId: String(userId),
    role: (user?.role || '').toLowerCase(),
  };
}

/**
 * Fetch appointments with offline-read support.
 * 
 * 1. Reads and immediately provides cached data if present.
 * 2. Fetches fresh data over the network when online.
 * 3. Saves successful responses to the local cache.
 * 4. Falls back to cached data if network request fails.
 * 
 * @param {Object} options
 * @param {boolean} [options.hasViewAllAccess=false]
 * @param {Function} [options.onCacheHit] - Callback when cache is available immediately
 * @returns {Promise<{
 *   success: boolean,
 *   appointments: Array,
 *   fromCache: boolean,
 *   isOffline: boolean,
 *   lastFetchedAt: number | null,
 *   isSynthetic: boolean
 * }>}
 */
export async function fetchAppointmentsWithOffline({
  hasViewAllAccess = false,
  onCacheHit = null,
} = {}) {
  const { tenantId, userId } = await getAuthContext();
  const resourceKey = hasViewAllAccess ? 'all_appointments' : 'doctor_appointments';

  // ── Step 1: Read valid cached data ──────────────────────────────────────────
  let cachedData = null;
  try {
    const cacheResult = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPE,
      resourceKey,
    });

    if (cacheResult.found && Array.isArray(cacheResult.payload)) {
      cachedData = cacheResult;
      if (typeof onCacheHit === 'function') {
        onCacheHit({
          appointments: cacheResult.payload,
          lastFetchedAt: cacheResult.lastFetchedAt,
          isSynthetic: cacheResult.isSynthetic,
        });
      }
    }
  } catch (cacheReadErr) {
    console.warn('[OfflineDoctorService] Cache read error:', cacheReadErr.message);
  }

  // ── Step 2: Check Network Connectivity ──────────────────────────────────────
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedData) {
      console.log(`[OfflineDoctorService] Device is offline. Returning ${cachedData.payload.length} cached appointments.`);
      return {
        success: true,
        appointments: cachedData.payload,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic,
      };
    }
    // No cache and offline => throw network error for clear retry UI
    throw new Error('Device is offline and no cached appointment records are available.');
  }

  // ── Step 3: Fetch fresh data from existing service layer ───────────────────
  try {
    const res = hasViewAllAccess
      ? await doctorAPI.getAllAppointments()
      : await doctorAPI.getAppointments();

    const freshAppointments = (res && res.success && Array.isArray(res.appointments))
      ? res.appointments
      : (Array.isArray(res) ? res : []);

    // ── Step 4: Save to local persistence (via Security Gate) ─────────────────
    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPE,
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
      lastFetchedAt: Date.now(),
      isSynthetic: false,
    };
  } catch (networkErr) {
    console.warn('[OfflineDoctorService] Network request failed:', networkErr.message);

    // ── Step 5: If network fails, serve cache if available ────────────────────
    if (cachedData) {
      console.log(`[OfflineDoctorService] Network failed. Serving ${cachedData.payload.length} cached appointments.`);
      return {
        success: true,
        appointments: cachedData.payload,
        fromCache: true,
        isOffline: true,
        lastFetchedAt: cachedData.lastFetchedAt,
        isSynthetic: cachedData.isSynthetic,
      };
    }

    // No cache available; re-throw original error
    throw networkErr;
  }
}

/**
 * Seed synthetic appointments for offline verification when database
 * is running in unencrypted developer mode (satisfies Security Gate).
 */
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
    {
      _id: 'synth_appt_003',
      patientId: 'SYNTH-P-03',
      patientName: 'Rahul Varma (Synthetic Test Patient)',
      phone: '+91 98765 00003',
      age: 52,
      gender: 'Male',
      appointmentDate: `${todayStr}T11:00:00.000Z`,
      timeSlot: '11:00 AM',
      status: 'completed',
      department: 'Orthopedics',
      type: 'Consultation',
      reason: 'Post-op knee check (Synthetic Offline Pilot)',
      tokenNumber: 'A-103',
      isSynthetic: true,
    },
  ];

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPE,
    resourceKey: 'doctor_appointments',
    payload: syntheticList,
    isSynthetic: true,
  });

  await setCacheEntry({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPE,
    resourceKey: 'all_appointments',
    payload: syntheticList,
    isSynthetic: true,
  });

  console.log(`[OfflineDoctorService] Seeded ${syntheticList.length} synthetic appointments for testing.`);
  return syntheticList;
}

export default {
  getAuthContext,
  fetchAppointmentsWithOffline,
  seedSyntheticAppointmentsForTesting,
};
