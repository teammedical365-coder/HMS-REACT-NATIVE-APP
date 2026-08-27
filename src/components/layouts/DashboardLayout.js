import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { useBranding } from '../../context/BrandingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlobalSearch from '../GlobalSearch';
import { styles, isMobile, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED } from './DashboardLayoutStyles';

// In React Native Web, we don't have direct react-icons imports. 
// Assuming you map these to proper SVGs or a font library (like @expo/vector-icons). 
// For structural parity, we'll represent them as Text emojis/strings as placeholders 
// ensuring NO UI breaks. (You can replace them with Feather Icons later).
const FiHome = () => <Text style={{fontSize: 18}}>🏠</Text>;
const FiUsers = () => <Text style={{fontSize: 18}}>👥</Text>;
const FiCalendar = () => <Text style={{fontSize: 18}}>📅</Text>;
const FiActivity = () => <Text style={{fontSize: 18}}>📈</Text>;
const FiPackage = () => <Text style={{fontSize: 18}}>📦</Text>;
const FiLogOut = () => <Text style={{fontSize: 18}}>🚪</Text>;
const FiPieChart = () => <Text style={{fontSize: 18}}>🥧</Text>;
const FiClipboard = () => <Text style={{fontSize: 18}}>📋</Text>;
const FiFileText = () => <Text style={{fontSize: 18}}>📄</Text>;
const FiPlusSquare = () => <Text style={{fontSize: 18}}>➕</Text>;
const FiGrid = () => <Text style={{fontSize: 18}}>🔲</Text>;
const FiShield = () => <Text style={{fontSize: 18}}>🛡️</Text>;
const FiMenu = () => <Text style={{fontSize: 24, color: '#1e293b'}}>☰</Text>;
const FiX = () => <Text style={{fontSize: 24, color: '#64748b'}}>✕</Text>;
const FiClock = () => <Text style={{fontSize: 18}}>⏱️</Text>;
const FiBox = () => <Text style={{fontSize: 18}}>📦</Text>;
const FiUserCheck = () => <Text style={{fontSize: 18}}>✅</Text>;
const FiHeart = () => <Text style={{fontSize: 18}}>❤️</Text>;
const FiCheckCircle = () => <Text style={{fontSize: 18}}>✔️</Text>;
const FiUser = () => <Text style={{fontSize: 18}}>👤</Text>;

