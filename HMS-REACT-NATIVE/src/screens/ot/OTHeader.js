import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

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
                style={styles.headerBox}
            >
                <View style={styles.headerTopRow}>
                    <View style={styles.titleContainer}>
                        <View style={styles.titleRow}>
                            <Text style={styles.titleEmoji}>🏥</Text>
                            <Text style={styles.titleText}>{title}</Text>
                        </View>
                        <Text style={styles.subtitleText}>{subtitle}</Text>
                    </View>

                    {/* Right Tools */}
                    <View style={styles.toolsContainer}>
                        {lastUpdated && (
                            <View style={styles.lastUpdatedBadge}>
                                <View style={styles.dot} />
                                <Text style={styles.lastUpdatedText}>
                                    Last updated: <Text style={{fontWeight: 'bold'}}>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </Text>
                            </View>
                        )}
                        {onRefresh && (
                            <TouchableOpacity 
                                onPress={onRefresh} 
                                disabled={loading}
                                style={styles.refreshBtn}
                            >
                                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: 'white', marginRight: 4}}>🔄</Text>}
                                <Text style={styles.refreshBtnText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Global OT Search Bar */}
                {onSearchChange && (
                    <View style={styles.searchContainer}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={onSearchChange}
                            placeholder="Global OT Search: patient name, MRN, procedure, surgeon, OT room..."
                            placeholderTextColor="#94a3b8"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => onSearchChange('')} style={styles.clearSearchBtn}>
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
                                isActive ? styles.navItemActive : styles.navItemInactive
                            ]}
                        >
                            <Text style={styles.navIcon}>{item.icon}</Text>
                            <Text style={[
                                styles.navLabel,
                                isActive ? styles.navLabelActive : styles.navLabelInactive
                            ]}>
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
        marginBottom: 24,
    },
    headerBox: {
        padding: 24,
        borderRadius: 16,
        marginBottom: 16,
        elevation: 5,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 25,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16
    },
    titleContainer: {
        flex: 1,
        minWidth: 250
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    titleEmoji: {
        fontSize: 24
    },
    titleText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#f8fafc',
        letterSpacing: -0.5
    },
    subtitleText: {
        marginTop: 6,
        marginLeft: 34,
        color: '#94a3b8',
        fontSize: 14
    },
    toolsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
    },
    lastUpdatedBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e'
    },
    lastUpdatedText: {
        fontSize: 12,
        color: '#cbd5e1'
    },
    refreshBtn: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100
    },
    refreshBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600'
    },
    searchContainer: {
        marginTop: 18,
        position: 'relative',
        maxWidth: 640
    },
    searchIcon: {
        position: 'absolute',
        left: 14,
        top: 13,
        color: '#94a3b8',
        fontSize: 16,
        zIndex: 1
    },
    searchInput: {
        width: '100%',
        paddingVertical: 11,
        paddingLeft: 42,
        paddingRight: 40,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderRadius: 10,
        color: '#fff',
        fontSize: 14
    },
    clearSearchBtn: {
        position: 'absolute',
        right: 12,
        top: 13,
        zIndex: 1
    },
    clearSearchIcon: {
        color: '#94a3b8',
        fontSize: 16
    },
    navScrollView: {
        flexDirection: 'row'
    },
    navContainer: {
        gap: 8,
        paddingBottom: 8,
        paddingRight: 20
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        gap: 8,
        elevation: 1,
        marginRight: 8
    },
    navItemActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12
    },
    navItemInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3
    },
    navIcon: {
        fontSize: 14
    },
    navLabel: {
        fontSize: 13,
        fontWeight: '700'
    },
    navLabelActive: {
        color: '#ffffff'
    },
    navLabelInactive: {
        color: '#475569'
    },
    badge: {
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 12,
        borderWidth: 1
    },
    badgeActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderColor: 'transparent'
    },
    badgePulse: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5'
    },
    badgeInactive: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0'
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '800'
    },
    badgeTextActive: {
        color: '#ffffff'
    },
    badgeTextPulse: {
        color: '#dc2626'
    },
    badgeTextInactive: {
        color: '#1e293b'
    }
});

export default OTHeader;
