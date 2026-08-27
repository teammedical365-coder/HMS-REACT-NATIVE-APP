import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, ActivityIndicator, Alert, Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doctorAPI, reportAPI, referralAPI, otAPI } from '../../utils/api';
import { Feather } from '@expo/vector-icons';

const Patient = () => {
    const navigation = useNavigation();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('today');
    const [vitalsPatient, setVitalsPatient] = useState(null);
    const [uploadPatient, setUploadPatient] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [vitals, setVitals] = useState({
        weight: '', height: '', bmi: '', bloodPressure: '',
        pulse: '', temperature: '', spo2: '', respiratoryRate: '',
        chiefComplaint: '', notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [myReferrals, setMyReferrals] = useState([]);
    const [mySurgeryPlans, setMySurgeryPlans] = useState([]);

    useEffect(() => {
        fetchAllAppointments();
        fetchMyReferrals();
        fetchMySurgeryPlans();
    }, []);

    const fetchMyReferrals = async () => {
        try {
            const res = await referralAPI.getMyReferrals();
            if (res.success) {
                setMyReferrals(res.referrals || []);
            }
        } catch (err) {
            console.error("Error fetching referrals:", err);
        }
    };

    const fetchMySurgeryPlans = async () => {
        try {
            const res = await otAPI.getMySurgeryPlans();
            if (res.success) {
                setMySurgeryPlans(res.data || []);
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

            if (res.success) {
                setAppointments(res.appointments || []);
            } else {
                setError(res.message || 'Failed to load appointments');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError(err.response?.data?.message || err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const w = parseFloat(vitals.weight);
        const h = parseFloat(vitals.height) / 100;
        if (w > 0 && h > 0) {
            setVitals(v => ({ ...v, bmi: (w / (h * h)).toFixed(1) }));
        }
    }, [vitals.weight, vitals.height]);

    const handleUploadReport = async () => {
        if (!uploadFile) {
            Alert.alert('File Picker', 'Native file picker integration is required here. Proceeding as mockup.');
            setUploadPatient(null);
            return;
        }
        // Native upload mockup logic goes here...
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
            await doctorAPI.updatePatientProfile(patientId, profileData);

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
            pulse: String(existing.pulse || ''),
            temperature: String(existing.temperature || ''),
            spo2: String(existing.spo2 || ''),
            respiratoryRate: String(existing.respiratoryRate || existing.rr || ''),
            chiefComplaint: '',
            notes: ''
        });
        setVitalsPatient(apt);
    };

    // Filtering
    const q = searchQuery.toLowerCase();
    const filtered = appointments.filter(a => {
        if (!q) return true;
        return (
            (a.userId?.name || '').toLowerCase().includes(q) ||
            (a.userId?.phone || '').toLowerCase().includes(q) ||
            (a.userId?.patientId || '').toLowerCase().includes(q) ||
            (a.doctorName || '').toLowerCase().includes(q)
        );
    });

    const todayStr = new Date().toDateString();
    const todayAppts = filtered.filter(a =>
        new Date(a.appointmentDate).toDateString() === todayStr
    );
    const allAppts = filtered;
    const displayList = activeTab === 'today' ? todayAppts : allAppts;

    // Stat counts
    const todayTotal = appointments.filter(a => new Date(a.appointmentDate).toDateString() === todayStr).length;
    const pendingToday = appointments.filter(a => (a.status === 'pending' || a.status === 'confirmed') && new Date(a.appointmentDate).toDateString() === todayStr).length;
    const totalPatientsUnique = new Set(appointments.map(a => a.userId?._id || a.patientId)).size;
    const upcomingAppointments = appointments.filter(a => {
        const d = new Date(a.appointmentDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        return d >= today && (a.status === 'pending' || a.status === 'confirmed');
    }).length;

    const completedToday = appointments.filter(a => a.status === 'completed' && new Date(a.appointmentDate).toDateString() === todayStr).length;

    const getStatusStyle = (status) => {
        const map = {
            confirmed: { bg: '#dcfce7', color: '#166534' },
            completed: { bg: '#dbeafe', color: '#1e40af' },
            cancelled: { bg: '#fee2e2', color: '#991b1b' },
            pending: { bg: '#fef3c7', color: '#92400e' },
        };
        return map[status] || { bg: '#f1f5f9', color: '#475569' };
    };

    return (
        <ScrollView style={styles.container}>
            {/* Error */}
            {error && <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {error}</Text></View>}

            {/* ─── STATS ─── */}
            <View style={styles.statsRow}>
                {[
                    { label: "Total Patients (Unique)", value: totalPatientsUnique, icon: '👥', color: '#3b82f6' },
                    { label: 'Upcoming Appointments', value: upcomingAppointments, icon: '📅', color: '#f59e0b' },
                    { label: 'Completed Today', value: completedToday, icon: '✅', color: '#10b981' },
                ].map((s, i) => (
                    <View key={i} style={styles.statCard}>
                        <View style={[styles.statIconWrap, { backgroundColor: s.color }]}>
                            <Text style={styles.statIcon}>{s.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.statNum}>{s.value}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* ─── SEARCH + TABS ─── */}
            <View style={styles.controls}>
                <View style={styles.searchWrap}>
                    <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patient name, phone, MRN..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                            <Feather name="x" size={16} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                    <View style={styles.tabsWrap}>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'today' && styles.tabActive]} 
                            onPress={() => setActiveTab('today')}
                        >
                            <Text style={[styles.tabText, activeTab === 'today' && styles.tabTextActive]}>Today's Queue</Text>
                            {todayAppts.length > 0 && (
                                <View style={[styles.tabBadge, activeTab === 'today' && styles.tabBadgeActive]}>
                                    <Text style={[styles.tabBadgeText, activeTab === 'today' && styles.tabBadgeTextActive]}>{todayAppts.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'all' && styles.tabActive]} 
                            onPress={() => setActiveTab('all')}
                        >
                            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All Appointments</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'referrals' && styles.tabActive]} 
                            onPress={() => { setActiveTab('referrals'); fetchMyReferrals(); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'referrals' && styles.tabTextActive]}>Surgery Referrals</Text>
                            {myReferrals.length > 0 && (
                                <View style={[styles.tabBadge, activeTab === 'referrals' && styles.tabBadgeActive]}>
                                    <Text style={[styles.tabBadgeText, activeTab === 'referrals' && styles.tabBadgeTextActive]}>{myReferrals.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'surgery_plans' && styles.tabActive]} 
                            onPress={() => { setActiveTab('surgery_plans'); fetchMySurgeryPlans(); }}
                        >
                            <Text style={[styles.tabText, activeTab === 'surgery_plans' && styles.tabTextActive]}>🔪 My Surgery Plans</Text>
                            {mySurgeryPlans.length > 0 && (
                                <View style={[styles.tabBadge, activeTab === 'surgery_plans' && styles.tabBadgeActive]}>
                                    <Text style={[styles.tabBadgeText, activeTab === 'surgery_plans' && styles.tabBadgeTextActive]}>{mySurgeryPlans.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* ─── REFERRALS TAB ─── */}
            {activeTab === 'referrals' && (
                <View style={styles.content}>
                    {myReferrals.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
                            <Text style={styles.emptyTitle}>No Referrals Yet</Text>
                            <Text style={styles.emptySub}>When other doctors refer patients to you, they will appear here.</Text>
                        </View>
                    ) : (
                        <View style={styles.tableWrap}>
                            <View style={styles.tableHeaderSection}>
                                <Text style={styles.tableHeaderTitle}>🔄 Surgery Referrals Assigned to You ({myReferrals.length})</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 900 }}>
                                    <View style={styles.thRow}>
                                        <Text style={[styles.th, { flex: 2 }]}>Patient</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Referred By</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>Reason</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Date</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
                                    </View>
                                    {myReferrals.map(ref => (
                                        <View key={ref._id} style={styles.tr}>
                                            <View style={[styles.td, { flex: 2 }]}>
                                                <Text style={styles.tdTextBold}>{ref.patientId?.name || 'Unknown'}</Text>
                                                <Text style={styles.tdTextSub}>MRN: {ref.patientId?.patientId || ref.patientId?.mrn || '-'}</Text>
                                            </View>
                                            <Text style={[styles.td, { flex: 1.5, color: '#334155' }]}>{ref.referringDoctorId?.name || '-'}</Text>
                                            <Text style={[styles.td, { flex: 2, color: '#334155' }]} numberOfLines={1}>{ref.reason}</Text>
                                            <Text style={[styles.td, { flex: 1, color: '#64748b' }]}>{new Date(ref.referralDate).toLocaleDateString()}</Text>
                                            <View style={[styles.td, { flex: 1 }]}>
                                                <View style={[
                                                    styles.badge, 
                                                    ref.status === 'REFERRED' ? { backgroundColor: '#fef3c7' } : ref.status === 'SURGERY_PLANNED' ? { backgroundColor: '#dcfce7' } : ref.status === 'ACCEPTED' ? { backgroundColor: '#dbeafe' } : { backgroundColor: '#fee2e2' }
                                                ]}>
                                                    <Text style={[
                                                        styles.badgeText,
                                                        ref.status === 'REFERRED' ? { color: '#92400e' } : ref.status === 'SURGERY_PLANNED' ? { color: '#166534' } : ref.status === 'ACCEPTED' ? { color: '#1e40af' } : { color: '#991b1b' }
                                                    ]}>{ref.status}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.td, { flex: 1, alignItems: 'center' }]}>
                                                {ref.status === 'REFERRED' ? (
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            const pid = ref.patientId?.patientId || ref.patientId?.mrn || ref.patientId?._id || ref.patientId;
                                                            navigation.navigate('DoctorPatientDetails', { patientId: pid || ref._id });
                                                        }}
                                                        style={styles.actionBtnOrange}
                                                    >
                                                        <Text style={styles.actionBtnOrangeText}>Review & Plan</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <Text style={{ color: '#94a3b8' }}>—</Text>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* ─── MY SURGERY PLANS TAB ─── */}
            {activeTab === 'surgery_plans' && (
                <View style={styles.content}>
                    {mySurgeryPlans.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 48, marginBottom: 12 }}>🔪</Text>
                            <Text style={styles.emptyTitle}>No Surgery Plans Assigned</Text>
                            <Text style={styles.emptySub}>Surgeries planned for you will appear here.</Text>
                        </View>
                    ) : (
                        <View style={styles.tableWrap}>
                            <View style={styles.tableHeaderSection}>
                                <Text style={styles.tableHeaderTitle}>🔪 My Surgery Plans & OT Status ({mySurgeryPlans.length})</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 1000 }}>
                                    <View style={styles.thRow}>
                                        <Text style={[styles.th, { flex: 2 }]}>Plan ID & Procedure</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Patient Details</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Referring Doctor</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>OT Room & Timing</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
                                    </View>
                                    {mySurgeryPlans.map((sp) => {
                                        const patientName = sp.patientId?.name || 'Patient';
                                        const patientMrn = sp.patientId?.mrn || sp.patientId?.patientId || '-';
                                        const refDoc = sp.referringDoctorId?.name ? sp.referringDoctorId.name.replace(/^Dr\.?\s*/i, '') : null;
                                        const docName = sp.doctorId?.name ? sp.doctorId.name.replace(/^Dr\.?\s*/i, '') : null;
                                        const pId = sp.patientId?._id || sp.patientId;

                                        return (
                                            <View key={sp._id} style={styles.tr}>
                                                <View style={[styles.td, { flex: 2 }]}>
                                                    <Text style={styles.tdTextBold}>{sp.surgery}</Text>
                                                    {sp.planId && (
                                                        <View style={{ backgroundColor: '#e0e7ff', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                                                            <Text style={{ color: '#3730a3', fontSize: 11, fontWeight: 'bold' }}>{sp.planId}</Text>
                                                        </View>
                                                    )}
                                                    {sp.diagnosis && <Text style={styles.tdTextSub}>Dx: {sp.diagnosis}</Text>}
                                                </View>
                                                <View style={[styles.td, { flex: 1.5 }]}>
                                                    <Text style={styles.tdTextBold}>{patientName}</Text>
                                                    <Text style={styles.tdTextSub}>MRN: {patientMrn}</Text>
                                                </View>
                                                <View style={[styles.td, { flex: 1.5 }]}>
                                                    <Text style={{ color: '#334155', fontSize: 13 }}>{refDoc || docName ? `Dr. ${refDoc || docName}` : 'Self-Planned'}</Text>
                                                    {sp.assistantSurgeonIds?.length > 0 && (
                                                        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                            🤝 Asst: {sp.assistantSurgeonIds.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View style={[styles.td, { flex: 2 }]}>
                                                    {sp.otRoomId?.name ? (
                                                        <View>
                                                            <Text style={{ color: '#0f172a', fontWeight: 'bold' }}>🚪 {sp.otRoomId.name}</Text>
                                                            <Text style={styles.tdTextSub}>📅 {sp.surgeryDate ? new Date(sp.surgeryDate).toLocaleDateString('en-IN') : 'TBD'} ({sp.startTime || '--:--'} - {sp.endTime || '--:--'})</Text>
                                                        </View>
                                                    ) : (
                                                        <View>
                                                            <Text style={{ color: '#b45309', fontWeight: 'bold', fontSize: 12 }}>⏳ OT scheduling pending</Text>
                                                            <Text style={styles.tdTextSub}>Pref: {sp.preferredDate ? new Date(sp.preferredDate).toLocaleDateString('en-IN') : 'Flexible'}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={[styles.td, { flex: 1 }]}>
                                                    <View style={[
                                                        styles.badge, 
                                                        sp.status === 'PLANNED' ? { backgroundColor: '#fef3c7' } : sp.status === 'SCHEDULED' ? { backgroundColor: '#e0e7ff' } : sp.status === 'IN_OT' ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#dcfce7' }
                                                    ]}>
                                                        <Text style={[
                                                            styles.badgeText,
                                                            sp.status === 'PLANNED' ? { color: '#92400e' } : sp.status === 'SCHEDULED' ? { color: '#3730a3' } : sp.status === 'IN_OT' ? { color: '#b91c1c' } : { color: '#166534' }
                                                        ]}>{sp.status}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { flex: 1, alignItems: 'center' }]}>
                                                    <TouchableOpacity
                                                        onPress={() => navigation.navigate('DoctorPatientDetails', { patientId: pId })}
                                                        style={styles.actionBtnBlue}
                                                    >
                                                        <Text style={styles.actionBtnBlueText}>View Profile</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* ─── CONTENT (TODAY / ALL APPOINTMENTS) ─── */}
            {(activeTab === 'today' || activeTab === 'all') && (
                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ marginTop: 14, color: '#475569' }}>Loading patients...</Text>
                        </View>
                    ) : displayList.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
                            <Text style={styles.emptyTitle}>{activeTab === 'today' ? 'No Patients in Queue Today' : 'No Appointments Found'}</Text>
                            <Text style={styles.emptySub}>{searchQuery ? 'Try adjusting your search terms.' : 'Appointments booked by patients will appear here.'}</Text>
                        </View>
                    ) : (
                        <View style={styles.tableWrap}>
                            <View style={[styles.tableHeaderSection, { backgroundColor: '#fff', borderBottomWidth: 0, paddingBottom: 10 }]}>
                                <Text style={styles.tableHeaderTitle}>{activeTab === 'today' ? "Today's Patient Queue" : 'All Patient Appointments'}</Text>
                                <Text style={styles.sectionCount}>Showing {displayList.length} patients</Text>
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 1000 }}>
                                    <View style={styles.thRow}>
                                        <Text style={[styles.th, { width: 50 }]}>#</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>Patient</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Contact</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Doctor</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Date & Time</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 2.5, textAlign: 'center' }]}>Actions</Text>
                                    </View>
                                    {displayList.map((apt, i) => {
                                        const statusStyle = getStatusStyle(apt.status);
                                        const pName = apt.userId?.name || apt.clinicPatientId?.name || 'Walk-in Patient';
                                        const pPhone = apt.userId?.phone || apt.clinicPatientId?.phone || '—';
                                        const pEmail = apt.userId?.email || apt.clinicPatientId?.email || '';
                                        const pGender = apt.userId?.gender || apt.clinicPatientId?.gender || '';
                                        const pAge = apt.userId?.age || apt.clinicPatientId?.age || '';
                                        const pId = apt.userId?.patientId || apt.clinicPatientId?.patientUid || apt.patientId || '—';
                                        const dName = apt.doctorName || 'Assigned Doctor';
                                        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];
                                        const avatarColor = colors[i % colors.length];

                                        return (
                                            <View key={apt._id} style={styles.tr}>
                                                <Text style={[styles.td, { width: 50, fontWeight: 'bold', color: '#475569' }]}>{i + 1}</Text>
                                                <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                                                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                                                        <Text style={styles.avatarText}>{pName.charAt(0).toUpperCase()}</Text>
                                                    </View>
                                                    <View style={{ marginLeft: 12 }}>
                                                        <Text style={styles.tdTextBold}>{pName}</Text>
                                                        <Text style={styles.tdTextSub}>ID: {pId} {pGender && `• ${pGender}`} {pAge && `• ${pAge}y`}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { flex: 1.5 }]}>
                                                    <Text style={{ color: '#334155', fontSize: 13, fontWeight: 'bold' }}>📞 {pPhone}</Text>
                                                    {pEmail !== '' && <Text style={styles.tdTextSub}>{pEmail}</Text>}
                                                </View>
                                                <View style={[styles.td, { flex: 1.5 }]}>
                                                    <Text style={{ color: '#0f172a', fontWeight: 'bold', fontSize: 13 }}>👨‍⚕️ Dr. {dName}</Text>
                                                </View>
                                                <View style={[styles.td, { flex: 1.5 }]}>
                                                    <Text style={{ color: '#0f172a', fontWeight: 'bold', fontSize: 13 }}>
                                                        {new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                    <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>⏰ {apt.appointmentTime}</Text>
                                                </View>
                                                <View style={[styles.td, { flex: 1 }]}>
                                                    <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                                                        <Text style={[styles.badgeText, { color: statusStyle.color }]}>{apt.status}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { flex: 2.5, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                                                    <TouchableOpacity 
                                                        style={[styles.smallBtn, { backgroundColor: '#0ea5e9' }]}
                                                        onPress={() => openVitalsForm(apt)}
                                                    >
                                                        <Text style={styles.smallBtnText}>💉 Vitals</Text>
                                                    </TouchableOpacity>
                                                    
                                                    <TouchableOpacity 
                                                        style={[styles.smallBtn, { backgroundColor: '#f59e0b' }]}
                                                        onPress={() => setUploadPatient(apt)}
                                                    >
                                                        <Text style={styles.smallBtnText}>📁 Upload</Text>
                                                    </TouchableOpacity>
                                                    
                                                    <TouchableOpacity 
                                                        style={[styles.smallBtn, { backgroundColor: '#8b5cf6' }]}
                                                        onPress={() => {
                                                            const ptName = (apt.userId?.name || apt.clinicPatientId?.name || 'Walk-in').replace(/\s+/g, '-');
                                                            const patientMRN = apt.userId?.patientId || apt.clinicPatientId?.patientUid || apt.patientId || ptName;
                                                            navigation.navigate('DoctorPatientDetails', { patientId: patientMRN, appointmentId: apt._id });
                                                        }}
                                                    >
                                                        <Text style={styles.smallBtnText}>📝 Session</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}

            {/* ─── VITALS MODAL ─── */}
            <Modal visible={!!vitalsPatient} transparent={true} animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>💉 Enter Vitals</Text>
                                <Text style={styles.modalSub}>
                                    Patient: {vitalsPatient?.userId?.name || vitalsPatient?.clinicPatientId?.name || 'Unknown'} • 
                                    MRN: {vitalsPatient?.userId?.patientId || vitalsPatient?.clinicPatientId?.patientUid || vitalsPatient?.patientId || 'N/A'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)}>
                                <Feather name="x" size={24} color="#94a3b8" />
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
                                    { key: 'respiratoryRate', label: 'Resp Rate', icon: '💨', type: 'numeric' },
                                ].map(field => (
                                    <View key={field.key} style={styles.formGroup}>
                                        <Text style={styles.formLabel}>{field.icon} {field.label}</Text>
                                        <TextInput
                                            style={[styles.formInput, field.readOnly && { backgroundColor: 'rgba(255,255,255,0.05)', color: '#94a3b8' }]}
                                            value={vitals[field.key]}
                                            editable={!field.readOnly}
                                            placeholder={field.placeholder || ''}
                                            placeholderTextColor="#64748b"
                                            keyboardType={field.type}
                                            onChangeText={t => setVitals({ ...vitals, [field.key]: t })}
                                        />
                                    </View>
                                ))}
                            </View>
                            
                            <View style={[styles.formGroup, { marginTop: 16 }]}>
                                <Text style={styles.formLabel}>📋 Chief Complaint</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                                    value={vitals.chiefComplaint}
                                    placeholder="Patient's chief complaint..."
                                    placeholderTextColor="#64748b"
                                    multiline
                                    onChangeText={t => setVitals({ ...vitals, chiefComplaint: t })}
                                />
                            </View>
                            
                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>📝 Nurse Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                                    value={vitals.notes}
                                    placeholder="Any observations or notes..."
                                    placeholderTextColor="#64748b"
                                    multiline
                                    onChangeText={t => setVitals({ ...vitals, notes: t })}
                                />
                            </View>
                        </ScrollView>
                        
                        <View style={styles.modalFooter}>
                            <TouchableOpacity onPress={() => setVitalsPatient(null)} style={[styles.btn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                <Text style={{ color: '#cbd5e1', fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveVitals} disabled={saving} style={[styles.btn, { backgroundColor: '#10b981', minWidth: 120 }]}>
                                <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{saving ? '⏳ Saving...' : '✅ Save Vitals'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* UPload Report Modal */}
            <Modal visible={!!uploadPatient} transparent={true} animationType="fade">
                <View style={styles.overlay}>
                    <View style={[styles.modalContainer, { maxWidth: 400 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📁 Upload Master Record</Text>
                            <TouchableOpacity onPress={() => setUploadPatient(null)}>
                                <Feather name="x" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20 }}>
                                Upload previous medical reports, prescriptions, or scans for <Text style={{ fontWeight: 'bold', color: '#fff' }}>{uploadPatient?.userId?.name || 'Patient'}</Text>.
                            </Text>
                            
                            <TouchableOpacity style={{ padding: 20, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center' }} onPress={() => setUploadFile({ name: 'mock_file.pdf' })}>
                                <Text style={{ color: '#fff' }}>{uploadFile ? uploadFile.name : 'Tap to select document (Native Picker Req)'}</Text>
                            </TouchableOpacity>

                            <View style={[styles.modalFooter, { borderTopWidth: 0, marginTop: 20, padding: 0 }]}>
                                <TouchableOpacity onPress={() => setUploadPatient(null)} style={[styles.btn, { backgroundColor: '#e2e8f0' }]}>
                                    <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleUploadReport} disabled={uploading} style={[styles.btn, { backgroundColor: '#3b82f6' }]}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{uploading ? 'Uploading...' : 'Save Report'}</Text>
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: '#f4f7fc', // Light gradient approximation
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        padding: 14,
        margin: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fca5a5',
    },
    errorBannerText: {
        color: '#b91c1c',
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        padding: 20,
    },
    statCard: {
        flex: 1,
        minWidth: 200,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statIcon: {
        fontSize: 20,
    },
    statNum: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    controls: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
    searchWrap: {
        position: 'relative',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 500,
    },
    searchIcon: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    searchInput: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingVertical: 12,
        paddingLeft: 42,
        paddingRight: 40,
        color: '#0f172a',
        fontSize: 14,
    },
    searchClearBtn: {
        position: 'absolute',
        right: 14,
        zIndex: 1,
        padding: 4,
    },
    tabsWrap: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tabActive: {
        backgroundColor: '#3b82f6',
        elevation: 3,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    tabText: {
        fontWeight: 'bold',
        color: '#475569',
        fontSize: 13,
    },
    tabTextActive: {
        color: '#fff',
    },
    tabBadge: {
        backgroundColor: '#e2e8f0',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 12,
    },
    tabBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#475569',
    },
    tabBadgeTextActive: {
        color: '#fff',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#475569',
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
    tableWrap: {
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
    },
    tableHeaderSection: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tableHeaderTitle: {
        fontWeight: 'bold',
        color: '#1e293b',
        fontSize: 16,
    },
    sectionCount: {
        color: '#475569',
        fontSize: 13,
        fontWeight: 'bold',
    },
    thRow: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f1f5f9',
    },
    th: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        color: '#64748b',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    tr: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    td: {
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    tdTextBold: {
        fontWeight: 'bold',
        color: '#0f172a',
        fontSize: 13,
    },
    tdTextSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    actionBtnOrange: {
        backgroundColor: '#f59e0b',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    actionBtnOrangeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionBtnBlue: {
        backgroundColor: '#3b82f6',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    actionBtnBlueText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    smallBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    smallBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    loadingWrap: {
        alignItems: 'center',
        padding: 40,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#1e293b',
        width: '100%',
        maxWidth: 600,
        borderRadius: 20,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalSub: {
        color: '#94a3b8',
        fontSize: 12,
        marginTop: 4,
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
        minWidth: '45%',
    },
    formLabel: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    formInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 10,
        color: '#fff',
        fontSize: 14,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    btn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    }
});

export default Patient;
