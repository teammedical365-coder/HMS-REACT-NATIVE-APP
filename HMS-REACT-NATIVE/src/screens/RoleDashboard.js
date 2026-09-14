    import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal, Alert, Animated, Platform, useWindowDimensions, Easing } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { receptionAPI, publicAPI } from '../utils/api';
import { useAuth } from '../store/hooks';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Circle, Path, Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

// Hospital Admin 3D Hero Banner (Web ha-hero-header-card 1:1 Parity)
const HospitalAdminHeroCard = ({ greeting, userName }) => {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const spinAnim1 = useRef(new Animated.Value(0)).current;
    const spinAnim2 = useRef(new Animated.Value(0)).current;
    const nameAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        const loop1 = Animated.loop(
            Animated.timing(spinAnim1, {
                toValue: 1,
                duration: 14000,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web',
            })
        );
        const loop2 = Animated.loop(
            Animated.timing(spinAnim2, {
                toValue: 1,
                duration: 18000,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web',
            })
        );
        const loopName = Animated.loop(
            Animated.sequence([
                Animated.timing(nameAnim, { toValue: 1, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(nameAnim, { toValue: 0.88, duration: 1600, useNativeDriver: Platform.OS !== 'web' }),
            ])
        );
        loop1.start();
        loop2.start();
        loopName.start();
        return () => {
            loop1.stop();
            loop2.stop();
            loopName.stop();
        };
    }, [spinAnim1, spinAnim2, nameAnim]);

    const spin1 = spinAnim1.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });
    const spin2 = spinAnim2.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg'],
    });

    return (
        <ExpoLinearGradient
            colors={['#ffffff', '#f4f8ff', '#e8f2fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={haStyles.heroCard}
        >
            {/* Top-Left 5x5 Dot Matrix Pattern */}
            <View style={haStyles.dotMatrix} pointerEvents="none">
                {[...Array(25)].map((_, i) => (
                    <View key={i} style={haStyles.dot} />
                ))}
            </View>

            {/* Sparkles */}
            <View style={haStyles.sparklesWrap} pointerEvents="none">
                <Text style={[haStyles.sparkle, { top: 16, left: 35, fontSize: 18, color: '#38bdf8' }]}>+</Text>
                <Text style={[haStyles.sparkle, { top: 10, left: 160, fontSize: 13, color: '#818cf8' }]}>✦</Text>
                <Text style={[haStyles.sparkle, { top: 80, left: 90, fontSize: 10, color: '#38bdf8' }]}>•</Text>
                <Text style={[haStyles.sparkle, { top: 18, right: 200, fontSize: 14, color: '#60a5fa' }]}>+</Text>
            </View>

            {/* Bottom-Left Smooth Organic Waves SVG */}
            <View style={haStyles.waveContainer} pointerEvents="none">
                <Svg width="100%" height="100%" viewBox="0 0 450 140" preserveAspectRatio="none">
                    <Defs>
                        <SvgLinearGradient id="haSoftWaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.45" />
                            <Stop offset="60%" stopColor="#93c5fd" stopOpacity="0.25" />
                            <Stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.05" />
                        </SvgLinearGradient>
                        <SvgLinearGradient id="haSoftWaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
                            <Stop offset="50%" stopColor="#818cf8" stopOpacity="0.3" />
                            <Stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                        </SvgLinearGradient>
                    </Defs>
                    <Path d="M 0 60 C 90 20 180 90 290 50 C 370 20 410 70 450 60 L 450 140 L 0 140 Z" fill="url(#haSoftWaveGrad1)" />
                    <Path d="M 0 60 C 90 20 180 90 290 50 C 370 20 410 70 450 60" fill="none" stroke="url(#haSoftWaveGrad2)" strokeWidth="2.5" />
                    <Path d="M 0 95 C 110 65 200 125 320 85 C 380 65 420 100 450 95" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
                </Svg>
            </View>

            {/* Inner Content */}
            <View style={[haStyles.heroInner, isMobile && haStyles.heroInnerMobile]}>
                {/* Left: 3D Glowing Blue Cross in Crystal Orb with Orbital Swirls */}
                <View style={haStyles.orbContainer}>
                    <View style={haStyles.orbHaloGlow} />
                    <Animated.View style={[haStyles.orbSwirlRing, haStyles.ring1, { transform: [{ rotate: spin1 }] }]} />
                    <Animated.View style={[haStyles.orbSwirlRing, haStyles.ring2, { transform: [{ rotate: spin2 }] }]} />
                    <View style={[haStyles.orbSwirlNode, haStyles.node1]} />
                    <View style={[haStyles.orbSwirlNode, haStyles.node2]} />
                    
                    <View style={haStyles.crystalSphere}>
                        <View style={haStyles.cross3d}>
                            <View style={haStyles.crossArmH} />
                            <View style={haStyles.crossArmV} />
                            <View style={haStyles.crossCoreShine} />
                        </View>
                    </View>
                </View>

                {/* Center: Greeting & Username (Single Line) */}
                <View style={haStyles.centerInfo}>
                    <View style={haStyles.greetingWrap}>
                        <Text style={haStyles.greetingText}>
                            <Text style={haStyles.greetingPrefix}>{greeting}, </Text>
                            <Animated.Text style={[haStyles.animatedUsername, { opacity: nameAnim }]}>
                                <Text style={haStyles.guillemet}>»</Text> {userName || 'Dr. Katherine Vance'} <Text style={haStyles.guillemet}>«</Text>
                            </Animated.Text>
                        </Text>
                    </View>
                    <Text style={haStyles.subtitleText}>Here's your workspace. Pick any section to get started.</Text>
                    <View style={haStyles.tealAccentBar} />
                </View>

                {/* Right: 3D Hospital Building Illustration */}
                {!isMobile && (
                    <View style={haStyles.buildingContainer} pointerEvents="none">
                        <Svg width={250} height={150} viewBox="0 0 320 210" fill="none">
                            <Defs>
                                <RadialGradient id="haSunGlow_rd" cx="50%" cy="50%" rx="50%" ry="50%">
                                    <Stop offset="0%" stopColor="#fef08a" stopOpacity="0.85" />
                                    <Stop offset="60%" stopColor="#fef9c3" stopOpacity="0.35" />
                                    <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                </RadialGradient>
                                <SvgLinearGradient id="haBldgGlass_rd" x1="0" y1="0" x2="1" y2="1">
                                    <Stop offset="0%" stopColor="#bae6fd" />
                                    <Stop offset="100%" stopColor="#60a5fa" />
                                </SvgLinearGradient>
                                <SvgLinearGradient id="haBldgTower_rd" x1="0" y1="0" x2="0" y2="1">
                                    <Stop offset="0%" stopColor="#3b82f6" />
                                    <Stop offset="100%" stopColor="#1d4ed8" />
                                </SvgLinearGradient>
                            </Defs>
                            <Circle cx="280" cy="42" r="28" fill="url(#haSunGlow_rd)" />
                            <Circle cx="280" cy="42" r="12" fill="#ffffff" />
                            <Path d="M190 48 Q194 44 198 48 Q202 44 206 48" stroke="#94a3b8" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                            <Path d="M214 56 Q217 53 220 56 Q223 53 226 56" stroke="#94a3b8" strokeWidth="1.1" fill="none" strokeLinecap="round" />
                            <Path d="M25 180 V115 H50 V95 H72 V125 H95 V85 H118 V145 H145 V105 H168 V135 H192 V100 H215 V125 H238 V85 H265 V120 H295 V180 Z" fill="#e2e8f0" fillOpacity="0.45" />
                            <Rect x="75" y="65" width="70" height="115" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
                            {[0, 1, 2, 3].map(row => (
                                <G key={`hlw-${row}`}>
                                    <Rect x="82" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                    <Rect x="102" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                    <Rect x="122" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                </G>
                            ))}
                            <Rect x="195" y="65" width="70" height="115" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
                            {[0, 1, 2, 3].map(row => (
                                <G key={`hrw-${row}`}>
                                    <Rect x="202" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                    <Rect x="222" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                    <Rect x="242" y={75 + row * 22} width="14" height="14" rx="2" fill="url(#haBldgGlass_rd)" />
                                </G>
                            ))}
                            <Rect x="135" y="46" width="70" height="134" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.2" />
                            <Rect x="145" y="52" width="50" height="70" rx="3" fill="url(#haBldgTower_rd)" />
                            <Path d="M170 68 v22 M159 79 h22" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
                            <Rect x="132" y="128" width="76" height="14" rx="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.2" />
                            <SvgText x="170" y="138" fontSize="7" fontWeight="900" fill="#1d4ed8" textAnchor="middle" letterSpacing={0.8}>HOSPITAL</SvgText>
                            <Rect x="148" y="142" width="44" height="38" rx="2" fill="#bfdbfe" fillOpacity="0.7" stroke="#60a5fa" />
                            <Line x1="170" y1="142" x2="170" y2="180" stroke="#2563eb" strokeWidth="1.5" />
                            <Circle cx="58" cy="176" r="14" fill="#22c55e" />
                            <Circle cx="70" cy="179" r="10" fill="#16a34a" />
                            <Circle cx="140" cy="180" r="8" fill="#15803d" />
                            <Circle cx="200" cy="180" r="8" fill="#15803d" />
                            <Circle cx="270" cy="176" r="13" fill="#22c55e" />
                            <Circle cx="282" cy="179" r="10" fill="#16a34a" />
                        </Svg>
                    </View>
                )}
            </View>
        </ExpoLinearGradient>
    );
};

// Hospital Admin 6 Quick Operations Cards (Web ha-quick-ops-card 1:1 Parity)
const haOperationCards = [
    {
        key: 'doctors',
        label: 'Doctors',
        desc: 'Manage doctor profiles & schedules',
        path: 'AdminDoctors',
        cardBg: '#f0f7ff',
        borderColor: '#dbeafe',
        iconBg: '#dbeafe',
        iconColor: '#2563eb',
        textColor: '#2563eb',
        chevronColor: '#3b82f6',
        featherIcon: 'users',
    },
    {
        key: 'labs',
        label: 'Labs',
        desc: 'Configure lab departments',
        path: 'AdminLabTests',
        cardBg: '#fbf5ff',
        borderColor: '#f3e8ff',
        iconBg: '#f3e8ff',
        iconColor: '#9333ea',
        textColor: '#9333ea',
        chevronColor: '#a855f7',
        featherIcon: 'activity',
    },
    {
        key: 'pharmacy',
        label: 'Pharmacy',
        desc: 'Pharmacy inventory & orders',
        path: 'PharmacyInventory',
        cardBg: '#fff9f0',
        borderColor: '#ffedd5',
        iconBg: '#ffedd5',
        iconColor: '#ea580c',
        textColor: '#ea580c',
        chevronColor: '#f97316',
        featherIcon: 'package',
    },
    {
        key: 'services',
        label: 'Services',
        desc: 'Hospital services & pricing',
        path: 'AdminServices',
        cardBg: '#f2fbf5',
        borderColor: '#dcfce7',
        iconBg: '#dcfce7',
        iconColor: '#16a34a',
        textColor: '#16a34a',
        chevronColor: '#22c55e',
        featherIcon: 'tool',
    },
    {
        key: 'users',
        label: 'Manage Users',
        desc: 'View and manage all staff',
        path: 'Admin',
        cardBg: '#f0f9ff',
        borderColor: '#e0f2fe',
        iconBg: '#e0f2fe',
        iconColor: '#0284c7',
        textColor: '#0284c7',
        chevronColor: '#0ea5e9',
        featherIcon: 'user-check',
    },
    {
        key: 'questions',
        label: 'Question Library',
        desc: 'Manage diagnostic questions',
        path: 'HospitalAdminQuestionLibrary',
        cardBg: '#fff1f5',
        borderColor: '#ffe4e6',
        iconBg: '#ffe4e6',
        iconColor: '#e11d48',
        textColor: '#e11d48',
        chevronColor: '#f43f5e',
        featherIcon: 'file-text',
    },
];

const HospitalAdminQuickOps = ({ navigation }) => {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    return (
        <View style={haStyles.quickOpsCard}>
            <View style={haStyles.quickOpsHeader}>
                <View style={haStyles.lightningIconBox}>
                    <Feather name="zap" size={20} color="#06b6d4" />
                </View>
                <View>
                    <Text style={haStyles.quickOpsTitle}>Quick Operations</Text>
                </View>
            </View>

            <View style={[
                haStyles.quickOpsGrid,
                isMobile ? haStyles.gridCol1 : (isTablet ? haStyles.gridCol2 : haStyles.gridCol3)
            ]}>
                {haOperationCards.map((card) => (
                    <TouchableOpacity
                        key={card.key}
                        activeOpacity={0.85}
                        style={[
                            haStyles.quickCard,
                            { backgroundColor: card.cardBg, borderColor: card.borderColor },
                            isMobile && { width: '100%' }
                        ]}
                        onPress={() => navigation.navigate(card.path)}
                    >
                        <View style={[haStyles.quickCardIconBox, { backgroundColor: card.iconBg }]}>
                            <Feather name={card.featherIcon} size={24} color={card.iconColor} />
                        </View>
                        <View style={haStyles.quickCardInfo}>
                            <Text style={[haStyles.quickCardName, { color: card.textColor }]}>{card.label}</Text>
                            <Text style={haStyles.quickCardDesc} numberOfLines={2}>{card.desc}</Text>
                        </View>
                        <Text style={[haStyles.quickCardChevron, { color: card.chevronColor }]}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

// Icon mapping — maps common path keywords to emojis
const getIconForPath = (path, label) => {
    const text = `${path} ${label}`.toLowerCase();
    if (text.includes('patient')) return '🩺';
    if (text.includes('doctor')) return '👨‍⚕️';
    if (text.includes('appointment')) return '📅';
    if (text.includes('lab') || text.includes('test')) return '🧪';
    if (text.includes('pharmacy') || text.includes('medicine') || text.includes('inventory')) return '💊';
    if (text.includes('order')) return '📦';
    if (text.includes('reception') || text.includes('front')) return '🏥';
    if (text.includes('report')) return '📊';
    if (text.includes('dashboard') || text.includes('home')) return '🏠';
    if (text.includes('admin') || text.includes('manage')) return '⚙️';
    if (text.includes('role') || text.includes('permission')) return '🔑';
    return '📋';
};

const getDescForLink = (label) => {
    const text = label.toLowerCase();
    if (text.includes('registration')) return 'Register and manage patient records';
    if (text.includes('search')) return 'Lookup patient files and history';
    if (text.includes('billing')) return 'View bills and process payments';
    if (text.includes('patients')) return 'Access your patient queue and clinical workspace';
    return 'Access the modules of your workspace';
};

const operationLinks = [
    { icon: '👨‍⚕️', label: 'Doctors', desc: 'Manage doctor profiles & schedules', path: 'AdminDoctors', bg: '#dbeafe', color: '#2563eb' },
    { icon: '🧪', label: 'Labs', desc: 'Configure lab departments', path: 'AdminLabTests', bg: '#f3e8ff', color: '#9333ea' },
    { icon: '💊', label: 'Pharmacy', desc: 'Pharmacy inventory & orders', path: 'PharmacyInventory', bg: '#ffedd5', color: '#ea580c' },
    { icon: '🛠️', label: 'Services', desc: 'Hospital services & pricing', path: 'AdminServices', bg: '#fefce8', color: '#ca8a04' },
    { icon: '👥', label: 'Manage Users', desc: 'View and manage all staff', path: 'AdminUsers', bg: '#f0f9ff', color: '#0284c7' },
    { icon: '📝', label: 'Question Library', desc: 'Manage diagnostic questions', path: 'HospitalAdminQuestionLibrary', bg: '#fdf2f8', color: '#be185d' },
];

const mapPathToScreen = (path) => {
    if (!path) return 'RoleDashboard';
    if (path.includes('/reception/dashboard')) return 'ReceptionDashboard';
    if (path.includes('/reception/patients')) return 'ReceptionPatients';
    if (path.includes('/billing/patient')) return 'PatientBillingProfile';
    if (path.includes('/doctor/dashboard')) return 'DoctorPatientDetails';
    return path;
};

const RoleDashboard = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    
    const userName = user?.name || 'Staff';
    const roleName = user?.role || 'Staff';
    const isReception = (user?.role || '').toLowerCase() === 'reception' || (user?.role || '').toLowerCase() === 'receptionist';
    const todayStr = new Date().toISOString().split('T')[0];
    const permissions = user?.permissions || [];

    // Receptionist Dashboard state
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [loadingAppts, setLoadingAppts] = useState(false);

    // Search and tab states
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'today' or 'all'

    // Modals state
    const [vitalsModal, setVitalsModal] = useState({ open: false, patient: null });
    const [vitalsForm, setVitalsForm] = useState({ height: '', weight: '', bloodGroup: '', bp: '', temp: '', spo2: '', pulse: '' });
    const [savingVitals, setSavingVitals] = useState(false);

    const [uploadModal, setUploadModal] = useState({ open: false, apptId: null, patientName: '' });
    const [selectedReportFile, setSelectedReportFile] = useState(null);

    const [consultModal, setConsultModal] = useState({ open: false, patient: null, sessions: [] });

    const processFormChange = useCallback((name, value, formSetter) => {
        if (name === 'phone') {
            const cleanVal = value.replace(/\D/g, '').slice(0, 10);
            formSetter(prev => ({ ...prev, [name]: cleanVal }));
        } else if (name === 'aadhaarNumber') {
            const cleanVal = value.replace(/\D/g, '').slice(0, 12);
            formSetter(prev => ({ ...prev, [name]: cleanVal }));
        } else {
            formSetter(prev => ({ ...prev, [name]: value }));
        }
    }, []);

    const handleVitalsFormChange = useCallback(
        (name, value) => processFormChange(name, value, setVitalsForm), 
        [processFormChange]
    );

    useEffect(() => {
        if (isReception) {
            navigation.replace('ReceptionDashboard');
        } else if ((roleName || '').toLowerCase() === 'centraladmin' || (roleName || '').toLowerCase() === 'superadmin') {
            navigation.replace('CentralAdminDashboard');
        }
    }, [isReception, roleName, navigation]);

    const fetchRecentPatients = async () => {
        setLoadingPatients(true);
        try {
            const res = await receptionAPI.getAllPatients();
            if (res.success) {
                setPatients(res.patients || []);
            }
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setLoadingPatients(false);
        }
    };

    const fetchAppointments = async () => {
        setLoadingAppts(true);
        try {
            const res = await receptionAPI.getAllAppointments({ all: 'true' });
            if (res.success) {
                setAppointments(res.appointments || []);
            }
        } catch (error) {
            console.error("Error fetching appointments:", error);
        } finally {
            setLoadingAppts(false);
        }
    };

    const handleCancelAppointment = async (apptId) => {
        Alert.alert("Confirm", "Are you sure you want to cancel this appointment?", [
            { text: "No", style: "cancel" },
            { text: "Yes", onPress: async () => {
                try {
                    const res = await receptionAPI.cancelAppointment(apptId);
                    if (res.success) {
                        Alert.alert("Success", "Appointment cancelled successfully!");
                        fetchAppointments();
                    } else {
                        Alert.alert("Error", "Failed to cancel appointment: " + res.message);
                    }
                } catch (error) {
                    console.error("Cancel appt error:", error);
                }
            }}
        ]);
    };

    const handleEditPatient = (patient) => {
        navigation.navigate('ReceptionDashboard', { patient });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
        });
    };

    const getAvatarColor = (name) => {
        const charCode = (name || 'P').charCodeAt(0);
        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', 
            '#10b981', '#06b6d4', '#6366f1', '#14b8a6'
        ];
        return colors[charCode % colors.length];
    };

    // Vitals Submit
    const handleVitalsSubmit = async () => {
        if (!vitalsModal.patient) return;
        setSavingVitals(true);
        try {
            const userId = vitalsModal.patient._id;
            const res = await receptionAPI.updateIntake(userId, {
                height: vitalsForm.height,
                weight: vitalsForm.weight,
                bloodGroup: vitalsForm.bloodGroup,
                historyPulse: vitalsForm.pulse,
                historyBp: vitalsForm.bp
            });
            if (res.success) {
                Alert.alert("Success", `Vitals updated successfully for ${vitalsModal.patient.name}!`);
                setVitalsModal({ open: false, patient: null });
                fetchRecentPatients();
            } else {
                Alert.alert("Error", "Failed to save vitals: " + res.message);
            }
        } catch (err) {
            console.error("Error saving vitals:", err);
            Alert.alert("Error", "Error saving vitals: " + err.message);
        } finally {
            setSavingVitals(false);
        }
    };

    // Report Submit
    const handleReportSubmit = () => {
        if (!selectedReportFile) {
            Alert.alert('Error', 'Please select a file to upload!');
            return;
        }
        Alert.alert('Success', `Report file "${selectedReportFile.name || 'document'}" uploaded successfully for ${uploadModal.patientName}!`);
        setSelectedReportFile(null);
        setUploadModal({ open: false, apptId: null, patientName: '' });
    };

    // Open Past Consultations modal
    const handleOpenConsultSessions = (patientUser) => {
        const patientSessions = appointments.filter(a => 
            a.userId?._id === patientUser._id && 
            a.status === 'completed'
        );
        setConsultModal({
            open: true,
            patient: patientUser,
            sessions: patientSessions
        });
    };

    // Get time-based greeting
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    else if (hour >= 17) greeting = 'Good evening';

    // Metrics calculations
    const totalPatientsCount = patients.length;
    const upcomingApptsCount = appointments.filter(a => {
        const isFuture = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] >= todayStr;
        return isFuture && ['pending', 'confirmed'].includes(a.status);
    }).length;
    const completedTodayCount = appointments.filter(a => {
        const isToday = a.appointmentDate && new Date(a.appointmentDate).toISOString().split('T')[0] === todayStr;
        return isToday && a.status === 'completed';
    }).length;

    // Override nav links for receptionist
    let navLinks = user?.navLinks || [];
    const isDoctor = (user?.role || '').toLowerCase() === 'doctor' || (user?.role || '').toLowerCase() === 'clinic doctor';
    if (isReception) {
        navLinks = [
            { label: 'Patient Registration', path: 'ReceptionDashboard' },
            { label: 'Patient Search', path: 'ReceptionPatients' },
            { label: 'Patient Billing', path: 'PatientBillingProfile' }
        ];
    } else if (isDoctor) {
        navLinks = navLinks.map(link => 
            (link.path === '/hospitaladmin' || link.path === '/doctor/dashboard') ? { ...link, path: 'DoctorPatientDetails', label: 'Patients' } : link
        );
    }

    if (isReception) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, color: '#64748b', fontWeight: '600' }}>Redirecting to Welcome Dashboard...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
            {isReception ? (
                /* ────────────────────────────────────────────────────────
                   RECEPTIONIST PATIENT LIST VIEW (CLINIC DASHBOARD STYLE)
                   ──────────────────────────────────────────────────────── */
                <View style={{ gap: 24 }}>
                    
                    {/* STATS CARDS ROW */}
                    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                        {/* Card 1: Total Patients */}
                        <View style={styles.statsCard}>
                            <View style={[styles.statsIconBox, { backgroundColor: '#eff6ff' }]}>
                                <Text style={{ fontSize: 24, color: '#2563eb' }}>👥</Text>
                            </View>
                            <View>
                                <Text style={styles.statsValue}>{totalPatientsCount}</Text>
                                <Text style={styles.statsLabel}>TOTAL PATIENTS (UNIQUE)</Text>
                            </View>
                        </View>

                        {/* Card 2: Upcoming Appointments */}
                        <View style={styles.statsCard}>
                            <View style={[styles.statsIconBox, { backgroundColor: '#fff7ed' }]}>
                                <Text style={{ fontSize: 24, color: '#ea580c' }}>📅</Text>
                            </View>
                            <View>
                                <Text style={styles.statsValue}>{upcomingApptsCount}</Text>
                                <Text style={styles.statsLabel}>UPCOMING APPOINTMENTS</Text>
                            </View>
                        </View>

                        {/* Card 3: Completed Today */}
                        <View style={styles.statsCard}>
                            <View style={[styles.statsIconBox, { backgroundColor: '#f0fdf4' }]}>
                                <Text style={{ fontSize: 24, color: '#16a34a' }}>📈</Text>
                            </View>
                            <View>
                                <Text style={styles.statsValue}>{completedTodayCount}</Text>
                                <Text style={styles.statsLabel}>COMPLETED TODAY</Text>
                            </View>
                        </View>
                    </View>

                    {/* SEARCH AND TOGGLE ROW */}
                    <View style={{ gap: 16, marginTop: 10 }}>
                        <View style={styles.searchBar}>
                            <Text style={{ color: '#94a3b8', fontSize: 16 }}>🔍</Text>
                            <TextInput 
                                placeholder="Search patient name, phone, MRN, or doctor..."
                                value={searchText}
                                onChangeText={setSearchText}
                                style={styles.searchInput}
                            />
                        </View>

                        <View style={styles.toggleGroup}>
                            <TouchableOpacity 
                                onPress={() => setActiveTab('today')}
                                style={[styles.toggleBtn, activeTab === 'today' && styles.toggleBtnActive]}
                            >
                                <Text style={[styles.toggleBtnText, activeTab === 'today' && styles.toggleBtnTextActive]}>Today's Queue</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setActiveTab('all')}
                                style={[styles.toggleBtn, activeTab === 'all' && styles.toggleBtnActive]}
                            >
                                <Text style={[styles.toggleBtnText, activeTab === 'all' && styles.toggleBtnTextActive]}>All Appointments</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* TABLE CARD */}
                    <View style={styles.tableCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                            <Text style={{ fontSize: 20 }}>📁</Text>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1e293b' }}>
                                {activeTab === 'today' ? "Today's Queue" : "All Appointments"}
                            </Text>
                        </View>

                        {loadingAppts ? (
                            <View style={{ padding: 30, alignItems: 'center' }}>
                                <Text style={{ color: '#64748b' }}>Loading appointments...</Text>
                            </View>
                        ) : (
                            <View style={{ borderWidth: 1, borderColor: '#edf2f7', borderRadius: 8, overflow: 'hidden' }}>
                                {/* Note: In React Native, tables are usually FlatLists. Doing a simple mapped view here */}
                                {appointments
                                    .filter(appt => {
                                        // Filter by tab
                                        if (activeTab === 'today') {
                                            const isToday = appt.appointmentDate && new Date(appt.appointmentDate).toISOString().split('T')[0] === todayStr;
                                            if (!isToday) return false;
                                        }
                                        // Filter by search text
                                        if (searchText.trim().length > 0) {
                                            const q = searchText.toLowerCase();
                                            const matchName = String(appt.userId?.name || '').toLowerCase().includes(q);
                                            const matchPhone = String(appt.userId?.phone || '').includes(q);
                                            const matchMRN = String(appt.userId?.patientId || '').toLowerCase().includes(q);
                                            const matchDoc = String(appt.doctorId?.name || '').toLowerCase().includes(q);
                                            return matchName || matchPhone || matchMRN || matchDoc;
                                        }
                                        return true;
                                    })
                                    .map((appt, idx) => (
                                        <View key={appt._id} style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: '#edf2f7', backgroundColor: '#fff' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <Text style={{ color: '#64748b', fontWeight: '600', width: 24 }}>{idx + 1}</Text>
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <View style={[styles.avatar, { backgroundColor: getAvatarColor(appt.userId?.name) }]}>
                                                        <Text style={styles.avatarText}>{(appt.userId?.name || 'P')[0].toUpperCase()}</Text>
                                                    </View>
                                                    <View>
                                                        <Text style={{ fontWeight: '700', color: '#1e293b' }}>{appt.userId?.name || 'Walk-in'}</Text>
                                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>MRN: {appt.userId?.patientId || 'N/A'}</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ color: '#475569', fontWeight: '600' }}>{appt.userId?.phone || '-'}</Text>
                                            </View>
                                            
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={[styles.avatarSmall, { backgroundColor: '#10b981' }]}>
                                                        <Text style={styles.avatarTextSmall}>{(appt.doctorId?.name || 'D')[0].toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ fontWeight: '600', color: '#334155' }}>{appt.doctorId?.name || 'Not Assigned'}</Text>
                                                </View>
                                                <Text style={{ color: '#1e293b', fontWeight: '700' }}>{appt.appointmentTime}</Text>
                                                <Text style={{ color: '#475569', fontWeight: '600' }}>{formatDate(appt.appointmentDate)}</Text>
                                                <View style={[styles.statusBadge, { 
                                                    backgroundColor: appt.status === 'confirmed' ? '#dcfce7' : appt.status === 'completed' ? '#eff6ff' : '#fef3c7'
                                                }]}>
                                                    <Text style={[styles.statusBadgeText, { 
                                                        color: appt.status === 'confirmed' ? '#166534' : appt.status === 'completed' ? '#1e40af' : '#92400e'
                                                    }]}>
                                                        {appt.status}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                                <TouchableOpacity 
                                                    onPress={() => navigation.navigate('PatientProfile', { patientId: appt.userId?._id || appt.userId?.patientId || appt.patientId || appt._id, department: appt.department || appt.serviceName || 'Unassigned' })}
                                                    style={[styles.actionBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                                                >
                                                    <Text style={[styles.actionBtnText, { color: '#2563eb' }]}>Profile</Text>
                                                </TouchableOpacity>
                                                {!isReception && (
                                                    <TouchableOpacity 
                                                        onPress={() => {
                                                            setVitalsModal({ open: true, patient: appt.userId });
                                                            setVitalsForm({
                                                                height: appt.userId?.fertilityProfile?.height || '',
                                                                weight: appt.userId?.fertilityProfile?.weight || '',
                                                                bloodGroup: appt.userId?.fertilityProfile?.bloodGroup || '',
                                                                bp: appt.userId?.fertilityProfile?.historyBp || '',
                                                                temp: '', spo2: '', pulse: appt.userId?.fertilityProfile?.historyPulse || ''
                                                            });
                                                        }}
                                                        style={[styles.actionBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
                                                    >
                                                        <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>Vitals</Text>
                                                    </TouchableOpacity>
                                                )}
                                                <TouchableOpacity 
                                                    onPress={() => setUploadModal({ open: true, apptId: appt._id, patientName: appt.userId?.name || 'Patient' })}
                                                    style={[styles.actionBtn, { backgroundColor: '#fdf2f8', borderColor: '#fbcfe8' }]}
                                                >
                                                    <Text style={[styles.actionBtnText, { color: '#db2777' }]}>Report</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => handleOpenConsultSessions(appt.userId)}
                                                    style={[styles.actionBtn, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}
                                                >
                                                    <Text style={[styles.actionBtnText, { color: '#7c3aed' }]}>Consult</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                            </View>
                        )}
                    </View>

                </View>
            ) : (
                /* ────────────────────────────────────────────────────────
                   HOSPITAL ADMIN OR STANDARD MENU VIEW FOR OTHER ROLES
                   ──────────────────────────────────────────────────────── */
                <View>
                    {(roleName || '').toLowerCase() === 'hospitaladmin' || (roleName || '').toLowerCase() === 'hospital admin' ? (
                        <>
                            <HospitalAdminHeroCard greeting={greeting} userName={userName} />
                            <HospitalAdminQuickOps navigation={navigation} />
                        </>
                    ) : (
                        <>
                            {/* Welcome Hero */}
                            <View style={styles.welcomeHero}>
                                <Text style={{ fontSize: 40, marginBottom: 8 }}>👋</Text>
                                <View style={styles.roleBadgeLarge}>
                                    <Text style={styles.roleBadgeLargeText}>{roleName}</Text>
                                </View>
                                <Text style={styles.welcomeHeroTitle}>{greeting}, <Text style={{ color: '#2563eb' }}>{userName}</Text></Text>
                                <Text style={styles.welcomeHeroSubtitle}>Here's your workspace. Pick any section to get started.</Text>
                            </View>

                            {/* Quick Access Cards */}
                            {navLinks.length > 0 ? (
                                <>
                                    <Text style={styles.sectionTitle}>⚡ Quick Access</Text>
                                    <View style={styles.navCardsGrid}>
                                        {navLinks.map((link, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.navCard}
                                                onPress={() => navigation.navigate(mapPathToScreen(link.path))}
                                            >
                                                <View style={styles.navCardIconBox}>
                                                    <Text style={styles.navCardIcon}>{getIconForPath(link.path, link.label)}</Text>
                                                </View>
                                                <View style={styles.navCardContent}>
                                                    <Text style={styles.navCardTitle}>{link.label}</Text>
                                                    <Text style={styles.navCardDesc}>{getDescForLink(link.label)}</Text>
                                                </View>
                                                <Text style={styles.navCardArrow}>→</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.emptyState}>
                                    <Text style={{ fontSize: 40, marginBottom: 16 }}>📭</Text>
                                    <Text style={styles.emptyStateTitle}>No pages assigned yet</Text>
                                    <Text style={styles.emptyStateDesc}>Contact your superadmin to set up navigation links for your role.</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            )}

            {/* VITALS MODAL */}
            <Modal visible={vitalsModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Record Vitals</Text>
                        <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                            Patient: <Text style={{ fontWeight: 'bold' }}>{vitalsModal.patient?.name}</Text>
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Height (cm)</Text>
                                <TextInput style={styles.input} value={vitalsForm.height} keyboardType="numeric" onChangeText={v => handleVitalsFormChange('height', v)} />
                            </View>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Weight (kg)</Text>
                                <TextInput style={styles.input} value={vitalsForm.weight} keyboardType="numeric" onChangeText={v => handleVitalsFormChange('weight', v)} />
                            </View>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Blood Group</Text>
                                <TextInput style={styles.input} value={vitalsForm.bloodGroup} onChangeText={v => handleVitalsFormChange('bloodGroup', v)} />
                            </View>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Blood Pressure</Text>
                                <TextInput style={styles.input} placeholder="120/80" value={vitalsForm.bp} onChangeText={v => handleVitalsFormChange('bp', v)} />
                            </View>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Pulse (bpm)</Text>
                                <TextInput style={styles.input} value={vitalsForm.pulse} keyboardType="numeric" onChangeText={v => handleVitalsFormChange('pulse', v)} />
                            </View>
                            <View style={{ width: '47%' }}>
                                <Text style={styles.label}>Temp (°F)</Text>
                                <TextInput style={styles.input} value={vitalsForm.temp} keyboardType="numeric" onChangeText={v => handleVitalsFormChange('temp', v)} />
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setVitalsModal({ open: false, patient: null })}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#16a34a' }]} onPress={handleVitalsSubmit} disabled={savingVitals}>
                                <Text style={styles.btnPrimaryText}>{savingVitals ? 'Saving...' : 'Save Vitals'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* UPLOAD REPORT MODAL */}
            <Modal visible={uploadModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxWidth: 400 }]}>
                        <Text style={styles.modalTitle}>Upload Patient Report</Text>
                        <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                            Patient: <Text style={{ fontWeight: 'bold' }}>{uploadModal.patientName}</Text>
                        </Text>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.label}>Select File (PDF or Image)</Text>
                            <TouchableOpacity style={styles.fileInput} onPress={() => setSelectedReportFile({ name: 'document.pdf' })}>
                                <Text style={{ color: '#475569' }}>{selectedReportFile ? selectedReportFile.name : 'Tap to select file'}</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => { setSelectedReportFile(null); setUploadModal({ open: false, apptId: null, patientName: '' }); }}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#db2777' }]} onPress={handleReportSubmit}>
                                <Text style={styles.btnPrimaryText}>Upload</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* CONSULTATION HISTORY VIEW MODAL */}
            <Modal visible={consultModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#eff6ff', paddingBottom: 12 }}>
                            <Text style={styles.modalTitle}>Clinical Consult Sessions</Text>
                            <TouchableOpacity onPress={() => setConsultModal({ open: false, patient: null, sessions: [] })}>
                                <Text style={{ fontSize: 20, color: '#94a3b8' }}>✖</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                            Patient: <Text style={{ fontWeight: 'bold' }}>{consultModal.patient?.name}</Text>
                        </Text>
                        
                        <ScrollView style={{ maxHeight: 400 }}>
                            {consultModal.sessions.length === 0 ? (
                                <View style={{ padding: 30, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed' }}>
                                    <Text style={{ color: '#64748b' }}>No completed clinical consult sessions found.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 16 }}>
                                    {consultModal.sessions.map((sess) => (
                                        <View key={sess._id} style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, backgroundColor: '#f8fafc' }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text style={{ fontWeight: '700', color: '#1e293b' }}>Dr. {sess.doctorId?.name || sess.doctorName || 'N/A'}</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>{formatDate(sess.appointmentDate)} at {sess.appointmentTime}</Text>
                                            </View>
                                            <View style={{ gap: 6 }}>
                                                <Text style={{ fontSize: 14, color: '#334155' }}><Text style={{ fontWeight: 'bold' }}>Service:</Text> {sess.serviceName || 'Consultation'}</Text>
                                                {sess.diagnosis && <Text style={{ fontSize: 14, color: '#334155' }}><Text style={{ fontWeight: 'bold' }}>Diagnosis:</Text> {sess.diagnosis}</Text>}
                                                {sess.notes && <Text style={{ fontSize: 14, color: '#334155' }}><Text style={{ fontWeight: 'bold' }}>Doctor Notes:</Text> {sess.notes}</Text>}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 }}>
                            <TouchableOpacity style={styles.btnPrimary} onPress={() => setConsultModal({ open: false, patient: null, sessions: [] })}>
                                <Text style={styles.btnPrimaryText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Permissions Preview */}
            {permissions.length > 0 && (
                <View style={styles.permissionsSection}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 12 }}>🔐 Your Permissions</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {permissions.map((perm, i) => (
                            <View key={i} style={styles.permTag}>
                                <Text style={styles.permTagText}>{perm.replace(/_/g, ' ')}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    welcomeHero: { backgroundColor: '#ffffff', borderRadius: 24, padding: 40, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    roleBadgeLarge: { backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
    roleBadgeLargeText: { color: '#2563eb', fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
    welcomeHeroTitle: { fontSize: 26, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
    welcomeHeroSubtitle: { fontSize: 15, color: '#64748b', fontWeight: '500', textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
    navCardsGrid: { gap: 16 },
    navCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    navCardIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    navCardIcon: { fontSize: 24 },
    navCardContent: { flex: 1 },
    navCardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    navCardDesc: { fontSize: 13, color: '#64748b' },
    navCardArrow: { fontSize: 20, color: '#94a3b8' },
    adminCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
    haOpsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    haOpCard: { flex: 1, minWidth: 260, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1 },
    emptyState: { alignItems: 'center', padding: 60, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    emptyStateDesc: { fontSize: 15, color: '#64748b', textAlign: 'center' },
    statsCard: { flex: 1, minWidth: 280, backgroundColor: '#ffffff', borderRadius: 12, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    statsIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statsValue: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
    statsLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', letterSpacing: 0.5 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
    toggleGroup: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 3, alignSelf: 'flex-start' },
    toggleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    toggleBtnActive: { backgroundColor: '#2563eb' },
    toggleBtnText: { color: '#475569', fontSize: 14, fontWeight: '700' },
    toggleBtnTextActive: { color: '#ffffff' },
    tableCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
    avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    avatarSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    avatarTextSmall: { color: '#fff', fontWeight: '800', fontSize: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
    statusBadgeText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
    actionBtnText: { fontSize: 12, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 600, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
    label: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
    input: { width: '100%', padding: 10, borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 8, backgroundColor: '#fff' },
    fileInput: { width: '100%', padding: 14, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, backgroundColor: '#f8fafc', alignItems: 'center' },
    btnPrimary: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 6, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    btnSecondary: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 6, alignItems: 'center' },
    btnSecondaryText: { color: '#475569', fontWeight: '600', fontSize: 15 },
    permissionsSection: { marginTop: 40, padding: 24, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    permTag: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    permTagText: { fontSize: 13, color: '#475569', fontWeight: '600', textTransform: 'capitalize' },
});

const haStyles = StyleSheet.create({
    heroCard: {
        position: 'relative',
        borderRadius: 22,
        paddingHorizontal: 28,
        paddingVertical: 24,
        minHeight: 178,
        borderWidth: 1.5,
        borderColor: '#dbeafe',
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    dotMatrix: {
        position: 'absolute',
        top: 14,
        left: 18,
        width: 48,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        zIndex: 1,
    },
    dot: {
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: '#93c5fd',
        opacity: 0.65,
    },
    sparklesWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 2,
    },
    sparkle: {
        position: 'absolute',
        fontWeight: '800',
        opacity: 0.75,
    },
    waveContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: 450,
        height: 100,
        zIndex: 1,
    },
    heroInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 3,
        flex: 1,
        gap: 16,
    },
    heroInnerMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    orbContainer: {
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
    },
    orbHaloGlow: {
        position: 'absolute',
        width: 105,
        height: 105,
        borderRadius: 55,
        backgroundColor: 'rgba(56, 189, 248, 0.22)',
    },
    orbSwirlRing: {
        position: 'absolute',
        borderRadius: 60,
    },
    ring1: {
        width: 104,
        height: 104,
        borderWidth: 1.5,
        borderColor: 'rgba(56, 189, 248, 0.55)',
    },
    ring2: {
        width: 88,
        height: 88,
        borderWidth: 1.2,
        borderColor: 'rgba(96, 165, 250, 0.45)',
        borderStyle: 'dashed',
    },
    orbSwirlNode: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#38bdf8',
        shadowColor: '#38bdf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
    },
    node1: {
        top: 8,
        right: 10,
    },
    node2: {
        bottom: 10,
        left: 8,
    },
    crystalSphere: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(224, 242, 254, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#bae6fd',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
    },
    cross3d: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    crossArmH: {
        position: 'absolute',
        width: 34,
        height: 11,
        backgroundColor: '#0284c7',
        borderRadius: 3,
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
    },
    crossArmV: {
        position: 'absolute',
        width: 11,
        height: 34,
        backgroundColor: '#0284c7',
        borderRadius: 3,
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
    },
    crossCoreShine: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.9)',
        top: 9,
        left: 9,
    },
    centerInfo: {
        flex: 1,
        marginLeft: 8,
        minWidth: 200,
    },
    greetingWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    greetingText: {
        fontSize: 24,
        fontWeight: '850',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    greetingPrefix: {
        color: '#0f172a',
        fontWeight: '800',
    },
    animatedUsername: {
        color: '#2563eb',
        fontWeight: '900',
    },
    guillemet: {
        color: '#06b6d4',
        fontWeight: '900',
    },
    subtitleText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    tealAccentBar: {
        width: 44,
        height: 3.5,
        backgroundColor: '#06b6d4',
        borderRadius: 2,
        marginTop: 8,
    },
    buildingContainer: {
        width: 250,
        height: 150,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        flexShrink: 0,
    },
    quickOpsCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 22,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    quickOpsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
    },
    lightningIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ecfeff',
        borderWidth: 1.5,
        borderColor: '#a5f3fc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickOpsTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0f172a',
    },
    quickOpsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    gridCol1: {
        width: '100%',
    },
    gridCol2: {
        width: '100%',
    },
    gridCol3: {
        width: '100%',
    },
    quickCard: {
        flex: 1,
        minWidth: 280,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        gap: 14,
    },
    quickCardIconBox: {
        width: 46,
        height: 46,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickCardInfo: {
        flex: 1,
    },
    quickCardName: {
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 2,
    },
    quickCardDesc: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    quickCardChevron: {
        fontSize: 20,
        fontWeight: '800',
    },
});

export default RoleDashboard;
