import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Dimensions,
    TextInput,
    Modal,
    ActivityIndicator,
    Alert,
    Platform,
    Animated,
    Easing
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { receptionAPI, reportAPI, consentAPI } from '../../utils/api';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const PAGE_CHUNK_SIZE = 15;

const ReceptionPatients = () => {
    const navigation = useNavigation();

    // Data states
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loadingAppts, setLoadingAppts] = useState(true);
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Search and tab states
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'today' or 'all'

    // Advanced Filter states
    const [filterDoctor, setFilterDoctor] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [showFilterPopover, setShowFilterPopover] = useState(false);

    // Live Real-Time Clock & Pulse
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Refresh animation
    const spinValue = useRef(new Animated.Value(0)).current;
    const startSpin = () => {
        spinValue.setValue(0);
        Animated.timing(spinValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.linear,
            useNativeDriver: true,
        }).start();
    };
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    // Modals state
    const [uploadModal, setUploadModal] = useState({ open: false, apptId: null, patientName: '', patientId: null });
    const [selectedReportFile, setSelectedReportFile] = useState(null);
    const [uploadingReport, setUploadingReport] = useState(false);

    const [consentModal, setConsentModal] = useState({ open: false, patientId: null, patientName: '', consents: [], loading: false, uploading: false });
    const [selectedConsentFile, setSelectedConsentFile] = useState(null);

    // Data Fetching
    const fetchAppointments = useCallback(async () => {
        try {
            const res = await receptionAPI.getAllAppointments({ all: 'true' });
            if (res?.success) {
                setAppointments(res.appointments || []);
            }
        } catch (error) {
            console.error("Error fetching appointments:", error);
        } finally {
            setLoadingAppts(false);
        }
    }, []);

    const fetchRecentPatients = useCallback(async () => {
        try {
            const res = await receptionAPI.getAllPatients();
            if (res?.success) {
                setPatients(res.patients || []);
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoadingPatients(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
        fetchRecentPatients();
    }, [fetchAppointments, fetchRecentPatients]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        startSpin();
        try {
            await Promise.all([fetchAppointments(), fetchRecentPatients()]);
            Alert.alert('Refreshed', 'Queue refreshed with the latest records.');
        } catch (e) {
            Alert.alert('Error', 'Failed to refresh records.');
        } finally {
            setTimeout(() => setIsRefreshing(false), 600);
        }
    };

    const formatDate = useCallback((dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }, []);

    const getInitialBgColor = useCallback((name = '') => {
        const colors = ['#6366f1', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'];
        let sum = 0;
        for (let i = 0; i < name.length; i++) {
            sum += name.charCodeAt(i);
        }
        return colors[sum % colors.length];
    }, []);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Dynamic Doctors & Departments for Filtering
    const uniqueDoctors = useMemo(() => {
        const docMap = new Map();
        appointments.forEach(a => {
            const name = a.doctorId?.name || a.doctorName;
            const id = a.doctorId?._id || a.doctorId || name;
            if (name && id && !docMap.has(name)) docMap.set(name, { id, name });
        });
        return Array.from(docMap.values());
    }, [appointments]);

    const uniqueDepartments = useMemo(() => {
        const depts = new Set();
        appointments.forEach(a => {
            const d = a.department || a.serviceName;
            if (d && d.trim()) depts.add(d.trim());
        });
        return Array.from(depts);
    }, [appointments]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterDoctor !== 'all') count++;
        if (filterStatus !== 'all') count++;
        if (filterDepartment !== 'all') count++;
        return count;
    }, [filterDoctor, filterStatus, filterDepartment]);

    const handleResetFilters = () => {
        setFilterDoctor('all');
        setFilterStatus('all');
        setFilterDepartment('all');
        setSearchText('');
    };

    // KPI Counts
    const { totalPatientsCount, upcomingApptsCount, completedTodayCount, pendingBillsCount } = useMemo(() => {
        const totalPatients = patients.length || appointments.length || 0;
        const upcoming = appointments.filter(a => {
            const isFuture = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] >= todayStr;
            return isFuture && ['pending', 'confirmed', 'scheduled', 'in_progress'].includes(a.status);
        }).length;
        const completedToday = appointments.filter(a => {
            const isToday = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] === todayStr;
            return isToday && a.status === 'completed';
        }).length;
        const pendingBills = appointments.filter(a => ['Pending', 'pending'].includes(a.paymentStatus) || !a.isPaid).length;
        return { totalPatientsCount: totalPatients, upcomingApptsCount: upcoming, completedTodayCount: completedToday, pendingBillsCount: pendingBills };
    }, [patients, appointments, todayStr]);

    // Donut Stats
    const { completedCount, upcomingCount, cancelledCount, totalActivityCount, completedPct, upcomingPct, cancelledPct } = useMemo(() => {
        const completed = appointments.filter(a => a.status === 'completed').length;
        const upcoming = appointments.filter(a => ['pending', 'confirmed', 'scheduled', 'in_progress', 'with_doctor'].includes(a.status)).length;
        const cancelled = appointments.filter(a => a.status === 'cancelled').length;
        const total = (completed + upcoming + cancelled) || 1;
        const cPct = Math.round((completed / total) * 100);
        const uPct = Math.round((upcoming / total) * 100);
        const canPct = Math.max(0, 100 - (cPct + uPct));
        return {
            completedCount: completed,
            upcomingCount: upcoming,
            cancelledCount: cancelled,
            totalActivityCount: completed + upcoming + cancelled,
            completedPct: cPct,
            upcomingPct: uPct,
            cancelledPct: canPct
        };
    }, [appointments]);

    // Filtered Appointments
    const filteredAppointments = useMemo(() => {
        return appointments.filter(appt => {
            if (activeTab === 'today') {
                const isToday = appt.appointmentDate && new Date(appt.appointmentDate).toISOString().split('T')[0] === todayStr;
                if (!isToday) return false;
            }
            if (filterDoctor !== 'all') {
                const docName = appt.doctorId?.name || appt.doctorName || '';
                const docId = appt.doctorId?._id || appt.doctorId || '';
                if (filterDoctor !== docName && filterDoctor !== docId) return false;
            }
            if (filterStatus !== 'all') {
                const st = (appt.status || '').toLowerCase();
                if (filterStatus === 'pending' && !['pending', 'confirmed', 'scheduled'].includes(st)) return false;
                if (filterStatus === 'completed' && st !== 'completed') return false;
                if (filterStatus === 'in_progress' && !['in_progress', 'with_doctor'].includes(st)) return false;
                if (filterStatus === 'cancelled' && st !== 'cancelled') return false;
            }
            if (filterDepartment !== 'all') {
                const dept = appt.department || appt.serviceName || '';
                if (dept.toLowerCase() !== filterDepartment.toLowerCase()) return false;
            }
            if (searchText.trim().length > 0) {
                const q = searchText.toLowerCase();
                return String(appt.userId?.name || appt.patientName || '').toLowerCase().includes(q) ||
                       String(appt.userId?.phone || appt.patientPhone || '').includes(q) ||
                       String(appt.userId?.patientId || appt.patientId || '').toLowerCase().includes(q) ||
                       String(appt.doctorId?.name || appt.doctorName || '').toLowerCase().includes(q);
            }
            return true;
        });
    }, [appointments, activeTab, searchText, todayStr, filterDoctor, filterStatus, filterDepartment]);

    // Action Handlers - Authoritative UnifiedPatientProfile navigation (1:1 Web parity)
    const handleViewProfile = (appt) => {
        if (!appt) return;
        // Exact match of Web's pid resolution (ReceptionPatients.jsx line 766):
        // const pid = (typeof appt.userId === 'object' ? (appt.userId?._id || appt.userId?.patientId) : appt.userId) || appt.patientId || appt._id;
        const targetId = (typeof appt.userId === 'object' ? (appt.userId?._id || appt.userId?.patientId) : appt.userId)
            || appt.patientId
            || appt._id;

        if (!targetId) {
            Alert.alert('Notice', 'Patient record identifier not found');
            return;
        }

        const dept = appt.department || appt.serviceName || appt.doctorId?.department || 'Unassigned';
        navigation.navigate('UnifiedPatientProfile', {
            id: targetId,
            patientId: targetId,
            department: dept
        });
    };

    const handlePickReportFile = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setSelectedReportFile(res.assets[0]);
            }
        } catch (err) {
            console.error('File pick error:', err);
        }
    };

    const handleUploadReport = async () => {
        if (!selectedReportFile || !uploadModal.apptId) {
            Alert.alert('Missing Info', 'Please select a document to upload.');
            return;
        }
        setUploadingReport(true);
        try {
            const formData = new FormData();
            if (selectedReportFile.file) {
                formData.append('reportFile', selectedReportFile.file);
            } else {
                formData.append('reportFile', {
                    uri: selectedReportFile.uri,
                    name: selectedReportFile.name || 'report.pdf',
                    type: selectedReportFile.mimeType || 'application/pdf',
                });
            }
            formData.append('appointmentId', uploadModal.apptId);

            const res = await reportAPI.uploadReport(formData);
            if (res?.success) {
                Alert.alert('Success', 'Report uploaded successfully!');
                setUploadModal({ open: false, apptId: null, patientName: '', patientId: null });
                setSelectedReportFile(null);
                fetchAppointments();
            } else {
                Alert.alert('Upload Failed', res?.message || 'Failed to upload report.');
            }
        } catch (err) {
            console.error('Report upload error:', err);
            Alert.alert('Error', 'An error occurred while uploading the report.');
        } finally {
            setUploadingReport(false);
        }
    };

    const openConsentModal = async (patientId, patientName) => {
        setConsentModal({ open: true, patientId, patientName, consents: [], loading: true, uploading: false });
        setSelectedConsentFile(null);
        try {
            const res = await consentAPI.getPatientConsent(patientId);
            if (res?.success) {
                setConsentModal(prev => ({ ...prev, consents: res.consentForms || [], loading: false }));
            } else {
                setConsentModal(prev => ({ ...prev, consents: [], loading: false }));
            }
        } catch (err) {
            setConsentModal(prev => ({ ...prev, consents: [], loading: false }));
        }
    };

    const handlePickConsentFile = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setSelectedConsentFile(res.assets[0]);
            }
        } catch (err) {
            console.error('Consent pick error:', err);
        }
    };

    const handleUploadConsent = async () => {
        if (!selectedConsentFile || !consentModal.patientId) {
            Alert.alert('Missing File', 'Please select a signed consent document.');
            return;
        }
        setConsentModal(prev => ({ ...prev, uploading: true }));
        try {
            const formData = new FormData();
            if (selectedConsentFile.file) {
                formData.append('consentFile', selectedConsentFile.file);
            } else {
                formData.append('consentFile', {
                    uri: selectedConsentFile.uri,
                    name: selectedConsentFile.name || 'consent.pdf',
                    type: selectedConsentFile.mimeType || 'application/pdf',
                });
            }
            const res = await consentAPI.uploadPatientConsent(consentModal.patientId, formData);
            if (res?.success) {
                Alert.alert('Success', 'Consent form uploaded successfully!');
                setSelectedConsentFile(null);
                // Refresh consent list
                const refreshRes = await consentAPI.getPatientConsent(consentModal.patientId);
                if (refreshRes?.success) {
                    setConsentModal(prev => ({ ...prev, consents: refreshRes.consentForms || [], uploading: false }));
                } else {
                    setConsentModal(prev => ({ ...prev, uploading: false }));
                }
            } else {
                Alert.alert('Error', res?.message || 'Failed to upload consent.');
                setConsentModal(prev => ({ ...prev, uploading: false }));
            }
        } catch (err) {
            console.error('Consent upload error:', err);
            Alert.alert('Error', 'An error occurred while uploading consent.');
            setConsentModal(prev => ({ ...prev, uploading: false }));
        }
    };

    const handleCancelAppointment = (apptId) => {
        Alert.alert(
            'Cancel Appointment',
            'Are you sure you want to cancel this appointment?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await receptionAPI.cancelAppointment(apptId);
                            if (res?.success) {
                                Alert.alert('Cancelled', 'Appointment has been cancelled.');
                                fetchAppointments();
                            } else {
                                Alert.alert('Error', res?.message || 'Failed to cancel appointment.');
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to cancel appointment.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* 1. TOP HEADER & LIVE DIGITAL CLOCK & INDICATOR */}
            <View style={styles.pageHeader}>
                <View>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitle}>Patient Directory</Text>
                        <View style={styles.liveIndicatorBadge}>
                            <View style={styles.livePulseDot} />
                            <Text style={styles.liveIndicatorText}>System Online • Live Queue</Text>
                        </View>
                    </View>
                    <Text style={styles.headerSubtitle}>Complete patient records, appointment scheduling & verification</Text>
                </View>

                <View style={styles.headerRightActions}>
                    <View style={styles.clockCard}>
                        <Feather name="clock" size={14} color="#2563eb" />
                        <Text style={styles.clockText}>
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.refreshHeaderBtn}
                        onPress={handleManualRefresh}
                        disabled={isRefreshing}
                        activeOpacity={0.7}
                    >
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Feather name="refresh-cw" size={15} color="#475569" />
                        </Animated.View>
                        <Text style={styles.refreshBtnText}>{isRefreshing ? 'Syncing...' : 'Refresh'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. UNIFIED HERO: TODAY'S ACTIVITY (LEFT) + 4 STAT CARDS 2x2 (RIGHT) */}
            <View style={styles.heroSection}>
                {/* Left: Today's Activity Donut Card */}
                <View style={styles.activityCard}>
                    <Text style={styles.activityCardTitle}>Today's Activity</Text>
                    <View style={styles.activityBody}>
                        <View style={styles.donutWrapper}>
                            <Svg width={110} height={110} viewBox="0 0 100 100">
                                <Circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                                <Circle
                                    cx="50" cy="50" r="38"
                                    stroke="#10b981"
                                    strokeWidth="12"
                                    fill="none"
                                    strokeDasharray={`${completedPct * 2.38} 238.76`}
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                />
                                <Circle
                                    cx="50" cy="50" r="38"
                                    stroke="#f59e0b"
                                    strokeWidth="12"
                                    fill="none"
                                    strokeDasharray={`${upcomingPct * 2.38} 238.76`}
                                    strokeDashoffset={`-${completedPct * 2.38}`}
                                    strokeLinecap="round"
                                />
                                <Circle
                                    cx="50" cy="50" r="38"
                                    stroke="#ef4444"
                                    strokeWidth="12"
                                    fill="none"
                                    strokeDasharray={`${cancelledPct * 2.38} 238.76`}
                                    strokeDashoffset={`-${(completedPct + upcomingPct) * 2.38}`}
                                    strokeLinecap="round"
                                />
                            </Svg>
                            <View style={styles.donutCenterText}>
                                <Text style={styles.donutTotalNum}>{totalActivityCount}</Text>
                                <Text style={styles.donutTotalLabel}>Total</Text>
                            </View>
                        </View>

                        <View style={styles.activityLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                                <Text style={styles.legendLabel}>Completed</Text>
                                <Text style={styles.legendVal}>{completedCount} ({completedPct}%)</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                                <Text style={styles.legendLabel}>Upcoming</Text>
                                <Text style={styles.legendVal}>{upcomingCount} ({upcomingPct}%)</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                                <Text style={styles.legendLabel}>Cancelled</Text>
                                <Text style={styles.legendVal}>{cancelledCount} ({cancelledPct}%)</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Right: 4 Stat Cards in 2x2 Grid */}
                <View style={styles.kpiGrid2x2}>
                    {/* Card 1: Total Patients */}
                    <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardPurple]}
                        onPress={() => { setActiveTab('all'); setSearchText(''); }}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.kpiTopGlow, { backgroundColor: '#8b5cf6' }]} />
                        <View style={styles.kpiCardInner}>
                            <View style={[styles.kpiIconBox, { backgroundColor: '#ede9fe' }]}>
                                <Feather name="users" size={20} color="#8b5cf6" />
                            </View>
                            <View style={styles.kpiTextInfo}>
                                <View style={styles.kpiValRow}>
                                    <Text style={styles.kpiVal}>{totalPatientsCount}</Text>
                                    <View style={[styles.kpiMiniTag, { backgroundColor: '#f3e8ff' }]}>
                                        <Text style={[styles.kpiMiniTagText, { color: '#7e22ce' }]}>● Registered</Text>
                                    </View>
                                </View>
                                <Text style={styles.kpiName}>Total Patients</Text>
                            </View>
                        </View>
                        <View style={styles.kpiWaveBox}>
                            <Svg width="100%" height={24} viewBox="0 0 100 24">
                                <Path d="M0,18 Q25,2 50,14 T100,6" fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
                            </Svg>
                        </View>
                    </TouchableOpacity>

                    {/* Card 2: Upcoming Appointments */}
                    <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardAmber]}
                        onPress={() => setActiveTab('today')}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.kpiTopGlow, { backgroundColor: '#f59e0b' }]} />
                        <View style={styles.kpiCardInner}>
                            <View style={[styles.kpiIconBox, { backgroundColor: '#fef3c7' }]}>
                                <Feather name="calendar" size={20} color="#d97706" />
                            </View>
                            <View style={styles.kpiTextInfo}>
                                <View style={styles.kpiValRow}>
                                    <Text style={styles.kpiVal}>{upcomingApptsCount}</Text>
                                    <View style={[styles.kpiMiniTag, { backgroundColor: '#fef3c7' }]}>
                                        <Text style={[styles.kpiMiniTagText, { color: '#b45309' }]}>● In Queue</Text>
                                    </View>
                                </View>
                                <Text style={styles.kpiName}>Upcoming Appts</Text>
                            </View>
                        </View>
                        <View style={styles.kpiWaveBox}>
                            <Svg width="100%" height={24} viewBox="0 0 100 24">
                                <Path d="M0,16 Q25,22 50,8 T100,12" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
                            </Svg>
                        </View>
                    </TouchableOpacity>

                    {/* Card 3: Completed Today */}
                    <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardMint]}
                        onPress={() => { setActiveTab('today'); setFilterStatus('completed'); }}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.kpiTopGlow, { backgroundColor: '#10b981' }]} />
                        <View style={styles.kpiCardInner}>
                            <View style={[styles.kpiIconBox, { backgroundColor: '#d1fae5' }]}>
                                <Feather name="activity" size={20} color="#059669" />
                            </View>
                            <View style={styles.kpiTextInfo}>
                                <View style={styles.kpiValRow}>
                                    <Text style={styles.kpiVal}>{completedTodayCount}</Text>
                                    <View style={[styles.kpiMiniTag, { backgroundColor: '#dcfce7' }]}>
                                        <Text style={[styles.kpiMiniTagText, { color: '#15803d' }]}>● {completedPct}% Done</Text>
                                    </View>
                                </View>
                                <Text style={styles.kpiName}>Completed Today</Text>
                            </View>
                        </View>
                        <View style={styles.kpiWaveBox}>
                            <Svg width="100%" height={24} viewBox="0 0 100 24">
                                <Path d="M0,14 Q25,4 50,18 T100,4" fill="none" stroke="#10b981" strokeWidth="2.5" />
                            </Svg>
                        </View>
                    </TouchableOpacity>

                    {/* Card 4: Pending Bills */}
                    <TouchableOpacity
                        style={[styles.kpiCard, styles.kpiCardBlue]}
                        onPress={() => navigation.navigate('PatientBillingProfile')}
                        activeOpacity={0.85}
                    >
                        <View style={[styles.kpiTopGlow, { backgroundColor: '#3b82f6' }]} />
                        <View style={styles.kpiCardInner}>
                            <View style={[styles.kpiIconBox, { backgroundColor: '#dbeafe' }]}>
                                <Feather name="file-text" size={20} color="#2563eb" />
                            </View>
                            <View style={styles.kpiTextInfo}>
                                <View style={styles.kpiValRow}>
                                    <Text style={styles.kpiVal}>{pendingBillsCount}</Text>
                                    <View style={[styles.kpiMiniTag, { backgroundColor: '#eff6ff' }]}>
                                        <Text style={[styles.kpiMiniTagText, { color: '#1d4ed8' }]}>● Unpaid</Text>
                                    </View>
                                </View>
                                <Text style={styles.kpiName}>Pending Bills</Text>
                            </View>
                        </View>
                        <View style={styles.kpiWaveBox}>
                            <Svg width="100%" height={24} viewBox="0 0 100 24">
                                <Path d="M0,10 Q25,18 50,6 T100,16" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
                            </Svg>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 3. SEARCH & TOGGLE TABS & FILTER BAR */}
            <View style={styles.controlsBarRow}>
                {/* Search Input Box */}
                <View style={styles.searchInputWrapper}>
                    <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search patient by name, phone, MRN, or doctor..."
                        placeholderTextColor="#94a3b8"
                        value={searchText}
                        onChangeText={setSearchText}
                        style={styles.searchInputField}
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')} style={styles.searchClearBtn}>
                            <Feather name="x" size={16} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Queue Tabs & Filter Action */}
                <View style={styles.tabAndFilterWrapper}>
                    <View style={styles.tabToggleGroup}>
                        <TouchableOpacity
                            style={[styles.tabToggleBtn, activeTab === 'today' && styles.tabToggleBtnActive]}
                            onPress={() => setActiveTab('today')}
                        >
                            <Text style={[styles.tabToggleBtnText, activeTab === 'today' && styles.tabToggleBtnTextActive]}>
                                Today's Queue
                            </Text>
                            <View style={[styles.tabCountPill, activeTab === 'today' && styles.tabCountPillActive]}>
                                <Text style={[styles.tabCountPillText, activeTab === 'today' && styles.tabCountPillTextActive]}>
                                    {appointments.filter(a => a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] === todayStr).length}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabToggleBtn, activeTab === 'all' && styles.tabToggleBtnActive]}
                            onPress={() => setActiveTab('all')}
                        >
                            <Text style={[styles.tabToggleBtnText, activeTab === 'all' && styles.tabToggleBtnTextActive]}>
                                All Appointments
                            </Text>
                            <View style={[styles.tabCountPill, activeTab === 'all' && styles.tabCountPillActive]}>
                                <Text style={[styles.tabCountPillText, activeTab === 'all' && styles.tabCountPillTextActive]}>
                                    {appointments.length}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Filter Trigger Button */}
                    <TouchableOpacity
                        style={[styles.filterTriggerBtn, activeFilterCount > 0 && styles.filterTriggerBtnActive]}
                        onPress={() => setShowFilterPopover(true)}
                        activeOpacity={0.8}
                    >
                        <Feather name="sliders" size={16} color={activeFilterCount > 0 ? '#2563eb' : '#475569'} />
                        <Text style={[styles.filterBtnLabel, activeFilterCount > 0 && styles.filterBtnLabelActive]}>Filter</Text>
                        {activeFilterCount > 0 && (
                            <View style={styles.filterCountBadge}>
                                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* 4. PATIENT DIRECTORY TABLE */}
            <View style={styles.tableCard}>
                <View style={styles.tableCardHeader}>
                    <View style={styles.tableHeaderTitleRow}>
                        <View style={styles.tableTitleIconBox}>
                            <Feather name="calendar" size={18} color="#2563eb" />
                        </View>
                        <Text style={styles.tableCardTitle}>
                            {activeTab === 'today' ? "Today's Patient Queue" : "All Appointments"}
                        </Text>
                        <View style={styles.tableCountBadge}>
                            <Text style={styles.tableCountBadgeText}>{filteredAppointments.length} Total</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.tableRefreshMiniBtn} onPress={handleManualRefresh} disabled={isRefreshing}>
                        <Feather name="rotate-cw" size={13} color="#64748b" />
                        <Text style={styles.tableRefreshMiniText}>Refresh Records</Text>
                    </TouchableOpacity>
                </View>

                {loadingAppts ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#2563eb" />
                        <Text style={styles.loadingText}>Loading patient records...</Text>
                    </View>
                ) : filteredAppointments.length === 0 ? (
                    <View style={styles.emptyFilterState}>
                        <View style={styles.emptyFilterIconCircle}>
                            <Feather name="sliders" size={28} color="#94a3b8" />
                        </View>
                        <Text style={styles.emptyFilterTitle}>No Appointments Matching Filter</Text>
                        <Text style={styles.emptyFilterSubtitle}>
                            We couldn't find any appointment records matching your current search or filter criteria.
                        </Text>
                        <TouchableOpacity style={styles.emptyFilterResetBtn} onPress={handleResetFilters}>
                            <Feather name="refresh-cw" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyFilterResetBtnText}>Reset Filters & Show All Records</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={styles.tableWrapper}>
                            {/* Table Header */}
                            <View style={styles.tableRowHeader}>
                                <Text style={[styles.thCell, { width: 44 }]}>#</Text>
                                <Text style={[styles.thCell, { width: 220 }]}>PATIENT</Text>
                                <Text style={[styles.thCell, { width: 140 }]}>CONTACT</Text>
                                <Text style={[styles.thCell, { width: 180 }]}>DOCTOR</Text>
                                <Text style={[styles.thCell, { width: 100 }]}>TIME</Text>
                                <Text style={[styles.thCell, { width: 110 }]}>DATE</Text>
                                <Text style={[styles.thCell, { width: 120 }]}>STATUS</Text>
                                <Text style={[styles.thCell, { width: 110, textAlign: 'center' }]}>ACTIONS</Text>
                            </View>

                            {/* Table Rows */}
                            {filteredAppointments.map((appt, idx) => {
                                const rawPt = appt.userId || {};
                                const clinicPt = appt.clinicPatientId || {};
                                const patientName = appt.patientName || clinicPt.name || rawPt.name || 'Unknown Patient';
                                const patientPhone = appt.patientPhone || clinicPt.phone || rawPt.phone || '-';
                                const patientMRN = appt.patientId || clinicPt.patientUid || rawPt.patientId || 'CIT-M365-NEW';
                                const doctorName = appt.doctorName || appt.doctorId?.name || 'Dr. Assigned';
                                const doctorDept = appt.department || appt.serviceName || appt.doctorId?.department || 'General';
                                const apptTime = appt.appointmentTime || '09:00';
                                const apptDateFormatted = formatDate(appt.appointmentDate);
                                const statusStr = (appt.status || 'pending').toLowerCase();

                                return (
                                    <View key={appt._id || idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#fcfdfd' }]}>
                                        <Text style={[styles.tdCell, styles.tdIndex, { width: 44 }]}>{idx + 1}</Text>

                                        {/* Patient Avatar & Name */}
                                        <TouchableOpacity
                                            style={[styles.tdCell, styles.patientCell, { width: 220 }]}
                                            onPress={() => handleViewProfile(appt)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.patientAvatar, { backgroundColor: getInitialBgColor(patientName) }]}>
                                                <Text style={styles.avatarLetter}>{patientName.charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <View style={styles.patientInfoCol}>
                                                <Text style={styles.patientNameLink} numberOfLines={1}>{patientName}</Text>
                                                <View style={styles.mrnBadge}>
                                                    <Text style={styles.mrnBadgeText}>MRN: {patientMRN}</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>

                                        {/* Contact Phone */}
                                        <View style={[styles.tdCell, styles.contactCell, { width: 140 }]}>
                                            <Feather name="phone" size={12} color="#64748b" style={{ marginRight: 6 }} />
                                            <Text style={styles.phoneText}>{patientPhone}</Text>
                                        </View>

                                        {/* Doctor */}
                                        <View style={[styles.tdCell, styles.doctorCell, { width: 180 }]}>
                                            <View style={styles.doctorAvatarBox}>
                                                <Text style={styles.doctorAvatarLetter}>
                                                    {doctorName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'}
                                                </Text>
                                            </View>
                                            <View style={styles.doctorInfoCol}>
                                                <Text style={styles.doctorNameText} numberOfLines={1}>{doctorName}</Text>
                                                <View style={styles.doctorDeptBadge}>
                                                    <Text style={styles.doctorDeptText}>{doctorDept}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Time */}
                                        <View style={[styles.tdCell, { width: 100 }]}>
                                            <View style={styles.timePill}>
                                                <Text style={styles.timePillText}>{apptTime}</Text>
                                            </View>
                                        </View>

                                        {/* Date */}
                                        <View style={[styles.tdCell, { width: 110 }]}>
                                            <Text style={styles.dateCellText}>{apptDateFormatted}</Text>
                                        </View>

                                        {/* Status */}
                                        <View style={[styles.tdCell, { width: 120 }]}>
                                            <View style={[
                                                styles.statusBadge,
                                                statusStr === 'completed' && styles.statusBadgeCompleted,
                                                statusStr === 'in_progress' && styles.statusBadgeProgress,
                                                (statusStr === 'pending' || statusStr === 'confirmed' || statusStr === 'scheduled') && styles.statusBadgePending,
                                                statusStr === 'cancelled' && styles.statusBadgeCancelled,
                                            ]}>
                                                <View style={[
                                                    styles.statusDot,
                                                    statusStr === 'completed' && { backgroundColor: '#059669' },
                                                    statusStr === 'in_progress' && { backgroundColor: '#d97706' },
                                                    (statusStr === 'pending' || statusStr === 'confirmed' || statusStr === 'scheduled') && { backgroundColor: '#2563eb' },
                                                    statusStr === 'cancelled' && { backgroundColor: '#dc2626' },
                                                ]} />
                                                <Text style={[
                                                    styles.statusText,
                                                    statusStr === 'completed' && { color: '#059669' },
                                                    statusStr === 'in_progress' && { color: '#d97706' },
                                                    (statusStr === 'pending' || statusStr === 'confirmed' || statusStr === 'scheduled') && { color: '#2563eb' },
                                                    statusStr === 'cancelled' && { color: '#dc2626' },
                                                ]}>
                                                    {statusStr.charAt(0).toUpperCase() + statusStr.slice(1)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Actions — Web parity: Profile only */}
                                        <View style={[styles.tdCell, styles.actionsRow, { width: 110 }]}>
                                            <TouchableOpacity
                                                style={styles.actionBtnProfile}
                                                onPress={() => handleViewProfile(appt)}
                                                activeOpacity={0.7}
                                            >
                                                <Feather name="eye" size={12} color="#2563eb" style={{ marginRight: 4 }} />
                                                <Text style={styles.actionBtnProfileText}>Profile</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </View>

            {/* 5. FILTER POPOVER / MODAL */}
            <Modal visible={showFilterPopover} transparent animationType="fade" onRequestClose={() => setShowFilterPopover(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowFilterPopover(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.filterModalCard} onPress={e => e.stopPropagation()}>
                        <View style={styles.filterModalHeader}>
                            <View style={styles.filterModalTitleWrap}>
                                <View style={styles.filterModalIconBox}>
                                    <Feather name="sliders" size={18} color="#2563eb" />
                                </View>
                                <View>
                                    <Text style={styles.filterModalTitle}>Filter Queue</Text>
                                    <Text style={styles.filterModalSubtitle}>Refine appointment records</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowFilterPopover(false)}>
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
                            {/* Status Filter */}
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterGroupLabel}>Appointment Status</Text>
                                <View style={styles.statusChipsGrid}>
                                    {[
                                        { key: 'all', label: 'All Statuses', color: '#6366f1' },
                                        { key: 'pending', label: 'Scheduled', color: '#2563eb' },
                                        { key: 'in_progress', label: 'In Progress', color: '#d97706' },
                                        { key: 'completed', label: 'Completed', color: '#059669' },
                                        { key: 'cancelled', label: 'Cancelled', color: '#dc2626' }
                                    ].map(chip => {
                                        const isSelected = filterStatus === chip.key;
                                        return (
                                            <TouchableOpacity
                                                key={chip.key}
                                                style={[
                                                    styles.chipBtn,
                                                    isSelected && { borderColor: chip.color, backgroundColor: `${chip.color}15` }
                                                ]}
                                                onPress={() => setFilterStatus(chip.key)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[styles.chipDot, { backgroundColor: chip.color }]} />
                                                <Text style={[styles.chipText, isSelected && { color: chip.color, fontWeight: '700' }]}>
                                                    {chip.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Doctor Filter */}
                            <View style={styles.filterGroup}>
                                <Text style={styles.filterGroupLabel}>Attending Doctor</Text>
                                <View style={styles.selectOptionsGrid}>
                                    <TouchableOpacity
                                        style={[styles.selectOptionChip, filterDoctor === 'all' && styles.selectOptionChipActive]}
                                        onPress={() => setFilterDoctor('all')}
                                    >
                                        <Text style={[styles.selectOptionChipText, filterDoctor === 'all' && styles.selectOptionChipTextActive]}>
                                            All Doctors
                                        </Text>
                                    </TouchableOpacity>
                                    {uniqueDoctors.map(doc => (
                                        <TouchableOpacity
                                            key={doc.id}
                                            style={[styles.selectOptionChip, filterDoctor === doc.name && styles.selectOptionChipActive]}
                                            onPress={() => setFilterDoctor(doc.name)}
                                        >
                                            <Text style={[styles.selectOptionChipText, filterDoctor === doc.name && styles.selectOptionChipTextActive]}>
                                                Dr. {doc.name.replace(/^Dr\.?\s*/i, '')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Department Filter */}
                            {uniqueDepartments.length > 0 && (
                                <View style={styles.filterGroup}>
                                    <Text style={styles.filterGroupLabel}>Medical Department</Text>
                                    <View style={styles.selectOptionsGrid}>
                                        <TouchableOpacity
                                            style={[styles.selectOptionChip, filterDepartment === 'all' && styles.selectOptionChipActive]}
                                            onPress={() => setFilterDepartment('all')}
                                        >
                                            <Text style={[styles.selectOptionChipText, filterDepartment === 'all' && styles.selectOptionChipTextActive]}>
                                                All Departments
                                            </Text>
                                        </TouchableOpacity>
                                        {uniqueDepartments.map(dept => (
                                            <TouchableOpacity
                                                key={dept}
                                                style={[styles.selectOptionChip, filterDepartment === dept && styles.selectOptionChipActive]}
                                                onPress={() => setFilterDepartment(dept)}
                                            >
                                                <Text style={[styles.selectOptionChipText, filterDepartment === dept && styles.selectOptionChipTextActive]}>
                                                    {dept}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.filterModalFooter}>
                            <TouchableOpacity style={styles.filterResetBtn} onPress={handleResetFilters}>
                                <Feather name="refresh-cw" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                <Text style={styles.filterResetBtnText}>Reset All</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.filterApplyBtn} onPress={() => setShowFilterPopover(false)}>
                                <Feather name="check" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.filterApplyBtnText}>Apply ({filteredAppointments.length})</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* 6. UPLOAD LAB REPORT MODAL */}
            <Modal visible={uploadModal.open} transparent animationType="fade" onRequestClose={() => setUploadModal({ open: false, apptId: null, patientName: '', patientId: null })}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setUploadModal({ open: false, apptId: null, patientName: '', patientId: null })}>
                    <TouchableOpacity activeOpacity={1} style={styles.uploadModalCard} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeaderTitle}>Upload Patient Report</Text>
                            <TouchableOpacity onPress={() => setUploadModal({ open: false, apptId: null, patientName: '', patientId: null })}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.patientContextBanner}>
                            <Feather name="user" size={16} color="#2563eb" style={{ marginRight: 8 }} />
                            <Text style={styles.patientContextText}>
                                Patient: <Text style={{ fontWeight: '800', color: '#1e293b' }}>{uploadModal.patientName}</Text>
                            </Text>
                        </View>

                        <View style={styles.filePickerSection}>
                            <Text style={styles.fieldSectionLabel}>Select Document (PDF / Image)</Text>
                            <TouchableOpacity style={styles.filePickerBox} onPress={handlePickReportFile} activeOpacity={0.8}>
                                <Feather name="upload-cloud" size={32} color="#db2777" />
                                <Text style={styles.filePickerPromptText}>
                                    {selectedReportFile ? selectedReportFile.name : 'Tap to select document from device'}
                                </Text>
                                <Text style={styles.filePickerSubtext}>Supports PDF, PNG, JPG (up to 20MB)</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => {
                                    setSelectedReportFile(null);
                                    setUploadModal({ open: false, apptId: null, patientName: '', patientId: null });
                                }}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.uploadSubmitBtn, uploadingReport && { opacity: 0.7 }]}
                                onPress={handleUploadReport}
                                disabled={uploadingReport}
                            >
                                {uploadingReport ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="upload" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                                        <Text style={styles.uploadSubmitBtnText}>Upload Report</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
                </Modal>

            {/* 8. CONSENT FORM MANAGEMENT MODAL */}
            <Modal visible={consentModal.open} transparent animationType="fade" onRequestClose={() => setConsentModal({ open: false, patientId: null, patientName: '', consents: [], loading: false, uploading: false })}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setConsentModal({ open: false, patientId: null, patientName: '', consents: [], loading: false, uploading: false })}>
                    <TouchableOpacity activeOpacity={1} style={styles.consentModalCard} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeaderRow}>
                            <View>
                                <Text style={styles.modalHeaderTitle}>Patient Consent Records</Text>
                                <Text style={styles.modalHeaderSubtitle}>Patient: {consentModal.patientName}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setConsentModal({ open: false, patientId: null, patientName: '', consents: [], loading: false, uploading: false })}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.consentModalBody} showsVerticalScrollIndicator={false}>
                            {consentModal.loading ? (
                                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 20 }} />
                            ) : consentModal.consents.length === 0 ? (
                                <View style={styles.emptyConsentState}>
                                    <Feather name="shield" size={32} color="#94a3b8" />
                                    <Text style={styles.emptyConsentTitle}>No Consent Forms on Record</Text>
                                    <Text style={styles.emptyConsentSubtitle}>
                                        Upload a signed general treatment or procedure consent document below.
                                    </Text>
                                </View>
                            ) : (
                                consentModal.consents.map((c, i) => (
                                    <View key={c._id || i} style={styles.consentItemCard}>
                                        <View style={styles.consentItemIcon}>
                                            <Feather name="file-text" size={18} color="#0891b2" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.consentItemName}>{c.fileName || `Consent Document #${i + 1}`}</Text>
                                            <Text style={styles.consentItemDate}>Uploaded: {formatDate(c.uploadedAt || new Date())}</Text>
                                        </View>
                                        <View style={styles.consentVerifiedBadge}>
                                            <Feather name="check-circle" size={12} color="#059669" style={{ marginRight: 4 }} />
                                            <Text style={styles.consentVerifiedText}>Verified</Text>
                                        </View>
                                    </View>
                                ))
                            )}

                            {/* Upload New Consent Section */}
                            <View style={styles.consentUploadSection}>
                                <Text style={styles.consentUploadTitle}>Upload Signed Consent Document</Text>
                                <TouchableOpacity style={styles.consentPickerBox} onPress={handlePickConsentFile} activeOpacity={0.8}>
                                    <Feather name="upload-cloud" size={24} color="#0891b2" />
                                    <Text style={styles.consentPickerPrompt}>
                                        {selectedConsentFile ? selectedConsentFile.name : 'Choose signed PDF or Image'}
                                    </Text>
                                </TouchableOpacity>

                                {selectedConsentFile && (
                                    <TouchableOpacity
                                        style={[styles.consentSubmitBtn, consentModal.uploading && { opacity: 0.7 }]}
                                        onPress={handleUploadConsent}
                                        disabled={consentModal.uploading}
                                    >
                                        {consentModal.uploading ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <>
                                                <Feather name="check-circle" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                                <Text style={styles.consentSubmitBtnText}>Submit & Record Consent</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooterRow}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setConsentModal({ open: false, patientId: null, patientName: '', consents: [], loading: false, uploading: false })}
                            >
                                <Text style={styles.cancelBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
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
        padding: 20,
        paddingBottom: 60,
    },

    // 1. Page Header
    pageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    liveIndicatorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        gap: 6,
    },
    livePulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
    },
    liveIndicatorText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#065f46',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 3,
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    clockCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        gap: 8,
        elevation: 1,
    },
    clockText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    refreshHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        gap: 8,
        elevation: 1,
    },
    refreshBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },

    // 2. Hero Section
    heroSection: {
        flexDirection: width > 900 ? 'row' : 'column',
        gap: 16,
        marginBottom: 20,
        alignItems: 'stretch',
    },
    activityCard: {
        flex: width > 900 ? 0.38 : 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    activityCardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 14,
    },
    activityBody: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 16,
    },
    donutWrapper: {
        position: 'relative',
        width: 110,
        height: 110,
        justifyContent: 'center',
        alignItems: 'center',
    },
    donutCenterText: {
        position: 'absolute',
        alignItems: 'center',
    },
    donutTotalNum: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
    },
    donutTotalLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
    },
    activityLegend: {
        flex: 1,
        gap: 8,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        flex: 1,
    },
    legendVal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },

    // 2x2 KPI Grid
    kpiGrid2x2: {
        flex: width > 900 ? 0.62 : 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    kpiCard: {
        width: width > 900 ? '48.5%' : '48%',
        minHeight: 90,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1.5,
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'space-between',
        elevation: 1,
    },
    kpiCardPurple: {
        backgroundColor: '#fdfaff',
        borderColor: '#e4d4ff',
    },
    kpiCardAmber: {
        backgroundColor: '#fffdf5',
        borderColor: '#fde68a',
    },
    kpiCardMint: {
        backgroundColor: '#f4fdf8',
        borderColor: '#a7f3d0',
    },
    kpiCardBlue: {
        backgroundColor: '#f5f9ff',
        borderColor: '#bfdbfe',
    },
    kpiTopGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    kpiCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    kpiIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    kpiTextInfo: {
        flex: 1,
    },
    kpiValRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    kpiVal: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
    },
    kpiMiniTag: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 8,
    },
    kpiMiniTagText: {
        fontSize: 10,
        fontWeight: '800',
    },
    kpiName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 2,
    },
    kpiWaveBox: {
        marginTop: 6,
        height: 20,
    },

    // 3. Search & Tabs Bar
    controlsBarRow: {
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'stretch',
        gap: 14,
        marginBottom: 18,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1.5,
        borderRadius: 10,
        paddingHorizontal: 12,
        flex: 1,
        minHeight: 44,
    },
    searchInputField: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        paddingVertical: 8,
    },
    searchClearBtn: {
        padding: 4,
    },
    tabAndFilterWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tabToggleGroup: {
        flexDirection: 'row',
        backgroundColor: '#e2e8f0',
        borderRadius: 10,
        padding: 3,
    },
    tabToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 8,
        gap: 6,
    },
    tabToggleBtnActive: {
        backgroundColor: '#2563eb',
    },
    tabToggleBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    tabToggleBtnTextActive: {
        color: '#ffffff',
    },
    tabCountPill: {
        backgroundColor: '#cbd5e1',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
    },
    tabCountPillActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    tabCountPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
    },
    tabCountPillTextActive: {
        color: '#ffffff',
    },
    filterTriggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1.5,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        gap: 6,
    },
    filterTriggerBtnActive: {
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff',
    },
    filterBtnLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    filterBtnLabelActive: {
        color: '#2563eb',
    },
    filterCountBadge: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    filterCountBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ffffff',
    },

    // 4. Appointments Table Card
    tableCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
    },
    tableCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tableHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tableTitleIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableCardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    tableCountBadge: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    tableCountBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2563eb',
    },
    tableRefreshMiniBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
    },
    tableRefreshMiniText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    tableWrapper: {
        minWidth: 1050,
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        borderRadius: 8,
    },
    thCell: {
        paddingHorizontal: 10,
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tdCell: {
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    tdIndex: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
    },
    patientCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    patientAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarLetter: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    patientInfoCol: {
        flex: 1,
    },
    patientNameLink: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    mrnBadge: {
        backgroundColor: '#f1f5f9',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    mrnBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    contactCell: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    doctorCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    doctorAvatarBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#10b981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    doctorAvatarLetter: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
    },
    doctorInfoCol: {
        flex: 1,
    },
    doctorNameText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    doctorDeptBadge: {
        alignSelf: 'flex-start',
    },
    doctorDeptText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    timePill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    timePillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#334155',
    },
    dateCellText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 16,
        alignSelf: 'flex-start',
        gap: 5,
    },
    statusBadgeCompleted: {
        backgroundColor: '#ecfdf5',
    },
    statusBadgeProgress: {
        backgroundColor: '#fffbeb',
    },
    statusBadgePending: {
        backgroundColor: '#eff6ff',
    },
    statusBadgeCancelled: {
        backgroundColor: '#fef2f2',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionBtnProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    actionBtnProfileText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#2563eb',
    },
    actionBtnUpload: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fdf2f8',
        borderColor: '#fbcfe8',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    actionBtnUploadText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#db2777',
    },
    actionBtnConsent: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfeff',
        borderColor: '#a5f3fc',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    actionBtnConsentText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0891b2',
    },
    actionBtnCancel: {
        padding: 5,
        backgroundColor: '#fef2f2',
        borderRadius: 6,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 10,
    },
    loadingText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    emptyFilterState: {
        padding: 40,
        alignItems: 'center',
        gap: 8,
    },
    emptyFilterIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    emptyFilterTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    emptyFilterSubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 400,
        marginBottom: 10,
    },
    emptyFilterResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    emptyFilterResetBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Modals Shared
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalHeaderTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalHeaderSubtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalFooterRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 18,
        paddingTop: 14,
        borderBottomColor: 'transparent',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 8,
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },

    // Filter Modal
    filterModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 480,
        maxHeight: '85%',
        elevation: 6,
    },
    filterModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    filterModalTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    filterModalIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterModalTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    filterModalSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    filterModalBody: {
        maxHeight: 380,
    },
    filterGroup: {
        marginBottom: 16,
    },
    filterGroupLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#334155',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    statusChipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        gap: 6,
    },
    chipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    chipText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    selectOptionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectOptionChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    selectOptionChipActive: {
        borderColor: '#2563eb',
        backgroundColor: '#eff6ff',
    },
    selectOptionChipText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    selectOptionChipTextActive: {
        color: '#2563eb',
        fontWeight: '700',
    },
    filterModalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    filterResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    filterResetBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    filterApplyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 8,
    },
    filterApplyBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Upload Modal
    uploadModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 22,
        width: '100%',
        maxWidth: 440,
        elevation: 6,
    },
    patientContextBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        padding: 10,
        borderRadius: 8,
        marginBottom: 16,
    },
    patientContextText: {
        fontSize: 13,
        color: '#1e40af',
    },
    filePickerSection: {
        marginBottom: 16,
    },
    fieldSectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    filePickerBox: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#f472b6',
        backgroundColor: '#fdf2f8',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        gap: 6,
    },
    filePickerPromptText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9d174d',
        textAlign: 'center',
    },
    filePickerSubtext: {
        fontSize: 11,
        color: '#64748b',
    },
    uploadSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#db2777',
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 8,
    },
    uploadSubmitBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },



    // Consent Modal
    consentModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 480,
        maxHeight: '85%',
        elevation: 6,
    },
    consentModalBody: {
        maxHeight: 380,
    },
    emptyConsentState: {
        padding: 20,
        alignItems: 'center',
        gap: 6,
    },
    emptyConsentTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#334155',
        marginTop: 6,
    },
    emptyConsentSubtitle: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
    },
    consentItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 8,
        gap: 10,
    },
    consentItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#ecfeff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    consentItemName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    consentItemDate: {
        fontSize: 10,
        color: '#64748b',
        marginTop: 2,
    },
    consentVerifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    consentVerifiedText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669',
    },
    consentUploadSection: {
        marginTop: 16,
        backgroundColor: '#f0fdfa',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ccfbf1',
    },
    consentUploadTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f766e',
        marginBottom: 8,
    },
    consentPickerBox: {
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#0d9488',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        backgroundColor: '#ffffff',
        gap: 4,
    },
    consentPickerPrompt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    consentSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0d9488',
        paddingVertical: 8,
        borderRadius: 6,
        marginTop: 10,
    },
    consentSubmitBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default ReceptionPatients;
