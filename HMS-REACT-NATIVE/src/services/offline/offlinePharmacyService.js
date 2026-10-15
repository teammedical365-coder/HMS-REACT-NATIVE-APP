/**
 * HMS OFFLINE PERSISTENCE — PHARMACY MODULE SERVICE
 *
 * Comprehensive offline-aware data service for Pharmacy screens:
 * - PharmacyInventory (medicine catalog, search, stock levels, batches, expiry dates, vendors, invoices)
 * - PharmacyOrders (prescriptions queue, order status, walk-in orders, dispensing preparation)
 * - PurchaseInvoiceHistory (supplier purchase orders, invoices archive)
 *
 * Core Guarantees:
 * - Stale-While-Revalidate: instant L1/L2 cache presentation + fresh background fetch
 * - Clear Stock Freshness Indicator: Cached inventory explicitly indicates last-verified timestamp;
 *   never represented as guaranteed live current stock while offline.
 * - Deterministic, multi-tenant user & tenant isolation (Never uses shared default identities)
 * - Security Gate enforcement: Clinical & pharmaceutical data persisted ONLY to verified SQLCipher storage
 * - Memory-only volatile cache on Web (zero plaintext localStorage/IndexedDB clinical persistence)
 * - Safe Offline Drafts: Dispense preparation & medicine entry saved as local drafts
 * - Strict Online-Only Safety Gates: Final dispensing, stock deduction, batch allocation, and financial
 *   payment transactions are strictly blocked offline to prevent stock desync and duplicate dispensing.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pharmacyAPI, pharmacyOrderAPI } from '../../utils/api';
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
  PHARMACY_INVENTORY: 'pharmacy_inventory',
  PHARMACY_ORDERS: 'pharmacy_orders',
  PHARMACY_VENDORS: 'pharmacy_vendors',
  PHARMACY_PURCHASE_INVOICES: 'pharmacy_purchase_invoices',
  PHARMACY_DEPARTMENTS: 'pharmacy_departments',
  PHARMACY_COLLECTIONS: 'pharmacy_collections',
  PHARMACY_DISPENSE_DRAFT: 'pharmacy_dispense_draft',
  PHARMACY_MEDICINE_DRAFT: 'pharmacy_medicine_draft',
};

// ── Volatile Pharmacy Session Memory Cache (RAM Only) ─────────────────────────
// Holds in-memory session records during active pharmacy session.
// Fails closed across restarts on web; wiped on user logout.
const _pharmacySessionMemoryCache = new Map();

/**
 * Deterministic cache key generator for Pharmacy module.
 * Strictly isolates by tenant, user, resource type, and resource key.
 */
export function buildPharmacyCacheKey({ tenantId, userId, resourceType, resourceKey = 'default' }) {
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
  return `pharma_mem::${normTenant}::${normUser}::${normResource}::${normKey}`;
}

/**
 * Clears volatile in-memory session caches for pharmacy module.
 * Scoped strictly to departing user/tenant coordinates.
 */
export function clearPharmacySessionMemoryCache({ tenantId = null, userId = null } = {}) {
  if (!tenantId && !userId) {
    _pharmacySessionMemoryCache.clear();
    return;
  }
  const normUser = userId ? String(userId).trim().toLowerCase() : null;
  const normTenant = tenantId ? String(tenantId).trim().toLowerCase() : null;

  for (const [key, entry] of _pharmacySessionMemoryCache.entries()) {
    const matchUser = !normUser || String(entry.userId || '').toLowerCase() === normUser;
    const matchTenant = !normTenant || String(entry.tenantId || '').toLowerCase() === normTenant;
    if (matchUser && matchTenant) {
      _pharmacySessionMemoryCache.delete(key);
    }
  }
}

// ── Identity & Context Resolution ─────────────────────────────────────────────
/**
 * Resolves current authenticated Pharmacy context deterministically.
 * Strictly requires stable, non-empty user identifier and valid tenant scope.
 * NEVER falls back to shared default identities like 'default_user' or 'default_tenant'.
 */
