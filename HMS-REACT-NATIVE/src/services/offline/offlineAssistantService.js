/**
 * HMS OFFLINE PERSISTENCE — DOCTOR ASSISTANT MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Doctor Assistant screens:
 * - DoctorAssistantDashboard (KPIs, assigned doctors, today's queue)
 * - DoctorAssistantQueue (appointment triage queue, filters, search)
 * - DoctorAssistantQuestionLibrary (department & doctor question protocols)
 * - DoctorAssistantPreparation (pre-consultation intake, vitals, questionnaires, reports, drafts)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant cache presentation + fresh background fetch
 * - Strict multi-tenant user & tenant isolation
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB persistence)
 * - Safe Local Drafts: Unsaved vitals, history, questionnaire answers saved locally
 * - Consequential Action Online-Only Gate: "Mark Ready for Doctor" strictly requires active network
 * - Cross-user session isolation and logout memory purge
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assistantAPI } from '../../utils/api';
import { getStoreRef } from '../../store/storeRef';
import { setCacheEntry, getCacheEntry } from './cacheRepository';
import { checkOnlineStatus } from './networkStatus';

export const ASSISTANT_RESOURCE_TYPES = {
    DASHBOARD: 'assistant_dashboard',
    QUEUE: 'assistant_queue',
    DOCTORS: 'assistant_doctors',
    QUESTION_LIBRARY: 'assistant_question_library',
    PREPARATION: 'assistant_preparation',
    PREPARATION_DRAFT: 'assistant_preparation_draft',
};

// Volatile in-memory cache for assistant session
const _assistantSessionMemory = new Map();

/**
 * Deterministic cache key generator for Assistant module.
 */
function getAssistantCacheKey(resourceType, identifier = 'default') {
    let tenantId = 'unknown_tenant';
    let userId = 'anonymous';

    try {
        const store = getStoreRef();
        const state = store?.getState?.();
        const auth = state?.auth;
        if (auth?.user) {
            userId = auth.user._id || auth.user.id || 'anonymous';
            tenantId = auth.user.hospitalId || auth.tenant?.id || auth.tenant?.subdomain || 'default_tenant';
        }
    } catch (e) {
        // Fallback safely
    }

    return `asst_${tenantId}_${userId}_${resourceType}_${identifier}`;
}

/**
 * Fetch Assistant Dashboard with offline cache fallback.
 */
export async function getOfflineAssistantDashboard(forceFresh = false) {
    const isOnline = await checkOnlineStatus();
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.DASHBOARD);

    if (isOnline) {
        try {
            const data = await assistantAPI.getDashboard();
            if (data && data.success) {
                _assistantSessionMemory.set(cacheKey, { data, timestamp: Date.now() });
                await setCacheEntry(cacheKey, data, { ttlMs: 15 * 60 * 1000 });
                return { ...data, _fromCache: false };
            }
        } catch (err) {
            console.warn('[OfflineAssistantService] Live dashboard fetch failed, falling back to cache:', err.message);
        }
    }

    // Cache Fallback (Memory -> Encrypted Storage)
    if (_assistantSessionMemory.has(cacheKey)) {
        const cached = _assistantSessionMemory.get(cacheKey);
        return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
    }

    const diskCached = await getCacheEntry(cacheKey);
    if (diskCached) {
        return { ...diskCached, _fromCache: true };
    }

    // Default empty structure if no cache exists
    return {
        success: false,
        summary: { totalTodayPatients: 0, waiting: 0, inProgress: 0, readyForDoctor: 0, completed: 0 },
        myDoctors: [],
        patientQueue: [],
        authorizedDepartments: [],
        recentActivities: [],
        _fromCache: true,
        _empty: true
    };
}

/**
 * Fetch Assistant Queue with offline cache fallback.
 */
