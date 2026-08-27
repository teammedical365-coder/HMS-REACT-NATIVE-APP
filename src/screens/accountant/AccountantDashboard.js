import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { financeAPI, billingAPI } from '../../utils/api';

const AccountantDashboard = () => {
    const navigation = useNavigation();
    const [currentUser, setCurrentUser] = useState({});
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const [billingSearch, setBillingSearch] = useState('');
    const [billingSearching, setBillingSearching] = useState(false);
    
    const [datePreset, setDatePreset] = useState('all');

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

    const fetchStats = async (preset) => {
        setLoading(true);
        try {
            let queryStart = '';
            let queryEnd = '';
            if (preset !== 'all') {
                const now = new Date();
                const endD = new Date(now);
                const startD = new Date(now);
                if (preset === 'today') { startD.setHours(0,0,0,0); endD.setHours(23,59,59,999); }
                else if (preset === '30') { startD.setDate(startD.getDate() - 30); }
                else if (preset === '60') { startD.setDate(startD.getDate() - 60); }
                else if (preset === '90') { startD.setDate(startD.getDate() - 90); }
                queryStart = startD.toISOString();
                queryEnd = endD.toISOString();
            }
            const res = await financeAPI.getDashboardStats(queryStart, queryEnd);
            if (res.success) setStats(res.data);
        } catch (err) { Alert.alert('Error', 'Failed to fetch financial stats'); }
        finally { setLoading(false); }
    };

    const handleBillingSearch = async () => {
        if (!billingSearch.trim()) return;
        setBillingSearching(true);
        try {
            const res = await billingAPI.getPatientBills(billingSearch.trim());
            if (res.success) {
                // Navigate to billing profile (which we will create next)
                navigation.navigate('PatientBillingProfile', { q: billingSearch.trim() });
            }
        } catch (err) { Alert.alert('Error', err.response?.data?.message || 'Patient not found'); }
        finally { setBillingSearching(false); }
    };

    const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amt || 0);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Finance & Accounting</Text>
                <Text style={styles.subtitle}>Track revenues, costs, and profits</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>🧾 Patient Billing Search</Text>
                <View style={styles.searchRow}>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Search Phone/MRN..." 
                        value={billingSearch} 
                        onChangeText={setBillingSearch} 
                    />
                    <TouchableOpacity style={styles.btnPrimary} onPress={handleBillingSearch} disabled={billingSearching}>
                        <Text style={styles.btnText}>{billingSearching ? '...' : 'Search'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>📅 Timeframe</Text>
                <View style={styles.filterRow}>
                    {['all', 'today', '30', '60'].map(p => (
                        <TouchableOpacity key={p} style={[styles.filterBtn, datePreset === p && styles.filterBtnActive]} onPress={() => { setDatePreset(p); fetchStats(p); }}>
                            <Text style={datePreset === p ? styles.filterBtnTextActive : styles.filterBtnText}>{p === 'all' ? 'All' : p === 'today' ? 'Today' : `${p} Days`}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} /> : stats && (
                <>
                    <Text style={styles.sectionTitle}>📊 Overall Financials</Text>
                    <View style={styles.grid}>
                        <View style={[styles.statBox, { borderLeftColor: '#22c55e' }]}>
                            <Text style={styles.statLabel}>Total Revenue</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#ef4444' }]}>
                            <Text style={styles.statLabel}>Total Costs</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.medicines?.cost)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#8b5cf6' }]}>
                            <Text style={styles.statLabel}>Net Profit</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.totalProfit)}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>🏥 Department Breakdown</Text>
                    <View style={styles.grid}>
                        <View style={[styles.statBox, { borderLeftColor: '#0ea5e9' }]}>
                            <Text style={styles.statLabel}>Consultations</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.consultations?.revenue)}</Text>
                            <Text style={styles.statSub}>{stats.consultations?.count} Paid</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#ec4899' }]}>
                            <Text style={styles.statLabel}>Lab Tests</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.labTests?.revenue)}</Text>
                            <Text style={styles.statSub}>{stats.labTests?.count} Paid</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#f59e0b' }]}>
                            <Text style={styles.statLabel}>Pharmacy Gross</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.medicines?.revenue)}</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftColor: '#10b981' }]}>
                            <Text style={styles.statLabel}>Pharmacy Net</Text>
                            <Text style={styles.statValue}>{formatCurrency(stats.medicines?.profit)}</Text>
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    subtitle: { fontSize: 14, color: '#64748b' },
    card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1e293b' },
    searchRow: { flexDirection: 'row', gap: 10 },
    input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10 },
    btnPrimary: { backgroundColor: '#3b82f6', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 },
    btnText: { color: 'white', fontWeight: 'bold' },
    filterRow: { flexDirection: 'row', gap: 10 },
    filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: '#f1f5f9' },
    filterBtnActive: { backgroundColor: '#3b82f6' },
    filterBtnText: { color: '#475569', fontWeight: '600', fontSize: 12 },
    filterBtnTextActive: { color: 'white', fontWeight: 'bold', fontSize: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 12, color: '#334155' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statBox: { backgroundColor: 'white', width: '48%', padding: 16, borderRadius: 12, elevation: 1, borderLeftWidth: 4, marginBottom: 10 },
    statLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
    statValue: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
    statSub: { fontSize: 10, color: '#94a3b8', marginTop: 4 }
});

export default AccountantDashboard;
