import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, Platform, useWindowDimensions, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { useBranding } from '../../context/BrandingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlobalSearch from '../GlobalSearch';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Ellipse, Rect, Path, Line, Circle } from 'react-native-svg';
import { styles, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED } from './DashboardLayoutStyles';
import OfflineBanner from '../OfflineBanner';

// Cute 3D AI Robot Illustration with glowing pedestal (Web ha-sidebar-ai-card parity)
const HaSidebarAiCard = () => {
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -4,
                    duration: 1750,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1750,
                    useNativeDriver: Platform.OS !== 'web',
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [floatAnim]);

    return (
        <ExpoLinearGradient
            colors={['#f8fafc', '#f0fdfa', '#e0f2fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.haSidebarAiCard}
        >
            <Animated.View style={[styles.haSidebarAiBotWrap, { transform: [{ translateY: floatAnim }] }]}>
                <Svg width={110} height={96} viewBox="0 0 160 140" fill="none">
                    <Defs>
                        <RadialGradient id="haBotGlow" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
                            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                            <Stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                        </RadialGradient>
                        <SvgLinearGradient id="haBotBody" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor="#ffffff" />
                            <Stop offset="100%" stopColor="#e0f2fe" />
                        </SvgLinearGradient>
                        <SvgLinearGradient id="haBotVisor" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0%" stopColor="#0f172a" />
                            <Stop offset="100%" stopColor="#1e293b" />
                        </SvgLinearGradient>
                    </Defs>
                    <Ellipse cx="80" cy="125" rx="55" ry="12" fill="url(#haBotGlow)" />
                    <Ellipse cx="80" cy="125" rx="42" ry="8" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4, 3" />
                    <Ellipse cx="80" cy="122" rx="30" ry="6" stroke="#0ea5e9" strokeWidth="1.8" />
                    <Ellipse cx="80" cy="92" rx="26" ry="20" fill="url(#haBotBody)" stroke="#93c5fd" strokeWidth="1.2" />
                    <Path d="M 68 86 Q 80 94 92 86" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <Ellipse cx="44" cy="85" rx="7" ry="14" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.2" />
                    <Ellipse cx="116" cy="85" rx="7" ry="14" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.2" />
                    <Rect x="52" y="38" width="56" height="42" rx="18" fill="url(#haBotBody)" stroke="#93c5fd" strokeWidth="1.4" />
                    <Rect x="58" y="44" width="44" height="26" rx="12" fill="url(#haBotVisor)" />
                    <Ellipse cx="68" cy="56" rx="5" ry="6" fill="#38bdf8" />
                    <Ellipse cx="92" cy="56" rx="5" ry="6" fill="#38bdf8" />
                    <Ellipse cx="69" cy="54" rx="2" ry="2" fill="#ffffff" />
                    <Ellipse cx="93" cy="54" rx="2" ry="2" fill="#ffffff" />
                    <Line x1="80" y1="38" x2="80" y2="28" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
                    <Circle cx="80" cy="26" r="4" fill="#0ea5e9" />
                    <Circle cx="80" cy="26" r="2" fill="#ffffff" />
                </Svg>
            </Animated.View>
            <Text style={styles.haSidebarAiTitle}>AI Assistant</Text>
        </ExpoLinearGradient>
    );
};

const DashboardSidebar = ({ isOpen, setOpen, isMobile }) => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const { branding } = useBranding();
    const rawRole = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || (Platform.OS === 'web' && typeof window !== 'undefined' ? (localStorage.getItem('role') || (() => { try { return JSON.parse(localStorage.getItem('user') || '{}')?.role; } catch(e){ return ''; } })()) : '') || '';
    const role = (typeof rawRole === 'object' ? rawRole?.name : rawRole || '').toLowerCase();
    
    const navigation = useNavigation();
    const route = useRoute();
    const currentPath = route.name; 

    const isCentralAdmin = (role === 'centraladmin' || role === 'superadmin');
    
    const getMenu = () => {
        if (isCentralAdmin) {
            return [
                { label: 'System Overview', path: 'CentralAdminDashboard', icon: <Feather name="grid" size={18} /> },
                { label: 'Question Library', path: 'AdminQuestionLibrary', icon: <Feather name="layers" size={18} /> },
                { label: 'Consent Hub', path: 'ConsentManagement', icon: <Feather name="clipboard" size={18} /> },
                { label: 'Role & Permissions', path: 'AdminRoles', icon: <Feather name="shield" size={18} /> },
                { label: 'Manage All Staff', path: 'Admin', icon: <Feather name="users" size={18} /> },
            ];
        }

        const roleClean = role.replace(/\s+/g, '');
        const isOTRoute = currentPath && currentPath.startsWith('OT');

        if (roleClean === 'otmanager' || roleClean === 'otstaff' || isOTRoute) {
            return [
                { label: 'OT Dashboard', path: 'OTDashboard', icon: <Feather name="home" size={18} /> },
                { label: 'Planned Surgeries', path: 'OTPlannedSurgeries', icon: <Feather name="clock" size={18} /> },
                { label: 'OT Schedule', path: 'OTSchedulePage', icon: <Feather name="calendar" size={18} /> },
                { label: 'OT Rooms', path: 'OTRoomsPage', icon: <Feather name="box" size={18} /> },
                { label: 'Pre-Op', path: 'OTPreOpPage', icon: <Feather name="user-check" size={18} /> },
                { label: 'In OT', path: 'OTInProgressPage', icon: <Feather name="activity" size={18} /> },
                { label: 'Post-Op', path: 'OTPostOpPage', icon: <Feather name="heart" size={18} /> },
                { label: 'Completed', path: 'OTCompletedPage', icon: <Feather name="check-circle" size={18} /> },
                { label: 'Surgeons', path: 'OTSurgeonsPage', icon: <Feather name="user" size={18} /> },
                { label: 'OT Reports', path: 'OTReportsPage', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        if (role === 'hospitaladmin') {
            const isClinicHub = user?.clinicType === 'clinic' || user?.subscriptionPlan === 'starter';
            if (isClinicHub) {
                return [
                    { label: 'Clinic Hub', path: 'ClinicDashboard', icon: <Feather name="home" size={18} /> },
                    { label: 'Vial Management', path: 'VialManagement', icon: <Feather name="box" size={18} /> },
                ];
            }
            return [
                { label: 'Hospital Overview', path: 'HospitalAdminDashboard', icon: <Feather name="home" size={18} /> },
                { label: 'Vial Management', path: 'VialManagement', icon: <Feather name="box" size={18} /> },
                { label: 'Clinical Questions', path: 'HospitalAdminQuestionLibrary', icon: <Feather name="file-text" size={18} /> },
                { label: 'Staff Management', path: 'Admin', icon: <Feather name="users" size={18} /> },
                { label: 'Doctors Feed', path: 'AdminDoctors', icon: <Feather name="activity" size={18} /> },
                { label: 'Pharma Inventory', path: 'PharmacyInventory', icon: <Feather name="package" size={18} /> },
            ];
        }

        if (role === 'pharmacist' || role === 'pharmacy' || role.includes('pharmac')) {
            return [
                { label: 'Inventory', path: 'PharmacyInventory', icon: <Feather name="package" size={18} /> },
                { label: 'Orders', path: 'PharmacyOrders', icon: <Feather name="clipboard" size={18} /> },
                { label: 'Purchase Invoices', path: 'PurchaseInvoiceHistory', icon: <Feather name="file-text" size={18} /> },
                { label: 'Returns', path: 'PharmacyReturns', icon: <Feather name="activity" size={18} /> },
                { label: 'Vendor Returns', path: 'VendorReturns', icon: <Feather name="activity" size={18} /> },
                { label: 'Collections', path: 'PharmacyCollections', icon: <Feather name="pie-chart" size={18} /> },
                { label: 'Departments', path: 'PharmacyDepartments', icon: <Feather name="grid" size={18} /> },
            ];
        }

        if (role === 'reception' || role === 'receptionist') {
            return [
                { label: 'Reception Dashboard', path: 'ReceptionDashboard', params: { view: 'welcome' }, icon: <Feather name="home" size={18} /> },
                { label: 'Patient Registration', path: 'ReceptionDashboard', params: { view: 'intake' }, icon: <Feather name="user-plus" size={18} /> },
                { label: 'Patient Search', path: 'ReceptionPatients', icon: <Feather name="users" size={18} /> },
                { label: 'Patient Billing', path: 'PatientBillingProfile', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        const isLabRoute = currentPath && (currentPath === 'LabDashboard' || currentPath === 'AssignedTests' || currentPath === 'CompletedReports');
        if (role === 'lab' || role === 'pathologist' || roleClean === 'lab' || roleClean === 'labtechnician' || role.includes('lab') || isLabRoute) {
            return [
                { label: 'Lab Dashboard', path: 'LabDashboard', icon: <Feather name="activity" size={18} /> },
                { label: 'Assigned Tests', path: 'AssignedTests', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        const isAccountantRoute = currentPath && (currentPath === 'AccountantDashboard' || (currentPath === 'PatientBillingProfile' && role === 'accountant'));
        if (role === 'accountant' || isAccountantRoute) {
            return [
                { label: 'Finance Dashboard', path: 'AccountantDashboard', icon: <Feather name="pie-chart" size={18} /> },
                { label: 'Patient Billing', path: 'PatientBillingProfile', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        if (role === 'cashier' || (currentPath === 'CashierDashboard' && role !== 'billing')) {
            return [
                { label: 'Billing/Payments', path: 'CashierDashboard', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        if (role === 'billing') {
            return [
                { label: 'Patient Billing', path: 'CashierDashboard', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        const isDoctor = role === 'doctor' || role === 'clinic doctor' || roleClean === 'doctor' || roleClean === 'clinicdoctor';
        const isDoctorRoute = currentPath && (currentPath === 'DoctorDashboard' || currentPath === 'DoctorPatients' || currentPath === 'DoctorPatientDetails' || currentPath === 'AIAssistant' || (currentPath === 'LabReports' && isDoctor));
        if (isDoctor || (isDoctorRoute && !role)) {
            return [
                { label: 'Dashboard', path: 'DoctorDashboard', icon: <Feather name="home" size={18} /> },
                { label: 'IPD Command Center', path: 'IPDCommandCenter', icon: <Feather name="activity" size={18} /> },
                { label: 'My Patients', path: 'DoctorPatients', icon: <Feather name="users" size={18} /> },
                { label: 'AI Assistant', path: 'AIAssistant', icon: <Feather name="file-text" size={18} /> },
                { label: 'Reports', path: 'LabReports', icon: <Feather name="file-text" size={18} /> },
            ];
        }

        const isNurse = role === 'nurse' || role === 'staffnurse' || role === 'headnurse' || roleClean === 'nurse' || roleClean === 'staffnurse' || roleClean === 'headnurse';
        const isNurseRoute = currentPath && (currentPath === 'NurseDashboard' || currentPath === 'NurseOPDQueue' || currentPath === 'NurseAppointments' || (currentPath === 'NursePatientWorkspace' && isNurse));
        if (isNurse || (isNurseRoute && !isDoctor)) {
            return [
                { label: 'Nurse Command Center', path: 'NurseDashboard', icon: <Feather name="home" size={18} /> },
                { label: 'OPD Patient Queue', path: 'NurseOPDQueue', icon: <Feather name="users" size={18} /> },
                { label: 'Appointments', path: 'NurseAppointments', icon: <Feather name="calendar" size={18} /> },
                { label: 'IPD Command Center', path: 'IPDCommandCenter', icon: <Feather name="activity" size={18} /> },
            ];
        }

        return [
            { label: 'Hospital Overview', path: 'HospitalAdminDashboard', icon: <Feather name="home" size={18} /> },
        ];
    };

    const menuItems = getMenu();

    return (
        <View style={[
            styles.erpSidebar, 
            isOpen ? styles.erpSidebarOpen : styles.erpSidebarCollapsed,
            isMobile && !isOpen && styles.erpSidebarMobileHidden,
            isMobile && isOpen && styles.erpSidebarMobileVisible
        ]}>
            <View style={[styles.sidebarBrand, !isOpen && styles.sidebarBrandCollapsed, isCentralAdmin && styles.caSidebarBrand]}>
                <View style={styles.caBrandContainer}>
                    {!isOpen ? (
                        <View style={styles.brandDot} />
                    ) : (
                        <Image
                            source={(isCentralAdmin || user?.hospitalName?.includes('Metropolis') || !branding?.logoUrl || branding?.hospitalName === 'City Hospital') ? require('../../assets/medical365-logo.png') : (branding?.logoUrl ? { uri: branding.logoUrl } : require('../../assets/medical365-logo.png'))}
                            style={styles.brandLogo}
                            resizeMode="contain"
                        />
                    )}
                </View>
                
                {isMobile && isOpen && (
                    <TouchableOpacity style={styles.mobileCloseBtn} onPress={() => setOpen(false)}>
                        <Feather name="x" size={24} color="#64748b" />
                    </TouchableOpacity>
                )}
            </View>
            
            <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                {menuItems.map((item, idx) => {
                    const isActive = currentPath === item.path;

                    const caThemes = [
                        { bg: styles.themeGreenActive, text: styles.themeGreenTextActive },
                        { bg: styles.themeBlueActive, text: styles.themeBlueTextActive },
                        { bg: styles.themeTealActive, text: styles.themeTealTextActive },
                        { bg: styles.themePurpleActive, text: styles.themePurpleTextActive },
                        { bg: styles.themePinkActive, text: styles.themePinkTextActive }
                    ];
                    
                    const themeObj = isCentralAdmin ? caThemes[idx % caThemes.length] : null;

                    return (
                        <TouchableOpacity 
                            key={idx} 
                            style={[
                                styles.sidebarLink, 
                                !isOpen && styles.sidebarLinkCollapsed,
                                isCentralAdmin && styles.caSidebarLink,
                                isActive && !isCentralAdmin && styles.sidebarLinkActive,
                                isActive && isCentralAdmin && themeObj.bg
                            ]}
                            onPress={() => {
                                navigation.navigate(item.path, item.params);
                                if (isMobile) setOpen(false);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.sidebarLinkIcon, isActive && isCentralAdmin && themeObj.text]}>
                                {React.cloneElement(item.icon, { color: (isActive && isCentralAdmin) ? themeObj.text.color : '#64748b' })}
                            </View>
                            
                            {isOpen && (
                                <Text style={[
                                    styles.sidebarLinkText, 
                                    isCentralAdmin && styles.caSidebarLinkText,
                                    isActive && !isCentralAdmin && styles.sidebarLinkTextActive,
                                    isActive && isCentralAdmin && themeObj.text
                                ]}>
                                    {item.label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}

                {(isCentralAdmin || role === 'hospitaladmin' || role === 'doctor' || role === 'clinic doctor' || isDoctorRoute) && isOpen && (
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                            navigation.navigate('AIAssistant');
                            if (isMobile) setOpen(false);
                        }}
                    >
                        <HaSidebarAiCard />
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: isOpen ? 10 : 0 }}>
                <TouchableOpacity 
                    style={[styles.sidebarLink, !isOpen && styles.sidebarLinkCollapsed]} 
                    onPress={async () => {
                        try {
                            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                                localStorage.setItem('isLoggedOut', 'true');
                                sessionStorage.setItem('isLoggedOut', 'true');
                                localStorage.removeItem('role');
                                sessionStorage.removeItem('role');
                            }
                            dispatch(logout());
                            await AsyncStorage.removeItem('token');
                            await AsyncStorage.removeItem('user');
                            await AsyncStorage.removeItem('role');
                        } catch (err) {
                            console.error('Logout failed:', err);
                        }
                    }}
                >
                    <View style={styles.sidebarLinkIcon}>
                        <Feather name="log-out" size={18} color="#ef4444" />
                    </View>
                    {isOpen && (
                        <Text style={[styles.sidebarLinkText, { color: '#ef4444' }]}>
                            Logout
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {isCentralAdmin && !isMobile && (
                <View style={styles.caSidebarFooter}>
                    <TouchableOpacity style={styles.caSidebarCollapseBtn} onPress={() => setOpen(!isOpen)}>
                        <Feather name={isOpen ? "chevrons-left" : "chevrons-right"} size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const TopBar = ({ toggleSidebar, sidebarOpen, isMobile }) => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const route = useRoute();
    const currentPath = route.name; 

    const rawRole = (typeof user?.role === 'object' ? user?.role?.name : user?.role) || (Platform.OS === 'web' && typeof window !== 'undefined' ? (localStorage.getItem('role') || (() => { try { return JSON.parse(localStorage.getItem('user') || '{}')?.role; } catch(e){ return ''; } })()) : '') || '';
    const role = (typeof rawRole === 'object' ? rawRole?.name : rawRole || '').toLowerCase();
    const isCentralAdmin = (role === 'centraladmin' || role === 'superadmin');

    const [dropdownVisible, setDropdownVisible] = useState(false);

    const handleLogout = async () => {
        setDropdownVisible(false);
        dispatch(logout());
        try {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
        } catch (e) {}
    };

    const formatLastLogin = (dateVal) => {
        if (!dateVal) return 'Active Session';
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return 'Active Session';
            return `LAST LOGIN: ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
            return 'Active Session';
        }
    };

    const getInitials = (name) => {
        return (name || 'PH').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const formatPageName = (name) => {
        if (!name) return 'Dashboard';
        if (name === 'CentralAdminDashboard') return 'System Overview';
        if (name === 'SystemRevenueDashboard') return 'System Revenue Analytics';
        if (name === 'ConsentManagement') return 'Consent Hub';
        if (name === 'AdminQuestionLibrary') return 'Question Library';
        if (name === 'AdminLabTests') return 'Lab Tests';
        if (name === 'AdminTestPackages') return 'Test Packages';
        if (name === 'AdminMedicines') return 'Medicine Catalog';
        if (name === 'AdminServices') return 'Services';
        if (name === 'HospitalAdminDashboard') return 'Hospital Overview';
        if (name === 'ClinicDashboard') return 'Clinic Hub';
        if (name === 'VialManagement') return 'Vial Management';
        if (name === 'HospitalAdminQuestionLibrary') return 'Clinical Questions';
        if (name === 'Admin') return 'Staff Management';
        if (name === 'AdminDoctors') return 'Doctors Feed';
        if (name === 'PharmacyInventory') return (role === 'pharmacist' || role === 'pharmacy' || role.includes('pharmac')) ? 'Inventory' : 'Pharma Inventory';
        if (name === 'PharmacyOrders') return 'Orders';
        if (name === 'PurchaseInvoiceHistory') return 'Purchase Invoices';
        if (name === 'PharmacyReturns') return 'Returns';
        if (name === 'VendorReturns') return 'Vendor Returns';
        if (name === 'PharmacyCollections') return 'Collections';
        if (name === 'PharmacyDepartments') return 'Departments';
        if (name === 'LabDashboard') return 'Lab Dashboard';
        if (name === 'AssignedTests') return 'Assigned Tests';
        if (name === 'CompletedReports') return 'Past Records';
        if (name === 'AdminRoles') return 'Roles & Permissions';
        if (name === 'AccountantDashboard') return 'Finance Dashboard';
        if (name === 'PatientBillingProfile') return 'Patient Billing';
        if (name === 'CashierDashboard') return role === 'billing' ? 'Patient Billing' : 'Billing/Payments';
        if (name === 'NurseDashboard') return 'Nurse Command Center';
        if (name === 'NurseOPDQueue') return 'OPD Patient Queue';
        if (name === 'NurseAppointments') return 'Appointments';
        if (name === 'NursePatientWorkspace') return 'Inpatient Workspace';
        if (name === 'IPDCommandCenter') return 'IPD Command Center';
        if (name === 'DoctorDashboard') return 'Dashboard';
        if (name === 'DoctorPatients') return 'My Patients';
        if (name === 'DoctorPatientDetails') return 'Clinical Workspace';
        if (name === 'AIAssistant') return 'AI Assistant';
        if (name === 'LabReports') return 'Reports';
        return name.replace(/([A-Z])/g, ' $1').trim();
    };

    const getCentralAdminTag = () => {
        if (currentPath === 'CentralAdminDashboard') return 'CENTRAL ADMIN';
        if (currentPath === 'SystemRevenueDashboard') return 'SYSTEM REVENUE ANALYTICS';
        if (currentPath.includes('Consent')) return 'CONSENT HUB';
        if (currentPath.includes('QuestionLibrary')) return 'QUESTION LIBRARY';
        if (currentPath.includes('Roles')) return 'ROLES & PERMISSIONS';
        if (currentPath.includes('LabTests')) return 'LAB TESTS';
        if (currentPath.includes('TestPackages')) return 'TEST PACKAGES';
        if (currentPath.includes('Medicines')) return 'MEDICINE CATALOG';
        if (currentPath.includes('Services')) return 'SERVICES';
        if (currentPath === 'Admin') return 'MANAGE STAFF';
        if (currentPath.includes('Revenue')) return 'REVENUE ANALYTICS';
        return 'CENTRAL ADMIN';
    };

    return (
        <View style={[styles.erpTopbar, isCentralAdmin && styles.caErpTopbar]}>
            <View style={styles.topbarLeft}>
                <TouchableOpacity style={styles.sidebarToggle} onPress={toggleSidebar} activeOpacity={0.6}>
                    <Feather name="menu" size={24} color="#1e293b" />
                </TouchableOpacity>

                {isCentralAdmin ? (
                    <View style={styles.caTopbarBreadcrumb}>
                        {!isMobile && <Text style={styles.caBcUserType}>Superadmin</Text>}
                        {!isMobile && <Text style={styles.caBcDivider}>/</Text>}
                        <View style={styles.caBcTag}>
                            <Text style={[{ color: '#2563eb', fontSize: 11.5, fontWeight: '800' }]}>
                                {getCentralAdminTag()}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.breadcrumbWrap}>
                        {!isMobile && (
                            <>
                                <Text style={styles.currPageName} numberOfLines={1}>{formatPageName(currentPath)}</Text>
                                <Text style={styles.pathSlash}>/</Text>
                            </>
                        )}
                        <Text style={styles.pathUserRole}>{(user?.role || 'Hospital Admin').toUpperCase()}</Text>
                    </View>
                )}
            </View>

            {/* TOPBAR RIGHT: GlobalSearch + Profile Avatar */}
            <View style={styles.topbarRight}>
                <GlobalSearch />

                {isCentralAdmin && (
                    <TouchableOpacity style={styles.bellIconBtn}>
                        <Feather name="bell" size={18} color="#64748b" />
                        <View style={styles.bellBadge}>
                            <Text style={styles.bellBadgeText}>3</Text>
                        </View>
                    </TouchableOpacity>
                )}

                <TouchableOpacity 
                    style={styles.caUserProfileCircleBtn}
                    onPress={() => setDropdownVisible(!dropdownVisible)}
                    activeOpacity={0.8}
                >
                    <View style={styles.caAvatarWrapper}>
                        <ExpoLinearGradient
                            colors={['#2563eb', '#7c3aed']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.caAvatarCircle}
                        >
                            <Text style={styles.caAvatarCircleText}>{getInitials(user?.name)}</Text>
                        </ExpoLinearGradient>
                        <View style={styles.caAvatarOnline} />
                    </View>
                </TouchableOpacity>

                {/* Dropdown Profile Modal Card (Matching Web ca-profile-dropdown-card) */}
                {dropdownVisible && (
                    <View style={styles.caProfileDropdownCard}>
                        {/* Speech Bubble Pointer Arrow */}
                        <View style={styles.caDropdownPointer} />

                        {/* Header Row with Cyber Avatar & Security Graphic */}
                        <View style={styles.caDropHeader}>
                            {/* Left Avatar with Orbital Ring and Shield */}
                            <View style={styles.caDropAvatarWrap}>
                                <View style={styles.caAvatarOrbitalRing}>
                                    <View style={[styles.caOrbitalNode, styles.caOrbitalNode1]} />
                                    <View style={[styles.caOrbitalNode, styles.caOrbitalNode2]} />
                                </View>
                                <ExpoLinearGradient
                                    colors={['#0284c7', '#2563eb', '#7c3aed']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.caDropAvatar}
                                >
                                    <Text style={styles.caDropAvatarText}>{getInitials(user?.name) || 'PH'}</Text>
                                </ExpoLinearGradient>
                                <View style={styles.caAvatarShieldBadge}>
                                    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                        <Path d="M9 12l2 2 4-4"/>
                                    </Svg>
                                </View>
                            </View>

                            {/* Center User Info */}
                            <View style={styles.caDropUserInfo}>
                                <Text style={styles.caDropName} numberOfLines={1}>{user?.name || 'Hospital Admin'}</Text>
                                <Text style={styles.caDropEmail} numberOfLines={1}>{user?.email || 'admin@hospital.com'}</Text>
                                <View style={styles.caDropBadgeTag}>
                                    <Text style={styles.caCrownIcon}>👑</Text>
                                    <Text style={styles.caBadgeText}>{(user?.role || 'HOSPITALADMIN').toUpperCase().replace(/\s+/g, '')}</Text>
                                </View>
                            </View>

                            {/* Right 3D Security Shield Graphic */}
                            <View style={styles.caDropShieldGraphic}>
                                <View style={styles.caShieldOrbitRing}>
                                    <View style={styles.caShieldParticle} />
                                </View>
                                <View style={styles.caShieldHexBox}>
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Defs>
                                            <SvgLinearGradient id="shieldCyberGrad" x1="3" y1="2" x2="21" y2="22">
                                                <Stop stopColor="#38bdf8" />
                                                <Stop offset="0.5" stopColor="#6366f1" />
                                                <Stop offset="1" stopColor="#a855f7" />
                                            </SvgLinearGradient>
                                        </Defs>
                                        <Path d="M12 2L3 6.5v6c0 5.55 3.84 10.74 9 12.5 5.16-1.76 9-6.95 9-12.5v-6L12 2z" fill="url(#shieldCyberGrad)" />
                                        <Path d="M12 7.5a2 2 0 0 0-2 2v1.5h4V9.5a2 2 0 0 0-2-2z" stroke="#ffffff" strokeWidth="1.3" />
                                        <Rect x="8.5" y="11" width="7" height="5" rx="1.2" fill="#ffffff" />
                                        <Circle cx="12" cy="13.5" r="0.8" fill="#4338ca" />
                                    </Svg>
                                </View>
                            </View>
                        </View>

                        {/* Compact Last Login Card */}
                        <View style={styles.caDropLoginCard}>
                            <View style={styles.caLoginIconBox}>
                                <Feather name="clock" size={14} color="#6d28d9" />
                            </View>
                            <View style={styles.caLoginTexts}>
                                <Text style={styles.caLoginLabel}>LAST LOGIN</Text>
                                <Text style={styles.caLoginValue}>{formatLastLogin(user?.lastLogin)}</Text>
                            </View>
                        </View>

                        {/* Logout Session Button */}
                        <TouchableOpacity onPress={handleLogout} style={styles.caDropLogoutBtn} activeOpacity={0.8}>
                            <Feather name="log-out" size={15} color="#dc2626" />
                            <Text style={styles.caDropLogoutBtnText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

const DashboardLayout = ({ children }) => {
    const { width: windowWidth } = useWindowDimensions();
    const route = useRoute();
    const currentPath = route?.name;
    const isDarkModule = currentPath === 'IPDCommandCenter';
    const isMobileView = windowWidth <= 1024;
    const [sidebarOpen, setSidebarOpen] = useState(windowWidth > 1024);

    useEffect(() => {
        if (windowWidth <= 1024) {
            setSidebarOpen(false);
        } else {
            setSidebarOpen(true);
        }
    }, [windowWidth]);

    return (
        <View style={styles.erpLayout}>
            <DashboardSidebar isOpen={sidebarOpen} setOpen={setSidebarOpen} isMobile={isMobileView} />
            
            {isMobileView && sidebarOpen && (
                <TouchableOpacity 
                    style={styles.sidebarOverlay} 
                    activeOpacity={1} 
                    onPress={() => setSidebarOpen(false)} 
                />
            )}

            <View style={[styles.erpMainArea, isDarkModule && { backgroundColor: '#0b1120' }]}>
                <TopBar sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} isMobile={isMobileView} />
                <OfflineBanner />
                <View style={[styles.erpPageContent, isDarkModule && { padding: 0, backgroundColor: '#0b1120' }]}>
                    {children}
                </View>
            </View>
        </View>
    );
};

export default DashboardLayout;