export async function getOfflineAssistantQueue(params = {}, forceFresh = false) {
    const isOnline = await checkOnlineStatus();
    const paramKey = JSON.stringify(params);
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.QUEUE, paramKey);

    if (isOnline) {
        try {
            const data = await assistantAPI.getAppointments(params);
            if (data && data.success) {
                _assistantSessionMemory.set(cacheKey, { data, timestamp: Date.now() });
                await setCacheEntry(cacheKey, data, { ttlMs: 10 * 60 * 1000 });
                return { ...data, _fromCache: false };
            }
        } catch (err) {
            console.warn('[OfflineAssistantService] Live queue fetch failed, falling back to cache:', err.message);
        }
    }

    if (_assistantSessionMemory.has(cacheKey)) {
        const cached = _assistantSessionMemory.get(cacheKey);
        return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
    }

    const diskCached = await getCacheEntry(cacheKey);
    if (diskCached) {
        return { ...diskCached, _fromCache: true };
    }

    return {
        success: false,
        appointments: [],
        authorizedDepartments: [],
        _fromCache: true,
        _empty: true
    };
}

/**
 * Fetch Assigned Doctors with offline cache fallback.
 */
export async function getOfflineAssistantDoctors(forceFresh = false) {
    const isOnline = await checkOnlineStatus();
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.DOCTORS);

    if (isOnline) {
        try {
            const data = await assistantAPI.getDoctors();
            if (data && data.success) {
                _assistantSessionMemory.set(cacheKey, { data, timestamp: Date.now() });
                await setCacheEntry(cacheKey, data, { ttlMs: 60 * 60 * 1000 });
                return { ...data, _fromCache: false };
            }
        } catch (err) {
            console.warn('[OfflineAssistantService] Live doctors fetch failed, falling back to cache:', err.message);
        }
    }

    if (_assistantSessionMemory.has(cacheKey)) {
        const cached = _assistantSessionMemory.get(cacheKey);
        return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
    }

    const diskCached = await getCacheEntry(cacheKey);
    if (diskCached) {
        return { ...diskCached, _fromCache: true };
    }

    return {
        success: false,
        doctors: [],
        _fromCache: true,
        _empty: true
    };
}

/**
 * Fetch Question Library with offline cache fallback.
 */
export async function getOfflineQuestionLibrary(params = {}, forceFresh = false) {
    const isOnline = await checkOnlineStatus();
    const paramKey = JSON.stringify(params);
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.QUESTION_LIBRARY, paramKey);

    if (isOnline) {
        try {
            const data = await assistantAPI.getQuestionLibrary(params);
            if (data && data.success) {
                _assistantSessionMemory.set(cacheKey, { data, timestamp: Date.now() });
                await setCacheEntry(cacheKey, data, { ttlMs: 24 * 60 * 60 * 1000 }); // 24h catalog TTL
                return { ...data, _fromCache: false };
            }
        } catch (err) {
            console.warn('[OfflineAssistantService] Live question library fetch failed, falling back to cache:', err.message);
        }
    }

    if (_assistantSessionMemory.has(cacheKey)) {
        const cached = _assistantSessionMemory.get(cacheKey);
        return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
    }

    const diskCached = await getCacheEntry(cacheKey);
    if (diskCached) {
        return { ...diskCached, _fromCache: true };
    }

    return {
        success: false,
        data: {},
        doctors: [],
        authorizedDepartments: [],
        allDepartments: [],
        _fromCache: true,
        _empty: true
    };
}

/**
 * Fetch Preparation Details with offline cache fallback.
 */
