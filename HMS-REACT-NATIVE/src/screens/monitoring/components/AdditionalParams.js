import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Sparkline from './Sparkline';

export default function AdditionalParams({ vitals }) {
  const params = [
    {
      id: 'respRate',
      label: 'Resp Rate',
      value: vitals?.respRate?.value,
      unit: vitals?.respRate?.unit || '/min',
      status: vitals?.respRate?.status || 'normal',
      trend: vitals?.respRate?.trend,
      target: '12 - 20 /min',
    },
    {
      id: 'map',
      label: 'MAP',
      value: vitals?.map?.value,
      unit: vitals?.map?.unit || 'mmHg',
      status: vitals?.map?.status || 'normal',
      trend: vitals?.map?.trend,
      target: '70 - 100 mmHg',
    },
    {
      id: 'etco2',
      label: 'EtCO₂',
      value: vitals?.etco2?.value,
      unit: vitals?.etco2?.unit || 'mmHg',
      status: vitals?.etco2?.status || 'normal',
      trend: vitals?.etco2?.trend,
      target: '35 - 45 mmHg',
    },
    {
      id: 'bloodSugar',
      label: 'Blood Glucose',
      value: vitals?.bloodSugar?.value,
      unit: vitals?.bloodSugar?.unit || 'mg/dL',
      status: vitals?.bloodSugar?.status || 'normal',
      trend: vitals?.bloodSugar?.trend,
      target: '70 - 140 mg/dL',
    },
  ];

  return (
    <View style={styles.grid}>
      {params.map((item) => {
        const isHigh = item.status === 'high';
        const isLow = item.status === 'low';
        const color = isHigh ? '#ef4444' : isLow ? '#0284c7' : '#10b981';
        const bg = isHigh ? '#fef2f2' : isLow ? '#f0f9ff' : '#ecfdf5';

        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.label}>{item.label}</Text>
              <View style={[styles.statusTag, { backgroundColor: bg }]}>
                <Text style={[styles.statusText, { color }]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: isHigh ? '#ef4444' : '#0f172a' }]}>
                {item.value ?? '--'}
              </Text>
              <Text style={styles.unit}>{item.unit}</Text>
            </View>

            <View style={styles.footer}>
              <Text style={styles.target}>{item.target}</Text>
              {item.trend && item.trend.length > 1 && (
                <Sparkline data={item.trend} color={color} width={45} height={14} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  card: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusTag: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
  },
  unit: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 4,
  },
  target: {
    fontSize: 8.5,
    color: '#94a3b8',
  },
});
