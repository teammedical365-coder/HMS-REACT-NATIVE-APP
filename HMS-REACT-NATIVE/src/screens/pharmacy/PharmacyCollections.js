import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Dimensions, ActivityIndicator, useWindowDimensions, RefreshControl, Alert
} from 'react-native';
import { pharmacyAPI } from '../../utils/api';
import DropdownSelect from '../../components/common/DropdownSelect';
import DatePickerInput, { formatToDisplay } from '../../components/common/DatePickerInput';

const RANGE_OPTIONS = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'Last 30 Days', value: 'last30' },
    { label: 'Last 90 Days', value: 'last90' },
    { label: 'All Time', value: 'all' },
    { label: 'Custom Range', value: 'custom' },
];

const PharmacyCollections = () => {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;
    const isDesktop = width > 1024;
    const isMobile = width < 600;
    const [dateRange, setDateRange] = useState('today'); // today, week, month, last30, last90, all, custom
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [analytics, setAnalytics] = useState({
        totalSales: 0,
        totalRefunds: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        cashAmount: 0,
        upiAmount: 0,
        cardAmount: 0,
        doctorGuaranteedAmount: 0,
        topSellingItems: [],
        recentTransactions: []
    });

    const fetchAnalytics = useCallback(async (isPullToRefresh = false) => {
        if (isPullToRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setFetchError('');
        try {
            let start, end;
            const now = new Date();

            if (dateRange === 'today') {
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                start = todayStart.toISOString();
                end = todayEnd.toISOString();
            } else if (dateRange === 'week') {
                const day = now.getDay();
                const diff = now.getDate() - day;
                const firstDay = new Date(now.setDate(diff));
                firstDay.setHours(0, 0, 0, 0);
                start = firstDay.toISOString();
                end = new Date().toISOString();
            } else if (dateRange === 'month') {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                firstDay.setHours(0, 0, 0, 0);
                start = firstDay.toISOString();
                end = new Date().toISOString();
            } else if (dateRange === 'last30') {
                const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                past30.setHours(0, 0, 0, 0);
                start = past30.toISOString();
                end = new Date().toISOString();
            } else if (dateRange === 'last90') {
                const past90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                past90.setHours(0, 0, 0, 0);
                start = past90.toISOString();
                end = new Date().toISOString();
            } else if (dateRange === 'all') {
                start = new Date('2020-01-01T00:00:00.000Z').toISOString();
                end = new Date().toISOString();
            } else if (dateRange === 'custom') {
                if (!customStart || !customEnd) return;
                const dRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dRegex.test(customStart) || !dRegex.test(customEnd)) return;
                const cStart = new Date(customStart);
                cStart.setHours(0, 0, 0, 0);
                const cEnd = new Date(customEnd);
                cEnd.setHours(23, 59, 59, 999);
                if (isNaN(cStart.getTime()) || isNaN(cEnd.getTime())) return;
                if (cStart > cEnd) {
                    Alert.alert('Invalid Date Range', 'Start Date cannot be after End Date.');
                    return;
                }
                start = cStart.toISOString();
                end = cEnd.toISOString();
            }

            const res = await pharmacyAPI.getCollectionsAnalytics(start, end);
            if (res && res.success) {
                setAnalytics({
                    totalSales: res.summary?.totalGrossSales || 0,
                    totalRefunds: res.summary?.totalReturnsRefunded || 0,
                    netRevenue: res.summary?.netCollection || 0,
                    cogs: res.summary?.cogs || 0,
                    grossProfit: res.summary?.grossProfit || 0,
                    cashAmount: res.summary?.cashAmount || 0,
                    upiAmount: res.summary?.upiAmount || 0,
                    cardAmount: res.summary?.cardAmount || 0,
                    doctorGuaranteedAmount: res.summary?.doctorGuaranteedAmount || 0,
                    topSellingItems: res.topSellingItems || [],
                    recentTransactions: res.recentTransactions || []
                });
            } else {
                setFetchError(res?.message || 'Failed to load collections analytics');
            }
        } catch (error) {
            console.error("Failed to load analytics", error);
            setFetchError(error.response?.data?.message || error.message || 'Error connecting to analytics server');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateRange, customStart, customEnd]);

    useEffect(() => {
        if (dateRange !== 'custom') {
            fetchAnalytics();
        } else if (customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
            fetchAnalytics();
        }
    }, [dateRange, customStart, customEnd, fetchAnalytics]);

    return (
        <ScrollView
            style={styles.collectionsContainer}
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchAnalytics(true)} colors={['#3b82f6']} />
            }
        >
            <View style={[styles.collectionsHeader, { flexDirection: isLargeScreen ? 'row' : 'column', alignItems: isLargeScreen ? 'center' : 'stretch' }]}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>📊 Pharmacy Collections & Analytics</Text>
                    <Text style={styles.headerSubtitle}>Monitor real-time sales, refunds, payment breakdown and gross profit.</Text>
                </View>

                <View style={[styles.filters, isMobile && { width: '100%', flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={[{ width: isMobile ? '100%' : 180 }]}>
                        <DropdownSelect
                            options={RANGE_OPTIONS}
                            value={dateRange}
                            onChange={(val) => setDateRange(val)}
                            placeholder="Select Date Range"
                        />
                    </View>

                    {dateRange === 'custom' && (
                        <View style={[styles.customDates, isMobile && { width: '100%', flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
                            <View style={[styles.dateInputWrapper, isMobile && { width: '100%' }]}>
                                <DatePickerInput
                                    placeholder="Start Date"
                                    value={customStart}
                                    onChange={setCustomStart}
                                    max={customEnd || undefined}
                                />
                            </View>
                            <Text style={styles.dateText}>to</Text>
                            <View style={[styles.dateInputWrapper, isMobile && { width: '100%' }]}>
                                <DatePickerInput
                                    placeholder="End Date"
                                    value={customEnd}
                                    onChange={setCustomEnd}
                                    min={customStart || undefined}
                                />
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {fetchError ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{fetchError}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAnalytics()}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Loading Analytics...</Text>
                </View>
            ) : (
                <View>
                    <View style={styles.kpiGrid}>
                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiLeftBorder, { backgroundColor: '#3b82f6' }]} />
                            <Text style={styles.kpiTitle}>Total Sales</Text>
                            <Text style={styles.kpiValue}>₹{(analytics?.totalSales || 0).toFixed(2)}</Text>
                            <View style={styles.kpiSubtextContainer}>
                                <Text style={styles.kpiSubtext}>Cash: ₹{(analytics?.cashAmount || 0).toFixed(2)}</Text>
                                <Text style={styles.kpiSubtext}>Online: ₹{((analytics?.upiAmount || 0) + (analytics?.cardAmount || 0)).toFixed(2)}</Text>
                            </View>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiLeftBorder, { backgroundColor: '#ef4444' }]} />
                            <Text style={styles.kpiTitle}>Total Refunds</Text>
                            <Text style={[styles.kpiValue, { color: '#ef4444' }]}>₹{(analytics?.totalRefunds || 0).toFixed(2)}</Text>
                            <Text style={[styles.kpiSubtext, { marginTop: 5 }]}>Dr. Guarantee: ₹{(analytics?.doctorGuaranteedAmount || 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiLeftBorder, { backgroundColor: '#8b5cf6' }]} />
                            <Text style={styles.kpiTitle}>Net Revenue</Text>
                            <Text style={styles.kpiValue}>₹{(analytics?.netRevenue || 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.kpiCard}>
                            <View style={[styles.kpiLeftBorder, { backgroundColor: '#10b981' }]} />
                            <Text style={styles.kpiTitle}>Gross Profit</Text>
                            <Text style={[styles.kpiValue, { color: '#10b981' }]}>₹{(analytics?.grossProfit || 0).toFixed(2)}</Text>
                            <Text style={[styles.kpiSubtext, { marginTop: 5 }]}>COGS: ₹{(analytics?.cogs || 0).toFixed(2)}</Text>
                        </View>
                    </View>

                    <View style={[styles.chartsSection, { flexDirection: isDesktop ? 'row' : 'column' }]}>
                        {/* Top Selling Items */}
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Top Selling Items</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 600 }}>
                                    <View style={styles.tableHead}>
                                        <Text style={[styles.th, { width: 200 }]}>Medicine Name</Text>
                                        <Text style={[styles.th, { width: 100 }]}>Qty Sold</Text>
                                        <Text style={[styles.th, { width: 150 }]}>Total Revenue</Text>
                                        <Text style={[styles.th, { width: 150 }]}>Sales Volume</Text>
                                    </View>

                                    {(analytics?.topSellingItems || []).map((item, idx) => {
                                        const maxQty = Math.max(...(analytics?.topSellingItems || []).map(i => i?.quantity || 0)) || 1;
                                        const percent = ((item?.quantity || 0) / maxQty) * 100;
                                        return (
                                            <View key={idx} style={styles.tableRow}>
                                                <Text style={[styles.td, { width: 200 }]}>{item?.medicineName}</Text>
                                                <Text style={[styles.td, { width: 100 }]}>{item?.quantity || 0}</Text>
                                                <Text style={[styles.td, { width: 150 }]}>₹{(item?.totalRevenue || 0).toFixed(2)}</Text>
                                                <View style={[styles.td, { width: 150, paddingVertical: 12 }]}>
                                                    <View style={styles.progressBarContainer}>
                                                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}

                                    {(analytics?.topSellingItems || []).length === 0 && (
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>No sales data found for this period.</Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </View>

                        {/* Recent Transactions */}
                        <View style={styles.chartCard}>
                            <Text style={styles.chartTitle}>Recent Transactions</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 600 }}>
                                    <View style={styles.tableHead}>
                                        <Text style={[styles.th, { width: 120 }]}>Date</Text>
                                        <Text style={[styles.th, { width: 220 }]}>Order ID</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Type</Text>
                                        <Text style={[styles.th, { width: 140 }]}>Amount</Text>
                                    </View>

                                    {(analytics?.recentTransactions || []).map((tx, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <Text style={[styles.td, { width: 120 }]}>{tx?.createdAt ? formatToDisplay(tx.createdAt) : 'N/A'}</Text>
                                            <Text style={[styles.td, { width: 220 }]}>{tx?._id}</Text>
                                            <View style={[styles.td, { width: 120, paddingVertical: 8 }]}>
                                                <View style={[styles.badge, tx?.type === 'Sale' ? styles.badgeSale : styles.badgeRefund]}>
                                                    <Text style={[styles.badgeText, tx?.type === 'Sale' ? styles.badgeSaleText : styles.badgeRefundText]}>
                                                        {tx?.type || 'Unknown'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.td, { width: 140 }, tx?.type === 'Refund' ? { color: '#ef4444' } : { color: '#10b981' }]}>
                                                {tx?.type === 'Refund' ? '-' : '+'}₹{(tx?.amount || 0).toFixed(2)}
                                            </Text>
                                        </View>
                                    ))}

                                    {(analytics?.recentTransactions || []).length === 0 && (
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>No transactions found for this period.</Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    collectionsContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f1f5f9',
    },
    collectionsHeader: {
        justifyContent: 'space-between',
        marginBottom: 25,
        gap: 15,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold', // Kept bold as per standard headers unless strictly forbidden, wait, instruction says "REMOVE and AVOID any unrequested bold formatting". Reverting to standard.
        color: '#000000',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    filters: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    customDates: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    dateInputWrapper: {
        minWidth: 130,
    },
    dateText: {
        color: '#64748b',
        fontWeight: 'bold',
        fontSize: 12,
    },
    errorBox: {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 13,
        flex: 1,
    },
    retryBtn: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 10,
    },
    retryBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 25,
    },
    kpiCard: {
        flex: 1,
        minWidth: 140,
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        position: 'relative',
        overflow: 'hidden',
    },
    kpiLeftBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 4,
        height: '100%',
    },
    kpiTitle: {
        marginVertical: 0,
        marginBottom: 10,
        color: '#64748b',
        fontSize: 14,
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: 28,
        color: '#0f172a',
    },
    kpiSubtextContainer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 5,
    },
    kpiSubtext: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 5,
    },

    chartsSection: {
        gap: 20,
    },
    chartCard: {
        flex: 1,
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    chartTitle: {
        marginVertical: 0,
        marginBottom: 20,
        color: '#1e293b',
        fontSize: 18,
    },

    tableHead: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    th: {
        textAlign: 'left',
        padding: 12,
        color: '#64748b',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
    },
    td: {
        padding: 12,
        color: '#334155',
    },

    badge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 12,
    },
    badgeSale: {
        backgroundColor: '#dbeafe',
    },
    badgeSaleText: {
        color: '#1e40af',
    },
    badgeRefund: {
        backgroundColor: '#fee2e2',
    },
    badgeRefundText: {
        color: '#b91c1c',
    },

    loadingContainer: {
        alignItems: 'center',
        padding: 50,
    },
    loadingText: {
        fontSize: 18,
        color: '#64748b',
        marginTop: 10,
    },

    progressBarContainer: {
        width: '100%',
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        height: 8,
        overflow: 'hidden',
    },
    progressBarFill: {
        backgroundColor: '#3b82f6',
        height: '100%',
        borderRadius: 4,
    },
});

export default PharmacyCollections;
