import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');
export const isMobile = width <= 1024;
export const SIDEBAR_WIDTH = 270;
export const SIDEBAR_COLLAPSED = 85;
export const TOPBAR_HEIGHT = 70;

export const styles = StyleSheet.create({
    /* Layout Structure */
    erpLayout: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
    },
    erpMainArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
        height: '100%',
    },

    /* Sidebar Styling */
    erpSidebar: {
        backgroundColor: '#ffffff',
        borderRightWidth: 1,
        borderRightColor: '#e2e8f0',
        height: '100%',
        zIndex: 1000,
        elevation: 5,
    },
    erpSidebarOpen: {
        width: SIDEBAR_WIDTH,
    },
    erpSidebarCollapsed: {
        width: SIDEBAR_COLLAPSED,
    },
    erpSidebarMobileHidden: {
        position: 'absolute',
        left: -SIDEBAR_WIDTH,
    },
    erpSidebarMobileVisible: {
        position: 'absolute',
        left: 0,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },

    /* Sidebar Brand */
    sidebarBrand: {
        height: TOPBAR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 12,
    },
    sidebarBrandCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    caSidebarBrand: {
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    caBrandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandLogo: {
        height: 36,
        width: 175,
        resizeMode: 'contain',
    },
    mobileCloseBtn: {
        padding: 4,
    },

    /* Sidebar Nav & Links */
    sidebarNav: {
        flex: 1,
        paddingVertical: 24,
        paddingHorizontal: 12,
    },
    sidebarLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        marginBottom: 4,
        gap: 12,
    },
    sidebarLinkCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    sidebarLinkActive: {
        backgroundColor: 'rgba(30, 132, 127, 0.1)',
    },
    sidebarLinkIcon: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sidebarLinkText: {
        color: '#64748b',
        fontWeight: '500',
        fontSize: 14.8,
    },
    sidebarLinkTextActive: {
        color: '#1e847f',
        fontWeight: '700',
    },

    /* Central Admin Layout Overrides */
    caSidebarLink: {
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 6,
    },
    caSidebarLinkText: {
        color: '#334155',
        fontWeight: '600',
    },
    caSidebarLinkTextActive: {
        color: '#059669',
    },

    /* Theme Variants for CA Sidebar */
    themeGreenActive: {
        backgroundColor: '#ecfdf5',
        borderLeftWidth: 3.5,
        borderLeftColor: '#059669',
    },
    themeGreenTextActive: { color: '#059669' },

    themeBlueActive: {
        backgroundColor: '#f0f9ff',
        borderLeftWidth: 3.5,
        borderLeftColor: '#0284c7',
    },
    themeBlueTextActive: { color: '#0284c7' },

    themeTealActive: {
        backgroundColor: '#f0fdfa',
        borderLeftWidth: 3.5,
        borderLeftColor: '#0d9488',
    },
    themeTealTextActive: { color: '#0d9488' },

    themePurpleActive: {
        backgroundColor: '#faf5ff',
        borderLeftWidth: 3.5,
        borderLeftColor: '#8b5cf6',
    },
    themePurpleTextActive: { color: '#8b5cf6' },

    themePinkActive: {
        backgroundColor: '#fff1f2',
        borderLeftWidth: 3.5,
        borderLeftColor: '#e11d48',
    },
    themePinkTextActive: { color: '#e11d48' },

    /* CA Sidebar Help Card */
    caSidebarHelpCard: {
        marginVertical: 16,
        marginHorizontal: 6,
        paddingTop: 20,
        paddingHorizontal: 14,
        paddingBottom: 16,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#dcfce7',
        borderRadius: 20,
        alignItems: 'center',
    },
    caSidebarHelpAvatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ecfdf5',
        borderWidth: 1.5,
        borderColor: '#a7f3d0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    caSidebarHelpTitle: {
        fontSize: 15.2,
        fontWeight: '800',
        color: '#064e3b',
        marginBottom: 4,
    },
    caSidebarHelpDesc: {
        fontSize: 12.5,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    caSidebarHelpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#a7f3d0',
        gap: 6,
    },
    caSidebarHelpBtnText: {
        color: '#059669',
        fontSize: 13,
        fontWeight: '700',
    },

    /* Sidebar Footer */
    caSidebarFooter: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        alignItems: 'flex-start',
    },
    caSidebarCollapseBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caSidebarCollapseBtnText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: 'bold',
    },

    /* Topbar Styling */
    erpTopbar: {
        height: TOPBAR_HEIGHT,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isMobile ? 16 : 32,
        zIndex: 999,
    },
    topbarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    sidebarToggle: {
        padding: 8,
        borderRadius: 8,
    },

    /* Breadcrumbs */
    breadcrumbWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currPageName: {
        fontWeight: '700',
        color: '#1e293b',
        textTransform: 'capitalize',
        fontSize: 14,
    },
    pathSlash: {
        color: '#64748b',
    },
    pathUserRole: {
        color: '#1e847f',
        fontWeight: '600',
        backgroundColor: 'rgba(30, 132, 127, 0.1)',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
        textTransform: 'uppercase',
        fontSize: 12,
    },

    /* Central Admin Breadcrumb */
    caTopbarBreadcrumb: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    caBcUserType: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 14,
    },
    caBcDivider: {
        color: '#94a3b8',
    },
    caBcTag: {
        backgroundColor: '#eff6ff',
        color: '#2563eb',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 20,
        fontSize: 11.5,
        fontWeight: '800',
    },

    /* Topbar Right Area */
    topbarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },

    /* Regular Profile Widget */
    userProfileWidget: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    profileTextInfo: {
        alignItems: 'flex-end',
    },
    userDispName: {
        fontWeight: '700',
        fontSize: 14.4,
        color: '#1e293b',
        textTransform: 'capitalize',
    },
    profileAvatarWrap: {
        position: 'relative',
    },
    profileAvatar: {
        width: 44,
        height: 44,
        backgroundColor: '#1e847f',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#ffffff',
        elevation: 3,
    },
    profileAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    profileAvatarText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 15.2,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        backgroundColor: '#10b981',
        borderWidth: 3,
        borderColor: '#ffffff',
        borderRadius: 7,
    },

    /* CA Profile & Actions */
    caTopbarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    caActionCircleBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caNotifBtn: {
        position: 'relative',
    },
    caNotifBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 17,
        height: 17,
        backgroundColor: '#ef4444',
        borderRadius: 8.5,
        borderWidth: 2,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caNotifBadgeText: {
        color: '#ffffff',
        fontSize: 10.4,
        fontWeight: '800',
    },
    caUserProfileChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        paddingLeft: 4,
        borderRadius: 24,
    },
    caAvatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    caAvatarText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 14,
    },
    caUserDetailsCol: {
        flexDirection: 'column',
    },
    caUserNameText: {
        fontSize: 13.7,
        fontWeight: '700',
        color: '#0f172a',
    },
    caUserRoleText: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '500',
    },
    caChevronArrow: {
        color: '#94a3b8',
        fontSize: 12,
    },

    /* New Added Styles for Topbar */
    globalSearchPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        width: 300,
    },
    globalSearchText: {
        color: '#94a3b8',
        fontSize: 13,
        marginLeft: 8,
    },
    bellIconBtn: {
        position: 'relative',
        padding: 4,
    },
    bellBadge: {
        position: 'absolute',
        top: 0,
        right: 2,
        backgroundColor: '#ef4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    bellBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    profileAvatarBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileAvatarBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 14,
    },

    /* Profile Dropdown (Modal equivalent in RN) */
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    profileDropdownContent: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 70 : 60,
        right: 16,
        width: 280,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 8,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        zIndex: 2000,
    },
    pHeader: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 8,
    },
    pHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
        textTransform: 'capitalize',
    },
    pHeaderEmail: {
        fontSize: 13.2,
        color: '#64748b',
    },
    pHeaderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    pAvatarLg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#8b5cf6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    pAvatarLgText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    pNameEmail: {
        flex: 1,
    },
    pRoleBadge: {
        backgroundColor: 'rgba(30, 132, 127, 0.1)',
        color: '#1e847f',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        fontSize: 11.2,
        fontWeight: '800',
        textTransform: 'uppercase',
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    pBody: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    lastLoginRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastLoginText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    pFooter: {
        padding: 16,
    },
    btnPLogout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 10,
        gap: 8,
    },
    btnPLogoutText: {
        color: '#dc2626',
        fontWeight: '800',
        fontSize: 14,
    },

    /* Mobile Overrides for Topbar */
    mobileTopbarLeft: {
        flexShrink: 1,
    },
    mobileBcTag: {
        fontSize: 10,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },

    /* Main Content Area */
    erpPageContent: {
        flex: 1,
        padding: isMobile ? 16 : 24,
    },

    /* Mobile Overlay */
    sidebarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 998,
    }
});