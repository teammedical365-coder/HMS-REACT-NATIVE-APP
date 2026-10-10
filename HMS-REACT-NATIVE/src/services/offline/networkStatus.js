/**
 * HMS OFFLINE NETWORK STATUS MONITOR
 * 
 * Uses @react-native-community/netinfo to monitor connectivity.
 * Correctly handles null / unknown connectivity states rather than
 * naively assuming device is always online or offline.
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { baseURL } from '../../utils/api';

const initialOnline = (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') 
  ? navigator.onLine 
  : true;

let _currentState = {
  isConnected: initialOnline,
  isInternetReachable: initialOnline,
  type: Platform.OS === 'web' ? 'unknown' : 'unknown',
  isOnline: initialOnline,
};

let _lastOnlineTime = initialOnline ? Date.now() : null;
let _wasOffline = false;
const _listeners = new Set();
const PING_TIMEOUT_MS = 6000;

function updateOnlineState(newIsOnline, details = {}) {
  const previousOnline = _currentState.isOnline;
  const isTransition = previousOnline !== newIsOnline;
  const wasOffline = !previousOnline;

  if (newIsOnline) {
    _lastOnlineTime = Date.now();
  }

  const newState = {
    ..._currentState,
    ...details,
    isConnected: details.isConnected ?? newIsOnline,
    isInternetReachable: details.isInternetReachable ?? newIsOnline,
    isOnline: newIsOnline,
  };

  const stateChanged = isTransition ||
    newState.isConnected !== _currentState.isConnected ||
    newState.isInternetReachable !== _currentState.isInternetReachable;

  if (!stateChanged) {
    return;
  }

  _currentState = newState;
  _wasOffline = wasOffline;

  // Crucial: Only notify subscribers when there is an actual online/offline transition!
  if (isTransition) {
    for (const listener of _listeners) {
      try {
        listener(_currentState, { wasOffline, lastOnlineTime: _lastOnlineTime });
      } catch (e) {
        console.warn('[NetworkStatus] Error in listener callback:', e.message);
      }
    }
  }
}

// Initialize NetInfo global listener
NetInfo.addEventListener((state) => {
  const isConnected = state.isConnected;
  const isInternetReachable = state.isInternetReachable;

  let isOnline = true;
  if (isConnected === false || isInternetReachable === false) {
    isOnline = false;
  } else if (isConnected === true && isInternetReachable === true) {
    isOnline = true;
  } else if (isConnected === null && isInternetReachable === null) {
    isOnline = _currentState.isOnline;
  }

  updateOnlineState(isOnline, {
    isConnected,
    isInternetReachable,
    type: state.type,
  });
});

// Attach Web window event listeners for instantaneous browser dev detection
if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => {
    updateOnlineState(true, {
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
    });
    pingServer().catch(() => {});
  });

  window.addEventListener('offline', () => {
    updateOnlineState(false, {
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
    });
  });
}

/**
 * Synchronous read of current cached network state.
 */
export function getNetworkState() {
  return { ..._currentState };
}

/**
 * Synchronous boolean read of online status.
 */
export function isOnline() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return _currentState.isOnline;
}

/**
 * Server health ping check with AbortController timeout.
 */
export async function pingServer() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && navigator.onLine === false) {
    updateOnlineState(false);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const pingUrl = `${baseURL}/api/public/auth-config`;
    await fetch(pingUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'X-Offline-Ping': '1' },
    });

    clearTimeout(timeoutId);
    updateOnlineState(true);
    return true;
  } catch (err) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (typeof navigator.onLine !== 'boolean' || navigator.onLine === true)) {
      updateOnlineState(true);
      return true;
    }
    updateOnlineState(false);
    return false;
  }
}

/**
 * Asynchronous fresh check of network status.
 */
export async function checkOnlineStatus() {
  // Web-first check: if browser explicitly reports navigator.onLine is false, trust it immediately
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    if (!navigator.onLine) {
      updateOnlineState(false, {
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
      });
      return false;
    }
  }

  try {
    const state = await NetInfo.fetch();
    const isConnected = state.isConnected;
    const isInternetReachable = state.isInternetReachable;

    let online = true;
    if (isConnected === false || isInternetReachable === false) {
      online = false;
    } else if (isConnected === true && isInternetReachable === true) {
      online = true;
    } else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      online = navigator.onLine;
    }

    updateOnlineState(online, {
      isConnected: online,
      isInternetReachable: online,
      type: state.type || (online ? 'wifi' : 'none'),
    });

    return online;
  } catch (err) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    console.warn('[NetworkStatus] NetInfo.fetch failed:', err.message);
    return _currentState.isOnline;
  }
}

/**
 * Subscribe to connectivity changes.
 * Supports both signatures:
 * - (netState) => netState.isOnline
 * - (isNetOnline, { wasOffline, lastOnlineTime }) => ...
 * 
 * @param {Function} callback
 * @returns {Function} unsubscribe function
 */
export function subscribeNetworkStatus(callback) {
  _listeners.add(callback);
  // Immediately call with current state
  try {
    callback({ ..._currentState }, { wasOffline: _wasOffline, lastOnlineTime: _lastOnlineTime, isOnline: _currentState.isOnline });
  } catch (e) {}

  return () => {
    _listeners.delete(callback);
  };
}

/**
 * React Hook for screens and components.
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState(() => ({ ..._currentState }));

  useEffect(() => {
    // Initial fetch to ensure up-to-date state
    checkOnlineStatus().then(() => {
      setStatus({ ..._currentState });
    });

    const unsubscribe = subscribeNetworkStatus((latest) => {
      setStatus(latest);
    });

    return unsubscribe;
  }, []);

  return status;
}

export default {
  getNetworkState,
  isOnline,
  pingServer,
  checkOnlineStatus,
  subscribeNetworkStatus,
  useNetworkStatus,
};
