import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Sparkline from './Sparkline';

export default function VitalCard({
  label,
  value,
  unit,
  status = 'normal',
  normalRange,
  trend,
  icon,
  iconType = 'feather',
}) {
  const isHigh = status === 'high';
  const isLow = status === 'low';

  const statusColor = isHigh
    ? '#ef4444'
    : isLow
    ? '#0284c7'
    : '#10b981';

  const statusBg = isHigh
    ? '#fef2f2'
    : isLow
    ? '#f0f9ff'
    : '#ecfdf5';

  const statusBorder = isHigh
    ? '#fecaca'
    : isLow
    ? '#bae6fd'
    : '#a7f3d0';

  return (
    <View style={[styles.card, { borderColor: isHigh ? '#fca5a5' : '#e2e8f0' }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={[styles.iconBox, { backgroundColor: statusBg }]}>
            {iconType === 'mci' ? (
              <MaterialCommunityIcons name={icon} size={15} color={statusColor} />
            ) : (
              <Feather name={icon} size={15} color={statusColor} />
            )}
          </View>
          <Text style={styles.label}>{label}</Text>
        </View>

        <View style={[styles.statusTag, { backgroundColor: statusBg, borderColor: statusBorder }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: isHigh ? '#ef4444' : '#0f172a' }]}>
          {value ?? '--'}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {/* Footer: Target + Sparkline */}
      <View style={styles.footer}>
        <Text style={styles.target} numberOfLines={1}>
          Norm: {normalRange}
        </Text>
        {trend && trend.length > 1 && (
          <Sparkline data={trend} color={statusColor} width={55} height={18} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flex: 1,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  statusTag: {
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748b',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
    marginTop: 2,
  },
  target: {
    fontSize: 9.5,
    color: '#64748b',
    flexShrink: 1,
  },
});
