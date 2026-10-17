import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { financeAPI, billingAPI } from '../../utils/api';
import DatePickerInput from '../../components/common/DatePickerInput';
import OfflineBanner from '../../components/common/OfflineBanner';
import { checkOnlineStatus } from '../../services/offline/networkStatus';
import { fetchAccountantDashboardWithOffline } from '../../services/offline/offlineHospitalAdminService';
import socket from '../../utils/socket';

const AccountantDashboard = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isNarrow = width < 520;
    const isSmall = width < 380;
    const [currentUser, setCurrentUser] = useState({});
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [offlineMeta, setOfflineMeta] = useState(null);

    const [billingSearch, setBillingSearch] = useState('');
    const [billingSearching, setBillingSearching] = useState(false);

    const [datePreset, setDatePreset] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        const checkAuth = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) { navigation.navigate('Login'); return; }
            const user = JSON.parse(userStr);
            setCurrentUser(user);
            const role = user?.role ? user.role.toLowerCase() : '';
            const perms = user?.permissions || [];
            if (!['accountant', 'centraladmin', 'superadmin', 'hospitaladmin'].includes(role) && !perms.includes('finance_view')) {
                Alert.alert('Unauthorized', 'Access denied.');
                navigation.navigate('Home');
            } else {
                fetchStats('all');
            }
        };
        checkAuth();
    }, []);

    // Real-time socket updates matching web AccountantDashboard
    useEffect(() => {
        if (!socket || !socket.on) return;
        const handleRefundUpdate = () => fetchStats(datePreset, customStartDate, customEndDate);
        socket.on('refund_requested', handleRefundUpdate);
        socket.on('refund_approved', handleRefundUpdate);
        socket.on('refund_completed', handleRefundUpdate);
        socket.on('refund_rejected', handleRefundUpdate);
        return () => {
            socket.off('refund_requested', handleRefundUpdate);
            socket.off('refund_approved', handleRefundUpdate);
            socket.off('refund_completed', handleRefundUpdate);
            socket.off('refund_rejected', handleRefundUpdate);
        };
    }, [datePreset, customStartDate, customEndDate]);

    const fetchStats = async (preset = datePreset, start = customStartDate, end = customEndDate) => {
        setLoading(true);
        setError('');
        try {
            let queryStart = '';
            let queryEnd = '';
            if (preset !== 'all' && preset !== 'custom') {
                const now = new Date();
                const endD = new Date(now);
                const startD = new Date(now);
                if (preset === 'today') {
                    startD.setHours(0,0,0,0);
                    endD.setHours(23,59,59,999);
                } else if (preset === '7') {
                    startD.setDate(startD.getDate() - 7);
                } else if (preset === '30') {
                    startD.setDate(startD.getDate() - 30);
                } else if (preset === '60') {
                    startD.setDate(startD.getDate() - 60);
                } else if (preset === '90') {
                    startD.setDate(startD.getDate() - 90);
                }
                queryStart = startD.toISOString();
                queryEnd = endD.toISOString();
            } else if (preset === 'custom') {
                if (start) queryStart = new Date(start).toISOString();
                if (end) queryEnd = new Date(end).toISOString();
            }
            const res = await fetchAccountantDashboardWithOffline(queryStart, queryEnd);
            if (res.success && res.data) {
                setStats(res.data);
                setOfflineMeta(res.offlineMeta || (res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.cachedAt,
                    freshnessNote: res.freshnessNote
                } : null));
            } else {
                setError(res.message || res.error || 'Failed to fetch financial stats');
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch financial stats');
        } finally {
            setLoading(false);
        }
    };

    const handleBillingSearch = async () => {
        if (!billingSearch.trim()) return;
        setBillingSearching(true);
        try {
            const isOnline = await checkOnlineStatus();
            if (!isOnline) {
                Alert.alert('Offline Notice', 'Live billing lookup requires an active internet connection.');
                return;
            }
            const res = await billingAPI.getPatientBills(billingSearch.trim());
            if (res.success) {
                // Navigate to billing profile
                navigation.navigate('PatientBillingProfile', { q: billingSearch.trim() });
            }
        } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Patient not found'); }
        finally { setBillingSearching(false); }
    };

    const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt || 0);

    const statCardWidth = isSmall ? '100%' : (isNarrow ? '48%' : (width >= 1024 ? '31.5%' : '48%'));

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OfflineBanner offlineMeta={offlineMeta} />
            <View style={styles.header}>
                <Text style={styles.title}>Finance & Accounting</Text>
                <Text style={styles.subtitle}>Track revenues, costs, and profits</Text>
            </View>

            {/* Quick Financial Shortcuts */}
            <View style={[styles.quickNavRow, isSmall && { flexDirection: 'column' }]}>
                <TouchableOpacity
                    style={[styles.quickNavBtn, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
                    onPress={() => navigation.navigate('AccountantFinancialRecords')}
                >
                    <Feather name="file-text" size={15} color="#15803d" />
                    <Text style={[styles.quickNavBtnText, { color: '#15803d' }]}>Records</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.quickNavBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
                    onPress={() => navigation.navigate('AccountantRefunds')}
                >
                    <Feather name="dollar-sign" size={15} color="#dc2626" />
                    <Text style={[styles.quickNavBtnText, { color: '#dc2626' }]}>Refunds</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.quickNavBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                    onPress={() => navigation.navigate('AccountantHistory')}
                >
                    <Feather name="clock" size={15} color="#2563eb" />
                    <Text style={[styles.quickNavBtnText, { color: '#2563eb' }]}>History</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>🧾 Patient Billing Search</Text>
                <View style={[styles.searchRow, isNarrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <TextInput
                        style={[styles.input, isNarrow && { width: '100%', marginBottom: 8 }]}
                        placeholder="Search Phone/MRN..."
                        value={billingSearch}
                        onChangeText={setBillingSearch}
                    />
                    <View style={[styles.searchButtonsRow, isNarrow && { flexDirection: 'row', width: '100%', gap: 8 }]}>
                        <TouchableOpacity
                            style={[styles.btnPrimary, isNarrow && { flex: 1, height: 42 }]}
                            onPress={handleBillingSearch}
                            disabled={billingSearching}
                        >
                            <Text style={styles.btnText}>{billingSearching ? '...' : 'Search'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btnOpenBilling, isNarrow && { flex: 1.2, height: 42 }]}
                            onPress={() => navigation.navigate('PatientBillingProfile')}
                        >
                            <Text style={styles.btnOpenBillingText}>Open Billing</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>📅 Analytics Timeframe</Text>
                <View style={styles.filterRow}>
                    {[
                        { key: 'all', label: 'All Time' },
                        { key: 'today', label: 'Today' },
                        { key: '7', label: '7 Days' },
                        { key: '30', label: '30 Days' },
                        { key: '60', label: '60 Days' },
                        { key: '90', label: '90 Days' },
                    ].map(p => (
                        <TouchableOpacity
                            key={p.key}
                            style={[
                                styles.filterBtn,
                                datePreset === p.key && styles.filterBtnActive,
                                isSmall ? { flexBasis: '47%', minWidth: 100 } : (isNarrow ? { flexBasis: '30%', minWidth: 70 } : { flex: 1 })
                            ]}
                            onPress={() => { setDatePreset(p.key); fetchStats(p.key); }}
                        >
                            <Text style={datePreset === p.key ? styles.filterBtnTextActive : styles.filterBtnText}>
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Custom Date Range Controls */}
                <View style={[styles.customDateRow, isNarrow && { flexDirection: 'column', alignItems: 'stretch' }]}>
                    <View style={[styles.customDateInputs, isNarrow ? { flexDirection: 'row', width: '100%', alignItems: 'center', gap: 6 } : { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                        <View style={{ flex: 1, minWidth: 105 }}>
                            <DatePickerInput
                                placeholder="Start Date"
                                title="Start Date"
                                value={customStartDate}
                                onChange={(val) => { setDatePreset('custom'); setCustomStartDate(val || ''); }}
                            />
                        </View>
                        <Text style={styles.dateToText}>to</Text>
                        <View style={{ flex: 1, minWidth: 105 }}>
                            <DatePickerInput
                                placeholder="End Date"
                                title="End Date"
                                value={customEndDate}
                                onChange={(val) => { setDatePreset('custom'); setCustomEndDate(val || ''); }}
                            />
                        </View>
                    </View>
                    <View style={[styles.customDateActions, isNarrow ? { flexDirection: 'row', width: '100%', gap: 8, marginTop: 8 } : { flexDirection: 'row', gap: 8 }]}>
                        <TouchableOpacity
                            style={[styles.btnApplyCustom, isNarrow && { flex: 1, height: 42 }]}
                            onPress={() => fetchStats('custom', customStartDate, customEndDate)}
                        >
                            <Text style={styles.btnApplyCustomText}>Apply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btnResetCustom, isNarrow && { flex: 1, height: 42 }]}
                            onPress={() => {
                                setCustomStartDate('');
                                setCustomEndDate('');
                                setDatePreset('all');
                                fetchStats('all', '', '');
                            }}
                        >
                            <Text style={styles.btnResetCustomText}>Reset</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {error ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {error}</Text>
                    <TouchableOpacity onPress={() => fetchStats()} style={styles.retryBtn}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {loading ? <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} /> : stats && (
                <>
                    <Text style={styles.sectionTitle}>📊 Overall Financials</Text>
                    <View style={styles.grid}>
                        <View style={[styles.statBox, { borderLeftColor: '#22c55e', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Total Revenue</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.totalRevenue)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#ef4444', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Total Costs</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.medicines?.cost)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#8b5cf6', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Net Profit</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.totalProfit)}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>🏥 Department Breakdown</Text>
                    <View style={styles.grid}>
                        <View style={[styles.statBox, { borderLeftColor: '#0ea5e9', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Consultations</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.consultations?.revenue)}</Text>
                            <Text style={styles.statSub}>{stats.consultations?.count} Paid</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#ec4899', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Lab Tests</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.labTests?.revenue)}</Text>
                            <Text style={styles.statSub}>{stats.labTests?.count} Paid</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#f59e0b', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Pharmacy Gross</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.medicines?.revenue)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#10b981', width: statCardWidth }]}>
                            <Text style={styles.statLabel}>Pharmacy Net</Text>
                            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.medicines?.profit)}</Text>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 16, paddingBottom: 60 },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    subtitle: { fontSize: 14, color: '#64748b' },
    card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1e293b' },
    searchRow: { flexDirection: 'row', gap: 10 },
    searchButtonsRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, minHeight: 42, backgroundColor: '#ffffff' },
    btnPrimary: { backgroundColor: '#3b82f6', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 8, minHeight: 42 },
    btnText: { color: 'white', fontWeight: 'bold' },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    filterBtn: { flex: 1, minHeight: 38, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#f1f5f9' },
    filterBtnActive: { backgroundColor: '#3b82f6' },
    filterBtnText: { color: '#475569', fontWeight: '600', fontSize: 11 },
    filterBtnTextActive: { color: 'white', fontWeight: 'bold', fontSize: 11 },
    btnOpenBilling: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', borderRadius: 8, minHeight: 42 },
    btnOpenBillingText: { color: '#15803d', fontWeight: '700', fontSize: 13 },
    customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    customDateInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    customDateActions: { flexDirection: 'row', gap: 8 },
    dateInput: { flex: 1, height: 38, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, backgroundColor: '#ffffff', fontSize: 13, color: '#1e293b' },
    dateToText: { fontSize: 13, color: '#64748b', fontWeight: '600', alignSelf: 'center' },
    btnApplyCustom: { backgroundColor: '#2563eb', paddingHorizontal: 14, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
    btnApplyCustomText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    btnResetCustom: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
    btnResetCustomText: { color: '#475569', fontWeight: '700', fontSize: 12 },
    errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    errorText: { color: '#dc2626', fontSize: 13, flex: 1, marginRight: 8 },
    retryBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 12, color: '#334155' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statBox: { backgroundColor: 'white', padding: 16, borderRadius: 12, elevation: 1, borderLeftWidth: 4, marginBottom: 10 },
    statLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    statSub: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
    quickNavRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    quickNavBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 44
    },
    quickNavBtnText: { fontSize: 12, fontWeight: '700' }
});

export default AccountantDashboard;
