import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import DatePickerInput from '../../components/common/DatePickerInput';
import { useOTResponsive } from './otResponsive';

const OTReportsPage = () => {
    const navigation = useNavigation();
    const responsive = useOTResponsive();
    const { isSmallPhone, isPhone, isTablet, isLargeTablet, pagePadding, cardPadding } = responsive;

    const [allSurgeries, setAllSurgeries] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);

    const [dateRange, setDateRange] = useState('THIS_MONTH');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchReportsData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [schedRes, roomsRes] = await Promise.all([
                otAPI.getScheduledSurgeries(),
                otAPI.getRooms()
            ]);

            if (schedRes.surgeries) setAllSurgeries(schedRes.surgeries || []);
            if (roomsRes.rooms) setRooms(roomsRes.rooms || []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch reports error:', err);
            setError(err.response?.data?.message || 'Unable to load OT reports data. Please check connection and retry.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReportsData();

        if (!socket) return;
        const handleUpdate = () => fetchReportsData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);
        socket.on('surgery_plan_created', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
            socket.off('surgery_plan_created', handleUpdate);
        };
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
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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

    const kpiCardWidth = isSmallPhone ? '100%' : isPhone ? '48%' : isLargeTablet ? '23.5%' : '48%';
    const breakdownBoxWidth = isLargeTablet ? '31.5%' : isTablet ? '48.5%' : '100%';

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}>
            <OTHeader
                title="OT Reports & Operational Analytics"
                subtitle="Departmental throughput, room utilization, surgical volume, and performance indicators."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchReportsData}
            />

            {/* Date Range Selector */}
            <View style={[styles.filterBar, isPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={[styles.filterScroll, isPhone && styles.filterWrap]}>
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
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.filterBtnText,
                                dateRange === f.id ? styles.filterBtnTextActive : styles.filterBtnTextInactive
                            ]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {dateRange === 'CUSTOM' && (
                    <View style={[styles.customDateContainer, isPhone && { flexDirection: 'column', alignItems: 'stretch', width: '100%', marginLeft: 0 }]}>
                        <View style={{ flex: isPhone ? undefined : 1, minWidth: isPhone ? '100%' : 140 }}>
                            <DatePickerInput placeholder="From date" value={customFrom} onChange={setCustomFrom} />
                        </View>
                        {!isPhone && <Text style={styles.toText}>to</Text>}
                        <View style={{ flex: isPhone ? undefined : 1, minWidth: isPhone ? '100%' : 140, marginTop: isPhone ? 8 : 0 }}>
                            <DatePickerInput placeholder="To date" value={customTo} onChange={setCustomTo} />
                        </View>
                    </View>
                )}

                <View style={{ marginTop: isPhone ? 12 : 0 }}>
                    <Text style={styles.resultsCount}>Period Total: <Text style={{ fontWeight: 'bold' }}>{totalCount}</Text> procedures</Text>
                </View>
            </View>

            {error ? (
                <View style={[styles.errorState, { padding: isSmallPhone ? 20 : 36 }]}>
                    <Feather name="alert-circle" size={isSmallPhone ? 36 : 44} color="#ef4444" style={{ marginBottom: 12 }} />
                    <Text style={styles.errorTitle}>Unable to Load Data</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchReportsData}
                        activeOpacity={0.7}
                    >
                        <Feather name="refresh-cw" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* KPI Metric Summary Cards */}
                    <View style={styles.kpiGrid}>
                        <View style={[styles.kpiCard, { width: kpiCardWidth, padding: cardPadding }]}>
                            <Text style={styles.kpiLabel}>Total Surgeries</Text>
                            <Text style={styles.kpiValue}>{totalCount}</Text>
                            <Text style={styles.kpiSub}>Scheduled or completed</Text>
                        </View>
                        <View style={[styles.kpiCard, { width: kpiCardWidth, padding: cardPadding, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                            <Text style={[styles.kpiLabel, { color: '#166534' }]}>Completed Surgeries</Text>
                            <Text style={[styles.kpiValue, { color: '#15803d' }]}>{completedCount}</Text>
                            <Text style={[styles.kpiSub, { color: '#166534', fontWeight: 'bold' }]}>Completion Rate: {completionRate}%</Text>
                        </View>
                        <View style={[styles.kpiCard, { width: kpiCardWidth, padding: cardPadding, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                            <Text style={[styles.kpiLabel, { color: '#1e40af' }]}>Currently In-OT</Text>
                            <Text style={[styles.kpiValue, { color: '#1d4ed8' }]}>{inProgressCount}</Text>
                            <Text style={[styles.kpiSub, { color: '#1e40af' }]}>Active procedures</Text>
                        </View>
                        <View style={[styles.kpiCard, { width: kpiCardWidth, padding: cardPadding, backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                            <Text style={[styles.kpiLabel, { color: '#991b1b' }]}>Cancelled Surgeries</Text>
                            <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{cancelledCount}</Text>
                            <Text style={[styles.kpiSub, { color: '#991b1b' }]}>Dropped or aborted</Text>
                        </View>
                    </View>

                    {/* Breakdown Analytics */}
                    <View style={styles.twoColGrid}>
                        {/* Procedures Breakdown */}
                        <View style={[styles.breakdownBox, { width: breakdownBoxWidth, padding: cardPadding }]}>
                            <Text style={styles.breakdownTitle}>Top 5 Procedures</Text>
                            {procedureList.length === 0 ? (
                                <Text style={styles.noDataText}>No data available</Text>
                            ) : (
                                procedureList.map((item, idx) => (
                                    <View key={idx} style={styles.breakdownRow}>
                                        <Text style={styles.breakdownName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.breakdownCount}>{item.count}</Text>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Surgeons Breakdown */}
                        <View style={[styles.breakdownBox, { width: breakdownBoxWidth, padding: cardPadding }]}>
                            <Text style={styles.breakdownTitle}>Top 5 Surgeons by Volume</Text>
                            {surgeonList.length === 0 ? (
                                <Text style={styles.noDataText}>No data available</Text>
                            ) : (
                                surgeonList.map((item, idx) => (
                                    <View key={idx} style={styles.breakdownRow}>
                                        <Text style={styles.breakdownName} numberOfLines={2}>Dr. {item.name}</Text>
                                        <Text style={styles.breakdownCount}>{item.count}</Text>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Room Utilization */}
                        <View style={[styles.breakdownBox, { width: breakdownBoxWidth, padding: cardPadding }]}>
                            <Text style={styles.breakdownTitle}>Room Utilization</Text>
                            {roomList.length === 0 ? (
                                <Text style={styles.noDataText}>No data available</Text>
                            ) : (
                                roomList.map((item, idx) => (
                                    <View key={idx} style={styles.breakdownRow}>
                                        <Text style={styles.breakdownName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.breakdownCount}>{item.count}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 16, paddingBottom: 40 },
    filterBar: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    filterScroll: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterWrap: { flexWrap: 'wrap' },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
    filterBtnActive: { backgroundColor: '#0f172a' },
    filterBtnInactive: { backgroundColor: '#f1f5f9' },
    filterBtnText: { fontSize: 13, fontWeight: '700' },
    filterBtnTextActive: { color: '#ffffff' },
    filterBtnTextInactive: { color: '#475569' },
    customDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toText: { fontSize: 13, color: '#64748b' },
    resultsCount: { fontSize: 13, color: '#64748b' },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', marginBottom: 24 },
    kpiCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        marginBottom: 4,
    },
    kpiLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    kpiValue: { fontSize: 32, fontWeight: '900', color: '#0f172a', marginVertical: 6 },
    kpiSub: { fontSize: 12, color: '#64748b' },
    twoColGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
    breakdownBox: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        marginBottom: 14,
    },
    breakdownTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    breakdownName: { fontSize: 14, color: '#334155', fontWeight: '600', flex: 1, minWidth: 0, paddingRight: 10 },
    breakdownCount: { fontSize: 14, fontWeight: '800', color: '#0f172a', backgroundColor: '#f1f5f9', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12 },
    noDataText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginVertical: 20 },
    errorState: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#fee2e2',
        padding: 36,
        alignItems: 'center',
        marginVertical: 16,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#b91c1c',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16,
        maxWidth: 400,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minHeight: 44,
    },
    retryBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default OTReportsPage;
