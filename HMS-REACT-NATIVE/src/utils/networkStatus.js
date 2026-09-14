/**
 * networkStatus.js — Reactive Online/Offline Connectivity Detection for React Native HMS
 * Uses periodic health ping checks against API server via native fetch and AbortController.
 */

import { baseURL } from './api';

let currentStatus = true;
let lastOnlineTime = Date.now();
let pingIntervalId = null;
const listeners = new Set();

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

export async function pingServer() {
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

    if (response.ok) {
      notifyListeners(true);
      return true;
    } else {
      notifyListeners(false);
      return false;
    }
  } catch {
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
  return currentStatus;
}

export function subscribeNetworkStatus(callback) {
  listeners.add(callback);
  callback(currentStatus, { wasOffline: false, lastOnlineTime });

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

// Initial probe
pingServer();
