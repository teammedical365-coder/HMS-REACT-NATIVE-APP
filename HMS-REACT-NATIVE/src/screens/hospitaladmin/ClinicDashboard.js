import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions, Alert, Image, ActivityIndicator, Platform, Linking } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { clinicAPI, uploadAPI, medicineAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

const { width, height } = Dimensions.get('window');

// ─── PDF HELPERS ──────────────────────────────────────────────────────────────
const getClinicInfo = async () => {
    try {
        const h = JSON.parse(await AsyncStorage.getItem('hospitalContext') || 'null');
        const u = JSON.parse(await AsyncStorage.getItem('user') || '{}');
        return { hName: h?.name || u?.hospitalName || 'Clinic', hAddr: [h?.address, h?.city, h?.state].filter(Boolean).join(', '), hPhone: h?.phone || '', issuedBy: u?.name || 'Staff' };
    } catch { return { hName: 'Clinic', hAddr: '', hPhone: '', issuedBy: 'Staff' }; }
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const filterValidVisits = (items) => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const isUnassignedPlaceholder = (item) => {
        const d = item.data || item;
        const rawDoc = (d.doctorName || d.doctorSeen || d.doctorId?.name || d.assignedDoctor || '').toString().trim();
        const docClean = rawDoc.replace(/^dr\.\s*/i, '').toLowerCase();
        const isDocUnassigned = !docClean || docClean === 'not assigned' || docClean === 'pending' || docClean === 'unassigned' || docClean === 'none';

        const status = (d.status || '').toString().toLowerCase();
        const isStatusUnassigned = status === 'active' || status === 'pending' || !status;

        const hasDoctorActions = Boolean(
            (d.diagnosis && d.diagnosis !== '—' && d.diagnosis !== 'Processing' && d.diagnosis !== 'No diagnosis logged') ||
            (d.doctorNotes && d.doctorNotes.trim()) ||
            (d.notes && d.notes.trim() && d.notes !== '—') ||
            (d.prescriptions && d.prescriptions.length > 0) ||
            (d.medicines && d.medicines.length > 0) ||
            (d.pharmacy && d.pharmacy.length > 0)
        );

        return isDocUnassigned && isStatusUnassigned && !hasDoctorActions;
    };

    const hasValidConsultation = items.some(item => !isUnassignedPlaceholder(item));

    if (hasValidConsultation) {
        return items.filter(item => !isUnassignedPlaceholder(item));
    }
    return items;
};

// ─────────────────────────────────────────────
// Role Modes
// ─────────────────────────────────────────────
const MODES = [
    { id: 'overview', icon: 'bar-chart', label: 'Overview', color: '#6366f1', bg: '#eef2ff' },
    { id: 'patients', icon: 'people', label: 'Patients', color: '#0ea5e9', bg: '#f0f9ff' },
    { id: 'doctor', icon: 'medkit', label: 'Doctor', color: '#8b5cf6', bg: '#f5f3ff' },
    { id: 'reception', icon: 'clipboard', label: 'Reception', color: '#10b981', bg: '#f0fdf4' },
    { id: 'pharmacy', icon: 'flask', label: 'Pharmacy', color: '#f97316', bg: '#fff7ed' },
    { id: 'billing', icon: 'cash', label: 'Billing', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'plans', icon: 'calendar', label: 'Treatment Plans', color: '#0891b2', bg: '#ecfeff' },
];

// ─────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────
const ClinicDashboard = ({ navigation }) => {
    const [currentUser, setCurrentUser] = useState({});
    const [mode, setMode] = useState('overview');
    const [preselectedPatient, setPreselectedPatient] = useState(null);
    const [pendingDownload, setPendingDownload] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                setCurrentUser(user);
                const role = (user.role || '').toLowerCase();
                if (role === 'doctor' || role === 'clinic doctor') setMode('doctor');
                else if (role === 'reception' || role === 'receptionist') setMode('reception');
                else setMode('overview');
                
                const allowed = ['hospitaladmin', 'doctor', 'clinic doctor', 'reception', 'receptionist'];
                if (!allowed.includes(role)) {
                    // Navigate to login
                    // navigation.navigate('Login');
                }
            }
            setLoadingUser(false);
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (pendingDownload) {
            const timer = setTimeout(() => {
                setPendingDownload(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [pendingDownload]);

    const goToReception = (patient) => {
        setPreselectedPatient(patient);
        setMode('reception');
    };

    if (loadingUser) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    const isClinicDoctorUser = (currentUser?.role || '').toLowerCase().includes('doctor');

    return (
        <View style={styles.container}>
            {/* Role Switcher */}
            {!isClinicDoctorUser && (
                <View style={styles.roleSwitcher}>
                    <Text style={styles.switcherLabel}>Mode:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
                        <View style={styles.switcherButtons}>
                            {MODES.filter(m => {
                                const role = (currentUser?.role || '').toLowerCase();
                                if (role === 'doctor' || role === 'clinic doctor') return ['doctor', 'patients', 'overview'].includes(m.id);
                                if (role === 'reception' || role === 'receptionist') return ['reception', 'patients', 'overview', 'billing', 'plans'].includes(m.id);
                                return true;
                            }).map(m => (
                                <TouchableOpacity 
                                    key={m.id}
                                    style={[styles.switcherBtn, mode === m.id && { backgroundColor: m.color, borderColor: m.color }]}
                                    onPress={() => setMode(m.id)}
                                >
                                    <Ionicons name={m.icon} size={16} color={mode === m.id ? '#fff' : '#475569'} />
                                    <Text style={[styles.switcherBtnText, mode === m.id && { color: '#fff' }]}>{m.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                    {currentUser?.subscriptionPlan !== 'starter' && (
                        <View style={styles.switcherUser}>
                            <View style={styles.switcherAvatar}><Text style={styles.switcherAvatarText}>{currentUser?.name?.charAt(0)?.toUpperCase()}</Text></View>
                            <Text style={styles.switcherUserName}>{currentUser?.name}</Text>
                        </View>
                    )}
                </View>
            )}
            
            {isClinicDoctorUser && (
                <View style={[styles.roleSwitcher, { justifyContent: 'flex-end' }]}>
                    {currentUser?.subscriptionPlan !== 'starter' && (
                        <View style={styles.switcherUser}>
                            <View style={styles.switcherAvatar}><Text style={styles.switcherAvatarText}>{currentUser?.name?.charAt(0)?.toUpperCase()}</Text></View>
                            <Text style={styles.switcherUserName}>Dr. {currentUser?.name}</Text>
                        </View>
                    )}
                </View>
            )}

            {pendingDownload && (
                <View style={styles.downloadAlert}>
                    <Text style={styles.downloadAlertText}>✅ {pendingDownload.title || 'Document Generated'} — {pendingDownload.filename} is ready</Text>
                </View>
            )}

            <View style={styles.modeContent}>
                {mode === 'overview' && <OverviewMode />}
                {mode === 'patients' && <PatientsMode onBookToken={goToReception} setPendingDownload={setPendingDownload} />}
                {mode === 'doctor' && <DoctorMode setPendingDownload={setPendingDownload} />}
                {mode === 'reception' && <ReceptionMode preselectedPatient={preselectedPatient} clearPreselected={() => setPreselectedPatient(null)} setPendingDownload={setPendingDownload} />}
                {mode === 'pharmacy' && <PharmacyMode />}
                {mode === 'billing' && <BillingMode />}
                {mode === 'plans' && <TreatmentPlanMode />}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════
// OVERVIEW MODE
// ═══════════════════════════════════════════════════
const OverviewMode = () => {
    const [stats, setStats] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [treatmentPlans, setTreatmentPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ defaultFee: '0', followUpDays: '0', defaultServiceName: 'General Consultation', appointmentMode: 'token' });
    const [cfgSaving, setCfgSaving] = useState(false);
    const [cfgMsg, setCfgMsg] = useState('');
    const [overviewMonthStr, setOverviewMonthStr] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [showAllKpis, setShowAllKpis] = useState(false);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showApptModeDropdown, setShowApptModeDropdown] = useState(false);

    useEffect(() => {
        Promise.all([
            clinicAPI.getStats(),
            clinicAPI.getAppointments(),
            clinicAPI.getTreatmentPlans(),
            clinicAPI.getConfig()
        ]).then(([statsR, apptR, plansR, cfgR]) => {
            if (statsR.success) setStats(statsR.stats);
            if (apptR.success) setAppointments(apptR.appointments || []);
            if (plansR.success) setTreatmentPlans(plansR.plans || []);
            if (cfgR.success) setConfig({ defaultFee: String(cfgR.defaultFee ?? 0), followUpDays: String(cfgR.followUpDays ?? 0), defaultServiceName: cfgR.defaultServiceName || 'General Consultation', appointmentMode: cfgR.appointmentMode || 'token' });
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const saveConfig = async () => {
        setCfgSaving(true);
        try {
            const numConfig = { ...config, defaultFee: Number(config.defaultFee), followUpDays: Number(config.followUpDays) };
            const r = await clinicAPI.updateConfig(numConfig);
            setCfgMsg(r.success ? '✓ Saved' : (r.message || 'Error'));
        } catch { setCfgMsg('Error saving'); }
        finally { setCfgSaving(false); setTimeout(() => setCfgMsg(''), 3000); }
    };

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={{ marginTop: 10, color: '#6366f1' }}>Loading overview...</Text>
        </View>
    );

    const getLocalYYYYMMDD = (d) => {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d - tzOffset).toISOString().split('T')[0];
    };
    const localTodayStr = getLocalYYYYMMDD(new Date());
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayApptRev = 0, todayTreatRev = 0;
    let monthApptRev = 0, monthTreatRev = 0;
    let totalApptRev = 0, totalTreatRev = 0;
    let todayCompletedVisits = 0;

    appointments.forEach(a => {
        if (a.status === 'completed') {
            const aDateStr = getLocalYYYYMMDD(new Date(a.appointmentDate));
            if (aDateStr === localTodayStr) todayCompletedVisits++;
        }
        if (a.amount > 0 && (a.paymentStatus === 'paid' || a.status === 'completed' || a.status === 'consulted')) {
            totalApptRev += a.amount;
            const d = new Date(a.appointmentDate);
            if (getLocalYYYYMMDD(d) === localTodayStr) todayApptRev += a.amount;
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthApptRev += a.amount;
        }
    });

    treatmentPlans.forEach(p => {
        if (Array.isArray(p.visits)) {
            p.visits.forEach(v => {
                if (v.status === 'completed') {
                    const vDate = v.completedAt ? new Date(v.completedAt) : new Date(v.scheduledDate);
                    if (getLocalYYYYMMDD(vDate) === localTodayStr) todayCompletedVisits++;
                }
                if (Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0) {
                    v.paymentHistory.forEach(ph => {
                        if (ph.amount > 0) {
                            totalTreatRev += ph.amount;
                            const pd = new Date(ph.date);
                            if (getLocalYYYYMMDD(pd) === localTodayStr) todayTreatRev += ph.amount;
                            if (pd.getMonth() === currentMonth && pd.getFullYear() === currentYear) monthTreatRev += ph.amount;
                        }
                    });
                } else if (v.amountPaid > 0) {
                    totalTreatRev += v.amountPaid;
                    const fallbackDateStr = v.paidAt || v.completedAt || v.dueDate || p.createdAt;
                    if (fallbackDateStr) {
                        const fd = new Date(fallbackDateStr);
                        if (getLocalYYYYMMDD(fd) === localTodayStr) todayTreatRev += v.amountPaid;
                        if (fd.getMonth() === currentMonth && fd.getFullYear() === currentYear) monthTreatRev += v.amountPaid;
                    }
                }
            });
        }
    });

    const monthTotalRev = monthApptRev + monthTreatRev;
    const overallTotalRev = totalApptRev + totalTreatRev;

    const chartData = [];
    const selectedDate = new Date(overviewMonthStr + '-01T00:00:00');
    const m = selectedDate.getMonth();
    const y = selectedDate.getFullYear();
    
    let mAppt = 0;
    let mTreat = 0;
        
    appointments.forEach(a => {
        if (a.amount > 0 && (a.paymentStatus === 'paid' || a.status === 'completed' || a.status === 'consulted')) {
            const ad = new Date(a.appointmentDate);
            if (ad.getMonth() === m && ad.getFullYear() === y) mAppt += a.amount;
        }
    });
    
    treatmentPlans.forEach(p => {
        if (Array.isArray(p.visits)) {
            p.visits.forEach(v => {
                if (Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0) {
                    v.paymentHistory.forEach(ph => {
                        if (ph.amount > 0) {
                            const pd = new Date(ph.date);
                            if (pd.getMonth() === m && pd.getFullYear() === y) mTreat += ph.amount;
                        }
                    });
                } else if (v.amountPaid > 0) {
                    const fallbackDateStr = v.paidAt || v.completedAt || v.dueDate || p.createdAt;
                    if (fallbackDateStr) {
                        const fd = new Date(fallbackDateStr);
                        if (fd.getMonth() === m && fd.getFullYear() === y) mTreat += v.amountPaid;
                    }
                }
            });
        }
    });
    
    chartData.push({ month: m, year: y, appt: mAppt, treat: mTreat, total: mAppt + mTreat });

    const kpis = [
        { label: "Today's Patients", value: stats?.todayPatients ?? 0, sub: 'Total visited today', icon: 'people', color: '#0ea5e9' },
        { label: "Today's Visits", value: todayCompletedVisits, sub: 'Total completed today', icon: 'ticket', color: '#8b5cf6' },
        { label: "Today's Appointment Collection", value: fmt(todayApptRev), sub: 'Appointments only', icon: 'medkit', color: '#10b981' },
        { label: "Today's Treatment Collection", value: fmt(todayTreatRev), sub: 'Treatment plans only', icon: 'clipboard', color: '#14b8a6' },
        { label: "Selected Month Appointment Collection", value: fmt(monthApptRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: 'medkit', color: '#3b82f6' },
        { label: "Selected Month Treatment Collection", value: fmt(monthTreatRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: 'clipboard', color: '#0ea5e9' },
        { label: "Selected Month Total Collection", value: fmt(monthTotalRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: 'calendar', color: '#6366f1' },
        { label: "Overall Collection", value: fmt(overallTotalRev), sub: 'Lifetime total revenue', icon: 'cash', color: '#f59e0b' },
    ];

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0f172a' }}>Dashboard Overview</Text>
            </View>

            <View style={styles.kpiGrid}>
                {kpis.slice(0, showAllKpis ? 8 : 4).map((k, i) => (
                    <View key={i} style={[styles.kpiCard, { borderTopColor: k.color }]}>
                        <Ionicons name={k.icon} size={28} color={k.color} />
                        <View style={{ marginTop: 8 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: k.color }}>{k.value}</Text>
                            <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 }}>{k.label}</Text>
                            {k.sub && <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{k.sub}</Text>}
                        </View>
                    </View>
                ))}
            </View>
            <TouchableOpacity style={styles.kpiToggleBtn} onPress={() => setShowAllKpis(!showAllKpis)}>
                <Text style={styles.kpiToggleText}>{showAllKpis ? '▲ Show Less' : '▼ View All Overview'}</Text>
            </TouchableOpacity>

            {/* Monthly Revenue Chart */}
            <View style={styles.clinicCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>📈 Monthly Revenue</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, backgroundColor: '#3b82f6', borderRadius: 2 }} /><Text style={{ fontSize: 10, color: '#64748b' }}>Appt</Text></View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 10, height: 10, backgroundColor: '#10b981', borderRadius: 2 }} /><Text style={{ fontSize: 10, color: '#64748b' }}>Treat</Text></View>
                        </View>
                        <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowMonthDropdown(!showMonthDropdown)}>
                            <Text style={{ fontSize: 12 }}>{MONTHS[parseInt(overviewMonthStr.split('-')[1]) - 1]} {overviewMonthStr.split('-')[0]} ▼</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                {showMonthDropdown && (
                    <View style={styles.dropdownMenu}>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => {
                            const val = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                            return (
                                <TouchableOpacity key={val} style={styles.dropdownItem} onPress={() => { setOverviewMonthStr(val); setShowMonthDropdown(false); }}>
                                    <Text>{m}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
                
                <View style={{ flexDirection: 'row', height: 180, alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 20 }}>
                    {chartData.map((m, i) => {
                        const maxTotal = Math.max(...chartData.map(x => x.total));
                        const apptPct = maxTotal > 0 ? (m.appt / maxTotal) * 100 : 0;
                        const treatPct = maxTotal > 0 ? (m.treat / maxTotal) * 100 : 0;
                        return (
                            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                                <View style={{ width: 30, height: '100%', justifyContent: 'flex-end' }}>
                                    <View style={{ height: `${apptPct}%`, backgroundColor: '#3b82f6', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 }} />
                                    <View style={{ height: `${treatPct}%`, backgroundColor: '#10b981', borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 4 }} />
                                </View>
                                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold', marginTop: 4 }}>{MONTHS[m.month]}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Recent Appointments */}
            {stats?.recentAppointments?.length > 0 && (
                <View style={styles.clinicCard}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>📋 Recent Appointments</Text>
                    <ScrollView horizontal>
                        <View style={{ minWidth: width - 80 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { flex: 1 }]}>Token</Text>
                                <Text style={[styles.th, { flex: 2 }]}>Patient</Text>
                                <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
                                <Text style={[styles.th, { flex: 1.5 }]}>Status</Text>
                                <Text style={[styles.th, { flex: 1 }]}>Fee</Text>
                            </View>
                            {stats.recentAppointments.map(a => (
                                <View key={a._id} style={styles.tableRow}>
                                    <Text style={[styles.td, { flex: 1, color: '#6366f1', fontWeight: 'bold' }]}>#{a.tokenNumber || '—'}</Text>
                                    <View style={{ flex: 2 }}>
                                        <Text style={[styles.td, { fontWeight: 'bold' }]}>{a.clinicPatientId?.name || '—'}</Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{a.clinicPatientId?.patientUid || a.patientId}</Text>
                                    </View>
                                    <Text style={[styles.td, { flex: 1.5, fontSize: 12 }]}>{fmtDate(a.appointmentDate)}</Text>
                                    <View style={{ flex: 1.5 }}>
                                        <Text style={{ fontSize: 12 }}>{a.status}</Text>
                                    </View>
                                    <Text style={[styles.td, { flex: 1, color: '#16a34a', fontWeight: 'bold' }]}>{fmt(a.amount)}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Low Stock Alert */}
            {stats?.lowStockItems?.length > 0 && (
                <View style={[styles.clinicCard, { borderColor: '#fecaca', borderWidth: 1 }]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#dc2626', marginBottom: 12 }}>⚠️ Low Stock Alert</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {stats.lowStockItems.map(item => (
                            <View key={item._id} style={{ backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
                                <Text style={{ fontSize: 13, color: '#991b1b' }}><Text style={{ fontWeight: 'bold' }}>{item.name}</Text> — only <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{item.stock}</Text> {item.unit} left</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Clinic Settings */}
            <View style={styles.clinicCard}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 14 }}>⚙️ Clinic Settings</Text>
                <View style={{ gap: 12 }}>
                    <View>
                        <Text style={styles.label}>Default Service Name</Text>
                        <TextInput style={styles.input} value={config.defaultServiceName} onChangeText={t => setConfig({...config, defaultServiceName: t})} placeholder="General Consultation" maxLength={50} />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Default Fee (₹)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={config.defaultFee} onChangeText={t => setConfig({...config, defaultFee: t})} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Follow-up Validity (Days)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" value={config.followUpDays} onChangeText={t => setConfig({...config, followUpDays: t})} />
                        </View>
                    </View>
                    <View>
                        <Text style={styles.label}>Appointment Mode</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={config.appointmentMode} onValueChange={t => setConfig({...config, appointmentMode: t})}>
                                <Picker.Item label="Token (walk-in queue)" value="token" />
                                <Picker.Item label="Time Slot" value="slot" />
                            </Picker>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                        <TouchableOpacity style={styles.btnPrimary} onPress={saveConfig} disabled={cfgSaving}>
                            <Text style={styles.btnPrimaryText}>{cfgSaving ? 'Saving…' : 'Save Settings'}</Text>
                        </TouchableOpacity>
                        {cfgMsg ? <Text style={{ fontSize: 13, color: cfgMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{cfgMsg}</Text> : null}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// PATIENTS MODE
// ═══════════════════════════════════════════════════
const PatientsMode = ({ onBookToken, setPendingDownload }) => {
    const [justRegistered, setJustRegistered] = useState(null);
    const [tab, setTab] = useState('register');
    const [form, setForm] = useState({
        name: '', phone: '', age: '', aadhaarNumber: '', email: '',
        dob: '', gender: '', bloodGroup: '', address: '', city: '', state: '', pincode: '',
        allergies: '', chronicConditions: '', relatives: []
    });
    const [saving, setSaving] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false);
    const [openRelationIdx, setOpenRelationIdx] = useState(null);

    const handleRegister = async () => {
        if (!form.name || !form.phone || !form.age || !form.aadhaarNumber || !form.email || !form.dob || !form.gender || !form.address || !form.city || !form.state) {
            Alert.alert("Error", "Please fill all required fields.");
            return;
        }

        setSaving(true);
        try {
            const r = await clinicAPI.registerPatient(form);
            if (r.success) {
                setJustRegistered(r.patient);
                setForm({
                    name: '', phone: '', age: '', aadhaarNumber: '', email: '',
                    dob: '', gender: '', bloodGroup: '', address: '', city: '', state: '', pincode: '',
                    allergies: '', chronicConditions: '', relatives: []
                });
            } else {
                Alert.alert("Error", r.message || "Failed to register");
            }
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={styles.clinicCard}>
                {justRegistered ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>Patient Registered!</Text>
                        <Text style={{ color: '#64748b', marginBottom: 20, textAlign: 'center' }}>
                            <Text style={{ fontWeight: 'bold' }}>{justRegistered.name}</Text> · <Text style={{ backgroundColor: '#eef2ff', color: '#6366f1', fontWeight: 'bold' }}> {justRegistered.patientUid} </Text> · {justRegistered.phone}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <TouchableOpacity style={styles.btnPrimary} onPress={() => onBookToken(justRegistered)}>
                                <Text style={styles.btnPrimaryText}>🎟️ Book Token Now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setJustRegistered(null)}>
                                <Text style={styles.btnSecondaryText}>+ Register Another</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => { setJustRegistered(null); setTab('list'); }}>
                                <Text style={styles.btnSecondaryText}>View All Patients</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={{ paddingBottom: 120 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>👤 Register New Patient</Text>
                        <View style={{ gap: 12 }}>
                            <View>
                                <Text style={styles.label}>Full Name *</Text>
                                <TextInput style={styles.input} placeholder="Patient's full name" value={form.name} onChangeText={t => setForm({ ...form, name: t })} maxLength={50} />
                            </View>
                            <View>
                                <Text style={styles.label}>Phone *</Text>
                                <TextInput style={styles.input} keyboardType="phone-pad" placeholder="10-digit mobile number" maxLength={10} value={form.phone} onChangeText={t => setForm({ ...form, phone: t.replace(/\D/g, '').slice(0, 10) })} />
                            </View>
                            <View>
                                <Text style={styles.label}>Age *</Text>
                                <TextInput style={styles.input} keyboardType="numeric" placeholder="Age" maxLength={3} value={form.age} onChangeText={t => setForm({ ...form, age: t.replace(/\D/g, '').slice(0, 3) })} />
                            </View>
                            <View>
                                <Text style={styles.label}>Aadhaar Number *</Text>
                                <TextInput style={styles.input} keyboardType="numeric" placeholder="12-digit Aadhaar" maxLength={12} value={form.aadhaarNumber} onChangeText={t => setForm({ ...form, aadhaarNumber: t.replace(/\D/g, '').slice(0, 12) })} />
                            </View>
                            <View>
                                <Text style={styles.label}>Email *</Text>
                                <TextInput style={styles.input} keyboardType="email-address" placeholder="Enter Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} />
                            </View>
                            <View>
                                <Text style={styles.label}>Date of Birth *</Text>
                                <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={form.dob} onChangeText={t => setForm({ ...form, dob: t })} />
                            </View>
                            <View>
                                <Text style={styles.label}>Gender *</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker selectedValue={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                                        <Picker.Item label="Select Gender" value="" />
                                        <Picker.Item label="Male" value="Male" />
                                        <Picker.Item label="Female" value="Female" />
                                        <Picker.Item label="Other" value="Other" />
                                    </Picker>
                                </View>
                            </View>
                            <View>
                                <Text style={styles.label}>Blood Group</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker selectedValue={form.bloodGroup} onValueChange={v => setForm({ ...form, bloodGroup: v })}>
                                        <Picker.Item label="Unknown" value="" />
                                        <Picker.Item label="A+" value="A+" />
                                        <Picker.Item label="A-" value="A-" />
                                        <Picker.Item label="B+" value="B+" />
                                        <Picker.Item label="B-" value="B-" />
                                        <Picker.Item label="AB+" value="AB+" />
                                        <Picker.Item label="AB-" value="AB-" />
                                        <Picker.Item label="O+" value="O+" />
                                        <Picker.Item label="O-" value="O-" />
                                    </Picker>
                                </View>
                            </View>
                            <View>
                                <Text style={styles.label}>Address *</Text>
                                <TextInput style={styles.input} placeholder="Enter Address" value={form.address} onChangeText={t => setForm({ ...form, address: t })} maxLength={50} />
                            </View>
                            <View>
                                <Text style={styles.label}>City *</Text>
                                <TextInput style={styles.input} placeholder="Enter City" value={form.city} onChangeText={t => setForm({ ...form, city: t.replace(/[0-9]/g, '') })} maxLength={20} />
                            </View>
                            <View>
                                <Text style={styles.label}>State *</Text>
                                <TextInput style={styles.input} placeholder="Enter State" value={form.state} onChangeText={t => setForm({ ...form, state: t.replace(/[0-9]/g, '') })} maxLength={15} />
                            </View>
                            <View>
                                <Text style={styles.label}>Pincode</Text>
                                <TextInput style={styles.input} keyboardType="numeric" placeholder="Enter Pincode" value={form.pincode} onChangeText={t => setForm({ ...form, pincode: t.replace(/\D/g, '') })} maxLength={6} />
                            </View>
                            <View>
                                <Text style={styles.label}>Known Allergies</Text>
                                <TextInput style={styles.input} placeholder="e.g. Penicillin, Dust (optional)" value={form.allergies} onChangeText={t => setForm({ ...form, allergies: t })} maxLength={100} />
                            </View>
                            <View>
                                <Text style={styles.label}>Chronic Conditions</Text>
                                <TextInput style={styles.input} placeholder="e.g. Diabetes, Hypertension (optional)" value={form.chronicConditions} onChangeText={t => setForm({ ...form, chronicConditions: t })} maxLength={100} />
                            </View>

                            <View style={{ marginTop: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#374151' }}>👨‍👩‍👧 Relatives / Emergency Contacts</Text>
                                    <TouchableOpacity style={[styles.btnSecondary, { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#f0fdf4', borderColor: '#86efac' }]} onPress={() => setForm(f => ({ ...f, relatives: [...f.relatives, { name: '', relation: '', phone: '' }] }))}>
                                        <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>+ Add Contact</Text>
                                    </TouchableOpacity>
                                </View>
                                {form.relatives.length === 0 ? (
                                    <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e2e8f0' }}>
                                        <Text style={{ fontSize: 12, color: '#94a3b8' }}>No contacts added. Click "+ Add Contact" to add a relative or emergency contact.</Text>
                                    </View>
                                ) : (
                                    form.relatives.map((rel, idx) => (
                                        <View key={idx} style={{ padding: 10, backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 8, marginBottom: 8 }}>
                                            <TextInput style={[styles.input, { marginBottom: 4 }]} placeholder="Name e.g. Ramesh Kumar" value={rel.name} onChangeText={t => { const r = [...form.relatives]; r[idx].name = t; setForm({ ...form, relatives: r }); }} />
                                            <View style={[styles.pickerWrapper, { marginBottom: 4 }]}>
                                                <Picker selectedValue={rel.relation} onValueChange={v => { const r = [...form.relatives]; r[idx].relation = v; setForm({ ...form, relatives: r }); }}>
                                                    <Picker.Item label="Select Relation" value="" />
                                                    {['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Guardian', 'Friend', 'Other'].map(r => <Picker.Item key={r} label={r} value={r} />)}
                                                </Picker>
                                            </View>
                                            <TextInput style={[styles.input, { marginBottom: 4 }]} keyboardType="phone-pad" placeholder="10-digit number" value={rel.phone} maxLength={10} onChangeText={t => { const r = [...form.relatives]; r[idx].phone = t.replace(/\D/g, '').slice(0, 10); setForm({ ...form, relatives: r }); }} />
                                            <TouchableOpacity style={{ backgroundColor: '#fee2e2', alignSelf: 'flex-end', padding: 6, borderRadius: 4 }} onPress={() => setForm(f => ({ ...f, relatives: f.relatives.filter((_, i) => i !== idx) }))}>
                                                <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 'bold' }}>Remove</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))
                                )}
                            </View>

                            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={handleRegister} disabled={saving}>
                                <Text style={styles.btnPrimaryText}>{saving ? 'Registering...' : '✅ Register Patient'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// BookTokenForm
// ═══════════════════════════════════════════════════
const BookTokenForm = ({ patient, onBook, onCancel, flash, mode = 'token', defaultFee = 0, defaultServiceName = 'General Consultation', setPendingDownload }) => {
    const isSlotMode = mode === 'slot';
    
    const getTodayString = () => {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
    };

    const [form, setForm] = useState({ 
        amount: defaultFee > 0 ? String(defaultFee) : '', 
        serviceName: defaultServiceName, 
        notes: '', 
        appointmentDate: getTodayString(),
        appointmentTime: '', 
        paymentMethod: 'Cash', 
        upiScreenshot: null, 
        cardRef: '' 
    });
    const [booking, setBooking] = useState(false);
    const [feeWaived, setFeeWaived] = useState(false);
    const [waiverMessage, setWaiverMessage] = useState('');
    const [bookedSlots, setBookedSlots] = useState([]);
    
    useEffect(() => {
        if (!patient?._id) return;
        clinicAPI.checkFeeWaiver(patient._id, form.appointmentDate)
            .then(r => {
                if (r.success && r.waived) {
                    setFeeWaived(true);
                    setWaiverMessage(r.message || 'Registration fee waived');
                    setForm(f => ({ ...f, amount: '0', paymentMethod: 'Free' }));
                } else {
                    setFeeWaived(false);
                    setWaiverMessage('');
                    setForm(prev => ({ ...prev, amount: String(defaultFee || 0), paymentMethod: 'Cash' }));
                }
            })
            .catch(console.error);
    }, [patient, form.appointmentDate, defaultFee]);

    useEffect(() => {
        const dateStr = form.appointmentDate || getTodayString();
        clinicAPI.getAppointments(dateStr)
            .then(r => {
                if (r.success) {
                    const booked = r.appointments.filter(a => a.status !== 'cancelled' && a.appointmentTime).map(a => a.appointmentTime);
                    setBookedSlots(booked);
                }
            })
            .catch(console.error);
    }, [form.appointmentDate]);

    const isSlotDisabled = (time) => {
        if (bookedSlots.includes(time)) return true;
        const selectedDate = form.appointmentDate || getTodayString();
        const todayDate = getTodayString();
        if (selectedDate === todayDate) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const [sh, sm] = time.split(':').map(Number);
            if (sh < currentHour || (sh === currentHour && sm <= currentMinute)) {
                return true;
            }
        }
        return false;
    };

    const fee = Number(form.amount) || 0;
    const isUpi = form.paymentMethod === 'UPI';
    const isCard = form.paymentMethod === 'Card';
    const canSubmit = !booking && (fee === 0 || form.paymentMethod) && form.appointmentDate && (!isSlotMode || form.appointmentTime);

    const submit = async () => {
        if (!form.appointmentDate) { flash('error', 'Please select an appointment date'); return; }
        if (isSlotMode && !form.appointmentTime) { flash('error', 'Please select an appointment time'); return; }
        if (fee > 0 && !form.paymentMethod) { flash('error', 'Select a payment method to collect the fee'); return; }
        setBooking(true);
        try {
            const payload = {
                patientId: patient._id,
                amount: fee,
                serviceName: form.serviceName,
                notes: form.notes,
                paymentMethod: fee > 0 ? form.paymentMethod : 'Free',
                appointmentDate: form.appointmentDate || getTodayString(),
                ...(isSlotMode && { appointmentTime: form.appointmentTime }),
                ...(form.cardRef && { cardRef: form.cardRef }),
            };
            const r = await clinicAPI.bookAppointment(payload);
            if (r.success) {
                if (isSlotMode) {
                    flash('success', `✅ Appointment at ${form.appointmentTime} confirmed for ${patient.name}`);
                } else {
                    flash('success', `✅ Token #${r.appointment.tokenNumber} assigned to ${patient.name}`);
                }
                onBook();
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setBooking(false); }
    };

    const timeSlots = [];
    for (let h = 7; h <= 20; h++) {
        timeSlots.push(`${String(h).padStart(2, '0')}:00`);
        if (h < 20) timeSlots.push(`${String(h).padStart(2, '0')}:30`);
    }

    const borderColor = isSlotMode ? '#bfdbfe' : '#bbf7d0';
    const bgColor = isSlotMode ? '#eff6ff' : '#f0fdf4';

    return (
        <View style={{ backgroundColor: bgColor, borderWidth: 1, borderColor: borderColor, borderRadius: 10, padding: 14, marginTop: 8 }}>
            <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                <Text>💰 </Text>
                <Text style={{ fontSize: 12, color: '#0369a1', flexShrink: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>Payment is collected upfront.</Text> Token / appointment confirmed after fee is paid.
                </Text>
            </View>

            {feeWaived && (
                <View style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1.5, borderRadius: 6, padding: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <Text>🎁 </Text>
                    <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>{waiverMessage}</Text>
                </View>
            )}

            <View style={{ gap: 10 }}>
                <View>
                    <Text style={styles.label}>Service</Text>
                    <TextInput style={[styles.input, { backgroundColor: '#f1f5f9', color: '#94a3b8' }]} value={form.serviceName} editable={false} />
                </View>

                <View>
                    <Text style={styles.label}>Date *</Text>
                    <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={form.appointmentDate} onChangeText={t => setForm({ ...form, appointmentDate: t, appointmentTime: '' })} />
                </View>

                {isSlotMode && (
                    <View>
                        <Text style={styles.label}>Time Slot *</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={form.appointmentTime} onValueChange={v => setForm({ ...form, appointmentTime: v })}>
                                <Picker.Item label="Select time…" value="" />
                                {timeSlots.map(t => {
                                    const disabled = isSlotDisabled(t);
                                    return <Picker.Item key={t} label={`${t} ${disabled ? '(Unavailable)' : ''}`} value={t} color={disabled ? '#94a3b8' : '#000'} />
                                })}
                            </Picker>
                        </View>
                    </View>
                )}

                <View>
                    <Text style={styles.label}>Fee (₹) *</Text>
                    <TextInput style={[styles.input, { backgroundColor: '#f1f5f9', color: '#94a3b8' }]} value={form.amount} editable={false} />
                </View>

                <View>
                    <Text style={[styles.label, { color: fee > 0 ? '#dc2626' : '#64748b', fontWeight: fee > 0 ? 'bold' : 'normal' }]}>Payment Method {fee > 0 ? '*' : ''}</Text>
                    <View style={[styles.pickerWrapper, { borderColor: fee > 0 && !form.paymentMethod ? '#dc2626' : '#e2e8f0', backgroundColor: feeWaived ? '#f1f5f9' : '#fff' }]}>
                        <Picker selectedValue={form.paymentMethod} enabled={!feeWaived} onValueChange={v => setForm({ ...form, paymentMethod: v, upiScreenshot: null, cardRef: '' })}>
                            <Picker.Item label="Cash" value="Cash" />
                            <Picker.Item label="UPI" value="UPI" />
                            <Picker.Item label="Card" value="Card" />
                            {feeWaived && <Picker.Item label="Free" value="Free" />}
                        </Picker>
                    </View>
                </View>

                {fee > 0 && isCard && (
                    <View>
                        <Text style={styles.label}>Card Last 4 / Reference</Text>
                        <TextInput style={styles.input} placeholder="e.g. 4242" value={form.cardRef} onChangeText={t => setForm({ ...form, cardRef: t })} maxLength={20} />
                    </View>
                )}

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    <TouchableOpacity style={[styles.btnPrimary, { opacity: canSubmit ? 1 : 0.6 }]} disabled={!canSubmit} onPress={submit}>
                        <Text style={styles.btnPrimaryText}>{booking ? '...' : isSlotMode ? `💰 Pay${fee > 0 ? ` ₹${fee}` : ''} & Book Slot` : `💰 Pay${fee > 0 ? ` ₹${fee}` : ''} & Assign Token`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 12 }]} onPress={onCancel}>
                        <Text style={styles.btnSecondaryText}>✕ Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════
// RECEPTION MODE
// ═══════════════════════════════════════════════════
const ReceptionMode = ({ preselectedPatient, clearPreselected, setPendingDownload }) => {
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [assigningFor, setAssigningFor] = useState(preselectedPatient?._id || null);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [appointmentMode, setAppointmentMode] = useState('token');
    const [defaultFee, setDefaultFee] = useState(0);
    const [defaultServiceName, setDefaultServiceName] = useState('General Consultation');
    const [showQuickReg, setShowQuickReg] = useState(false);
    const [qrForm, setQrForm] = useState({ name: '', phone: '', email: '', age: '', gender: 'Male' });
    const [qrSaving, setQrSaving] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };
    const today = todayStr();
    const isSlotMode = appointmentMode === 'slot';

    const loadAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            clinicAPI.getPatients(search),
            clinicAPI.getAppointments(today),
        ]).then(([pr, ar]) => {
            if (pr.success) setPatients(pr.patients);
            if (ar.success) setAppointments(ar.appointments);
        }).catch(console.error).finally(() => setLoading(false));
    }, [today, search]);

    useEffect(() => {
        clinicAPI.getConfig().then(r => {
            if (r.success) {
                setAppointmentMode(r.appointmentMode || 'token');
                setDefaultFee(r.defaultFee ?? 0);
                setDefaultServiceName(r.defaultServiceName || 'General Consultation');
            }
        }).catch(() => { });
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    useEffect(() => {
        if (preselectedPatient) setAssigningFor(preselectedPatient._id);
    }, [preselectedPatient]);

    const handleSearch = () => {
        setSearching(true);
        clinicAPI.getPatients(search).then(r => { if (r.success) setPatients(r.patients); }).finally(() => setSearching(false));
    };

    const handleQuickRegister = async () => {
        setQrSaving(true);
        try {
            const r = await clinicAPI.registerPatient(qrForm);
            if (r.success) {
                setPatients(prev => r.existing ? prev : [r.patient, ...prev]);
                setAssigningFor(r.patient._id);
                setShowQuickReg(false);
                setQrForm({ name: '', phone: '', email: '', age: '', gender: 'Male' });
                if (clearPreselected) clearPreselected();
                flash('success', `${r.existing ? 'Found' : 'Registered'}: ${r.patient.patientUid} — book below.`);
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setQrSaving(false); }
    };

    const cancelAppt = async (id) => {
        Alert.alert("Confirm Cancel", isSlotMode ? 'Cancel this appointment?' : 'Cancel this token?', [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: async () => {
                try {
                    await clinicAPI.cancelAppointment(id);
                    setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: 'cancelled' } : a));
                } catch (e) { flash('error', e.message); }
            }}
        ]);
    };

    const todayApptMap = {};
    appointments.forEach(a => {
        const pid = a.clinicPatientId?._id || a.clinicPatientId;
        if (pid) todayApptMap[pid.toString()] = a;
    });

    const activeTokens = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
    const doneToday = appointments.filter(a => a.status === 'completed');

    const withToken = patients.filter(p => todayApptMap[p._id] && ['confirmed', 'pending'].includes(todayApptMap[p._id]?.status));
    const withoutToken = patients.filter(p => !todayApptMap[p._id] || !['confirmed', 'pending'].includes(todayApptMap[p._id]?.status));
    const displayList = [...withToken, ...withoutToken];

    return (
        <ScrollView style={{ flex: 1 }}>
            {msg.text ? <View style={{ padding: 10, backgroundColor: msg.type === 'error' ? '#fee2e2' : '#dcfce7', marginBottom: 10, borderRadius: 6 }}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#16a34a' }}>{msg.text}</Text></View> : null}

            <View style={[styles.clinicCard, { marginBottom: 14 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>📋 Reception</Text>
                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>
                            {activeTokens.length} {isSlotMode ? 'scheduled' : 'in queue'} · {doneToday.length} done · {patients.length} total
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.btnSecondary} onPress={loadAll}>
                        <Text style={styles.btnSecondaryText}>↻ Refresh</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="Search patient..." value={search} onChangeText={setSearch} onSubmitEditing={handleSearch} />
                    <TouchableOpacity style={styles.btnSecondary} onPress={handleSearch} disabled={searching}>
                        <Text>{searching ? '...' : '🔍'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowQuickReg(!showQuickReg)}>
                        <Text style={styles.btnPrimaryText}>+ New</Text>
                    </TouchableOpacity>
                </View>

                {showQuickReg && (
                    <View style={{ marginTop: 12, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 10, padding: 14, backgroundColor: '#fafbff' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#6366f1' }}>Quick Register New Patient</Text>
                        <View style={{ gap: 8 }}>
                            <TextInput style={styles.input} placeholder="Full Name" value={qrForm.name} onChangeText={t => setQrForm({ ...qrForm, name: t })} />
                            <TextInput style={styles.input} keyboardType="phone-pad" placeholder="10-digit Phone" value={qrForm.phone} maxLength={10} onChangeText={t => setQrForm({ ...qrForm, phone: t.replace(/\D/g, '').slice(0, 10) })} />
                            <TextInput style={styles.input} keyboardType="numeric" placeholder="Age" value={qrForm.age} maxLength={3} onChangeText={t => setQrForm({ ...qrForm, age: t.replace(/\D/g, '').slice(0, 3) })} />
                            <TextInput style={styles.input} keyboardType="email-address" placeholder="Email" value={qrForm.email} onChangeText={t => setQrForm({ ...qrForm, email: t })} />
                            <View style={styles.pickerWrapper}>
                                <Picker selectedValue={qrForm.gender} onValueChange={v => setQrForm({ ...qrForm, gender: v })}>
                                    <Picker.Item label="Male" value="Male" />
                                    <Picker.Item label="Female" value="Female" />
                                    <Picker.Item label="Other" value="Other" />
                                </Picker>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity style={styles.btnPrimary} onPress={handleQuickRegister} disabled={qrSaving}>
                                    <Text style={styles.btnPrimaryText}>{qrSaving ? '...' : '✅ Register & Book'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowQuickReg(false)}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} />
            ) : displayList.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>No patients found. Register your first patient.</Text></View>
            ) : (
                <FlatList 
                    data={displayList}
                    keyExtractor={p => p._id}
                    scrollEnabled={false}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item: p }) => {
                        const appt = todayApptMap[p._id];
                        const hasToken = appt && (appt.status === 'confirmed' || appt.status === 'pending');
                        const isDone = appt && appt.status === 'completed';
                        const isExpanding = assigningFor === p._id;

                        return (
                            <View style={{ borderWidth: 1, borderColor: hasToken ? '#bbf7d0' : '#e2e8f0', borderRadius: 10, padding: 12, backgroundColor: hasToken ? '#f0fdf4' : isDone ? '#f8fafc' : '#fff' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{p.name}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                                            {p.patientUid} · {p.phone} {p.gender ? `· ${p.gender}` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                        {hasToken && (
                                            <>
                                                <Text style={{ backgroundColor: isSlotMode ? '#3b82f6' : '#6366f1', color: '#fff', fontWeight: 'bold', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, fontSize: 13 }}>
                                                    {isSlotMode ? `🕐 ${appt.appointmentTime}` : `#${appt.tokenNumber}`}
                                                </Text>
                                                <TouchableOpacity onPress={() => cancelAppt(appt._id)} style={{ backgroundColor: '#fee2e2', padding: 4, borderRadius: 4 }}>
                                                    <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        {isDone && <Text style={{ backgroundColor: '#dcfce7', color: '#16a34a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold' }}>✅ Visited Today</Text>}
                                        {!hasToken && (
                                            <TouchableOpacity style={styles.btnPrimary} onPress={() => setAssigningFor(isExpanding ? null : p._id)}>
                                                <Text style={styles.btnPrimaryText}>{isExpanding ? '✕ Cancel' : isDone ? '🎟️ Rebook' : isSlotMode ? '🕐 Book Slot' : '🎟️ Assign Token'}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {isExpanding && !hasToken && (
                                    <BookTokenForm
                                        patient={p}
                                        mode={appointmentMode}
                                        flash={flash}
                                        defaultFee={defaultFee}
                                        defaultServiceName={defaultServiceName}
                                        setPendingDownload={setPendingDownload}
                                        onBook={() => { setAssigningFor(null); if (clearPreselected) clearPreselected(); loadAll(); }}
                                        onCancel={() => { setAssigningFor(null); if (clearPreselected) clearPreselected(); }}
                                    />
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// MEDICINE TABLE — prescription editor with per-row autocomplete
// ═══════════════════════════════════════════════════
const MedicineTable = ({ rx, setRx, inventory }) => {
    const [activeRow, setActiveRow] = useState(null);
    const [rowSearch, setRowSearch] = useState({});

    const getSuggestions = (idx) => {
        const q = (rowSearch[idx] ?? (rx.medicines[idx]?.name || rx.medicines[idx]?.medicineName) ?? '').trim().toLowerCase();
        if (!q || q.length < 1) return [];
        return inventory.filter(inv => inv.name.toLowerCase().includes(q)).slice(0, 8);
    };

    const selectSuggestion = (idx, med) => {
        setRx(r => {
            const ms = [...r.medicines];
            ms[idx] = { ...ms[idx], name: med.name, medicineName: med.name, saltName: med.saltName || '', dose: med.unit || '' };
            return { ...r, medicines: ms };
        });
        setRowSearch(prev => ({ ...prev, [idx]: med.name }));
        setActiveRow(null);
    };

    const handleNameChange = (idx, value) => {
        setRowSearch(prev => ({ ...prev, [idx]: value }));
        setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], name: value }; return { ...r, medicines: ms }; });
        setActiveRow(idx);
    };

    return (
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {/* Table Header */}
            <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                <Text style={{ flex: 3, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Medicine Name</Text>
                <Text style={{ flex: 2, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Salt/Generic</Text>
                <Text style={{ flex: 2, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Dose</Text>
                <Text style={{ flex: 1, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Days</Text>
                <Text style={{ width: 40, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12, textAlign: 'center' }}>X</Text>
            </View>
            
            {/* Table Body */}
            {rx.medicines.map((m, idx) => {
                const displayVal = rowSearch[idx] !== undefined ? rowSearch[idx] : (m.name || m.medicineName || '');
                const suggestions = getSuggestions(idx);
                const showDropdown = activeRow === idx && suggestions.length > 0;
                
                return (
                    <View key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingVertical: 6 }}>
                            {/* Medicine Name */}
                            <View style={{ flex: 3, paddingHorizontal: 4, position: 'relative', zIndex: showDropdown ? 10 : 1 }}>
                                <TextInput
                                    value={displayVal}
                                    onChangeText={val => handleNameChange(idx, val)}
                                    onFocus={() => setActiveRow(idx)}
                                    placeholder="Search medicine..."
                                    style={[styles.input, { paddingVertical: 4, paddingHorizontal: 6, fontSize: 12, borderColor: showDropdown ? '#6366f1' : '#e2e8f0' }]}
                                />
                                {showDropdown && (
                                    <View style={{ position: 'absolute', top: '100%', left: 4, right: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#6366f1', borderRadius: 6, zIndex: 999, elevation: 5, maxHeight: 150 }}>
                                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                            {suggestions.map((med, si) => (
                                                <TouchableOpacity
                                                    key={med._id || si}
                                                    onPress={() => selectSuggestion(idx, med)}
                                                    style={{ padding: 8, borderBottomWidth: si < suggestions.length - 1 ? 1 : 0, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                                >
                                                    <Text style={{ color: '#6366f1', fontSize: 12 }}>💊</Text>
                                                    <View>
                                                        <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 12 }}>{med.name}</Text>
                                                        {med.category && <Text style={{ fontSize: 10, color: '#94a3b8' }}>{med.category} · {med.unit || ''}</Text>}
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Salt Name */}
                            <View style={{ flex: 2, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.saltName || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], saltName: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. Paracetamol"
                                    style={[styles.input, { paddingVertical: 4, paddingHorizontal: 6, fontSize: 12 }]}
                                />
                            </View>

                            {/* Dose */}
                            <View style={{ flex: 2, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.dose || m.dosage || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], dose: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. 1 OD"
                                    style={[styles.input, { paddingVertical: 4, paddingHorizontal: 6, fontSize: 12 }]}
                                />
                            </View>

                            {/* Days */}
                            <View style={{ flex: 1, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.days || m.duration || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], days: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. 5"
                                    keyboardType="numeric"
                                    style={[styles.input, { paddingVertical: 4, paddingHorizontal: 6, fontSize: 12 }]}
                                />
                            </View>

                            {/* Remove Row */}
                            <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setRx(r => ({ ...r, medicines: r.medicines.filter((_, i) => i !== idx) }));
                                        setRowSearch(prev => { const next = { ...prev }; delete next[idx]; return next; });
                                    }}
                                    style={{ backgroundColor: '#fee2e2', width: 24, height: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );
            })}
            {rx.medicines.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>No medicines added. Click "+ Add Row" to start prescribing.</Text>
                </View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════
// DOCTOR MODE
// ═══════════════════════════════════════════════════
const DoctorMode = ({ setPendingDownload }) => {
    const [tab, setTab] = useState('staff'); // 'staff' | 'queue'
    const [staff, setStaff] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [consulting, setConsulting] = useState(null);
    const [rx, setRx] = useState({ diagnosis: '', notes: '', labTests: '', medicines: [] });
    const [vitals, setVitals] = useState({ weight: '', height: '', bmi: '', bp: '', temperature: '', pulse: '', spo2: '', rr: '' });
    const [showVitals, setShowVitals] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [inventory, setInventory] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [patientHistory, setPatientHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };

    const todayStr = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const loadToday = () => {
        setLoading(true);
        clinicAPI.getAppointments(todayStr())
            .then(r => { if (r.success) setAppointments(r.appointments); })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        clinicAPI.getStaff().then(r => { if (r.success) setStaff(r.staff || []); }).catch(() => {}).finally(() => setStaffLoading(false));
        loadToday();
        
        clinicAPI.getInventory()
            .then(invRes => {
                const localList = invRes.success ? (invRes.inventory || []) : [];
                setInventory(localList);
            })
            .catch(() => {});

        clinicAPI.getStats().then(r => { if (r.success) setAnalytics(r.stats); }).catch(() => { });
    }, []);

    const openConsult = (appt) => {
        setConsulting(appt);
        setShowHistory(false);
        setPatientHistory([]);
        setShowVitals(true);
        setRx({
            diagnosis: appt.diagnosis || '',
            notes: appt.doctorNotes || '',
            labTests: (appt.labTests || []).join(', '),
            medicines: appt.pharmacy || [],
        });
        setVitals({
            weight: appt.vitals?.weight || '',
            height: appt.vitals?.height || '',
            bmi: appt.vitals?.bmi || '',
            bp: appt.vitals?.bp || '',
            temperature: appt.vitals?.temperature || '',
            pulse: appt.vitals?.pulse || '',
            spo2: appt.vitals?.spo2 || '',
            rr: appt.vitals?.rr || '',
        });
        if (appt.clinicPatientId?._id) {
            setHistoryLoading(true);
            clinicAPI.getPatientHistory(appt.clinicPatientId._id)
                .then(r => { if (r.success) setPatientHistory(r.appointments || []); })
                .catch(() => { })
                .finally(() => setHistoryLoading(false));
        }
    };

    const handleVitalChange = (field, value) => {
        setVitals(prev => {
            const updated = { ...prev, [field]: value };
            if ((field === 'weight' || field === 'height') && updated.weight && updated.height) {
                const hM = parseFloat(updated.height) / 100;
                if (hM > 0) updated.bmi = (parseFloat(updated.weight) / (hM * hM)).toFixed(1);
            }
            return updated;
        });
    };

    const saveConsult = async () => {
        setSaving(true);
        try {
            const labArr = rx.labTests.split(',').map(t => t.trim()).filter(Boolean);
            const isEditing = consulting.status === 'completed';
            
            const payload = {
                diagnosis: rx.diagnosis,
                notes: rx.notes,
                vitals,
                medicines: rx.medicines.filter(m => (m.name || m.medicineName)?.trim()).map(m => ({
                    name: (m.name || m.medicineName || '').trim(),
                    saltName: (m.saltName || '').trim(),
                    dose: (m.dose || m.dosage || '').trim(),
                    days: (m.days || m.duration || '').trim(),
                    medicineName: (m.name || m.medicineName || '').trim(),
                    frequency: (m.dose || m.dosage || '').trim(),
                    duration: (m.days || m.duration || '').trim(),
                })),
                labTests: labArr,
            };

            const r = isEditing
                ? await clinicAPI.updateConsultation(consulting._id, payload)
                : await clinicAPI.completeAppointment(consulting._id, payload);

            if (r.success) {
                flash('success', isEditing ? 'Consultation updated successfully.' : 'Consultation saved. Prescription generated.');
                setConsulting(null);
                loadToday();
                // PDF generation handled via web side or mobile share in actual app
                flash('success', 'Saved successfully!');
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const pending = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
    const done = appointments.filter(a => a.status === 'completed');
    const pastVisits = patientHistory.filter(h => h._id !== consulting?._id && h.status === 'completed');

    if (consulting) return (
        <ScrollView style={styles.container}>
            <TouchableOpacity onPress={() => setConsulting(null)} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>← Back to Queue</Text>
            </TouchableOpacity>
            
            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}
            
            <View style={styles.clinicCard}>
                {/* Patient header */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{(consulting.clinicPatientId?.name || '?').charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{consulting.clinicPatientId?.name || 'Patient'}</Text>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>
                            {consulting.clinicPatientId?.patientUid || consulting.patientId} · Token #{consulting.tokenNumber} · {consulting.serviceName || 'General'}
                            {consulting.clinicPatientId?.gender ? ` · ${consulting.clinicPatientId.gender}` : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            {consulting.clinicPatientId?.bloodGroup && <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 'bold' }}>🩸 {consulting.clinicPatientId.bloodGroup}</Text></View>}
                            {consulting.clinicPatientId?.allergies && <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: '#92400e', fontSize: 12, fontWeight: 'bold' }}>⚠️ {consulting.clinicPatientId.allergies}</Text></View>}
                        </View>
                        {consulting.notes && <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Chief complaint: {consulting.notes}</Text>}
                        {consulting.clinicPatientId?.relatives?.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {consulting.clinicPatientId.relatives.map((rel, i) => (
                                    <View key={i} style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 11, color: '#0369a1' }}>👤 {rel.name}{rel.relation ? ` (${rel.relation})` : ''}{rel.phone ? ` · ${rel.phone}` : ''}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Past Visits */}
                {historyLoading ? (
                    <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Loading visit history...</Text>
                ) : pastVisits.length > 0 && (
                    <View style={{ marginBottom: 20, borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 10, overflow: 'hidden' }}>
                        <TouchableOpacity
                            onPress={() => setShowHistory(h => !h)}
                            style={{ backgroundColor: '#eef2ff', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#4338ca' }}>📋 Past Visits ({pastVisits.length})</Text>
                            <Text style={{ color: '#4338ca' }}>{showHistory ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {showHistory && (
                            <View style={{ backgroundColor: '#f8faff', padding: 16, gap: 12 }}>
                                {pastVisits.map(v => (
                                    <View key={v._id} style={{ borderLeftWidth: 3, borderLeftColor: '#a5b4fc', paddingLeft: 12, marginBottom: 12 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6366f1' }}>{new Date(v.appointmentDate || v.createdAt).toLocaleDateString('en-IN')}</Text>
                                        {v.vitals && Object.values(v.vitals).some(x => x) && (
                                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                                {v.vitals.weight ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Wt: <Text style={{ fontWeight: 'bold' }}>{v.vitals.weight}kg</Text></Text> : null}
                                                {v.vitals.bp ? <Text style={{ fontSize: 11, color: '#0369a1' }}>BP: <Text style={{ fontWeight: 'bold' }}>{v.vitals.bp}</Text></Text> : null}
                                                {v.vitals.temperature ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Temp: <Text style={{ fontWeight: 'bold' }}>{v.vitals.temperature}°F</Text></Text> : null}
                                                {v.vitals.pulse ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Pulse: <Text style={{ fontWeight: 'bold' }}>{v.vitals.pulse}bpm</Text></Text> : null}
                                            </View>
                                        )}
                                        {v.diagnosis ? <Text style={{ fontSize: 13, color: '#1e293b', marginTop: 4 }}><Text style={{ fontWeight: 'bold' }}>Dx:</Text> {v.diagnosis}</Text> : null}
                                        {v.doctorNotes ? <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}><Text style={{ fontWeight: 'bold' }}>Notes:</Text> {v.doctorNotes}</Text> : null}
                                        {(v.pharmacy || []).length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                                <Text style={{ fontWeight: 'bold' }}>Rx:</Text> {v.pharmacy.map(m => m.medicineName || m.name).join(', ')}
                                            </Text>
                                        )}
                                        {(v.labTests || []).length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}><Text style={{ fontWeight: 'bold' }}>Labs:</Text> {v.labTests.join(', ')}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Patient Reports — (Placeholder for PatientReportPanel to avoid undefined) */}
                <View style={{ marginBottom: 16 }}>
                    {/* PatientReportPanel component to be defined globally below */}
                    <PatientReportPanel patientId={consulting.clinicPatientId?._id} patientName={consulting.clinicPatientId?.name} />
                </View>

                {/* Vitals Panel */}
                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 20, overflow: 'hidden' }}>
                    <TouchableOpacity
                        onPress={() => setShowVitals(v => !v)}
                        style={{ backgroundColor: '#f8fafc', padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: showVitals ? 1 : 0, borderColor: '#e2e8f0' }}>
                        <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>🩺 Patient Vitals {Object.values(vitals).some(v => v) ? '✓' : ''}</Text>
                        <Text style={{ color: '#1e293b' }}>{showVitals ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showVitals && (
                        <View style={{ padding: 12 }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                {[
                                    { label: '⚖️ Weight (kg)', field: 'weight', type: 'numeric', ph: 'e.g. 65' },
                                    { label: '📏 Height (cm)', field: 'height', type: 'numeric', ph: 'e.g. 170' },
                                    { label: '🔢 BMI (auto)', field: 'bmi', readOnly: true, ph: 'Auto' },
                                    { label: '💓 BP (mmHg)', field: 'bp', type: 'default', ph: 'e.g. 120/80' },
                                    { label: '🌡️ Temp (°F)', field: 'temperature', type: 'numeric', ph: 'e.g. 98.6' },
                                    { label: '🫀 Pulse (bpm)', field: 'pulse', type: 'numeric', ph: 'e.g. 72' },
                                    { label: '🫁 SpO₂ (%)', field: 'spo2', type: 'numeric', ph: 'e.g. 98' },
                                    { label: '🌬️ Resp. (/min)', field: 'rr', type: 'numeric', ph: 'e.g. 16' }
                                ].map((vItem, i) => (
                                    <View key={i} style={{ width: '47%' }}>
                                        <Text style={styles.label}>{vItem.label}</Text>
                                        <TextInput
                                            style={[styles.input, vItem.readOnly && { backgroundColor: 'transparent', fontWeight: 'bold' }]}
                                            keyboardType={vItem.type}
                                            placeholder={vItem.ph}
                                            value={String(vitals[vItem.field] || '')}
                                            editable={!vItem.readOnly}
                                            onChangeText={text => handleVitalChange(vItem.field, text)}
                                        />
                                        {vItem.field === 'bmi' && vitals.bmi ? (
                                            <View style={{ marginTop: 4, backgroundColor: parseFloat(vitals.bmi) < 18.5 ? '#fef08a' : parseFloat(vitals.bmi) < 25 ? '#bbf7d0' : '#fecaca', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                <Text style={{ fontSize: 10, color: '#1e293b', fontWeight: 'bold' }}>
                                                    {parseFloat(vitals.bmi) < 18.5 ? 'Underweight' : parseFloat(vitals.bmi) < 25 ? 'Normal' : parseFloat(vitals.bmi) < 30 ? 'Overweight' : 'Obese'}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ gap: 12 }}>
                    <View>
                        <Text style={styles.label}>Diagnosis / Chief Complaint</Text>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline value={rx.diagnosis} onChangeText={t => setRx(r => ({ ...r, diagnosis: t }))} placeholder="e.g. Viral fever, URTI..." />
                    </View>
                    <View>
                        <Text style={styles.label}>Doctor Notes / Advice</Text>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline value={rx.notes} onChangeText={t => setRx(r => ({ ...r, notes: t }))} placeholder="Clinical observations, advice..." />
                    </View>
                    <View>
                        <Text style={styles.label}>Lab Tests (comma separated)</Text>
                        <TextInput style={styles.input} value={rx.labTests} onChangeText={t => setRx(r => ({ ...r, labTests: t }))} placeholder="CBC, Blood Sugar, Urine Routine" />
                    </View>
                </View>

                {/* Prescription */}
                <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 }}>💊 Prescription</Text>
                    <MedicineTable rx={rx} setRx={setRx} inventory={inventory} />
                    <TouchableOpacity
                        onPress={() => setRx(r => ({ ...r, medicines: [...r.medicines, { name: '', saltName: '', dose: '', days: '' }] }))}
                        style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f0fdf4', borderWidth: 1, borderStyle: 'dashed', borderColor: '#86efac', borderRadius: 6 }}
                    >
                        <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>+ Add Row</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 24, paddingVertical: 14, alignItems: 'center' }]} disabled={saving} onPress={saveConsult}>
                    <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : '✅ Save & Generate Prescription'}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <ScrollView style={styles.container}>
            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            {/* Tab switcher */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {[{ id: 'staff', label: '👥 Doctor & Staff List' }, { id: 'queue', label: '🩺 Today\'s Queue' }]
                    .filter(t => true) // keeping both for now
                    .map(t => (
                    <TouchableOpacity key={t.id} style={[styles.switcherBtn, tab === t.id && { backgroundColor: '#6366f1', borderColor: '#6366f1' }]} onPress={() => setTab(t.id)}>
                        <Text style={[styles.switcherBtnText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Staff List */}
            {tab === 'staff' && (
                <View style={styles.clinicCard}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 14, color: '#1e293b' }}>👥 Clinic Staff</Text>
                    {staffLoading ? <Spinner /> : staff.length === 0 ? <Empty text="No staff members found for this clinic." /> : (
                        <FlatList
                            data={staff}
                            keyExtractor={s => s._id}
                            renderItem={({item: s}) => (
                                <View style={styles.tableRow}>
                                    <View style={{ flex: 2 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{s.name}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>{s.email || '—'}</Text>
                                    </View>
                                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                        <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0' }}>
                                            <Text style={{ color: '#16a34a', fontSize: 12, textTransform: 'capitalize' }}>{s.roleName}</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.phone || '—'}</Text>
                                    </View>
                                </View>
                            )}
                            scrollEnabled={false}
                        />
                    )}
                </View>
            )}

            {/* Queue Tab */}
            {tab === 'queue' && (
                <View>
                    {analytics && (
                        <View style={styles.clinicCard}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 14, color: '#1e293b' }}>📊 Clinic Performance</Text>
                            <View style={styles.kpiGrid}>
                                {[
                                    { label: 'Seen Today', value: analytics.todayAppointments ?? '—', color: '#6366f1' },
                                    { label: 'Month Revenue', value: `₹${(analytics.monthRevenue || 0).toLocaleString('en-IN')}`, color: '#16a34a' },
                                    { label: 'Total Patients', value: analytics.totalPatients ?? '—', color: '#0891b2' },
                                    { label: 'Completed All Time', value: analytics.completedAppointments ?? '—', color: '#7c3aed' },
                                ].map((s, i) => (
                                    <View key={i} style={[styles.kpiCard, { flex: 1, minWidth: '45%', alignItems: 'center' }]}>
                                        <Text style={{ fontSize: 22, fontWeight: '900', color: s.color }}>{s.value}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.clinicCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>🩺 Today's Patients</Text>
                                <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{pending.length} waiting · {done.length} seen today</Text>
                            </View>
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6 }]} onPress={loadToday}>
                                <Text style={{ color: '#475569', fontSize: 12, fontWeight: 'bold' }}>↻ Refresh</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? <Spinner /> : pending.length === 0 ? (
                            <Empty text="No patients in queue. Book tokens from Reception mode." />
                        ) : (
                            <FlatList
                                data={pending}
                                keyExtractor={a => a._id}
                                renderItem={({item: a}) => (
                                    <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12, alignItems: 'center' }}>
                                        <View style={{ backgroundColor: '#fff', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#6366f1', marginRight: 12 }}>
                                            <Text style={{ color: '#6366f1', fontWeight: '900', fontSize: 16 }}>#{a.tokenNumber}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#1e293b' }}>{a.clinicPatientId?.name || '—'}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                {a.clinicPatientId?.patientUid || a.patientId} · {a.serviceName || 'General'}
                                                {a.notes ? ` · "${a.notes}"` : ''}
                                            </Text>
                                        </View>
                                        <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 16, paddingVertical: 8 }]} onPress={() => openConsult(a)}>
                                            <Text style={styles.btnPrimaryText}>Start →</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                scrollEnabled={false}
                            />
                        )}
                    </View>

                    {done.length > 0 && (
                        <View style={styles.clinicCard}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1e293b' }}>✅ Seen Today ({done.length})</Text>
                            <FlatList
                                data={done}
                                keyExtractor={a => a._id}
                                renderItem={({item: a}) => (
                                    <View style={styles.tableRow}>
                                        <Text style={{ fontWeight: 'bold', color: '#6366f1', width: 40 }}>#{a.tokenNumber}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{a.clinicPatientId?.name || '—'}</Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{a.clinicPatientId?.patientUid || a.patientId}</Text>
                                            {a.diagnosis ? <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Dx: {a.diagnosis}</Text> : null}
                                        </View>
                                        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6 }]} onPress={() => openConsult(a)}>
                                            <Text style={{ color: '#475569', fontSize: 12, fontWeight: 'bold' }}>✏️ Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                scrollEnabled={false}
                            />
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// PHARMACY MODE
// ═══════════════════════════════════════════════════
const PharmacyMode = () => {
    const [tab, setTab] = useState('list');
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addForm, setAddForm] = useState({ name: '', category: 'General', unit: 'Tablets' });
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

    const loadInventory = () => {
        setLoading(true);
        clinicAPI.getInventory()
            .then(r => { if (r.success) setInventory(r.inventory || []); })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadInventory(); }, []);

    const handleAdd = async () => {
        if (!addForm.name.trim()) return flash('error', 'Medicine name is required');
        setAdding(true);
        try {
            const r = await clinicAPI.addInventory({ name: addForm.name, category: addForm.category, unit: addForm.unit });
            if (r.success) {
                setInventory(prev => [...prev, r.item].sort((a, b) => a.name.localeCompare(b.name)));
                setAddForm({ name: '', category: 'General', unit: 'Tablets' });
                setTab('list');
                flash('success', `"${r.item.name}" added to medicine list.`);
            }
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setAdding(false); }
    };

    const filtered = search.trim()
        ? inventory.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()) || (m.category || '').toLowerCase().includes(search.trim().toLowerCase()))
        : inventory;

    const CATEGORIES = ['General', 'Antibiotic', 'Analgesic', 'Antacid', 'Vitamin', 'Antifungal', 'Antihistamine', 'Other'];
    const UNITS = ['Tablets', 'Capsules', 'Syrup (ml)', 'Injection', 'Cream/Ointment', 'Drops', 'Other'];

    return (
        <ScrollView style={styles.container}>
            {/* Info Banner */}
            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>💡</Text>
                <Text style={{ flex: 1, fontSize: 13, color: '#0369a1' }}>
                    This is your <Text style={{ fontWeight: 'bold' }}>medicine list</Text> — add commonly used medicines here so doctors can quickly select them while prescribing. No stock tracking or billing.
                </Text>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: '#f1f5f9', borderRadius: 8, padding: 4 }}>
                {[
                    { id: 'list', label: `💊 Medicine List (${inventory.length})` },
                    { id: 'add', label: '+ Add Medicine' },
                ].map(t => (
                    <TouchableOpacity key={t.id} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6, backgroundColor: tab === t.id ? '#fff' : 'transparent', shadowColor: tab === t.id ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: tab === t.id ? 2 : 0 }} onPress={() => setTab(t.id)}>
                        <Text style={{ fontWeight: tab === t.id ? 'bold' : '600', color: tab === t.id ? '#1e293b' : '#64748b' }}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            {loading ? <Spinner /> : (
                <View>
                    {tab === 'list' && (
                        <View style={styles.clinicCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>💊 Medicine List</Text>
                                <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]} onPress={() => setTab('add')}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>+ Add Medicine</Text>
                                </TouchableOpacity>
                            </View>
                            {inventory.length > 0 && (
                                <TextInput
                                    style={[styles.input, { marginBottom: 16 }]}
                                    placeholder="Search by name or category…"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                            )}
                            {filtered.length === 0 ? (
                                <Empty text={inventory.length === 0 ? 'No medicines added yet. Click "+ Add Medicine" to get started.' : 'No matches found.'} />
                            ) : (
                                <FlatList
                                    data={filtered}
                                    keyExtractor={m => m._id}
                                    renderItem={({item: m, index: i}) => (
                                        <View style={styles.tableRow}>
                                            <Text style={{ color: '#94a3b8', fontSize: 12, width: 30 }}>{i + 1}</Text>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{m.name}</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{m.unit || '—'}</Text>
                                            </View>
                                            <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                                                <Text style={{ color: '#475569', fontSize: 11, fontWeight: 'bold' }}>{m.category || 'General'}</Text>
                                            </View>
                                        </View>
                                    )}
                                    scrollEnabled={false}
                                />
                            )}
                        </View>
                    )}

                    {tab === 'add' && (
                        <View style={styles.clinicCard}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 6, color: '#1e293b' }}>+ Add Medicine to List</Text>
                            <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
                                Add medicines your clinic commonly prescribes. Once added, doctors can search and select them instantly while writing prescriptions.
                            </Text>

                            <View style={{ gap: 16 }}>
                                <View>
                                    <Text style={styles.label}>Medicine Name *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Paracetamol 500mg"
                                        value={addForm.name}
                                        onChangeText={t => setAddForm(f => ({ ...f, name: t }))}
                                    />
                                    <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Be specific — include strength if relevant (e.g. "Amoxicillin 250mg")</Text>
                                </View>

                                {/* We use basic Picker or simulated dropdowns. Let's use simple Pickers if available, or just map buttons. To save space, simulated simple Picker: */}
                                <View>
                                    <Text style={styles.label}>Category</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={addForm.category} onValueChange={val => setAddForm(f => ({ ...f, category: val }))} style={{ height: 50, width: '100%' }}>
                                            {CATEGORIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
                                        </Picker>
                                    </View>
                                </View>
                                
                                <View>
                                    <Text style={styles.label}>Unit / Form</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={addForm.unit} onValueChange={val => setAddForm(f => ({ ...f, unit: val }))} style={{ height: 50, width: '100%' }}>
                                            {UNITS.map(u => <Picker.Item key={u} label={u} value={u} />)}
                                        </Picker>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, alignItems: 'center' }]} disabled={adding} onPress={handleAdd}>
                                        <Text style={styles.btnPrimaryText}>{adding ? 'Adding…' : '+ Add to List'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, alignItems: 'center', backgroundColor: '#f1f5f9' }]} onPress={() => { setTab('list'); setAddForm({ name: '', category: 'General', unit: 'Tablets' }); }}>
                                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// TREATMENT PLAN MODE
// ═══════════════════════════════════════════════════
const TreatmentPlanMode = () => {
    const [view, setView] = useState('list');
    const [plans, setPlans] = useState([]);
    const [todayDue, setTodayDue] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [patients, setPatients] = useState([]);
    const [patSearch, setPatSearch] = useState('');
    const [form, setForm] = useState({
        clinicPatientId: '', title: '', description: '',
        totalAmount: '', totalDurationDays: '', startDate: '', intervalDays: '', numberOfVisits: '',
    });
    const [visits, setVisits] = useState([]);

    const [payModal, setPayModal] = useState(null);
    const [payInput, setPayInput] = useState({ amountPaid: '', paymentMethod: 'Cash', notes: '', upiId: 'payments@upi', upiRef: '', confirmedReceipt: false });

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 5000); };

    const getEffectiveStatus = (visit) => {
        if (visit.status === 'completed' || visit.status === 'missed') return visit.status;
        const today = new Date();
        today.setHours(0,0,0,0);
        const sDate = new Date(visit.scheduledDate);
        sDate.setHours(0,0,0,0);
        if (sDate <= today) return 'due';
        return visit.status;
    };

    const loadAll = () => {
        setLoading(true);
        Promise.all([clinicAPI.getTreatmentPlans(), clinicAPI.getTodayDuePlans()])
            .then(([plansR, dueR]) => {
                if (plansR.success) setPlans(plansR.plans);
                if (dueR.success) setTodayDue(dueR.plans);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadAll(); }, []);

    useEffect(() => {
        const n = parseInt(form.numberOfVisits);
        const interval = parseInt(form.intervalDays);
        const start = form.startDate;
        if (!n || !start) return;
        const base = new Date(start);
        setVisits(Array.from({ length: n }, (_, i) => {
            const d = new Date(base);
            d.setDate(d.getDate() + (interval || 0) * i);
            return { visitNumber: i + 1, scheduledDate: d.toISOString().split('T')[0], scheduledTime: '', procedure: '' };
        }));
    }, [form.numberOfVisits, form.intervalDays, form.startDate]);

    useEffect(() => {
        if (view === 'create' && patSearch.length > 1) {
            const delay = setTimeout(() => {
                clinicAPI.getPatients(patSearch).then(r => {
                    if (r.success) setPatients(r.patients || []);
                }).catch(e => console.error(e));
            }, 300);
            return () => clearTimeout(delay);
        }
    }, [patSearch, view]);

    const handleCreateSubmit = async () => {
        if (!form.clinicPatientId || !form.title || !form.totalAmount || !form.totalDurationDays || !form.startDate || !form.numberOfVisits || !form.intervalDays || visits.length === 0)
            return flash('error', 'Please fill in all required fields (marked with *).');
        if (visits.some(v => !v.scheduledDate)) return flash('error', 'All visits must have a scheduled date.');
        setSaving(true);
        try {
            const r = await clinicAPI.createTreatmentPlan({ ...form, visits });
            if (r.success) {
                flash('success', 'Treatment plan created.');
                setPlans(prev => [r.plan, ...prev]);
                setView('list');
                setForm({ clinicPatientId: '', title: '', description: '', totalAmount: '', totalDurationDays: '', startDate: '', intervalDays: '', numberOfVisits: '' });
                setVisits([]);
                setPatSearch('');
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const openDetail = async (plan) => {
        try {
            const r = await clinicAPI.getTreatmentPlan(plan._id);
            if (r.success) { setSelectedPlan(r.plan); setView('detail'); }
        } catch { setSelectedPlan(plan); setView('detail'); }
    };

    const handlePay = async () => {
        if (!payModal) return;
        const paid = Number(payInput.amountPaid) || 0;
        if (paid <= 0) return flash('error', 'Enter a valid amount greater than zero.');
        if (paid > selectedPlan.pendingBalance) return flash('error', 'Payment amount cannot exceed outstanding balance.');

        setSaving(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const payload = {
                amountPaid: paid,
                paymentDate: todayStr,
                paymentMethod: payInput.paymentMethod,
                notes: payInput.notes,
            };
            
            const r = await clinicAPI.payVisit(payModal.planId, payModal.visit._id, payload);
            if (r.success) {
                setSelectedPlan(r.plan);
                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                setPayModal(null);
                flash('success', `₹${paid.toLocaleString('en-IN')} recorded. Remaining balance: ₹${r.plan.pendingBalance.toLocaleString('en-IN')}`);
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const handleComplete = async (planId, visitId) => {
        try {
            const r = await clinicAPI.completeVisit(planId, visitId, {});
            if (r.success) {
                setSelectedPlan(r.plan);
                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                flash('success', r.plan.status === 'completed' ? '🎉 Treatment plan completed!' : 'Visit marked completed.');
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
    };

    const planStatusColor = { active: '#0891b2', completed: '#16a34a', cancelled: '#dc2626' };

    // --- LIST VIEW ---
    if (view === 'list') return (
        <ScrollView style={styles.container}>
            {todayDue.length > 0 && (
                <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontWeight: '800', color: '#92400e', fontSize: 14, marginBottom: 8 }}>🔔 Today's Visits Due</Text>
                    {todayDue.map(plan => plan.visits.filter(v => new Date(v.scheduledDate).toDateString() === new Date().toDateString() && ['scheduled', 'rescheduled'].includes(v.status)).map(v => (
                        <View key={v._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <Text style={{ fontWeight: '700', color: '#78350f', flex: 1 }}>📋 {plan.clinicPatientId?.name} — Visit {v.visitNumber}</Text>
                            <TouchableOpacity onPress={() => openDetail(plan)} style={{ backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>View Plan</Text>
                            </TouchableOpacity>
                        </View>
                    )))}
                </View>
            )}

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>📅 Treatment Plans</Text>
                <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]} onPress={() => { setView('create'); loadAll(); }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>+ New Plan</Text>
                </TouchableOpacity>
            </View>

            {loading ? <Spinner /> : plans.length === 0 ? <Empty text="No treatment plans yet." /> : (
                <View style={{ gap: 12 }}>
                    {plans.map(plan => {
                        const pct = plan.totalAmount > 0 ? Math.min(100, Math.round((plan.totalPaid / plan.totalAmount) * 100)) : 0;
                        return (
                            <TouchableOpacity key={plan._id} style={[styles.clinicCard, { borderLeftWidth: 4, borderLeftColor: planStatusColor[plan.status] || '#94a3b8' }]} onPress={() => openDetail(plan)}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View>
                                        <Text style={{ fontWeight: '800', fontSize: 15, color: '#0f172a' }}>{plan.title}</Text>
                                        <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>👤 {plan.clinicPatientId?.name || '—'}</Text>
                                    </View>
                                    <View style={{ backgroundColor: planStatusColor[plan.status] + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: planStatusColor[plan.status], textTransform: 'uppercase' }}>{plan.status}</Text>
                                    </View>
                                </View>
                                <View style={{ marginTop: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>Paid: <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>₹{plan.totalPaid}</Text> of <Text style={{ fontWeight: 'bold' }}>₹{plan.totalAmount}</Text></Text>
                                        <Text style={{ color: plan.pendingBalance > 0 ? '#dc2626' : '#16a34a', fontWeight: '700', fontSize: 11 }}>
                                            {plan.pendingBalance > 0 ? `₹${plan.pendingBalance} due` : '✓ Fully Paid'}
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: pct === 100 ? '#16a34a' : '#0891b2' }} />
                                    </View>
                                </View>
                                <Text style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>📋 <Text style={{ fontWeight: 'bold' }}>{plan.visits.filter(v => v.status === 'completed').length}</Text>/{plan.visits.length} visits done</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );

    // --- CREATE VIEW ---
    if (view === 'create') return (
        <ScrollView style={styles.container}>
            <TouchableOpacity onPress={() => setView('list')} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>← Back to Plans</Text>
            </TouchableOpacity>
            
            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            <View style={styles.clinicCard}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 }}>📅 New Treatment Plan</Text>

                <View style={{ gap: 16 }}>
                    <View style={{ zIndex: 50 }}>
                        <Text style={styles.label}>Patient *</Text>
                        {!form.clinicPatientId ? (
                            <TextInput style={styles.input} placeholder="Search patient..." value={patSearch} onChangeText={setPatSearch} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10 }}>
                                <Text style={{ marginRight: 8 }}>👤</Text>
                                <Text style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>{patSearch}</Text>
                                <TouchableOpacity onPress={() => { setForm(f => ({ ...f, clinicPatientId: '' })); setPatSearch(''); }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {patSearch.trim().length > 0 && patients.length > 0 && !form.clinicPatientId && (
                            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 160, position: 'absolute', top: 60, left: 0, right: 0, zIndex: 100 }}>
                                <ScrollView nestedScrollEnabled>
                                    {patients.map(p => (
                                        <TouchableOpacity key={p._id} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' }} onPress={() => { setForm(f => ({ ...f, clinicPatientId: p._id })); setPatSearch(p.name); setPatients([]); }}>
                                            <Text style={{ fontSize: 13 }}><Text style={{ fontWeight: 'bold' }}>{p.name}</Text> · {p.phone || ''}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    <View>
                        <Text style={styles.label}>Plan Title *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Root Canal" value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} />
                    </View>

                    <View>
                        <Text style={styles.label}>Description / Notes</Text>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline maxLength={500} placeholder="Brief description..." value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} />
                    </View>

                    <View>
                        <Text style={styles.label}>💰 Total Treatment Amount (₹) *</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 5000" value={form.totalAmount} onChangeText={t => setForm(f => ({ ...f, totalAmount: t }))} />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Number of Visits *</Text>
                            <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 5" value={form.numberOfVisits} onChangeText={val => setForm(f => { const n = parseInt(val) || 0; const i = parseInt(f.intervalDays) || 0; return { ...f, numberOfVisits: val, totalDurationDays: String(n > 1 ? (n - 1) * i : 0) }; })} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Interval (days) *</Text>
                            <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 3" value={form.intervalDays} onChangeText={val => setForm(f => { const i = parseInt(val) || 0; const n = parseInt(f.numberOfVisits) || 0; return { ...f, intervalDays: val, totalDurationDays: String(n > 1 ? (n - 1) * i : 0) }; })} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Start Date *</Text>
                            <MobileDatePicker style={styles.input} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Total Duration (days)</Text>
                            <TextInput style={[styles.input, { backgroundColor: '#e2e8f0', color: '#64748b' }]} editable={false} value={form.totalDurationDays} />
                        </View>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center' }]} onPress={() => setView('list')}>
                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnPrimary, { flex: 2, alignItems: 'center' }]} disabled={saving} onPress={handleCreateSubmit}>
                        <Text style={styles.btnPrimaryText}>{saving ? 'Creating...' : '✅ Create Treatment Plan'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );

    // --- DETAIL VIEW ---
    if (view === 'detail' && selectedPlan) {
        return (
            <ScrollView style={styles.container}>
                <TouchableOpacity onPress={() => setView('list')} style={{ marginBottom: 12 }}>
                    <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>← Back to Plans</Text>
                </TouchableOpacity>
                
                {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

                <View style={styles.clinicCard}>
                    <View style={{ marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>{selectedPlan.title}</Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {selectedPlan.clinicPatientId?.name}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Total Amount', value: '₹' + selectedPlan.totalAmount, color: '#6366f1' },
                            { label: 'Total Paid', value: '₹' + selectedPlan.totalPaid, color: '#16a34a' },
                            { label: 'Balance Due', value: selectedPlan.pendingBalance > 0 ? '₹' + selectedPlan.pendingBalance : '✓ Cleared', color: selectedPlan.pendingBalance > 0 ? '#dc2626' : '#16a34a' },
                        ].map((s, i) => (
                            <View key={i} style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, borderTopWidth: 3, borderTopColor: s.color, minWidth: '30%', flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: s.color }}>{s.value}</Text>
                                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 }}>Visit Schedule</Text>
                    <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        {selectedPlan.visits.map((v, idx) => {
                            const effStatus = getEffectiveStatus(v);
                            return (
                                <View key={v._id} style={{ padding: 12, borderBottomWidth: idx < selectedPlan.visits.length - 1 ? 1 : 0, borderColor: '#f1f5f9', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#6366f1' }}>Visit {v.visitNumber} <Text style={{ color: '#1e293b' }}>· {new Date(v.scheduledDate).toLocaleDateString('en-IN')}</Text></Text>
                                        <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{effStatus}</Text>
                                        </View>
                                    </View>
                                    {v.procedure ? <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{v.procedure}</Text> : null}
                                    
                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                        {selectedPlan.status === 'active' && !['completed', 'missed'].includes(v.status) && (
                                            <>
                                                {selectedPlan.pendingBalance > 0 && v.amountPaid === 0 && (
                                                    <TouchableOpacity style={{ backgroundColor: '#dcfce7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }} onPress={() => { setPayModal({ visit: v, planId: selectedPlan._id }); }}>
                                                        <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: 'bold' }}>💵 Pay</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity style={{ backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }} onPress={() => handleComplete(selectedPlan._id, v._id)}>
                                                    <Text style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 'bold' }}>✓ Done</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        {v.amountPaid > 0 && <Text style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 12, alignSelf: 'center' }}>Paid ₹{v.amountPaid}</Text>}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Simplified Payment Modal */}
                {payModal && (
                    <Modal transparent visible animationType="fade">
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                            <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 400 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Record Payment</Text>
                                <Text style={styles.label}>Amount Paying Now (₹) *</Text>
                                <TextInput style={[styles.input, { marginBottom: 16 }]} keyboardType="numeric" value={payInput.amountPaid} onChangeText={t => setPayInput(p => ({ ...p, amountPaid: t }))} />
                                
                                <Text style={styles.label}>Payment Method</Text>
                                <View style={[styles.pickerWrapper, { marginBottom: 16 }]}>
                                    <Picker selectedValue={payInput.paymentMethod} onValueChange={val => setPayInput(p => ({ ...p, paymentMethod: val }))}>
                                        <Picker.Item label="Cash" value="Cash" />
                                        <Picker.Item label="UPI" value="UPI" />
                                    </Picker>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center' }]} onPress={() => setPayModal(null)}>
                                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, alignItems: 'center' }]} disabled={saving} onPress={handlePay}>
                                        <Text style={styles.btnPrimaryText}>Confirm</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </ScrollView>
        );
    }
    return null;
};

// ═══════════════════════════════════════════════════
// BILLING MODE
// ═══════════════════════════════════════════════════
const BillingMode = () => {
    const [allRecords, setAllRecords] = useState([]);
    const [displayRecords, setDisplayRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [patSearch, setPatSearch] = useState('');

    useEffect(() => {
        Promise.all([clinicAPI.getAppointments(), clinicAPI.getTreatmentPlans(), clinicAPI.getStats()])
        .then(([apptR, plansR, statsR]) => {
            let combined = [];
            if (apptR.success && Array.isArray(apptR.appointments)) {
                apptR.appointments.filter(a => a.paymentStatus === 'paid' || a.amount > 0).forEach(a => {
                    combined.push({
                        _id: a._id, date: a.appointmentDate, tokenOrSlot: a.tokenNumber ? `#${a.tokenNumber}` : 'Token',
                        patientName: a.clinicPatientId?.name || '—', patientUid: a.clinicPatientId?.patientUid || a.patientId || '—',
                        serviceName: a.serviceName || 'General Consultation', amount: a.amount || 0, pendingAmount: 0,
                        paymentMethod: a.paymentMethod || 'Cash', status: a.status || 'completed', type: 'consultation', rawRecord: a
                    });
                });
            }
            if (plansR.success && Array.isArray(plansR.plans)) {
                plansR.plans.forEach(plan => {
                    if (Array.isArray(plan.visits)) {
                        plan.visits.filter(v => v.amountPaid > 0).forEach((v, idx) => {
                            combined.push({
                                _id: `${plan._id}_v${v._id || idx}`, date: v.paidAt || v.completedAt || plan.createdAt,
                                tokenOrSlot: `Plan: ${plan.title}`, patientName: plan.clinicPatientId?.name || '—',
                                patientUid: plan.clinicPatientId?.patientUid || '—', serviceName: `Treatment Plan (Visit ${v.visitNumber})`,
                                amount: v.amountPaid, pendingAmount: plan.pendingBalance || 0, paymentMethod: v.paymentMethod || 'Cash',
                                status: 'completed', type: 'treatment_plan'
                            });
                        });
                    }
                });
            }
            combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            setAllRecords(combined); setDisplayRecords(combined);
            if (statsR.success) setStats(statsR.stats);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const filterByPatient = () => {
        if (!patSearch.trim()) { setDisplayRecords(allRecords); return; }
        const q = patSearch.trim().toLowerCase();
        setDisplayRecords(allRecords.filter(r => (r.patientName || '').toLowerCase().includes(q) || (r.serviceName || '').toLowerCase().includes(q)));
    };

    return (
        <ScrollView style={styles.container}>
            {stats && (
                <View style={styles.kpiGrid}>
                    <View style={[styles.kpiCard, { borderTopColor: '#f59e0b' }]}>
                        <Text style={{ fontSize: 24 }}>💰</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#f59e0b' }}>₹{stats.totalRevenue || 0}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>Total Collection</Text>
                    </View>
                    <View style={[styles.kpiCard, { borderTopColor: '#10b981' }]}>
                        <Text style={{ fontSize: 24 }}>📅</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#10b981' }}>₹{stats.todayRevenue || 0}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>Today's Collection</Text>
                    </View>
                </View>
            )}

            <View style={styles.clinicCard}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 14, color: '#1e293b' }}>🧾 Billing Records</Text>
                
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="Search patient..." value={patSearch} onChangeText={setPatSearch} />
                    <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 16, paddingVertical: 12 }]} onPress={filterByPatient}>
                        <Text style={styles.btnPrimaryText}>Search</Text>
                    </TouchableOpacity>
                </View>

                {loading ? <Spinner /> : displayRecords.length === 0 ? <Empty text="No records found." /> : (
                    <FlatList
                        data={displayRecords}
                        keyExtractor={r => r._id}
                        renderItem={({item: r}) => (
                            <View style={[styles.tableRow, { flexWrap: 'wrap' }]}>
                                <View style={{ flex: 1, minWidth: '40%' }}>
                                    <Text style={{ fontWeight: 'bold', color: '#1e293b' }}>{r.patientName}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748b' }}>{new Date(r.date).toLocaleDateString('en-IN')} · {r.serviceName}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', minWidth: '30%' }}>
                                    <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 15 }}>₹{r.amount}</Text>
                                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                                        <Text style={{ fontSize: 10, color: '#475569', fontWeight: 'bold' }}>{r.paymentMethod}</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                        scrollEnabled={false}
                    />
                )}
            </View>
        </ScrollView>
    );
};

// ─────────────────────────────────────────────
// Small shared components
// ─────────────────────────────────────────────
const Spinner = ({ text = 'Loading...' }) => (
    <View style={{ padding: 40, alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{text}</Text>
    </View>
);

const Empty = ({ text }) => (
    <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{text}</Text>
    </View>
);

const StatusBadge = ({ status }) => {
    const map = {
        pending: { bg: '#fef9c3', color: '#854d0e' },
        confirmed: { bg: '#dbeafe', color: '#1d4ed8' },
        completed: { bg: '#dcfce7', color: '#16a34a' },
        cancelled: { bg: '#fee2e2', color: '#dc2626' },
    };
    const s = map[status] || { bg: '#f1f5f9', color: '#64748b' };
    return (
        <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
            <Text style={{ color: s.color, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>{status}</Text>
        </View>
    );
};

const PayBadge = ({ status }) => {
    const color = status === 'paid' ? '#16a34a' : status === 'refunded' ? '#0ea5e9' : '#dc2626';
    return <Text style={{ color, fontWeight: 'bold', fontSize: 12 }}>{status}</Text>;
};

const PatientReportPanel = ({ patientId, patientName }) => {
    return (
        <View style={{ padding: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>📄 Patient Reports</Text>
            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Reports for {patientName} would load here.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    roleSwitcher: { backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0' },
    switcherLabel: { fontWeight: 'bold', marginRight: 10, color: '#475569' },
    switcherScroll: { flexGrow: 0 },
    switcherButtons: { flexDirection: 'row', gap: 8 },
    switcherBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    switcherBtnText: { marginLeft: 4, fontWeight: '600', fontSize: 13, color: '#475569' },
    switcherUser: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 8 },
    switcherAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    switcherAvatarText: { color: '#fff', fontWeight: 'bold' },
    switcherUserName: { fontWeight: 'bold', color: '#1e293b' },
    downloadAlert: { margin: 16, padding: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 12 },
    downloadAlertText: { color: '#065f46', fontWeight: 'bold' },
    modeContent: { flex: 1, padding: 16 },
    
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
    kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 12, borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    kpiToggleBtn: { alignSelf: 'center', marginVertical: 12, padding: 8 },
    kpiToggleText: { color: '#6366f1', fontWeight: 'bold' },
    
    clinicCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
    dropdownBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f1f5f9', borderRadius: 6 },
    dropdownMenu: { position: 'absolute', right: 16, top: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, zIndex: 10, elevation: 5 },
    dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    tableRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
    th: { fontWeight: 'bold', color: '#64748b', fontSize: 12 },
    td: { fontSize: 13, color: '#1e293b' },
    
    label: { fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 'bold' },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14 },
    pickerWrapper: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
    btnPrimary: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    btnPrimaryText: { color: '#fff', fontWeight: 'bold' },
});

export default ClinicDashboard;
