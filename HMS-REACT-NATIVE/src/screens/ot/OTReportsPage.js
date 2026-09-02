import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { otAPI } from '../../utils/api';
import OTHeader from './OTHeader';

const { width } = Dimensions.get('window');

const OTReportsPage = () => {
    const navigation = useNavigation();
    const [allSurgeries, setAllSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [dateRange, setDateRange] = useState('THIS_MONTH');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchReportsData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await otAPI.getScheduledSurgeries();
            if (res.success) {
                setAllSurgeries(res.surgeries || []);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch reports error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReportsData();
    }, [fetchReportsData]);

    const filteredSurgeries = allSurgeries.filter(s => {
        const sDate = s.surgeryDate ? new Date(s.surgeryDate) : new Date(s.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateRange === 'TODAY') {
            const sDay = new Date(sDate);
            sDay.setHours(0, 0, 0, 0);
            return sDay.getTime() === today.getTime();
        }

        if (dateRange === 'THIS_WEEK') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return sDate >= weekAgo;
        }

        if (dateRange === 'THIS_MONTH') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return sDate >= monthAgo;
        }

        if (dateRange === 'CUSTOM' && customFrom && customTo) {
            const from = new Date(customFrom);
            const to = new Date(customTo);
            to.setHours(23, 59, 59, 999);
            return sDate >= from && sDate <= to;
        }

        return true;
    });

    const totalCount = filteredSurgeries.length;
    const completedCount = filteredSurgeries.filter(s => s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED').length;
    const cancelledCount = filteredSurgeries.filter(s => s.status === 'CANCELLED').length;
    const inProgressCount = filteredSurgeries.filter(s => s.status === 'IN_OT').length;
    
    const procedureMap = {};
    filteredSurgeries.forEach(s => {
        const proc = s.surgery || 'Other Procedure';
        procedureMap[proc] = (procedureMap[proc] || 0) + 1;
    });
    const procedureList = Object.entries(procedureMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    const surgeonMap = {};
    filteredSurgeries.forEach(s => {
        const sName = (s.surgeonId?.name || s.doctorId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
        surgeonMap[sName] = (surgeonMap[sName] || 0) + 1;
    });
    const surgeonList = Object.entries(surgeonMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

    const roomMap = {};
    filteredSurgeries.forEach(s => {
        const rName = s.otRoomId?.name || 'Unassigned Room';
        roomMap[rName] = (roomMap[rName] || 0) + 1;
    });
    const roomList = Object.entries(roomMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OTHeader
                title="OT Reports & Operational Analytics"
                subtitle="Departmental throughput, room utilization, surgical volume, and performance indicators."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchReportsData}
            />

            {/* Date Range Selector */}
            <View style={[styles.filterBar, !isLargeScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {[
                        { id: 'TODAY', label: 'Today' },
                        { id: 'THIS_WEEK', label: 'This Week' },
                        { id: 'THIS_MONTH', label: 'This Month' },
                        { id: 'ALL', label: 'All Time' },
                        { id: 'CUSTOM', label: 'Custom Range' }
                    ].map(f => (
                        <TouchableOpacity
                            key={f.id}
                            onPress={() => setDateRange(f.id)}
                            style={[
                                styles.filterBtn,
                                dateRange === f.id ? styles.filterBtnActive : styles.filterBtnInactive
                            ]}
                        >
                            <Text style={[
                                styles.filterBtnText,
                                dateRange === f.id ? styles.filterBtnTextActive : styles.filterBtnTextInactive
                            ]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {dateRange === 'CUSTOM' && (
                    <View style={styles.customDateContainer}>
                        <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" value={customFrom} onChangeText={setCustomFrom} />
                        <Text style={styles.toText}>to</Text>
                        <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" value={customTo} onChangeText={setCustomTo} />
                    </View>
                )}

                <View style={{ marginTop: isLargeScreen ? 0 : 10 }}>
                    <Text style={styles.resultsCount}>Period Total: <Text style={{fontWeight: 'bold'}}>{totalCount}</Text> procedures</Text>
                </View>
            </View>

            {/* KPI Metric Summary Cards */}
            <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Total Surgeries</Text>
                    <Text style={styles.kpiValue}>{totalCount}</Text>
                    <Text style={styles.kpiSub}>Scheduled or completed</Text>
                </View>
                <View style={[styles.kpiCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Text style={[styles.kpiLabel, { color: '#166534' }]}>Completed Surgeries</Text>
                    <Text style={[styles.kpiValue, { color: '#15803d' }]}>{completedCount}</Text>
                    <Text style={[styles.kpiSub, { color: '#166534', fontWeight: 'bold' }]}>Completion Rate: {completionRate}%</Text>
                </View>
                <View style={[styles.kpiCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                    <Text style={[styles.kpiLabel, { color: '#1e40af' }]}>Currently In-OT</Text>
                    <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{inProgressCount}</Text>
                    <Text style={[styles.kpiSub, { color: '#1e40af' }]}>Active procedures</Text>
                </View>
                <View style={[styles.kpiCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Text style={[styles.kpiLabel, { color: '#991b1b' }]}>Cancelled Surgeries</Text>
                    <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{cancelledCount}</Text>
                    <Text style={[styles.kpiSub, { color: '#991b1b' }]}>Dropped or aborted</Text>
                </View>
            </View>

            <View style={[styles.twoColGrid, !isLargeScreen && { flexDirection: 'column' }]}>
                {/* Procedures Breakdown */}
                <View style={styles.breakdownBox}>
                    <Text style={styles.breakdownTitle}>Top 5 Procedures</Text>
                    {procedureList.length === 0 ? (
                        <Text style={styles.noDataText}>No data available</Text>
                    ) : (
                        procedureList.map((item, idx) => (
                            <View key={idx} style={styles.breakdownRow}>
                                <Text style={styles.breakdownName}>{item.name}</Text>
                                <Text style={styles.breakdownCount}>{item.count}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Surgeons Breakdown */}
                <View style={styles.breakdownBox}>
                    <Text style={styles.breakdownTitle}>Top 5 Surgeons by Volume</Text>
                    {surgeonList.length === 0 ? (
                        <Text style={styles.noDataText}>No data available</Text>
                    ) : (
                        surgeonList.map((item, idx) => (
                            <View key={idx} style={styles.breakdownRow}>
                                <Text style={styles.breakdownName}>Dr. {item.name}</Text>
                                <Text style={styles.breakdownCount}>{item.count}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* Room Utilization */}
                <View style={styles.breakdownBox}>
                    <Text style={styles.breakdownTitle}>Room Utilization</Text>
                    {roomList.length === 0 ? (
                        <Text style={styles.noDataText}>No data available</Text>
                    ) : (
                        roomList.map((item, idx) => (
                            <View key={idx} style={styles.breakdownRow}>
                                <Text style={styles.breakdownName}>{item.name}</Text>
                                <Text style={styles.breakdownCount}>{item.count}</Text>
                            </View>
                        ))
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 16 },
    filterBar: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    filterScroll: { flexDirection: 'row', gap: 8 },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    filterBtnActive: { backgroundColor: '#0f172a' },
    filterBtnInactive: { backgroundColor: '#f1f5f9' },
    filterBtnText: { fontSize: 13, fontWeight: '700' },
    filterBtnTextActive: { color: '#ffffff' },
    filterBtnTextInactive: { color: '#475569' },
    customDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 10, marginTop: 10 },
    dateInput: { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, fontSize: 13, backgroundColor: '#fff', minWidth: 100 },
    toText: { fontSize: 13, color: '#64748b' },
    resultsCount: { fontSize: 13, color: '#64748b' },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
    kpiCard: { flex: 1, minWidth: 200, backgroundColor: '#fff', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    kpiLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    kpiValue: { fontSize: 32, fontWeight: '900', color: '#0f172a', marginVertical: 6 },
    kpiSub: { fontSize: 12, color: '#64748b' },
    twoColGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    breakdownBox: { flex: 1, minWidth: 300, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 20 },
    breakdownTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    breakdownName: { fontSize: 14, color: '#334155', fontWeight: '600', flex: 1 },
    breakdownCount: { fontSize: 14, fontWeight: '800', color: '#0f172a', backgroundColor: '#f1f5f9', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12 },
    noDataText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 20 }
});

export default OTReportsPage;
