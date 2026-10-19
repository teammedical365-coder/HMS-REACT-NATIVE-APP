/**
 * offlineReduxBridge.js — Connects SQLite Offline Queue and Network Status to Redux
 *
 * Provides bidirectional synchronization between:
 * 1. Persistent SQLite offline_outbox queue events (enqueued, syncing, synced, failed, removed, cleared)
 * 2. NetInfo / networkStatus connectivity transitions (online / offline)
 * 3. Redux offlineSlice state (isOnline, pendingCount, syncStatus, syncProgress, syncErrors, lastSyncAt)
 * 
 * Ensures:
 * - Single source of truth (SQLite persistence + volatile RAM queue)
 * - Safe hydration on startup and user authentication
 * - Multi-tenant isolation (queue count strictly partitioned by user & tenant)
 * - Zero duplicated listeners, loops, or memory leaks
 */

import {
  setOnlineStatus,
  setSyncStatus,
  setPendingCount,
  setSyncProgress,
  setSyncComplete,
  setSyncError,
  resetSyncStatus,
  resetOfflineState,
} from '../../store/slices/offlineSlice';
import {
  subscribeQueueEvents,
  countPendingOperations,
  getPendingOperations,
} from './offlineQueue';
import {
  subscribeNetworkStatus,
  isOnline as checkIsOnline,
} from './networkStatus';

let _bridgeInitialized = false;
let _unsubscribeNetwork = null;
let _unsubscribeQueue = null;

/**
 * Resolves current active tenant and user coordinates from Redux state.
 */
function getActiveAuthCoordinates(store) {
  try {
    const authState = store.getState()?.auth;
    const user = authState?.user;
    if (!user) return { tenantId: null, userId: null };

    const tenantId = user.hospitalId?._id || user.hospitalId || user.tenantId || null;
    const userId = user._id || user.userId || user.id || null;
    return {
      tenantId: tenantId ? String(tenantId) : null,
      userId: userId ? String(userId) : null,
    };
  } catch (err) {
    return { tenantId: null, userId: null };
  }
}

/**
 * Asynchronously recalculates and hydrates pending count for the current logged-in user.
 */
export async function refreshQueueCount(store) {
  if (!store) return;
  const { tenantId, userId } = getActiveAuthCoordinates(store);

  if (!tenantId || !userId) {
    store.dispatch(setPendingCount(0));
    return;
  }

  try {
    const count = await countPendingOperations({ tenantId, userId });
    store.dispatch(setPendingCount(count));
  } catch (err) {
    console.warn('[OfflineReduxBridge] Failed to count pending operations:', err.message);
  }
}

/**
 * Initializes the Offline-to-Redux bridge with the active Redux store.
 * Safe to call multiple times (idempotent).
 * 
 * @param {Object} store - Redux store instance
 */
export function initOfflineReduxBridge(store) {
  if (!store || _bridgeInitialized) return;
  _bridgeInitialized = true;

  // 1. Initial connectivity synchronization
  const initialOnline = checkIsOnline();
  store.dispatch(setOnlineStatus(initialOnline));

  // 2. Subscribe to NetworkStatus transitions
  _unsubscribeNetwork = subscribeNetworkStatus((netState) => {
    const online = typeof netState === 'boolean'
      ? netState
      : (typeof netState?.isOnline === 'boolean' ? netState.isOnline : true);

    store.dispatch(setOnlineStatus(online));

    // When transitioning online, refresh pending count
    if (online) {
      refreshQueueCount(store).catch(() => {});
    }
  });

  // 3. Subscribe to SQLite Offline Queue lifecycle events
  _unsubscribeQueue = subscribeQueueEvents(async (eventType, data) => {
    const { tenantId, userId } = getActiveAuthCoordinates(store);

    switch (eventType) {
      case 'item_enqueued': {
        // Only increment / update count if this item belongs to current active user/tenant
        const eventTenant = data?.tenantId ? String(data.tenantId) : null;
        const eventUser = data?.userId ? String(data.userId) : null;

        if (tenantId && userId && (!eventTenant || eventTenant === tenantId) && (!eventUser || eventUser === userId)) {
          await refreshQueueCount(store);
        }
        break;
      }

      case 'item_syncing': {
        store.dispatch(setSyncStatus('syncing'));
        if (data?.progress) {
          store.dispatch(setSyncProgress(data.progress));
        }
        break;
      }

      case 'item_synced':
      case 'item_removed': {
        await refreshQueueCount(store);
        const currentPending = store.getState()?.offline?.pendingCount || 0;
        if (currentPending === 0) {
          store.dispatch(setSyncComplete({
            succeeded: 1,
            failed: 0,
            errors: [],
            remainingCount: 0,
          }));
          setTimeout(() => {
            if (store.getState()?.offline?.syncStatus === 'complete') {
              store.dispatch(resetSyncStatus());
            }
          }, 3000);
        }
        break;
      }

      case 'item_failed': {
        store.dispatch(setSyncError({
          message: data?.error || 'Queue item failed to synchronize',
          operationId: data?.operationId,
        }));
        await refreshQueueCount(store);
        break;
      }

      case 'queue_cleared': {
        store.dispatch(setPendingCount(0));
        store.dispatch(resetSyncStatus());
        break;
      }

      default:
        break;
    }
  });

  // 4. Initial hydration from SQLite queue
  refreshQueueCount(store).catch(() => {});
}

/**
 * Hydrates offline state when user logs in or switches account.
 * 
 * @param {Object} store
 */
export async function hydrateOfflineQueueState(store) {
  if (!store) return;
  const initialOnline = checkIsOnline();
  store.dispatch(setOnlineStatus(initialOnline));
  await refreshQueueCount(store);
}

/**
 * Teardown bridge listeners (useful in testing or reset).
 */
export function destroyOfflineReduxBridge() {
  if (_unsubscribeNetwork) {
    _unsubscribeNetwork();
    _unsubscribeNetwork = null;
  }
  if (_unsubscribeQueue) {
    _unsubscribeQueue();
    _unsubscribeQueue = null;
  }
  _bridgeInitialized = false;
}

export default {
  initOfflineReduxBridge,
  hydrateOfflineQueueState,
  refreshQueueCount,
  destroyOfflineReduxBridge,
};
