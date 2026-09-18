import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, Platform, 
    useWindowDimensions, Linking, Image, ActivityIndicator, TextInput, Alert 
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Rect, G } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { hospitalAPI, rnBuildAPI } from '../../utils/api';

function WhiteLabelBuilder({ hospital }) {
    const hospitalId = hospital?._id || hospital?.id;
    const initialStatus = hospital?.appConfig?.rnBuildStatus || 'NOT_BUILT';
    const [status, setStatus] = useState(initialStatus);
    const [apkUrl, setApkUrl] = useState(initialStatus === 'COMPLETED' ? (hospital?.appConfig?.rnApkUrl || '') : '');
    const [aabUrl, setAabUrl] = useState(initialStatus === 'COMPLETED' ? (hospital?.appConfig?.rnAabUrl || '') : '');
    const [buildError, setBuildError] = useState(hospital?.appConfig?.rnBuildError || '');
    const [isTriggering, setIsTriggering] = useState(false);

    useEffect(() => {
        if (hospital?.appConfig) {
            const currentStatus = hospital.appConfig.rnBuildStatus || 'NOT_BUILT';
            setStatus(currentStatus);
            setApkUrl(currentStatus === 'COMPLETED' ? (hospital.appConfig.rnApkUrl || '') : '');
            setAabUrl(currentStatus === 'COMPLETED' ? (hospital.appConfig.rnAabUrl || '') : '');
            setBuildError(hospital.appConfig.rnBuildError || '');
        }
    }, [hospital?._id, hospital?.appConfig?.rnBuildStatus, hospital?.appConfig?.rnBuildError]);

    useEffect(() => {
        let interval;
        if ((status === 'BUILDING' || status === 'PROCESSING') && hospitalId) {
            interval = setInterval(async () => {
                try {
                    const res = await rnBuildAPI.getBuildStatus(hospitalId);
                    if (res?.success) {
                        setStatus(res.buildStatus);
                        if (res.buildStatus === 'COMPLETED') {
                            setApkUrl(res.apkUrl || '');
                            setAabUrl(res.aabUrl || '');
                            setBuildError('');
                        } else {
                            setApkUrl('');
                            setAabUrl('');
                            if (res.buildStatus === 'FAILED') {
                                setBuildError(res.buildError || 'Build failed');
                            }
                        }
                    }
                } catch (err) {
                    console.error('Polling RN build status failed:', err);
                }
            }, 10000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, hospitalId]);

    const handleBuild = async () => {
        if (!hospitalId || isTriggering || status === 'BUILDING' || status === 'PROCESSING') return;
        setIsTriggering(true);
        setStatus('BUILDING');
        setBuildError('');
        try {
            const res = await rnBuildAPI.buildApp(hospitalId);
            if (res?.success) {
                setStatus('BUILDING');
                setBuildError('');
            } else {
                setStatus('FAILED');
                setBuildError(res?.message || 'Failed to trigger build');
            }
        } catch (err) {
            setStatus('FAILED');
            setBuildError(err?.response?.data?.message || err?.message || 'Network error');
        } finally {
            setIsTriggering(false);
        }
    };

    const handleReset = async () => {
        if (!hospitalId) return;
        try {
            await rnBuildAPI.resetBuild(hospitalId);
            setStatus('NOT_BUILT');
            setApkUrl('');
            setAabUrl('');
            setBuildError('');
        } catch (err) {
            console.error('Reset RN build error:', err);
        }
    };

    const handleDownload = (type) => {
        const url = type === 'apk' ? rnBuildAPI.getApkDownloadUrl(hospitalId) : rnBuildAPI.getAabDownloadUrl(hospitalId);
        Linking.openURL(url).catch(err => console.error("Couldn't open download URL", err));
    };

    return (
        <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="smartphone" size={18} color="#6366f1" />
                    <Text style={styles.sectionTitle}>White-Label Mobile App</Text>
                </View>
                <Text style={styles.sectionSubtitle}>Android APK & AAB Builder</Text>
            </View>

            <View style={styles.wlContainer}>
                <View style={styles.wlStatusRow}>
                    {status === 'NOT_BUILT' && (
                        <View style={styles.wlStatusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: '#64748b' }]} />
                            <Text style={{ fontSize: 13, color: '#64748b', fontWeight: '600' }}>Not Built</Text>
                        </View>
                    )}
                    {(status === 'BUILDING' || status === 'PROCESSING') && (
                        <View style={[styles.wlStatusBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                            <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 13, color: '#d97706', fontWeight: '600' }}>
                                {status === 'PROCESSING' ? 'Processing Artifacts...' : 'Building Android Package...'}
                            </Text>
                        </View>
                    )}
                    {status === 'COMPLETED' && (
                        <View style={[styles.wlStatusBadge, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                            <View style={[styles.statusDot, { backgroundColor: '#16a34a' }]} />
                            <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '600' }}>Build Ready</Text>
                        </View>
                    )}
                    {status === 'FAILED' && (
                        <View style={[styles.wlStatusBadge, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                            <View style={[styles.statusDot, { backgroundColor: '#dc2626' }]} />
                            <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: '600' }}>Build Failed</Text>
                        </View>
                    )}
                </View>

                {buildError ? (
                    <Text style={styles.wlErrorText}>Error: {buildError}</Text>
                ) : null}

                <View style={styles.wlActionsRow}>
                    {status !== 'BUILDING' && status !== 'PROCESSING' && (
                        <TouchableOpacity
                            style={[styles.wlBtn, styles.wlBuildBtn, isTriggering && { opacity: 0.7 }]}
                            onPress={handleBuild}
                            disabled={isTriggering}
                        >
                            {isTriggering ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Text style={styles.wlBuildBtnText}>
                                    {status === 'COMPLETED' ? '🔄 Rebuild App' : '⚡ Start Cloud Build'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                    {status === 'FAILED' && (
                        <TouchableOpacity style={[styles.wlBtn, styles.wlResetBtn]} onPress={handleReset}>
                            <Text style={styles.wlResetBtnText}>Reset Build</Text>
                        </TouchableOpacity>
                    )}
                    {status === 'COMPLETED' && Boolean(apkUrl) && (
                        <TouchableOpacity
                            style={[styles.wlBtn, styles.wlDownloadBtn]}
                            onPress={() => handleDownload('apk')}
                        >
                            <Text style={styles.wlBuildBtnText}>📥 Download APK</Text>
                        </TouchableOpacity>
                    )}
                    {status === 'COMPLETED' && Boolean(aabUrl) && (
                        <TouchableOpacity
                            style={[styles.wlBtn, styles.wlDownloadBtn, { backgroundColor: '#8b5cf6' }]}
                            onPress={() => handleDownload('aab')}
                        >
                            <Text style={styles.wlBuildBtnText}>🚀 Download AAB</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function CentralAdminHospitalDetails({ hospital, onBack }) {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const isTablet = width >= 768 && width < 1024;
    const isMobile = width < 768;

    const [datePreset, setDatePreset] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [statsData, setStatsData] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [statsError, setStatsError] = useState('');

    const [apptMode, setApptMode] = useState(hospital?.appointmentMode || 'slot');
    const [savingApptMode, setSavingApptMode] = useState(false);
    const [apptModeSuccess, setApptModeSuccess] = useState('');
    const [apptModeError, setApptModeError] = useState('');

    // Staff Table states
    const [staffSearch, setStaffSearch] = useState('');
    const [staffRoleFilter, setStaffRoleFilter] = useState('all');
    const [chartRange, setChartRange] = useState('this_month');

    useEffect(() => {
        fetchStats(datePreset);
    }, [hospital?._id, datePreset]);

    const fetchStats = async (preset, customStart, customEnd) => {
        if (!hospital?._id) return;
        setLoadingStats(true);
        setStatsError('');
        try {
            let queryStart = '';
            let queryEnd = '';

            if (preset === 'custom' && customStart && customEnd) {
                queryStart = new Date(customStart).toISOString();
                queryEnd = new Date(customEnd).toISOString();
            } else if (preset !== 'all' && preset !== 'custom') {
                const now = new Date();
                const endD = new Date(now);
                const startD = new Date(now);

                if (preset === 'today') {
                    startD.setHours(0, 0, 0, 0);
                    endD.setHours(23, 59, 59, 999);
                } else if (preset === '30') {
                    startD.setDate(startD.getDate() - 30);
                } else if (preset === '60') {
                    startD.setDate(startD.getDate() - 60);
                } else if (preset === '90') {
                    startD.setDate(startD.getDate() - 90);
                }

                queryStart = startD.toISOString();
                queryEnd = endD.toISOString();
            }

            const res = await hospitalAPI.getHospitalStats(hospital._id, queryStart, queryEnd);
            if (res?.success) {
                setStatsData(res);
            } else {
                setStatsError(res?.message || 'Failed to load hospital statistics');
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
            setStatsError(err?.response?.data?.message || 'Error loading live hospital stats');
        } finally {
            setLoadingStats(false);
        }
    };

    const handleApplyCustom = () => {
        if (!customStartDate || !customEndDate) {
            Alert.alert('Date Range Required', 'Please select both start and end dates.');
            return;
        }
        setDatePreset('custom');
        fetchStats('custom', customStartDate, customEndDate);
    };

    const handleSaveApptMode = async () => {
        if (!hospital?._id) return;
        setSavingApptMode(true);
        setApptModeSuccess('');
        setApptModeError('');
        try {
            const res = await hospitalAPI.updateAppointmentMode(hospital._id, apptMode);
            if (res?.success !== false) {
                setApptModeSuccess('Appointment mode updated successfully.');
                if (hospital) hospital.appointmentMode = apptMode;
            } else {
                setApptModeError(res?.message || 'Failed to save appointment mode');
            }
        } catch (err) {
            setApptModeError(err?.response?.data?.message || 'Failed to update appointment mode');
        } finally {
            setSavingApptMode(false);
        }
    };

    const handleOpenURL = (url) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    const formatCurrency = (amount) => '₹' + Number(amount || 0).toLocaleString('en-IN');

    const features = [
        { label: 'Doctors', icon: '👩‍⚕️', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', route: 'AdminDoctors' },
        { label: 'Staff', icon: '👥', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', route: 'Admin' },
        { label: 'Roles', icon: '🔑', color: '#7e22ce', bg: '#faf5ff', border: '#e9d5ff', route: 'AdminRoles' },
        { label: 'Labs', icon: '🧪', color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe', route: 'AdminLabs' },
        { label: 'Lab Tests', icon: '📋', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', route: 'AdminLabTests' },
        { label: 'Pharmacy', icon: '💊', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', route: 'AdminPharmacy' },
        { label: 'Reception', icon: '🏥', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0', route: 'AdminReception' },
        { label: 'Services', icon: '🛠️', color: '#a16207', bg: '#fefce8', border: '#fef08a', route: 'AdminServices' },
        { label: 'Medicines', icon: '💉', color: '#be123c', bg: '#fff1f2', border: '#fecdd3', route: 'AdminMedicines' },
    ];

    const handleFeatureClick = (feature) => {
        const hid = hospital?._id || hospital?.id;
        if (feature.route) {
            navigation.navigate(feature.route, { hospitalId: hid });
        } else {
            Alert.alert(
                feature.label, 
                `The "${feature.label}" screen is not registered for Central Admin in RoleStacks.`
            );
        }
    };

    // Live Stats derived from backend response
    const s = statsData?.stats || {};
    const totalStaff = s?.totalStaff ?? 0;
    const uniquePatients = s?.totalPatients ?? s?.uniquePatients ?? 0;
    const totalAppointments = s?.totalAppointments ?? 0;
    const completedAppointments = s?.completedAppointments ?? 0;
    const pendingAppointments = s?.pendingAppointments ?? 0;
    const totalRevenue = s?.totalRevenue ?? 0;
    const totalSixMonthRevenue = s?.totalSixMonthRevenue ?? (s?.monthlyRevenue?.reduce((acc, m) => acc + (m.revenue || 0), 0) ?? totalRevenue);
    const appointmentsToRender = statsData?.recentAppointments || [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const curM = monthNames[now.getMonth()];
    const prevM = monthNames[(now.getMonth() - 1 + 12) % 12];
    const dateLabels = chartRange === 'last_month' 
        ? [`01 ${prevM}`, `05 ${prevM}`, `10 ${prevM}`, `15 ${prevM}`, `20 ${prevM}`, `25 ${prevM}`, `30 ${prevM}`]
        : chartRange === 'this_year'
            ? ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec']
            : [`01 ${curM}`, `05 ${curM}`, `10 ${curM}`, `15 ${curM}`, `20 ${curM}`, `25 ${curM}`, `30 ${curM}`];

    // Staff List derived from backend response
    const rawStaffList = statsData?.staffList || s?.staff || [];
    const staffListWithoutPatients = rawStaffList.filter(st => {
        const r = (st.roleName || st.role || '').toLowerCase();
        return !['patient', 'patients'].includes(r);
    });

    const uniqueRoleNames = ['all', ...new Set(
        staffListWithoutPatients.map(st => st.roleName || st.role).filter(Boolean)
    )];

    const filteredStaff = staffListWithoutPatients.filter(st => {
        if (staffRoleFilter !== 'all') {
            const r = (st.roleName || st.role || '').toLowerCase();
            if (r !== staffRoleFilter.toLowerCase()) return false;
        }
        if (staffSearch.trim()) {
            const q = staffSearch.toLowerCase().trim();
            const name = (st.name || '').toLowerCase();
            const email = (st.email || '').toLowerCase();
            const phone = (st.phone || '').toLowerCase();
            const role = (st.roleName || st.role || '').toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || role.includes(q);
        }
        return true;
    });

    const logoUrl = hospital?.brandingSchema?.logoUrl || hospital?.branding?.logoUrl;
    const hospitalName = hospital?.name || 'Apollo Hospital';
    const hospitalLocation = hospital?.city ? `${hospital.city}${hospital.state ? `, ${hospital.state}` : ''}` : (hospital?.address || 'Jaipur, Rajasthan');
    const hospitalPhone = hospital?.phone || '8795719836';
    const doctorCount = s?.doctorCount ?? s?.totalDoctors ?? s?.staffCounts?.doctor ?? 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* 1. Hospital Profile Hero Header Banner (100% Web Parity with SVG Wave, Hexagon Logo, ECG Heartbeat Widget) */}
            <View style={styles.heroBanner}>
                {/* Left Organic Deep Blue / Indigo Wave Background (Desktop/Tablet only, matching Web 1:1) */}
                {!isMobile && (
                    <View style={styles.heroWaves}>
                        <Svg style={styles.heroWaveSvg} viewBox="0 0 280 280" preserveAspectRatio="none">
                            <Defs>
                                <SvgLinearGradient id="heroBlueDeep" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#081038" />
                                    <Stop offset="28%" stopColor="#131e5c" />
                                    <Stop offset="55%" stopColor="#2e1a6b" />
                                    <Stop offset="78%" stopColor="#4c1d95" />
                                    <Stop offset="100%" stopColor="#6366f1" />
                                </SvgLinearGradient>
                                <SvgLinearGradient id="heroBlueEdge" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#38bdf8" />
                                    <Stop offset="45%" stopColor="#818cf8" />
                                    <Stop offset="80%" stopColor="#a855f7" />
                                    <Stop offset="100%" stopColor="#c084fc" />
                                </SvgLinearGradient>
                            </Defs>
                            <Path d="M0 0 L265 0 C215 55 225 120 185 180 C145 230 100 280 0 280 Z" fill="url(#heroBlueDeep)" />
                            <Path d="M265 0 C215 55 225 120 185 180 C145 230 100 280 0 280" fill="none" stroke="url(#heroBlueEdge)" strokeWidth="3.5" strokeOpacity="0.95" />
                        </Svg>
                        {/* Bottom Left Dot Matrix */}
                        <View style={styles.heroDarkDotMatrix}>
                            {Array.from({ length: 16 }).map((_, i) => (
                                <View key={i} style={styles.heroMatrixDot} />
                            ))}
                        </View>
                    </View>
                )}

                {/* Top Row: Left "Hospital Profile" Badge + Right Compact "← Back" Button */}
                <View style={styles.heroTopRow}>
                    <View style={styles.profilePill}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="#38bdf8">
                            <Path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
                            <Path d="M9 12l2 2 4-4" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.profilePillText}>Hospital Profile</Text>
                    </View>

                    <Pressable 
                        style={({ pressed, hovered }) => [
                            styles.topBackBtn,
                            Platform.select({ web: { transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' } }),
                            hovered && {
                                backgroundColor: 'rgba(22, 38, 110, 0.95)',
                                borderColor: '#7dd3fc',
                                transform: [{ translateY: -2 }, { scale: 1.02 }],
                                ...Platform.select({
                                    web: {
                                        boxShadow: '0 5px 16px rgba(56, 189, 248, 0.4)',
                                    }
                                })
                            },
                            pressed && {
                                transform: [{ scale: 0.97 }]
                            }
                        ]} 
                        onPress={onBack}
                    >
                        <Text style={styles.topBackArrow}>←</Text>
                        <Text style={styles.topBackText}>Back</Text>
                    </Pressable>
                </View>

                {/* Main Hero Upper Content */}
                <View style={[styles.heroContent, isMobile && { flexDirection: 'column', alignItems: 'center' }]}>
                    {/* 3D Hexagon Hospital Logo with Orbital Planetary Rings */}
                    <View style={styles.hexLogoContainer}>
                        <View style={styles.hexOrbitRing} />
                        <View style={[styles.hexOrbitNode, styles.nodeA]} />
                        <View style={[styles.hexOrbitNode, styles.nodeB]} />
                        <View style={[styles.hexOrbitNode, styles.nodeC]} />

                        <Svg width={78} height={86} viewBox="0 0 100 115">
                            <Defs>
                                <SvgLinearGradient id="hexOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#ffffff" />
                                    <Stop offset="100%" stopColor="#f0fdf4" />
                                </SvgLinearGradient>
                            </Defs>
                            <Path d="M50 2 L98 29 L98 86 L50 113 L2 86 L2 29 Z" fill="url(#hexOuterGrad)" stroke="#86efac" strokeWidth="2.5" />
                            <Path d="M50 9 L91 32 L91 83 L50 106 L9 83 L9 32 Z" fill="#ffffff" />
                        </Svg>

                        <View style={styles.hexLogoCenterWrap}>
                            {logoUrl ? (
                                <Image source={{ uri: logoUrl }} style={styles.hexImg} resizeMode="contain" />
                            ) : (
                                <View style={styles.redCrossBox}>
                                    <View style={styles.crossArmH} />
                                    <View style={styles.crossArmV} />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Center Hospital Info */}
                    <View style={[styles.heroInfo, isMobile && { marginVertical: 10, paddingHorizontal: 4 }]}>
                        {/* Top 5x4 Dot Matrix Pattern */}
                        <View style={styles.centerDotMatrix}>
                            {Array.from({ length: 20 }).map((_, i) => (
                                <View key={i} style={styles.centerMatrixDot} />
                            ))}
                        </View>

                        {/* Title */}
                        <Text style={styles.heroTitle}>{hospitalName}</Text>

                        {/* Progress Underline Accent Bar */}
                        <View style={styles.heroAccentBar}>
                            <View style={styles.accentBarFill} />
                            <View style={styles.accentBarDot} />
                        </View>

                        {/* Meta Pills: Location & Phone */}
                        <View style={styles.heroMetaRow}>
                            <View style={styles.metaChip}>
                                <View style={[styles.metaChipIcon, styles.pinIcon]}>
                                    <Feather name="map-pin" size={11} color="#4f46e5" />
                                </View>
                                <Text style={styles.metaChipText}>{hospitalLocation}</Text>
                            </View>
                            <View style={styles.metaSep} />
                            <View style={styles.metaChip}>
                                <View style={[styles.metaChipIcon, styles.phoneIcon]}>
                                    <Feather name="phone" size={11} color="#0d9488" />
                                </View>
                                <Text style={styles.metaChipText}>{hospitalPhone}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right: ECG Heartbeat Widget */}
                    {!isMobile && (
                        <View style={styles.heroRightCol}>
                            <View style={styles.ecgWidget}>
                                <Svg width={185} height={58} viewBox="0 0 230 76">
                                    <Defs>
                                        <SvgLinearGradient id="ecgLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <Stop offset="0%" stopColor="#38bdf8" />
                                            <Stop offset="45%" stopColor="#0284c7" />
                                            <Stop offset="85%" stopColor="#2563eb" />
                                            <Stop offset="100%" stopColor="#10b981" />
                                        </SvgLinearGradient>
                                    </Defs>
                                    {/* Dot grid points */}
                                    {Array.from({ length: 18 }).map((_, r) =>
                                        Array.from({ length: 6 }).map((__, c) => (
                                            <Circle key={`${r}-${c}`} cx={12 + r * 12} cy={8 + c * 11} r={0.9} fill="#93c5fd" fillOpacity={0.4} />
                                        ))
                                    )}
                                    {/* Static trace */}
                                    <Path 
                                        d="M 12 40 H 42 L 48 34 L 54 44 L 66 10 L 76 68 L 83 38 L 89 43 L 130 40 L 138 52 L 148 18 L 158 55 L 164 40 L 198 40" 
                                        stroke="#e0f2fe" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                    />
                                    {/* Glowing ECG Pulse Line */}
                                    <Path 
                                        d="M 12 40 H 42 L 48 34 L 54 44 L 66 10 L 76 68 L 83 38 L 89 43 L 130 40 L 138 52 L 148 18 L 158 55 L 164 40 L 198 40" 
                                        stroke="url(#ecgLineGrad)" 
                                        strokeWidth="2.8" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                    />
                                    {/* Green Radar Signal End Node with Expanding Ripples */}
                                    <Circle cx={198} cy={40} r={16} fill="#10b981" fillOpacity={0.15} />
                                    <Circle cx={198} cy={40} r={10} stroke="#10b981" strokeWidth={1} fill="none" opacity={0.6} />
                                    <Circle cx={198} cy={40} r={7} fill="#a7f3d0" fillOpacity={0.75} />
                                    <Circle cx={198} cy={40} r={4.5} fill="#10b981" />
                                    <Circle cx={197} cy={39} r={1.5} fill="#ffffff" />
                                </Svg>
                            </View>
                        </View>
                    )}
                </View>

                {/* Bottom Floating Stats & Real-time Status Bar */}
                <View style={[styles.heroBottomBar, isMobile && { width: '100%', maxWidth: '100%', flexDirection: 'column', gap: 10, paddingVertical: 10 }]}>
                    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }, isMobile && { width: '100%' }]}>
                        <View style={styles.bottomStatItem}>
                            <View style={[styles.bottomStatIcon, styles.iconShield]}>
                                <Feather name="shield" size={12} color="#6366f1" />
                            </View>
                            <View style={styles.bottomStatText}>
                                <Text style={styles.bottomStatLabel}>Trusted Care</Text>
                                <Text style={styles.bottomStatVal}>24/7</Text>
                            </View>
                        </View>

                        <View style={styles.bottomStatSep} />

                        <View style={styles.bottomStatItem}>
                            <View style={[styles.bottomStatIcon, styles.iconDoctors]}>
                                <Feather name="user" size={12} color="#0d9488" />
                            </View>
                            <View style={styles.bottomStatText}>
                                <Text style={styles.bottomStatLabel}>Expert Doctors</Text>
                                <Text style={styles.bottomStatVal}>{doctorCount}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right Status Capsule with ECG wave inside */}
                    <View style={[styles.bottomStatRight, isMobile && { width: '100%', alignItems: 'center', justifyContent: 'center' }]}>
                        <View style={[styles.statusCapsule, hospital?.isActive === false && styles.statusCapsuleInactive, isMobile && { width: '100%', justifyContent: 'center' }]}>
                            <View style={styles.liveDot} />
                            <Text style={styles.statusCapsuleName}>{hospital?.isActive === false ? 'INACTIVE' : 'ACTIVE'}</Text>
                            <View style={styles.statusEcgWrap}>
                                <Svg viewBox="0 0 60 24" style={{ width: 36, height: 14 }}>
                                    <Path d="M0 12 L15 12 L20 4 L25 20 L30 8 L35 16 L40 12 L60 12" stroke="#16a34a" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* 2. Analytics Timeframe Bar */}
            <View style={styles.timeframeCard}>
                <View style={[styles.timeframeHead, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
                    <View style={styles.timeframeTitleGroup}>
                        <View style={styles.purpleIconCircle}>
                            <Feather name="calendar" size={16} color="#6366f1" />
                        </View>
                        <Text style={styles.timeframeTitle}>Analytics Timeframe</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {loadingStats && <ActivityIndicator size="small" color="#6366f1" />}
                        <Text style={styles.timeframeSubtitle}>Choose a reporting period</Text>
                    </View>
                </View>

                {statsError ? (
                    <View style={{ backgroundColor: '#fef2f2', padding: 10, borderRadius: 8 }}>
                        <Text style={{ color: '#ef4444', fontSize: 12 }}>{statsError}</Text>
                    </View>
                ) : null}

                <View style={[styles.timeframeControls, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    {/* Presets Group */}
                    <View style={styles.presetGroup}>
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'today', label: 'Today' },
                            { key: '30', label: '30 Days' },
                        ].map(p => (
                            <TouchableOpacity
                                key={p.key}
                                style={[styles.presetBtn, datePreset === p.key && styles.presetBtnActive]}
                                onPress={() => setDatePreset(p.key)}
                            >
                                <Text style={[styles.presetBtnText, datePreset === p.key && styles.presetBtnTextActive]}>
                                    {p.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Date Picker Range Inputs */}
                    <View style={[styles.datePickerGroup, isMobile && { width: '100%', marginTop: 8 }]}>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="YYYY-MM-DD"
                            value={customStartDate}
                            onChangeText={setCustomStartDate}
                            placeholderTextColor="#94a3b8"
                        />
                        <Text style={styles.dateSep}>to</Text>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="YYYY-MM-DD"
                            value={customEndDate}
                            onChangeText={setCustomEndDate}
                            placeholderTextColor="#94a3b8"
                        />
                        <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCustom}>
                            <Text style={styles.applyBtnText}>Apply Custom</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* 3. 4 KPI Stat Cards (Modern Light Colorful Themes) */}
            <View style={[styles.kpiGrid, isMobile ? { flexDirection: 'column' } : (isTablet ? { flexWrap: 'wrap' } : {})]}>
                {/* 1. Green Theme: Total Staff */}
                <View style={[styles.kpiCard, styles.kpiCardGreen, isTablet && { width: '48%' }, isMobile && { width: '100%' }]}>
                    <View style={[styles.kpiIconWrap, { color: '#16a34a' }]}>
                        <Feather name="user" size={18} color="#16a34a" />
                    </View>
                    <Text style={[styles.kpiVal, { color: '#065f46' }]}>{totalStaff}</Text>
                    <Text style={[styles.kpiLbl, { color: '#166534' }]}>Total Staff</Text>
                    <Text style={[styles.kpiSub, { color: '#15803d' }]}>Active staff members</Text>
                    <View style={[styles.kpiBar, { backgroundColor: '#34d399' }]} />
                </View>

                {/* 2. Blue Theme: Unique Patients */}
                <View style={[styles.kpiCard, styles.kpiCardBlue, isTablet && { width: '48%' }, isMobile && { width: '100%' }]}>
                    <View style={[styles.kpiIconWrap, { color: '#0284c7' }]}>
                        <Feather name="users" size={18} color="#0284c7" />
                    </View>
                    <Text style={[styles.kpiVal, { color: '#075985' }]}>{uniquePatients}</Text>
                    <Text style={[styles.kpiLbl, { color: '#0369a1' }]}>Unique Patients</Text>
                    <Text style={[styles.kpiSub, { color: '#0284c7' }]}>In selected period</Text>
                    <View style={[styles.kpiBar, { backgroundColor: '#38bdf8' }]} />
                </View>

                {/* 3. Purple Theme: Total Appointments */}
                <View style={[styles.kpiCard, styles.kpiCardPurple, isTablet && { width: '48%' }, isMobile && { width: '100%' }]}>
                    <View style={[styles.kpiIconWrap, { color: '#7c3aed' }]}>
                        <Feather name="calendar" size={18} color="#7c3aed" />
                    </View>
                    <Text style={[styles.kpiVal, { color: '#581c87' }]}>{totalAppointments}</Text>
                    <Text style={[styles.kpiLbl, { color: '#6b21a8' }]}>Total Appointments</Text>
                    <Text style={[styles.kpiSub, { color: '#7c3aed' }]}>In selected period</Text>
                    <View style={[styles.kpiBar, { backgroundColor: '#c084fc' }]} />
                </View>

                {/* 4. Orange Theme: Total Revenue */}
                <View style={[styles.kpiCard, styles.kpiCardOrange, isTablet && { width: '48%' }, isMobile && { width: '100%' }]}>
                    <View style={[styles.kpiIconWrap, { color: '#d97706' }]}>
                        <Text style={{ fontSize: 18, color: '#d97706', fontWeight: 'bold' }}>₹</Text>
                    </View>
                    <Text style={[styles.kpiVal, { color: '#78350f' }]}>{formatCurrency(totalRevenue)}</Text>
                    <Text style={[styles.kpiLbl, { color: '#92400e' }]}>Total Revenue</Text>
                    <Text style={[styles.kpiSub, { color: '#b45309' }]}>From paid appointments</Text>
                    <View style={[styles.kpiBar, { backgroundColor: '#fbbf24' }]} />
                </View>
            </View>

            {/* 4. Appointments Overview & Recent Appointments Grid */}
            <View style={[styles.middleGrid, isMobile && { flexDirection: 'column' }]}>
                {/* Left: Appointments Overview Chart */}
                <View style={[styles.chartCard, isMobile && { width: '100%' }]}>
                    <View style={styles.chartCardHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.purpleIconCircle}>
                                <Feather name="calendar" size={14} color="#6366f1" />
                            </View>
                            <Text style={styles.chartCardTitle}>Appointments Overview</Text>
                        </View>
                        <View style={styles.chartRangeButtonGroup}>
                            {[
                                { key: 'this_month', label: 'All Time' },
                                { key: 'last_month', label: 'Last Month' },
                                { key: 'this_year', label: 'This Year' },
                            ].map((r) => (
                                <TouchableOpacity
                                    key={r.key}
                                    style={[styles.chartRangeBtn, chartRange === r.key && styles.chartRangeBtnActive]}
                                    onPress={() => setChartRange(r.key)}
                                >
                                    <Text style={[styles.chartRangeBtnText, chartRange === r.key && styles.chartRangeBtnTextActive]}>
                                        {r.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Chart Mini Badges */}
                    <View style={styles.chartStatsRow}>
                        <View style={styles.chartStatBadge}>
                            <View style={[styles.chartDot, { backgroundColor: '#10b981' }]} />
                            <Text style={styles.chartStatLabel}>Completed:</Text>
                            <Text style={[styles.chartStatVal, { color: '#10b981' }]}>{completedAppointments}</Text>
                        </View>
                        <View style={styles.chartStatBadge}>
                            <View style={[styles.chartDot, { backgroundColor: '#f59e0b' }]} />
                            <Text style={styles.chartStatLabel}>Pending:</Text>
                            <Text style={[styles.chartStatVal, { color: '#f59e0b' }]}>{pendingAppointments}</Text>
                        </View>
                        <View style={styles.chartStatBadge}>
                            <View style={[styles.chartDot, { backgroundColor: '#6366f1' }]} />
                            <Text style={styles.chartStatLabel}>Total:</Text>
                            <Text style={[styles.chartStatVal, { color: '#6366f1' }]}>{totalAppointments}</Text>
                        </View>
                    </View>

                    {/* Chart Body */}
                    <View style={styles.chartBody}>
                        <View style={styles.chartYAxis}>
                            <Text style={styles.axisText}>40</Text>
                            <Text style={styles.axisText}>30</Text>
                            <Text style={styles.axisText}>20</Text>
                            <Text style={styles.axisText}>10</Text>
                            <Text style={styles.axisText}>0</Text>
                        </View>
                        <View style={styles.chartPlot}>
                            <View style={[styles.chartGridLine, { top: '0%' }]} />
                            <View style={[styles.chartGridLine, { top: '25%' }]} />
                            <View style={[styles.chartGridLine, { top: '50%' }]} />
                            <View style={[styles.chartGridLine, { top: '75%' }]} />
                            <View style={[styles.chartGridLine, { top: '100%' }]} />

                            <Svg viewBox="0 0 500 160" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
                                <Defs>
                                    <SvgLinearGradient id="detailPurpleArea" x1="0" y1="0" x2="0" y2="1">
                                        <Stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
                                        <Stop offset="100%" stopColor="#818cf8" stopOpacity="0.02" />
                                    </SvgLinearGradient>
                                </Defs>
                                <Path
                                    d="M0 130 C40 100, 70 115, 110 110 C140 105, 170 50, 200 55 C230 60, 260 120, 300 100 C340 85, 370 70, 410 75 C450 80, 480 75, 500 78 L500 160 L0 160 Z"
                                    fill="url(#detailPurpleArea)"
                                />
                                <Path
                                    d="M0 130 C40 100, 70 115, 110 110 C140 105, 170 50, 200 55 C230 60, 260 120, 300 100 C340 85, 370 70, 410 75 C450 80, 480 75, 500 78"
                                    fill="none"
                                    stroke="#6366f1"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                            </Svg>
                        </View>
                    </View>

                    {/* X-axis */}
                    <View style={styles.chartXAxis}>
                        {dateLabels.map((lbl, idx) => (
                            <Text key={idx} style={styles.axisText}>{lbl}</Text>
                        ))}
                    </View>
                </View>

                {/* Right: Recent Appointments mini-table */}
                <View style={[styles.summaryCard, isMobile && { width: '100%' }]}>
                    <View style={styles.chartCardHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.purpleIconCircle, { backgroundColor: '#ffedd5' }]}>
                                <Feather name="list" size={14} color="#ea580c" />
                            </View>
                            <Text style={styles.chartCardTitle}>
                                Recent Appointments ({appointmentsToRender.length} latest)
                            </Text>
                        </View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                        <View style={styles.recentApptTableContainer}>
                            <View style={styles.recentApptHeaderRow}>
                                <Text style={[styles.recentApptTh, { width: 130 }]}>PATIENT</Text>
                                <Text style={[styles.recentApptTh, { width: 120 }]}>DOCTOR</Text>
                                <Text style={[styles.recentApptTh, { width: 95 }]}>DATE</Text>
                                <Text style={[styles.recentApptTh, { width: 95 }]}>STATUS</Text>
                                <Text style={[styles.recentApptTh, { width: 80, textAlign: 'right' }]}>AMOUNT</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 210 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                {appointmentsToRender.length > 0 ? (
                                    appointmentsToRender.map((appt, idx) => {
                                        const pName = appt.userId?.name || appt.patientName || appt.patient || 'Patient';
                                        const dName = appt.doctorId?.name || appt.doctorName || appt.doctor || 'Doctor';
                                        const dateStr = appt.appointmentDate 
                                            ? new Date(appt.appointmentDate).toLocaleDateString('en-GB') 
                                            : (appt.date || '—');
                                        const statusStr = (appt.status || 'completed').toLowerCase();
                                        const amt = appt.amount || 0;

                                        return (
                                            <View key={appt._id || appt.id || idx} style={styles.recentApptDataRow}>
                                                <Text style={[styles.recentApptTd, { width: 130, fontWeight: '600', color: '#0f172a' }]} numberOfLines={1}>
                                                    {pName}
                                                </Text>
                                                <Text style={[styles.recentApptTd, { width: 120, color: '#475569' }]} numberOfLines={1}>
                                                    {dName}
                                                </Text>
                                                <Text style={[styles.recentApptTd, { width: 95, color: '#64748b', fontSize: 11 }]}>
                                                    {dateStr}
                                                </Text>
                                                <View style={{ width: 95, justifyContent: 'center' }}>
                                                    <View style={styles.statusCompletedBadge}>
                                                        <Text style={styles.statusCompletedText}>
                                                            {statusStr}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.recentApptTd, { width: 80, textAlign: 'right', fontWeight: '700', color: '#0f172a' }]}>
                                                    {formatCurrency(amt)}
                                                </Text>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <View style={{ paddingVertical: 36, paddingHorizontal: 16, alignItems: 'center' }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                                            No recent appointments found for this hospital in the selected timeframe.
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            </View>

            {/* 5. Exact Quick Feature Management (5-Column Desktop Grid) */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>⚡ Quick Feature Management</Text>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: 16, marginTop: -10 }]}>
                    Jump to manage specific features for this hospital.
                </Text>
                
                <View style={styles.featuresGrid}>
                    {features.map((feature, idx) => (
                        <Pressable 
                            key={idx} 
                            style={({ pressed, hovered }) => [
                                styles.featureBtn, 
                                { backgroundColor: feature.bg, borderColor: feature.border },
                                isDesktop && { width: '18.8%' },
                                isTablet && { width: '31%' },
                                isMobile && { width: '48%' },
                                Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } }),
                                hovered && {
                                    transform: [{ translateY: -1 }],
                                    opacity: 0.95,
                                    ...Platform.select({
                                        web: {
                                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                                            filter: 'brightness(0.95)',
                                        }
                                    })
                                },
                                pressed && {
                                    transform: [{ scale: 0.97 }]
                                }
                            ]}
                            onPress={() => handleFeatureClick(feature)}
                        >
                            <Text style={{ fontSize: 15, marginRight: 6 }}>{feature.icon}</Text>
                            <Text style={[styles.featureBtnText, { color: feature.color }]}>{feature.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* White Label Mobile App Builder */}
            <WhiteLabelBuilder hospital={hospital} />

            {/* 6. Appointment System Mode */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={styles.sectionTitle}>🎟️ Appointment System Mode</Text>
                        <View style={styles.badgeBlue}>
                            <Text style={styles.badgeBlueText}>
                                Current: {apptMode === 'token' ? 'Token Queue' : 'Time Slots'}
                            </Text>
                        </View>
                    </View>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: 16, marginTop: -10 }]}>
                    Choose your appointment system mode. You can switch between modes at any time.
                </Text>
                
                <View style={[styles.modeCardsRow, isMobile && { flexDirection: 'column' }]}>
                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'slot' && styles.modeCardActive, isMobile && { width: '100%', marginBottom: 10 }]} 
                        onPress={() => { setApptMode('slot'); setApptModeSuccess(''); setApptModeError(''); }}
                    >
                        <View style={[styles.modeIconBox, { backgroundColor: '#ede9fe' }]}>
                            <Feather name="clock" size={18} color="#6366f1" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.modeCardTitle}>Time Slot Booking</Text>
                                <View style={styles.badgePrimary}><Text style={styles.badgePrimaryText}>Recommended</Text></View>
                            </View>
                            <Text style={styles.modeCardDesc}>Patients pick a specific time (10:00, 10:30...). Doctor sees one time slot at a time.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'token' && styles.modeCardActive, isMobile && { width: '100%' }]} 
                        onPress={() => { setApptMode('token'); setApptModeSuccess(''); setApptModeError(''); }}
                    >
                        <View style={[styles.modeIconBox, { backgroundColor: '#fef3c7' }]}>
                            <Feather name="list" size={18} color="#d97706" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.modeCardTitle}>Token Queue System</Text>
                            <Text style={styles.modeCardDesc}>Sequential tokens (1, 2, 3...). 1 patient per day or live token updating board.</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {apptModeSuccess ? (
                    <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                        ✅ {apptModeSuccess}
                    </Text>
                ) : null}

                {apptModeError ? (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600', marginTop: 12 }}>
                        ❌ {apptModeError}
                    </Text>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                    <TouchableOpacity 
                        style={[styles.btnPrimary, savingApptMode && { opacity: 0.6 }]} 
                        onPress={handleSaveApptMode}
                        disabled={savingApptMode}
                    >
                        {savingApptMode ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.btnPrimaryText}>Save Mode</Text>
                        )}
                    </TouchableOpacity>
                    <Text style={{ marginLeft: 12, color: '#64748b', fontSize: 13 }}>
                        {apptMode === (hospital?.appointmentMode || 'slot') ? 'All changes are saved.' : 'Unsaved changes pending.'}
                    </Text>
                </View>
            </View>

            {/* 7. Hospital Info + Holographic AI Security Panel (2-Column Desktop Grid) */}
            <View style={styles.hospitalInfoCard}>
                <View style={[styles.infoCardLayout, !isDesktop && { flexDirection: 'column', gap: 24 }]}>
                    {/* Left Column: Colorful Single Column Hospital Info */}
                    <View style={[styles.infoLeftCol, !isDesktop && { width: '100%' }]}>
                        <View style={styles.infoHeaderRow}>
                            <View style={styles.aiGradientIcon}>
                                <Feather name="cpu" size={20} color="#ffffff" />
                            </View>
                            <View style={styles.infoHeaderTitles}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={styles.colTitle}>🏥 Hospital Info</Text>
                                    <View style={styles.aiSyncPill}>
                                        <View style={styles.aiPulseDot} />
                                        <Text style={styles.aiSyncPillText}>AI Synced</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <View style={styles.metaListColorful}>
                            {/* Email */}
                            <View style={[styles.metaRowColorful, styles.themeBlue]}>
                                <View style={styles.rowLeft}>
                                    <View style={[styles.chipIcon, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="mail" size={13} color="#2563eb" />
                                    </View>
                                    <Text style={[styles.rowKey, { color: '#1d4ed8' }]}>Email</Text>
                                </View>
                                <Text style={styles.rowVal}>{hospital?.email || '—'}</Text>
                            </View>

                            {/* Address */}
                            <View style={[styles.metaRowColorful, styles.themeAmber]}>
                                <View style={styles.rowLeft}>
                                    <View style={[styles.chipIcon, { backgroundColor: '#fffbeb' }]}>
                                        <Feather name="map-pin" size={13} color="#d97706" />
                                    </View>
                                    <Text style={[styles.rowKey, { color: '#b45309' }]}>Address</Text>
                                </View>
                                <Text style={styles.rowVal}>{hospitalLocation}</Text>
                            </View>

                            {/* Admin */}
                            <View style={[styles.metaRowColorful, styles.themePurple]}>
                                <View style={styles.rowLeft}>
                                    <View style={[styles.chipIcon, { backgroundColor: '#f5f3ff' }]}>
                                        <Feather name="shield" size={13} color="#7c3aed" />
                                    </View>
                                    <Text style={[styles.rowKey, { color: '#6d28d9' }]}>Admin</Text>
                                </View>
                                <View style={styles.adminBadgeWrap}>
                                    <Text style={styles.adminTag}>{hospital?.adminName || hospital?.adminUserId?.name || 'Admin'}</Text>
                                </View>
                            </View>

                            {/* Admin Email */}
                            <View style={[styles.metaRowColorful, styles.themePink]}>
                                <View style={styles.rowLeft}>
                                    <View style={[styles.chipIcon, { backgroundColor: '#fdf2f8' }]}>
                                        <Feather name="at-sign" size={13} color="#db2777" />
                                    </View>
                                    <Text style={[styles.rowKey, { color: '#be185d' }]}>Admin Email</Text>
                                </View>
                                <Text style={styles.rowVal}>{hospital?.adminEmail || hospital?.adminUserId?.email || hospital?.email || '—'}</Text>
                            </View>

                            {/* Staff Login URL */}
                            <View style={[styles.metaRowColorful, styles.themeEmerald]}>
                                <View style={styles.rowLeft}>
                                    <View style={[styles.chipIcon, { backgroundColor: '#ecfdf5' }]}>
                                        <Feather name="link" size={13} color="#059669" />
                                    </View>
                                    <Text style={[styles.rowKey, { color: '#047857' }]}>Staff Login URL</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.loginPillLink} 
                                    onPress={() => handleOpenURL(`https://${hospital?.slug || 'demo'}.medical365.in`)}
                                >
                                    <Text style={styles.loginPillLinkText}>{hospital?.slug ? `${hospital.slug}.medical365.in` : '—'}</Text>
                                    <Feather name="external-link" size={11} color="#047857" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            </View>

                            {/* Custom Domain */}
                            {hospital?.customDomain ? (
                                <View style={[styles.metaRowColorful, styles.themeCyan]}>
                                    <View style={styles.rowLeft}>
                                        <View style={[styles.chipIcon, { backgroundColor: '#ecfeff' }]}>
                                            <Feather name="globe" size={13} color="#0891b2" />
                                        </View>
                                        <Text style={[styles.rowKey, { color: '#0e7490' }]}>Custom Domain</Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={styles.loginPillLink} 
                                        onPress={() => handleOpenURL(`https://${hospital.customDomain.replace(/^https?:\/\//, '')}`)}
                                    >
                                        <Text style={styles.loginPillLinkText}>{hospital.customDomain.replace(/^https?:\/\//, '')}</Text>
                                        <Feather name="external-link" size={11} color="#047857" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    {/* Right Column: Holographic AI Security Hub */}
                    <View style={[styles.infoRightAiCol, !isDesktop && { width: '100%', minHeight: 220 }]}>
                        <View style={styles.aiHologramStage}>
                            {/* Aurora Glow */}
                            <View style={styles.aiAuroraGlow} />

                            {/* 3D Gyro Orbit Rings */}
                            <View style={[styles.aiGyroRing, styles.gyro1]} />
                            <View style={[styles.aiGyroRing, styles.gyro2]} />
                            <View style={[styles.aiGyroRing, styles.gyro3]} />

                            {/* Floating Satellite Badges */}
                            <View style={[styles.aiFloatingNode, styles.nodeEngine]}>
                                <Text style={styles.nodeIcon}>✨</Text>
                                <Text style={[styles.nodeText, { color: '#0284c7' }]}>AI Core</Text>
                            </View>
                            <View style={[styles.aiFloatingNode, styles.nodeQuantum]}>
                                <Text style={styles.nodeIcon}>🔒</Text>
                                <Text style={[styles.nodeText, { color: '#7c3aed' }]}>256-Bit</Text>
                            </View>
                            <View style={[styles.aiFloatingNode, styles.nodeCloud]}>
                                <Text style={styles.nodeIcon}>⚡</Text>
                                <Text style={[styles.nodeText, { color: '#059669' }]}>99.9%</Text>
                            </View>

                            {/* Center Shield Orb */}
                            <View style={styles.aiCenterShieldOrb}>
                                <View style={styles.aiLaserScanner} />
                                <Svg width={38} height={38} viewBox="0 0 24 24">
                                    <Defs>
                                        <SvgLinearGradient id="aiCrossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <Stop offset="0%" stopColor="#22d3ee" />
                                            <Stop offset="50%" stopColor="#10b981" />
                                            <Stop offset="100%" stopColor="#6366f1" />
                                        </SvgLinearGradient>
                                    </Defs>
                                    <Path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="url(#aiCrossGrad)" />
                                    <Path d="M12 8v8M8 12h8" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                                </Svg>
                            </View>

                            {/* AI Synapse Equalizer Bars */}
                            <View style={styles.aiSynapseBars}>
                                <View style={[styles.synapseBar, { height: 7, backgroundColor: '#06b6d4' }]} />
                                <View style={[styles.synapseBar, { height: 16, backgroundColor: '#10b981' }]} />
                                <View style={[styles.synapseBar, { height: 20, backgroundColor: '#8b5cf6' }]} />
                                <View style={[styles.synapseBar, { height: 12, backgroundColor: '#ec4899' }]} />
                                <View style={[styles.synapseBar, { height: 9, backgroundColor: '#3b82f6' }]} />
                            </View>
                        </View>

                        {/* Status Pill */}
                        <View style={styles.aiStatusPill}>
                            <Text style={styles.aiLiveSparkle}>✨</Text>
                            <Text style={styles.aiStatusCaption}>AI Health-Grid Active • 256-Bit Neural Security</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 8. Monthly Revenue Card (Last 6 Months) */}
            <View style={styles.revenueCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <View style={[styles.purpleIconCircle, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="trending-up" size={16} color="#16a34a" />
                    </View>
                    <Text style={styles.colTitle}>Monthly Revenue (Last 6 Months)</Text>
                </View>
                <Text style={styles.revVal}>{formatCurrency(totalSixMonthRevenue)}</Text>
                <Text style={styles.revSub}>
                    {s?.monthlyRevenue && s.monthlyRevenue.length > 0 
                        ? `${s.monthlyRevenue.length} active billing month(s) recorded` 
                        : 'Total hospital revenue across billing cycles'}
                </Text>
            </View>

            {/* 9. Staff Members Table with Filter & Search Controls */}
            <View style={styles.tableCard}>
                <View style={[styles.staffHead, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.purpleIconCircle}>
                            <Feather name="users" size={16} color="#6366f1" />
                        </View>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.colTitle, { margin: 0 }]}>Staff Members</Text>
                                <Text style={styles.countBadge}>
                                    ({filteredStaff.length}{filteredStaff.length !== staffListWithoutPatients.length ? ` of ${staffListWithoutPatients.length}` : ''})
                                </Text>
                            </View>
                            <Text style={styles.colSub}>See staff and login details in hospital's panel</Text>
                        </View>
                    </View>

                    {/* Filter Toolbar */}
                    <View style={[styles.staffFilterToolbar, isMobile && { width: '100%', marginTop: 10 }]}>
                        {/* Search Box */}
                        <View style={[styles.staffSearchBox, isMobile && { flex: 1, minWidth: 150 }]}>
                            <Feather name="search" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                            <TextInput
                                style={styles.staffSearchInput}
                                placeholder="Search staff (name, email, phone)..."
                                value={staffSearch}
                                onChangeText={setStaffSearch}
                                placeholderTextColor="#94a3b8"
                            />
                            {staffSearch ? (
                                <TouchableOpacity onPress={() => setStaffSearch('')}>
                                    <Feather name="x" size={14} color="#94a3b8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* Live Role Filter Dropdown with Filter Icon (matching Web 1:1) */}
                        {Platform.OS === 'web' ? (
                            <View style={styles.roleSelectWrap}>
                                <Feather name="filter" size={12} color="#6366f1" style={styles.roleSelectIcon} />
                                <select
                                    value={staffRoleFilter}
                                    onChange={(e) => setStaffRoleFilter(e.target.value)}
                                    style={{
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        padding: '7px 28px 7px 30px',
                                        fontSize: 12,
                                        fontWeight: '700',
                                        color: '#334155',
                                        backgroundColor: '#f8fafc',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 10,
                                        cursor: 'pointer',
                                        outline: 'none',
                                        fontFamily: 'inherit'
                                    }}
                                    title="Filter staff by role"
                                >
                                    <option value="all">All Roles ({staffListWithoutPatients.length})</option>
                                    {uniqueRoleNames.filter(r => r !== 'all').map(r => (
                                        <option key={r} value={r}>{r.toUpperCase()}</option>
                                    ))}
                                </select>
                                <Feather name="chevron-down" size={12} color="#64748b" style={styles.roleSelectArrow} />
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 260 }}>
                                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                    {uniqueRoleNames.map(r => (
                                        <TouchableOpacity
                                            key={r}
                                            style={[
                                                styles.rolePillBtn,
                                                staffRoleFilter === r && styles.rolePillBtnActive
                                            ]}
                                            onPress={() => setStaffRoleFilter(r)}
                                        >
                                            <Text style={[
                                                styles.rolePillBtnText,
                                                staffRoleFilter === r && styles.rolePillBtnTextActive
                                            ]}>
                                                {r === 'all' ? 'All Roles' : (r.charAt(0).toUpperCase() + r.slice(1))}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        )}

                        {/* Reset Button */}
                        {(staffRoleFilter !== 'all' || staffSearch.trim() !== '') && (
                            <TouchableOpacity
                                style={styles.filterResetBtn}
                                onPress={() => { setStaffRoleFilter('all'); setStaffSearch(''); }}
                            >
                                <Feather name="rotate-ccw" size={12} color="#dc2626" />
                                <Text style={styles.filterResetBtnText}>Reset</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Staff Table */}
                <View style={styles.staffTableWrap}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: 700 }}>
                            <View style={styles.staffThead}>
                                <Text style={[styles.staffTh, { width: 220 }]}>NAME</Text>
                                <Text style={[styles.staffTh, { width: 140 }]}>ROLE</Text>
                                <Text style={[styles.staffTh, { width: 200 }]}>EMAIL</Text>
                                <Text style={[styles.staffTh, { width: 140 }]}>PHONE</Text>
                            </View>

                            <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                {loadingStats ? (
                                    <View style={{ padding: 30, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#6366f1" />
                                        <Text style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>Loading staff members...</Text>
                                    </View>
                                ) : filteredStaff.length > 0 ? (
                                    filteredStaff.map((staff, idx) => {
                                        const initials = staff.name
                                            ? staff.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                            : 'S';
                                        const roleRaw = staff.roleName || staff.role || 'STAFF';
                                        const roleKey = roleRaw.toLowerCase();
                                        let roleBadgeStyle = styles.roleBadgeDefault;
                                        let roleBadgeTextStyle = styles.roleBadgeTextDefault;

                                        if (roleKey.includes('doc')) {
                                            roleBadgeStyle = styles.roleBadgeDoctor;
                                            roleBadgeTextStyle = styles.roleBadgeTextDoctor;
                                        } else if (roleKey.includes('nurse')) {
                                            roleBadgeStyle = styles.roleBadgeNurse;
                                            roleBadgeTextStyle = styles.roleBadgeTextNurse;
                                        } else if (roleKey.includes('recept')) {
                                            roleBadgeStyle = styles.roleBadgeReception;
                                            roleBadgeTextStyle = styles.roleBadgeTextReception;
                                        } else if (roleKey.includes('pharm')) {
                                            roleBadgeStyle = styles.roleBadgePharmacy;
                                            roleBadgeTextStyle = styles.roleBadgeTextPharmacy;
                                        } else if (roleKey.includes('lab')) {
                                            roleBadgeStyle = styles.roleBadgeLab;
                                            roleBadgeTextStyle = styles.roleBadgeTextLab;
                                        } else if (roleKey.includes('admin')) {
                                            roleBadgeStyle = styles.roleBadgeAdmin;
                                            roleBadgeTextStyle = styles.roleBadgeTextAdmin;
                                        }

                                        return (
                                            <View key={staff.id || staff._id || idx} style={styles.staffTrow}>
                                                <View style={{ width: 220, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                    <View style={styles.avatarCircle}>
                                                        <Text style={styles.avatarCircleText}>{initials}</Text>
                                                    </View>
                                                    <Text style={styles.staffName} numberOfLines={1}>{staff.name}</Text>
                                                </View>
                                                <View style={{ width: 140, justifyContent: 'center' }}>
                                                    <View style={[styles.roleBadge, roleBadgeStyle]}>
                                                        <Text style={[styles.roleBadgeText, roleBadgeTextStyle]} numberOfLines={1}>{roleRaw}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.staffEmail, { width: 200 }]} numberOfLines={1}>
                                                    {staff.email || '—'}
                                                </Text>
                                                <Text style={[styles.staffPhone, { width: 140 }]} numberOfLines={1}>
                                                    {staff.phone || '—'}
                                                </Text>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <View style={{ padding: 36, alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                                            <Feather name="user-x" size={20} color="#94a3b8" />
                                        </View>
                                        <Text style={{ fontWeight: '600', color: '#334155', fontSize: 13 }}>
                                            {staffListWithoutPatients.length === 0
                                                ? 'No staff members found for this hospital.'
                                                : 'No staff matching your search/filter.'}
                                        </Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },

    // 1. Hero Header Banner
    heroBanner: {
        position: 'relative',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 14,
        marginBottom: 20,
        overflow: 'hidden',
        minHeight: 155,
        ...Platform.select({
            ios: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 },
            android: { elevation: 3 },
            web: { boxShadow: '0 6px 20px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)' }
        }),
    },
    heroWaves: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 245,
        height: '100%',
        overflow: 'hidden',
        zIndex: 1,
    },
    heroWaveSvg: {
        width: 245,
        height: '100%',
    },
    heroDarkDotMatrix: {
        position: 'absolute',
        bottom: 12,
        left: 16,
        width: 48,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
    },
    heroMatrixDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#38bdf8',
        opacity: 0.55,
    },

    // Top Row
    heroTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        zIndex: 15,
        marginBottom: 8,
    },
    profilePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.5)',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 18,
    },
    profilePillText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    topBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.45)',
    },
    topBackArrow: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '900',
    },
    topBackText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },

    // Main Hero Content
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        zIndex: 5,
    },

    // Hexagon Logo
    hexLogoContainer: {
        width: 78,
        height: 86,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
    },
    hexOrbitRing: {
        position: 'absolute',
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 1,
        borderColor: 'rgba(56, 189, 248, 0.45)',
    },
    hexOrbitNode: {
        position: 'absolute',
        width: 4.5,
        height: 4.5,
        borderRadius: 2.25,
        backgroundColor: '#38bdf8',
    },
    nodeA: {
        top: 6,
        right: 0,
    },
    nodeB: {
        bottom: 8,
        left: -2,
    },
    nodeC: {
        bottom: 0,
        right: 16,
    },
    hexLogoCenterWrap: {
        position: 'absolute',
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hexImg: {
        width: 42,
        height: 42,
    },
    redCrossBox: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    crossArmH: {
        position: 'absolute',
        width: 26,
        height: 8,
        backgroundColor: '#e11d48',
        borderRadius: 2.5,
    },
    crossArmV: {
        position: 'absolute',
        width: 8,
        height: 26,
        backgroundColor: '#e11d48',
        borderRadius: 2.5,
    },

    // Center Info
    heroInfo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        position: 'relative',
    },
    centerDotMatrix: {
        width: 40,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
        justifyContent: 'center',
        marginBottom: 3,
    },
    centerMatrixDot: {
        width: 2.5,
        height: 2.5,
        borderRadius: 1.25,
        backgroundColor: '#94a3b8',
        opacity: 0.45,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0b192c',
        textAlign: 'center',
        letterSpacing: -0.4,
    },
    heroAccentBar: {
        position: 'relative',
        width: 155,
        height: 2.5,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        marginVertical: 6,
    },
    accentBarFill: {
        width: 55,
        height: '100%',
        backgroundColor: '#2563eb',
        borderRadius: 3,
    },
    accentBarDot: {
        position: 'absolute',
        right: 0,
        top: -1.25,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#0284c7',
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 8,
        paddingVertical: 3,
        paddingHorizontal: 9,
    },
    metaChipIcon: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinIcon: {
        backgroundColor: '#ede9fe',
    },
    phoneIcon: {
        backgroundColor: '#ccfbf1',
    },
    metaChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
    },
    metaSep: {
        width: 1,
        height: 14,
        backgroundColor: '#cbd5e1',
    },

    // Right ECG Widget
    heroRightCol: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
        minWidth: 185,
        zIndex: 10,
    },
    ecgWidget: {
        width: 185,
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Bottom Status Bar
    heroBottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.95)',
        paddingVertical: 5,
        paddingHorizontal: 18,
        marginTop: 12,
        alignSelf: 'center',
        width: '58%',
        maxWidth: 540,
        minWidth: 300,
        zIndex: 6,
    },
    bottomStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bottomStatIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconShield: {
        backgroundColor: '#ede9fe',
    },
    iconDoctors: {
        backgroundColor: '#ccfbf1',
    },
    bottomStatText: {
        flexDirection: 'column',
    },
    bottomStatLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    bottomStatVal: {
        fontSize: 12,
        color: '#0f172a',
        fontWeight: '800',
    },
    bottomStatSep: {
        width: 1,
        height: 16,
        backgroundColor: '#e2e8f0',
    },
    bottomStatRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#86efac',
        borderRadius: 12,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    statusCapsuleInactive: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#16a34a',
    },
    statusCapsuleName: {
        fontSize: 10,
        fontWeight: '900',
        color: '#15803d',
        letterSpacing: 0.4,
    },
    statusEcgWrap: {
        width: 36,
        height: 14,
        justifyContent: 'center',
    },

    // 2. Timeframe Card
    timeframeCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 20,
        marginBottom: 20,
        ...Platform.select({
            web: { boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)' }
        })
    },
    timeframeHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    timeframeTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    purpleIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeframeTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    timeframeSubtitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    timeframeControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
    },
    presetGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    presetBtn: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 16,
    },
    presetBtnActive: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    presetBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
    },
    presetBtnTextActive: {
        color: '#ffffff',
    },
    datePickerGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 10,
        fontSize: 12.5,
        color: '#1e293b',
        fontWeight: '600',
        backgroundColor: '#ffffff',
        minWidth: 100,
    },
    dateSep: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    applyBtn: {
        backgroundColor: '#6366f1',
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 10,
    },
    applyBtnText: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: '700',
    },

    // 3. KPI Grid
    kpiGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    kpiCard: {
        flex: 1,
        borderRadius: 18,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
    },
    kpiCardGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    kpiCardBlue: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd',
    },
    kpiCardPurple: {
        backgroundColor: '#faf5ff',
        borderColor: '#ddd6fe',
    },
    kpiCardOrange: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
    kpiIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    kpiVal: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    kpiLbl: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 2,
    },
    kpiSub: {
        fontSize: 11.5,
        fontWeight: '500',
    },
    kpiBar: {
        height: 3.5,
        borderRadius: 4,
        marginTop: 14,
        width: '100%',
    },

    // 4. Middle Grid
    middleGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    chartCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 22,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 22,
    },
    chartCardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    chartCardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    chartRangeButtonGroup: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: '#f1f5f9',
        padding: 3,
        borderRadius: 8,
    },
    chartRangeBtn: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    chartRangeBtnActive: {
        backgroundColor: '#ffffff',
    },
    chartRangeBtnText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    chartRangeBtnTextActive: {
        color: '#0f172a',
        fontWeight: '700',
    },
    chartStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    chartStatBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    chartDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    chartStatLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    chartStatVal: {
        fontSize: 11,
        fontWeight: '700',
    },
    chartBody: {
        flexDirection: 'row',
        height: 140,
        position: 'relative',
        marginTop: 6,
    },
    chartYAxis: {
        width: 24,
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    axisText: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '600',
    },
    chartPlot: {
        flex: 1,
        position: 'relative',
        marginLeft: 8,
    },
    chartGridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        borderStyle: 'dashed',
    },
    chartXAxis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 32,
        paddingRight: 8,
        marginTop: 6,
    },
    recentApptTableContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
    },
    recentApptHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    recentApptTh: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    recentApptDataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    recentApptTd: {
        fontSize: 12,
    },
    statusCompletedBadge: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    statusCompletedText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#16a34a',
        textTransform: 'capitalize',
    },

    // 5. Section Cards (Features, Mode, etc.)
    sectionCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 22,
        marginBottom: 20,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    featureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    featureBtnText: {
        fontSize: 13,
        fontWeight: '700',
    },

    // 6. Appointment Mode
    modeCardsRow: {
        flexDirection: 'row',
        gap: 14,
    },
    modeCard: {
        flex: 1,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    modeCardActive: {
        borderColor: '#6366f1',
        backgroundColor: '#f5f3ff',
    },
    modeIconBox: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    badgePrimary: {
        backgroundColor: '#6366f1',
        paddingVertical: 1,
        paddingHorizontal: 6,
        borderRadius: 6,
    },
    badgePrimaryText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '800',
    },
    modeCardDesc: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 4,
        lineHeight: 16,
    },
    btnPrimary: {
        backgroundColor: '#6366f1',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 10,
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    badgeBlue: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    badgeBlueText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '800',
    },

    // 7. Hospital Info + Hologram
    hospitalInfoCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 22,
        padding: 24,
        marginBottom: 20,
    },
    infoCardLayout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
    },
    infoLeftCol: {
        flex: 1.25,
    },
    infoHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    aiGradientIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoHeaderTitles: {
        flexDirection: 'column',
    },
    colTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    aiSyncPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#ecfeff',
        borderWidth: 1,
        borderColor: '#67e8f9',
        borderRadius: 16,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    aiPulseDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#06b6d4',
    },
    aiSyncPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0891b2',
    },
    metaListColorful: {
        flexDirection: 'column',
        gap: 8,
    },
    metaRowColorful: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    themeBlue: {
        borderColor: '#e0f2fe',
    },
    themeAmber: {
        borderColor: '#fef3c7',
    },
    themePurple: {
        borderColor: '#ede9fe',
    },
    themePink: {
        borderColor: '#fce7f3',
    },
    themeEmerald: {
        borderColor: '#dcfce7',
    },
    themeCyan: {
        borderColor: '#cffafe',
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chipIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowKey: {
        fontSize: 13,
        fontWeight: '700',
    },
    rowVal: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    adminBadgeWrap: {
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    adminTag: {
        color: '#6d28d9',
        fontWeight: '800',
        fontSize: 12,
    },
    loginPillLink: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#6ee7b7',
        borderRadius: 8,
        paddingVertical: 3,
        paddingHorizontal: 8,
    },
    loginPillLinkText: {
        color: '#047857',
        fontWeight: '700',
        fontSize: 12,
    },

    // Holographic AI Col
    infoRightAiCol: {
        flex: 0.95,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0fdfa',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(167, 243, 208, 0.7)',
        padding: 16,
        minHeight: 245,
        position: 'relative',
        overflow: 'hidden',
    },
    aiHologramStage: {
        width: 180,
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    aiAuroraGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#22d3ee',
        opacity: 0.25,
    },
    aiGyroRing: {
        position: 'absolute',
        borderRadius: 100,
    },
    gyro1: {
        width: 160,
        height: 160,
        borderWidth: 2,
        borderColor: '#06b6d4',
        borderStyle: 'dashed',
        opacity: 0.6,
    },
    gyro2: {
        width: 130,
        height: 130,
        borderWidth: 2,
        borderColor: '#8b5cf6',
        opacity: 0.5,
    },
    gyro3: {
        width: 100,
        height: 100,
        borderWidth: 1.5,
        borderColor: '#10b981',
        borderStyle: 'dotted',
        opacity: 0.7,
    },
    aiFloatingNode: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#ffffff',
        borderRadius: 10,
        paddingVertical: 2,
        paddingHorizontal: 6,
        zIndex: 8,
    },
    nodeEngine: {
        top: 4,
        right: 8,
        borderColor: '#7dd3fc',
    },
    nodeQuantum: {
        bottom: 20,
        left: 4,
        borderColor: '#c4b5fd',
    },
    nodeCloud: {
        bottom: 20,
        right: 4,
        borderColor: '#6ee7b7',
    },
    nodeIcon: {
        fontSize: 10,
    },
    nodeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    aiCenterShieldOrb: {
        width: 68,
        height: 68,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#a5f3fc',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 6,
        overflow: 'hidden',
    },
    aiLaserScanner: {
        position: 'absolute',
        top: '40%',
        left: 0,
        width: '100%',
        height: 3,
        backgroundColor: '#22d3ee',
    },
    aiSynapseBars: {
        position: 'absolute',
        bottom: 4,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
        height: 20,
    },
    synapseBar: {
        width: 3,
        borderRadius: 1.5,
    },
    aiStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#67e8f9',
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    aiLiveSparkle: {
        fontSize: 11,
        color: '#06b6d4',
    },
    aiStatusCaption: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0e7490',
    },

    // 8. Monthly Revenue Card
    revenueCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 22,
        marginBottom: 20,
    },
    revVal: {
        fontSize: 26,
        fontWeight: '900',
        color: '#0f172a',
        marginVertical: 6,
    },
    revSub: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },

    // 9. Staff Table Card
    tableCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 22,
        marginBottom: 20,
    },
    staffHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    countBadge: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6366f1',
    },
    colSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    staffFilterToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    staffSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minWidth: 180,
    },
    staffSearchInput: {
        flex: 1,
        fontSize: 12,
        color: '#1e293b',
        padding: 0,
    },
    rolePillBtn: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    rolePillBtnActive: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    rolePillBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
    },
    rolePillBtnTextActive: {
        color: '#ffffff',
    },
    filterResetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
    },
    filterResetBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#dc2626',
    },
    roleSelectWrap: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleSelectIcon: {
        position: 'absolute',
        left: 10,
        zIndex: 1,
        pointerEvents: 'none',
    },
    roleSelectArrow: {
        position: 'absolute',
        right: 10,
        zIndex: 1,
        pointerEvents: 'none',
    },
    staffTableWrap: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 8,
    },
    staffThead: {
        flexDirection: 'row',
        backgroundColor: '#252a5c',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    staffTh: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    staffTrow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    avatarCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarCircleText: {
        color: '#6366f1',
        fontSize: 12,
        fontWeight: '800',
    },
    staffName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    roleBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    roleBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    roleBadgeDoctor: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    roleBadgeTextDoctor: {
        color: '#2563eb',
    },
    roleBadgeNurse: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    roleBadgeTextNurse: {
        color: '#16a34a',
    },
    roleBadgeReception: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    roleBadgeTextReception: {
        color: '#d97706',
    },
    roleBadgePharmacy: {
        backgroundColor: '#fdf2f8',
        borderWidth: 1,
        borderColor: '#fbcfe8',
    },
    roleBadgeTextPharmacy: {
        color: '#db2777',
    },
    roleBadgeLab: {
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    roleBadgeTextLab: {
        color: '#7c3aed',
    },
    roleBadgeAdmin: {
        backgroundColor: '#ede9fe',
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    roleBadgeTextAdmin: {
        color: '#6366f1',
    },
    roleBadgeDefault: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    roleBadgeTextDefault: {
        color: '#475569',
    },
    staffEmail: {
        fontSize: 12.5,
        color: '#334155',
    },
    staffPhone: {
        fontSize: 12.5,
        color: '#334155',
    },

    // White Label Mobile App
    wlContainer: {
        paddingTop: 4,
    },
    wlStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    wlStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    wlErrorText: {
        color: '#dc2626',
        fontSize: 12,
        marginBottom: 12,
    },
    wlActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    wlBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
    },
    wlBuildBtn: {
        backgroundColor: '#2563eb',
    },
    wlBuildBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    wlResetBtn: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    wlResetBtnText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '700',
    },
    wlDownloadBtn: {
        backgroundColor: '#10b981',
    },
});
