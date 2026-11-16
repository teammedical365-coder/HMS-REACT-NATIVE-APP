import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { freeOpdAPI } from '../../utils/api';

const MoneyTracker = () => {
    const [summary, setSummary] = useState({
        daily: { total: 0, cash: 0, upi: 0, card: 0 },
        weekly: { total: 0, cash: 0, upi: 0, card: 0 },
        monthly: { total: 0, cash: 0, upi: 0, card: 0 },
        total: { total: 0, cash: 0, upi: 0, card: 0 }
    });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modeFilter, setModeFilter] = useState('ALL');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [sumRes, txRes] = await Promise.all([
                freeOpdAPI.getMoneySummary().catch(() => ({ summary: null })),
                freeOpdAPI.getTransactions().catch(() => ({ transactions: [] }))
            ]);
            if (sumRes?.summary) setSummary(sumRes.summary);
            setTransactions(txRes?.transactions || txRes?.data || []);
        } catch (err) {
            console.error('Error fetching money tracker:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredTransactions = transactions.filter(t => {
        if (modeFilter === 'ALL') return true;
        return (t.paymentMode || t.mode || '').toLowerCase() === modeFilter.toLowerCase();
    });

    const formatCurrency = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

    const renderItem = ({ item }) => {
        const mode = item.paymentMode || item.mode || 'Cash';
        const isCash = mode.toLowerCase() === 'cash';
        const isUpi = mode.toLowerCase() === 'upi';

        return (
            <View style={styles.txCard}>
                <View style={styles.txLeft}>
                    <View style={[styles.modeIconBox, isCash ? styles.cashBox : isUpi ? styles.upiBox : styles.cardBox]}>
                        <Feather
                            name={isCash ? 'dollar-sign' : isUpi ? 'smartphone' : 'credit-card'}
                            size={16}
                            color={isCash ? '#10b981' : isUpi ? '#0d9488' : '#3b82f6'}
                        />
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={styles.txPtName}>{item.patientName || item.patientId?.name || 'Patient'}</Text>
                        <Text style={styles.txMeta}>
                            {new Date(item.date || item.createdAt || Date.now()).toLocaleDateString('en-IN')} • {item.description || item.visitType || 'OPD Fee'}
                        </Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.txAmount}>+{formatCurrency(item.amount || item.fee)}</Text>
                    <View style={styles.modeBadge}>
                        <Text style={styles.modeBadgeText}>{mode}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>OPD Money Tracker</Text>
                    <Text style={styles.subtitle}>Direct Consultation Fees &amp; Collections</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
                    <Feather name="refresh-cw" size={16} color="#0d9488" />
                </TouchableOpacity>
            </View>

            {/* Metrics Row */}
            <View style={styles.metricsContainer}>
                <View style={styles.metricCardPrimary}>
                    <Text style={styles.metricLabelWhite}>Today's Collection</Text>
                    <Text style={styles.metricValueWhite}>{formatCurrency(summary.daily?.total)}</Text>
                    <View style={styles.splitRow}>
                        <Text style={styles.splitText}>Cash: {formatCurrency(summary.daily?.cash)}</Text>
                        <Text style={styles.splitText}>UPI: {formatCurrency(summary.daily?.upi)}</Text>
                    </View>
                </View>

                <View style={styles.miniMetricsRow}>
                    <View style={styles.miniMetric}>
                        <Text style={styles.miniLabel}>This Week</Text>
                        <Text style={styles.miniValue}>{formatCurrency(summary.weekly?.total)}</Text>
                    </View>
                    <View style={styles.miniMetric}>
                        <Text style={styles.miniLabel}>This Month</Text>
                        <Text style={styles.miniValue}>{formatCurrency(summary.monthly?.total)}</Text>
                    </View>
                    <View style={styles.miniMetric}>
                        <Text style={styles.miniLabel}>Total Lifetime</Text>
                        <Text style={styles.miniValue}>{formatCurrency(summary.total?.total)}</Text>
                    </View>
                </View>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterRow}>
                <Text style={styles.filterHeading}>Filter by Mode:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['ALL', 'Cash', 'UPI', 'Card'].map(m => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.filterChip, modeFilter === m && styles.filterChipActive]}
                            onPress={() => setModeFilter(m)}
                        >
                            <Text style={[styles.filterChipText, modeFilter === m && styles.filterChipTextActive]}>
                                {m}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Loading fee transactions...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredTransactions}
                    keyExtractor={item => item._id || String(Math.random())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="dollar-sign" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No fee transactions recorded yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    refreshBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    metricsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    metricCardPrimary: {
        backgroundColor: '#0d9488',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
    },
    metricLabelWhite: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ccfbf1',
    },
    metricValueWhite: {
        fontSize: 26,
        fontWeight: '900',
        color: '#ffffff',
        marginVertical: 4,
    },
    splitRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    splitText: {
        fontSize: 11,
        color: '#e0f2fe',
        fontWeight: '500',
    },
    miniMetricsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    miniMetric: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    miniLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#64748b',
    },
    miniValue: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8,
        gap: 8,
    },
    filterHeading: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 6,
    },
    filterChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    filterChipTextActive: {
        color: '#ffffff',
    },
    listContent: {
        padding: 16,
        paddingBottom: 30,
    },
    centerLoading: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 10,
    },
    txCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 8,
    },
    txLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modeIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cashBox: { backgroundColor: '#d1fae5' },
    upiBox: { backgroundColor: '#ccfbf1' },
    cardBox: { backgroundColor: '#dbeafe' },
    txPtName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    txMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    txAmount: {
        fontSize: 14,
        fontWeight: '800',
        color: '#10b981',
    },
    modeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        marginTop: 3,
    },
    modeBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#475569',
    },
});

export default MoneyTracker;