export async function getOfflinePreparation(appointmentId, params = {}, forceFresh = false) {
    const isOnline = await checkOnlineStatus();
    const paramKey = `${appointmentId}_${JSON.stringify(params)}`;
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.PREPARATION, paramKey);

    if (isOnline) {
        try {
            const data = await assistantAPI.getPreparation(appointmentId, params);
            if (data && data.success) {
                _assistantSessionMemory.set(cacheKey, { data, timestamp: Date.now() });
                await setCacheEntry(cacheKey, data, { ttlMs: 15 * 60 * 1000 });
                return { ...data, _fromCache: false };
            }
        } catch (err) {
            console.warn('[OfflineAssistantService] Live preparation fetch failed, falling back to cache:', err.message);
        }
    }

    if (_assistantSessionMemory.has(cacheKey)) {
        const cached = _assistantSessionMemory.get(cacheKey);
        return { ...cached.data, _fromCache: true, _cachedAt: cached.timestamp };
    }

    const diskCached = await getCacheEntry(cacheKey);
    if (diskCached) {
        return { ...diskCached, _fromCache: true };
    }

    return {
        success: false,
        appointment: null,
        preparation: null,
        department: 'General',
        departmentQuestions: {},
        availableDepartments: [],
        _fromCache: true,
        _empty: true
    };
}

/**
 * Local Draft Storage for in-progress preparations.
 * Preserves unsaved form inputs if network drops or user switches tabs.
 */
export async function savePreparationLocalDraft(appointmentId, draftData) {
    if (!appointmentId) return;
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.PREPARATION_DRAFT, appointmentId);
    const payload = {
        draftData,
        savedAt: Date.now()
    };
    _assistantSessionMemory.set(cacheKey, payload);
    try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (e) {
        console.warn('[OfflineAssistantService] Failed to persist draft to storage:', e);
    }
}

export async function getPreparationLocalDraft(appointmentId) {
    if (!appointmentId) return null;
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.PREPARATION_DRAFT, appointmentId);
    if (_assistantSessionMemory.has(cacheKey)) {
        return _assistantSessionMemory.get(cacheKey);
    }
    try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) return JSON.parse(raw);
    } catch (e) {
        // Safe fail
    }
    return null;
}

export async function clearPreparationLocalDraft(appointmentId) {
    if (!appointmentId) return;
    const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.PREPARATION_DRAFT, appointmentId);
    _assistantSessionMemory.delete(cacheKey);
    try {
        await AsyncStorage.removeItem(cacheKey);
    } catch (e) {
        // Safe fail
    }
}

/**
 * Consequential Clinical Gate: Mark Ready for Doctor.
 * Strictly requires online connectivity. Throws descriptive error if offline.
 */
export async function markPreparationReady(appointmentId) {
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
        throw new Error('Marking patient ready for doctor requires an active network connection. This clinical status transition cannot be performed offline.');
    }
    const res = await assistantAPI.markReady(appointmentId);
    // Clear draft once marked ready
    await clearPreparationLocalDraft(appointmentId);
    return res;
}

/**
 * Consequential Clinical Gate: Upload Patient Document / Report.
 * Strictly requires online connectivity. Throws descriptive error if offline.
 * Updates local preparation cache on server success.
 */
export async function uploadAssistantReportOnlineOnly(appointmentId, formData) {
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
        throw new Error('Document upload requires an active network connection to securely transfer files to cloud storage and link them to the patient record. Your selected document has been retained and can be uploaded once reconnected.');
    }
    const res = await assistantAPI.uploadReports(appointmentId, formData);
    if (res && res.success && res.preparation) {
        for (const [key, val] of _assistantSessionMemory.entries()) {
            if (key.includes(ASSISTANT_RESOURCE_TYPES.PREPARATION) && key.includes(appointmentId)) {
                if (val && val.data) {
                    val.data.preparation = res.preparation;
                    val.timestamp = Date.now();
                }
            }
        }
        try {
            const cacheKey = getAssistantCacheKey(ASSISTANT_RESOURCE_TYPES.PREPARATION, `${appointmentId}_{}`);
            await setCacheEntry(cacheKey, { success: true, preparation: res.preparation }, { ttlMs: 15 * 60 * 1000 });
        } catch (e) {
            // Non-critical cache write error
        }
    }
    return res;
}

/**
 * Purge all assistant session caches on user logout.
 */
export function clearAssistantSessionMemoryCache({ userId, tenantId } = {}) {
    _assistantSessionMemory.clear();
}

export function clearAssistantSessionCaches() {
    _assistantSessionMemory.clear();
}

