import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { subscribeNetworkStatus, pingServer, isOnline as checkIsOnline } from '../utils/networkStatus';

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
  // If isOffline is explicitly provided as a boolean, respect it; otherwise monitor network
  const isControlled = typeof isOffline === 'boolean';
  const [autoOnline, setAutoOnline] = useState(() => checkIsOnline());
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

  const effectiveOffline = isControlled ? isOffline : !autoOnline;
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

  if (effectiveOnline && !showReconnected) return null;

  const syncedText = formatLastSynced(lastFetchedAt);

  let bannerText = '';
  if (effectiveOnline && showReconnected) {
    bannerText = '✅ Connected — System synchronized.';
  } else if (customMessage) {
    bannerText = customMessage;
  } else if (fromCache) {
    const scopePrefix = moduleName ? `${moduleName}: ` : '';
    bannerText = `⚠️ ${scopePrefix}Offline Mode — Displaying cached records${syncedText ? ` (Last synced: ${syncedText})` : ''}${isSynthetic ? ' [Synthetic Benchmark]' : ''}`;
  } else {
    bannerText = '⚠️ You are currently offline. Retrying...';
  }

  return (
    <View style={[styles.container, effectiveOnline ? styles.onlineBg : styles.offlineBg]}>
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
