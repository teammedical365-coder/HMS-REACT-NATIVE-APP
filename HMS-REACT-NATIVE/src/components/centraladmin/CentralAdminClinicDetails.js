import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    TextInput,
    Alert,
    ScrollView,
    Platform,
    useWindowDimensions,
    Linking,
    Modal
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Rect, G } from 'react-native-svg';
import { simpleClinicAPI } from '../../utils/api';

const CentralAdminClinicDetails = ({ clinic, onBack, onDeleteSuccess }) => {
    const clinicId = clinic?._id || clinic?.id;
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    // States
    const [loadingStats, setLoadingStats] = useState(true);
    const [clinicStats, setClinicStats] = useState(null);
    const [clinicSubscriptions, setClinicSubscriptions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Appointment Mode
    const [clinicApptMode, setClinicApptMode] = useState(clinic?.appointmentMode || 'token');
    const [savingApptMode, setSavingApptMode] = useState(false);

    // Admin Account Form
    const [showManagerForm, setShowManagerForm] = useState(false);
    const [managerForm, setManagerForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        age: '',
        aadhaarNumber: ''
    });
    const [savingManager, setSavingManager] = useState(false);

    // Staff Account Form
    const [showStaffForm, setShowStaffForm] = useState(false);
    const [staffForm, setStaffForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        age: '',
        aadhaarNumber: '',
        staffRole: 'doctor'
    });
    const [savingStaff, setSavingStaff] = useState(false);

    // Billing / Rate Form
    const [rateForm, setRateForm] = useState({
        ratePerPatient: clinic?.subscription?.ratePerPatient !== undefined ? String(clinic.subscription.ratePerPatient) : '',
        billingEnabled: Boolean(clinic?.subscription?.billingEnabled)
    });
    const [savingRate, setSavingRate] = useState(false);

    // Delete Clinic Confirm Modal
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletingClinic, setDeletingClinic] = useState(false);

    const getBaseHost = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            let host = window.location.host;
            if (host.startsWith('www.')) host = host.replace('www.', '');
            const parts = host.split('.');
            if (parts.length > 2 && !host.includes('localhost')) {
                host = parts.slice(-2).join('.');
            } else if (host.includes('localhost')) {
                const port = window.location.port ? `:${window.location.port}` : '';
                host = `localhost${port}`;
            }
            return host;
        }
        return 'teammedical365.com';
    };

    const formatCurrency = (amount) => '₹' + Number(amount || 0).toLocaleString('en-IN');

    // Load Clinic Details and Statistics
    const loadClinicData = useCallback(async () => {
        if (!clinicId) return;
        setLoadingStats(true);
        setError('');
        try {
            const [statsRes, subRes] = await Promise.all([
                simpleClinicAPI.getStats(clinicId),
                simpleClinicAPI.getSubscriptions(clinicId)
            ]);

            if (statsRes && statsRes.success) {
                setClinicStats(statsRes);
                if (statsRes.clinic) {
                    setClinicApptMode(statsRes.clinic.appointmentMode || 'token');
                    setRateForm({
                        ratePerPatient: String(statsRes.clinic.subscription?.ratePerPatient ?? ''),
                        billingEnabled: Boolean(statsRes.clinic.subscription?.billingEnabled)
                    });
                }
            } else {
                setError(statsRes?.message || 'Failed to load clinic statistics');
            }

            if (subRes && subRes.success) {
                setClinicSubscriptions(Array.isArray(subRes.subscriptions) ? subRes.subscriptions : []);
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                setError('No operations data found for this clinic');
            } else {
                console.error('Error fetching clinic operations data:', err);
                setError(err?.response?.data?.message || 'Failed to communicate with clinic server');
            }
        } finally {
            setLoadingStats(false);
        }
    }, [clinicId]);

    useEffect(() => {
        loadClinicData();
    }, [loadClinicData]);

    // Handle Appointment Mode Change
    const handleSaveApptMode = async () => {
        setSavingApptMode(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.updateAppointmentMode(clinicId, clinicApptMode);
            if (res && res.success) {
                setSuccess(`Appointment mode set to "${clinicApptMode === 'token' ? 'Token Queue' : 'Time Slot'}" for ${clinicObj.name || 'clinic'}`);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to update appointment mode');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating appointment mode');
        } finally {
            setSavingApptMode(false);
        }
    };

    // Handle Billing Rate Save
    const handleSaveRate = async () => {
        setSavingRate(true);
        setError('');
        setSuccess('');
        try {
            const payload = {
                ratePerPatient: Number(rateForm.ratePerPatient || 0),
                billingEnabled: Boolean(rateForm.billingEnabled)
            };
            const res = await simpleClinicAPI.setRate(clinicId, payload);
            if (res && res.success) {
                setSuccess('Billing rate updated successfully');
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to save billing rate');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating billing rate');
        } finally {
            setSavingRate(false);
        }
    };

    // Handle Mark Subscription Paid / Waived
    const handleUpdateSubscription = async (subId, status) => {
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.updateSubscription(clinicId, subId, { status });
            if (res && res.success) {
                setClinicSubscriptions(prev => prev.map(s => s._id === subId ? (res.subscription || { ...s, status }) : s));
                setSuccess(`Month marked as ${status}`);
            } else {
                setError(res?.message || `Failed to update status to ${status}`);
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating subscription');
        }
    };

    // Handle Create Clinic Manager / Admin
    const handleCreateManager = async () => {
        if (!managerForm.name.trim() || !managerForm.email.trim() || !managerForm.password.trim()) {
            Alert.alert('Required Fields', 'Please enter Name, Email, and Password');
            return;
        }
        if (managerForm.phone && managerForm.phone.length !== 10) {
            Alert.alert('Validation', 'Phone number must be exactly 10 digits');
            return;
        }
        if (managerForm.aadhaarNumber && managerForm.aadhaarNumber.length !== 12) {
            Alert.alert('Validation', 'Aadhaar number must be exactly 12 digits');
            return;
        }
        setSavingManager(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.createManager(clinicId, managerForm);
            if (res && res.success) {
                setSuccess(`Admin created! ${res.manager?.name || managerForm.name} can now login at /login with email: ${res.manager?.email || managerForm.email}`);
                setManagerForm({ name: '', email: '', password: '', phone: '', age: '', aadhaarNumber: '' });
                setShowManagerForm(false);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to create clinic manager');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error creating clinic admin');
        } finally {
            setSavingManager(false);
        }
    };

    // Handle Create Clinic Staff
    const handleCreateStaff = async () => {
        if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.password.trim()) {
            Alert.alert('Required Fields', 'Please enter Name, Email, and Password');
            return;
        }
        if (staffForm.phone && staffForm.phone.length !== 10) {
            Alert.alert('Validation', 'Phone number must be exactly 10 digits');
            return;
        }
        if (staffForm.aadhaarNumber && staffForm.aadhaarNumber.length !== 12) {
            Alert.alert('Validation', 'Aadhaar number must be exactly 12 digits');
            return;
        }
        setSavingStaff(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.createStaff(clinicId, staffForm);
            if (res && res.success) {
                setSuccess('Staff member added!');
                setStaffForm({ name: '', email: '', password: '', phone: '', age: '', aadhaarNumber: '', staffRole: 'doctor' });
                setShowStaffForm(false);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to add staff member');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error adding staff');
        } finally {
            setSavingStaff(false);
        }
    };

    // Handle Delete Staff
    const handleDeleteStaff = (staffId, staffName) => {
        Alert.alert(
            'Remove Staff',
            `Are you sure you want to remove ${staffName || 'this staff member'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await simpleClinicAPI.deleteStaff(clinicId, staffId);
                            if (res && res.success) {
                                setSuccess('Staff removed.');
                                loadClinicData();
                            } else {
                                setError(res?.message || 'Failed to delete staff member');
                            }
                        } catch (err) {
                            setError(err?.response?.data?.message || err.message || 'Error removing staff');
                        }
                    }
                }
            ]
        );
    };

    // Handle Delete Simple Clinic
    const handleDeleteClinic = async () => {
        setDeletingClinic(true);
        try {
            const res = await simpleClinicAPI.deleteClinic(clinicId);
            if (res && res.success) {
                setDeleteModalVisible(false);
                if (onDeleteSuccess) {
                    onDeleteSuccess();
                } else if (onBack) {
                    onBack();
                }
            } else {
                setError(res?.message || 'Failed to delete clinic');
                setDeleteModalVisible(false);
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error deleting clinic');
            setDeleteModalVisible(false);
        } finally {
            setDeletingClinic(false);
        }
    };

    const stats = clinicStats?.stats || {};
    const clinicObj = clinicStats?.clinic || clinic;
    const adminUser = clinicObj?.adminUserId;
    const staffList = stats?.staff || [];
    const recentAppointments = stats?.recentAppointments || [];

    // Starter plan limits logic matching Web line 2424 & 2533
    const isStarter = clinicObj?.subscriptionPlan === 'starter' || clinicObj?.clinicPlan === 'starter' || true;
    const hasAdmin = Boolean(adminUser);
    const disableAdminBtn = isStarter && hasAdmin && !showManagerForm;
    const totalUsers = staffList.length;
    const disableStaffBtn = isStarter && totalUsers >= 2 && !showStaffForm;

    const doctorCount = staffList.filter(s => {
        const r = (s.role || '').toLowerCase();
        return r === 'doctor' || r === 'clinic doctor';
    }).length;
    const adminCount = staffList.filter(s => {
        const r = (s.role || '').toLowerCase();
        return r === 'hospitaladmin' || r === 'clinic admin';
    }).length;

    return (
        <ScrollView 
            style={styles.container} 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
        >
            {/* ====== NOTIFICATIONS ====== */}
            {Boolean(error) && (
                <View style={styles.errorAlert}>
                    <Text style={styles.errorAlertIcon}>⚠️</Text>
                    <Text style={styles.errorAlertText}>{error}</Text>
                </View>
            )}
            {Boolean(success) && (
                <View style={styles.successAlert}>
                    <Text style={styles.successAlertIcon}>✅</Text>
                    <Text style={styles.successAlertText}>{success}</Text>
                </View>
            )}

            {/* ====== 1. CLINIC PROFILE HERO HEADER BANNER (EXACT WEB PARITY) ====== */}
            <View style={styles.heroBanner}>
                {/* Left Organic Deep Blue / Indigo Wave Background (Desktop/Tablet) */}
                {!isMobile && (
                    <View style={styles.heroWaves}>
                        <Svg style={styles.heroWaveSvg} viewBox="0 0 280 280" preserveAspectRatio="none">
                            <Defs>
                                <SvgLinearGradient id="heroBlueDeepClinic" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#081038" />
                                    <Stop offset="28%" stopColor="#131e5c" />
                                    <Stop offset="55%" stopColor="#2e1a6b" />
                                    <Stop offset="78%" stopColor="#4c1d95" />
                                    <Stop offset="100%" stopColor="#6366f1" />
                                </SvgLinearGradient>
                                <SvgLinearGradient id="heroBlueEdgeClinic" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#38bdf8" />
                                    <Stop offset="45%" stopColor="#818cf8" />
                                    <Stop offset="80%" stopColor="#a855f7" />
                                    <Stop offset="100%" stopColor="#c084fc" />
                                </SvgLinearGradient>
                            </Defs>
                            <Path d="M0 0 L265 0 C215 55 225 120 185 180 C145 230 100 280 0 280 Z" fill="url(#heroBlueDeepClinic)" />
                            <Path d="M265 0 C215 55 225 120 185 180 C145 230 100 280 0 280" fill="none" stroke="url(#heroBlueEdgeClinic)" strokeWidth="3.5" strokeOpacity="0.95" />
                        </Svg>
                        {/* Bottom Left Dot Matrix */}
                        <View style={styles.heroDarkDotMatrix}>
                            {Array.from({ length: 16 }).map((_, i) => (
                                <View key={i} style={styles.heroMatrixDot} />
                            ))}
                        </View>
                    </View>
                )}

                {/* Top Row: Left "Clinic Profile" Badge + Right Compact "← Back" Button */}
                <View style={styles.heroTopRow}>
                    <View style={styles.clinicBadge}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="#38bdf8">
                            <Path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
                            <Path d="M9 12l2 2 4-4" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.clinicBadgeText}>Clinic Profile</Text>
                    </View>

                    <Pressable
                        onPress={onBack}
                        style={({ pressed, hovered }) => [
                            styles.topBackBtn,
                            Platform.select({ web: { transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' } }),
                            hovered && {
                                backgroundColor: '#2563eb',
                                borderColor: '#93c5fd',
                                transform: [{ translateY: -1 }]
                            },
                            pressed && { transform: [{ scale: 0.97 }] }
                        ]}
                    >
                        <Text style={styles.topBackArrow}>←</Text>
                        <Text style={styles.topBackText}>Back</Text>
                    </Pressable>
                </View>

                {/* Main Hero Upper Content */}
                <View style={[styles.heroContent, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
                    {/* 3D Hexagon Clinic Logo with Orbital Planetary Rings */}
                    <View style={styles.hexLogoContainer}>
                        <View style={styles.hexOrbitRing} />
                        <View style={[styles.hexOrbitNode, styles.nodeA]} />
                        <View style={[styles.hexOrbitNode, styles.nodeB]} />
                        <View style={[styles.hexOrbitNode, styles.nodeC]} />

                        <View style={styles.hexOuter}>
                            <View style={styles.hexInner}>
                                <View style={styles.redCrossBox}>
                                    <View style={styles.crossArmH} />
                                    <View style={styles.crossArmV} />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Center Clinic Info */}
                    <View style={styles.heroInfo}>
                        {/* Top 5x4 Dot Matrix */}
                        <View style={styles.centerDotMatrix}>
                            {Array.from({ length: 20 }).map((_, i) => (
                                <View key={i} style={styles.centerMatrixDot} />
                            ))}
                        </View>

                        {/* Title */}
                        <Text style={styles.heroTitle}>{clinicObj.name || 'Sharma Clinic'}</Text>

                        {/* Progress Underline Accent Bar */}
                        <View style={styles.heroAccentBar}>
                            <View style={styles.accentBarFill} />
                            <View style={styles.accentBarDot} />
                        </View>

                        {/* Meta Pills: Location, Phone & Subdomain */}
                        <View style={styles.heroMetaRow}>
                            <View style={styles.metaChip}>
                                <View style={[styles.metaChipIcon, styles.pinIcon]}>
                                    <Feather name="map-pin" size={11} color="#4f46e5" />
                                </View>
                                <Text style={styles.metaChipText}>
                                    {clinicObj.city ? `${clinicObj.city}${clinicObj.state ? `, ${clinicObj.state}` : ''}` : (clinicObj.address || 'Jaipur, Rajasthan')}
                                </Text>
                            </View>

                            <View style={styles.metaSep} />

                            <View style={styles.metaChip}>
                                <View style={[styles.metaChipIcon, styles.phoneIcon]}>
                                    <Feather name="phone" size={11} color="#0d9488" />
                                </View>
                                <Text style={styles.metaChipText}>
                                    {clinicObj.phone || '9571168462'}
                                </Text>
                            </View>

                            {Boolean(clinicObj.slug) && (
                                <>
                                    <View style={styles.metaSep} />
                                    <Pressable
                                        style={[styles.metaChip, styles.slugChip]}
                                        onPress={() => {
                                            const url = `http://${clinicObj.slug}.${getBaseHost()}`;
                                            Linking.openURL(url).catch(e => console.log('Cannot open URL:', e));
                                        }}
                                    >
                                        <View style={[styles.metaChipIcon, styles.slugIcon]}>
                                            <Feather name="link" size={11} color="#0d9488" />
                                        </View>
                                        <Text style={styles.slugLinkText}>
                                            {clinicObj.slug}.{getBaseHost()}
                                        </Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Right: Animated ECG Heartbeat Wave SVG Widget (Desktop/Tablet) */}
                    {!isMobile && (
                        <View style={styles.heroRightCol}>
                            <View style={styles.heroEcgWidget}>
                                <Svg style={styles.heroEcgSvg} viewBox="0 0 230 76" fill="none">
                                    <Defs>
                                        <SvgLinearGradient id="ecgClinicLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <Stop offset="0%" stopColor="#38bdf8" />
                                            <Stop offset="45%" stopColor="#0284c7" />
                                            <Stop offset="85%" stopColor="#2563eb" />
                                            <Stop offset="100%" stopColor="#10b981" />
                                        </SvgLinearGradient>
                                    </Defs>
                                    <Path
                                        d="M 12 40 H 42 L 48 34 L 54 44 L 66 10 L 76 68 L 83 38 L 89 43 L 130 40 L 138 52 L 148 18 L 158 55 L 164 40 L 198 40"
                                        stroke="#e0f2fe"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <Path
                                        d="M 12 40 H 42 L 48 34 L 54 44 L 66 10 L 76 68 L 83 38 L 89 43 L 130 40 L 138 52 L 148 18 L 158 55 L 164 40 L 198 40"
                                        stroke="url(#ecgClinicLineGrad)"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <G transform="translate(198, 40)">
                                        <Circle cx="0" cy="0" r="10" stroke="#10b981" strokeWidth="1" fill="none" opacity="0.6" />
                                        <Circle cx="0" cy="0" r="7" fill="#a7f3d0" fillOpacity="0.75" />
                                        <Circle cx="0" cy="0" r="4.5" fill="#10b981" />
                                        <Circle cx="-1" cy="-1" r="1.5" fill="#ffffff" />
                                    </G>
                                </Svg>
                            </View>
                        </View>
                    )}
                </View>

                {/* Bottom Floating Stats & Real-time Status Bar */}
                <View style={[styles.heroBottomBar, isMobile && { width: '100%', minWidth: 0, paddingHorizontal: 12 }]}>
                    <View style={styles.bottomStatItem}>
                        <View style={[styles.bottomStatIcon, styles.iconShield]}>
                            <Feather name="shield" size={13} color="#6366f1" />
                        </View>
                        <View style={styles.bottomStatText}>
                            <Text style={styles.bottomStatLabel}>Trusted Care</Text>
                            <Text style={styles.bottomStatVal}>24/7</Text>
                        </View>
                    </View>

                    <View style={styles.bottomStatSep} />

                    <View style={styles.bottomStatItem}>
                        <View style={[styles.bottomStatIcon, styles.iconDoctors]}>
                            <MaterialCommunityIcons name="doctor" size={14} color="#0d9488" />
                        </View>
                        <View style={styles.bottomStatText}>
                            <Text style={styles.bottomStatLabel}>Staff Members</Text>
                            <Text style={styles.bottomStatVal}>{staffList.length}</Text>
                        </View>
                    </View>

                    <View style={styles.bottomStatRight}>
                        <View style={[styles.statusCapsule, clinicObj.isActive === false ? styles.capsuleInactive : styles.capsuleActive]}>
                            <View style={[styles.liveDot, clinicObj.isActive === false && { backgroundColor: '#ef4444' }]} />
                            <Text style={[styles.statusCapsuleText, clinicObj.isActive === false && { color: '#b91c1c' }]}>
                                {clinicObj.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                            </Text>
                            <View style={styles.capsuleEcgWrap}>
                                <Svg viewBox="0 0 60 24" style={{ width: 36, height: 14 }}>
                                    <Path
                                        d="M0 12 L15 12 L20 4 L25 20 L30 8 L35 16 L40 12 L60 12"
                                        stroke={clinicObj.isActive === false ? '#ef4444' : '#16a34a'}
                                        strokeWidth="2"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* ====== 2. KPI CARDS GRID (EXACT WEB PARITY - 5 LIGHT COLORFUL CARDS) ====== */}
            {loadingStats && !clinicStats ? (
                <View style={styles.loadingHudCard}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingHudTitle}>Synchronizing Clinic Intelligence...</Text>
                    <Text style={styles.loadingHudSub}>
                        Aggregating Real-Time Doctor Schedule, Patient Queue & Subscription Billing...
                    </Text>
                </View>
            ) : (
                <View>
                    <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
                        {/* 1. Total Patients (Blue) */}
                        <View style={[styles.kpiCard, styles.kpiCardBlue, isMobile && styles.kpiCardHalf]}>
                            <View style={[styles.kpiIconWrap, styles.kpiIconBlue]}>
                                <Feather name="users" size={17} color="#0284c7" />
                            </View>
                            <Text style={[styles.kpiVal, { color: '#075985' }]}>{stats.totalPatients ?? 0}</Text>
                            <Text style={[styles.kpiLbl, { color: '#0369a1' }]}>Total Patients</Text>
                            <Text style={[styles.kpiSub, { color: '#0284c7' }]}>Registered patients</Text>
                            <View style={[styles.kpiBottomBar, { backgroundColor: '#0284c7' }]} />
                        </View>

                        {/* 2. Total Appointments (Purple) */}
                        <View style={[styles.kpiCard, styles.kpiCardPurple, isMobile && styles.kpiCardHalf]}>
                            <View style={[styles.kpiIconWrap, styles.kpiIconPurple]}>
                                <Feather name="calendar" size={17} color="#7c3aed" />
                            </View>
                            <Text style={[styles.kpiVal, { color: '#581c87' }]}>{stats.totalAppointments ?? 0}</Text>
                            <Text style={[styles.kpiLbl, { color: '#6b21a8' }]}>Total Appointments</Text>
                            <Text style={[styles.kpiSub, { color: '#7c3aed' }]}>Booked consultations</Text>
                            <View style={[styles.kpiBottomBar, { backgroundColor: '#7c3aed' }]} />
                        </View>

                        {/* 3. Completed (Green) */}
                        <View style={[styles.kpiCard, styles.kpiCardGreen, isMobile && styles.kpiCardHalf]}>
                            <View style={[styles.kpiIconWrap, styles.kpiIconGreen]}>
                                <Feather name="check-circle" size={17} color="#16a34a" />
                            </View>
                            <Text style={[styles.kpiVal, { color: '#065f46' }]}>{stats.completedAppointments ?? 0}</Text>
                            <Text style={[styles.kpiLbl, { color: '#166534' }]}>Completed</Text>
                            <Text style={[styles.kpiSub, { color: '#15803d' }]}>Finished visits</Text>
                            <View style={[styles.kpiBottomBar, { backgroundColor: '#10b981' }]} />
                        </View>

                        {/* 4. Revenue (Orange) */}
                        <View style={[styles.kpiCard, styles.kpiCardOrange, isMobile && styles.kpiCardHalf]}>
                            <View style={[styles.kpiIconWrap, styles.kpiIconOrange]}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#d97706' }}>₹</Text>
                            </View>
                            <Text style={[styles.kpiVal, { color: '#78350f' }]}>{formatCurrency(stats.revenue ?? 0)}</Text>
                            <Text style={[styles.kpiLbl, { color: '#92400e' }]}>Revenue</Text>
                            <Text style={[styles.kpiSub, { color: '#b45309' }]}>From paid visits</Text>
                            <View style={[styles.kpiBottomBar, { backgroundColor: '#f59e0b' }]} />
                        </View>

                        {/* 5. Staff Members (Purple/Violet - Exact Web 5th Card) */}
                        <View style={[styles.kpiCard, styles.kpiCardPurple, isMobile && styles.kpiCardFull]}>
                            <View style={[styles.kpiIconWrap, styles.kpiIconPurple]}>
                                <MaterialCommunityIcons name="doctor" size={17} color="#7c3aed" />
                            </View>
                            <Text style={[styles.kpiVal, { color: '#581c87' }]}>{staffList.length}</Text>
                            <Text style={[styles.kpiLbl, { color: '#6b21a8' }]}>Staff Members</Text>
                            <Text style={[styles.kpiSub, { color: '#7c3aed' }]}>Doctors & Reception</Text>
                            <View style={[styles.kpiBottomBar, { backgroundColor: '#7c3aed' }]} />
                        </View>
                    </View>

                    {/* ====== 3. CLINIC ADMIN ACCOUNT CARD (EXACT WEB PARITY) ====== */}
                    <View style={[styles.adminCard, { borderColor: '#e0e7ff', borderWidth: 2 }]}>
                        <View style={[styles.cardHeaderFlex, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>👤 Clinic Admin Account</Text>
                                <Text style={styles.cardSub}>
                                    The admin has full access to this clinic. Login at <Text style={{ fontWeight: '700', color: '#1e293b' }}>/login</Text>
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.btnActionPrimary,
                                    showManagerForm && styles.btnActionCancel,
                                    disableAdminBtn && { opacity: 0.5 }
                                ]}
                                disabled={disableAdminBtn}
                                onPress={() => {
                                    if (disableAdminBtn) {
                                        Alert.alert('Notice', 'Starter Plan allows only 1 Hospital Admin.');
                                        return;
                                    }
                                    setShowManagerForm(!showManagerForm);
                                    setShowStaffForm(false);
                                    setManagerForm({ name: '', email: '', password: '', phone: '', age: '', aadhaarNumber: '' });
                                }}
                            >
                                <Text style={[styles.btnActionPrimaryText, showManagerForm && styles.btnActionCancelText]}>
                                    {showManagerForm ? 'Cancel' : hasAdmin ? '🔄 Add Another Admin' : '+ Add Clinic Admin'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Existing Admin Profile Box */}
                        {adminUser && !showManagerForm && (
                            <View style={styles.clinicAdminProfileBox}>
                                <View style={styles.adminAvatarCircle}>
                                    <Text style={styles.adminAvatarCircleText}>
                                        {(adminUser.name || '?').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={styles.adminProfileName}>{adminUser.name}</Text>
                                    <Text style={styles.adminProfileEmail}>{adminUser.email}</Text>
                                    {Boolean(adminUser.phone) && (
                                        <Text style={styles.adminProfilePhone}>📞 {adminUser.phone}</Text>
                                    )}
                                </View>
                                <View style={styles.adminRolePill}>
                                    <Text style={styles.adminRolePillText}>CLINIC ADMIN</Text>
                                </View>
                            </View>
                        )}

                        {/* No Admin Box */}
                        {!adminUser && !showManagerForm && (
                            <View style={styles.emptyAdminBox}>
                                <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
                                <Text style={styles.emptyAdminTitle}>No admin assigned yet</Text>
                                <Text style={styles.emptyAdminSub}>
                                    Click <Text style={{ fontWeight: '700' }}>+ Add Clinic Admin</Text> to create login credentials for this clinic.
                                </Text>
                            </View>
                        )}

                        {/* Create Admin Form */}
                        {showManagerForm && (
                            <View style={styles.formContainer}>
                                <Text style={styles.formHeading}>Create Clinic Admin Account</Text>
                                <Text style={styles.formDesc}>
                                    This person will have full access — patients, appointments, billing, pharmacy, analytics.
                                </Text>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Full Name *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="e.g. Dr. Ramesh Sharma"
                                            value={managerForm.name}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, name: v }))}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Email Address *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="admin@clinic.com"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={managerForm.email}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, email: v }))}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Password *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Set a temporary password"
                                            secureTextEntry
                                            value={managerForm.password}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, password: v }))}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Phone *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Phone number"
                                            keyboardType="phone-pad"
                                            maxLength={10}
                                            value={managerForm.phone}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, phone: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.inputLabel}>Age *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Age"
                                            keyboardType="numeric"
                                            maxLength={3}
                                            value={managerForm.age}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, age: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 2 }]}>
                                        <Text style={styles.inputLabel}>Aadhaar Number *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="12-digit Aadhaar"
                                            keyboardType="numeric"
                                            maxLength={12}
                                            value={managerForm.aadhaarNumber}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, aadhaarNumber: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitFormBtn, savingManager && { opacity: 0.6 }]}
                                    onPress={handleCreateManager}
                                    disabled={savingManager}
                                >
                                    <Text style={styles.submitFormBtnText}>
                                        {savingManager ? 'Creating...' : '✅ Create Clinic Admin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ====== 4. ADDITIONAL STAFF MANAGEMENT (EXACT WEB PARITY) ====== */}
                    <View style={styles.adminCard}>
                        <View style={[styles.cardHeaderFlex, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>👥 Additional Staff</Text>
                                <Text style={styles.cardSub}>
                                    Tier: {doctorCount}/{clinicObj?.tier?.maxDoctors || 1} Doctors · {adminCount}/1 Hospital Admin · All login at <Text style={{ fontWeight: '700', color: '#1e293b' }}>/login</Text>
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.btnActionEdit,
                                    showStaffForm && styles.btnActionCancel,
                                    disableStaffBtn && { opacity: 0.5 }
                                ]}
                                disabled={disableStaffBtn}
                                onPress={() => {
                                    if (disableStaffBtn) {
                                        Alert.alert('Notice', 'Starter Plan user limit reached. Upgrade your plan to add more staff.');
                                        return;
                                    }
                                    setShowStaffForm(!showStaffForm);
                                    setShowManagerForm(false);
                                    setStaffForm({ name: '', email: '', password: '', phone: '', staffRole: 'doctor', age: '', aadhaarNumber: '' });
                                }}
                            >
                                <Text style={[styles.btnActionEditText, showStaffForm && styles.btnActionCancelText]}>
                                    {showStaffForm ? 'Cancel' : '+ Add Staff'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Add Staff Form */}
                        {showStaffForm && (
                            <View style={styles.formContainer}>
                                <Text style={styles.formHeading}>Add Staff Login Account</Text>
                                <Text style={styles.formDesc}>
                                    Standard tier: 1 Doctor + 1 Receptionist. Upgrade tier first if slots are full.
                                </Text>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Full Name *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Staff name"
                                            value={staffForm.name}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, name: v }))}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Email *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="staff@clinic.com"
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            value={staffForm.email}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, email: v }))}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Password *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Temporary password"
                                            secureTextEntry
                                            value={staffForm.password}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, password: v }))}
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabel}>Phone *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Phone number"
                                            keyboardType="phone-pad"
                                            maxLength={10}
                                            value={staffForm.phone}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, phone: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, isMobile && styles.formRowMobile]}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.inputLabel}>Age *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Age"
                                            keyboardType="numeric"
                                            maxLength={3}
                                            value={staffForm.age}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, age: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 2 }]}>
                                        <Text style={styles.inputLabel}>Aadhaar Number *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="12-digit Aadhaar"
                                            keyboardType="numeric"
                                            maxLength={12}
                                            value={staffForm.aadhaarNumber}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, aadhaarNumber: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <View style={styles.formGroup}>
                                    <Text style={styles.inputLabel}>Role *</Text>
                                    <View style={styles.pickerBoxStatic}>
                                        <Text style={styles.pickerBoxStaticText}>🩺 Clinic Doctor</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitFormBtn, savingStaff && { opacity: 0.6 }]}
                                    onPress={handleCreateStaff}
                                    disabled={savingStaff}
                                >
                                    <Text style={styles.submitFormBtnText}>
                                        {savingStaff ? 'Adding...' : '✅ Add Staff'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Staff Table */}
                        {staffList.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={styles.tableScroll}>
                                <View style={[styles.tableContainer, { minWidth: 620 }]}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { flex: 2.2 }]}>Name</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>Email</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Phone</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Role</Text>
                                        <Text style={[styles.th, { flex: 1.2 }]}>Added</Text>
                                        <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
                                    </View>
                                    {staffList.map((s, idx) => (
                                        <View key={s._id || idx} style={styles.tableBodyRow}>
                                            <View style={[styles.td, { flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                                                <View style={styles.staffTableAvatar}>
                                                    <Text style={styles.staffTableAvatarText}>
                                                        {(s.name || '?').charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <Text style={styles.staffRowName} numberOfLines={1}>{s.name}</Text>
                                            </View>
                                            <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{s.email}</Text>
                                            <Text style={[styles.td, { flex: 1.5 }]}>{s.phone || '—'}</Text>
                                            <View style={[styles.td, { flex: 1.5 }]}>
                                                <View style={styles.roleBadge}>
                                                    <Text style={styles.roleBadgeText}>{String(s.role || 'DOCTOR').toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.td, { flex: 1.2, color: '#94a3b8', fontSize: 12 }]}>
                                                {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '—'}
                                            </Text>
                                            <View style={[styles.td, { flex: 1, alignItems: 'center' }]}>
                                                <TouchableOpacity
                                                    style={styles.btnConfirmDelete}
                                                    onPress={() => handleDeleteStaff(s._id, s.name)}
                                                >
                                                    <Text style={styles.btnConfirmDeleteText}>Remove</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        ) : (
                            <Text style={styles.emptyTableText}>
                                No staff added yet. Add a manager or staff member above.
                            </Text>
                        )}
                    </View>

                    {/* ====== 5. RECENT APPOINTMENTS (EXACT WEB PARITY) ====== */}
                    {recentAppointments.length > 0 && (
                        <View style={styles.adminCard}>
                            <Text style={[styles.cardTitle, { marginBottom: 14 }]}>📅 Recent Appointments</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={styles.tableScroll}>
                                <View style={[styles.tableContainer, { minWidth: 620 }]}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { flex: 1.6 }]}>Patient ID</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>Doctor</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
                                        <Text style={[styles.th, { flex: 1.2 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 1.2 }]}>Amount</Text>
                                        <Text style={[styles.th, { flex: 1.2 }]}>Payment</Text>
                                    </View>
                                    {recentAppointments.map((a, i) => (
                                        <View key={a._id || i} style={styles.tableBodyRow}>
                                            <Text style={[styles.td, { flex: 1.6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '700' }]}>
                                                {a.clinicPatientId?.patientUid || a.patientId || '—'}
                                            </Text>
                                            <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{a.doctorName || '—'}</Text>
                                            <Text style={[styles.td, { flex: 1.5 }]}>
                                                {a.appointmentDate ? new Date(a.appointmentDate).toLocaleDateString('en-IN') : '—'}
                                            </Text>
                                            <View style={[styles.td, { flex: 1.2 }]}>
                                                <View style={[styles.statusBadge, a.status === 'completed' ? styles.statusBadgeCompleted : styles.statusBadgePending]}>
                                                    <Text style={[styles.statusBadgeText, a.status === 'completed' ? styles.statusBadgeCompletedText : styles.statusBadgePendingText]}>
                                                        {a.status || 'pending'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.td, { flex: 1.2, fontWeight: '700' }]}>{formatCurrency(a.amount)}</Text>
                                            <Text style={[styles.td, { flex: 1.2, fontWeight: '700', color: a.paymentStatus === 'paid' ? '#16a34a' : '#dc2626', fontSize: 12 }]}>
                                                {a.paymentStatus || 'pending'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    {/* ====== 6. BILLING & SUBSCRIPTION (EXACT WEB PARITY) ====== */}
                    <View style={[styles.adminCard, { borderColor: '#e0e7ff', borderWidth: 2 }]}>
                        <Text style={styles.cardTitle}>💳 Billing & Subscription</Text>
                        <Text style={styles.cardSub}>
                            Patient code: <Text style={{ fontWeight: '800', color: '#6366f1' }}>{clinicObj.clinicCode || '—'}</Text> · Rate per new patient this month
                        </Text>

                        {/* Rate Setting Form */}
                        <View style={[styles.rateFormGrid, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabelSmall}>Rate per New Patient (₹)</Text>
                                <TextInput
                                    style={styles.rateInput}
                                    placeholder="e.g. 50"
                                    keyboardType="numeric"
                                    value={rateForm.ratePerPatient}
                                    onChangeText={v => setRateForm(prev => ({ ...prev, ratePerPatient: v.replace(/\D/g, '') }))}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setRateForm(prev => ({ ...prev, billingEnabled: !prev.billingEnabled }))}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.checkboxBox, rateForm.billingEnabled && styles.checkboxBoxChecked]}>
                                    {rateForm.billingEnabled && <Feather name="check" size={13} color="#ffffff" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Enable billing</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnSaveRate, savingRate && { opacity: 0.6 }]}
                                onPress={handleSaveRate}
                                disabled={savingRate}
                            >
                                <Text style={styles.btnSaveRateText}>
                                    {savingRate ? 'Saving...' : '💾 Save Rate'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Subscription History Table */}
                        {clinicSubscriptions.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={styles.tableScroll}>
                                <View style={[styles.tableContainer, { minWidth: 620 }]}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { flex: 2 }]}>Month / Year</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>New Patients</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Total Patients</Text>
                                        <Text style={[styles.th, { flex: 1.2 }]}>Rate</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Amount</Text>
                                        <Text style={[styles.th, { flex: 1.4 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 2, textAlign: 'center' }]}>Actions</Text>
                                    </View>
                                    {clinicSubscriptions.map((sub, idx) => {
                                        const isPaid = sub.status === 'paid';
                                        const isWaived = sub.status === 'waived';
                                        const monthName = new Date(sub.year, (sub.month || 1) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

                                        return (
                                            <View key={sub._id || idx} style={styles.tableBodyRow}>
                                                <Text style={[styles.td, { flex: 2, fontWeight: '700' }]}>{monthName}</Text>
                                                <Text style={[styles.td, { flex: 1.5, color: '#6366f1', fontWeight: '700' }]}>{sub.newPatientCount ?? 0}</Text>
                                                <Text style={[styles.td, { flex: 1.5 }]}>{sub.totalPatientCount ?? 0}</Text>
                                                <Text style={[styles.td, { flex: 1.2 }]}>₹{sub.ratePerPatient ?? 0}</Text>
                                                <Text style={[styles.td, { flex: 1.5, fontWeight: '800' }]}>₹{(sub.totalAmount ?? 0).toLocaleString('en-IN')}</Text>
                                                <View style={[styles.td, { flex: 1.4 }]}>
                                                    <View style={[
                                                        styles.subStatusPill,
                                                        isPaid ? styles.subStatusPaid : isWaived ? styles.subStatusWaived : styles.subStatusPending
                                                    ]}>
                                                        <Text style={[
                                                            styles.subStatusPillText,
                                                            isPaid ? styles.subPaidColor : isWaived ? styles.subWaivedColor : styles.subPendingColor
                                                        ]}>
                                                            {(sub.status || 'Pending').toUpperCase()}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { flex: 2, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}>
                                                    {!isPaid && (
                                                        <TouchableOpacity
                                                            style={styles.subBtnPaid}
                                                            onPress={() => handleUpdateSubscription(sub._id, 'paid')}
                                                        >
                                                            <Text style={styles.subBtnPaidText}>Mark Paid</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                    {sub.status === 'pending' && (
                                                        <TouchableOpacity
                                                            style={styles.subBtnWaive}
                                                            onPress={() => handleUpdateSubscription(sub._id, 'waived')}
                                                        >
                                                            <Text style={styles.subBtnWaiveText}>Waive</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        ) : (
                            <Text style={styles.emptyTableText}>
                                No billing records yet. Records appear once patients are registered.
                            </Text>
                        )}
                    </View>

                    {/* ====== 7. APPOINTMENT SYSTEM MODE (EXACT WEB PARITY) ====== */}
                    <View style={[styles.adminCard, { borderColor: '#e0f2fe', borderWidth: 2 }]}>
                        <View style={[styles.cardHeaderFlex, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                            <Text style={styles.cardTitle}>🎟️ Appointment System Mode</Text>
                            <View style={[styles.modeCurrentPill, clinicObj.appointmentMode === 'token' ? styles.tokenModePill : styles.slotModePill]}>
                                <Text style={[styles.modeCurrentPillText, clinicObj.appointmentMode === 'token' ? styles.tokenModeText : styles.slotModeText]}>
                                    Current: {clinicObj.appointmentMode === 'token' ? 'Token Queue' : 'Time Slots'}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.cardSub}>
                            Choose how patients are managed in this clinic's reception queue.
                        </Text>

                        <View style={[styles.modeCardsRow, isMobile && { flexDirection: 'column' }]}>
                            {/* Token Mode Card */}
                            <TouchableOpacity
                                style={[
                                    styles.modeRadioCard,
                                    clinicApptMode === 'token' ? styles.modeRadioCardActiveToken : styles.modeRadioCardInactive
                                ]}
                                onPress={() => setClinicApptMode('token')}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                                    <Text style={{ fontSize: 32, lineHeight: 36 }}>🎟️</Text>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={[styles.modeCardTitle, clinicApptMode === 'token' && { color: '#92400e' }]}>
                                                Token Queue System
                                            </Text>
                                            {clinicApptMode === 'token' && (
                                                <View style={styles.selectedPillOrange}>
                                                    <Text style={styles.selectedPillText}>Selected</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.modeCardDesc}>
                                            Sequential tokens (1, 2, 3…) per day. Auto-resets at midnight. No time-slot picking needed. Best for walk-in clinics.
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Slot Mode Card */}
                            <TouchableOpacity
                                style={[
                                    styles.modeRadioCard,
                                    clinicApptMode === 'slot' ? styles.modeRadioCardActiveSlot : styles.modeRadioCardInactive
                                ]}
                                onPress={() => setClinicApptMode('slot')}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                                    <Text style={{ fontSize: 32, lineHeight: 36 }}>🕐</Text>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <Text style={[styles.modeCardTitle, clinicApptMode === 'slot' && { color: '#1d4ed8' }]}>
                                                Time Slot Booking
                                            </Text>
                                            {clinicApptMode === 'slot' && (
                                                <View style={styles.selectedPillBlue}>
                                                    <Text style={styles.selectedPillText}>Selected</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.modeCardDesc}>
                                            Patients pick a specific time (09:00, 09:30…). Fixed scheduling with conflict prevention. Best for planned appointments.
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {clinicApptMode !== (clinicObj.appointmentMode || 'token') && (
                            <View style={styles.modeWarningBox}>
                                <Text style={styles.modeWarningBoxText}>
                                    ⚠️ You are changing the appointment mode. Existing appointments will not be affected — only new bookings will follow the new mode.
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
                            <TouchableOpacity
                                style={[
                                    styles.btnSaveApptMode,
                                    (savingApptMode || clinicApptMode === (clinicObj.appointmentMode || 'token')) && { opacity: 0.5 }
                                ]}
                                onPress={handleSaveApptMode}
                                disabled={savingApptMode || clinicApptMode === (clinicObj.appointmentMode || 'token')}
                            >
                                <Text style={styles.btnSaveApptModeText}>
                                    {savingApptMode ? 'Saving…' : 'Save Mode'}
                                </Text>
                            </TouchableOpacity>
                            {clinicApptMode === (clinicObj.appointmentMode || 'token') && (
                                <Text style={{ fontSize: 13, color: '#64748b' }}>No changes to save</Text>
                            )}
                        </View>
                    </View>

                    {/* ====== 8. CLINIC FEATURES (EXACT WEB PARITY - 6 FEATURE CARDS) ====== */}
                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>🚀 Clinic Features</Text>
                        <Text style={styles.cardSub}>
                            Staff can access these modules after logging in at <Text style={{ fontWeight: '700', color: '#1e293b' }}>/login</Text>
                        </Text>

                        <View style={[styles.featuresGrid, isMobile && styles.featuresGridMobile]}>
                            {[
                                { icon: '👤', label: 'Patient Registration', desc: 'Register & search patients', bg: '#f0f9ff', color: '#0ea5e9' },
                                { icon: '🩺', label: 'Doctor Consultation', desc: 'Appointments & prescriptions', bg: '#f5f3ff', color: '#8b5cf6' },
                                { icon: '💊', label: 'Pharmacy', desc: 'Medicine orders & inventory', bg: '#fff7ed', color: '#f97316' },
                                { icon: '🧾', label: 'Billing & Payments', desc: 'Invoice & collect payments', bg: '#fefce8', color: '#eab308' },
                                { icon: '🧪', label: 'Lab Reports', desc: 'Upload & share lab results', bg: '#fdf4ff', color: '#d946ef' },
                                { icon: '📊', label: 'Analytics', desc: 'Revenue, patients & reports', bg: '#f0fdf4', color: '#22c55e' },
                            ].map((item, i) => (
                                <View key={i} style={[styles.featureCard, { backgroundColor: item.bg }]}>
                                    <Text style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</Text>
                                    <Text style={[styles.featureCardTitle, { color: item.color }]}>{item.label}</Text>
                                    <Text style={styles.featureCardDesc}>{item.desc}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ====== 9. DANGER ZONE: DELETE CLINIC (EXACT WEB PARITY) ====== */}
                    <View style={[styles.adminCard, { borderColor: '#fee2e2', borderWidth: 1, backgroundColor: '#fffafa' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.cardTitle, { color: '#b91c1c' }]}>Danger Zone</Text>
                                <Text style={styles.cardSub}>Permanently delete this clinic and all related data.</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.btnDangerDelete}
                                onPress={() => setDeleteModalVisible(true)}
                            >
                                <Text style={styles.btnDangerDeleteText}>🗑️ Delete Clinic</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* ====== DELETE CLINIC CONFIRM MODAL (EXACT WEB PARITY) ====== */}
            <Modal
                visible={deleteModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Delete Simple Clinic?</Text>
                        <Text style={styles.modalWarning}>
                            This will permanently delete the clinic, all staff accounts, and all clinic data. This action CANNOT be undone.
                        </Text>
                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity
                                style={[styles.btnConfirmDeleteModal, deletingClinic && { opacity: 0.6 }]}
                                onPress={handleDeleteClinic}
                                disabled={deletingClinic}
                            >
                                <Text style={styles.btnConfirmDeleteModalText}>
                                    {deletingClinic ? 'Deleting...' : 'Delete'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnCancelModal}
                                onPress={() => setDeleteModalVisible(false)}
                                disabled={deletingClinic}
                            >
                                <Text style={styles.btnCancelModalText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        backgroundColor: '#f8fafc'
    },
    scrollContent: {
        maxWidth: 1280,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 40
    },

    // Alerts matching Web lines 2103-2104
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8
    },
    errorAlertIcon: { fontSize: 16 },
    errorAlertText: { fontSize: 13, color: '#dc2626', fontWeight: '600', flex: 1 },
    successAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#86efac',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8
    },
    successAlertIcon: { fontSize: 16 },
    successAlertText: { fontSize: 13, color: '#16a34a', fontWeight: '600', flex: 1 },

    // ====== 1. HERO HEADER BANNER ======
    heroBanner: {
        position: 'relative',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14,
        marginBottom: 20,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 6px 20px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
                backgroundColor: '#ffffff',
                backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f8faff 50%, #f0f4ff 100%)'
            },
            default: {
                elevation: 2
            }
        })
    },
    heroWaves: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 245,
        height: '100%',
        zIndex: 1,
        overflow: 'hidden'
    },
    heroWaveSvg: {
        width: '100%',
        height: '100%'
    },
    heroDarkDotMatrix: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        width: 48,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7
    },
    heroMatrixDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#38bdf8',
        opacity: 0.55
    },

    // Top Row
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        position: 'relative',
        zIndex: 15,
        marginBottom: 6
    },
    clinicBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.5)',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 18
    },
    clinicBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.2
    },
    topBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.4)'
    },
    topBackArrow: {
        fontSize: 14,
        fontWeight: '900',
        color: '#ffffff'
    },
    topBackText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff'
    },

    // Hero Content
    heroContent: {
        position: 'relative',
        zIndex: 5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        marginTop: 6
    },

    // 3D Hexagon Logo Container
    hexLogoContainer: {
        width: 78,
        height: 86,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    hexOrbitRing: {
        position: 'absolute',
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.45)'
    },
    hexOrbitNode: {
        position: 'absolute',
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#38bdf8'
    },
    nodeA: { top: 6, right: 0 },
    nodeB: { bottom: 8, left: -2 },
    nodeC: { bottom: 0, right: 16 },

    hexOuter: {
        width: 68,
        height: 76,
        backgroundColor: '#f0fdf4',
        borderWidth: 2,
        borderColor: '#86efac',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    hexInner: {
        width: 58,
        height: 66,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: { boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.04)' }
        })
    },
    redCrossBox: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    crossArmH: {
        position: 'absolute',
        width: 28,
        height: 9,
        backgroundColor: '#e11d48',
        borderRadius: 2.5
    },
    crossArmV: {
        position: 'absolute',
        width: 9,
        height: 28,
        backgroundColor: '#e11d48',
        borderRadius: 2.5
    },

    // Center Hero Info
    heroInfo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10
    },
    centerDotMatrix: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: 40,
        gap: 5,
        justifyContent: 'center',
        marginBottom: 4
    },
    centerMatrixDot: {
        width: 2.5,
        height: 2.5,
        borderRadius: 1.25,
        backgroundColor: '#94a3b8',
        opacity: 0.45
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0b192c',
        textAlign: 'center',
        letterSpacing: -0.4
    },
    heroAccentBar: {
        position: 'relative',
        width: 155,
        height: 2.5,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        marginVertical: 6,
        justifyContent: 'center'
    },
    accentBarFill: {
        width: 55,
        height: '100%',
        backgroundColor: '#2563eb',
        borderRadius: 3
    },
    accentBarDot: {
        position: 'absolute',
        right: 0,
        top: -1.25,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#0284c7'
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 2
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3
    },
    metaChipIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center'
    },
    pinIcon: { backgroundColor: '#ede9fe' },
    phoneIcon: { backgroundColor: '#ccfbf1' },
    metaChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1e293b'
    },
    metaSep: {
        width: 1,
        height: 14,
        backgroundColor: '#cbd5e1'
    },
    slugChip: {
        backgroundColor: '#f0fdfa',
        borderColor: '#ccfbf1'
    },
    slugIcon: { backgroundColor: '#ccfbf1' },
    slugLinkText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f766e'
    },

    // Right ECG Widget
    heroRightCol: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 185
    },
    heroEcgWidget: {
        width: 185,
        height: 58,
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroEcgSvg: {
        width: '100%',
        height: '100%'
    },

    // Bottom Floating Stats Bar
    heroBottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.95)',
        paddingHorizontal: 18,
        paddingVertical: 5,
        marginTop: 10,
        alignSelf: 'center',
        width: '65%',
        maxWidth: 540,
        minWidth: 320
    },
    bottomStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    bottomStatIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center'
    },
    iconShield: { backgroundColor: '#ede9fe' },
    iconDoctors: { backgroundColor: '#ccfbf1' },
    bottomStatText: { flexDirection: 'column' },
    bottomStatLabel: { fontSize: 10, color: '#64748b', fontWeight: '600' },
    bottomStatVal: { fontSize: 12, color: '#0f172a', fontWeight: '800' },
    bottomStatSep: { width: 1, height: 18, backgroundColor: '#e2e8f0' },
    bottomStatRight: { alignItems: 'center' },

    statusCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12
    },
    capsuleActive: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#86efac'
    },
    capsuleInactive: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5'
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#16a34a'
    },
    statusCapsuleText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#15803d',
        letterSpacing: 0.4
    },
    capsuleEcgWrap: {
        width: 36,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // ====== 2. KPI GRID (LIGHT COLORFUL) ======
    kpiGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20
    },
    kpiGridMobile: {
        flexWrap: 'wrap'
    },
    kpiCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1
    },
    kpiCardHalf: {
        minWidth: '47%'
    },
    kpiCardFull: {
        minWidth: '100%'
    },

    // Blue
    kpiCardBlue: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd'
    },
    kpiIconBlue: { backgroundColor: '#ffffff' },

    // Purple
    kpiCardPurple: {
        backgroundColor: '#faf5ff',
        borderColor: '#ddd6fe'
    },
    kpiIconPurple: { backgroundColor: '#ffffff' },

    // Green
    kpiCardGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0'
    },
    kpiIconGreen: { backgroundColor: '#ffffff' },

    // Orange
    kpiCardOrange: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a'
    },
    kpiIconOrange: { backgroundColor: '#ffffff' },

    kpiIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        ...Platform.select({
            web: { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }
        })
    },
    kpiVal: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.4
    },
    kpiLbl: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 3
    },
    kpiSub: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 2
    },
    kpiBottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3
    },

    loadingHudCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20
    },
    loadingHudTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1e293b',
        marginTop: 12
    },
    loadingHudSub: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4
    },

    // ====== GENERAL ADMIN CARD ======
    adminCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20
    },
    cardHeaderFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    cardSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 3
    },

    // Buttons
    btnActionPrimary: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8
    },
    btnActionPrimaryText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700'
    },
    btnActionEdit: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8
    },
    btnActionEditText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700'
    },
    btnActionCancel: {
        backgroundColor: '#f1f5f9'
    },
    btnActionCancelText: {
        color: '#475569'
    },

    // Admin Profile Box
    clinicAdminProfileBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    adminAvatarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    adminAvatarCircleText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#16a34a'
    },
    adminProfileName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b'
    },
    adminProfileEmail: {
        fontSize: 12,
        color: '#64748b'
    },
    adminProfilePhone: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    adminRolePill: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6
    },
    adminRolePillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#16a34a'
    },

    emptyAdminBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff7ed',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fed7aa',
        borderStyle: 'dashed'
    },
    emptyAdminTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#92400e'
    },
    emptyAdminSub: {
        fontSize: 12,
        color: '#b45309',
        textAlign: 'center',
        marginTop: 3
    },

    // Form Container
    formContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 10
    },
    formHeading: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 2
    },
    formDesc: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 14
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10
    },
    formRowMobile: {
        flexDirection: 'column',
        gap: 8
    },
    formGroup: {
        flex: 1
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4
    },
    textInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 13,
        color: '#0f172a'
    },
    pickerBoxStatic: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8
    },
    pickerBoxStaticText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b'
    },
    submitFormBtn: {
        backgroundColor: '#2563eb',
        borderRadius: 8,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8
    },
    submitFormBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800'
    },

    // Staff Table
    tableScroll: {
        marginTop: 10
    },
    tableContainer: {
        width: '100%'
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        paddingHorizontal: 6
    },
    th: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.3
    },
    tableBodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 6
    },
    td: {
        fontSize: 12,
        color: '#1e293b'
    },
    staffTableAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center'
    },
    staffTableAvatarText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#6366f1'
    },
    staffRowName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b'
    },
    roleBadge: {
        backgroundColor: '#e0e7ff',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    roleBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#4338ca'
    },
    btnConfirmDelete: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
    },
    btnConfirmDeleteText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#dc2626'
    },
    emptyTableText: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 12,
        paddingVertical: 20
    },

    // Recent Appointments
    statusBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    statusBadgeCompleted: { backgroundColor: '#dcfce7' },
    statusBadgePending: { backgroundColor: '#fef3c7' },
    statusBadgeText: { fontSize: 10, fontWeight: '800' },
    statusBadgeCompletedText: { color: '#16a34a' },
    statusBadgePendingText: { color: '#92400e' },

    // Billing & Rate
    rateFormGrid: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        marginBottom: 16
    },
    inputLabelSmall: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 4
    },
    rateInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 13,
        color: '#0f172a'
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingBottom: 8
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center'
    },
    checkboxBoxChecked: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb'
    },
    checkboxLabel: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600'
    },
    btnSaveRate: {
        backgroundColor: '#2563eb',
        borderRadius: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnSaveRateText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800'
    },

    subStatusPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start'
    },
    subStatusPaid: { backgroundColor: '#dcfce7' },
    subStatusWaived: { backgroundColor: '#f1f5f9' },
    subStatusPending: { backgroundColor: '#fef3c7' },
    subStatusPillText: { fontSize: 10, fontWeight: '800' },
    subPaidColor: { color: '#16a34a' },
    subWaivedColor: { color: '#64748b' },
    subPendingColor: { color: '#92400e' },
    subBtnPaid: {
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
    },
    subBtnPaidText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },
    subBtnWaive: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4
    },
    subBtnWaiveText: { fontSize: 10, fontWeight: '800', color: '#64748b' },

    // Appointment Mode Section
    modeCurrentPill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20
    },
    tokenModePill: { backgroundColor: '#fef3c7' },
    slotModePill: { backgroundColor: '#dbeafe' },
    modeCurrentPillText: { fontSize: 11, fontWeight: '800' },
    tokenModeText: { color: '#92400e' },
    slotModeText: { color: '#1d4ed8' },

    modeCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
        marginBottom: 10
    },
    modeRadioCard: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2
    },
    modeRadioCardActiveToken: {
        backgroundColor: '#fffbeb',
        borderColor: '#f59e0b'
    },
    modeRadioCardActiveSlot: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6'
    },
    modeRadioCardInactive: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0'
    },
    modeCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b'
    },
    selectedPillOrange: {
        backgroundColor: '#f59e0b',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10
    },
    selectedPillBlue: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10
    },
    selectedPillText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800'
    },
    modeCardDesc: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 16
    },
    modeWarningBox: {
        backgroundColor: '#fef9c3',
        borderWidth: 1,
        borderColor: '#fde047',
        borderRadius: 8,
        padding: 10,
        marginTop: 4
    },
    modeWarningBoxText: {
        fontSize: 12,
        color: '#713f12'
    },
    btnSaveApptMode: {
        backgroundColor: '#1d4ed8',
        paddingHorizontal: 20,
        paddingVertical: 9,
        borderRadius: 8
    },
    btnSaveApptModeText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800'
    },

    // Clinic Features Grid
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12
    },
    featuresGridMobile: {
        flexDirection: 'column'
    },
    featureCard: {
        flex: 1,
        minWidth: '30%',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.04)'
    },
    featureCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 3
    },
    featureCardDesc: {
        fontSize: 11,
        color: '#64748b'
    },

    // Danger Zone
    btnDangerDelete: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8
    },
    btnDangerDeleteText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: '800'
    },

    // Delete Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 24,
        maxWidth: 440,
        width: '100%',
        ...Platform.select({
            web: { boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }
        })
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 10
    },
    modalWarning: {
        fontSize: 13,
        color: '#dc2626',
        fontWeight: '600',
        lineHeight: 18,
        marginBottom: 20
    },
    modalButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10
    },
    btnConfirmDeleteModal: {
        backgroundColor: '#dc2626',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8
    },
    btnConfirmDeleteModalText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800'
    },
    btnCancelModal: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8
    },
    btnCancelModalText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '700'
    }
});

export default CentralAdminClinicDetails;
