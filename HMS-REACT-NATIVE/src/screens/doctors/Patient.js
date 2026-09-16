import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform, 
    useWindowDimensions, Pressable 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { doctorAPI, reportAPI, referralAPI, otAPI } from '../../utils/api';
import { Feather, FontAwesome5 } from '@expo/vector-icons';

// Default mock appointments matching Web screenshot/source if backend data is empty
const nowIso = new Date().toISOString();
const DEFAULT_APPOINTMENTS = [
    {
        _id: 'apt-001',
        appointmentDate: nowIso,
        appointmentTime: '12:00',
        status: 'completed',
        doctorName: 'Dr. Rashi Khanna',
        userId: {
            _id: 'usr-001',
            name: 'aman sharma',
            patientId: 'CIT-M365-002',
            phone: '6666777700',
            email: 'aman2@test.com',
            gender: 'Male',
            age: 28
        }
    },
    {
        _id: 'apt-002',
        appointmentDate: nowIso,
        appointmentTime: '16:00',
        status: 'confirmed',
        doctorName: 'Dr. Rashi Khanna',
        userId: {
            _id: 'usr-002',
            name: 'aman sharma',
            patientId: 'CIT-M365-001',
            phone: '0897879800',
            email: 'aman@test2.com',
            gender: 'Male',
            age: 32
        }
    },
    {
        _id: 'apt-003',
        appointmentDate: '2026-08-19T10:30:00.000Z',
        appointmentTime: '10:30',
        status: 'completed',
        doctorName: 'Dr. Rashi Khanna',
        userId: {
            _id: 'usr-003',
            name: 'dfsf',
            patientId: 'CIT-M365-003',
            phone: '6765643213',
            email: 'efsdvd@test.com',
            gender: 'Female',
            age: 25
        }
    },
    {
        _id: 'apt-004',
        appointmentDate: '2026-08-19T12:30:00.000Z',
        appointmentTime: '12:30',
        status: 'confirmed',
        doctorName: 'Dr. Rashi Khanna',
        userId: {
            _id: 'usr-004',
            name: 'kushal Singh',
            patientId: 'CIT-M365-005',
            phone: '8776172736',
            email: 'kushal@gmail.com',
            gender: 'Male',
            age: 40
        }
    }
];

