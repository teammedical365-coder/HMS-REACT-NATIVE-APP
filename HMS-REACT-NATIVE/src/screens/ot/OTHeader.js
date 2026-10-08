import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOTResponsive } from './otResponsive';

const OTHeader = ({
    title = 'Operation Theatre Dashboard',
    subtitle = 'Real-time OT operations, surgery scheduling and patient workflow management.',
    lastUpdated = null,
    loading = false,
    onRefresh = null,
    searchQuery = '',
    onSearchChange = null,
    badgeCounts = {}
}) => {
    const navigation = useNavigation();
    const route = useRoute();
    const { isSmallPhone, isPhone, isTablet } = useOTResponsive();

    const navItems = [
        { label: 'Dashboard', routeName: 'OTDashboard', icon: '🏠', badge: null },
        { label: 'Planned Surgeries', routeName: 'OTPlannedSurgeries', icon: '⏱️', badge: badgeCounts.planned || null },
        { label: 'OT Schedule', routeName: 'OTSchedulePage', icon: '📅', badge: badgeCounts.today || null },
        { label: 'OT Rooms', routeName: 'OTRoomsPage', icon: '🚪', badge: badgeCounts.roomsInUse ? `${badgeCounts.roomsInUse} in OT` : null },
        { label: 'Pre-Op', routeName: 'OTPreOpPage', icon: '🩺', badge: badgeCounts.preOp || null },
        { label: 'In OT', routeName: 'OTInProgressPage', icon: '🔴', badge: badgeCounts.inOt || null, isPulse: badgeCounts.inOt > 0 },
        { label: 'Post-Op', routeName: 'OTPostOpPage', icon: '❤️', badge: badgeCounts.postOp || null },
        { label: 'Completed', routeName: 'OTCompletedPage', icon: '✅', badge: badgeCounts.completed || null },
        { label: 'Surgeons', routeName: 'OTSurgeonsPage', icon: '👨‍⚕️', badge: null },
        { label: 'Reports', routeName: 'OTReportsPage', icon: '📄', badge: null },
    ];

    return (
        <View style={styles.container}>
            {/* Top Bar Header */}
            <LinearGradient
                colors={['#0f172a', '#1e293b']}
                style={[
                    styles.headerBox,
                    isSmallPhone && styles.headerBoxSmall,
                    isPhone && !isSmallPhone && styles.headerBoxPhone,
                ]}
            >
                <View style={[styles.headerTopRow, isPhone && styles.headerTopRowPhone]}>
                    <View style={styles.titleContainer}>
                        <View style={styles.titleRow}>
                            <Text style={styles.titleEmoji}>🏥</Text>
                            <Text
                                style={[
                                    styles.titleText,
                                    isSmallPhone && styles.titleTextSmall,
                                    isPhone && !isSmallPhone && styles.titleTextPhone,
                                ]}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                            >
                                {title}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.subtitleText,
                                isPhone && { marginLeft: 0 },
                                isSmallPhone && styles.subtitleTextSmall,
                            ]}
                            numberOfLines={isSmallPhone ? 3 : 4}
                            ellipsizeMode="tail"
                        >
                            {subtitle}
                        </Text>
                    </View>

                    {/* Right Tools */}
                    <View style={[styles.toolsContainer, isPhone && styles.toolsContainerPhone]}>
                        {lastUpdated && (
                            <View style={styles.lastUpdatedBadge}>
                                <View style={styles.dot} />
                                <Text style={styles.lastUpdatedText}>
                                    Updated: <Text style={{ fontWeight: 'bold' }}>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </Text>
                            </View>
                        )}
                        {onRefresh && (
                            <TouchableOpacity
                                onPress={onRefresh}
                                disabled={loading}
                                style={styles.refreshBtn}
                                activeOpacity={0.7}
                            >
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: 'white', marginRight: 4 }}>🔄</Text>}
                                <Text style={styles.refreshBtnText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Global OT Search Bar */}
                {onSearchChange && (
                    <View style={[styles.searchContainer, { maxWidth: isTablet ? 640 : '100%' }]}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={onSearchChange}
                            placeholder="Global OT Search: patient, MRN, procedure, surgeon, room..."
                            placeholderTextColor="#94a3b8"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => onSearchChange('')}
                                style={styles.clearSearchBtn}
                                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                            >
                                <Text style={styles.clearSearchIcon}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </LinearGradient>

            {/* Quick OT Module Navigation Tabs */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.navScrollView}
                contentContainerStyle={styles.navContainer}
            >
                {navItems.map((item, idx) => {
                    const isActive = route.name === item.routeName;
                    return (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => navigation.navigate(item.routeName)}
                            style={[
                                styles.navItem,
                                isSmallPhone && styles.navItemSmall,
                                isActive ? styles.navItemActive : styles.navItemInactive
                            ]}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.navIcon}>{item.icon}</Text>
                            <Text
                                style={[
                                    styles.navLabel,
                                    isActive ? styles.navLabelActive : styles.navLabelInactive
                                ]}
                                numberOfLines={1}
                            >
                                {item.label}
                            </Text>
                            {item.badge !== null && item.badge !== undefined && (
                                <View style={[
                                    styles.badge,
                                    isActive ? styles.badgeActive : (item.isPulse ? styles.badgePulse : styles.badgeInactive)
                                ]}>
                                    <Text style={[
                                        styles.badgeText,
                                        isActive ? styles.badgeTextActive : (item.isPulse ? styles.badgeTextPulse : styles.badgeTextInactive)
                                    ]}>
                                        {item.badge}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    headerBox: {
        padding: 22,
        borderRadius: 16,
        marginBottom: 14,
        elevation: 4,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
    },
    headerBoxPhone: {
        padding: 16,
    },
    headerBoxSmall: {
        padding: 14,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
    },
    headerTopRowPhone: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    titleContainer: {
        flex: 1,
        minWidth: 0,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    titleEmoji: {
        fontSize: 22,
    },
    titleText: {
        fontSize: 23,
        fontWeight: '800',
        color: '#f8fafc',
        letterSpacing: -0.4,
        flexShrink: 1,
    },
    titleTextPhone: {
        fontSize: 19,
    },
    titleTextSmall: {
        fontSize: 17,
    },
    subtitleText: {
        marginTop: 6,
        marginLeft: 30,
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 18,
    },
    subtitleTextSmall: {
        marginLeft: 0,
        fontSize: 12,
        lineHeight: 16,
    },
    toolsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    toolsContainerPhone: {
        width: '100%',
        marginTop: 12,
        justifyContent: 'space-between',
    },
    lastUpdatedBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#22c55e',
    },
    lastUpdatedText: {
        fontSize: 11,
        color: '#cbd5e1',
    },
    refreshBtn: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 88,
    },
    refreshBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    searchContainer: {
        marginTop: 14,
        position: 'relative',
        width: '100%',
    },
    searchIcon: {
        position: 'absolute',
        left: 14,
        top: 13,
        color: '#94a3b8',
        fontSize: 15,
        zIndex: 1,
    },
    searchInput: {
        width: '100%',
        minHeight: 44,
        paddingVertical: 10,
        paddingLeft: 40,
        paddingRight: 40,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        color: '#fff',
        fontSize: 13,
    },
    clearSearchBtn: {
        position: 'absolute',
        right: 12,
        top: 12,
        zIndex: 1,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearSearchIcon: {
        color: '#94a3b8',
        fontSize: 15,
    },
    navScrollView: {
        width: '100%',
    },
    navContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 0,
        paddingRight: 24,
        paddingBottom: 6,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 13,
        minHeight: 44,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
        elevation: 1,
        flexShrink: 0,
    },
    navItemSmall: {
        paddingHorizontal: 10,
        minHeight: 44,
    },
    navItemActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    navItemInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
    },
    navIcon: {
        fontSize: 14,
    },
    navLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    navLabelActive: {
        color: '#ffffff',
    },
    navLabelInactive: {
        color: '#475569',
    },
    badge: {
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 12,
        borderWidth: 1,
    },
    badgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderColor: 'transparent',
    },
    badgePulse: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
    },
    badgeInactive: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    badgeTextActive: {
        color: '#ffffff',
    },
    badgeTextPulse: {
        color: '#dc2626',
    },
    badgeTextInactive: {
        color: '#1e293b',
    },
});

export default OTHeader;
