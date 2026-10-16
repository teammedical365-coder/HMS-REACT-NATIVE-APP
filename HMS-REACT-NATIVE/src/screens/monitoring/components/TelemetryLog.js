import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function TelemetryLog({ history = [] }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'critical':
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          color: '#ef4444',
          label: 'CRITICAL',
        };
      case 'attention':
        return {
          bg: '#fffbeb',
          border: '#fde68a',
          color: '#b45309',
          label: 'ATTENTION',
        };
      case 'stable':
      default:
        return {
          bg: '#ecfdf5',
          border: '#a7f3d0',
          color: '#059669',
          label: 'STABLE',
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="clock" size={14} color="#0d9488" />
          <Text style={styles.title}>Recent Vital Log Entries</Text>
        </View>
        <Text style={styles.countText}>{history.length} Entries</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="file-text" size={22} color="#94a3b8" />
          <Text style={styles.emptyText}>No prior telemetry history recorded for today.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableRowHeader}>
              <Text style={[styles.colHeader, styles.colTime]}>Timestamp</Text>
              <Text style={[styles.colHeader, styles.colHr]}>Heart Rate</Text>
              <Text style={[styles.colHeader, styles.colSpo2]}>SpO₂</Text>
              <Text style={[styles.colHeader, styles.colBp]}>Blood Pressure</Text>
              <Text style={[styles.colHeader, styles.colTemp]}>Temp</Text>
              <Text style={[styles.colHeader, styles.colRr]}>Resp Rate</Text>
              <Text style={[styles.colHeader, styles.colStatus]}>Status</Text>
            </View>

            {/* Table Rows */}
            {history.map((row, idx) => {
              const statusCfg = getStatusBadge(row.status);
              return (
                <View
                  key={idx}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={[styles.colCell, styles.colTime, styles.timeText]}>
                    {row.time}
                  </Text>
                  <Text style={[styles.colCell, styles.colHr]}>{row.hr}</Text>
                  <Text style={[styles.colCell, styles.colSpo2]}>{row.spo2}</Text>
                  <Text style={[styles.colCell, styles.colBp]}>{row.bp}</Text>
                  <Text style={[styles.colCell, styles.colTemp]}>{row.temp}</Text>
                  <Text style={[styles.colCell, styles.colRr]}>{row.rr}</Text>
                  <View style={[styles.colCell, styles.colStatus]}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: statusCfg.color }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
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
    marginTop: 6,
    marginBottom: 6,
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
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  countText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  tableScroll: {
    width: '100%',
  },
  table: {
    minWidth: 540,
  },
  tableRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: '#fafbfc',
  },
  colHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  colCell: {
    fontSize: 11.5,
    color: '#1e293b',
  },
  colTime: {
    width: 90,
  },
  colHr: {
    width: 80,
  },
  colSpo2: {
    width: 65,
  },
  colBp: {
    width: 100,
  },
  colTemp: {
    width: 75,
  },
  colRr: {
    width: 75,
  },
  colStatus: {
    width: 85,
  },
  timeText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
