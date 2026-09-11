import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');
export const isMobile = width <= 1024;
export const SIDEBAR_WIDTH = 238;
export const SIDEBAR_COLLAPSED = 72;
export const TOPBAR_HEIGHT = 64;

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
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        gap: 10,
    },
    sidebarBrandCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    caSidebarBrand: {
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    caBrandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandLogo: {
        height: 38,
        width: 180,
        maxWidth: 180,
        resizeMode: 'contain',
    },
    mobileCloseBtn: {
        padding: 4,
    },

    /* Sidebar Nav & Links */
    sidebarNav: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    sidebarLink: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9.5,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 4,
        gap: 10,
        borderLeftWidth: 4,
        borderLeftColor: 'transparent',
    },
    sidebarLinkCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    sidebarLinkActive: {
        backgroundColor: '#ecfdf5',
        borderLeftColor: '#059669',
    },
    sidebarLinkIcon: {
        width: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sidebarLinkText: {
        color: '#1e293b',
        fontWeight: '600',
        fontSize: 13.7,
        letterSpacing: -0.15,
    },
    sidebarLinkTextActive: {
        color: '#059669',
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

    /* HA Sidebar AI Assistant Card (Matching Web ha-sidebar-ai-card) */
    haSidebarAiCard: {
        marginTop: 16,
        marginHorizontal: 8,
        marginBottom: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#cffafe',
        alignItems: 'center',
        overflow: 'hidden',
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 3,
    },
    haSidebarAiBotWrap: {
        width: '100%',
        height: 98,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haSidebarAiTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 4,
        letterSpacing: -0.2,
        textAlign: 'center',
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
        gap: 12,
        zIndex: 999,
    },
    topbarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexShrink: 1,
        minWidth: 0,
    },
    sidebarToggle: {
        padding: 6,
        borderRadius: 8,
    },

    /* Breadcrumbs */
    breadcrumbWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
        minWidth: 0,
    },
    currPageName: {
        fontWeight: '700',
        color: '#1e293b',
        textTransform: 'capitalize',
        fontSize: 14,
        maxWidth: 180,
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
    /* Topbar Profile Avatar Circle Button (Matching Web ca-user-profile-circle-btn) */
    caUserProfileCircleBtn: {
        padding: 2,
    },
    caAvatarWrapper: {
        position: 'relative',
        width: 36,
        height: 36,
    },
    caAvatarCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    caAvatarCircleText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 12.5,
    },
    caAvatarOnline: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#ffffff',
        zIndex: 2,
    },

    /* Profile Dropdown Card (Matching Web ca-profile-dropdown-card) */
    dropdownOverlay: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    caProfileDropdownCard: {
        position: 'absolute',
        top: Platform.OS === 'web' ? 56 : 50,
        right: 12,
        width: 315,
        backgroundColor: '#ffffff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        padding: 14,
        elevation: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 36,
        zIndex: 10001,
    },
    caDropdownPointer: {
        position: 'absolute',
        top: -6,
        right: 14,
        width: 11,
        height: 11,
        backgroundColor: '#ffffff',
        borderLeftWidth: 1,
        borderLeftColor: '#cbd5e1',
        borderTopWidth: 1,
        borderTopColor: '#cbd5e1',
        transform: [{ rotate: '45deg' }],
        zIndex: 10002,
    },
    caDropHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        position: 'relative',
    },
    caDropAvatarWrap: {
        position: 'relative',
        width: 42,
        height: 42,
        flexShrink: 0,
    },
    caAvatarOrbitalRing: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.45)',
        borderStyle: 'dashed',
    },
    caOrbitalNode: {
        position: 'absolute',
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
    },
    caOrbitalNode1: {
        top: 0,
        left: 9,
        backgroundColor: '#6366f1',
    },
    caOrbitalNode2: {
        bottom: 2,
        right: 6,
        backgroundColor: '#0284c7',
    },
    caDropAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 2,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 3,
    },
    caDropAvatarText: {
        color: '#ffffff',
        fontWeight: '900',
        fontSize: 13.5,
        letterSpacing: 0.5,
    },
    caAvatarShieldBadge: {
        position: 'absolute',
        bottom: -4,
        left: 8,
        width: 17,
        height: 17,
        borderRadius: 5,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#c084fc',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
    },
    caDropUserInfo: {
        flex: 1,
        minWidth: 0,
    },
    caDropName: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 2,
    },
    caDropEmail: {
        fontSize: 11.5,
        color: '#334155',
        fontWeight: '600',
        marginBottom: 5,
    },
    caDropBadgeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ede9fe',
        paddingVertical: 2.5,
        paddingHorizontal: 8,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        alignSelf: 'flex-start',
    },
    caCrownIcon: {
        fontSize: 10,
    },
    caBadgeText: {
        color: '#3730a3',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    caDropShieldGraphic: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    caShieldOrbitRing: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderStyle: 'dashed',
    },
    caShieldParticle: {
        position: 'absolute',
        top: 0,
        left: 2,
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: '#6366f1',
    },
    caShieldHexBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#c4b5fd',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 2,
    },
    caDropLoginCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 12,
        backgroundColor: '#faf5ff',
        borderWidth: 1,
        borderColor: '#ede9fe',
        borderRadius: 12,
        marginBottom: 10,
    },
    caLoginIconBox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    caLoginTexts: {
        flexDirection: 'column',
    },
    caLoginLabel: {
        fontSize: 9.5,
        color: '#475569',
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    caLoginValue: {
        fontSize: 12,
        fontWeight: '800',
        color: '#5b21b6',
    },
    caDropLogoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 9,
        paddingHorizontal: 12,
        backgroundColor: '#fff5f5',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 12,
        gap: 6,
    },
    caDropLogoutBtnText: {
        color: '#dc2626',
        fontWeight: '800',
        fontSize: 13,
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
        minHeight: 0,
        overflow: 'hidden',
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