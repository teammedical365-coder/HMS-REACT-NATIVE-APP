import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import OfflineBanner from '../../components/OfflineBanner';
import {
  getOfflineMonitoringData,
  addOfflineClinicalNote,
  getPatientAlarmSilenced,
  setPatientAlarmSilenced,
} from '../../services/offline/offlineMonitoringService';
import {
  WARD_OPTIONS,
  DEVICE_TYPE_LABELS,
  getMonitoringSummary,
} from './monitoringMockData';
import socket from '../../utils/socket';

// Child components
import MonitoringHeader from './components/MonitoringHeader';
import MonitoringSummary from './components/MonitoringSummary';
import MonitoringPatientList from './components/MonitoringPatientList';
import VitalCard from './components/VitalCard';
import LiveWaveform from './components/LiveWaveform';
import AdditionalParams from './components/AdditionalParams';
import ConnectedDevices from './components/ConnectedDevices';
import DeviceCard from './components/DeviceCard';
import DeviceTrendChart from './components/DeviceTrendChart';
import RecentAlerts from './components/RecentAlerts';
import ClinicalNotes from './components/ClinicalNotes';
import TelemetryLog from './components/TelemetryLog';
import AddNoteModal from './components/AddNoteModal';
import ActiveAlertsModal from './components/ActiveAlertsModal';

// Helper: Patient initials matching web getInitials
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
};