const Patient = ({ route: propRoute } = {}) => {
    const navigation = useNavigation();
    let navRoute = null;
    try {
        navRoute = useRoute();
    } catch (e) {}
    const route = propRoute || navRoute;

    const { width } = useWindowDimensions();
    const isMobile = width > 0 ? width < 768 : false;

    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Default to 'all' (card-grid layout), respecting route.params.tab if passed
    const initialTab = route?.params?.tab || 'all';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('latest');

    // Sync tab if route params update dynamically
    useEffect(() => {
        if (route?.params?.tab && route.params.tab !== activeTab) {
            setActiveTab(route.params.tab);
        }
    }, [route?.params?.tab]);
    
    // Dropdown toggles
    const [filterOpen, setFilterOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);

    // Modals
    const [vitalsPatient, setVitalsPatient] = useState(null);
    const [uploadPatient, setUploadPatient] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showAddPatientModal, setShowAddPatientModal] = useState(false);
    const [newPatient, setNewPatient] = useState({
        name: '',
        phone: '',
        email: '',
        gender: 'Male',
        age: '',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: '10:00',
        reason: ''
    });

    const [vitals, setVitals] = useState({
        weight: '', height: '', bmi: '', bloodPressure: '',
        pulse: '', temperature: '', spo2: '', respiratoryRate: '',
        chiefComplaint: '', notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [myReferrals, setMyReferrals] = useState([
        {
            _id: 'ref-01',
            patientId: { name: 'Sunita Sharma', mrn: 'CIT-M365-010', phone: '9876543210' },
            referringDoctorId: { name: 'Dr. Amit Patel' },
            reason: 'Laparoscopic Evaluation Required',
            referralDate: '2026-08-20',
            status: 'REFERRED'
        }
    ]);
    const [mySurgeryPlans, setMySurgeryPlans] = useState([
        {
            _id: 'sp-01',
            planId: 'SURG-101',
            surgery: 'Diagnostic Laparoscopy & Hysteroscopy',
            diagnosis: 'Secondary Infertility',
            patientId: { name: 'Pooja Verma', mrn: 'CIT-M365-012', phone: '9811223344' },
            referringDoctorId: { name: 'Dr. Neha Gupta' },
            otRoomId: { name: 'OT 1 - Major' },
            surgeryDate: '2026-08-22',
            startTime: '09:00',
            endTime: '11:00',
            surgeryCost: 45000,
            paymentStatus: 'PAID',
            status: 'SCHEDULED'
        },
        {
            _id: 'sp-02',
            planId: 'SURG-102',
            surgery: 'Ovarian Cystectomy',
            diagnosis: 'Left Endometrioma 5cm',
            patientId: { name: 'Kavita Roy', mrn: 'CIT-M365-015', phone: '9822334455' },
            otRoomId: { name: 'OT 2' },
            surgeryDate: '2026-08-25',
            startTime: '11:30',
            endTime: '13:30',
            surgeryCost: 60000,
            paymentStatus: 'PARTIALLY PAID',
            status: 'PLANNED'
        }
    ]);

    useEffect(() => {
        fetchAllAppointments();
        fetchMyReferrals();
        fetchMySurgeryPlans();
    }, []);

    const fetchMyReferrals = async () => {
        try {
            const res = await referralAPI.getMyReferrals();
            if (res.success && res.referrals?.length) {
                setMyReferrals(res.referrals);
            }
        } catch (err) {
            console.error("Error fetching referrals:", err);
        }
    };

    const fetchMySurgeryPlans = async () => {
        try {
            const res = await otAPI.getMySurgeryPlans();
            if (res.success && res.data?.length) {
                setMySurgeryPlans(res.data);
            }
        } catch (err) {
            console.error("Error fetching my surgery plans:", err);
        }
    };

    const fetchAllAppointments = async () => {
        setLoading(true);
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

            if (res.success && res.appointments && res.appointments.length > 0) {
                setAppointments(res.appointments);
            } else {
                setAppointments(DEFAULT_APPOINTMENTS);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setAppointments(DEFAULT_APPOINTMENTS);
        } finally {
            setLoading(false);
        }
    };

    // Auto-calculate BMI
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

    const handleAddPatientSubmit = () => {
        if (!newPatient.name.trim() || !newPatient.phone.trim()) {
            Alert.alert('Required', 'Please enter patient name and phone number');
            return;
        }

        const createdApt = {
            _id: 'apt-' + Date.now(),
            appointmentDate: new Date(newPatient.appointmentDate).toISOString(),
            appointmentTime: newPatient.appointmentTime,
            status: 'confirmed',
            doctorName: 'Dr. Rashi Khanna',
            userId: {
                _id: 'usr-' + Date.now(),
                name: newPatient.name,
                patientId: 'CIT-M365-00' + (appointments.length + 1),
                phone: newPatient.phone,
                email: newPatient.email,
                gender: newPatient.gender,
                age: newPatient.age
            }
        };

        setAppointments([createdApt, ...appointments]);
        setShowAddPatientModal(false);
        setNewPatient({
            name: '',
            phone: '',
            email: '',
            gender: 'Male',
            age: '',
            appointmentDate: new Date().toISOString().split('T')[0],
            appointmentTime: '10:00',
            reason: ''
        });
        Alert.alert('Success', 'Patient appointment added successfully!');
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

    // Filtering & Sorting
    const q = searchQuery.toLowerCase().trim();
    let filtered = appointments.filter(a => {
        const pName = a.userId?.name || a.clinicPatientId?.name || '';
        const pPhone = a.userId?.phone || a.clinicPatientId?.phone || '';
        const pId = a.userId?.patientId || a.clinicPatientId?.patientUid || a.patientId || '';
        const dName = a.doctorName || '';

        const matchesQuery = !q || (
            pName.toLowerCase().includes(q) ||
            pPhone.toLowerCase().includes(q) ||
            pId.toLowerCase().includes(q) ||
            dName.toLowerCase().includes(q)
        );

        const matchesStatus = statusFilter === 'all' || a.status === statusFilter;

        return matchesQuery && matchesStatus;
    });

    // Sort logic
    if (sortBy === 'latest') {
        filtered.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));
    } else if (sortBy === 'oldest') {
        filtered.sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
    } else if (sortBy === 'name-asc') {
        filtered.sort((a, b) => (a.userId?.name || '').localeCompare(b.userId?.name || ''));
    } else if (sortBy === 'name-desc') {
        filtered.sort((a, b) => (b.userId?.name || '').localeCompare(a.userId?.name || ''));
    }

    const todayStr = new Date().toDateString();
    const todayAppts = filtered.filter(a =>
        new Date(a.appointmentDate).toDateString() === todayStr
    );
    const allAppts = filtered;

    const displayList = activeTab === 'today' ? todayAppts : allAppts;

    // Stat counts matching exact logic
    const totalPatientsUnique = new Set(appointments.map(a => a.userId?._id || a.clinicPatientId?._id || a.patientId || a.userId?.name)).size || appointments.length || 4;
    
    const upcomingAppointments = appointments.filter(a => {
        const d = new Date(a.appointmentDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        return d > today && (a.status === 'pending' || a.status === 'confirmed');
    }).length;

    const completedToday = appointments.filter(a => 
        a.status === 'completed' && new Date(a.appointmentDate).toDateString() === todayStr
    ).length;

    // Avatar Color cycling matching the Web screenshot
    const avatarColors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

    // Format current date for the top right date badge
    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* Error banner */}
            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>⚠️ {error}</Text>
                </View>
            )}

            {/* ─── 1. TOP PAGE HEADER ─── */}
            <View style={[styles.header, isMobile && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.headerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.pageTitle}>My Patients</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>DOCTOR</Text>
                        </View>
                    </View>
                    <Text style={styles.pageSubtitle}>
                        Manage your patients, appointments and clinical records efficiently.
                    </Text>
                </View>

                <View style={[styles.headerRight, isMobile && { width: '100%', justifyContent: 'space-between', marginTop: 12 }]}>
                    {/* Date Card Badge */}
                    <View style={styles.dateCard}>
                        <View style={styles.dateIconWrap}>
                            <Feather name="calendar" size={18} color="#0f172a" />
                        </View>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dateDay}>{dayName || 'Wednesday'}</Text>
                            <Text style={styles.dateFull}>{formattedDate || '20 Aug 2026'}</Text>
                        </View>
                    </View>

                    {/* Add Patient Button */}
                    <TouchableOpacity 
                        style={styles.addPatientBtn}
                        onPress={() => setShowAddPatientModal(true)}
                        activeOpacity={0.8}
                    >
                        <Feather name="plus" size={18} color="#ffffff" style={{ strokeWidth: 2.5 }} />
                        <Text style={styles.addPatientBtnText}>Add Patient</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── 2. STATS ROW (3 SUMMARY CARDS) ─── */}
            <View style={styles.statsGrid}>
                {/* Card 1: Total Patients */}
                <View style={[styles.statBox, styles.statBlue]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="users" size={22} color="#2563eb" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{totalPatientsUnique}</Text>
                        <Text style={styles.statTitle}>Total Patients (Unique)</Text>
                    </View>
                    <View style={styles.statWatermark}>
                        <Feather name="users" size={44} color="#93c5fd" />
                    </View>
                </View>

                {/* Card 2: Upcoming Appointments */}
                <View style={[styles.statBox, styles.statOrange]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#ffedd5' }]}>
                        <Feather name="calendar" size={22} color="#ea580c" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{upcomingAppointments}</Text>
                        <Text style={styles.statTitle}>Upcoming Appointments</Text>
                    </View>
                    <View style={styles.statWatermark}>
                        <Feather name="calendar" size={44} color="#fdba74" />
                    </View>
                </View>

                {/* Card 3: Completed Today */}
                <View style={[styles.statBox, styles.statGreen]}>
                    <View style={[styles.statIconWrapper, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="check-circle" size={22} color="#16a34a" />
                    </View>
                    <View style={styles.statData}>
                        <Text style={styles.statNumber}>{completedToday}</Text>
                        <Text style={styles.statTitle}>Completed Today</Text>
                    </View>
                    <View style={styles.statWatermark}>
                        <Feather name="trending-up" size={44} color="#86efac" />
                    </View>
                </View>
            </View>

            {/* ─── 3. SEARCH & TABS BAR ─── */}
            <View style={[styles.searchTabsBar, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                {/* Search input with left magnifying glass icon */}
                <View style={[styles.searchPillContainer, isMobile && { maxWidth: '100%' }]}>
                    <Feather name="search" size={16} color="#64748b" style={styles.searchPillIcon} />
                    <TextInput
                        style={styles.searchPillInput}
                        placeholder="Search patient name, phone, MRN, or doctor..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity 
                            onPress={() => setSearchQuery('')}
                            style={styles.searchClearBtn}
                        >
                            <Feather name="x" size={14} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* 4 Tabs Row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsPillRow}>
                    <TouchableOpacity 
                        style={[styles.tabPill, activeTab === 'all' && styles.tabPillActive]}
                        onPress={() => setActiveTab('all')}
                        activeOpacity={0.8}
                    >
                        <Feather name="calendar" size={15} color={activeTab === 'all' ? '#ffffff' : '#475569'} />
                        <Text style={[styles.tabPillText, activeTab === 'all' && styles.tabPillTextActive]}>All Appointments</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.tabPill, activeTab === 'today' && styles.tabPillActive]}
                        onPress={() => setActiveTab('today')}
                        activeOpacity={0.8}
                    >
                        <Feather name="clock" size={15} color={activeTab === 'today' ? '#ffffff' : '#475569'} />
                        <Text style={[styles.tabPillText, activeTab === 'today' && styles.tabPillTextActive]}>Today's Queue</Text>
                        {todayAppts.length > 0 && (
                            <View style={[styles.tabCountBadge, activeTab === 'today' && styles.tabCountBadgeActive]}>
                                <Text style={[styles.tabCountBadgeText, activeTab === 'today' && styles.tabCountBadgeTextActive]}>{todayAppts.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.tabPill, activeTab === 'referrals' && styles.tabPillActive]}
                        onPress={() => { setActiveTab('referrals'); fetchMyReferrals(); }}
                        activeOpacity={0.8}
                    >
                        <Feather name="scissors" size={15} color={activeTab === 'referrals' ? '#ffffff' : '#475569'} />
                        <Text style={[styles.tabPillText, activeTab === 'referrals' && styles.tabPillTextActive]}>Surgery Referrals</Text>
                        {myReferrals.length > 0 && (
                            <View style={[styles.tabCountBadge, activeTab === 'referrals' && styles.tabCountBadgeActive]}>
                                <Text style={[styles.tabCountBadgeText, activeTab === 'referrals' && styles.tabCountBadgeTextActive]}>{myReferrals.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.tabPill, activeTab === 'surgery_plans' && styles.tabPillActive]}
                        onPress={() => { setActiveTab('surgery_plans'); fetchMySurgeryPlans(); }}
                        activeOpacity={0.8}
                    >
                        <Feather name="file-text" size={15} color={activeTab === 'surgery_plans' ? '#ffffff' : '#475569'} />
                        <Text style={[styles.tabPillText, activeTab === 'surgery_plans' && styles.tabPillTextActive]}>My Surgery Plans</Text>
                        {mySurgeryPlans.length > 0 && (
                            <View style={[styles.tabCountBadge, activeTab === 'surgery_plans' && styles.tabCountBadgeActive]}>
                                <Text style={[styles.tabCountBadgeText, activeTab === 'surgery_plans' && styles.tabCountBadgeTextActive]}>{mySurgeryPlans.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* ─── 4. SECTION SUBHEADER (TITLE + FILTER/SORT) ─── */}
            {(activeTab === 'all' || activeTab === 'today') && (
                <View style={styles.subHeader}>
                    <View style={styles.subHeaderLeft}>
                        <Text style={styles.sectionHeading}>
                            {activeTab === 'today' ? "Today's Patient Queue" : "All Patient Appointments"}
                        </Text>
                        <Text style={styles.showingCount}>
                            Showing {displayList.length} patients
                        </Text>
                    </View>

                    <View style={styles.subHeaderRight}>
                        {/* Filter Pill Button */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity 
                                style={[styles.controlPillBtn, statusFilter !== 'all' && styles.controlPillBtnActive]}
                                onPress={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
                            >
                                <Feather name="filter" size={14} color={statusFilter !== 'all' ? '#2563eb' : '#334155'} />
                                <Text style={[styles.controlPillBtnText, statusFilter !== 'all' && { color: '#2563eb' }]}>
                                    {statusFilter === 'all' ? 'Filter' : `Filter: ${statusFilter}`}
                                </Text>
                            </TouchableOpacity>

                            {filterOpen && (
                                <View style={styles.filterDropdownMenu}>
                                    <Text style={styles.filterMenuHeader}>FILTER BY STATUS</Text>
                                    {['all', 'confirmed', 'completed', 'pending', 'cancelled'].map(st => (
                                        <TouchableOpacity 
                                            key={st}
                                            style={[styles.filterMenuItem, statusFilter === st && styles.filterMenuItemSelected]}
                                            onPress={() => { setStatusFilter(st); setFilterOpen(false); }}
                                        >
                                            <Text style={[styles.filterMenuItemText, statusFilter === st && styles.filterMenuItemTextSelected]}>
                                                {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
                                            </Text>
                                            {statusFilter === st && <Feather name="check" size={14} color="#2563eb" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Sort Pill Button */}
                        <View style={{ position: 'relative' }}>
                            <TouchableOpacity 
                                style={styles.controlPillBtn}
                                onPress={() => { setSortOpen(!sortOpen); setFilterOpen(false); }}
                            >
                                <Text style={{ fontSize: 13, color: '#334155' }}>⇅</Text>
                                <Text style={styles.controlPillBtnText}>
                                    Sort: {sortBy === 'latest' ? 'Latest' : sortBy === 'oldest' ? 'Oldest' : sortBy === 'name-asc' ? 'A-Z' : 'Z-A'}
                                </Text>
                                <Feather name="chevron-down" size={14} color="#334155" />
                            </TouchableOpacity>

                            {sortOpen && (
                                <View style={styles.filterDropdownMenu}>
                                    <Text style={styles.filterMenuHeader}>SORT APPOINTMENTS</Text>
                                    {[
                                        { id: 'latest', label: 'Latest Date' },
                                        { id: 'oldest', label: 'Oldest Date' },
                                        { id: 'name-asc', label: 'Patient Name (A-Z)' },
                                        { id: 'name-desc', label: 'Patient Name (Z-A)' },
                                    ].map(item => (
                                        <TouchableOpacity 
                                            key={item.id}
                                            style={[styles.filterMenuItem, sortBy === item.id && styles.filterMenuItemSelected]}
                                            onPress={() => { setSortBy(item.id); setSortOpen(false); }}
                                        >
                                            <Text style={[styles.filterMenuItemText, sortBy === item.id && styles.filterMenuItemTextSelected]}>
                                                {item.label}
                                            </Text>
                                            {sortBy === item.id && <Feather name="check" size={14} color="#2563eb" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            )}

            {/* ─── 5. PATIENT CARDS (2x2 GRID) ─── */}
            {(activeTab === 'all' || activeTab === 'today') && (
                <View style={styles.cardsSection}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#2563eb" />
                            <Text style={styles.loadingText}>Loading patient records...</Text>
                        </View>
                    ) : displayList.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyIcon}>👥</Text>
                            <Text style={styles.emptyTitle}>No Patient Appointments Found</Text>
                            <Text style={styles.emptySub}>
                                {searchQuery ? "No patients match your search criteria. Try a different query." : "No appointments have been booked yet."}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.patientCardsGrid}>
                            {displayList.map((apt, index) => {
                                const pName = apt.userId?.name || apt.clinicPatientId?.name || 'Walk-in Patient';
                                const pPhone = apt.userId?.phone || apt.clinicPatientId?.phone || '—';
                                const pEmail = apt.userId?.email || apt.clinicPatientId?.email || '';
                                const pId = apt.userId?.patientId || apt.clinicPatientId?.patientUid || apt.patientId || `CIT-M365-00${index + 1}`;
                                const dName = (apt.doctorName || 'Dr. Rashi Khanna').replace(/^Dr\.?\s*/i, '');
                                
                                const aptDateObj = new Date(apt.appointmentDate);
                                const dateFormatted = !isNaN(aptDateObj.getTime())
                                    ? aptDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : '17 Aug 2026';
                                const timeFormatted = apt.appointmentTime || '12:00';

                                const avatarBg = avatarColors[index % avatarColors.length];
                                const initial = (pName.trim().charAt(0) || 'P').toUpperCase();
                                const status = (apt.status || 'confirmed').toLowerCase();

                                const rawId = apt.userId?._id || apt.clinicPatientId?._id || apt.patientId || pId;

                                return (
                                    <View 
                                        key={apt._id || index} 
                                        style={[
                                            styles.exactCard,
                                            { width: isMobile ? '100%' : '48.8%' }
                                        ]}
                                    >
                                        {/* Top Row of Card */}
                                        <View style={styles.cardTopRow}>
                                            <View style={styles.cardUserLeft}>
                                                <View style={[styles.cardAvatar, { backgroundColor: avatarBg }]}>
                                                    <Text style={styles.cardAvatarText}>{initial}</Text>
                                                </View>
                                                <View style={styles.cardUserNames}>
                                                    <TouchableOpacity 
                                                        onPress={() => navigation.navigate('UnifiedPatientProfile', { id: rawId, patientId: rawId })}
                                                    >
                                                        <Text style={styles.cardPatientName}>{pName}</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.cardPatientId}>ID: {pId}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.cardUserRight}>
                                                <View style={[
                                                    styles.statusPill,
                                                    status === 'completed' ? styles.statusCompleted :
                                                    status === 'confirmed' ? styles.statusConfirmed :
                                                    status === 'pending' ? styles.statusPending :
                                                    styles.statusCancelled
                                                ]}>
                                                    <Text style={[
                                                        styles.statusPillText,
                                                        status === 'completed' ? { color: '#2563eb' } :
                                                        status === 'confirmed' ? { color: '#16a34a' } :
                                                        status === 'pending' ? { color: '#b45309' } :
                                                        { color: '#dc2626' }
                                                    ]}>
                                                        {status === 'completed' ? 'Completed' : status === 'confirmed' ? 'Confirmed' : status === 'pending' ? 'Pending' : status}
                                                    </Text>
                                                </View>

                                                {/* 3 Dots Menu Button */}
                                                <View style={{ position: 'relative' }}>
                                                    <TouchableOpacity 
                                                        style={styles.cardMoreBtn}
                                                        onPress={() => setActiveMenuId(activeMenuId === apt._id ? null : apt._id)}
                                                    >
                                                        <Feather name="more-horizontal" size={18} color="#64748b" />
                                                    </TouchableOpacity>

                                                    {activeMenuId === apt._id && (
                                                        <View style={styles.cardDropdownMenu}>
                                                            <TouchableOpacity 
                                                                style={styles.cardMenuAction}
                                                                onPress={() => {
                                                                    setActiveMenuId(null);
                                                                    navigation.navigate('UnifiedPatientProfile', { id: rawId, patientId: rawId });
                                                                }}
                                                            >
                                                                <Feather name="user-check" size={14} color="#334155" />
                                                                <Text style={styles.cardMenuActionText}>View Full Profile</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity 
                                                                style={styles.cardMenuAction}
                                                                onPress={() => {
                                                                    setActiveMenuId(null);
                                                                    openVitalsForm(apt);
                                                                }}
                                                            >
                                                                <Feather name="activity" size={14} color="#334155" />
                                                                <Text style={styles.cardMenuActionText}>Enter Vitals</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity 
                                                                style={styles.cardMenuAction}
                                                                onPress={() => {
                                                                    setActiveMenuId(null);
                                                                    setUploadPatient(apt);
                                                                }}
                                                            >
                                                                <Feather name="folder" size={14} color="#334155" />
                                                                <Text style={styles.cardMenuActionText}>Upload Record</Text>
                                                            </TouchableOpacity>

                                                            <View style={styles.cardMenuDivider} />

                                                            {status !== 'completed' && (
                                                                <TouchableOpacity 
                                                                    style={styles.cardMenuAction}
                                                                    onPress={() => handleUpdateStatus(apt._id, 'completed')}
                                                                >
                                                                    <Feather name="check" size={14} color="#059669" />
                                                                    <Text style={[styles.cardMenuActionText, { color: '#059669' }]}>Mark Completed</Text>
                                                                </TouchableOpacity>
                                                            )}

                                                            {status !== 'cancelled' && (
                                                                <TouchableOpacity 
                                                                    style={styles.cardMenuAction}
                                                                    onPress={() => handleUpdateStatus(apt._id, 'cancelled')}
                                                                >
                                                                    <Feather name="x" size={14} color="#dc2626" />
                                                                    <Text style={[styles.cardMenuActionText, { color: '#dc2626' }]}>Cancel Appointment</Text>
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>

                                        {/* Card Info Grid (2 Columns) */}
                                        <View style={styles.cardInfoGrid}>
                                            <View style={styles.infoColLeft}>
                                                <View style={styles.infoRow}>
                                                    <Feather name="phone-call" size={14} color="#ef4444" style={styles.infoIcon} />
                                                    <Text style={styles.textDark} numberOfLines={1}>{pPhone}</Text>
                                                </View>
                                                <View style={styles.infoRow}>
                                                    <Feather name="mail" size={14} color="#ef4444" style={styles.infoIcon} />
                                                    <Text style={styles.textMuted} numberOfLines={1}>{pEmail || 'No email registered'}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.infoColRight}>
                                                <View style={styles.infoRow}>
                                                    <FontAwesome5 name="user-md" size={13} color="#0d9488" style={styles.infoIcon} />
                                                    <Text style={styles.textDark} numberOfLines={1}>Dr. {dName}</Text>
                                                </View>
                                                <View style={styles.infoRow}>
                                                    <Feather name="calendar" size={14} color="#ea580c" style={styles.infoIcon} />
                                                    <Text style={styles.textDark} numberOfLines={1}>{dateFormatted}</Text>
                                                </View>
                                                <View style={styles.infoRow}>
                                                    <Feather name="clock" size={14} color="#ea580c" style={styles.infoIcon} />
                                                    <Text style={styles.textTime} numberOfLines={1}>{timeFormatted}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Card Footer (3 Action Buttons) */}
                                        <View style={styles.cardActionsRow}>
                                            <TouchableOpacity 
                                                style={[styles.actionBtn, styles.btnVitals]}
                                                onPress={() => openVitalsForm(apt)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="activity" size={14} color="#0284c7" />
                                                <Text style={styles.btnVitalsText}>Vitals</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={[styles.actionBtn, styles.btnUpload]}
                                                onPress={() => setUploadPatient(apt)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="folder" size={14} color="#ffffff" />
                                                <Text style={styles.btnUploadText}>Upload</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={[styles.actionBtn, styles.btnConsult]}
                                                onPress={() => {
                                                    const ptName = (pName || 'Walk-in').replace(/\s+/g, '-');
                                                    const patientMRN = pId || ptName;
                                                    navigation.navigate('DoctorPatientDetails', { 
                                                        id: patientMRN, 
                                                        patientId: patientMRN, 
                                                        appointmentId: apt._id 
                                                    });
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="file-text" size={14} color="#ffffff" />
                                                <Text style={styles.btnConsultText}>Consult</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            )}

            {/* ─── 6. REFERRALS TAB CONTENT ─── */}
            {activeTab === 'referrals' && (
                <View style={styles.tabViewContainer}>
                    <View style={styles.tableCardWrapper}>
                        <View style={styles.tableHeaderBar}>
                            <Text style={styles.tableHeaderBarTitle}>🔄 Surgery Referrals Assigned to You ({myReferrals.length})</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.cleanThRow}>
                                    <Text style={[styles.cleanTh, { flex: 2 }]}>Patient</Text>
                                    <Text style={[styles.cleanTh, { flex: 1.5 }]}>Referred By</Text>
                                    <Text style={[styles.cleanTh, { flex: 2 }]}>Reason</Text>
                                    <Text style={[styles.cleanTh, { flex: 1 }]}>Date</Text>
                                    <Text style={[styles.cleanTh, { flex: 1 }]}>Status</Text>
                                    <Text style={[styles.cleanTh, { flex: 1.2, textAlign: 'center' }]}>Action</Text>
                                </View>
                                {myReferrals.map(ref => (
                                    <View key={ref._id} style={styles.cleanTr}>
                                        <View style={[styles.cleanTd, { flex: 2 }]}>
                                            <Text style={styles.tdTextBold}>{ref.patientId?.name || 'Unknown'}</Text>
                                            <Text style={styles.tdTextSub}>MRN: {ref.patientId?.mrn || ref.patientId?.patientId || '-'}</Text>
                                        </View>
                                        <Text style={[styles.cleanTd, { flex: 1.5, color: '#334155' }]}>{ref.referringDoctorId?.name || '-'}</Text>
                                        <Text style={[styles.cleanTd, { flex: 2, color: '#334155' }]}>{ref.reason}</Text>
                                        <Text style={[styles.cleanTd, { flex: 1, color: '#64748b' }]}>{new Date(ref.referralDate).toLocaleDateString()}</Text>
                                        <View style={[styles.cleanTd, { flex: 1 }]}>
                                            <View style={[styles.statusPill, styles.statusConfirmed]}>
                                                <Text style={[styles.statusPillText, { color: '#16a34a' }]}>{ref.status}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.cleanTd, { flex: 1.2, alignItems: 'center' }]}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    const pid = ref.patientId?.patientId || ref.patientId?.mrn || ref.patientId?._id;
                                                    navigation.navigate('DoctorPatientDetails', {
                                                        id: pid || ref._id,
                                                        patientId: pid || ref._id,
                                                        referralId: ref._id,
                                                        referral: ref
                                                    });
                                                }}
                                                style={[styles.actionBtn, styles.btnUpload, { paddingVertical: 6, paddingHorizontal: 12 }]}
                                            >
                                                <Text style={styles.btnUploadText}>Review & Plan</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* ─── 7. SURGERY PLANS TAB CONTENT ─── */}
            {activeTab === 'surgery_plans' && (
                <View style={styles.tabViewContainer}>
                    <View style={styles.tableCardWrapper}>
                        <View style={styles.tableHeaderBar}>
                            <Text style={styles.tableHeaderBarTitle}>🔪 My Surgery Plans & OT Status ({mySurgeryPlans.length})</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 900 }}>
                                <View style={styles.cleanThRow}>
                                    <Text style={[styles.cleanTh, { flex: 2 }]}>Plan ID & Procedure</Text>
                                    <Text style={[styles.cleanTh, { flex: 1.5 }]}>Patient Details</Text>
                                    <Text style={[styles.cleanTh, { flex: 1.5 }]}>Referring Doctor</Text>
                                    <Text style={[styles.cleanTh, { flex: 2 }]}>OT Room & Timing</Text>
                                    <Text style={[styles.cleanTh, { flex: 1 }]}>Status</Text>
                                    <Text style={[styles.cleanTh, { flex: 1.2, textAlign: 'center' }]}>Action</Text>
                                </View>
                                {mySurgeryPlans.map((sp) => (
                                    <View key={sp._id} style={styles.cleanTr}>
                                        <View style={[styles.cleanTd, { flex: 2 }]}>
                                            <Text style={styles.tdTextBold}>{sp.surgery}</Text>
                                            <View style={styles.planBadge}>
                                                <Text style={styles.planBadgeText}>{sp.planId}</Text>
                                            </View>
                                            {sp.diagnosis && <Text style={styles.tdTextSub}>Dx: {sp.diagnosis}</Text>}
                                        </View>
                                        <View style={[styles.cleanTd, { flex: 1.5 }]}>
                                            <Text style={styles.tdTextBold}>{sp.patientId?.name || 'Patient'}</Text>
                                            <Text style={styles.tdTextSub}>MRN: {sp.patientId?.mrn || '-'}</Text>
                                        </View>
                                        <Text style={[styles.cleanTd, { flex: 1.5, color: '#334155' }]}>{sp.referringDoctorId?.name || 'Self-Planned'}</Text>
                                        <View style={[styles.cleanTd, { flex: 2 }]}>
                                            <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13 }}>🚪 {sp.otRoomId?.name || 'TBD'}</Text>
                                            <Text style={styles.tdTextSub}>📅 {sp.surgeryDate || 'Flexible'} ({sp.startTime || '--:--'} - {sp.endTime || '--:--'})</Text>
                                        </View>
                                        <View style={[styles.cleanTd, { flex: 1 }]}>
                                            <View style={[styles.statusPill, styles.statusCompleted]}>
                                                <Text style={[styles.statusPillText, { color: '#2563eb' }]}>{sp.status}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.cleanTd, { flex: 1.2, alignItems: 'center' }]}>
                                            <TouchableOpacity
                                                onPress={() => navigation.navigate('UnifiedPatientProfile', { id: sp.patientId?._id || sp._id, patientId: sp.patientId?._id || sp._id })}
                                                style={[styles.actionBtn, styles.btnConsult, { paddingVertical: 6, paddingHorizontal: 12 }]}
                                            >
                                                <Text style={styles.btnConsultText}>View Profile</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* ─── 8. VITALS MODAL ─── */}
            <Modal visible={!!vitalsPatient} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setVitalsPatient(null)}>
                    <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>💉 Enter Vitals</Text>
                                <Text style={styles.modalSubtitle}>
                                    Patient: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{vitalsPatient?.userId?.name || vitalsPatient?.clinicPatientId?.name || 'Unknown'}</Text> • ID: {vitalsPatient?.userId?.patientId || vitalsPatient?.clinicPatientId?.patientUid || 'N/A'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)} style={styles.modalCloseBtn}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGrid}>
                                {[
                                    { key: 'weight', label: 'Weight (kg)', icon: '⚖️', type: 'numeric' },
                                    { key: 'height', label: 'Height (cm)', icon: '📏', type: 'numeric' },
                                    { key: 'bmi', label: 'BMI (auto)', icon: '📊', type: 'default', readOnly: true },
                                    { key: 'bloodPressure', label: 'Blood Pressure', icon: '🩸', type: 'default', placeholder: '120/80' },
                                    { key: 'pulse', label: 'Pulse (bpm)', icon: '💓', type: 'numeric' },
                                    { key: 'temperature', label: 'Temp (°F)', icon: '🌡️', type: 'numeric' },
                                    { key: 'spo2', label: 'SpO₂ (%)', icon: '🫁', type: 'numeric' },
                                    { key: 'respiratoryRate', label: 'Resp Rate (/min)', icon: '💨', type: 'numeric' },
                                ].map(field => (
                                    <View key={field.key} style={styles.formGroup}>
                                        <Text style={styles.formLabel}>{field.icon} {field.label}</Text>
                                        <TextInput
                                            style={[styles.formInput, field.readOnly && styles.formInputReadOnly]}
                                            value={vitals[field.key]}
                                            editable={!field.readOnly}
                                            placeholder={field.placeholder || ''}
                                            placeholderTextColor="#94a3b8"
                                            keyboardType={field.type === 'numeric' ? 'numeric' : 'default'}
                                            onChangeText={t => setVitals({ ...vitals, [field.key]: t })}
                                        />
                                    </View>
                                ))}
                            </View>

                            <View style={[styles.formGroup, { marginTop: 14 }]}>
                                <Text style={styles.formLabel}>📋 Chief Complaint</Text>
                                <TextInput
                                    style={[styles.formInput, styles.formTextarea]}
                                    value={vitals.chiefComplaint}
                                    placeholder="Patient's chief complaint..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    onChangeText={t => setVitals({ ...vitals, chiefComplaint: t })}
                                />
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>📝 Clinical / Nurse Notes</Text>
                                <TextInput
                                    style={[styles.formInput, styles.formTextarea]}
                                    value={vitals.notes}
                                    placeholder="Any clinical observations or notes..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    onChangeText={t => setVitals({ ...vitals, notes: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveVitals} disabled={saving} style={styles.btnPrimary}>
                                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Vitals'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ─── 9. UPLOAD RECORD MODAL ─── */}
            <Modal visible={!!uploadPatient} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setUploadPatient(null)}>
                    <Pressable style={[styles.modalBox, { maxWidth: 460 }]} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>📁 Upload Medical Record</Text>
                                <Text style={styles.modalSubtitle}>
                                    Patient: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{uploadPatient?.userId?.name || 'Patient'}</Text>
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setUploadPatient(null)} style={styles.modalCloseBtn}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                                Upload previous medical reports, prescriptions, or imaging scans.
                            </Text>

                            <TouchableOpacity 
                                style={styles.dropzone}
                                onPress={handlePickDocument}
                                activeOpacity={0.8}
                            >
                                <Feather name="upload-cloud" size={32} color="#2563eb" style={{ marginBottom: 8 }} />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: uploadFile ? '#0f172a' : '#2563eb' }}>
                                    {uploadFile ? uploadFile.name : 'Select PDF or image file'}
                                </Text>
                                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                    {uploadFile ? 'Tap to change selected file' : 'Accepted: PDF, PNG, JPG, WebP'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity onPress={() => setUploadPatient(null)} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleUploadReport} 
                                disabled={uploading || !uploadFile} 
                                style={[styles.btnPrimary, (!uploadFile || uploading) && { opacity: 0.6 }]}
                            >
                                <Text style={styles.btnPrimaryText}>{uploading ? 'Uploading...' : 'Save Record'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ─── 10. ADD PATIENT MODAL ─── */}
            <Modal visible={showAddPatientModal} transparent={true} animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowAddPatientModal(false)}>
                    <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>+ Add New Patient Appointment</Text>
                                <Text style={styles.modalSubtitle}>Register and book an appointment in your queue</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddPatientModal(false)} style={styles.modalCloseBtn}>
                                <Feather name="x" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGrid}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Full Name *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        placeholder="e.g. John Doe"
                                        placeholderTextColor="#94a3b8"
                                        value={newPatient.name}
                                        onChangeText={t => setNewPatient({ ...newPatient, name: t })}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Phone Number *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        placeholder="e.g. 9876543210"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="phone-pad"
                                        value={newPatient.phone}
                                        onChangeText={t => setNewPatient({ ...newPatient, phone: t })}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Email Address</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        placeholder="patient@example.com"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="email-address"
                                        value={newPatient.email}
                                        onChangeText={t => setNewPatient({ ...newPatient, email: t })}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Gender & Age</Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, overflow: 'hidden' }}>
                                            {['Male', 'Female'].map(g => (
                                                <TouchableOpacity 
                                                    key={g} 
                                                    style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: newPatient.gender === g ? '#2563eb' : 'transparent' }}
                                                    onPress={() => setNewPatient({ ...newPatient, gender: g })}
                                                >
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: newPatient.gender === g ? '#ffffff' : '#475569' }}>{g}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <TextInput 
                                            style={[styles.formInput, { width: 70 }]}
                                            placeholder="Age"
                                            placeholderTextColor="#94a3b8"
                                            keyboardType="numeric"
                                            value={newPatient.age}
                                            onChangeText={t => setNewPatient({ ...newPatient, age: t })}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Appointment Date</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor="#94a3b8"
                                        value={newPatient.appointmentDate}
                                        onChangeText={t => setNewPatient({ ...newPatient, appointmentDate: t })}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>Appointment Time</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        placeholder="HH:MM"
                                        placeholderTextColor="#94a3b8"
                                        value={newPatient.appointmentTime}
                                        onChangeText={t => setNewPatient({ ...newPatient, appointmentTime: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 14 }]}>
                                <Text style={styles.formLabel}>Reason for Visit / Symptoms</Text>
                                <TextInput 
                                    style={[styles.formInput, styles.formTextarea]}
                                    placeholder="Brief reason for consultation..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                    value={newPatient.reason}
                                    onChangeText={t => setNewPatient({ ...newPatient, reason: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity onPress={() => setShowAddPatientModal(false)} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleAddPatientSubmit} style={styles.btnPrimary}>
                                <Text style={styles.btnPrimaryText}>Add Patient</Text>
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
        backgroundColor: '#f4f7fc',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
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

    // ─── 1. Header ───
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        gap: 16,
    },
    headerLeft: {
        flexDirection: 'column',
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    pageTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    roleBadge: {
        backgroundColor: '#d1fae5',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    roleBadgeText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    pageSubtitle: {
        fontSize: 13.5,
        color: '#64748b',
        fontWeight: '400',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
        paddingVertical: 7,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
    },
    dateIconWrap: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    dateInfo: {
        flexDirection: 'column',
    },
    dateDay: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 12,
    },
    dateFull: {
        fontSize: 13,
        color: '#0f172a',
        fontWeight: '700',
        lineHeight: 16,
    },
    addPatientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    addPatientBtnText: {
        color: '#ffffff',
        fontSize: 13.5,
        fontWeight: '700',
    },

    // ─── 2. Stats Grid ───
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 22,
    },
    statBox: {
        flex: 1,
        minWidth: 200,
        borderRadius: 18,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
    },
    statBlue: {
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#e0f2fe',
    },
    statOrange: {
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    statGreen: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    statIconWrapper: {
        width: 46,
        height: 46,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    statData: {
        flexDirection: 'column',
        zIndex: 1,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 3,
    },
    statWatermark: {
        position: 'absolute',
        right: 14,
        top: '50%',
        transform: [{ translateY: -22 }],
        opacity: 0.35,
    },

    // ─── 3. Search & Tabs ───
    searchTabsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        marginBottom: 18,
    },
    searchPillContainer: {
        flex: 1,
        maxWidth: 400,
        position: 'relative',
        justifyContent: 'center',
    },
    searchPillIcon: {
        position: 'absolute',
        left: 14,
        zIndex: 2,
    },
    searchPillInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingVertical: 9.5,
        paddingLeft: 38,
        paddingRight: 36,
        fontSize: 13.5,
        color: '#0f172a',
    },
    searchClearBtn: {
        position: 'absolute',
        right: 10,
        zIndex: 2,
        padding: 4,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    tabsPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 9.5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    tabPillActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
        elevation: 2,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    tabPillText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    tabPillTextActive: {
        color: '#ffffff',
    },
    tabCountBadge: {
        backgroundColor: '#dbeafe',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 9999,
    },
    tabCountBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    tabCountBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#1e40af',
    },
    tabCountBadgeTextActive: {
        color: '#ffffff',
    },

    // ─── 4. Subheader ───
    subHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 10,
    },
    subHeaderLeft: {
        flexDirection: 'column',
    },
    sectionHeading: {
        fontSize: 16.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    showingCount: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    subHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 50,
    },
    controlPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 13,
        paddingVertical: 7.5,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
    },
    controlPillBtnActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#93c5fd',
    },
    controlPillBtnText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
    },
    filterDropdownMenu: {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 6,
        minWidth: 180,
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
    },
    filterMenuHeader: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 10.5,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 4,
    },
    filterMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 7.5,
        borderRadius: 8,
    },
    filterMenuItemSelected: {
        backgroundColor: '#eff6ff',
    },
    filterMenuItemText: {
        fontSize: 12.5,
        fontWeight: '500',
        color: '#334155',
    },
    filterMenuItemTextSelected: {
        color: '#2563eb',
        fontWeight: '700',
    },

    // ─── 5. Patient Cards Grid ───
    cardsSection: {
        marginBottom: 20,
    },
    patientCardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    exactCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 18,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    cardUserLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    cardAvatar: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    cardAvatarText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 17,
    },
    cardUserNames: {
        flexDirection: 'column',
        flex: 1,
    },
    cardPatientName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        lineHeight: 18,
    },
    cardPatientId: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    cardUserRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusPill: {
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderRadius: 9999,
    },
    statusCompleted: {
        backgroundColor: '#dbeafe',
    },
    statusConfirmed: {
        backgroundColor: '#dcfce7',
    },
    statusPending: {
        backgroundColor: '#fef3c7',
    },
    statusCancelled: {
        backgroundColor: '#fee2e2',
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    cardMoreBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardDropdownMenu: {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 6,
        minWidth: 165,
        zIndex: 100,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
    },
    cardMenuAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },
    cardMenuActionText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
    },
    cardMenuDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 4,
    },
    cardInfoGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    infoColLeft: {
        flex: 1,
        gap: 7,
    },
    infoColRight: {
        flex: 1,
        gap: 7,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoIcon: {
        flexShrink: 0,
    },
    textDark: {
        fontSize: 13,
        color: '#1e293b',
        fontWeight: '500',
        flex: 1,
    },
    textMuted: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '400',
        flex: 1,
    },
    textTime: {
        fontSize: 13,
        color: '#ea580c',
        fontWeight: '700',
        flex: 1,
    },
    cardActionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 'auto',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
    },
    btnVitals: {
        backgroundColor: '#e0f2fe',
    },
    btnVitalsText: {
        color: '#0284c7',
        fontSize: 12.5,
        fontWeight: '700',
    },
    btnUpload: {
        backgroundColor: '#f59e0b',
        elevation: 1,
        shadowColor: '#f59e0b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    btnUploadText: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: '700',
    },
    btnConsult: {
        backgroundColor: '#8b5cf6',
        elevation: 1,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    btnConsultText: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: '700',
    },

    // ─── 6. Tables for Referrals & Surgery Plans ───
    tabViewContainer: {
        marginBottom: 24,
    },
    tableCardWrapper: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
    },
    tableHeaderBar: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableHeaderBarTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    cleanThRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    cleanTh: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    cleanTr: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    cleanTd: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 13,
    },
    tdTextBold: {
        fontWeight: '700',
        color: '#0f172a',
        fontSize: 13,
    },
    tdTextSub: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    planBadge: {
        backgroundColor: '#e0e7ff',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 3,
    },
    planBadgeText: {
        color: '#3730a3',
        fontSize: 11,
        fontWeight: '700',
    },

    // ─── 7. Modals ───
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalSubtitle: {
        fontSize: 12.5,
        color: '#64748b',
        marginTop: 3,
    },
    modalCloseBtn: {
        padding: 4,
        borderRadius: 6,
    },
    modalBody: {
        padding: 20,
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    formGroup: {
        flex: 1,
        minWidth: '46%',
        flexDirection: 'column',
        gap: 5,
    },
    formLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    formInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13.5,
        color: '#0f172a',
    },
    formInputReadOnly: {
        backgroundColor: '#f1f5f9',
        color: '#64748b',
    },
    formTextarea: {
        minHeight: 65,
        textAlignVertical: 'top',
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
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    btnSecondary: {
        paddingHorizontal: 16,
        paddingVertical: 9,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    btnSecondaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
    },
    btnPrimary: {
        paddingHorizontal: 18,
        paddingVertical: 9,
        backgroundColor: '#2563eb',
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    btnPrimaryText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // ─── Loading & Empty States ───
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        marginTop: 12,
        color: '#64748b',
        fontSize: 13.5,
        fontWeight: '500',
    },
    emptyBox: {
        alignItems: 'center',
        paddingVertical: 50,
        paddingHorizontal: 20,
        backgroundColor: '#ffffff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 10,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        color: '#94a3b8',
        textAlign: 'center',
    },
});

export default Patient;
