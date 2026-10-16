import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export default function DeviceCard({ device }) {
  const getDeviceIcon = (type) => {
    switch (type) {
      case 'ventilator':
        return <MaterialCommunityIcons name="fan" size={17} color="#0284c7" />;
      case 'ecg':
        return <Feather name="activity" size={17} color="#0d9488" />;
      case 'spo2':
        return <Feather name="droplet" size={17} color="#38bdf8" />;
      case 'infusion':
        return <MaterialCommunityIcons name="needle" size={17} color="#8b5cf6" />;
      case 'monitor':
      default:
        return <Feather name="tv" size={17} color="#6366f1" />;
    }
  };

  const statusConfig = {
    online: {
      color: '#10b981',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      label: 'Online',
    },
    warning: {
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
      label: 'Warning',
    },
    offline: {
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fecaca',
      label: 'Offline',
    },
    disconnected: {
      color: '#94a3b8',
      bg: '#f8fafc',
      border: '#e2e8f0',
      label: 'Disconnected',
    },
  }[device.status] || {
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    label: device.status,
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>{getDeviceIcon(device.type)}</View>
        <View style={styles.infoWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {device.name}
          </Text>
          <Text style={styles.model} numberOfLines={1}>
            {device.model}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusConfig.bg, borderColor: statusConfig.border },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.locRow}>
          <Feather name="map-pin" size={11} color="#64748b" style={{ marginRight: 3 }} />
          <Text style={styles.locText}>
            {device.ward} • {device.bed}
          </Text>
        </View>

        <View style={styles.batteryRow}>
          <Feather
            name={device.battery > 20 ? 'battery-charging' : 'battery'}
            size={12}
            color={device.battery <= 20 ? '#ef4444' : '#10b981'}
          />
          <Text style={styles.batteryText}>{device.battery}%</Text>
        </View>
      </View>

      {device.status === 'online' && (
        <View style={styles.streamingRow}>
          <View style={styles.streamDot} />
          <Text style={styles.streamingText}>Telemetry streaming active</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  model: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locText: {
    fontSize: 10.5,
    color: '#475569',
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: '#f0fdf4',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  streamDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#22c55e',
  },
  streamingText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#15803d',
  },
});
