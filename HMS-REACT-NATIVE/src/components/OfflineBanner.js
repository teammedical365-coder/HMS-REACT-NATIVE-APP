import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { subscribeNetworkStatus, pingServer, isOnline as checkIsOnline } from '../services/offline/networkStatus';
import { setSyncStatus } from '../store/slices/offlineSlice';

function formatLastSynced(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null;
  
  const now = Date.now();
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `Today at ${hours}:${minutes}`;
}

export default function OfflineBanner({
  isOffline,
  fromCache,
  lastFetchedAt,
  isSynthetic,
  onRetry,
  onRefresh,
  retrying = false,
  customMessage,
  moduleName,
} = {}) {
  const dispatch = useDispatch();
  const reduxOffline = useSelector((state) => state?.offline);

  // If isOffline is explicitly provided as a prop, respect it; otherwise read Redux / NetInfo
  const isControlled = typeof isOffline === 'boolean';
  const reduxOnline = reduxOffline?.isOnline;
  const pendingCount = reduxOffline?.pendingCount || 0;
  const syncStatus = reduxOffline?.syncStatus || 'idle';
  const syncErrors = reduxOffline?.syncErrors || [];

  const [autoOnline, setAutoOnline] = useState(() => (typeof reduxOnline === 'boolean' ? reduxOnline : checkIsOnline()));
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectedTimerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((netState, meta = {}) => {
      const isOnlineVal = typeof netState === 'boolean'
        ? netState
        : (typeof netState?.isOnline === 'boolean' ? netState.isOnline : true);

      setAutoOnline(isOnlineVal);

      if (isOnlineVal) {
        if (meta?.wasOffline) {
          setShowReconnected(true);
          if (reconnectedTimerRef.current) {
            clearTimeout(reconnectedTimerRef.current);
          }
          reconnectedTimerRef.current = setTimeout(() => {
            setShowReconnected(false);
          }, 4000);
        }
      } else {
        setShowReconnected(false);
        if (reconnectedTimerRef.current) {
          clearTimeout(reconnectedTimerRef.current);
          reconnectedTimerRef.current = null;
        }
      }
    });

    return () => {
      if (reconnectedTimerRef.current) {
        clearTimeout(reconnectedTimerRef.current);
      }
      unsubscribe();
    };
  }, []);

  const effectiveOffline = isControlled ? isOffline : (reduxOnline !== undefined ? !reduxOnline : !autoOnline);
  const effectiveOnline = !effectiveOffline;

  const handleRetry = async () => {
    if (typeof onRetry === 'function') {
      onRetry();
    } else if (typeof onRefresh === 'function') {
      onRefresh();
    } else {
      await pingServer();
    }
  };

  // Determine visibility
  const isSyncing = syncStatus === 'syncing';
  const hasSyncError = syncStatus === 'error';
  const hasPendingOnline = effectiveOnline && pendingCount > 0;

  if (effectiveOnline && !showReconnected && !isSyncing && !hasSyncError && !hasPendingOnline) {
    return null;
  }

  const syncedText = formatLastSynced(lastFetchedAt || reduxOffline?.lastSyncAt);

  let bannerText = '';
  let bgStyle = styles.offlineBg;
  let showSpinner = false;

  if (isSyncing) {
    bgStyle = styles.syncingBg;
    showSpinner = true;
    bannerText = `🔄 Synchronizing ${pendingCount > 0 ? `${pendingCount} ` : ''}offline records with server...`;
  } else if (hasSyncError) {
    bgStyle = styles.errorBg;
    const errDetail = syncErrors[0]?.message ? `: ${syncErrors[0].message}` : '';
    bannerText = `⚠️ Synchronization error${errDetail}. Tap Retry to resubmit.`;
  } else if (effectiveOffline) {
    bgStyle = styles.offlineBg;
    if (customMessage) {
      bannerText = customMessage;
    } else if (pendingCount > 0) {
      bannerText = `⚠️ Offline Mode — ${pendingCount} pending mutation${pendingCount > 1 ? 's' : ''} stored securely in SQLite outbox.`;
    } else if (fromCache) {
      const scopePrefix = moduleName ? `${moduleName}: ` : '';
      bannerText = `⚠️ ${scopePrefix}Offline Mode — Displaying cached records${syncedText ? ` (Last synced: ${syncedText})` : ''}${isSynthetic ? ' [Synthetic Benchmark]' : ''}`;
    } else {
      bannerText = '⚠️ You are currently offline. Changes will queue safely.';
    }
  } else if (hasPendingOnline) {
    bgStyle = styles.pendingBg;
    bannerText = `📤 ${pendingCount} offline update${pendingCount > 1 ? 's' : ''} queued for sync.`;
  } else if (effectiveOnline && showReconnected) {
    bgStyle = styles.onlineBg;
    bannerText = '✅ Connected — System synchronized with server.';
  }

  return (
    <View style={[styles.container, bgStyle]}>
      {showSpinner && (
        <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
      )}
      <Text style={styles.text} numberOfLines={2}>
        {bannerText}
      </Text>
      {!effectiveOnline && (
        <TouchableOpacity 
          style={[styles.retryBtn, retrying && styles.retryBtnDisabled]} 
          onPress={handleRetry}
          disabled={retrying}
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#ffffff" style={{ paddingHorizontal: 6 }} />
          ) : (
            <Text style={styles.retryText}>Retry</Text>
          )}
        </TouchableOpacity>
      )}
      {effectiveOnline && hasSyncError && (
        <TouchableOpacity 
          style={[styles.retryBtn, retrying && styles.retryBtnDisabled]} 
          onPress={handleRetry}
          disabled={retrying}
        >
          <Text style={styles.retryText}>Retry Sync</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  offlineBg: {
    backgroundColor: '#dc2626',
  },
  syncingBg: {
    backgroundColor: '#0284c7',
  },
  pendingBg: {
    backgroundColor: '#d97706',
  },
  errorBg: {
    backgroundColor: '#b91c1c',
  },
  onlineBg: {
    backgroundColor: '#16a34a',
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  retryBtn: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryBtnDisabled: {
    opacity: 0.6,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
