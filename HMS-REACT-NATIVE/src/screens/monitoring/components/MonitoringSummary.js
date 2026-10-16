import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function MonitoringSummary({ summary }) {
  const cards = [
    {
      id: 'monitored',
      label: 'Monitored',
      value: summary?.total ?? 0,
      sub: 'active surveillance',
      icon: 'users',
      iconColor: '#0284c7',
      bgColor: '#f0f9ff',
      borderColor: '#bae6fd',
    },
    {
      id: 'stable',
      label: 'Stable',
      value: summary?.stable ?? 0,
      sub: 'normal limits',
      icon: 'check-circle',
      iconColor: '#10b981',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
    },
    {
      id: 'attention',
      label: 'Attention',
      value: summary?.attention ?? 0,
      sub: 'monitor closely',
      icon: 'alert-triangle',
      iconColor: '#f59e0b',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
    },
    {
      id: 'critical',
      label: 'Critical',
      value: summary?.critical ?? 0,
      sub: 'immediate action',
      icon: 'alert-circle',
      iconColor: '#ef4444',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
    },
    {
      id: 'devices',
      label: 'Devices Online',
      value: `${summary?.devicesOnline ?? 0}/${summary?.devicesTotal ?? 0}`,
      sub: 'connected telemetry',
      icon: 'cpu',
      iconColor: '#0d9488',
      bgColor: '#f0fdfa',
      borderColor: '#99f6e4',
    },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card) => (
        <View
          key={card.id}
          style={[
            styles.card,
            { backgroundColor: card.bgColor, borderColor: card.borderColor },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Feather name={card.icon} size={15} color={card.iconColor} />
          </View>
          <Text style={[styles.cardValue, { color: card.iconColor }]}>{card.value}</Text>
          <Text style={styles.cardSub}>{card.sub}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 23,
  },
  cardSub: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },
});
