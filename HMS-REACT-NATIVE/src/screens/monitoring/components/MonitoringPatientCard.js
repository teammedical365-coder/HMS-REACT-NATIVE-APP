import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DEVICE_TYPE_LABELS } from '../monitoringMockData';

export default function MonitoringPatientCard({
  patient,
  isSelected,
  onSelect,
  vitals,
}) {
  const getInitials = (name) => {
    return (name || 'PT')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const statusConfig = {
    critical: {
      color: '#ef4444',
      bg: '#fef2f2',
      border: '#fecaca',
      label: 'Critical',
    },
    attention: {
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
      label: 'Attention',
    },
    stable: {
      color: '#10b981',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      label: 'Stable',
    },
  }[patient.status] || {
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    label: patient.status || 'Stable',
  };

  const hrVal = vitals?.heartRate?.value || '--';
  const spo2Val = vitals?.spo2?.value || '--';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isSelected && styles.cardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.75}
    >
      {/* Top row: Avatar + Name + Status */}
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(patient.name)}</Text>
        </View>

        <View style={styles.nameWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {patient.name}
          </Text>
          <Text style={styles.demographics} numberOfLines={1}>
            {patient.age}y, {patient.gender} • {patient.mrn}
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

      {/* Ward & Bed info */}
      <View style={styles.locRow}>
        <Feather name="map-pin" size={11} color="#64748b" style={{ marginRight: 4 }} />
        <Text style={styles.locText}>
          {patient.ward} • {patient.bed}
        </Text>
      </View>

      {/* Live vitals mini bar */}
      <View style={styles.vitalsRow}>
        <View style={styles.vitalMini}>
          <Text style={styles.vitalLabel}>HR</Text>
          <Text style={[styles.vitalValue, { color: hrVal > 100 ? '#ef4444' : '#0f172a' }]}>
            {hrVal}
          </Text>
          <Text style={styles.vitalUnit}>bpm</Text>
        </View>

        <View style={styles.vitalDivider} />

        <View style={styles.vitalMini}>
          <Text style={styles.vitalLabel}>SpO₂</Text>
          <Text style={[styles.vitalValue, { color: spo2Val < 95 ? '#ef4444' : '#0f172a' }]}>
            {spo2Val}
          </Text>
          <Text style={styles.vitalUnit}>%</Text>
        </View>

        <View style={styles.vitalDivider} />

        <View style={styles.vitalMini}>
          <Text style={styles.vitalLabel}>BP</Text>
          <Text style={styles.vitalValue}>
            {vitals?.bloodPressure?.value || '--'}
          </Text>
        </View>
      </View>

      {/* Devices tags */}
      {patient.devices && patient.devices.length > 0 && (
        <View style={styles.devicesRow}>
          {patient.devices.map((devKey) => (
            <View key={devKey} style={styles.deviceTag}>
              <Text style={styles.deviceTagText}>
                {DEVICE_TYPE_LABELS[devKey] || devKey.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
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
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardSelected: {
    borderColor: '#0d9488',
    backgroundColor: '#f0fdfa',
    borderLeftWidth: 3.5,
    borderLeftColor: '#0d9488',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  demographics: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  locText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  vitalMini: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  vitalLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
  },
  vitalValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  vitalUnit: {
    fontSize: 9,
    color: '#94a3b8',
  },
  vitalDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#e2e8f0',
  },
  devicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  deviceTag: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  deviceTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369a1',
    letterSpacing: 0.2,
  },
});
