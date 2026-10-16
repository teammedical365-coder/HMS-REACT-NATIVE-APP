import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MonitoringPatientCard from './MonitoringPatientCard';

export default function MonitoringPatientList({
  patients = [],
  selectedPatientId,
  onSelectPatient,
  filterStatus = 'all',
  setFilterStatus,
  listSearch = '',
  setListSearch,
  vitalsMap = {},
}) {
  const filterPills = [
    { id: 'all', label: 'All' },
    { id: 'critical', label: 'Critical' },
    { id: 'attention', label: 'Attention' },
    { id: 'stable', label: 'Stable' },
  ];

  const filteredPatients = React.useMemo(() => {
    let list = patients;
    if (filterStatus !== 'all') {
      list = list.filter((p) => p.status === filterStatus);
    }
    if (listSearch && listSearch.trim()) {
      const q = listSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.mrn && p.mrn.toLowerCase().includes(q)) ||
          (p.bed && p.bed.toLowerCase().includes(q)) ||
          (p.ward && p.ward.toLowerCase().includes(q))
      );
    }
    return list;
  }, [patients, filterStatus, listSearch]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients ({filteredPatients.length})</Text>
      </View>

      {/* Secondary Search Box */}
      <View style={styles.searchBox}>
        <Feather name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter patient / bed..."
          placeholderTextColor="#94a3b8"
          value={listSearch}
          onChangeText={setListSearch}
        />
        {listSearch ? (
          <TouchableOpacity onPress={() => setListSearch && setListSearch('')}>
            <Feather name="x" size={12} color="#94a3b8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter status pills */}
      <View style={styles.pillsRow}>
        {filterPills.map((pill) => {
          const isActive = filterStatus === pill.id;
          return (
            <TouchableOpacity
              key={pill.id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setFilterStatus(pill.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Patients Scroll List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredPatients.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="user-x" size={28} color="#94a3b8" />
            <Text style={styles.emptyText}>No monitored patients match filters</Text>
          </View>
        ) : (
          filteredPatients.map((patient) => (
            <MonitoringPatientCard
              key={patient.id}
              patient={patient}
              isSelected={selectedPatientId === patient.id}
              onSelect={() => onSelectPatient(patient.id)}
              vitals={vitalsMap[patient.id]}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 32,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 11.5,
    color: '#0f172a',
    padding: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
  },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: '#0d9488',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