const DashboardSidebar = ({ isOpen, setOpen }) => {
    const { user } = useSelector(state => state.auth);
    const { branding, hospitalName } = useBranding();
    const role = (user?.role || '').toLowerCase();
    
    const navigation = useNavigation();
    const route = useRoute();
    // React Navigation route.name acts like location.pathname
    const currentPath = route.name; 

    const isCentralAdmin = (role === 'centraladmin' || role === 'superadmin');
    
    // Categorized Menus
    const getMenu = () => {
        // In React Navigation, paths are screen names. 
        const isOTRoute = currentPath.startsWith('OT') || currentPath === 'OTDashboard';
        const roleClean = role.replace(/\s+/g, '');

        if (roleClean === 'otmanager' || roleClean === 'otstaff' || (isOTRoute && (role === 'hospitaladmin' || role === 'centraladmin' || role === 'superadmin' || role === 'doctor'))) {
            return [
                { label: 'OT Dashboard', path: 'OTDashboard', icon: <FiHome /> },
                { label: 'Planned Surgeries', path: 'OTPlannedSurgeries', icon: <FiClock /> },
                { label: 'OT Schedule', path: 'OTSchedulePage', icon: <FiCalendar /> },
                { label: 'OT Rooms', path: 'OTRoomsPage', icon: <FiBox /> },
                { label: 'Pre-Op Patients', path: 'OTPreOpPage', icon: <FiUserCheck /> },
                { label: 'In OT', path: 'OTInProgressPage', icon: <FiActivity /> },
                { label: 'Post-Op', path: 'OTPostOpPage', icon: <FiHeart /> },
                { label: 'Completed Surgeries', path: 'OTCompletedPage', icon: <FiCheckCircle /> },
                { label: 'Surgeons', path: 'OTSurgeonsPage', icon: <FiUser /> },
                { label: 'OT Reports', path: 'OTReportsPage', icon: <FiFileText /> }
            ];
        }

        if (role === 'centraladmin' || role === 'superadmin') {
            return [
                { label: 'System Overview', path: 'CentralAdminDashboard', icon: <FiHome /> },
                { label: 'Question Library', path: 'AdminQuestionLibrary', icon: <FiFileText /> },
                { label: 'Consent Hub', path: 'ConsentManagement', icon: <FiClipboard /> },
                { label: 'Role & Permissions', path: 'AdminRoles', icon: <FiShield /> },
                { label: 'Manage All Staff', path: 'Admin', icon: <FiUsers /> }, // Adjusted from /admin/users
            ];
        }
        if (role === 'hospitaladmin') {
            // AsyncStorage logic wrapped in useEffect generally, but for sync returns we mock it based on Redux state
            if (user?.clinicType === 'clinic' || user?.subscriptionPlan === 'starter') {
                return [
                    { label: 'Clinic Hub', path: 'HospitalAdminDashboard', icon: <FiHome /> },
                ];
            }
            return [
                { label: 'Hospital Overview', path: 'HospitalAdminDashboard', icon: <FiPieChart /> },
                { label: 'OT Operations', path: 'OTDashboard', icon: <FiActivity /> },
                { label: 'Clinical Questions', path: 'HospitalAdminQuestionLibrary', icon: <FiFileText /> },
                { label: 'Staff Management', path: 'Admin', icon: <FiUsers /> },
                { label: 'Doctors Feed', path: 'AdminDoctors', icon: <FiActivity /> },
                { label: 'Pharma Inventory', path: 'PharmacyInventory', icon: <FiPackage /> },
            ];
        }
        if (role === 'doctor' || role === 'clinic doctor') {
            if (user?.clinicType === 'clinic') {
                return [
                    { label: 'Doctor Dashboard', path: 'Dashboard', icon: <FiHome /> },
                ];
            }
            return [
                { label: 'Dashboard', path: 'Patient', icon: <FiClipboard /> }, // Adjusted from /doctor/cases
                { label: 'My Patients', path: 'DoctorPatientDetails', icon: <FiUsers /> },
                { label: '🤖 AI Assistant', path: 'AIAssistant', icon: <FiFileText /> },
            ];
        }
        if (role === 'reception' || role === 'receptionist') {
            return [
                { label: 'Reception Dashboard', path: 'ReceptionDashboard', icon: <FiHome /> },
                { label: 'Patient Registration', path: 'ReceptionPatients', icon: <FiPlusSquare /> }, // Adjusted param logic
                { label: 'Patient Billing', path: 'PatientBillingProfile', icon: <FiFileText /> },
            ];
        }
        if (role === 'lab') {
            return [
                { label: 'Lab Dashboard', path: 'LabDashboard', icon: <FiActivity /> },
                { label: 'Assigned Tests', path: 'AssignedTests', icon: <FiFileText /> },
            ];
        }
        if (role.includes('pharmac')) {
            return [
                { label: 'Inventory', path: 'PharmacyInventory', icon: <FiPackage /> },
                { label: 'Pharmacy Orders', path: 'PharmacyOrders', icon: <FiClipboard /> },
                { label: 'Purchase Invoices', path: 'PurchaseInvoiceHistory', icon: <FiFileText /> },
                { label: 'Returns', path: 'PharmacyReturns', icon: <FiActivity /> },
                { label: 'Vendor Returns', path: 'VendorReturns', icon: <FiActivity /> },
                { label: 'Collections', path: 'PharmacyCollections', icon: <FiPieChart /> },
                { label: 'Departments', path: 'PharmacyDepartments', icon: <FiGrid /> },
            ];
        }

        if (role === 'accountant') {
            return [
                { label: 'Finance Dashboard', path: 'AccountantDashboard', icon: <FiPieChart /> },
            ];
        }
        if (role === 'cashier') {
            return [
                { label: 'Billing/Payments', path: 'CashierDashboard', icon: <FiFileText /> },
            ];
        }
        if (role === 'nurse') {
            return [
                { label: 'Patient Queue', path: 'ReceptionPatients', icon: <FiUsers /> }, // Fallback
                { label: 'Appointments', path: 'Appointments', icon: <FiCalendar /> },
            ];
        }
        if (role === 'billing') {
            return [
                { label: 'Patient Billing', path: 'CashierDashboard', icon: <FiFileText /> },
            ];
        }
        return [
            { label: 'My Dashboard', path: 'Dashboard', icon: <FiHome /> },
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
                            source={{ uri: isCentralAdmin ? 'https://via.placeholder.com/175x36?text=Medical365' : (branding?.logoUrl || branding?.logo || 'https://via.placeholder.com/175x36?text=Medical365') }}
                            style={styles.brandLogo}
                        />
                    )}
                </View>
                
                {isMobile && isOpen && (
                    <TouchableOpacity style={styles.mobileCloseBtn} onPress={() => setOpen(false)}>
                        <FiX />
                    </TouchableOpacity>
                )}
            </View>
            
            <ScrollView style={styles.sidebarNav} showsVerticalScrollIndicator={false}>
                {menuItems.map((item, idx) => {
                    // Logic simplification for RN screen matching
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
                                navigation.navigate(item.path);
                                if (isMobile) setOpen(false);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.sidebarLinkIcon}>
                                {item.icon}
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

                {/* Need Help Widget Card inside Sidebar for Central Admin */}
                {isCentralAdmin && isOpen && (
                    <View style={styles.caSidebarHelpCard}>
                        <View style={styles.caSidebarHelpAvatarWrap}>
                            <Text style={{fontSize: 20}}>🎧</Text>
                        </View>
                        <Text style={styles.caSidebarHelpTitle}>Need Help?</Text>
                        <Text style={styles.caSidebarHelpDesc}>
                            Check our documentation or contact support.
                        </Text>
                        <TouchableOpacity style={styles.caSidebarHelpBtn} onPress={() => Linking.openURL('mailto:teammedical365@gmail.com')}>
                            <Text style={styles.caSidebarHelpBtnText}>🎧 Contact Support</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Collapse button for Central Admin */}
            {isCentralAdmin && !isMobile && (
                <View style={styles.caSidebarFooter}>
                    <TouchableOpacity style={styles.caSidebarCollapseBtn} onPress={() => setOpen(!isOpen)}>
                        <Text style={styles.caSidebarCollapseBtnText}>{isOpen ? '«' : '»'}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
const TopBar = ({ toggleSidebar, sidebarOpen }) => {
    const { user } = useSelector(state => state.auth);
    const { branding, hospitalName } = useBranding();
    const dispatch = useDispatch();
    const navigation = useNavigation();
    const route = useRoute();
    const currentPath = route.name; // Replacing location.pathname

    const role = (user?.role || '').toLowerCase();
    const isCentralAdmin = (role === 'centraladmin' || role === 'superadmin');

    const [dropdownVisible, setDropdownVisible] = useState(false);

    const handleLogout = () => {
        setDropdownVisible(false);
        dispatch(logout());
        // Depending on your auth flow, the navigator might automatically switch to the Auth stack,
        // otherwise you can explicitly call navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    // Helper to get initials
    const getInitials = (name) => {
        return (name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getCentralAdminTag = () => {
        if (currentPath === 'SuperAdmin') return 'CENTRAL ADMIN';
        if (currentPath.includes('QuestionLibrary')) return 'QUESTION LIBRARY';
        if (currentPath.includes('Consent')) return 'CONSENT HUB';
        if (currentPath.includes('Roles')) return 'ROLES & PERMISSIONS';
        if (currentPath.includes('Admin')) return 'MANAGE STAFF';
        if (currentPath.includes('Revenue')) return 'REVENUE ANALYTICS';
        return 'CENTRAL ADMIN';
    };

    // Helper to make Route names look like readable breadcrumbs
    const formatPageName = (name) => {
        if (name.includes('PatientProfile')) return 'Patient Profile';
        // Add spaces before capital letters for camelCase screen names
        return name.replace(/([A-Z])/g, ' $1').trim() || 'Dashboard';
    };

    return (
        <View style={[styles.erpTopbar, isCentralAdmin && styles.caErpTopbar, isMobile && styles.mobileTopbarLeft]}>
            <View style={styles.topbarLeft}>
                <TouchableOpacity style={styles.sidebarToggle} onPress={toggleSidebar} activeOpacity={0.6}>
                    <FiMenu />
                </TouchableOpacity>

                {isCentralAdmin ? (
                    <View style={styles.caTopbarBreadcrumb}>
                        {!isMobile && <Text style={styles.caBcUserType}>Superadmin</Text>}
                        {!isMobile && <Text style={styles.caBcDivider}>/</Text>}
                        <View style={styles.caBcTag}>
                            <Text style={[{ color: '#2563eb', fontSize: 11.5, fontWeight: '800' }, isMobile && styles.mobileBcTag]}>
                                {getCentralAdminTag()}
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.breadcrumbWrap}>
                        {!isMobile && (
                            <Text style={styles.currPageName} numberOfLines={1}>
                                {formatPageName(currentPath)}
                            </Text>
                        )}
                        {!isMobile && <Text style={styles.pathSlash}>/</Text>}
                        <Text style={styles.pathUserRole}>{user?.role || 'User'}</Text>
                    </View>
                )}
            </View>

            {/* GlobalSearch needs to be compatible with React Native. 
                Assuming it has been or will be converted independently. */}
            {!isMobile && <GlobalSearch />}

            <View style={styles.topbarRight}>
                {isCentralAdmin ? (
                    <View style={styles.caTopbarActions}>
                        {!isMobile && (
                            <TouchableOpacity style={styles.caActionCircleBtn}>
                                <Text style={{fontSize: 16}}>✨</Text>
                            </TouchableOpacity>
                        )}
                        
                        <TouchableOpacity style={[styles.caActionCircleBtn, styles.caNotifBtn]}>
                            <Text style={{fontSize: 16}}>🔔</Text>
                            <View style={styles.caNotifBadge}>
                                <Text style={styles.caNotifBadgeText}>3</Text>
                            </View>
                        </TouchableOpacity>

                        {!isMobile && (
                            <TouchableOpacity 
                                style={styles.caUserProfileChip}
                                onPress={() => setDropdownVisible(!dropdownVisible)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.caAvatarWrapper}>
                                    <View style={styles.caAvatarCircle}>
                                        {user?.avatar ? (
                                            <Image source={{ uri: user.avatar }} style={styles.profileAvatarImage} />
                                        ) : (
                                            <Text style={styles.caAvatarText}>{getInitials(user?.name) || 'PH'}</Text>
                                        )}
                                    </View>
                                    <View style={styles.caAvatarOnline} />
                                </View>
                                <View style={styles.caUserDetailsCol}>
                                    <Text style={styles.caUserNameText}>{user?.name || 'Pawan Harish'}</Text>
                                    <Text style={styles.caUserRoleText}>Super Admin</Text>
                                </View>
                                <Text style={styles.caChevronArrow}>▾</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity 
                        style={styles.userProfileWidget}
                        onPress={() => setDropdownVisible(!dropdownVisible)}
                        activeOpacity={0.7}
                    >
                        {!isMobile && (
                            <View style={styles.profileTextInfo}>
                                <Text style={styles.userDispName} numberOfLines={1}>
                                    {(user?.role || '').toLowerCase().includes('doctor') ? 'Dr. ' : ''}{user?.name || 'User'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.profileAvatarWrap}>
                            <View style={styles.profileAvatar}>
                                {user?.avatar ? (
                                    <Image source={{ uri: user.avatar }} style={styles.profileAvatarImage} />
                                ) : (
                                    <Text style={styles.profileAvatarText}>{getInitials(user?.name)}</Text>
                                )}
                            </View>
                            <View style={styles.onlineIndicator} />
                        </View>
                    </TouchableOpacity>
                )}

                {/* Dropdown Profile Modal (Absolute Positioned) */}
                {dropdownVisible && (
                    <View style={styles.profileDropdownContent}>
                        <View style={styles.pHeader}>
                            <Text style={styles.pHeaderTitle}>{user?.name || 'Pawan Harish'}</Text>
                            <Text style={styles.pHeaderEmail}>{user?.email || 'admin@medical365.in'}</Text>
                            <Text style={styles.pRoleBadge}>{user?.role || 'Super Admin'}</Text>
                        </View>
                        <View style={styles.pFooter}>
                            <TouchableOpacity onPress={handleLogout} style={styles.btnPLogout}>
                                <FiLogOut />
                                <Text style={styles.btnPLogoutText}>Logout Session</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};
const DashboardLayout = ({ children }) => {
    const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
    const [sidebarOpen, setSidebarOpen] = useState(windowWidth > 1024);

    useEffect(() => {
        // Handle screen resizing or orientation changes (Tablet/Web)
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setWindowWidth(window.width);
            if (window.width <= 1024) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        });
        return () => {
            if (subscription?.remove) {
                subscription.remove();
            }
        };
    }, []);

    // We recalculate this locally in addition to the static 'isMobile' from styles 
    // so it reacts dynamically to screen rotations.
    const isMobileView = windowWidth <= 1024;

    return (
        <View style={styles.erpLayout}>
            {/* The Sidebar Component */}
            <DashboardSidebar isOpen={sidebarOpen} setOpen={setSidebarOpen} />
            
            {/* Mobile Overlay - Darkens background when sidebar is open on small screens */}
            {isMobileView && sidebarOpen && (
                <TouchableOpacity 
                    style={styles.sidebarOverlay} 
                    activeOpacity={1} 
                    onPress={() => setSidebarOpen(false)} 
                />
            )}

            {/* Main Content Area */}
            <View style={[
                styles.erpMainArea,
                // On desktop, we shift the main area so the sidebar doesn't overlap it
                !isMobileView && (sidebarOpen ? { paddingLeft: SIDEBAR_WIDTH } : { paddingLeft: SIDEBAR_COLLAPSED }),
            ]}>
                <TopBar sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                
                {/* The actual screen content goes here */}
                <View style={styles.erpPageContent}>
                    {children}
                </View>
            </View>
        </View>
    );
};

export default DashboardLayout;