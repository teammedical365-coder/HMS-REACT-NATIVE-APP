import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DeviceCard from './DeviceCard';

export default function ConnectedDevices({ devices = [] }) {
  const onlineCount = devices.filter((d) => d.status === 'online').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="cpu" size={14} color="#0d9488" />
          <Text style={styles.title}>Connected Devices ({devices.length})</Text>
        </View>
        <Text style={styles.onlineBadge}>{onlineCount} Online</Text>
      </View>

      {devices.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="slash" size={20} color="#94a3b8" />
          <Text style={styles.emptyText}>No telemetry devices registered</Text>
        </View>
      ) : (
        devices.map((device) => <DeviceCard key={device.id} device={device} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  onlineBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  emptyWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
