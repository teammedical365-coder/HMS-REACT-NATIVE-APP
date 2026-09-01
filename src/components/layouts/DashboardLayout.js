import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { useBranding } from '../../context/BrandingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlobalSearch from '../GlobalSearch';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { styles, isMobile, SIDEBAR_WIDTH, SIDEBAR_COLLAPSED } from './DashboardLayoutStyles';

const DashboardSidebar = ({ isOpen, setOpen }) => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const { branding } = useBranding();
    const role = (user?.role || '').toLowerCase();
    
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
        return [
            { label: 'Dashboard', path: 'Dashboard', icon: <Feather name="home" size={18} /> },
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
                            source={isCentralAdmin ? require('../../assets/medical365-logo.png') : (branding?.logoUrl ? { uri: branding.logoUrl } : require('../../assets/medical365-logo.png'))}
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
                                navigation.navigate(item.path);
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

                {isCentralAdmin && isOpen && (
                    <View style={styles.caSidebarHelpCard}>
                        <View style={styles.caSidebarHelpAvatarWrap}>
                            <MaterialCommunityIcons name="robot-outline" size={24} color="#059669" />
                        </View>
                        <Text style={styles.caSidebarHelpTitle}>AI Assistant</Text>
                        <Text style={styles.caSidebarHelpDesc}>
                            Get automated insights and support from our AI bot.
                        </Text>
                        <TouchableOpacity style={styles.caSidebarHelpBtn} onPress={() => {}}>
                            <Feather name="message-circle" size={14} color="#059669" />
                            <Text style={styles.caSidebarHelpBtnText}>Ask AI</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: isOpen ? 10 : 0 }}>
                <TouchableOpacity 
                    style={[styles.sidebarLink, !isOpen && styles.sidebarLinkCollapsed]} 
                    onPress={async () => {
                        try {
                            dispatch(logout());
                            await AsyncStorage.removeItem('token');
                            await AsyncStorage.removeItem('user');
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

const TopBar = ({ toggleSidebar, sidebarOpen }) => {
    const { user } = useSelector(state => state.auth);
    const dispatch = useDispatch();
    const route = useRoute();
    const currentPath = route.name; 

    const role = (user?.role || '').toLowerCase();
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

    const getInitials = (name) => {
        return (name || 'PH').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getCentralAdminTag = () => {
        if (currentPath === 'CentralAdminDashboard') return 'CENTRAL ADMIN';
        if (currentPath.includes('QuestionLibrary')) return 'QUESTION LIBRARY';
        if (currentPath.includes('Consent')) return 'CONSENT HUB';
        if (currentPath.includes('Roles')) return 'ROLES & PERMISSIONS';
        if (currentPath.includes('Admin')) return 'MANAGE STAFF';
        if (currentPath.includes('Revenue')) return 'REVENUE ANALYTICS';
        return 'CENTRAL ADMIN';
    };

    return (
        <View style={[styles.erpTopbar, isCentralAdmin && styles.caErpTopbar, isMobile && styles.mobileTopbarLeft]}>
            <View style={styles.topbarLeft}>
                <TouchableOpacity style={styles.sidebarToggle} onPress={toggleSidebar} activeOpacity={0.6}>
                    <Feather name="menu" size={24} color="#1e293b" />
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
                        <Text style={styles.currPageName} numberOfLines={1}>{currentPath}</Text>
                    </View>
                )}
            </View>

            {/* Global Search */}
            {!isMobile && isCentralAdmin && (
                <View style={styles.globalSearchPill}>
                    <Feather name="search" size={16} color="#94a3b8" />
                    <Text style={styles.globalSearchText}>Search patients, doctors, st...</Text>
                </View>
            )}
            {!isCentralAdmin && !isMobile && <GlobalSearch />}

            <View style={styles.topbarRight}>
                {isCentralAdmin && (
                    <TouchableOpacity style={styles.bellIconBtn}>
                        <Feather name="bell" size={20} color="#64748b" />
                        <View style={styles.bellBadge}>
                            <Text style={styles.bellBadgeText}>3</Text>
                        </View>
                    </TouchableOpacity>
                )}

                <TouchableOpacity 
                    style={styles.profileAvatarBtn}
                    onPress={() => setDropdownVisible(!dropdownVisible)}
                >
                    <Text style={styles.profileAvatarBtnText}>{getInitials(user?.name)}</Text>
                </TouchableOpacity>

                {/* Dropdown Profile Modal (Absolute Positioned) */}
                {dropdownVisible && (
                    <View style={styles.profileDropdownContent}>
                        <View style={styles.pHeader}>
                            <View style={styles.pHeaderTop}>
                                <View style={styles.pAvatarLg}>
                                    <Text style={styles.pAvatarLgText}>{getInitials(user?.name)}</Text>
                                </View>
                                <View style={styles.pNameEmail}>
                                    <Text style={styles.pHeaderTitle}>{user?.name || 'Pawan Harish'}</Text>
                                    <Text style={styles.pHeaderEmail}>{user?.email || 'pawanharish2@gmail.c...'}</Text>
                                </View>
                            </View>
                            <Text style={styles.pRoleBadge}>{user?.role || 'CENTRALADMIN'}</Text>
                        </View>
                        
                        <View style={styles.pBody}>
                            <View style={styles.lastLoginRow}>
                                <Feather name="clock" size={14} color="#64748b" style={{marginRight: 8}} />
                                <Text style={styles.lastLoginText}>LAST LOGIN: Today, 09:42 AM</Text>
                            </View>
                        </View>

                        <View style={styles.pFooter}>
                            <TouchableOpacity onPress={handleLogout} style={styles.btnPLogout}>
                                <Text style={styles.btnPLogoutText}>[→ Logout</Text>
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
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setWindowWidth(window.width);
            if (window.width <= 1024) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        });
        return () => subscription?.remove && subscription.remove();
    }, []);

    const isMobileView = windowWidth <= 1024;
    
    return (
        <View style={styles.erpLayout}>
            <DashboardSidebar isOpen={sidebarOpen} setOpen={setSidebarOpen} />
            
            {isMobileView && sidebarOpen && (
                <TouchableOpacity 
                    style={styles.sidebarOverlay} 
                    activeOpacity={1} 
                    onPress={() => setSidebarOpen(false)} 
                />
            )}

            <View style={styles.erpMainArea}>
                <TopBar sidebarOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                
                <View style={styles.erpPageContent}>
                    {children}
                </View>
            </View>
        </View>
    );
};

export default DashboardLayout;