// Helper: Format admitted date matching web formatAdmittedDate
const formatAdmittedDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${mins} ${ampm}`;
};

export default function RealTimeMonitoringDashboard() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  // Real-time socket status
  const [socketStatus, setSocketStatus] = useState(socket?.connected ? 'connected' : 'disconnected');

  // Loading & cache state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Core telemetry dataset
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [vitalsMap, setVitalsMap] = useState({});
  const [devicesMap, setDevicesMap] = useState({});
  const [alertsMap, setAlertsMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [trendsMap, setTrendsMap] = useState({});
  const [historyMap, setHistoryMap] = useState({});

  // Header & list filters
  const [headerWard, setHeaderWard] = useState('All Wards');
  const [headerSearch, setHeaderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [soundMuted, setSoundMuted] = useState(false);

  // Patient active tab & alarms
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'devices' | 'history' | 'notes'
  const [alarmSilencedMap, setAlarmSilencedMap] = useState({});
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Mobile drawer/view selector
  const [mobileSection, setMobileSection] = useState('monitor'); // 'monitor' | 'patients' | 'telemetry'

  // Modals
  const [addNoteModalVisible, setAddNoteModalVisible] = useState(false);
  const [activeAlertsModalVisible, setActiveAlertsModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  // Fetch telemetry state
  const loadMonitoringData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await getOfflineMonitoringData(!isSilent);
      setPatients(Array.isArray(data?.patients) ? data.patients : []);
      setVitalsMap(data?.vitalsMap || {});
      setDevicesMap(data?.devicesMap || {});
      setAlertsMap(data?.alertsMap || {});
      setNotesMap(data?.notesMap || {});
      setTrendsMap(data?.trendsMap || {});
      setHistoryMap(data?.historyMap || {});
      setFromCache(Boolean(data?._fromCache));

      // Auto-select first patient if none selected
      if (!selectedPatientId && data.patients?.length > 0) {
        setSelectedPatientId(data.patients[0].id);
      }
    } catch (err) {
      console.error('[Monitoring] Data load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    loadMonitoringData();
  }, [loadMonitoringData]);

  // Load alarm silence status when patient changes
  useEffect(() => {
    if (!selectedPatientId) return;
    let isMounted = true;
    getPatientAlarmSilenced(selectedPatientId).then((silenced) => {
      if (isMounted) {
        setAlarmSilencedMap((prev) => ({ ...prev, [selectedPatientId]: Boolean(silenced) }));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  // Handle toggling patient alarm silence
  const handleToggleSilenceAlarm = async () => {
    if (!selectedPatientId) return;
    const currentState = Boolean(alarmSilencedMap[selectedPatientId]);
    const newState = !currentState;
    setAlarmSilencedMap((prev) => ({ ...prev, [selectedPatientId]: newState }));
    try {
      await setPatientAlarmSilenced(selectedPatientId, newState);
    } catch (e) {
      console.warn('[Monitoring] Failed to persist alarm silence state:', e);
    }
  };

  // Live telemetry jitter simulation (every 2.5s) for realistic surveillance
  useEffect(() => {
    if (!isLiveStreaming || !selectedPatientId) return;

    const interval = setInterval(() => {
      setVitalsMap((prev) => {
        const cur = prev[selectedPatientId];
        if (!cur) return prev;

        const hrDelta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
        const spo2Delta = Math.random() * 0.4 - 0.2;
        const newHr = Math.max(45, Math.min(160, (cur.heartRate?.value || 75) + hrDelta));
        const newSpo2 = Math.min(100, Math.max(85, Math.round(((cur.spo2?.value || 98) + spo2Delta) * 10) / 10));

        return {
          ...prev,
          [selectedPatientId]: {
            ...cur,
            heartRate: {
              ...cur.heartRate,
              value: newHr,
              status: newHr > 100 ? 'high' : newHr < 60 ? 'low' : 'normal',
            },
            spo2: {
              ...cur.spo2,
              value: newSpo2,
              status: newSpo2 < 94 ? 'low' : 'normal',
            },
          },
        };
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isLiveStreaming, selectedPatientId]);

  // Real-time socket event subscription (telemetry, alerts, patient status)
  useEffect(() => {
    if (!socket) return;

    if (!socket.connected) {
      setSocketStatus('reconnecting');
      socket.connect();
    } else {
      setSocketStatus('connected');
    }

    const onConnect = () => {
      setSocketStatus('connected');
    };

    const onDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const onReconnectAttempt = () => {
      setSocketStatus('reconnecting');
    };

    // Live telemetry update from vital monitors / wearable devices
    const onTelemetryUpdate = (data) => {
      if (!data || !data.patientId) return;
      setVitalsMap((prev) => {
        const cur = prev[data.patientId] || {};
        return {
          ...prev,
          [data.patientId]: {
            ...cur,
            ...data.vitals,
            heartRate: data.vitals?.heartRate || cur.heartRate,
            spo2: data.vitals?.spo2 || cur.spo2,
            bloodPressure: data.vitals?.bloodPressure || cur.bloodPressure,
            respiratoryRate: data.vitals?.respiratoryRate || cur.respiratoryRate,
            temperature: data.vitals?.temperature || cur.temperature,
          },
        };
      });
    };

    // Live vital alert (tachycardia, desaturation, hypotension, etc.)
    const onVitalAlert = (data) => {
      if (!data || !data.patientId) return;
      setAlertsMap((prev) => {
        const rawList = prev[data.patientId];
        const curList = Array.isArray(rawList)
          ? rawList
          : Array.isArray(rawList?.payload)
            ? rawList.payload
            : Array.isArray(rawList?.alerts)
              ? rawList.alerts
              : [];
        const alertId = data.id || data._id || `${data.patientId}-${Date.now()}`;
        if (curList.some((a) => (a.id || a._id) === alertId)) return prev;
        const newAlert = {
          ...data,
          id: alertId,
          timestamp: data.timestamp || new Date().toISOString(),
        };
        return {
          ...prev,
          [data.patientId]: [newAlert, ...curList],
        };
      });
    };

    // Live patient status change (stable, attention, critical, discharged)
    const onPatientStatusChange = (data) => {
      if (!data || !data.patientId) return;
      setPatients((prev) =>
        prev.map((p) =>
          p.id === data.patientId ? { ...p, status: data.status || p.status } : p
        )
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('telemetry_update', onTelemetryUpdate);
    socket.on('vital_alert', onVitalAlert);
    socket.on('patient_status_change', onPatientStatusChange);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('telemetry_update', onTelemetryUpdate);
      socket.off('vital_alert', onVitalAlert);
      socket.off('patient_status_change', onPatientStatusChange);
    };
  }, []);

  const handleReconnectSocket = useCallback(() => {
    if (!socket) return;
    setSocketStatus('reconnecting');
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  // Handle adding clinical note
  const handleSaveNote = async (notePayload) => {
    if (!selectedPatientId) return;
    try {
      const res = await addOfflineClinicalNote(selectedPatientId, notePayload);
      if (res?.allNotes) {
        setNotesMap((prev) => ({
          ...prev,
          [selectedPatientId]: res.allNotes,
        }));
      }
    } catch (err) {
      console.error('[Monitoring] Failed to save clinical note:', err);
    }
  };

  // Filter patients by header ward + header search query
  const filteredPatients = useMemo(() => {
    let list = patients;
    if (headerWard !== 'All Wards') {
      list = list.filter((p) => p.ward === headerWard);
    }
    if (headerSearch.trim()) {
      const q = headerSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.mrn && p.mrn.toLowerCase().includes(q)) ||
          (p.bed && p.bed.toLowerCase().includes(q)) ||
          (p.ward && p.ward.toLowerCase().includes(q))
      );
    }
    return list;
  }, [patients, headerWard, headerSearch]);

  // Selected patient details
  const selectedPatient = useMemo(() => {
    if (filteredPatients.length === 0) return null;
    return filteredPatients.find((p) => p.id === selectedPatientId) || filteredPatients[0];
  }, [filteredPatients, selectedPatientId]);

  const activeVitals = selectedPatient ? vitalsMap[selectedPatient.id] : null;

  const rawDevices = selectedPatient ? devicesMap[selectedPatient.id] : [];
  const activeDevices = Array.isArray(rawDevices)
    ? rawDevices
    : Array.isArray(rawDevices?.payload)
      ? rawDevices.payload
      : [];

  const rawAlerts = selectedPatient ? alertsMap[selectedPatient.id] : [];
  const activeAlerts = Array.isArray(rawAlerts)
    ? rawAlerts
    : Array.isArray(rawAlerts?.payload)
      ? rawAlerts.payload
      : Array.isArray(rawAlerts?.alerts)
        ? rawAlerts.alerts
        : Array.isArray(rawAlerts?.data)
          ? rawAlerts.data
          : [];

  const rawNotes = selectedPatient ? notesMap[selectedPatient.id] : [];
  const activeNotes = Array.isArray(rawNotes)
    ? rawNotes
    : Array.isArray(rawNotes?.payload)
      ? rawNotes.payload
      : [];

  const activeTrends = selectedPatient && trendsMap[selectedPatient.id] && typeof trendsMap[selectedPatient.id] === 'object'
    ? (trendsMap[selectedPatient.id].payload || trendsMap[selectedPatient.id])
    : {};

  const rawHistory = selectedPatient ? historyMap[selectedPatient.id] : [];
  const activeHistory = Array.isArray(rawHistory)
    ? rawHistory
    : Array.isArray(rawHistory?.payload)
      ? rawHistory.payload
      : [];

  const isAlarmSilenced = selectedPatient ? Boolean(alarmSilencedMap[selectedPatient.id]) : false;

  // Aggregate all active alerts for the alarms console
  const allAlarms = useMemo(() => {
    const list = [];
    if (!alertsMap || typeof alertsMap !== 'object') return list;

    Object.keys(alertsMap).forEach((pId) => {
      const p = patients.find((pat) => pat.id === pId);
      const rawEntry = alertsMap[pId];

      if (rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry)) {
        if (rawEntry.error || rawEntry.failed) {
          console.warn(`[Monitoring] Patient ${pId} alerts returned error state:`, rawEntry.error || rawEntry.message);
        }
      }

      const items = Array.isArray(rawEntry)
        ? rawEntry
        : Array.isArray(rawEntry?.payload)
          ? rawEntry.payload
          : Array.isArray(rawEntry?.alerts)
            ? rawEntry.alerts
            : Array.isArray(rawEntry?.data)
              ? rawEntry.data
              : Array.isArray(rawEntry?.items)
                ? rawEntry.items
                : Array.isArray(rawEntry?.results)
                  ? rawEntry.results
                  : [];

      items.forEach((item) => {
        if (item && typeof item === 'object') {
          list.push({
            ...item,
            patientName: p?.name || 'Unknown Patient',
            bed: p?.bed || '--',
            ward: p?.ward || '--',
          });
        }
      });
    });
    return list;
  }, [alertsMap, patients]);

  // Dynamic summary metrics
  const summary = useMemo(() => getMonitoringSummary(filteredPatients), [filteredPatients]);

  if (loading && patients.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingText}>Initializing ICU Telemetry Stream...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <OfflineBanner />

      {/* Top Header & Command Bar */}
      <MonitoringHeader
        ward={headerWard}
        setWard={setHeaderWard}
        searchQuery={headerSearch}
        setSearchQuery={setHeaderSearch}
        soundMuted={soundMuted}
        setSoundMuted={setSoundMuted}
        activeAlertsCount={allAlarms.length}
        onOpenAlerts={() => setActiveAlertsModalVisible(true)}
        socketStatus={socketStatus}
        onReconnect={handleReconnectSocket}
      />

      {/* KPI Summary 5-Stat Row */}
      <MonitoringSummary summary={summary} />

      {/* Mobile Section Selector (Visible only on mobile/narrow screens) */}
      {isMobile && (
        <View style={styles.mobileNavRow}>
          <TouchableOpacity
            style={[styles.mobileNavBtn, mobileSection === 'monitor' && styles.mobileNavBtnActive]}
            onPress={() => setMobileSection('monitor')}
          >
            <Feather
              name="activity"
              size={13}
              color={mobileSection === 'monitor' ? '#ffffff' : '#475569'}
            />
            <Text
              style={[
                styles.mobileNavBtnText,
                mobileSection === 'monitor' && styles.mobileNavBtnTextActive,
              ]}
            >
              Live Console
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mobileNavBtn, mobileSection === 'patients' && styles.mobileNavBtnActive]}
            onPress={() => setMobileSection('patients')}
          >
            <Feather
              name="users"
              size={13}
              color={mobileSection === 'patients' ? '#ffffff' : '#475569'}
            />
            <Text
              style={[
                styles.mobileNavBtnText,
                mobileSection === 'patients' && styles.mobileNavBtnTextActive,
              ]}
            >
              Patients ({filteredPatients.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mobileNavBtn, mobileSection === 'telemetry' && styles.mobileNavBtnActive]}
            onPress={() => setMobileSection('telemetry')}
          >
            <Feather
              name="trending-up"
              size={13}
              color={mobileSection === 'telemetry' ? '#ffffff' : '#475569'}
            />
            <Text
              style={[
                styles.mobileNavBtnText,
                mobileSection === 'telemetry' && styles.mobileNavBtnTextActive,
              ]}
            >
              Telemetry & Alerts
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Horizontal Patient Carousel (Quick Switcher on mobile) */}
      {isMobile && mobileSection === 'monitor' && (
        <View style={styles.patientCarouselWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patientCarouselContent}
          >
            {filteredPatients.map((pat) => {
              const isSelected = selectedPatient?.id === pat.id;
              const pVitals = vitalsMap[pat.id];
              return (
                <TouchableOpacity
                  key={pat.id}
                  style={[
                    styles.patientMiniChip,
                    isSelected && styles.patientMiniChipSelected,
                  ]}
                  onPress={() => setSelectedPatientId(pat.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.miniDot,
                      {
                        backgroundColor:
                          pat.status === 'critical'
                            ? '#ef4444'
                            : pat.status === 'attention'
                            ? '#f59e0b'
                            : '#10b981',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.miniPatientName,
                      isSelected && styles.miniPatientNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {pat.name}
                  </Text>
                  <Text style={styles.miniBed}>{pat.bed}</Text>
                  {pVitals?.heartRate?.value ? (
                    <Text style={styles.miniHr}>{pVitals.heartRate.value} bpm</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main Workspace Layout */}
      <View style={styles.workspace}>
        {/* LEFT COLUMN: Patient List (Shown on Desktop & Tablet, or when mobileSection === 'patients' on Mobile) */}
        {(isDesktop || isTablet || (isMobile && mobileSection === 'patients')) && (
          <View style={[styles.leftColumn, (isDesktop || isTablet) && { width: isDesktop ? 280 : 240, flexShrink: 0 }]}>
            <MonitoringPatientList
              patients={filteredPatients}
              selectedPatientId={selectedPatient?.id}
              onSelectPatient={(id) => {
                setSelectedPatientId(id);
                if (isMobile) setMobileSection('monitor');
              }}
              filterStatus={statusFilter}
              setFilterStatus={setStatusFilter}
              listSearch={listSearch}
              setListSearch={setListSearch}
              vitalsMap={vitalsMap}
            />
          </View>
        )}

        {/* CENTER COLUMN: Patient Live Monitoring Console */}
        {(!isMobile || mobileSection === 'monitor') && (
          <View style={styles.centerColumn}>
            {selectedPatient ? (
              <ScrollView
                style={styles.centerScroll}
                contentContainerStyle={styles.centerScrollContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => loadMonitoringData(true)}
                    colors={['#0d9488']}
                  />
                }
              >
                {/* Patient Header Detail Bar */}
                <View style={styles.patientDetailHeader}>
                  <View style={styles.pdhLeft}>
                    <View style={styles.pdhAvatar}>
                      <Text style={styles.pdhAvatarText}>{getInitials(selectedPatient.name)}</Text>
                    </View>
                    <View style={styles.pdhInfo}>
                      <View style={styles.pdhNameRow}>
                        <Text style={styles.pdhName}>{selectedPatient.name}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor:
                                selectedPatient.status === 'critical'
                                  ? '#fef2f2'
                                  : selectedPatient.status === 'attention'
                                  ? '#fffbeb'
                                  : '#ecfdf5',
                              borderColor:
                                selectedPatient.status === 'critical'
                                  ? '#fecaca'
                                  : selectedPatient.status === 'attention'
                                  ? '#fde68a'
                                  : '#a7f3d0',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              {
                                color:
                                  selectedPatient.status === 'critical'
                                    ? '#ef4444'
                                    : selectedPatient.status === 'attention'
                                    ? '#b45309'
                                    : '#059669',
                              },
                            ]}
                          >
                            {selectedPatient.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pdhMetaRow}>
                        <Text style={styles.pdhMetaItem}>
                          <Text style={styles.metaLabel}>MRN:</Text> {selectedPatient.mrn}
                        </Text>
                        <Text style={styles.metaSep}>•</Text>
                        <Text style={styles.pdhMetaItem}>
                          {selectedPatient.age} Yrs ({selectedPatient.gender})
                        </Text>
                        <Text style={styles.metaSep}>•</Text>
                        <Text style={styles.pdhMetaItem}>
                          <Text style={styles.metaLabel}>{selectedPatient.ward}</Text>, {selectedPatient.bed}
                        </Text>
                        {selectedPatient.admittedAt ? (
                          <>
                            <Text style={styles.metaSep}>•</Text>
                            <Text style={styles.pdhMetaItem}>
                              Admitted: {formatAdmittedDate(selectedPatient.admittedAt)}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.pdhRight}>
                    {/* Silence Alarm Button */}
                    <TouchableOpacity
                      style={[
                        styles.pdhBtn,
                        isAlarmSilenced && styles.pdhBtnSilenced,
                      ]}
                      onPress={handleToggleSilenceAlarm}
                      activeOpacity={0.7}
                    >
                      {isAlarmSilenced ? (
                        <>
                          <Feather name="check" size={12} color="#059669" style={{ marginRight: 4 }} />
                          <Text style={styles.pdhBtnTextSilenced}>Silenced</Text>
                        </>
                      ) : (
                        <>
                          <Feather name="volume-x" size={12} color="#475569" style={{ marginRight: 4 }} />
                          <Text style={styles.pdhBtnText}>Silence Alarm</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* View Profile Button */}
                    <TouchableOpacity
                      style={styles.pdhBtn}
                      onPress={() => setProfileModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Feather name="user" size={12} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.pdhBtnText}>View Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Center Console Tabs */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'live' && styles.tabItemActive]}
                    onPress={() => setActiveTab('live')}
                  >
                    <Feather
                      name="activity"
                      size={13}
                      color={activeTab === 'live' ? '#0d9488' : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>
                      Live Monitoring
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'devices' && styles.tabItemActive]}
                    onPress={() => setActiveTab('devices')}
                  >
                    <Feather
                      name="cpu"
                      size={13}
                      color={activeTab === 'devices' ? '#0d9488' : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'devices' && styles.tabTextActive]}>
                      Devices ({activeDevices.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
                    onPress={() => setActiveTab('history')}
                  >
                    <Feather
                      name="clock"
                      size={13}
                      color={activeTab === 'history' ? '#0d9488' : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                      Telemetry Log
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabItem, activeTab === 'notes' && styles.tabItemActive]}
                    onPress={() => setActiveTab('notes')}
                  >
                    <Feather
                      name="file-text"
                      size={13}
                      color={activeTab === 'notes' ? '#0d9488' : '#64748b'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
                      Clinical Notes ({activeNotes.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Tab Content Area */}
                <View style={styles.tabContentArea}>
                  {/* TAB 1: LIVE MONITORING */}
                  {activeTab === 'live' && (
                    <View>
                      {/* Section Title */}
                      <View style={styles.sectionHeader}>
                        <Feather name="heart" size={13} color="#ef4444" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>PRIMARY VITAL SIGNS</Text>
                      </View>

                      {/* 4-Card Primary Vitals Grid */}
                      <View style={styles.primaryVitalsGrid}>
                        <VitalCard
                          label="Heart Rate"
                          value={activeVitals?.heartRate?.value}
                          unit={activeVitals?.heartRate?.unit || 'bpm'}
                          status={activeVitals?.heartRate?.status || 'normal'}
                          normalRange="60 - 100 bpm"
                          trend={activeVitals?.heartRate?.trend}
                          icon="heart"
                        />
                        <VitalCard
                          label="SpO₂"
                          value={activeVitals?.spo2?.value}
                          unit={activeVitals?.spo2?.unit || '%'}
                          status={activeVitals?.spo2?.status || 'normal'}
                          normalRange="95 - 100 %"
                          trend={activeVitals?.spo2?.trend}
                          icon="droplet"
                        />
                        <VitalCard
                          label="Blood Pressure"
                          value={
                            activeVitals?.bloodPressure
                              ? typeof activeVitals.bloodPressure.value === 'string'
                                ? activeVitals.bloodPressure.value
                                : `${activeVitals.bloodPressure.systolic}/${activeVitals.bloodPressure.diastolic}`
                              : '120/78'
                          }
                          unit="mmHg"
                          status={activeVitals?.bloodPressure?.status || 'normal'}
                          normalRange="90-120 / 60-80"
                          trend={activeVitals?.bloodPressure?.trend}
                          icon="activity"
                        />
                        <VitalCard
                          label="Temperature"
                          value={activeVitals?.temperature?.value}
                          unit={activeVitals?.temperature?.unit || '°F'}
                          status={activeVitals?.temperature?.status || 'normal'}
                          normalRange="97.0 - 99.0 °F"
                          trend={activeVitals?.temperature?.trend}
                          icon="thermometer"
                        />
                      </View>

                      {/* Dual-Channel Live Waveform with Simulation Disclaimers */}
                      <LiveWaveform
                        heartRate={activeVitals?.heartRate?.value || 72}
                        spo2={activeVitals?.spo2?.value || 98}
                      />

                      {/* Secondary Clinical Parameters (RR, MAP, EtCO2, Blood Glucose) */}
                      <View style={[styles.sectionHeader, { marginTop: 10 }]}>
                        <Feather name="layers" size={13} color="#0284c7" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>SECONDARY PARAMETERS</Text>
                      </View>
                      <AdditionalParams vitals={activeVitals || {}} />
                    </View>
                  )}

                  {/* TAB 2: ASSIGNED TELEMETRY DEVICES */}
                  {activeTab === 'devices' && (
                    <View style={styles.devicesTabWrap}>
                      <View style={styles.sectionHeader}>
                        <Feather name="cpu" size={13} color="#0d9488" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>
                          ASSIGNED TELEMETRY DEVICES ({activeDevices.length})
                        </Text>
                      </View>

                      {activeDevices.length === 0 ? (
                        <View style={styles.emptyCardWrap}>
                          <Feather name="slash" size={24} color="#94a3b8" />
                          <Text style={styles.emptyCardText}>No devices currently assigned to this bed.</Text>
                        </View>
                      ) : (
                        <View style={styles.devicesGrid}>
                          {activeDevices.map((d) => (
                            <View key={d.id} style={styles.deviceCardItem}>
                              <DeviceCard device={d} />
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* TAB 3: TELEMETRY LOG HISTORY TABLE */}
                  {activeTab === 'history' && (
                    <TelemetryLog history={activeHistory} />
                  )}

                  {/* TAB 4: CLINICAL NOTES */}
                  {activeTab === 'notes' && (
                    <ClinicalNotes
                      notes={activeNotes}
                      onOpenAddNote={() => setAddNoteModalVisible(true)}
                    />
                  )}
                </View>

                {/* On Mobile/Tablet: Append Right Column telemetry widgets at the bottom of the Live Console */}
                {(isMobile || isTablet) && (
                  <View style={styles.mobileRightWidgets}>
                    <DeviceTrendChart trends={activeTrends} />
                    <ConnectedDevices devices={activeDevices} />
                    <RecentAlerts
                      alerts={activeAlerts}
                      onOpenAllAlerts={() => setActiveAlertsModalVisible(true)}
                    />
                  </View>
                )}
              </ScrollView>
            ) : (
              <View style={styles.noPatientSelected}>
                <Feather name="users" size={36} color="#94a3b8" />
                <Text style={styles.noPatientTitle}>Select a Patient</Text>
                <Text style={styles.noPatientSubtitle}>
                  Choose a patient from the surveillance roster to monitor continuous vitals.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* RIGHT COLUMN: Devices, Trend Chart, Recent Alerts (Shown on Desktop) */}
        {isDesktop && (
          <ScrollView
            style={styles.rightColumn}
            contentContainerStyle={styles.rightColumnContent}
            showsVerticalScrollIndicator={false}
          >
            <ConnectedDevices devices={activeDevices} />
            <DeviceTrendChart trends={activeTrends} />
            <RecentAlerts
              alerts={activeAlerts}
              onOpenAllAlerts={() => setActiveAlertsModalVisible(true)}
            />
          </ScrollView>
        )}

        {/* Mobile Telemetry & Alerts Tab View */}
        {isMobile && mobileSection === 'telemetry' && (
          <ScrollView
            style={styles.centerScroll}
            contentContainerStyle={styles.centerScrollContent}
          >
            <DeviceTrendChart trends={activeTrends} />
            <ConnectedDevices devices={activeDevices} />
            <RecentAlerts
              alerts={activeAlerts}
              onOpenAllAlerts={() => setActiveAlertsModalVisible(true)}
            />
          </ScrollView>
        )}
      </View>

      {/* Add Clinical Note Modal */}
      <AddNoteModal
        visible={addNoteModalVisible}
        onClose={() => setAddNoteModalVisible(false)}
        onSave={handleSaveNote}
      />

      {/* Active Alarms Console Modal */}
      <ActiveAlertsModal
        visible={activeAlertsModalVisible}
        onClose={() => setActiveAlertsModalVisible(false)}
        alerts={allAlarms}
      />

      {/* Patient Profile Quick Modal */}
      {selectedPatient && (
        <Modal
          visible={profileModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setProfileModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setProfileModalVisible(false)}
            />
            <View style={styles.profileModalCard}>
              <View style={styles.profileModalHeader}>
                <View style={styles.profileModalHeaderLeft}>
                  <View style={styles.pdhAvatar}>
                    <Text style={styles.pdhAvatarText}>{getInitials(selectedPatient.name)}</Text>
                  </View>
                  <View>
                    <Text style={styles.profileModalName}>{selectedPatient.name}</Text>
                    <Text style={styles.profileModalSub}>MRN: {selectedPatient.mrn}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                  <Feather name="x" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.profileGrid}>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Demographics:</Text>
                  <Text style={styles.profileValue}>{selectedPatient.age} Yrs, {selectedPatient.gender}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Ward / Bed:</Text>
                  <Text style={styles.profileValue}>{selectedPatient.ward} — {selectedPatient.bed}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Clinical Status:</Text>
                  <Text style={[styles.profileValue, { fontWeight: '700', color: selectedPatient.status === 'critical' ? '#ef4444' : '#059669' }]}>
                    {selectedPatient.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Admitted At:</Text>
                  <Text style={styles.profileValue}>{formatAdmittedDate(selectedPatient.admittedAt)}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Attending Doctor:</Text>
                  <Text style={styles.profileValue}>{selectedPatient.doctor || 'Dr. Vivek Sharma'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Primary Diagnosis:</Text>
                  <Text style={styles.profileValue}>{selectedPatient.diagnosis || 'Acute Respiratory Distress Syndrome'}</Text>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileField}>Assigned Devices:</Text>
                  <Text style={styles.profileValue}>
                    {selectedPatient.devices ? selectedPatient.devices.map(d => DEVICE_TYPE_LABELS[d] || d).join(', ') : 'None'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.profileCloseBtn}
                onPress={() => setProfileModalVisible(false)}
              >
                <Text style={styles.profileCloseBtnText}>Close Overview</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  mobileNavRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mobileNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  mobileNavBtnActive: {
    backgroundColor: '#0d9488',
  },
  mobileNavBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  mobileNavBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  patientCarouselWrap: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  patientCarouselContent: {
    paddingHorizontal: 8,
    gap: 8,
  },
  patientMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  patientMiniChipSelected: {
    backgroundColor: '#f0fdfa',
    borderColor: '#0d9488',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniPatientName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    maxWidth: 95,
  },
  miniPatientNameSelected: {
    color: '#0f766e',
  },
  miniBed: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
  },
  miniHr: {
    fontSize: 9.5,
    color: '#0284c7',
    fontWeight: '700',
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  leftColumn: {
    flex: 1,
  },
  centerColumn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  centerScroll: {
    flex: 1,
  },
  centerScrollContent: {
    padding: 10,
    paddingBottom: 60,
  },
  rightColumn: {
    width: 290,
    flexShrink: 0,
  },
  rightColumnContent: {
    gap: 8,
    paddingBottom: 60,
  },
  mobileRightWidgets: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
  },
  patientDetailHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdhLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 220,
  },
  pdhAvatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdhAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  pdhInfo: {
    flex: 1,
  },
  pdhNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pdhName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 50,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pdhMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  pdhMetaItem: {
    fontSize: 11,
    color: '#64748b',
  },
  metaLabel: {
    fontWeight: '700',
    color: '#334155',
  },
  metaSep: {
    color: '#cbd5e1',
    fontSize: 10,
  },
  pdhRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdhBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  pdhBtnSilenced: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  pdhBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  pdhBtnTextSilenced: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fafbfc',
    marginTop: 6,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0d9488',
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#0d9488',
    fontWeight: '700',
  },
  tabContentArea: {
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.4,
  },
  primaryVitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  devicesTabWrap: {
    paddingVertical: 4,
  },
  devicesGrid: {
    gap: 8,
  },
  deviceCardItem: {
    marginBottom: 2,
  },
  emptyCardWrap: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyCardText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  noPatientSelected: {
    flex: 1,
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  noPatientTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  noPatientSubtitle: {
    fontSize: 11.5,
    color: '#94a3b8',
    maxWidth: 260,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  profileModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  profileModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileModalName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileModalSub: {
    fontSize: 11,
    color: '#64748b',
  },
  profileGrid: {
    gap: 8,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  profileField: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  profileValue: {
    fontSize: 11.5,
    color: '#0f172a',
    fontWeight: '500',
    maxWidth: 240,
    textAlign: 'right',
  },
  profileCloseBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  profileCloseBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
