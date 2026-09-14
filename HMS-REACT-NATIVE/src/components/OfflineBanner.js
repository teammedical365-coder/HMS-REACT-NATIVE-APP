import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { subscribeNetworkStatus, pingServer } from '../utils/networkStatus';

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((isOnline, { wasOffline }) => {
      setOnline(isOnline);
      if (isOnline && wasOffline) {
        setShowReconnected(true);
        const t = setTimeout(() => setShowReconnected(false), 4000);
        return () => clearTimeout(t);
      }
    });
    return unsubscribe;
  }, []);

  if (online && !showReconnected) return null;

  return (
    <View style={[styles.container, online ? styles.onlineBg : styles.offlineBg]}>
      <Text style={styles.text}>
        {online
          ? '✅ Connected — System synchronized.'
          : '⚠️ You are currently offline. Retrying...'}
      </Text>
      {!online && (
        <TouchableOpacity style={styles.retryBtn} onPress={() => pingServer()}>
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
