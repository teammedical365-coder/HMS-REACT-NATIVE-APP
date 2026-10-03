/**
 * networkStatus.js — Reactive Online/Offline Connectivity Detection for React Native HMS
 * Uses browser navigator.onLine and window online/offline events on Web,
 * alongside periodic health ping checks against API server via native fetch and AbortController.
 */

import { Platform } from 'react-native';
import { baseURL } from './api';

let currentStatus = (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') ? navigator.onLine : true;
let lastOnlineTime = currentStatus ? Date.now() : null;
let pingIntervalId = null;
const listeners = new Set();
let webListenersAttached = false;

const PING_INTERVAL_MS = 30000;
const PING_INTERVAL_OFFLINE_MS = 10000;
const PING_TIMEOUT_MS = 6000;

function notifyListeners(online) {
  if (online === currentStatus) return;

  const wasOffline = !currentStatus;
  currentStatus = online;

  if (online) {
    lastOnlineTime = Date.now();
  }

  for (const callback of listeners) {
    try {
      callback(online, { wasOffline, lastOnlineTime });
    } catch (err) {
      console.error('[NetworkStatus] Listener error:', err);
    }
  }

  restartPing();
}

function attachWebListeners() {
  if (Platform.OS !== 'web') return;
  if (webListenersAttached || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  webListenersAttached = true;

  try {
    window.addEventListener('online', () => {
      notifyListeners(true);
      pingServer();
    });

    window.addEventListener('offline', () => {
      notifyListeners(false);
    });
  } catch (err) {
    console.warn('[NetworkStatus] Failed to attach web listeners:', err);
  }
}

export async function pingServer() {
  // If browser natively indicates offline (explicit false), trust it immediately
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && navigator.onLine === false) {
    notifyListeners(false);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    const pingUrl = `${baseURL}/api/public/auth-config`;
    const response = await fetch(pingUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'X-Offline-Ping': '1' }
    });

    clearTimeout(timeoutId);

    // Any HTTP response (2xx, 3xx, 4xx, 5xx) proves network connectivity to server is operational
    // Ordinary HTTP 500, 502, 503, 504, 401, 403, 404 is an API/server issue, NOT an offline internet drop
    notifyListeners(true);
    return true;
  } catch {
    // If on web and the browser has active internet (navigator.onLine === true),
    // a ping failure is a backend downtime/CORS issue, NOT an offline state!
    if (Platform.OS === 'web' && (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine === true)) {
      notifyListeners(true);
      return true;
    }
    notifyListeners(false);
    return false;
  }
}

function restartPing() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
  }
  const interval = currentStatus ? PING_INTERVAL_MS : PING_INTERVAL_OFFLINE_MS;
  pingIntervalId = setInterval(pingServer, interval);
}

export function isOnline() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return currentStatus;
}

export function subscribeNetworkStatus(callback) {
  if (Platform.OS === 'web') {
    attachWebListeners();
  }
  listeners.add(callback);

  const initialOnline = (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
    ? navigator.onLine
    : currentStatus;
  callback(initialOnline, { wasOffline: false, lastOnlineTime });

  if (!pingIntervalId) {
    restartPing();
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && pingIntervalId) {
      clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  };
}

// Attach web listeners immediately if running in web environment
if (Platform.OS === 'web') {
  attachWebListeners();
}

// Initial probe
pingServer();
