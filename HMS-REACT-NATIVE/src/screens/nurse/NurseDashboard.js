import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
    useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { admissionAPI, ipdClinicalAPI, ipdNursingAPI } from '../../utils/api';

// ── Ward badge styling ──
const getWardBadgeStyle = (ward) => {
    const w = (ward || '').toLowerCase();
    if (w.includes('icu')) return { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5' };
    if (w.includes('private')) return { bg: '#f3e8ff', text: '#9333ea', border: '#d8b4fe' };
    if (w.includes('semi')) return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' };
    if (w.includes('general')) return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
};

// ── Patient initials ──
const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
};

// ── Days since admission ──
const daysSince = (dateStr) => {
    if (!dateStr) return 0;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// ── Vital status classifier ──
const getVitalStatus = (vitals) => {
    if (!vitals) return null;
    const checks = [];
    if (vitals.spo2 !== undefined && vitals.spo2 !== null) {
        checks.push({
            label: `SpO₂ ${vitals.spo2}%`,
            status: vitals.spo2 < 90 ? 'critical' : vitals.spo2 < 95 ? 'warning' : 'normal'
        });
    }
    if (vitals.pulse !== undefined && vitals.pulse !== null) {
        checks.push({
            label: `HR ${vitals.pulse}`,
            status: vitals.pulse > 120 || vitals.pulse < 50 ? 'critical' : vitals.pulse > 100 || vitals.pulse < 60 ? 'warning' : 'normal'
        });
    }
    if (vitals.systolicBP !== undefined && vitals.systolicBP !== null) {
        const bp = vitals.systolicBP;
        checks.push({
            label: `BP ${bp}/${vitals.diastolicBP || '?'}`,
            status: bp > 180 || bp < 90 ? 'critical' : bp > 140 || bp < 100 ? 'warning' : 'normal'
        });
    }
    return checks.length > 0 ? checks : null;
};

const SHIFTS = ['Morning', 'Evening', 'Night', 'All Shifts / Primary Incharge'];

const NurseDashboard = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [userName, setUserName] = useState('Nurse');
    const [userId, setUserId] = useState('');
    const [admissions, setAdmissions] = useState([]);
    const [operationsMetrics, setOperationsMetrics] = useState(null);
    const [hospitalNurses, setHospitalNurses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [activeWard, setActiveWard] = useState('All');
    const [workloadFilter, setWorkloadFilter] = useState('ALL');
    const [vitalsMap, setVitalsMap] = useState({});
    const [alertsMap, setAlertsMap] = useState({});

    // Assignment Modal state
    const [assignModal, setAssignModal] = useState({ open: false, admission: null, nurseId: '', shift: 'Morning', notes: '' });
    const [submittingAssign, setSubmittingAssign] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ── Load User & Permissions ──
    useEffect(() => {
        const loadUser = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const u = JSON.parse(userStr);
                    setUserName(u.name || 'Nurse');
                    setUserId(u._id || u.userId || '');
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadUser();
    }, []);

    // ── Fetch Dashboard Data ──
    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const [admissionsRes, metricsRes, nursesRes] = await Promise.all([
                admissionAPI.getActiveAdmissions().catch(() => ({ admissions: [] })),
                ipdNursingAPI.getOperationsMetrics().catch(() => ({ metrics: null })),
                ipdNursingAPI.getHospitalNurses().catch(() => ({ nurses: [] }))
            ]);

            const list = admissionsRes.admissions || admissionsRes.data || [];
            setAdmissions(list);

            if (metricsRes.metrics || metricsRes.data) {
                setOperationsMetrics(metricsRes.metrics || metricsRes.data);
            }
            if (nursesRes.nurses || nursesRes.data) {
                setHospitalNurses(nursesRes.nurses || nursesRes.data);
            }

            // Batched vitals and alerts
            const batch = list.slice(0, 30);
            const vitalsPromises = batch.map(adm =>
                ipdClinicalAPI.getLatestVitals(adm._id)
                    .then(r => ({ id: adm._id, vitals: r.vitals }))
                    .catch(() => ({ id: adm._id, vitals: null }))
            );
            const alertsPromises = batch.map(adm =>
                ipdNursingAPI.getAdmissionAlerts(adm._id)
                    .then(r => ({ id: adm._id, alerts: r.alerts || [] }))
                    .catch(() => ({ id: adm._id, alerts: [] }))
            );

            const [vitalsResults, alertsResults] = await Promise.all([
                Promise.all(vitalsPromises),
                Promise.all(alertsPromises)
            ]);

            const vMap = {};
            vitalsResults.forEach(v => { vMap[v.id] = v.vitals; });
            setVitalsMap(vMap);

            const aMap = {};
            alertsResults.forEach(a => { aMap[a.id] = a.alerts; });
            setAlertsMap(aMap);
        } catch (err) {
            console.error('Nurse Dashboard — Error fetching data:', err);
            showToast('Error loading inpatient records', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // ── Handle Nurse Assignment ──
    const handleAssignSubmit = async () => {
        if (!assignModal.admission || !assignModal.nurseId) {
            Alert.alert('Validation', 'Please select a nurse.');
            return;
        }
        try {
            setSubmittingAssign(true);
            await ipdNursingAPI.assignNurse(assignModal.admission._id, {
                nurseId: assignModal.nurseId,
                shift: assignModal.shift,
                notes: assignModal.notes
            });
            setAssignModal({ open: false, admission: null, nurseId: '', shift: 'Morning', notes: '' });
            showToast('Nurse assigned successfully');
            fetchDashboardData();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error assigning nurse', 'error');
        } finally {
            setSubmittingAssign(false);
        }
    };

    // ── Unique Wards ──
    const wards = useMemo(() => {
        const set = new Set();
        admissions.forEach(a => { if (a.ward) set.add(a.ward); });
        return ['All', ...Array.from(set).sort()];
    }, [admissions]);

    // ── Summary KPI Counts ──
    const myPatientsCount = useMemo(() => {
        return admissions.filter(a =>
            (a.assignedNurses || []).some(n => String(n.nurseId?._id || n.nurseId) === String(userId) && n.status === 'ACTIVE')
        ).length;
    }, [admissions, userId]);

    const criticalVitalsCount = useMemo(() => {
        return Object.values(vitalsMap).filter(v => {
            const status = getVitalStatus(v);
            return status && status.some(s => s.status === 'critical');
        }).length;
    }, [vitalsMap]);

    // ── Filtered Admissions ──
    const filteredAdmissions = useMemo(() => {
        return admissions.filter(a => {
            // 1. Search text
            if (searchText) {
                const q = searchText.toLowerCase();
                const pName = typeof a.patientId === 'object' ? (a.patientId?.name || '').toLowerCase() : '';
                const pId = typeof a.patientId === 'object' ? (a.patientId?.patientId || a.patientId?.mrn || '').toLowerCase() : '';
                const docName = typeof a.doctorId === 'object' ? (a.doctorId?.name || '').toLowerCase() : '';
                const ward = (a.ward || '').toLowerCase();
                const bed = String(a.bedNumber || '').toLowerCase();

                if (!pName.includes(q) && !pId.includes(q) && !docName.includes(q) && !ward.includes(q) && !bed.includes(q)) {
                    return false;
                }
            }

            // 2. Ward tab
            if (activeWard !== 'All' && a.ward !== activeWard) {
                return false;
            }

            // 3. Workload filter
            if (workloadFilter === 'MY_PATIENTS') {
                const isAssigned = (a.assignedNurses || []).some(
                    n => String(n.nurseId?._id || n.nurseId) === String(userId) && n.status === 'ACTIVE'
                );
                if (!isAssigned) return false;
            } else if (workloadFilter === 'CRITICAL_VITALS') {
                const vit = vitalsMap[a._id];
                const status = getVitalStatus(vit);
                const hasCritical = status && status.some(s => s.status === 'critical');
                if (!hasCritical) return false;
            } else if (workloadFilter === 'DISCHARGE_PENDING') {
                if (!a.dischargeReadiness?.doctorDischargeOrdered) return false;
            } else if (workloadFilter === 'ALERTS') {
                const alerts = alertsMap[a._id] || [];
                if (alerts.length === 0) return false;
            }

            return true;
        });
    }, [admissions, searchText, activeWard, workloadFilter, vitalsMap, alertsMap, userId]);

    return (
        <ScrollView style={styles.screenScroll} contentContainerStyle={styles.container}>
            {/* ── Top Bar ── */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={styles.tagWrap}>
                        <Text style={styles.tagText}>IPD Clinical Operations</Text>
                    </View>
                    <Text style={styles.headerTitle}>Nurse Command Center</Text>
                    <Text style={styles.headerSubtitle}>
                        Logged in as <Text style={{ fontWeight: '700', color: '#1e293b' }}>{userName}</Text> • {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.refreshBtn, loading && styles.btnDisabled]}
                    onPress={fetchDashboardData}
                    disabled={loading}
                    activeOpacity={0.7}
                >
                    <Feather name="refresh-cw" size={14} color="#3b82f6" />
                    <Text style={styles.refreshBtnText}>Refresh Live</Text>
                </TouchableOpacity>
            </View>

            {/* ── KPI Operations Summary Bar ── */}
            <View style={styles.statsRow}>
                {/* 1. Total Inpatients */}
                <TouchableOpacity
                    style={[styles.statCard, workloadFilter === 'ALL' && styles.statCardActive]}
                    onPress={() => setWorkloadFilter('ALL')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statIconWrap, { backgroundColor: '#eff6ff' }]}>
                        <Feather name="users" size={18} color="#2563eb" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{admissions.length}</Text>
                        <Text style={styles.statLabel}>Total Inpatients</Text>
                    </View>
                </TouchableOpacity>

                {/* 2. Assigned to Me */}
                <TouchableOpacity
                    style={[styles.statCard, workloadFilter === 'MY_PATIENTS' && styles.statCardActive]}
                    onPress={() => setWorkloadFilter('MY_PATIENTS')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statIconWrap, { backgroundColor: '#ecfdf5' }]}>
                        <Feather name="user-check" size={18} color="#059669" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{myPatientsCount}</Text>
                        <Text style={styles.statLabel}>Assigned to Me</Text>
                    </View>
                </TouchableOpacity>

                {/* 3. Critical Vitals */}
                <TouchableOpacity
                    style={[styles.statCard, workloadFilter === 'CRITICAL_VITALS' && styles.statCardActive]}
                    onPress={() => setWorkloadFilter('CRITICAL_VITALS')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statIconWrap, { backgroundColor: '#fee2e2' }]}>
                        <Feather name="activity" size={18} color="#dc2626" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{criticalVitalsCount}</Text>
                        <Text style={styles.statLabel}>Critical Vitals</Text>
                    </View>
                </TouchableOpacity>

                {/* 4. Meds Due */}
                <View style={styles.statCard}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#fef3c7' }]}>
                        <Feather name="droplet" size={18} color="#d97706" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{operationsMetrics?.medsDueCount || 0}</Text>
                        <Text style={styles.statLabel}>Meds Due</Text>
                    </View>
                </View>

                {/* 5. Overdue Tasks */}
                <View style={styles.statCard}>
                    <View style={[styles.statIconWrap, { backgroundColor: '#f3e8ff' }]}>
                        <Feather name="check-square" size={18} color="#9333ea" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{operationsMetrics?.overdueTasksCount || 0}</Text>
                        <Text style={styles.statLabel}>Overdue Tasks</Text>
                    </View>
                </View>

                {/* 6. Discharge Pending */}
                <TouchableOpacity
                    style={[styles.statCard, workloadFilter === 'DISCHARGE_PENDING' && styles.statCardActive]}
                    onPress={() => setWorkloadFilter('DISCHARGE_PENDING')}
                    activeOpacity={0.7}
                >
                    <View style={[styles.statIconWrap, { backgroundColor: '#ffedd5' }]}>
                        <Feather name="log-out" size={18} color="#ea580c" />
                    </View>
                    <View>
                        <Text style={styles.statNum}>{operationsMetrics?.dischargePendingCount || 0}</Text>
                        <Text style={styles.statLabel}>Discharge Pending</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* ── Filters & Search Toolbar ── */}
            <View style={styles.toolbar}>
                <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patient, UHID, MRN, ward, bed, doctor..."
                        placeholderTextColor="#94a3b8"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Feather name="x" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wardTabsRow}>
                    {wards.map(w => {
                        const count = w === 'All' ? admissions.length : admissions.filter(a => a.ward === w).length;
                        const isActive = activeWard === w;
                        return (
                            <TouchableOpacity
                                key={w}
                                style={[styles.wardTab, isActive && styles.wardTabActive]}
                                onPress={() => setActiveWard(w)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.wardTabText, isActive && styles.wardTabTextActive]}>{w}</Text>
                                <View style={[styles.wardCountBadge, isActive && styles.wardCountBadgeActive]}>
                                    <Text style={[styles.wardCountText, isActive && styles.wardCountTextActive]}>{count}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── Patient Cards Grid ── */}
            {loading && admissions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.emptySubText}>Loading active inpatients...</Text>
                </View>
            ) : filteredAdmissions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={{ fontSize: 44, marginBottom: 12 }}>🏥</Text>
                    <Text style={styles.emptyTitle}>No admitted patients matching criteria</Text>
                    <Text style={styles.emptySubText}>
                        {searchText || activeWard !== 'All' || workloadFilter !== 'ALL'
                            ? 'Try adjusting your search query or filters.'
                            : 'All beds are currently available.'}
                    </Text>
                </View>
            ) : (
                <View style={[styles.cardsGrid, isDesktop ? styles.cardsGridDesktop : styles.cardsGridMobile]}>
                    {filteredAdmissions.map((adm) => {
                        const patient = adm.patientId || {};
                        const patientName = typeof patient === 'object' ? (patient.name || 'Unknown Patient') : 'Unknown';
                        const patientUid = typeof patient === 'object' ? (patient.patientId || patient.mrn || '') : '';
                        const doctor = adm.doctorId || {};
                        const doctorName = typeof doctor === 'object' ? (doctor.name || 'Not Assigned') : 'Not Assigned';
                        const vitals = vitalsMap[adm._id];
                        const vitalStatus = getVitalStatus(vitals);
                        const alerts = alertsMap[adm._id] || [];
                        const days = daysSince(adm.admissionDate);
                        const wardStyle = getWardBadgeStyle(adm.ward);

                        // Active Assigned Nurse
                        const activeAssignments = (adm.assignedNurses || []).filter(n => n.status === 'ACTIVE');
                        const assignedNurseNames = activeAssignments.map(a => {
                            if (typeof a.nurseId === 'object' && a.nurseId?.name) return a.nurseId.name;
                            const found = hospitalNurses.find(hn => String(hn._id) === String(a.nurseId));
                            return found ? found.name : 'Nurse';
                        });

                        const isDischargeOrdered = !!adm.dischargeReadiness?.doctorDischargeOrdered;
                        const isNursingCleared = !!adm.dischargeReadiness?.nursingClearance;

                        return (
                            <View key={adm._id} style={styles.patientCard}>
                                {/* Head */}
                                <View style={styles.cardHead}>
                                    <View style={styles.patientAvatar}>
                                        <Text style={styles.avatarText}>{getInitials(patientName)}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                                        <Text style={styles.patientNameText} numberOfLines={1}>{patientName}</Text>
                                        <Text style={styles.patientSubText} numberOfLines={1}>
                                            {patientUid ? `${patientUid}` : ''}
                                            {patient.gender ? ` • ${patient.gender}` : ''}
                                            {patient.age ? ` • ${patient.age} yrs` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                        <View style={[styles.wardBadge, { backgroundColor: wardStyle.bg, borderColor: wardStyle.border }]}>
                                            <Text style={[styles.wardBadgeText, { color: wardStyle.text }]}>{adm.ward || 'Ward'}</Text>
                                        </View>
                                        <View style={styles.bedBadge}>
                                            <Text style={styles.bedBadgeText}>🛏️ {adm.bedNumber || '—'}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Body */}
                                <View style={styles.cardBody}>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Attending:</Text>
                                        <Text style={styles.infoValue}>Dr. {doctorName}</Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Admitted:</Text>
                                        <Text style={styles.infoValue}>
                                            {adm.admissionDate ? new Date(adm.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                            <Text style={styles.daysBadge}> ({days}d)</Text>
                                        </Text>
                                    </View>

                                    {/* Care Nurse Row */}
                                    <View style={styles.nurseRow}>
                                        <Text style={styles.infoLabel}>Care Nurse:</Text>
                                        {assignedNurseNames.length > 0 ? (
                                            <View style={styles.nurseNameBadge}>
                                                <Feather name="user-check" size={12} color="#047857" style={{ marginRight: 4 }} />
                                                <Text style={styles.nurseNameText} numberOfLines={1}>{assignedNurseNames.join(', ')}</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.assignLinkBtn}
                                                onPress={() => setAssignModal({ open: true, admission: adm, nurseId: '', shift: 'Morning', notes: '' })}
                                            >
                                                <Text style={styles.assignLinkBtnText}>+ Assign Nurse</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Vitals Pills */}
                                    {vitalStatus && (
                                        <View style={styles.vitalsRow}>
                                            {vitalStatus.map((v, vi) => {
                                                const isCrit = v.status === 'critical';
                                                const isWarn = v.status === 'warning';
                                                const pillBg = isCrit ? '#fee2e2' : isWarn ? '#fef3c7' : '#f0fdf4';
                                                const pillText = isCrit ? '#dc2626' : isWarn ? '#d97706' : '#16a34a';
                                                return (
                                                    <View key={vi} style={[styles.vitalPill, { backgroundColor: pillBg }]}>
                                                        <Text style={[styles.vitalPillText, { color: pillText }]}>{v.label}</Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}

                                    {/* Alerts / Discharge Badge */}
                                    {(alerts.length > 0 || isDischargeOrdered) && (
                                        <View style={styles.alertsRow}>
                                            {isDischargeOrdered && (
                                                <View style={[styles.alertPill, { backgroundColor: isNursingCleared ? '#dcfce7' : '#ffedd5' }]}>
                                                    <Text style={[styles.alertPillText, { color: isNursingCleared ? '#15803d' : '#c2410c' }]}>
                                                        {isNursingCleared ? '✓ Ready for Discharge' : '⚠️ Discharge Ordered'}
                                                    </Text>
                                                </View>
                                            )}
                                            {alerts.slice(0, 2).map((alt, ai) => (
                                                <View key={ai} style={[styles.alertPill, { backgroundColor: '#fee2e2' }]}>
                                                    <Text style={[styles.alertPillText, { color: '#b91c1c' }]}>{alt.title}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* Foot Actions */}
                                <View style={styles.cardFoot}>
                                    <TouchableOpacity
                                        style={styles.changeNurseBtn}
                                        onPress={() => setAssignModal({ open: true, admission: adm, nurseId: '', shift: 'Morning', notes: '' })}
                                    >
                                        <Feather name="user-check" size={13} color="#475569" style={{ marginRight: 4 }} />
                                        <Text style={styles.changeNurseBtnText}>
                                            {assignedNurseNames.length > 0 ? 'Change Nurse' : 'Assign'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.openWorkspaceBtn}
                                        onPress={() => navigation.navigate('NursePatientWorkspace', { admissionId: adm._id })}
                                    >
                                        <Text style={styles.openWorkspaceBtnText}>Workspace</Text>
                                        <Feather name="chevron-right" size={14} color="#ffffff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* ── Assign Nurse Modal ── */}
            {assignModal.open && (
                <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setAssignModal({ open: false, admission: null, nurseId: '', shift: 'Morning', notes: '' })}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Assign Primary Care Nurse</Text>
                                <TouchableOpacity onPress={() => setAssignModal({ open: false, admission: null, nurseId: '', shift: 'Morning', notes: '' })}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ padding: 18 }}>
                                <View style={styles.modalField}>
                                    <Text style={styles.modalLabel}>Patient</Text>
                                    <Text style={styles.modalStaticVal}>
                                        {typeof assignModal.admission?.patientId === 'object' ? assignModal.admission.patientId?.name : 'Patient'}{' '}
                                        <Text style={{ color: '#64748b', fontSize: 13 }}>
                                            ({assignModal.admission?.ward} • Bed {assignModal.admission?.bedNumber})
                                        </Text>
                                    </Text>
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalLabel}>Select Nurse *</Text>
                                    <View style={styles.nursesPickerWrap}>
                                        {hospitalNurses.length === 0 ? (
                                            <Text style={{ color: '#94a3b8', padding: 8 }}>No registered nurses found</Text>
                                        ) : (
                                            hospitalNurses.map((n) => {
                                                const isSel = assignModal.nurseId === n._id;
                                                return (
                                                    <TouchableOpacity
                                                        key={n._id}
                                                        style={[styles.nurseSelectChip, isSel && styles.nurseSelectChipActive]}
                                                        onPress={() => setAssignModal(p => ({ ...p, nurseId: n._id }))}
                                                    >
                                                        <Text style={[styles.nurseSelectChipText, isSel && styles.nurseSelectChipTextActive]}>
                                                            {n.name} ({n.specialization || n.role || 'Staff Nurse'})
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </View>
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalLabel}>Assigned Shift</Text>
                                    <View style={styles.shiftsRow}>
                                        {SHIFTS.map((s) => {
                                            const isSel = assignModal.shift === s;
                                            return (
                                                <TouchableOpacity
                                                    key={s}
                                                    style={[styles.shiftChip, isSel && styles.shiftChipActive]}
                                                    onPress={() => setAssignModal(p => ({ ...p, shift: s }))}
                                                >
                                                    <Text style={[styles.shiftChipText, isSel && styles.shiftChipTextActive]}>{s}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={styles.modalField}>
                                    <Text style={styles.modalLabel}>Assignment Notes</Text>
                                    <TextInput
                                        style={styles.modalInputText}
                                        placeholder="Special instructions for the assigned nurse..."
                                        placeholderTextColor="#94a3b8"
                                        multiline
                                        numberOfLines={2}
                                        value={assignModal.notes}
                                        onChangeText={(val) => setAssignModal(p => ({ ...p, notes: val }))}
                                    />
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setAssignModal({ open: false, admission: null, nurseId: '', shift: 'Morning', notes: '' })}
                                >
                                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalSubmitBtn, (!assignModal.nurseId || submittingAssign) && styles.btnDisabled]}
                                    onPress={handleAssignSubmit}
                                    disabled={!assignModal.nurseId || submittingAssign}
                                >
                                    <Text style={styles.modalSubmitBtnText}>
                                        {submittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* ── Toast Message ── */}
            {toast && (
                <View style={[styles.toastBanner, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                    <Feather name={toast.type === 'error' ? 'alert-circle' : 'check-circle'} size={16} color={toast.type === 'error' ? '#dc2626' : '#16a34a'} />
                    <Text style={[styles.toastText, { color: toast.type === 'error' ? '#991b1b' : '#166534' }]}>{toast.message}</Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screenScroll: { flex: 1, backgroundColor: '#f8fafc' },
    container: { padding: 20, paddingBottom: 40 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    tagWrap: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
    tagText: { color: '#2563eb', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
    headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    refreshBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
    btnDisabled: { opacity: 0.6 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    statCard: { flex: 1, minWidth: 150, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
    statCardActive: { borderColor: '#3b82f6', backgroundColor: '#f0f9ff' },
    statIconWrap: { width: 38, height: 38, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    statLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginTop: 2 },
    toolbar: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 20, gap: 12 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, height: 40 },
    searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
    wardTabsRow: { flexDirection: 'row', gap: 8 },
    wardTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9' },
    wardTabActive: { backgroundColor: '#2563eb' },
    wardTabText: { fontSize: 12, fontWeight: '600', color: '#475569' },
    wardTabTextActive: { color: '#ffffff', fontWeight: '700' },
    wardCountBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    wardCountBadgeActive: { backgroundColor: '#1d4ed8' },
    wardCountText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    wardCountTextActive: { color: '#ffffff' },
    emptyContainer: { backgroundColor: '#ffffff', borderRadius: 12, padding: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
    emptySubText: { fontSize: 13, color: '#64748b', textAlign: 'center' },
    cardsGrid: { gap: 16 },
    cardsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
    cardsGridMobile: { flexDirection: 'column' },
    patientCard: { width: '100%', maxWidth: 420, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
    cardHead: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    patientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
    patientNameText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    patientSubText: { fontSize: 12, color: '#64748b', marginTop: 2 },
    wardBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    wardBadgeText: { fontSize: 10, fontWeight: '800' },
    bedBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    bedBadgeText: { fontSize: 11, fontWeight: '700', color: '#334155' },
    cardBody: { padding: 14, gap: 8 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    infoValue: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    daysBadge: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    nurseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    nurseNameBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, maxWidth: 200 },
    nurseNameText: { fontSize: 11, fontWeight: '700', color: '#047857' },
    assignLinkBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    assignLinkBtnText: { color: '#2563eb', fontSize: 11, fontWeight: '700' },
    vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    vitalPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    vitalPillText: { fontSize: 11, fontWeight: '800' },
    alertsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    alertPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
    alertPillText: { fontSize: 10, fontWeight: '800' },
    cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
    changeNurseBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    changeNurseBtnText: { color: '#475569', fontSize: 12, fontWeight: '700' },
    openWorkspaceBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
    openWorkspaceBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    modalField: { marginBottom: 14 },
    modalLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
    modalStaticVal: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    nursesPickerWrap: { gap: 6, maxHeight: 150 },
    nurseSelectChip: { padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    nurseSelectChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
    nurseSelectChipText: { fontSize: 12, color: '#334155' },
    nurseSelectChipTextActive: { color: '#1d4ed8', fontWeight: '700' },
    shiftsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    shiftChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    shiftChipActive: { borderColor: '#2563eb', backgroundColor: '#2563eb' },
    shiftChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    shiftChipTextActive: { color: '#ffffff', fontWeight: '700' },
    modalInputText: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 10, fontSize: 13, color: '#0f172a', textAlignVertical: 'top', minHeight: 60 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    modalCancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#e2e8f0' },
    modalCancelBtnText: { color: '#475569', fontSize: 13, fontWeight: '700' },
    modalSubmitBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: '#2563eb' },
    modalSubmitBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    toastBanner: { position: 'absolute', bottom: 24, left: 24, right: 24, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 999 },
    toastSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
    toastError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
    toastText: { fontSize: 13, fontWeight: '700' }
});

export default NurseDashboard;
