import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function RecentAlerts({ alerts = [], onOpenAllAlerts }) {
  const alertList = Array.isArray(alerts)
    ? alerts
    : Array.isArray(alerts?.payload)
      ? alerts.payload
      : Array.isArray(alerts?.alerts)
        ? alerts.alerts
        : [];

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          color: '#ef4444',
          bg: '#fef2f2',
          border: '#fecaca',
          dot: '#ef4444',
        };
      case 'warning':
        return {
          color: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
          dot: '#f59e0b',
        };
      case 'info':
      default:
        return {
          color: '#0284c7',
          bg: '#f0f9ff',
          border: '#bae6fd',
          dot: '#0284c7',
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="alert-triangle" size={14} color="#f59e0b" />
          <Text style={styles.title}>Recent Telemetry Alerts</Text>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{alertList.length} Active</Text>
        </View>
      </View>

      {alertList.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="check-circle" size={18} color="#10b981" />
          <Text style={styles.emptyText}>No active clinical alarms</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alertList.slice(0, 4).map((alert) => {
            const style = getSeverityStyle(alert.severity);
            return (
              <View
                key={alert.id}
                style={[
                  styles.alertItem,
                  { backgroundColor: style.bg, borderColor: style.border },
                ]}
              >
                <View style={styles.alertLeft}>
                  <View style={[styles.dot, { backgroundColor: style.dot }]} />
                  <View style={styles.paramTag}>
                    <Text style={styles.paramText}>{alert.parameter || 'ALERT'}</Text>
                  </View>
                  <Text style={styles.message} numberOfLines={2}>
                    {alert.message}
                  </Text>
                </View>
                <Text style={styles.time}>{alert.time}</Text>
              </View>
            );
          })}

          {alertList.length > 4 && onOpenAllAlerts && (
            <TouchableOpacity
              style={styles.viewMoreBtn}
              onPress={onOpenAllAlerts}
              activeOpacity={0.7}
            >
              <Text style={styles.viewMoreText}>
                View all {alertList.length} active alarms →
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
    marginBottom: 8,
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
  badge: {
    backgroundColor: '#fef3c7',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#b45309',
  },
  emptyWrap: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
  },
  list: {
    gap: 6,
  },
  alertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  paramTag: {
    backgroundColor: '#ffffff',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paramText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#334155',
  },
  message: {
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '600',
    flex: 1,
  },
  time: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginLeft: 6,
  },
  viewMoreBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0d9488',
  },
});
