import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    ActivityIndicator,
    Platform,
    StyleSheet,
    Animated,
    Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { doctorAPI, reportAPI } from '../../utils/api';

const { width } = Dimensions.get('window');

const NurseOPDQueue = () => {
    const navigation = useNavigation();

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('today'); // 'today', 'waiting', 'in_consultation', 'completed', 'all'
    const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('ALL');
    const [doctorModalOpen, setDoctorModalOpen] = useState(false);

    // Modals
    const [vitalsModal, setVitalsModal] = useState({ open: false, appt: null });
    const [vitalsForm, setVitalsForm] = useState({
        weight: '',
        height: '',
        bmi: '',
        systolicBP: '',
        diastolicBP: '',
        pulse: '',
        temperature: '',
        spo2: '',
        respiratoryRate: '',
        chiefComplaint: '',
        notes: ''
    });
    const [savingVitals, setSavingVitals] = useState(false);

    const [uploadModal, setUploadModal] = useState({ open: false, appt: null });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadingReport, setUploadingReport] = useState(false);

    const [toast, setToast] = useState(null);

    // Refresh animation spin
    const spinAnim = useRef(new Animated.Value(0)).current;

    const startSpin = () => {
        spinAnim.setValue(0);
        Animated.timing(spinAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: Platform.OS !== 'web'
        }).start(() => {
            if (refreshing) startSpin();
        });
    };

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ── Data Fetching ──
    const fetchQueue = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
            startSpin();
        } else {
            setLoading(true);
        }
        try {
            const res = await doctorAPI.getAllAppointments();
            if (res && res.success) {
                setAppointments(res.appointments || []);
            } else if (res && Array.isArray(res)) {
                setAppointments(res);
            } else {
                showToast(res?.message || 'Error loading appointments', 'error');
            }
        } catch (err) {
            console.error('Queue fetch error:', err);
            showToast(err.response?.data?.message || 'Failed to load OPD queue', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // ── Auto Calculate BMI ──
    useEffect(() => {
        const w = parseFloat(vitalsForm.weight);
        const h = parseFloat(vitalsForm.height) / 100; // cm to meters
        if (w > 0 && h > 0) {
            setVitalsForm(v => ({ ...v, bmi: (w / (h * h)).toFixed(1) }));
        } else {
            setVitalsForm(v => ({ ...v, bmi: '' }));
        }
    }, [vitalsForm.weight, vitalsForm.height]);

    // ── Open Vitals Modal ──
    const handleOpenVitals = (appt) => {
        const patientData = appt.userId || appt.clinicPatientId || {};
        const profile = patientData.fertilityProfile || {};

        let sBP = '';
        let dBP = '';
        if (profile.historyBp) {
            const parts = String(profile.historyBp).split('/');
            sBP = parts[0] || '';
            dBP = parts[1] || '';
        }

        setVitalsForm({
            weight: profile.weight ? String(profile.weight) : '',
            height: profile.height ? String(profile.height) : '',
            bmi: '',
            systolicBP: sBP,
            diastolicBP: dBP,
            pulse: profile.historyPulse ? String(profile.historyPulse) : '',
            temperature: profile.temperature ? String(profile.temperature) : '',
            spo2: profile.spo2 ? String(profile.spo2) : '',
            respiratoryRate: profile.respiratoryRate ? String(profile.respiratoryRate) : '',
            chiefComplaint: appt.reason || '',
            notes: profile.triageNotes || ''
        });
        setVitalsModal({ open: true, appt });
    };

    // ── Save OPD Vitals ──
    const handleSaveVitalsSubmit = async () => {
        if (!vitalsModal.appt) return;
        const appt = vitalsModal.appt;
        const patientId = appt.userId?._id || appt.clinicPatientId?._id || appt.patientId;

        if (!patientId) {
            showToast('Patient record not found', 'error');
            return;
        }

        setSavingVitals(true);
        try {
            const bpStr = vitalsForm.systolicBP && vitalsForm.diastolicBP
                ? `${vitalsForm.systolicBP}/${vitalsForm.diastolicBP}`
                : vitalsForm.systolicBP || '';

            const profileData = {
                height: vitalsForm.height,
                weight: vitalsForm.weight,
                historyBp: bpStr,
                historyPulse: vitalsForm.pulse,
                temperature: vitalsForm.temperature,
                spo2: vitalsForm.spo2,
                respiratoryRate: vitalsForm.respiratoryRate,
                triageNotes: vitalsForm.notes
            };

            await doctorAPI.updatePatientProfile(patientId, profileData);
            showToast('OPD triage vitals recorded successfully');
            setVitalsModal({ open: false, appt: null });
            fetchQueue(true);
        } catch (err) {
            console.error('Error saving vitals:', err);
            showToast(err.response?.data?.message || 'Failed to save vitals', 'error');
        } finally {
            setSavingVitals(false);
        }
    };

    // ── Pick Document for Report ──
    const handlePickDocument = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setUploadFile(res.assets[0]);
            }
        } catch (err) {
            console.error('Document picker error:', err);
        }
    };

    // ── Upload Diagnostic Report ──
    const handleUploadReportSubmit = async () => {
        if (!uploadFile || !uploadModal.appt) return;
        setUploadingReport(true);
        try {
            const formData = new FormData();
            if (Platform.OS === 'web' && uploadFile.file) {
                formData.append('reportFile', uploadFile.file);
            } else {
                formData.append('reportFile', {
                    uri: uploadFile.uri,
                    name: uploadFile.name || 'diagnostic_report.pdf',
                    type: uploadFile.mimeType || 'application/octet-stream'
                });
            }
            formData.append('appointmentId', uploadModal.appt._id);

            const res = await reportAPI.uploadReport(formData);
            if (res && (res.success || res.report)) {
                const uploadedFile = res.report || res;
                const patientId = uploadModal.appt.userId?._id || uploadModal.appt.clinicPatientId?._id || uploadModal.appt.patientId;
                const existingReports = uploadModal.appt.userId?.fertilityProfile?.previousReports || [];

                const newReport = {
                    fileName: uploadFile.name || 'Report',
                    url: uploadedFile.url,
                    date: new Date().toISOString()
                };

                await doctorAPI.updatePatientProfile(patientId, {
                    previousReports: [...existingReports, newReport]
                });

                showToast('Diagnostic report attached to patient profile');
                setUploadModal({ open: false, appt: null });
                setUploadFile(null);
                fetchQueue(true);
            } else {
                showToast(res?.message || 'Upload failed', 'error');
            }
        } catch (err) {
            console.error('Upload report error:', err);
            showToast(err.response?.data?.message || 'Error uploading report', 'error');
        } finally {
            setUploadingReport(false);
        }
    };

    // ── Date and Time formatting ──
    const todayStr = new Date().toISOString().split('T')[0];

    const isApptToday = (dateVal) => {
        if (!dateVal) return false;
        try {
            return new Date(dateVal).toISOString().split('T')[0] === todayStr;
        } catch {
            return false;
        }
    };

    // ── Metrics calculation ──
    const todayAppointments = useMemo(() => {
        return appointments.filter(a => isApptToday(a.appointmentDate));
    }, [appointments, todayStr]);

    const stats = useMemo(() => {
        const totalToday = todayAppointments.length;
        const waiting = todayAppointments.filter(a =>
            ['pending', 'confirmed', 'checked_in', 'waiting'].includes((a.status || '').toLowerCase())
        ).length;
        const inConsultation = todayAppointments.filter(a =>
            ['in_consultation', 'in-consultation', 'in-progress'].includes((a.status || '').toLowerCase())
        ).length;
        const completed = todayAppointments.filter(a =>
            (a.status || '').toLowerCase() === 'completed'
        ).length;
        return { totalToday, waiting, inConsultation, completed };
    }, [todayAppointments]);

    // Unique Doctors for Filter
    const doctorsList = useMemo(() => {
        const set = new Map();
        appointments.forEach(a => {
            if (a.doctorId?._id && a.doctorId?.name) {
                set.set(String(a.doctorId._id), a.doctorId.name);
            }
        });
        return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
    }, [appointments]);

    // ── Filtered List ──
    const filteredQueue = useMemo(() => {
        return appointments.filter(a => {
            // Tab filtering
            const isToday = isApptToday(a.appointmentDate);
            const statusLower = (a.status || '').toLowerCase();

            if (activeTab === 'today' && !isToday) return false;
            if (activeTab === 'waiting') {
                if (!isToday) return false;
                if (!['pending', 'confirmed', 'checked_in', 'waiting'].includes(statusLower)) return false;
            }
            if (activeTab === 'in_consultation') {
                if (!isToday) return false;
                if (!['in_consultation', 'in-consultation', 'in-progress'].includes(statusLower)) return false;
            }
            if (activeTab === 'completed') {
                if (statusLower !== 'completed') return false;
            }

            // Doctor filter
            if (selectedDoctorFilter !== 'ALL') {
                if (String(a.doctorId?._id) !== String(selectedDoctorFilter)) return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const pName = String(a.userId?.name || a.patientName || '').toLowerCase();
                const pPhone = String(a.userId?.phone || a.phone || '');
                const pMRN = String(a.userId?.patientId || a.userId?.uhid || a.clinicPatientId?.patientUid || '').toLowerCase();
                const dName = String(a.doctorId?.name || '').toLowerCase();
                const dept = String(a.department || a.serviceName || '').toLowerCase();

                if (!pName.includes(q) && !pPhone.includes(q) && !pMRN.includes(q) && !dName.includes(q) && !dept.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [appointments, activeTab, selectedDoctorFilter, searchQuery, todayStr]);

    const getStatusStyle = (status) => {
        const s = (status || '').toLowerCase().replace(/\s+/g, '-');
        if (s === 'confirmed' || s === 'checked_in' || s === 'checked-in') {
            return { bg: '#dcfce7', text: '#166534' };
        }
        if (s === 'pending' || s === 'waiting') {
            return { bg: '#fef3c7', text: '#92400e' };
        }
        if (s === 'in_consultation' || s === 'in-consultation' || s === 'in-progress') {
            return { bg: '#f3e8ff', text: '#6b21a8' };
        }
        if (s === 'completed') {
            return { bg: '#eff6ff', text: '#1e40af' };
        }
        if (s === 'cancelled') {
            return { bg: '#fee2e2', text: '#991b1b' };
        }
        return { bg: '#f1f5f9', text: '#475569' };
    };

    const selectedDocObj = doctorsList.find(d => d.id === selectedDoctorFilter);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* ── Toast Notification ── */}
            {toast && (
                <View style={[styles.toastBox, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                    <Feather
                        name={toast.type === 'error' ? 'alert-circle' : 'check-circle'}
                        size={16}
                        color="#ffffff"
                    />
                    <Text style={styles.toastText}>{toast.message}</Text>
                </View>
            )}

            {/* ── Top Header Banner ── */}
            <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerCard}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.headerTitle}>OPD Patient Queue</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>NURSE</Text>
                        </View>
                    </View>
                    <Text style={styles.headerSubtitle}>
                        Real-time out-patient triage, pre-consultation vitals recording & clinic flow monitoring
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => fetchQueue(true)}
                    disabled={refreshing}
                    activeOpacity={0.8}
                >
                    <Animated.View style={{ transform: [{ rotate: refreshing ? spinInterpolate : '0deg' }] }}>
                        <Feather name="refresh-cw" size={15} color="#ffffff" />
                    </Animated.View>
                    <Text style={styles.refreshBtnText}>{refreshing ? 'Refreshing...' : 'Refresh Queue'}</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* ── KPI Stats Cards ── */}
            <View style={styles.kpiGrid}>
                {/* Blue: Today's OPD Total */}
                <View style={[styles.kpiCard, styles.kpiBlue]}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#eff6ff' }]}>
                        <Feather name="users" size={22} color="#2563eb" />
                    </View>
                    <View style={styles.kpiDetails}>
                        <Text style={styles.kpiVal}>{stats.totalToday}</Text>
                        <Text style={styles.kpiLbl}>TODAY'S OPD TOTAL</Text>
                    </View>
                </View>

                {/* Amber: Waiting / In Queue */}
                <View style={[styles.kpiCard, styles.kpiAmber]}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#fffbeb' }]}>
                        <Feather name="clock" size={22} color="#d97706" />
                    </View>
                    <View style={styles.kpiDetails}>
                        <Text style={styles.kpiVal}>{stats.waiting}</Text>
                        <Text style={styles.kpiLbl}>WAITING / IN QUEUE</Text>
                    </View>
                </View>

                {/* Purple: In Consultation */}
                <View style={[styles.kpiCard, styles.kpiPurple]}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#faf5ff' }]}>
                        <Feather name="activity" size={22} color="#7c3aed" />
                    </View>
                    <View style={styles.kpiDetails}>
                        <Text style={styles.kpiVal}>{stats.inConsultation}</Text>
                        <Text style={styles.kpiLbl}>IN CONSULTATION</Text>
                    </View>
                </View>

                {/* Emerald: Completed Today */}
                <View style={[styles.kpiCard, styles.kpiEmerald]}>
                    <View style={[styles.kpiIcon, { backgroundColor: '#f0fdf4' }]}>
                        <Feather name="check-circle" size={22} color="#059669" />
                    </View>
                    <View style={styles.kpiDetails}>
                        <Text style={styles.kpiVal}>{stats.completed}</Text>
                        <Text style={styles.kpiLbl}>COMPLETED TODAY</Text>
                    </View>
                </View>
            </View>

            {/* ── Filter Toolbar ── */}
            <View style={styles.toolbar}>
                {/* Search Box */}
                <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patient name, MRN, phone, doctor..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                            <Feather name="x" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Status Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabGroup}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'today' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('today')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'today' && styles.tabBtnTextActive]}>
                            Today's Queue ({stats.totalToday})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'waiting' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('waiting')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'waiting' && styles.tabBtnTextActive]}>
                            Waiting ({stats.waiting})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'in_consultation' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('in_consultation')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'in_consultation' && styles.tabBtnTextActive]}>
                            In Consultation ({stats.inConsultation})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('completed')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'completed' && styles.tabBtnTextActive]}>
                            Completed ({stats.completed})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
                            All OPD History
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Doctor Filter Selector */}
                {doctorsList.length > 0 && (
                    <TouchableOpacity
                        style={styles.docFilterBtn}
                        onPress={() => setDoctorModalOpen(true)}
                        activeOpacity={0.8}
                    >
                        <Feather name="filter" size={14} color="#64748b" style={{ marginRight: 6 }} />
                        <Text style={styles.docFilterText} numberOfLines={1}>
                            {selectedDoctorFilter === 'ALL' ? 'All Attending Doctors' : `Dr. ${selectedDocObj?.name || 'Selected'}`}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Table Card ── */}
            <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderTitle}>
                        📋 OPD Patient Queue ({filteredQueue.length})
                    </Text>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#0284c7" />
                        <Text style={styles.loadingText}>Loading out-patient queue...</Text>
                    </View>
                ) : filteredQueue.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Feather name="users" size={44} color="#94a3b8" />
                        <Text style={styles.emptyTitle}>No OPD Patients Found</Text>
                        <Text style={styles.emptySubtitle}>There are no out-patient consultations matching your selected filters.</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={styles.tableWrapper}>
                            {/* Header row */}
                            <View style={styles.tHeadRow}>
                                <Text style={[styles.thCell, { width: 44 }]}>#</Text>
                                <Text style={[styles.thCell, { width: 230 }]}>PATIENT DETAILS</Text>
                                <Text style={[styles.thCell, { width: 130 }]}>CONTACT</Text>
                                <Text style={[styles.thCell, { width: 190 }]}>DOCTOR ASSIGNED</Text>
                                <Text style={[styles.thCell, { width: 110 }]}>SLOT / TIME</Text>
                                <Text style={[styles.thCell, { width: 90 }]}>DATE</Text>
                                <Text style={[styles.thCell, { width: 130 }]}>STATUS</Text>
                                <Text style={[styles.thCell, { width: 200 }]}>TRIAGE & VITALS</Text>
                                <Text style={[styles.thCell, { width: 220, textAlign: 'center' }]}>NURSE ACTIONS</Text>
                            </View>

                            {/* Data Rows */}
                            {filteredQueue.map((appt, idx) => {
                                const p = appt.userId || appt.clinicPatientId || {};
                                const patientName = p.name || appt.patientName || 'Walk-in Patient';
                                const mrn = p.patientId || p.uhid || p.mrn || '—';
                                const doctorName = appt.doctorId?.name ? `Dr. ${appt.doctorId.name}` : 'Not Assigned';
                                const dept = appt.department || appt.serviceName || 'OPD Consultation';
                                const profile = p.fertilityProfile || {};
                                const hasVitals = !!(profile.historyBp || profile.historyPulse || profile.weight || profile.temperature);
                                const pid = p._id || p.patientId || appt.patientId || appt._id;
                                const statusColors = getStatusStyle(appt.status);

                                return (
                                    <View key={appt._id || idx} style={[styles.tRow, idx % 2 === 1 && styles.tRowEven]}>
                                        <Text style={[styles.tdCell, { width: 44, fontWeight: '700', color: '#64748b' }]}>
                                            {idx + 1}
                                        </Text>

                                        {/* Patient Details */}
                                        <View style={[styles.tdCell, { width: 230, flexDirection: 'row', alignItems: 'center' }]}>
                                            <View style={styles.patAvatar}>
                                                <Text style={styles.patAvatarText}>
                                                    {(patientName || 'P')[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.patName} numberOfLines={1}>{patientName}</Text>
                                                <Text style={styles.patMeta} numberOfLines={1}>
                                                    MRN: {mrn} {p.age ? `• ${p.age}y` : ''} {p.gender ? `• ${p.gender}` : ''}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Contact */}
                                        <View style={[styles.tdCell, { width: 130 }]}>
                                            <Text style={styles.contactText}>
                                                {p.phone || appt.phone || '—'}
                                            </Text>
                                        </View>

                                        {/* Doctor Assigned */}
                                        <View style={[styles.tdCell, { width: 190 }]}>
                                            <Text style={styles.docName} numberOfLines={1}>{doctorName}</Text>
                                            <Text style={styles.docDept} numberOfLines={1}>{dept}</Text>
                                        </View>

                                        {/* Slot / Time */}
                                        <View style={[styles.tdCell, { width: 110 }]}>
                                            <Text style={styles.slotTimeText}>
                                                {appt.appointmentTime || 'Queue Slot'}
                                            </Text>
                                        </View>

                                        {/* Date */}
                                        <View style={[styles.tdCell, { width: 90 }]}>
                                            <Text style={styles.dateText}>
                                                {appt.appointmentDate ? new Date(appt.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                                            </Text>
                                        </View>

                                        {/* Status */}
                                        <View style={[styles.tdCell, { width: 130 }]}>
                                            <View style={[styles.statusTag, { backgroundColor: statusColors.bg }]}>
                                                <Text style={[styles.statusTagText, { color: statusColors.text }]}>
                                                    {appt.status || 'Pending'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Triage & Vitals */}
                                        <View style={[styles.tdCell, { width: 200 }]}>
                                            {hasVitals ? (
                                                <TouchableOpacity
                                                    style={styles.vitalsSnapshot}
                                                    onPress={() => handleOpenVitals(appt)}
                                                    activeOpacity={0.7}
                                                >
                                                    {profile.historyBp ? <Text style={styles.vitalsPill}>BP: {profile.historyBp}</Text> : null}
                                                    {profile.historyPulse ? <Text style={styles.vitalsPill}>HR: {profile.historyPulse}</Text> : null}
                                                    {profile.temperature ? <Text style={styles.vitalsPill}>Temp: {profile.temperature}°F</Text> : null}
                                                    {profile.weight ? <Text style={styles.vitalsPill}>Wt: {profile.weight}kg</Text> : null}
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={() => handleOpenVitals(appt)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={styles.recordVitalsLink}>+ Record Vitals</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Nurse Actions */}
                                        <View style={[styles.tdCell, { width: 220, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}>
                                            <TouchableOpacity
                                                style={styles.actBtnOutline}
                                                onPress={() => handleOpenVitals(appt)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.actBtnOutlineText}>📊 Vitals</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.actBtnOutline}
                                                onPress={() => setUploadModal({ open: true, appt })}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.actBtnOutlineText}>📎 Report</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.actBtnPrimary}
                                                onPress={() => navigation.navigate('PatientProfile', { patientId: pid, department: dept })}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.actBtnPrimaryText}>🩺 Profile</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </View>

            {/* ── Doctor Filter Picker Modal ── */}
            <Modal
                visible={doctorModalOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setDoctorModalOpen(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setDoctorModalOpen(false)}
                >
                    <View style={styles.filterModalCard} onStartShouldSetResponder={() => true}>
                        <View style={styles.filterModalHeader}>
                            <Text style={styles.filterModalTitle}>Filter by Attending Doctor</Text>
                            <TouchableOpacity onPress={() => setDoctorModalOpen(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 320 }}>
                            <TouchableOpacity
                                style={[styles.filterDocOption, selectedDoctorFilter === 'ALL' && styles.filterDocOptionActive]}
                                onPress={() => { setSelectedDoctorFilter('ALL'); setDoctorModalOpen(false); }}
                            >
                                <Text style={[styles.filterDocOptionText, selectedDoctorFilter === 'ALL' && styles.filterDocOptionTextActive]}>
                                    All Attending Doctors
                                </Text>
                                {selectedDoctorFilter === 'ALL' && <Feather name="check" size={16} color="#0284c7" />}
                            </TouchableOpacity>
                            {doctorsList.map(doc => (
                                <TouchableOpacity
                                    key={doc.id}
                                    style={[styles.filterDocOption, selectedDoctorFilter === doc.id && styles.filterDocOptionActive]}
                                    onPress={() => { setSelectedDoctorFilter(doc.id); setDoctorModalOpen(false); }}
                                >
                                    <Text style={[styles.filterDocOptionText, selectedDoctorFilter === doc.id && styles.filterDocOptionTextActive]}>
                                        Dr. {doc.name}
                                    </Text>
                                    {selectedDoctorFilter === doc.id && <Feather name="check" size={16} color="#0284c7" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── OPD Vitals Intake Modal ── */}
            <Modal
                visible={vitalsModal.open}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setVitalsModal({ open: false, appt: null })}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>📊 Record Out-Patient Vitals & Intake</Text>
                                <Text style={styles.modalSubtitle}>
                                    Patient: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{vitalsModal.appt?.userId?.name || vitalsModal.appt?.patientName}</Text> (MRN: {vitalsModal.appt?.userId?.patientId || vitalsModal.appt?.userId?.uhid || '—'})
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setVitalsModal({ open: false, appt: null })}
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Modal Body */}
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.formGrid}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Systolic BP (mmHg)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 120"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.systolicBP}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, systolicBP: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Diastolic BP (mmHg)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 80"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.diastolicBP}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, diastolicBP: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Heart Rate (bpm)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 72"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.pulse}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, pulse: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Temperature (°F)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 98.6"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.temperature}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, temperature: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>SpO₂ (%)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 98"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.spo2}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, spo2: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Respiratory Rate (/min)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 16"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.respiratoryRate}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, respiratoryRate: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Weight (kg)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 68.5"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.weight}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, weight: t }))}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Height (cm)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        keyboardType="numeric"
                                        placeholder="e.g. 172"
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.height}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, height: t }))}
                                    />
                                </View>

                                {!!vitalsForm.bmi && (
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Calculated BMI</Text>
                                        <View style={styles.bmiDisplay}>
                                            <Text style={styles.bmiDisplayText}>{vitalsForm.bmi} kg/m²</Text>
                                        </View>
                                    </View>
                                )}

                                <View style={[styles.formGroup, styles.formGroupFull]}>
                                    <Text style={styles.formLabel}>Triage Observations / Chief Complaint</Text>
                                    <TextInput
                                        style={[styles.formInput, styles.formTextArea]}
                                        multiline={true}
                                        numberOfLines={3}
                                        placeholder="Patient presenting complaints, fever duration, allergies..."
                                        placeholderTextColor="#94a3b8"
                                        value={vitalsForm.notes}
                                        onChangeText={t => setVitalsForm(p => ({ ...p, notes: t }))}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.footerCancelBtn}
                                onPress={() => setVitalsModal({ open: false, appt: null })}
                            >
                                <Text style={styles.footerCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.footerSubmitBtn}
                                onPress={handleSaveVitalsSubmit}
                                disabled={savingVitals}
                            >
                                {savingVitals ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.footerSubmitBtnText}>💾 Save OPD Vitals</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Report Upload Modal ── */}
            <Modal
                visible={uploadModal.open}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setUploadModal({ open: false, appt: null })}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { maxWidth: 500 }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>📎 Upload Diagnostic Report</Text>
                                <Text style={styles.modalSubtitle}>
                                    Attach external lab report, scan, or investigation to {uploadModal.appt?.userId?.name}'s profile
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => setUploadModal({ open: false, appt: null })}
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.formLabel}>Select Report File (PDF / Image) *</Text>
                            <TouchableOpacity
                                style={styles.filePickerBox}
                                onPress={handlePickDocument}
                                activeOpacity={0.8}
                            >
                                <Feather name="upload-cloud" size={32} color="#0284c7" />
                                {uploadFile ? (
                                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                                        <Text style={styles.fileNameText} numberOfLines={1}>{uploadFile.name}</Text>
                                        <Text style={styles.fileSizeText}>
                                            {uploadFile.size ? `${(uploadFile.size / 1024).toFixed(1)} KB` : 'File ready'}
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={{ alignItems: 'center', marginTop: 8 }}>
                                        <Text style={styles.filePickPrompt}>Tap to select document or image</Text>
                                        <Text style={styles.filePickTypes}>PDF, PNG, JPG accepted</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.footerCancelBtn}
                                onPress={() => setUploadModal({ open: false, appt: null })}
                            >
                                <Text style={styles.footerCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.footerSubmitBtn, (!uploadFile || uploadingReport) && { opacity: 0.6 }]}
                                onPress={handleUploadReportSubmit}
                                disabled={!uploadFile || uploadingReport}
                            >
                                {uploadingReport ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.footerSubmitBtnText}>Upload & Attach</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 24,
        maxWidth: 1560,
        alignSelf: 'center',
        width: '100%',
    },
    toastBox: {
        position: 'absolute',
        top: 20,
        right: 24,
        zIndex: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    toastSuccess: {
        backgroundColor: '#10b981',
    },
    toastError: {
        backgroundColor: '#ef4444',
    },
    toastText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },

    // ── Header Banner ──
    headerCard: {
        borderRadius: 16,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 5,
    },
    headerLeft: {
        flex: 1,
        minWidth: 260,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    roleBadge: {
        backgroundColor: '#10b981',
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 6,
    },
    roleBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        marginTop: 6,
        fontSize: 13,
        color: '#94a3b8',
        lineHeight: 18,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 9,
        paddingHorizontal: 16,
    },
    refreshBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },

    // ── KPI Grid ──
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    kpiCard: {
        flex: 1,
        minWidth: 220,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    kpiBlue: {},
    kpiAmber: {},
    kpiPurple: {},
    kpiEmerald: {},
    kpiIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiDetails: {
        flexDirection: 'column',
    },
    kpiVal: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        lineHeight: 30,
    },
    kpiLbl: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
        marginTop: 3,
    },

    // ── Toolbar ──
    toolbar: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 20,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flex: 1,
        minWidth: 240,
        maxWidth: 380,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    searchClear: {
        padding: 2,
    },
    tabGroup: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        padding: 3,
        gap: 2,
    },
    tabBtn: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 7,
    },
    tabBtnActive: {
        backgroundColor: '#0f172a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        whiteSpace: 'nowrap',
    },
    tabBtnTextActive: {
        color: '#ffffff',
    },
    docFilterBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 9,
        paddingVertical: 7,
        paddingHorizontal: 12,
    },
    docFilterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        maxWidth: 160,
    },

    // ── Table Card ──
    tableCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 3,
        marginBottom: 30,
    },
    tableHeader: {
        paddingVertical: 16,
        paddingHorizontal: 22,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fafafa',
    },
    tableHeaderTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    loadingBox: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyBox: {
        paddingVertical: 56,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        marginTop: 6,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 360,
    },
    tableWrapper: {
        minWidth: 1350,
    },
    tHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    thCell: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 0.5,
    },
    tRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    tRowEven: {
        backgroundColor: '#fafbfc',
    },
    tdCell: {
        paddingRight: 8,
    },
    patAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#0284c7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    patAvatarText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 14,
    },
    patName: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    patMeta: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    contactText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },
    docName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    docDept: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    slotTimeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    dateText: {
        fontSize: 12,
        color: '#64748b',
    },
    statusTag: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    statusTagText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
    vitalsSnapshot: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        backgroundColor: '#f1f5f9',
        padding: 5,
        borderRadius: 6,
    },
    vitalsPill: {
        fontSize: 11,
        color: '#334155',
        fontWeight: '600',
        marginRight: 4,
    },
    recordVitalsLink: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284c7',
    },
    actBtnOutline: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    actBtnOutlineText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
    },
    actBtnPrimary: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#0284c7',
    },
    actBtnPrimaryText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#ffffff',
    },

    // ── Modal Styles ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    filterModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    filterModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    filterModalTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    filterDocOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    filterDocOptionActive: {
        backgroundColor: '#f0f9ff',
    },
    filterDocOptionText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#334155',
    },
    filterDocOptionTextActive: {
        color: '#0284c7',
        fontWeight: '700',
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 620,
        maxHeight: '90%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalSubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748b',
    },
    closeBtn: {
        padding: 4,
    },
    modalBody: {
        padding: 20,
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    formGroup: {
        flexBasis: '47%',
        flexGrow: 1,
    },
    formGroupFull: {
        flexBasis: '100%',
    },
    formLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    formTextArea: {
        height: 70,
        textAlignVertical: 'top',
    },
    bmiDisplay: {
        paddingVertical: 9,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        justifyContent: 'center',
    },
    bmiDisplayText: {
        fontWeight: '800',
        color: '#0f172a',
        fontSize: 13,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        gap: 10,
    },
    footerCancelBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
    },
    footerCancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    footerSubmitBtn: {
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 8,
        backgroundColor: '#0284c7',
    },
    footerSubmitBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#ffffff',
    },
    filePickerBox: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#0284c7',
        borderRadius: 12,
        backgroundColor: '#f0f9ff',
        paddingVertical: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    filePickPrompt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0284c7',
    },
    filePickTypes: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    fileNameText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    fileSizeText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
});

export default NurseOPDQueue;
