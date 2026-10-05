import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { subscribeNetworkStatus, pingServer, isOnline } from '../utils/networkStatus';

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => isOnline());
  const [showReconnected, setShowReconnected] = useState(false);
  const reconnectedTimerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((isNetOnline, { wasOffline }) => {
      setOnline(isNetOnline);
      if (isNetOnline) {
        if (wasOffline) {
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

  const handleRetry = async () => {
    await pingServer();
  };

  if (online && !showReconnected) return null;

  return (
    <View style={[styles.container, online ? styles.onlineBg : styles.offlineBg]}>
      <Text style={styles.text}>
        {online
          ? '✅ Connected — System synchronized.'
          : '⚠️ You are currently offline. Retrying...'}
      </Text>
      {!online && (
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <Text style={styles.retryText}>Retry</Text>
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
  },
  retryBtn: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
