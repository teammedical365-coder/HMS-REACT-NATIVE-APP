import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ActiveAlertsModal({ visible, onClose, alerts = [] }) {
  const [filter, setFilter] = useState('all');

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'all') return true;
    return a.severity === filter;
  });

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          color: '#ef4444',
          bg: '#fef2f2',
          border: '#fecaca',
          label: 'CRITICAL',
        };
      case 'warning':
        return {
          color: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
          label: 'WARNING',
        };
      case 'info':
      default:
        return {
          color: '#0284c7',
          bg: '#f0f9ff',
          border: '#bae6fd',
          label: 'INFO',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Feather name="bell" size={16} color="#ef4444" />
              <Text style={styles.title}>Active Telemetry Alarms</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{alerts.length}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {['all', 'critical', 'warning', 'info'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.pill, filter === tab && styles.pillActive]}
                onPress={() => setFilter(tab)}
              >
                <Text style={[styles.pillText, filter === tab && styles.pillTextActive]}>
                  {tab.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Alerts List */}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {filteredAlerts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Feather name="check-circle" size={24} color="#10b981" />
                <Text style={styles.emptyText}>No alarms in this category</Text>
              </View>
            ) : (
              filteredAlerts.map((alert) => {
                const s = getSeverityStyle(alert.severity);
                return (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertItem,
                      { backgroundColor: s.bg, borderColor: s.border },
                    ]}
                  >
                    <View style={styles.alertTop}>
                      <View style={styles.badgeWrap}>
                        <View style={[styles.sevBadge, { backgroundColor: s.color }]}>
                          <Text style={styles.sevText}>{s.label}</Text>
                        </View>
                        <Text style={styles.paramText}>{alert.parameter}</Text>
                      </View>
                      <Text style={styles.timeText}>{alert.time}</Text>
                    </View>

                    <Text style={styles.messageText}>{alert.message}</Text>

                    {alert.patientName && (
                      <View style={styles.patientMeta}>
                        <Feather name="user" size={10} color="#64748b" />
                        <Text style={styles.patientMetaText}>
                          {alert.patientName} • {alert.ward || 'ICU'} ({alert.bed || 'Bed'})
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close Alarms Console</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  countBadge: {
    backgroundColor: '#fee2e2',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: '#0d9488',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  list: {
    flexGrow: 0,
    maxHeight: 380,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  emptyWrap: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  alertItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sevBadge: {
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  sevText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  paramText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  timeText: {
    fontSize: 10,
    color: '#64748b',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  patientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  patientMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
    alignItems: 'flex-end',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
  },
  closeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
});
