import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform, 
    useWindowDimensions, Pressable, RefreshControl
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { doctorAPI, reportAPI } from '../../utils/api';

const avatarColors = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

const Patient = ({ route: propRoute } = {}) => {
    const navigation = useNavigation();
    let navRoute = null;
    try {
        navRoute = useRoute();
    } catch (e) {}
    const route = propRoute || navRoute;

    const { width } = useWindowDimensions();
    const isMobile = width > 0 ? width < 768 : false;

    // Core state
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Search, Tabs, Filter & Sort
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'today'
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('latest'); // 'latest' | 'oldest' | 'name-asc' | 'name-desc'
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Dropdowns & Popovers
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    // Modals
    const [vitalsPatient, setVitalsPatient] = useState(null);
    const [uploadPatient, setUploadPatient] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [vitals, setVitals] = useState({
        weight: '', height: '', bmi: '', bloodPressure: '',
        pulse: '', temperature: '', spo2: '', respiratoryRate: '',
        chiefComplaint: '', notes: ''
    });

    // Backward compatibility: If accessed with tab=referrals or tab=surgery_plans, redirect to dedicated screens
    useEffect(() => {
        const tab = route?.params?.tab;
        if (tab === 'referrals') {
            navigation.navigate('SurgeryReferrals');
        } else if (tab === 'surgery_plans') {
            navigation.navigate('MySurgeryPlans');
        }
    }, [route?.params?.tab, navigation]);

    const fetchAllAppointments = useCallback(async (isPull = false) => {
        if (isPull) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        try {
            const userStr = await AsyncStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : {};
            const role = (user.role || '').toLowerCase();
            const permissions = user.permissions || [];
            
            const staffRoles = ['nurse', 'admin', 'superadmin', 'hospitaladmin', 'reception', 'receptionist'];
            const isAdminOrStaff = staffRoles.some(r => role.includes(r));
            const isDoctor = role.includes('doctor');
            const isClinicDoctor = isDoctor && user.clinicType === 'clinic';
            
            const hasViewAllAccess = isClinicDoctor || (!isDoctor && (isAdminOrStaff || permissions.includes('patient_view') || permissions.includes('appointment_view_all')));

            const res = hasViewAllAccess
                ? await doctorAPI.getAllAppointments()
                : await doctorAPI.getAppointments();

            if (res && res.success && Array.isArray(res.appointments)) {
                setAppointments(res.appointments);
            } else {
                setAppointments([]);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Unable to load appointments. Please check network connection or try again.');
            setAppointments([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAllAppointments();
    }, [fetchAllAppointments]);

    const handleManualRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            await fetchAllAppointments(true);
            Alert.alert('Refreshed', 'Patient queue refreshed successfully');
        } catch (err) {
            Alert.alert('Error', 'Failed to refresh queue');
        } finally {
            setTimeout(() => setRefreshing(false), 500);
        }
    };

    // Navigation to Patient Profile
    const handleViewProfile = (apt) => {
        if (!apt) return;
        const targetId = (typeof apt.userId === 'object' ? apt.userId?._id || apt.userId?.patientId || apt.userId?.mrn : apt.userId)
            || (typeof apt.clinicPatientId === 'object' ? apt.clinicPatientId?._id || apt.clinicPatientId?.patientUid : apt.clinicPatientId)
            || apt.patientId 
            || apt._id;

        if (!targetId) {
            Alert.alert('Notice', 'Patient record identifier not found');
            return;
        }

        const dept = apt.department || apt.serviceName || apt.specialization || 'Unassigned';
        navigation.navigate('UnifiedPatientProfile', {
            id: targetId,
            patientId: targetId,
            department: dept
        });
    };

    // Calculate BMI when weight/height change
    useEffect(() => {
        const w = parseFloat(vitals.weight);
        const h = parseFloat(vitals.height) / 100; // cm to m
        if (w > 0 && h > 0) {
            setVitals(v => ({ ...v, bmi: (w / (h * h)).toFixed(1) }));
        }
    }, [vitals.weight, vitals.height]);

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

    const handleUploadReport = async () => {
        if (!uploadFile || !uploadPatient) {
            Alert.alert('Required', 'Please select a report file to upload');
            return;
        }
        setUploading(true);

        try {
            const formData = new FormData();
            if (Platform.OS === 'web' && uploadFile.file) {
                formData.append('reportFile', uploadFile.file);
            } else {
                formData.append('reportFile', {
                    uri: uploadFile.uri,
                    name: uploadFile.name || 'medical_report.pdf',
                    type: uploadFile.mimeType || 'application/octet-stream'
                });
            }
            formData.append('appointmentId', uploadPatient._id);

            const res = await reportAPI.uploadReport(formData);
            if (res && (res.success || res.report)) {
                const uploadedFile = res.report || res;
                const patientId = uploadPatient.userId?._id || uploadPatient.clinicPatientId?.patientUid || uploadPatient.clinicPatientId?._id || uploadPatient.patientId;
                
                const isClinic = !!uploadPatient.clinicPatientId;
                const existingReports = isClinic 
                    ? (uploadPatient.clinicPatientId?.reports || []).map(r => ({
                        fileName: r.name,
                        url: (r.filename || '').startsWith('http://') || (r.filename || '').startsWith('https://')
                            ? r.filename
                            : `${r.filename}`,
                        date: r.uploadedAt
                      }))
                    : (uploadPatient.userId?.fertilityProfile?.previousReports || []);
                
                const newReport = {
                    fileName: uploadFile.name || 'Report',
                    url: uploadedFile.url,
                    date: new Date().toISOString()
                };

                if (patientId) {
                    await doctorAPI.updatePatientProfile(patientId, {
                        previousReports: [...existingReports, newReport]
                    });
                }

                Alert.alert('Success', 'Report uploaded successfully!');
                setUploadPatient(null);
                setUploadFile(null);
                fetchAllAppointments();
            } else {
                Alert.alert('Success', 'Report saved to patient file!');
                setUploadPatient(null);
                setUploadFile(null);
            }
        } catch (err) {
            console.error('Report upload error:', err);
            Alert.alert('Error', 'Error uploading report: ' + (err.response?.data?.message || err.message || 'Upload failed'));
        } finally {
            setUploading(false);
        }
    };

    const handleSaveVitals = async () => {
        if (!vitalsPatient) return;
        setSaving(true);
        try {
            const patientId = vitalsPatient.clinicPatientId?._id || vitalsPatient.clinicPatientId || vitalsPatient.userId?._id || vitalsPatient.userId;
            const profileData = {
                vitals: {
                    weight: vitals.weight,
                    height: vitals.height,
                    bmi: vitals.bmi,
                    bloodPressure: vitals.bloodPressure,
                    pulse: vitals.pulse,
                    temperature: vitals.temperature,
                    spo2: vitals.spo2,
                    respiratoryRate: vitals.respiratoryRate,
                    lastRecorded: new Date().toISOString()
                }
            };
            if (patientId) {
                await doctorAPI.updatePatientProfile(patientId, profileData);
            }

            if (vitals.chiefComplaint || vitals.notes) {
                try {
                    await doctorAPI.updateSession(vitalsPatient._id, {
                        notes: `Chief Complaint: ${vitals.chiefComplaint}\nNurse Notes: ${vitals.notes}`
                    });
                } catch (e) {}
            }

            Alert.alert('Success', 'Vitals saved successfully!');
            setVitalsPatient(null);
            setVitals({ weight: '', height: '', bmi: '', bloodPressure: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', chiefComplaint: '', notes: '' });
            fetchAllAppointments();
        } catch (err) {
            Alert.alert('Error', 'Error saving vitals: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = (aptId, newStatus) => {
        setAppointments(prev => prev.map(a => a._id === aptId ? { ...a, status: newStatus } : a));
        setActiveMenuId(null);
        Alert.alert('Updated', `Status updated to ${newStatus}`);
    };

    const openVitalsForm = (apt) => {
        let existing = {};
        if (apt.clinicPatientId) {
            existing = apt.clinicPatientId.vitals || {};
            if (!existing.weight && apt.vitals) {
                existing = {
                    weight: apt.vitals.weight,
                    height: apt.vitals.height,
                    bmi: apt.vitals.bmi,
                    bloodPressure: apt.vitals.bp,
                    pulse: apt.vitals.pulse,
                    temperature: apt.vitals.temperature,
                    spo2: apt.vitals.spo2,
                    respiratoryRate: apt.vitals.rr
                };
            }
        } else {
            existing = apt.userId?.fertilityProfile?.vitals || {};
        }

        setVitals({
            weight: existing.weight || '',
            height: existing.height || '',
            bmi: existing.bmi || '',
            bloodPressure: existing.bloodPressure || existing.bp || '',
            pulse: existing.pulse ? String(existing.pulse) : '',
            temperature: existing.temperature ? String(existing.temperature) : '',
            spo2: existing.spo2 ? String(existing.spo2) : '',
            respiratoryRate: existing.respiratoryRate ? String(existing.respiratoryRate) : existing.rr ? String(existing.rr) : '',
            chiefComplaint: '',
            notes: ''
        });
        setVitalsPatient(apt);
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setSortBy('latest');
        setFromDate('');
        setToDate('');
        setFilterPopoverOpen(false);
    };

    // Active filters count
    const activeFilterCount = 
        (statusFilter !== 'all' ? 1 : 0) +
        (sortBy !== 'latest' ? 1 : 0) +
        (fromDate ? 1 : 0) +
        (toDate ? 1 : 0);

    // Filtering & Sorting Logic
    const q = searchQuery.toLowerCase().trim();
    const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

    const filtered = useMemo(() => {
        let result = appointments.filter(a => {
            const pName = a.userId?.name || a.clinicPatientId?.name || '';
            const pPhone = a.userId?.phone || a.clinicPatientId?.phone || '';
            const pId = a.userId?.patientId || a.clinicPatientId?.patientUid || a.patientId || a.userId?.mrn || '';
            const dName = a.doctorName || a.doctorId?.name || '';

            const matchesQuery = !q || (
                pName.toLowerCase().includes(q) ||
                pPhone.toLowerCase().includes(q) ||
                pId.toLowerCase().includes(q) ||
                dName.toLowerCase().includes(q)
            );

            const status = (a.status || 'confirmed').toLowerCase();
            const matchesStatus = statusFilter === 'all' || status === statusFilter.toLowerCase();

            // Date Range Filtering
            let matchesDateRange = true;
            if (fromDate || toDate) {
                const aptDate = a.appointmentDate ? new Date(a.appointmentDate) : null;
                if (aptDate && !isNaN(aptDate.getTime())) {
                    const aptMidnight = new Date(aptDate.getFullYear(), aptDate.getMonth(), aptDate.getDate()).getTime();
                    if (fromDate) {
                        const fromMidnight = new Date(fromDate).setHours(0,0,0,0);
                        if (aptMidnight < fromMidnight) matchesDateRange = false;
                    }
                    if (toDate) {
                        const toMidnight = new Date(toDate).setHours(23,59,59,999);
                        if (aptMidnight > toMidnight) matchesDateRange = false;
                    }
                } else {
                    matchesDateRange = false;
                }
            }

            return matchesQuery && matchesStatus && matchesDateRange;
        });

        // Sorting
        if (sortBy === 'latest') {
            result.sort((a, b) => new Date(b.appointmentDate || 0) - new Date(a.appointmentDate || 0));
        } else if (sortBy === 'oldest') {
            result.sort((a, b) => new Date(a.appointmentDate || 0) - new Date(b.appointmentDate || 0));
        } else if (sortBy === 'name-asc') {
            result.sort((a, b) => {
                const nameA = a.userId?.name || a.clinicPatientId?.name || '';
                const nameB = b.userId?.name || b.clinicPatientId?.name || '';
                return nameA.localeCompare(nameB);
            });
        } else if (sortBy === 'name-desc') {
            result.sort((a, b) => {
                const nameA = a.userId?.name || a.clinicPatientId?.name || '';
                const nameB = b.userId?.name || b.clinicPatientId?.name || '';
                return nameB.localeCompare(nameA);
            });
        }

        return result;
    }, [appointments, q, statusFilter, fromDate, toDate, sortBy]);

    const todayStr = useMemo(() => new Date().toDateString(), []);
    const todayAppts = useMemo(() => {
        return filtered.filter(a =>
            a.appointmentDate && new Date(a.appointmentDate).toDateString() === todayStr
        );
    }, [filtered, todayStr]);

    const displayList = activeTab === 'today' ? todayAppts : filtered;

    // Stat counts
    const totalPatientsUnique = useMemo(() => {
        return new Set(appointments.map(a => a.userId?._id || a.clinicPatientId?._id || a.patientId || a.userId?.name)).size || appointments.length || 0;
    }, [appointments]);

    const upcomingAppointments = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        return appointments.filter(a => {
            const d = new Date(a.appointmentDate);
            return d >= today && (a.status === 'pending' || a.status === 'confirmed');
        }).length;
    }, [appointments]);

    const completedToday = useMemo(() => {
        return appointments.filter(a => 
            a.status === 'completed' && a.appointmentDate && new Date(a.appointmentDate).toDateString() === todayStr
        ).length;
    }, [appointments, todayStr]);

    // Format date for banner
    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const getStatusBadgeStyle = (status) => {
        const s = (status || 'confirmed').toLowerCase();
        switch (s) {
            case 'completed':
                return { bg: '#dbeafe', color: '#2563eb' };
            case 'confirmed':
                return { bg: '#dcfce7', color: '#16a34a' };
            case 'pending':
                return { bg: '#fef3c7', color: '#b45309' };
            case 'cancelled':
                return { bg: '#fee2e2', color: '#dc2626' };
            default:
                return { bg: '#f1f5f9', color: '#475569' };
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchAllAppointments(true)}
                    colors={['#0284c7']}
                    tintColor="#0284c7"
                />
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {Boolean(error) && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                </View>
            )}

            {/* ─── 1. CLEAN HEALTHCARE SAAS BANNER (NO ADD PATIENT BUTTON) ─── */}
            <View style={styles.modernBanner}>
                <View style={styles.bannerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.exactTitle}>Patient Queue & Consultations</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>DOCTOR</Text>
                        </View>
                    </View>
                    <Text style={styles.exactSubtitle}>
                        Manage your patients, appointments and clinical records efficiently.
                    </Text>
                </View>

                <View style={styles.bannerRight}>
                    <TouchableOpacity
                        style={[styles.bannerRefreshBtn, refreshing && styles.bannerRefreshBtnDisabled]}
                        onPress={handleManualRefresh}
                        disabled={refreshing}
                        activeOpacity={0.8}
                    >
                        <Feather name="refresh-cw" size={14} color="#0284c7" style={{ marginRight: 6 }} />
                        <Text style={styles.bannerRefreshText}>Refresh</Text>
                    </TouchableOpacity>

                    <View style={styles.dateCard}>
                        <View style={styles.dateIconWrap}>
                            <Feather name="calendar" size={15} color="#0284c7" />
                        </View>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dateDay}>{dayName}</Text>
                            <Text style={styles.dateFull}>{formattedDate}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* ─── 2. STATS ROW (3 SUMMARY CARDS) ─── */}
            <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                <View style={[styles.statBox, styles.statBlue]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="users" size={22} color="#2563eb" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{totalPatientsUnique}</Text>
                        <Text style={styles.statTitle}>Total Patients (Unique)</Text>
                    </View>
                    <View style={styles.statWatermark} pointerEvents="none">
                        <Feather name="users" size={44} color="#bfdbfe" />
                    </View>
                </View>

                <View style={[styles.statBox, styles.statOrange]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#ffedd5' }]}>
                        <Feather name="calendar" size={22} color="#ea580c" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{upcomingAppointments}</Text>
                        <Text style={styles.statTitle}>Upcoming Appointments</Text>
                    </View>
                    <View style={styles.statWatermark} pointerEvents="none">
                        <Feather name="calendar" size={44} color="#fed7aa" />
                    </View>
                </View>

                <View style={[styles.statBox, styles.statGreen]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="check-circle" size={22} color="#16a34a" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{completedToday}</Text>
                        <Text style={styles.statTitle}>Completed Today</Text>
                    </View>
                    <View style={styles.statWatermark} pointerEvents="none">
                        <Feather name="trending-up" size={44} color="#bbf7d0" />
                    </View>
                </View>
            </View>

            {/* ─── 3. CONSOLIDATED SLIM TOOLBAR: SEARCH + TABS + FILTER ─── */}
            <View style={styles.toolbarCard}>
                <View style={styles.toolbarMainRow}>
                    {/* Search Input Bar */}
                    <View style={[styles.searchPillContainer, isMobile && { minWidth: '100%' }]}>
                        <Feather name="search" size={15} color="#64748b" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchPillInput}
                            placeholder="Search patient name, phone, MRN, or doctor..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                                <Feather name="x" size={12} color="#64748b" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Centered Controls Group: Queue Tabs + Filter & Sort */}
                    <View style={styles.toolbarControlsGroup}>
                        <TouchableOpacity 
                            style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
                            onPress={() => setActiveTab('all')}
                            activeOpacity={0.8}
                        >
                            <Feather name="calendar" size={14} color={activeTab === 'all' ? '#ffffff' : '#475569'} style={{ marginRight: 5 }} />
                            <Text style={[styles.tabPillText, activeTab === 'all' && styles.tabPillTextActive]}>All Appointments</Text>
                            <View style={[styles.tabCountBadge, activeTab === 'all' && styles.tabCountBadgeActive]}>
                                <Text style={[styles.tabCountBadgeText, activeTab === 'all' && styles.tabCountBadgeTextActive]}>{filtered.length}</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.tabPill, activeTab === 'today' && styles.tabPillActive]}
                            onPress={() => setActiveTab('today')}
                            activeOpacity={0.8}
                        >
                            <Feather name="clock" size={14} color={activeTab === 'today' ? '#ffffff' : '#475569'} style={{ marginRight: 5 }} />
                            <Text style={[styles.tabPillText, activeTab === 'today' && styles.tabPillTextActive]}>Today's Queue</Text>
                            {todayAppts.length > 0 && (
                                <View style={[styles.tabCountBadge, activeTab === 'today' && styles.tabCountBadgeActive]}>
                                    <Text style={[styles.tabCountBadgeText, activeTab === 'today' && styles.tabCountBadgeTextActive]}>{todayAppts.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.filterTriggerBtn, activeFilterCount > 0 && styles.filterTriggerBtnActive]}
                            onPress={() => setFilterPopoverOpen(true)}
                            activeOpacity={0.8}
                        >
                            <Feather name="sliders" size={14} color={activeFilterCount > 0 ? '#0284c7' : '#334155'} style={{ marginRight: 6 }} />
                            <Text style={[styles.filterTriggerText, activeFilterCount > 0 && { color: '#0284c7' }]}>Filter & Sort</Text>
                            {activeFilterCount > 0 && (
                                <View style={styles.activeFilterCountBadge}>
                                    <Text style={styles.activeFilterCountBadgeText}>{activeFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {activeFilterCount > 0 && (
                            <TouchableOpacity 
                                style={styles.quickResetBtn}
                                onPress={clearAllFilters}
                                activeOpacity={0.8}
                            >
                                <Feather name="rotate-ccw" size={12} color="#dc2626" style={{ marginRight: 4 }} />
                                <Text style={styles.quickResetBtnText}>Reset</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* ─── 4. PATIENT APPOINTMENT CARDS ─── */}
            <View style={styles.cardsSection}>
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0284c7" />
                        <Text style={styles.loadingText}>Loading patient records...</Text>
                    </View>
                ) : displayList.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyEmoji}>👥</Text>
                        <Text style={styles.emptyTitle}>No Patient Appointments Found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery || activeFilterCount > 0
                                ? "No patients match your search or filter criteria. Try adjusting or clearing filters."
                                : "No patient appointments have been booked for this queue yet."}
                        </Text>
                        {activeFilterCount > 0 && (
                            <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                                <Text style={styles.clearFiltersBtnText}>Clear All Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.cardsGrid}>
                        {displayList.map((apt, index) => {
                            const pName = apt.userId?.name || apt.clinicPatientId?.name || 'Walk-in Patient';
                            const rawId = apt.userId?.mrn || apt.clinicPatientId?.mrn || apt.userId?.patientId || apt.clinicPatientId?.patientUid || apt.patientId || '—';
                            const pId = typeof rawId === 'string' ? rawId.replace(/^MRN[:\-\s]*/i, '') : rawId;
                            const dName = (apt.doctorName || apt.doctorId?.name || 'Assigned Doctor').replace(/^Dr\.?\s*/i, '');
                            
                            const aptDateObj = apt.appointmentDate ? new Date(apt.appointmentDate) : null;
                            const dateFormatted = aptDateObj && !isNaN(aptDateObj.getTime())
                                ? aptDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—';
                            const timeFormatted = apt.appointmentTime || '--:--';

                            const avatarBg = avatarColors[index % avatarColors.length];
                            const initial = (pName.trim().charAt(0) || 'P').toUpperCase();
                            const status = (apt.status || 'confirmed').toLowerCase();
                            const stStyle = getStatusBadgeStyle(status);

                            const isMenuOpen = activeMenuId === apt._id;

                            return (
                                <View key={apt._id || index} style={styles.exactCard}>
                                    {/* Top User Row */}
                                    <View style={styles.cardTopRow}>
                                        <View style={styles.cardUserLeft}>
                                            <View style={[styles.cardAvatar, { backgroundColor: avatarBg }]}>
                                                <Text style={styles.cardAvatarText}>{initial}</Text>
                                            </View>
                                            <View style={styles.cardUserNames}>
                                                <TouchableOpacity onPress={() => handleViewProfile(apt)}>
                                                    <Text style={styles.cardPatientName} numberOfLines={1}>{pName}</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.cardPatientId}>MRN: {pId}</Text>
                                            </View>
                                        </View>

                                        {/* 3-Dots Menu Button */}
                                        <View style={styles.cardMenuWrapper}>
                                            <TouchableOpacity 
                                                style={styles.cardMoreBtn}
                                                onPress={() => setActiveMenuId(isMenuOpen ? null : apt._id)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="more-horizontal" size={16} color="#64748b" />
                                            </TouchableOpacity>

                                            {isMenuOpen && (
                                                <View style={styles.cardDropdownMenu}>
                                                    <TouchableOpacity 
                                                        style={styles.cardMenuAction}
                                                        onPress={() => {
                                                            setActiveMenuId(null);
                                                            handleViewProfile(apt);
                                                        }}
                                                    >
                                                        <Feather name="user-check" size={14} color="#334155" style={{ marginRight: 8 }} />
                                                        <Text style={styles.cardMenuActionText}>View Full Profile</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity 
                                                        style={styles.cardMenuAction}
                                                        onPress={() => {
                                                            setActiveMenuId(null);
                                                            openVitalsForm(apt);
                                                        }}
                                                    >
                                                        <Feather name="activity" size={14} color="#334155" style={{ marginRight: 8 }} />
                                                        <Text style={styles.cardMenuActionText}>Enter Vitals</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity 
                                                        style={styles.cardMenuAction}
                                                        onPress={() => {
                                                            setActiveMenuId(null);
                                                            setUploadPatient(apt);
                                                        }}
                                                    >
                                                        <Feather name="upload-cloud" size={14} color="#334155" style={{ marginRight: 8 }} />
                                                        <Text style={styles.cardMenuActionText}>Upload Record</Text>
                                                    </TouchableOpacity>

                                                    <View style={styles.cardMenuDivider} />

                                                    {status !== 'completed' && (
                                                        <TouchableOpacity 
                                                            style={styles.cardMenuAction}
                                                            onPress={() => handleUpdateStatus(apt._id, 'completed')}
                                                        >
                                                            <Feather name="check" size={14} color="#16a34a" style={{ marginRight: 8 }} />
                                                            <Text style={[styles.cardMenuActionText, { color: '#16a34a' }]}>Mark Completed</Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    {status !== 'cancelled' && (
                                                        <TouchableOpacity 
                                                            style={styles.cardMenuAction}
                                                            onPress={() => handleUpdateStatus(apt._id, 'cancelled')}
                                                        >
                                                            <Feather name="x" size={14} color="#dc2626" style={{ marginRight: 8 }} />
                                                            <Text style={[styles.cardMenuActionText, { color: '#dc2626' }]}>Cancel Appointment</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Structured Patient Details Box */}
                                    <View style={styles.cardDetailsBox}>
                                        {/* Line 1: Date on Left, Status Badge on Right */}
                                        <View style={styles.cardDateStatusRow}>
                                            <View style={styles.schedulePart}>
                                                <Feather name="calendar" size={13} color="#ea580c" style={{ marginRight: 5 }} />
                                                <Text style={styles.detailMiniLabel}>Date:</Text>
                                                <Text style={styles.detailMiniVal}>{dateFormatted}</Text>
                                            </View>

                                            <View style={[styles.statusBadge, { backgroundColor: stStyle.bg }]}>
                                                <Text style={[styles.statusBadgeText, { color: stStyle.color }]}>
                                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Line 2: Appointment Time */}
                                        <View style={styles.cardTimeRow}>
                                            <Feather name="clock" size={13} color="#0d9488" style={{ marginRight: 5 }} />
                                            <Text style={styles.detailMiniLabel}>Time:</Text>
                                            <View style={styles.timeBadge}>
                                                <Text style={styles.timeBadgeText}>{timeFormatted && timeFormatted !== '--:--' ? timeFormatted : '09:00 AM'}</Text>
                                            </View>
                                        </View>

                                        {/* Line 3: Doctor Name */}
                                        <View style={styles.cardDoctorRow}>
                                            <FontAwesome5 name="user-md" size={13} color="#2563eb" style={{ marginRight: 5 }} />
                                            <Text style={styles.detailMiniLabel}>Doctor:</Text>
                                            <Text style={styles.detailDoctorVal}>Dr. {dName}</Text>
                                        </View>
                                    </View>

                                    {/* Card Footer Actions (View Profile & Consult) */}
                                    <View style={styles.cardActionsRow}>
                                        <TouchableOpacity 
                                            style={styles.btnProfile}
                                            onPress={() => handleViewProfile(apt)}
                                            activeOpacity={0.8}
                                        >
                                            <Feather name="user" size={13} color="#475569" style={{ marginRight: 5 }} />
                                            <Text style={styles.btnProfileText}>View Profile</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={styles.btnConsult}
                                            onPress={() => {
                                                const ptName = (pName || 'Walk-in').replace(/\s+/g, '-');
                                                const patientMRN = pId && pId !== '—' ? pId : ptName;
                                                navigation.navigate('DoctorPatientDetails', {
                                                    id: patientMRN,
                                                    patientId: patientMRN,
                                                    appointmentId: apt._id
                                                });
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <Feather name="file-text" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                            <Text style={styles.btnConsultText}>Consult</Text>
                                            <Feather name="arrow-right" size={12} color="#ffffff" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>

            {/* ─── 5. FILTER & SORT MODAL ─── */}
            <Modal
                visible={filterPopoverOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setFilterPopoverOpen(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setFilterPopoverOpen(false)}>
                    <Pressable style={styles.filterModalCard} onPress={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <View style={styles.filterModalHeader}>
                            <View style={styles.filterTitleWrap}>
                                <View style={styles.filterTitleIconWrap}>
                                    <Feather name="sliders" size={18} color="#0284c7" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.filterModalTitle}>Filter & Sort Patients</Text>
                                    <Text style={styles.filterModalSubtitle}>Refine queue by status, date or alphabetical order</Text>
                                </View>
                                {activeFilterCount > 0 && (
                                    <View style={styles.activeFilterPill}>
                                        <Text style={styles.activeFilterPillText}>{activeFilterCount} active</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity onPress={() => setFilterPopoverOpen(false)} style={styles.filterCloseBtn}>
                                <Feather name="x" size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Body */}
                        <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
                            {/* Sort Order */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>SORT ORDER</Text>
                                <View style={styles.chipsGrid}>
                                    {[
                                        { id: 'latest', label: 'Newest → Oldest' },
                                        { id: 'oldest', label: 'Oldest → Newest' },
                                        { id: 'name-asc', label: 'Patient Name (A → Z)' },
                                        { id: 'name-desc', label: 'Patient Name (Z → A)' },
                                    ].map(item => {
                                        const isSel = sortBy === item.id;
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.chipBtn, isSel && styles.chipBtnActive]}
                                                onPress={() => setSortBy(item.id)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={[styles.chipBtnText, isSel && styles.chipBtnTextActive]}>{item.label}</Text>
                                                {isSel && <Feather name="check" size={13} color="#0284c7" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Appointment Status */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>APPOINTMENT STATUS</Text>
                                <View style={styles.statusChipsWrap}>
                                    {[
                                        { id: 'all', label: 'All Statuses', color: '#6366f1' },
                                        { id: 'confirmed', label: 'Confirmed', color: '#16a34a' },
                                        { id: 'completed', label: 'Completed', color: '#2563eb' },
                                        { id: 'pending', label: 'Pending', color: '#d97706' },
                                        { id: 'cancelled', label: 'Cancelled', color: '#dc2626' },
                                    ].map(st => {
                                        const isSel = statusFilter === st.id;
                                        return (
                                            <TouchableOpacity
                                                key={st.id}
                                                style={[
                                                    styles.statusChipBtn,
                                                    isSel && { borderColor: st.color, backgroundColor: `${st.color}15` }
                                                ]}
                                                onPress={() => setStatusFilter(st.id)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[styles.statusDot, { backgroundColor: st.color }]} />
                                                <Text style={[styles.statusChipBtnText, isSel && { color: st.color, fontWeight: '700' }]}>
                                                    {st.label}
                                                </Text>
                                                {isSel && <Feather name="check" size={12} color={st.color} style={{ marginLeft: 4 }} />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            {/* Date Range */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>APPOINTMENT DATE RANGE</Text>
                                <View style={styles.dateRangeRow}>
                                    <View style={styles.dateInputGroup}>
                                        <Text style={styles.dateInputLabel}>From Date (YYYY-MM-DD)</Text>
                                        <TextInput
                                            style={styles.datePickerInput}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor="#94a3b8"
                                            value={fromDate}
                                            onChangeText={text => {
                                                if (text > todayIso) {
                                                    Alert.alert('Notice', 'Future dates cannot be selected');
                                                    return;
                                                }
                                                setFromDate(text);
                                            }}
                                        />
                                    </View>
                                    <View style={styles.dateInputGroup}>
                                        <Text style={styles.dateInputLabel}>To Date (YYYY-MM-DD)</Text>
                                        <TextInput
                                            style={styles.datePickerInput}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor="#94a3b8"
                                            value={toDate}
                                            onChangeText={text => {
                                                if (text > todayIso) {
                                                    Alert.alert('Notice', 'Future dates cannot be selected');
                                                    return;
                                                }
                                                setToDate(text);
                                            }}
                                        />
                                    </View>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.filterModalFooter}>
                            <View style={styles.filterFooterLeft}>
                                {activeFilterCount > 0 && (
                                    <TouchableOpacity onPress={clearAllFilters} style={styles.filterResetBtn}>
                                        <Feather name="rotate-ccw" size={12} color="#dc2626" style={{ marginRight: 4 }} />
                                        <Text style={styles.filterResetBtnText}>Reset All</Text>
                                    </TouchableOpacity>
                                )}
                                <Text style={styles.matchCountText}>
                                    Showing <Text style={{ fontWeight: '700', color: '#0f172a' }}>{displayList.length}</Text> matches
                                </Text>
                            </View>

                            <TouchableOpacity 
                                style={styles.btnApplyModal}
                                onPress={() => setFilterPopoverOpen(false)}
                                activeOpacity={0.85}
                            >
                                <Feather name="check-circle" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.btnApplyModalText}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ─── 6. VITALS MODAL ─── */}
            <Modal
                visible={Boolean(vitalsPatient)}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setVitalsPatient(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setVitalsPatient(null)}>
                    <Pressable style={styles.vitalsModalCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.filterModalHeader}>
                            <View>
                                <Text style={styles.filterModalTitle}>💉 Enter Vitals</Text>
                                <Text style={styles.filterModalSubtitle}>
                                    Patient: {vitalsPatient?.userId?.name || vitalsPatient?.clinicPatientId?.name || 'Unknown'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)} style={styles.filterCloseBtn}>
                                <Feather name="x" size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.vitalsModalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.vitalsInputsGrid}>
                                {[
                                    { key: 'weight', label: 'Weight (kg)', icon: '⚖️', keyboardType: 'numeric' },
                                    { key: 'height', label: 'Height (cm)', icon: '📏', keyboardType: 'numeric' },
                                    { key: 'bmi', label: 'BMI (auto)', icon: '📊', readOnly: true },
                                    { key: 'bloodPressure', label: 'Blood Pressure', icon: '🩸', placeholder: '120/80' },
                                    { key: 'pulse', label: 'Pulse (bpm)', icon: '💓', keyboardType: 'numeric' },
                                    { key: 'temperature', label: 'Temp (°F)', icon: '🌡️', keyboardType: 'numeric' },
                                    { key: 'spo2', label: 'SpO₂ (%)', icon: '🫁', keyboardType: 'numeric' },
                                    { key: 'respiratoryRate', label: 'Resp Rate (/min)', icon: '💨', keyboardType: 'numeric' },
                                ].map(field => (
                                    <View key={field.key} style={styles.vitalFieldGroup}>
                                        <Text style={styles.vitalFieldLabel}>{field.icon} {field.label}</Text>
                                        <TextInput
                                            style={[styles.vitalFieldInput, field.readOnly && styles.vitalFieldInputReadOnly]}
                                            value={vitals[field.key]}
                                            editable={!field.readOnly}
                                            placeholder={field.placeholder || ''}
                                            placeholderTextColor="#94a3b8"
                                            keyboardType={field.keyboardType || 'default'}
                                            onChangeText={val => setVitals(prev => ({ ...prev, [field.key]: val }))}
                                        />
                                    </View>
                                ))}
                            </View>

                            <View style={styles.vitalTextareaGroup}>
                                <Text style={styles.vitalFieldLabel}>📋 Chief Complaint</Text>
                                <TextInput
                                    style={styles.vitalTextareaInput}
                                    multiline
                                    numberOfLines={3}
                                    placeholder="Patient's chief complaint..."
                                    placeholderTextColor="#94a3b8"
                                    value={vitals.chiefComplaint}
                                    onChangeText={val => setVitals(prev => ({ ...prev, chiefComplaint: val }))}
                                />
                            </View>

                            <View style={styles.vitalTextareaGroup}>
                                <Text style={styles.vitalFieldLabel}>📝 Clinical / Nurse Notes</Text>
                                <TextInput
                                    style={styles.vitalTextareaInput}
                                    multiline
                                    numberOfLines={3}
                                    placeholder="Any clinical observations or notes..."
                                    placeholderTextColor="#94a3b8"
                                    value={vitals.notes}
                                    onChangeText={val => setVitals(prev => ({ ...prev, notes: val }))}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.filterModalFooter}>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
                                onPress={handleSaveVitals}
                                disabled={saving}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Vitals'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ─── 7. UPLOAD RECORD MODAL ─── */}
            <Modal
                visible={Boolean(uploadPatient)}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setUploadPatient(null)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setUploadPatient(null)}>
                    <Pressable style={styles.filterModalCard} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.filterModalHeader}>
                            <View>
                                <Text style={styles.filterModalTitle}>📁 Upload Medical Record</Text>
                                <Text style={styles.filterModalSubtitle}>
                                    Patient: {uploadPatient?.userId?.name || 'Patient'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setUploadPatient(null)} style={styles.filterCloseBtn}>
                                <Feather name="x" size={16} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.uploadModalBody}>
                            <Text style={styles.uploadInstructions}>
                                Upload previous medical reports, prescriptions, or imaging scans.
                            </Text>

                            <TouchableOpacity 
                                style={styles.dropzone}
                                onPress={handlePickDocument}
                                activeOpacity={0.8}
                            >
                                <Feather name="upload-cloud" size={36} color="#0284c7" style={{ marginBottom: 8 }} />
                                <Text style={styles.dropzoneMainText}>Tap to select document or image</Text>
                                <Text style={styles.dropzoneSubText}>
                                    {uploadFile ? uploadFile.name : 'Select PDF or image file'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterModalFooter}>
                            <TouchableOpacity onPress={() => setUploadPatient(null)} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.btnPrimary, (uploading || !uploadFile) && { opacity: 0.6 }]}
                                onPress={handleUploadReport}
                                disabled={uploading || !uploadFile}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.btnPrimaryText}>{uploading ? 'Uploading...' : 'Save Record'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
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
        padding: 16,
        paddingBottom: 40,
    },
    errorBanner: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorBannerText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '600',
    },
    modernBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 20,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    bannerLeft: {
        flex: 1,
        minWidth: 260,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 6,
    },
    exactTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    roleBadge: {
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    roleBadgeText: {
        color: '#0f766e',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    exactSubtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    bannerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    bannerRefreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    bannerRefreshBtnDisabled: {
        opacity: 0.6,
    },
    bannerRefreshText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
    },
    dateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    dateIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#f0f9ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateInfo: {
        flexDirection: 'column',
    },
    dateDay: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
    },
    dateFull: {
        fontSize: 12.5,
        color: '#0f172a',
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 20,
    },
    statsGridMobile: {
        flexDirection: 'column',
    },
    statBox: {
        flex: 1,
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    statBlue: {
        backgroundColor: '#f0f9ff',
        borderColor: '#e0f2fe',
    },
    statOrange: {
        backgroundColor: '#fff7ed',
        borderColor: '#ffedd5',
    },
    statGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#dcfce7',
    },
    statIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statData: {
        flexDirection: 'column',
        zIndex: 1,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        lineHeight: 24,
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 4,
    },
    statWatermark: {
        position: 'absolute',
        right: 12,
        bottom: 8,
        opacity: 0.6,
    },
    toolbarCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 10,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    toolbarMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
    },
    searchPillContainer: {
        flex: 1,
        minWidth: 240,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        minHeight: 38,
    },
    searchPillInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        paddingVertical: 6,
    },
    searchClearBtn: {
        padding: 3,
        borderRadius: 999,
        backgroundColor: '#f1f5f9',
    },
    toolbarControlsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    tabPillActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    tabPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    tabPillTextActive: {
        color: '#ffffff',
    },
    tabCountBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 9999,
        marginLeft: 6,
    },
    tabCountBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    tabCountBadgeText: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#1e40af',
    },
    tabCountBadgeTextActive: {
        color: '#ffffff',
    },
    filterTriggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
    },
    filterTriggerBtnActive: {
        borderColor: '#0284c7',
        backgroundColor: '#f0f9ff',
    },
    filterTriggerText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    activeFilterCountBadge: {
        backgroundColor: '#0284c7',
        borderRadius: 9999,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        marginLeft: 5,
    },
    activeFilterCountBadgeText: {
        color: '#ffffff',
        fontSize: 9.5,
        fontWeight: '800',
    },
    quickResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6.5,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fef2f2',
    },
    quickResetBtnText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#dc2626',
    },
    cardsSection: {
        marginBottom: 20,
    },
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
    },
    emptyBox: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyEmoji: {
        fontSize: 38,
        marginBottom: 10,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 320,
        lineHeight: 18,
    },
    clearFiltersBtn: {
        marginTop: 14,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    clearFiltersBtnText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
    },
    cardsGrid: {
        gap: 12,
    },
    exactCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cardUserLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    cardAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardAvatarText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    cardUserNames: {
        flex: 1,
    },
    cardPatientName: {
        fontSize: 14.5,
        fontWeight: '700',
        color: '#0f172a',
        textTransform: 'capitalize',
    },
    cardPatientId: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 1,
    },
    cardMenuWrapper: {
        position: 'relative',
    },
    cardMoreBtn: {
        width: 28,
        height: 28,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardDropdownMenu: {
        position: 'absolute',
        top: 32,
        right: 0,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 6,
        minWidth: 170,
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
    },
    cardMenuAction: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    cardMenuActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    cardMenuDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
    },
    cardDetailsBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 9,
        padding: 10,
        gap: 6,
        marginBottom: 10,
    },
    cardDateStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    schedulePart: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailMiniLabel: {
        fontSize: 11.5,
        color: '#64748b',
        marginRight: 4,
    },
    detailMiniVal: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0f172a',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 9999,
    },
    statusBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    cardTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 5,
    },
    timeBadge: {
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#ccfbf1',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    timeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f766e',
    },
    cardDoctorRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailDoctorVal: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563eb',
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
    },
    btnProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    btnProfileText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    btnConsult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#2563eb',
    },
    btnConsultText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },

    /* Filter Modal Styles */
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    filterModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: '100%',
        maxWidth: 540,
        maxHeight: '85%',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    filterModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    filterTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    filterTitleIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    filterModalSubtitle: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    activeFilterPill: {
        backgroundColor: '#e0f2fe',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    activeFilterPillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#0369a1',
    },
    filterCloseBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    },
    filterModalBody: {
        paddingVertical: 14,
    },
    filterSection: {
        marginBottom: 16,
    },
    filterSectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    chipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: '47%',
        flex: 1,
    },
    chipBtnActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#0284c7',
    },
    chipBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    chipBtnTextActive: {
        color: '#0284c7',
        fontWeight: '700',
    },
    statusChipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusChipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 9,
        paddingHorizontal: 11,
        paddingVertical: 7,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 6,
    },
    statusChipBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    dateRangeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    dateInputGroup: {
        flex: 1,
    },
    dateInputLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
    },
    datePickerInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12.5,
        color: '#0f172a',
    },
    filterModalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        flexWrap: 'wrap',
        gap: 10,
    },
    filterFooterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    filterResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    filterResetBtnText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#dc2626',
    },
    matchCountText: {
        fontSize: 12,
        color: '#64748b',
    },
    btnApplyModal: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284c7',
        borderRadius: 9,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    btnApplyModalText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ffffff',
    },

    /* Vitals Modal */
    vitalsModalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: '100%',
        maxWidth: 580,
        maxHeight: '90%',
        padding: 20,
    },
    vitalsModalBody: {
        paddingVertical: 14,
    },
    vitalsInputsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    vitalFieldGroup: {
        width: '48%',
    },
    vitalFieldLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
    },
    vitalFieldInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12.5,
        color: '#0f172a',
    },
    vitalFieldInputReadOnly: {
        backgroundColor: '#f1f5f9',
        color: '#64748b',
    },
    vitalTextareaGroup: {
        marginTop: 12,
    },
    vitalTextareaInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontSize: 12.5,
        color: '#0f172a',
        textAlignVertical: 'top',
        minHeight: 65,
    },
    btnSecondary: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    btnSecondaryText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#475569',
    },
    btnPrimary: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#0284c7',
        borderRadius: 8,
    },
    btnPrimaryText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ffffff',
    },

    /* Upload Record Modal */
    uploadModalBody: {
        paddingVertical: 16,
    },
    uploadInstructions: {
        fontSize: 12.5,
        color: '#475569',
        marginBottom: 14,
    },
    dropzone: {
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
    dropzoneMainText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    dropzoneSubText: {
        fontSize: 11.5,
        color: '#64748b',
    },
});

export default Patient;