export async function getPharmacyAuthContext() {
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

// ── 1. Pharmacy Inventory & Stock Information (Offline Read) ──────────────────
/**
 * Fetches pharmacy medicine catalog & stock availability with offline SWR support.
 * Explicitly marks offline results with last-verified freshness metadata.
 */
export async function fetchPharmacyInventoryWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'inventory_catalog';

  // Helper to read from memory cache
  const readMem = (resourceType, key) => {
    const memKey = buildPharmacyCacheKey({ tenantId, userId, resourceType, resourceKey: key });
    if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
      return _pharmacySessionMemoryCache.get(memKey);
    }
    return null;
  };

  // Helper to write to memory cache
  const writeMem = (resourceType, key, payload, now = Date.now()) => {
    const memKey = buildPharmacyCacheKey({ tenantId, userId, resourceType, resourceKey: key });
    if (memKey) {
      _pharmacySessionMemoryCache.set(memKey, {
        payload,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }
  };

  // Step 1: Read Cached Data
  let cachedMedicines = null;
  let lastFetchedAt = null;

  try {
    const memEntry = readMem(RESOURCE_TYPES.PHARMACY_INVENTORY, resKey);
    if (memEntry && Array.isArray(memEntry.payload)) {
      cachedMedicines = memEntry.payload;
      lastFetchedAt = memEntry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_INVENTORY,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedMedicines = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedMedicines && typeof onCacheHit === 'function') {
      onCacheHit({
        medicines: cachedMedicines,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
        isStockFreshnessEstimate: true,
      });
    }
  } catch (e) {}

  // Step 2: Check Network
  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedMedicines) {
      return {
        success: true,
        medicines: cachedMedicines,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
        isStockFreshnessEstimate: true,
      };
    }
    throw new Error('Device is offline and no cached pharmacy inventory records are available.');
  }

  // Step 3: Fetch Fresh Online Data
  try {
    const response = await pharmacyAPI.getInventory();
    let freshMedicines = [];
    if (response && (response.success || Array.isArray(response) || response.medicines || response.inventory)) {
      const data = response.medicines || response.inventory || response.items || response.data || (Array.isArray(response) ? response : []);
      freshMedicines = Array.isArray(data) ? data : (cachedMedicines || []);
    } else {
      freshMedicines = cachedMedicines || [];
    }

    const now = Date.now();
    writeMem(RESOURCE_TYPES.PHARMACY_INVENTORY, resKey, freshMedicines, now);

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_INVENTORY,
        resourceKey: resKey,
        payload: freshMedicines,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      medicines: freshMedicines,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
      isStockFreshnessEstimate: false,
    };
  } catch (err) {
    if (cachedMedicines) {
      return {
        success: true,
        medicines: cachedMedicines,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
        isStockFreshnessEstimate: true,
      };
    }
    throw err;
  }
}

/**
 * Searches cached pharmacy inventory by medicine name, salt, category, rack location, or batch.
 */
export async function searchPharmacyInventoryWithOffline({ query = '' } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) return [];
  const { tenantId, userId } = authCtx;
  const resKey = 'inventory_catalog';

  let list = [];
  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_INVENTORY,
    resourceKey: resKey,
  });

  if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
    list = _pharmacySessionMemoryCache.get(memKey).payload || [];
  } else {
    try {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_INVENTORY,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        list = dbEntry.payload;
      }
    } catch (e) {}
  }

  const cleanQ = String(query).trim().toLowerCase();
  if (!cleanQ) return list;

  return list.filter((med) => {
    const nameMatch = (med.name || '').toLowerCase().includes(cleanQ);
    const saltMatch = (med.salt || '').toLowerCase().includes(cleanQ);
    const catMatch = (med.category || '').toLowerCase().includes(cleanQ);
    const rackMatch = (med.rackLocation || '').toLowerCase().includes(cleanQ);
    const batchMatch = (med.batchNumber || '').toLowerCase().includes(cleanQ);
    return nameMatch || saltMatch || catMatch || rackMatch || batchMatch;
  });
}

// ── 2. Pharmacy Orders & Prescription Queue (Offline Read) ────────────────────
/**
 * Fetches pharmacy orders with offline SWR support.
 */
export async function fetchPharmacyOrdersWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'orders_list';

  let cachedOrders = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_ORDERS,
      resourceKey: resKey,
    });
    if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
      const entry = _pharmacySessionMemoryCache.get(memKey);
      cachedOrders = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_ORDERS,
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
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached pharmacy orders are available.');
  }

  try {
    const res = await pharmacyOrderAPI.getOrders();
    const freshOrders = res && (res.success || Array.isArray(res) || res.orders)
      ? (res.orders || (Array.isArray(res) ? res : res.data || []))
      : (cachedOrders || []);

    const now = Date.now();

    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_ORDERS,
      resourceKey: resKey,
    });
    if (memKey) {
      _pharmacySessionMemoryCache.set(memKey, {
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
        resourceType: RESOURCE_TYPES.PHARMACY_ORDERS,
        resourceKey: resKey,
        payload: freshOrders,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      orders: freshOrders,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedOrders) {
      return {
        success: true,
        orders: cachedOrders,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 3. Pharmacy Vendors & Purchase Invoices (Offline Read) ─────────────────────
/**
 * Fetches vendor list with offline support.
 */
export async function fetchPharmacyVendorsWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'vendors_list';

  let cachedVendors = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_VENDORS,
      resourceKey: resKey,
    });
    if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
      const entry = _pharmacySessionMemoryCache.get(memKey);
      cachedVendors = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_VENDORS,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedVendors = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedVendors && typeof onCacheHit === 'function') {
      onCacheHit({
        vendors: cachedVendors,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedVendors) {
      return {
        success: true,
        vendors: cachedVendors,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached vendor records are available.');
  }

  try {
    const res = await pharmacyAPI.getVendors();
    const freshVendors = res && (res.success || Array.isArray(res))
      ? (res.data || (Array.isArray(res) ? res : []))
      : (cachedVendors || []);

    const now = Date.now();

    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_VENDORS,
      resourceKey: resKey,
    });
    if (memKey) {
      _pharmacySessionMemoryCache.set(memKey, {
        payload: freshVendors,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_VENDORS,
        resourceKey: resKey,
        payload: freshVendors,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      vendors: freshVendors,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedVendors) {
      return {
        success: true,
        vendors: cachedVendors,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

/**
 * Fetches purchase invoices history with offline support.
 */
export async function fetchPurchaseInvoicesWithOffline({ onCacheHit = null } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;
  const resKey = 'invoices_list';

  let cachedInvoices = null;
  let lastFetchedAt = null;

  try {
    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_PURCHASE_INVOICES,
      resourceKey: resKey,
    });
    if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
      const entry = _pharmacySessionMemoryCache.get(memKey);
      cachedInvoices = entry.payload;
      lastFetchedAt = entry.lastFetchedAt;
    } else {
      const dbEntry = await getCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_PURCHASE_INVOICES,
        resourceKey: resKey,
      });
      if (dbEntry.found && Array.isArray(dbEntry.payload)) {
        cachedInvoices = dbEntry.payload;
        lastFetchedAt = dbEntry.lastFetchedAt;
      }
    }

    if (cachedInvoices && typeof onCacheHit === 'function') {
      onCacheHit({
        invoices: cachedInvoices,
        fromCache: true,
        isOffline: false,
        lastFetchedAt,
      });
    }
  } catch (e) {}

  const isOnline = await checkOnlineStatus();

  if (!isOnline) {
    if (cachedInvoices) {
      return {
        success: true,
        invoices: cachedInvoices,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw new Error('Device is offline and no cached purchase invoices are available.');
  }

  try {
    const res = await pharmacyAPI.getPurchaseInvoices();
    const freshInvoices = res && (res.success || Array.isArray(res))
      ? (res.data || (Array.isArray(res) ? res : []))
      : (cachedInvoices || []);

    const now = Date.now();

    const memKey = buildPharmacyCacheKey({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_PURCHASE_INVOICES,
      resourceKey: resKey,
    });
    if (memKey) {
      _pharmacySessionMemoryCache.set(memKey, {
        payload: freshInvoices,
        lastFetchedAt: now,
        tenantId,
        userId,
      });
    }

    try {
      await setCacheEntry({
        tenantId,
        userId,
        resourceType: RESOURCE_TYPES.PHARMACY_PURCHASE_INVOICES,
        resourceKey: resKey,
        payload: freshInvoices,
        isSynthetic: false,
      });
    } catch (e) {}

    return {
      success: true,
      invoices: freshInvoices,
      fromCache: false,
      isOffline: false,
      lastFetchedAt: now,
    };
  } catch (err) {
    if (cachedInvoices) {
      return {
        success: true,
        invoices: cachedInvoices,
        fromCache: true,
        isOffline: true,
        lastFetchedAt,
      };
    }
    throw err;
  }
}

// ── 4. Safe Offline Drafts: Dispense Preparation & Medicine Intake ────────────
/**
 * Saves a local draft for walk-in order preparation or pending medication dispensing.
 * Explicitly labeled as a DRAFT. Does NOT commit any stock deduction or financial transaction.
 */
export async function saveDispenseDraftWithOffline({ draftKey = 'active_dispense', draftData } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    draftKey,
    ...draftData,
    savedAt: Date.now(),
    isDraft: true,
    isPendingSync: true,
  };

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _pharmacySessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Dispense preparation saved locally as a draft.',
    draft: draftPayload,
  };
}

/**
 * Retrieves the saved dispense preparation draft.
 */
export async function getDispenseDraft({ draftKey = 'active_dispense' } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
    return _pharmacySessionMemoryCache.get(memKey).payload;
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _pharmacySessionMemoryCache.set(memKey, {
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
 * Clears an active dispense preparation draft upon successful online creation.
 */
export async function clearDispenseDraft({ draftKey = 'active_dispense' } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _pharmacySessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_DISPENSE_DRAFT,
      resourceKey: draftKey,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

/**
 * Saves a local draft for adding a new medicine entry.
 */
export async function saveMedicineDraftWithOffline({ draftKey = 'new_medicine', draftData } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) {
    throw new Error(`[OfflinePharmacyService] Authentication required: ${authCtx.reason}`);
  }
  const { tenantId, userId } = authCtx;

  const draftPayload = {
    draftKey,
    ...draftData,
    savedAt: Date.now(),
    isDraft: true,
  };

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _pharmacySessionMemoryCache.set(memKey, {
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
      resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
      resourceKey: draftKey,
      payload: draftPayload,
      isSynthetic: false,
    });
  } catch (e) {}

  return {
    success: true,
    isDraft: true,
    message: 'Medicine details saved locally as a draft.',
    draft: draftPayload,
  };
}

/**
 * Retrieves the saved medicine intake draft.
 */
export async function getMedicineDraft({ draftKey = 'new_medicine' } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) return null;
  const { tenantId, userId } = authCtx;

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey && _pharmacySessionMemoryCache.has(memKey)) {
    return _pharmacySessionMemoryCache.get(memKey).payload;
  }

  try {
    const entry = await getCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
      resourceKey: draftKey,
    });
    if (entry.found && entry.payload) {
      if (memKey) {
        _pharmacySessionMemoryCache.set(memKey, {
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
 * Clears the medicine intake draft upon online submission.
 */
export async function clearMedicineDraft({ draftKey = 'new_medicine' } = {}) {
  const authCtx = await getPharmacyAuthContext();
  if (!authCtx.isValid) return;
  const { tenantId, userId } = authCtx;

  const memKey = buildPharmacyCacheKey({
    tenantId,
    userId,
    resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
    resourceKey: draftKey,
  });
  if (memKey) {
    _pharmacySessionMemoryCache.delete(memKey);
  }

  try {
    await setCacheEntry({
      tenantId,
      userId,
      resourceType: RESOURCE_TYPES.PHARMACY_MEDICINE_DRAFT,
      resourceKey: draftKey,
      payload: null,
      isSynthetic: false,
    });
  } catch (e) {}
}

// ── 5. Strict Online-Only Safety Gates ────────────────────────────────────────
/**
 * Final medication dispensing commits batch-specific stock deductions and financial transactions.
 * To avoid over-dispensing, dangerous double-allocations, or unverified ledger updates,
 * this operation is strictly online-only.
 */
export async function dispenseMedicationOnlineOnly(orderId, payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Medication dispensing and stock deduction require active server connectivity to prevent stock desync and duplicate dispensing. Your preparation has been retained as a Local Draft.'
    );
  }
  return await pharmacyOrderAPI.completeOrder(orderId, payload);
}

/**
 * Creating a finalized pharmacy order requires live server stock allocation.
 */
export async function createPharmacyOrderOnlineOnly(payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Order creation requires active server connectivity for invoice sequence allocation and live stock locking. Your order items are preserved in the Local Draft.'
    );
  }
  const res = await pharmacyOrderAPI.createOrder(payload);
  if (res && (res.success || res._id)) {
    try {
      await clearDispenseDraft({ draftKey: 'active_dispense' });
    } catch (e) {}
  }
  return res;
}

/**
 * Recording medicine stock consumption / wastage / adjustments is strictly online-only.
 */
export async function recordStockConsumptionOnlineOnly(payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Stock consumption and inventory adjustments require active server connectivity for audit logging and quantity integrity.'
    );
  }
  return await pharmacyAPI.recordConsumption(payload);
}

/**
 * Adding a verified medicine to official inventory requires online server validation.
 */
export async function addMedicineOnlineOnly(payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Adding a medicine to the hospital inventory requires active server connectivity. Form details have been saved as a Local Draft.'
    );
  }
  const res = await pharmacyAPI.addMedicine(payload);
  if (res && (res.success || res._id)) {
    try {
      await clearMedicineDraft({ draftKey: 'new_medicine' });
    } catch (e) {}
  }
  return res;
}

/**
 * Processing a purchase invoice and importing inventory requires live server ledger updates.
 */
export async function processPurchaseInvoiceOnlineOnly(invoiceId) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Processing purchase invoices requires active server connectivity to reconcile supplier records and update live stock.'
    );
  }
  return await pharmacyAPI.processPurchaseInvoice(invoiceId);
}

/**
 * Processing medicine returns requires online financial ledger updates.
 */
export async function processPharmacyReturnOnlineOnly(payload) {
  const isOnline = await checkOnlineStatus();
  if (!isOnline) {
    throw new Error(
      'Processing pharmacy returns requires active server connectivity for credit note generation and stock re-entry.'
    );
  }
  return await pharmacyOrderAPI.processReturn(payload);
}
