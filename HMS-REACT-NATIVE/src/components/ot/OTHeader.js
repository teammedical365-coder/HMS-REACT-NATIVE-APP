import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

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
    const currentRouteName = route.name;

    const navItems = [
        { label: 'Dashboard', routeName: 'OTDashboard', icon: 'home', badge: null },
        { label: 'Planned Surgeries', routeName: 'OTPlanned', icon: 'clock', badge: badgeCounts.planned || null },
        { label: 'OT Schedule', routeName: 'OTSchedule', icon: 'calendar', badge: badgeCounts.today || null },
        { label: 'OT Rooms', routeName: 'OTRooms', icon: 'box', badge: badgeCounts.roomsInUse ? `${badgeCounts.roomsInUse} in OT` : null },
        { label: 'Pre-Op', routeName: 'OTPreOp', icon: 'user-check', badge: badgeCounts.preOp || null },
        { label: 'In OT', routeName: 'OTInProgress', icon: 'activity', badge: badgeCounts.inOt || null, isPulse: badgeCounts.inOt > 0 },
        { label: 'Post-Op', routeName: 'OTPostOp', icon: 'heart', badge: badgeCounts.postOp || null },
        { label: 'Completed', routeName: 'OTCompleted', icon: 'check-circle', badge: badgeCounts.completed || null },
        { label: 'Surgeons', routeName: 'OTSurgeons', icon: 'user', badge: null },
        { label: 'Reports', routeName: 'OTReports', icon: 'file-text', badge: null },
    ];

    return (
        <View style={styles.container}>
            {/* Top Bar Header */}
            <View style={styles.headerBox}>
                <View style={styles.headerTopRow}>
                    <View style={styles.titleSection}>
                        <View style={styles.titleRow}>
                            <Text style={{ fontSize: 24 }}>🏥</Text>
                            <Text style={styles.titleText}>{title}</Text>
                        </View>
                        <Text style={styles.subtitleText}>{subtitle}</Text>
                    </View>

                    {/* Right Tools (Last Updated + Refresh Button) */}
                    <View style={styles.toolsSection}>
                        {lastUpdated && (
                            <View style={styles.lastUpdatedBox}>
                                <View style={styles.greenDot} />
                                <Text style={styles.lastUpdatedText}>
                                    Last updated: <Text style={{ fontWeight: 'bold' }}>{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </Text>
                            </View>
                        )}
                        {onRefresh && (
                            <TouchableOpacity 
                                onPress={onRefresh} 
                                disabled={loading}
                                style={styles.btnRefresh}
                            >
                                <Feather name="refresh-cw" size={14} color="#fff" />
                                <Text style={styles.btnRefreshText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Global OT Search Bar */}
                {onSearchChange && (
                    <View style={styles.searchContainer}>
                        <Feather name="search" size={18} color="#94a3b8" style={styles.searchIconLeft} />
                        <TextInput
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={onSearchChange}
                            placeholder="Global OT Search: patient name, MRN, procedure, surgeon, OT room, plan ID..."
                            placeholderTextColor="#94a3b8"
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => onSearchChange('')} style={styles.searchIconRight}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}
            </View>

            {/* Quick OT Module Navigation Tabs */}
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContainer}
            >
                {navItems.map((item, idx) => {
                    const isActive = currentRouteName === item.routeName;
                    return (
                        <TouchableOpacity
                            key={idx}
                            onPress={() => navigation.navigate(item.routeName)}
                            style={[
                                styles.tabItem,
                                isActive ? styles.tabItemActive : styles.tabItemInactive
                            ]}
                        >
                            <Feather 
                                name={item.icon} 
                                size={16} 
                                color={isActive ? '#ffffff' : '#475569'} 
                            />
                            <Text style={[
                                styles.tabText,
                                { color: isActive ? '#ffffff' : '#475569' }
                            ]}>
                                {item.label}
                            </Text>
                            
                            {item.badge !== null && item.badge !== undefined && (
                                <View style={[
                                    styles.badgeContainer,
                                    isActive ? { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 0 } 
                                             : { backgroundColor: item.isPulse ? '#fee2e2' : '#f1f5f9', borderColor: '#e2e8f0', borderWidth: 1 }
                                ]}>
                                    <Text style={[
                                        styles.badgeText,
                                        { color: isActive ? '#ffffff' : (item.isPulse ? '#dc2626' : '#1e293b') }
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
        backgroundColor: '#1e293b', // Replaces linear gradient fallback
        paddingVertical: 24,
        paddingHorizontal: 28,
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
        gap: 16,
    },
    titleSection: {
        flex: 1,
        minWidth: 300,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    titleText: {
        fontSize: 26,
        fontWeight: '800',
        color: '#f8fafc',
        letterSpacing: -0.5,
    },
    subtitleText: {
        marginTop: 6,
        marginLeft: 42,
        color: '#94a3b8',
        fontSize: 14,
    },
    toolsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    lastUpdatedBox: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    greenDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22c55e',
    },
    lastUpdatedText: {
        fontSize: 13,
        color: '#cbd5e1',
    },
    btnRefresh: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    btnRefreshText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    searchContainer: {
        marginTop: 18,
        position: 'relative',
        maxWidth: 640,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        borderRadius: 10,
    },
    searchIconLeft: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 11,
        paddingLeft: 42,
        paddingRight: 40,
        color: '#fff',
        fontSize: 14,
    },
    searchIconRight: {
        position: 'absolute',
        right: 12,
        zIndex: 1,
        padding: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 8,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
    },
    tabItemActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1,
        elevation: 3,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    tabItemInactive: {
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
    },
    badgeContainer: {
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
    }
});

export default OTHeader;
