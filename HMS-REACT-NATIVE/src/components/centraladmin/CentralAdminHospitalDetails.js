import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, 
    Dimensions, Linking, Image, ActivityIndicator, TextInput, Alert 
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { hospitalAPI, whiteLabelAPI } from '../../utils/api';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 768;

function WhiteLabelBuilder({ hospital }) {
    const hospitalId = hospital?._id || hospital?.id;
    const [status, setStatus] = useState(hospital?.appConfig?.buildStatus || 'NOT_BUILT');
    const [apkUrl, setApkUrl] = useState(hospital?.appConfig?.apkUrl || '');
    const [aabUrl, setAabUrl] = useState(hospital?.appConfig?.aabUrl || '');
    const [buildError, setBuildError] = useState(hospital?.appConfig?.buildError || '');
    const [isTriggering, setIsTriggering] = useState(false);

    useEffect(() => {
        let interval;
        if (status === 'BUILDING' && hospitalId) {
            interval = setInterval(async () => {
                try {
                    const res = await whiteLabelAPI.getBuildStatus(hospitalId);
                    if (res?.success) {
                        setStatus(res.buildStatus);
                        if (res.buildStatus === 'COMPLETED') {
                            setApkUrl(res.apkUrl);
                            setAabUrl(res.aabUrl);
                        } else if (res.buildStatus === 'FAILED') {
                            setBuildError(res.buildError || 'Build failed');
                        }
                    }
                } catch (err) {
                    console.error('Polling build status failed:', err);
                }
            }, 15000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, hospitalId]);

    const handleBuild = async () => {
        if (!hospitalId) return;
        setIsTriggering(true);
        setStatus('BUILDING');
        setBuildError('');
        try {
            const res = await whiteLabelAPI.buildApp(hospitalId);
            if (res?.success) {
                setStatus('BUILDING');
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
            await whiteLabelAPI.resetBuild(hospitalId);
            setStatus('NOT_BUILT');
            setBuildError('');
        } catch (err) {
            console.error('Reset build error:', err);
        }
    };

    const handleDownload = (type) => {
        const url = type === 'apk' ? whiteLabelAPI.getApkDownloadUrl(hospitalId) : whiteLabelAPI.getAabDownloadUrl(hospitalId);
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
                    {status === 'BUILDING' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <ActivityIndicator size="small" color="#f59e0b" />
                            <Text style={{ fontSize: 13, color: '#f59e0b', fontWeight: '600' }}>Building App (ETA: 3-5 mins)... ⏳</Text>
                            <TouchableOpacity onPress={handleReset} style={styles.wlResetBtn}>
                                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Reset</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'COMPLETED' && (
                        <View style={styles.wlStatusBadge}>
                            <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '700' }}>App Ready ✅</Text>
                        </View>
                    )}
                    {status === 'FAILED' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: '700' }}>Build Failed ❌</Text>
                            {buildError ? <Text style={{ fontSize: 11, color: '#ef4444' }} numberOfLines={1}>({buildError})</Text> : null}
                            <TouchableOpacity onPress={handleReset} style={styles.wlResetBtn}>
                                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Reset</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.wlActionRow}>
                    <TouchableOpacity 
                        style={[styles.wlBuildBtn, (status === 'BUILDING' || isTriggering) && { opacity: 0.6 }]} 
                        onPress={handleBuild}
                        disabled={status === 'BUILDING' || isTriggering}
                    >
                        <Text style={styles.wlBuildBtnText}>
                            {isTriggering ? 'Starting...' : '⚙️ Build Android App'}
                        </Text>
                    </TouchableOpacity>

                    {status === 'COMPLETED' && (
                        <>
                            <TouchableOpacity 
                                style={[styles.wlBuildBtn, { backgroundColor: '#10b981' }]} 
                                onPress={() => handleDownload('apk')}
                            >
                                <Text style={styles.wlBuildBtnText}>📥 Download APK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.wlBuildBtn, { backgroundColor: '#8b5cf6' }]} 
                                onPress={() => handleDownload('aab')}
                            >
                                <Text style={styles.wlBuildBtnText}>🚀 Download AAB</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function CentralAdminHospitalDetails({ hospital, onBack }) {
    const navigation = useNavigation();

    const [datePreset, setDatePreset] = useState('all');
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

    useEffect(() => {
        fetchStats(datePreset);
    }, [hospital?._id, datePreset]);

    const fetchStats = async (preset) => {
        if (!hospital?._id) return;
        setLoadingStats(true);
        setStatsError('');
        try {
            let queryStart = '';
            let queryEnd = '';

            if (preset !== 'all') {
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

    const [chartRange, setChartRange] = useState('this_month');

    const features = [
        { label: 'Doctors', icon: 'plus-circle', color: '#3b82f6', bg: '#eff6ff', route: 'AdminDoctors' },
        { label: 'Staff', icon: 'users', color: '#8b5cf6', bg: '#f5f3ff', route: 'Admin' },
        { label: 'Roles', icon: 'key', color: '#eab308', bg: '#fefce8', route: 'AdminRoles' },
        { label: 'Labs', icon: 'activity', color: '#22c55e', bg: '#f0fdf4', route: 'AdminLabs' },
        { label: 'Lab Tests', icon: 'file-text', color: '#10b981', bg: '#ecfdf5', route: 'AdminLabTests' },
        { label: 'Pharmacy', icon: 'shopping-bag', color: '#f97316', bg: '#fff7ed', route: 'AdminPharmacy' },
        { label: 'Reception', icon: 'monitor', color: '#14b8a6', bg: '#f0fdfa', route: 'AdminReception' },
        { label: 'Services', icon: 'grid', color: '#d946ef', bg: '#fdf4ff', route: 'AdminServices' },
        { label: 'Medicines', icon: 'heart', color: '#ef4444', bg: '#fef2f2', route: 'AdminMedicines' },
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
    const totalStaff = statsData?.stats?.totalStaff ?? 0;
    const uniquePatients = statsData?.stats?.totalPatients ?? statsData?.stats?.uniquePatients ?? 0;
    const totalAppointments = statsData?.stats?.totalAppointments ?? 0;
    const completedAppointments = statsData?.stats?.completedAppointments ?? 0;
    const pendingAppointments = statsData?.stats?.pendingAppointments ?? 0;
    const totalRevenue = statsData?.stats?.totalRevenue ?? 0;
    const appointmentsToRender = statsData?.recentAppointments || [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const curM = monthNames[now.getMonth()];
    const prevM = monthNames[(now.getMonth() - 1 + 12) % 12];
    const dateLabels = chartRange === 'last_month' 
        ? [`01 ${prevM}`, `05 ${prevM}`, `10 ${prevM}`, `15 ${prevM}`, `20 ${prevM}`, `25 ${prevM}`, `30 ${prevM}`]
        : chartRange === 'this_year'
            ? ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec']
            : [`01 ${curM}`, `05 ${curM}`, `10 ${curM}`, `15 ${curM}`, `20 ${curM}`];

    // Staff List derived from backend response
    const rawStaffList = statsData?.staffList || statsData?.stats?.staff || [];
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

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header Section */}
            <View style={styles.headerContainer}>
                <LinearGradient colors={['#1e1b4b', '#312e81', '#1e3a8a']} style={styles.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.headerTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.hospitalLogoBox}>
                                <Feather name="plus" size={32} color="#ef4444" style={{ fontWeight: 'bold' }} />
                            </View>
                            <View style={{ marginLeft: 16 }}>
                                <Text style={styles.hospitalProfileTag}>Hospital Profile</Text>
                                <Text style={styles.hospitalName}>{hospital?.name || 'Hospital Name'}</Text>
                                <View style={styles.hospitalContactRow}>
                                    <View style={styles.contactBadge}>
                                        <Feather name="map-pin" size={12} color="#3b82f6" />
                                        <Text style={styles.contactBadgeText}>{hospital?.city || 'Location'}, {hospital?.state || ''}</Text>
                                    </View>
                                    {hospital?.phone && (
                                        <View style={styles.contactBadge}>
                                            <Feather name="phone" size={12} color="#10b981" />
                                            <Text style={styles.contactBadgeText}>{hospital.phone}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.backButton} onPress={onBack}>
                            <Feather name="arrow-left" size={16} color="#fff" />
                            <Text style={styles.backButtonText}>Back to Hospitals</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
                
                {/* Floating Info Cards */}
                <View style={styles.floatingCardsRow}>
                    <View style={styles.floatCard}>
                        <Feather name="shield" size={16} color="#6366f1" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Trusted Care</Text>
                            <Text style={styles.floatCardValue}>24/7</Text>
                        </View>
                    </View>
                    <View style={styles.floatCard}>
                        <Feather name="user" size={16} color="#10b981" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Total Doctors</Text>
                            <Text style={styles.floatCardValue}>{statsData?.stats?.doctorCount ?? statsData?.stats?.totalDoctors ?? '—'}</Text>
                        </View>
                    </View>
                    <View style={styles.floatCard}>
                        <Feather name="users" size={16} color="#3b82f6" />
                        <View style={{ marginLeft: 8 }}>
                            <Text style={styles.floatCardLabel}>Patients Served</Text>
                            <Text style={styles.floatCardValue}>{uniquePatients}</Text>
                        </View>
                    </View>
                    <View style={styles.floatCardStatus}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>ACTIVE</Text>
                    </View>
                </View>
            </View>

            {/* Analytics Timeframe */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="calendar" size={18} color="#6366f1" />
                        <Text style={styles.sectionTitle}>Analytics Timeframe</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {loadingStats && <ActivityIndicator size="small" color="#6366f1" />}
                        <Text style={styles.sectionSubtitle}>Choose a reporting period</Text>
                    </View>
                </View>

                {statsError ? (
                    <View style={{ backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                        <Text style={{ color: '#ef4444', fontSize: 12 }}>{statsError}</Text>
                    </View>
                ) : null}

                <View style={styles.timeframeControls}>
                    <View style={styles.presetGroup}>
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'today', label: 'Today' },
                            { key: '30', label: '30 Days' },
                            { key: '60', label: '60 Days' },
                            { key: '90', label: '90 Days' },
                        ].map((preset) => (
                            <TouchableOpacity 
                                key={preset.key} 
                                style={[styles.presetBtn, datePreset === preset.key && styles.presetBtnActive]}
                                onPress={() => setDatePreset(preset.key)}
                            >
                                <Text style={[styles.presetBtnText, datePreset === preset.key && styles.presetBtnTextActive]}>
                                    {preset.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity 
                        style={[styles.btnPrimary, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                        onPress={() => fetchStats(datePreset)}
                    >
                        <Feather name="refresh-cw" size={13} color="#fff" />
                        <Text style={styles.btnPrimaryText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Live Stat Cards Grid */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderBottomColor: '#22c55e', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="user" size={20} color="#16a34a" />
                    </View>
                    <Text style={styles.statValue}>{totalStaff}</Text>
                    <Text style={styles.statLabel}>Total Staff</Text>
                    <Text style={styles.statSub}>Active staff members</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#3b82f6', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="users" size={20} color="#2563eb" />
                    </View>
                    <Text style={styles.statValue}>{uniquePatients}</Text>
                    <Text style={styles.statLabel}>Unique Patients</Text>
                    <Text style={styles.statSub}>In selected period</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#a855f7', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#f3e8ff' }]}>
                        <Feather name="calendar" size={20} color="#9333ea" />
                    </View>
                    <Text style={styles.statValue}>{totalAppointments}</Text>
                    <Text style={styles.statLabel}>Total Appointments</Text>
                    <Text style={styles.statSub}>In selected period</Text>
                </View>
                <View style={[styles.statCard, { borderBottomColor: '#eab308', borderBottomWidth: 3 }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#fef9c3' }]}>
                        <Text style={{ fontSize: 18, color: '#ca8a04', fontWeight: 'bold' }}>₹</Text>
                    </View>
                    <Text style={styles.statValue}>₹{(totalRevenue || 0).toLocaleString('en-IN')}</Text>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                    <Text style={styles.statSub}>From paid appointments</Text>
                </View>
            </View>

            {/* Appointments Overview & Recent Appointments */}
            <View style={[styles.middleGrid, isSmallScreen && styles.middleGridMobile]}>
                {/* Left: Appointments Overview Chart */}
                <View style={styles.chartCard}>
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
                <View style={styles.summaryCard}>
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
                                        const isCompleted = statusStr === 'completed' || statusStr === 'confirmed';
                                        const isPending = statusStr === 'pending' || statusStr === 'scheduled';
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
                                                    <View style={[
                                                        styles.recentApptBadge,
                                                        isCompleted ? styles.badgeSuccess : (isPending ? styles.badgeWarning : styles.badgeDefault)
                                                    ]}>
                                                        <Text style={[
                                                            styles.recentApptBadgeText,
                                                            isCompleted ? { color: '#16a34a' } : (isPending ? { color: '#d97706' } : { color: '#64748b' })
                                                        ]}>
                                                            {statusStr}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.recentApptTd, { width: 80, textAlign: 'right', fontWeight: '700', color: '#0f172a' }]}>
                                                    ₹{amt.toLocaleString('en-IN')}
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

            {/* Quick Feature Management */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="zap" size={18} color="#ea580c" />
                        <Text style={styles.sectionTitle}>Quick Feature Management</Text>
                    </View>
                </View>
                <Text style={[styles.sectionSubtitle, { marginBottom: 16, marginTop: -10 }]}>
                    Jump to manage specific features for this hospital.
                </Text>
                
                <View style={styles.featuresGrid}>
                    {features.map((feature, idx) => (
                        <TouchableOpacity 
                            key={idx} 
                            style={[styles.featureBtn, { backgroundColor: feature.bg }]}
                            onPress={() => handleFeatureClick(feature)}
                        >
                            <Feather name={feature.icon} size={14} color={feature.color} />
                            <Text style={[styles.featureBtnText, { color: feature.color }]}>{feature.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* White Label Mobile App Builder */}
            <WhiteLabelBuilder hospital={hospital} />

            {/* Appointment System Mode */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 16, height: 12, backgroundColor: '#f43f5e', borderRadius: 2, marginRight: 8 }} />
                        <Text style={styles.sectionTitle}>Appointment System Mode</Text>
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
                
                <View style={styles.modeCardsRow}>
                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'slot' && styles.modeCardActive]} 
                        onPress={() => { setApptMode('slot'); setApptModeSuccess(''); setApptModeError(''); }}
                    >
                        <View style={styles.modeIconBox}><Feather name="clock" size={18} color="#6366f1" /></View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={styles.modeCardTitle}>Time Slot Booking</Text>
                                <View style={styles.badgePrimary}><Text style={styles.badgePrimaryText}>Recommended</Text></View>
                            </View>
                            <Text style={styles.modeCardDesc}>Patients pick a specific time (10:00, 10:30...). Doctor sees one time slot at a time.</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.modeCard, apptMode === 'token' && styles.modeCardActive]} 
                        onPress={() => { setApptMode('token'); setApptModeSuccess(''); setApptModeError(''); }}
                    >
                        <View style={[styles.modeIconBox, { backgroundColor: '#fef3c7' }]}><Feather name="list" size={18} color="#d97706" /></View>
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

            {/* Hospital Info */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.statIconBox, { backgroundColor: '#e0e7ff', width: 32, height: 32 }]}><Feather name="cpu" size={16} color="#4f46e5" /></View>
                        <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Hospital Info</Text>
                        <View style={[styles.badgeBlue, { backgroundColor: '#ccfbf1', borderColor: '#99f6e4' }]}><Text style={[styles.badgeBlueText, { color: '#0f766e' }]}>AI Synced</Text></View>
                    </View>
                </View>

                <View style={styles.infoGridRow}>
                    <View style={styles.infoRow}><Feather name="mail" size={14} color="#3b82f6" /><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{hospital?.email || 'N/A'}</Text></View>
                    <View style={styles.infoRow}><Feather name="map-pin" size={14} color="#eab308" /><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{hospital?.address ? `${hospital.address}${hospital.city ? `, ${hospital.city}` : ''}` : (hospital?.city || 'N/A')}</Text></View>
                    <View style={styles.infoRow}><Feather name="user" size={14} color="#8b5cf6" /><Text style={styles.infoLabel}>Admin</Text><Text style={styles.infoValue}>{hospital?.adminName || hospital?.adminUserId?.name || 'SuperAdmin'}</Text></View>
                    <View style={styles.infoRow}><Feather name="at-sign" size={14} color="#ec4899" /><Text style={styles.infoLabel}>Admin Email</Text><Text style={styles.infoValue}>{hospital?.adminEmail || hospital?.adminUserId?.email || hospital?.email || 'N/A'}</Text></View>
                    <View style={styles.infoRow}>
                        <Feather name="link" size={14} color="#10b981" />
                        <Text style={styles.infoLabel}>Staff Login URL</Text>
                        <TouchableOpacity style={styles.urlBadge} onPress={() => handleOpenURL(`https://${hospital?.slug || hospital?.customDomain || 'demo'}.medical365.in/login`)}>
                            <Text style={styles.urlText}>https://{hospital?.slug || hospital?.customDomain || 'demo'}.medical365.in/login</Text>
                            <Feather name="external-link" size={12} color="#059669" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Hospital Staff Table (P2 #10) */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="users" size={18} color="#8b5cf6" />
                        <Text style={styles.sectionTitle}>Hospital Staff Members</Text>
                        <View style={[styles.badgeBlue, { marginLeft: 8 }]}>
                            <Text style={styles.badgeBlueText}>{filteredStaff.length} Members</Text>
                        </View>
                    </View>
                </View>

                {/* Search and Role Filter */}
                <View style={styles.staffFilterRow}>
                    <View style={styles.staffSearchBox}>
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.staffSearchInput}
                            placeholder="Search staff by name, email, phone, role..."
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

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {uniqueRoleNames.map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[
                                        styles.staffRolePill,
                                        staffRoleFilter === r && styles.staffRolePillActive
                                    ]}
                                    onPress={() => setStaffRoleFilter(r)}
                                >
                                    <Text style={[
                                        styles.staffRolePillText,
                                        staffRoleFilter === r && styles.staffRolePillTextActive
                                    ]}>
                                        {r === 'all' ? 'All Roles' : (r.charAt(0).toUpperCase() + r.slice(1))}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                {/* Table Content */}
                {loadingStats ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color="#6366f1" />
                        <Text style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>Loading staff members...</Text>
                    </View>
                ) : filteredStaff.length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 8 }}>👥</Text>
                        <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '500' }}>
                            {staffSearch ? 'No staff members matching your search.' : 'No staff members found for this hospital.'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.staffTable}>
                        <View style={styles.staffTableHeader}>
                            <Text style={[styles.staffTh, { flex: 2 }]}>NAME</Text>
                            <Text style={[styles.staffTh, { flex: 1.5 }]}>ROLE</Text>
                            <Text style={[styles.staffTh, { flex: 2 }]}>EMAIL</Text>
                            <Text style={[styles.staffTh, { flex: 1.5 }]}>PHONE</Text>
                        </View>
                        {filteredStaff.map((staff, idx) => {
                            const roleText = staff.roleName || staff.role || 'Staff';
                            return (
                                <View key={staff._id || staff.id || idx} style={styles.staffTableRow}>
                                    <View style={[styles.staffTd, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                                        <View style={styles.staffAvatarBox}>
                                            <Text style={styles.staffAvatarText}>
                                                {(staff.name || 'S').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.staffNameText} numberOfLines={1}>
                                            {staff.name || 'Unnamed'}
                                        </Text>
                                    </View>
                                    <View style={[styles.staffTd, { flex: 1.5 }]}>
                                        <View style={styles.staffRoleBadge}>
                                            <Text style={styles.staffRoleBadgeText} numberOfLines={1}>
                                                {roleText}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[styles.staffTd, { flex: 2 }]}>
                                        <Text style={styles.staffMutedText} numberOfLines={1}>
                                            {staff.email || '—'}
                                        </Text>
                                    </View>
                                    <View style={[styles.staffTd, { flex: 1.5 }]}>
                                        <Text style={styles.staffMutedText} numberOfLines={1}>
                                            {staff.phone || '—'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
            
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerContainer: {
        marginBottom: 40,
        position: 'relative',
    },
    headerGradient: {
        paddingTop: 30,
        paddingBottom: 60,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTop: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isSmallScreen ? 'flex-start' : 'center',
        gap: 16
    },
    hospitalLogoBox: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    hospitalProfileTag: {
        color: '#93c5fd',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    hospitalName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    hospitalContactRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap'
    },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    contactBadgeText: {
        color: '#e2e8f0',
        fontSize: 13,
        marginLeft: 6,
        fontWeight: '500'
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    backButtonText: {
        color: '#fff',
        marginLeft: 8,
        fontWeight: '600',
        fontSize: 14
    },
    floatingCardsRow: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: -25,
        left: 24,
        right: 24,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 8,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10
    },
    floatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 16,
        borderRightWidth: 1,
        borderRightColor: '#f1f5f9'
    },
    floatCardLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500'
    },
    floatCardValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a'
    },
    floatCardStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#a7f3d0'
    },
    statusDot: {
        width: 6,
        height: 6,
        backgroundColor: '#10b981',
        borderRadius: 3,
        marginRight: 6
    },
    statusText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '700'
    },
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 24,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginLeft: 8
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    timeframeControls: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isSmallScreen ? 'stretch' : 'center',
        gap: 16
    },
    btnPrimary: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    btnPrimaryText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13
    },
    presetGroup: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap'
    },
    presetBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    presetBtnActive: {
        backgroundColor: '#6366f1',
    },
    presetBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569'
    },
    presetBtnTextActive: {
        color: '#fff'
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    statCard: {
        width: isSmallScreen ? '48%' : '23%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        margin: '1%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    statIconBox: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4
    },
    statLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 2
    },
    statSub: {
        fontSize: 12,
        color: '#94a3b8'
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    featureBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        gap: 8,
        width: isSmallScreen ? '47%' : '23%'
    },
    featureBtnText: {
        fontWeight: '600',
        fontSize: 13
    },
    badgeBlue: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginLeft: 12
    },
    badgeBlueText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '600'
    },
    modeCardsRow: {
        flexDirection: isSmallScreen ? 'column' : 'row',
        gap: 16
    },
    modeCard: {
        flex: 1,
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    modeCardActive: {
        backgroundColor: '#eef2ff',
        borderColor: '#c7d2fe'
    },
    modeIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modeCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b'
    },
    badgePrimary: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8
    },
    badgePrimaryText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600'
    },
    modeCardDesc: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 6,
        lineHeight: 18
    },
    infoGridRow: {
        marginTop: 10
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    infoLabel: {
        width: 140,
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginLeft: 12
    },
    infoValue: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '500',
        textAlign: 'right'
    },
    urlBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        flex: 1,
        justifyContent: 'flex-end'
    },
    urlText: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '600'
    },
    // White Label styles
    wlContainer: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        gap: 12,
    },
    wlStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
    },
    wlStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    wlResetBtn: {
        borderWidth: 1,
        borderColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    wlActionRow: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    wlBuildBtn: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wlBuildBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    // Staff Table styles
    staffFilterRow: {
        marginBottom: 16,
    },
    staffSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 8,
        gap: 8,
    },
    staffSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#1e293b',
        paddingVertical: 4,
    },
    staffRolePill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    staffRolePillActive: {
        backgroundColor: '#6366f1',
        borderColor: '#6366f1',
    },
    staffRolePillText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#475569',
    },
    staffRolePillTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    staffTable: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
    },
    staffTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    staffTh: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    staffTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    staffTd: {
        justifyContent: 'center',
    },
    staffAvatarBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    staffAvatarText: {
        color: '#4338ca',
        fontWeight: '700',
        fontSize: 12,
    },
    staffNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    staffRoleBadge: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    staffRoleBadgeText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '600',
    },
    staffMutedText: {
        fontSize: 12,
        color: '#64748b',
    },
    // Middle Grid: Appointments Overview & Recent Appointments
    middleGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    middleGridMobile: {
        flexDirection: 'column',
    },
    chartCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 20,
        boxShadow: Platform.OS === 'web' ? '0 2px 10px rgba(0, 0, 0, 0.02)' : undefined,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 20,
        boxShadow: Platform.OS === 'web' ? '0 2px 10px rgba(0, 0, 0, 0.02)' : undefined,
    },
    chartCardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 8,
    },
    purpleIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chartCardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    chartRangeButtonGroup: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    chartRangeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    chartRangeBtnActive: {
        backgroundColor: '#e0e7ff',
    },
    chartRangeBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    chartRangeBtnTextActive: {
        color: '#4338ca',
    },
    chartStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    chartStatBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    chartDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    chartStatLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    chartStatVal: {
        fontSize: 12,
        fontWeight: '800',
    },
    chartBody: {
        flexDirection: 'row',
        height: 160,
        position: 'relative',
        marginTop: 6,
    },
    chartYAxis: {
        width: 26,
        justifyContent: 'space-between',
        paddingRight: 6,
        alignItems: 'flex-end',
    },
    axisText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94a3b8',
    },
    chartPlot: {
        flex: 1,
        position: 'relative',
        height: '100%',
    },
    chartGridLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    chartXAxis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 30,
        paddingRight: 6,
        marginTop: 8,
    },
    recentApptTableContainer: {
        minWidth: 520,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
    },
    recentApptHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
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
    recentApptBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
    },
    badgeSuccess: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    badgeWarning: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
    },
    badgeDefault: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    recentApptBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'capitalize',
    },
});
