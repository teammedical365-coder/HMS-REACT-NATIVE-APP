import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { otAPI } from '../../utils/api';
import OTHeader from './OTHeader';

const { width } = Dimensions.get('window');

const getStatusStyle = (status) => {
    switch(status) {
        case 'PLANNED': return { label: 'PLANNED', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
        case 'SCHEDULED': return { label: 'SCHEDULED', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
        case 'ADMITTED': return { label: 'ADMITTED', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
        case 'PRE_OP': return { label: 'PRE-OP', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
        case 'READY_FOR_OT': return { label: 'READY FOR OT', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
        case 'IN_OT': return { label: '🔴 IN OT', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
        case 'SURGERY_COMPLETED': return { label: 'SURGERY DONE', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' };
        case 'POST_OP': return { label: 'POST-OP', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
        case 'COMPLETED': return { label: '✓ COMPLETED', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
        case 'CANCELLED': return { label: 'CANCELLED', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
        default: return { label: status, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
};

const OTCompletedPage = () => {
    const navigation = useNavigation();
    const [completedSurgeries, setCompletedSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('ALL');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchCompletedData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await otAPI.getScheduledSurgeries();
            if (res.success) {
                const list = (res.surgeries || []).filter(s => s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED');
                setCompletedSurgeries(list);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch completed error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompletedData();
    }, [fetchCompletedData]);

    const filteredSurgeries = completedSurgeries.filter(s => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const pName = (s.patientId?.name || '').toLowerCase();
            const pMrn = (s.patientId?.mrn || s.patientId?.patientId || '').toLowerCase();
            const proc = (s.surgery || '').toLowerCase();
            const sName = (s.surgeonId?.name || '').toLowerCase();
            const rName = (s.otRoomId?.name || '').toLowerCase();
            if (!pName.includes(q) && !pMrn.includes(q) && !proc.includes(q) && !sName.includes(q) && !rName.includes(q)) {
                return false;
            }
        }

        const sDate = s.surgeryDate ? new Date(s.surgeryDate) : new Date(s.updatedAt || s.createdAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'TODAY') {
            const sDay = new Date(sDate);
            sDay.setHours(0, 0, 0, 0);
            return sDay.getTime() === today.getTime();
        }

        if (dateFilter === 'YESTERDAY') {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const sDay = new Date(sDate);
            sDay.setHours(0, 0, 0, 0);
            return sDay.getTime() === yesterday.getTime();
        }

        if (dateFilter === 'THIS_WEEK') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return sDate >= weekAgo;
        }

        if (dateFilter === 'THIS_MONTH') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return sDate >= monthAgo;
        }

        if (dateFilter === 'CUSTOM' && customFrom && customTo) {
            const from = new Date(customFrom);
            const to = new Date(customTo);
            to.setHours(23, 59, 59, 999);
            return sDate >= from && sDate <= to;
        }

        return true;
    });

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OTHeader
                title="Completed Surgeries & Historical Archive"
                subtitle="Historical surgical logbook, procedure outcomes, completion timestamps, and operational audit trail."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchCompletedData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ completed: completedSurgeries.length }}
            />

            {/* Filter Bar */}
            <View style={[styles.filterBar, !isLargeScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.filterLeft}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {[
                            { id: 'ALL', label: `All Time (${completedSurgeries.length})` },
                            { id: 'TODAY', label: 'Today' },
                            { id: 'YESTERDAY', label: 'Yesterday' },
                            { id: 'THIS_WEEK', label: 'This Week' },
                            { id: 'THIS_MONTH', label: 'This Month' },
                            { id: 'CUSTOM', label: 'Custom Range' }
                        ].map(f => (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => setDateFilter(f.id)}
                                style={[
                                    styles.filterBtn,
                                    dateFilter === f.id ? styles.filterBtnActive : styles.filterBtnInactive
                                ]}
                            >
                                <Text style={[
                                    styles.filterBtnText,
                                    dateFilter === f.id ? styles.filterBtnTextActive : styles.filterBtnTextInactive
                                ]}>{f.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {dateFilter === 'CUSTOM' && (
                        <View style={styles.customDateContainer}>
                            <TextInput
                                style={styles.dateInput}
                                placeholder="YYYY-MM-DD"
                                value={customFrom}
                                onChangeText={setCustomFrom}
                            />
                            <Text style={styles.toText}>to</Text>
                            <TextInput
                                style={styles.dateInput}
                                placeholder="YYYY-MM-DD"
                                value={customTo}
                                onChangeText={setCustomTo}
                            />
                        </View>
                    )}
                </View>

                <View style={{ marginTop: isLargeScreen ? 0 : 10 }}>
                    <Text style={styles.resultsCount}>Showing <Text style={{fontWeight: 'bold'}}>{filteredSurgeries.length}</Text> completed surgeries</Text>
                </View>
            </View>

            {/* Completed Surgeries Table */}
            {filteredSurgeries.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                    <Text style={styles.emptyTitle}>No Completed Surgeries Found</Text>
                    <Text style={styles.emptyText}>Surgeries finished and discharged from OT recovery will appear in this historical archive.</Text>
                </View>
            ) : (
                <View style={styles.tableWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={styles.tableContainer}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 120 }]}>Date</Text>
                                <Text style={[styles.headerCell, { width: 180 }]}>Patient & MRN</Text>
                                <Text style={[styles.headerCell, { width: 220 }]}>Procedure</Text>
                                <Text style={[styles.headerCell, { width: 160 }]}>Surgical Team</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>OT Suite</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Billing Status</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>Outcome</Text>
                                <Text style={[styles.headerCell, { width: 100, textAlign: 'right' }]}>Actions</Text>
                            </View>
                            {filteredSurgeries.map((s, idx) => {
                                const stInfo = getStatusStyle(s.status);
                                const isEven = idx % 2 === 0;
                                return (
                                    <View key={s._id} style={[styles.tableRow, { backgroundColor: isEven ? '#fff' : '#f8fafc' }]}>
                                        <View style={[styles.cell, { width: 120 }]}>
                                            <Text style={styles.cellTextBold}>{new Date(s.surgeryDate || s.createdAt).toLocaleDateString()}</Text>
                                        </View>
                                        <View style={[styles.cell, { width: 180 }]}>
                                            <Text style={styles.cellTextBold}>{s.patientId?.name || '-'}</Text>
                                            <Text style={styles.cellTextSub}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text>
                                        </View>
                                        <View style={[styles.cell, { width: 220 }]}>
                                            <Text style={styles.cellText}>{s.surgery}</Text>
                                        </View>
                                        <View style={[styles.cell, { width: 160 }]}>
                                            <Text style={styles.cellText}>Dr. {(s.surgeonId?.name || '').replace(/^Dr\.?\s*/i, '')}</Text>
                                        </View>
                                        <View style={[styles.cell, { width: 120 }]}>
                                            <Text style={styles.cellText}>{s.otRoomId?.name || '-'}</Text>
                                        </View>
                                        <View style={[styles.cell, { width: 120 }]}>
                                            <View style={[styles.pillBadge, { backgroundColor: s.billingStatus === 'BILLED' ? '#dcfce7' : '#f1f5f9', borderColor: s.billingStatus === 'BILLED' ? '#bbf7d0' : '#e2e8f0' }]}>
                                                <Text style={[styles.pillBadgeText, { color: s.billingStatus === 'BILLED' ? '#166534' : '#475569' }]}>
                                                    {s.billingStatus || 'PENDING'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.cell, { width: 140 }]}>
                                            <View style={[styles.pillBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                                                <Text style={[styles.pillBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.cell, { width: 100, alignItems: 'flex-end', justifyContent: 'center' }]}>
                                            <TouchableOpacity style={styles.viewBtn}>
                                                <Text style={styles.viewBtnText}>View</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 16 },
    filterBar: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    filterLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    filterScroll: { flexDirection: 'row', gap: 8 },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
    filterBtnActive: { backgroundColor: '#16a34a' },
    filterBtnInactive: { backgroundColor: '#f1f5f9' },
    filterBtnText: { fontSize: 13, fontWeight: '700' },
    filterBtnTextActive: { color: '#ffffff' },
    filterBtnTextInactive: { color: '#475569' },
    customDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
    dateInput: { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, fontSize: 13, minWidth: 100, backgroundColor: '#fff' },
    toText: { fontSize: 13, color: '#64748b' },
    resultsCount: { fontSize: 13, color: '#64748b' },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 60, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    tableWrapper: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    tableContainer: { minWidth: 1000 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerCell: { paddingVertical: 14, paddingHorizontal: 18, fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    cell: { paddingVertical: 14, paddingHorizontal: 18, justifyContent: 'center' },
    cellText: { fontSize: 13, color: '#1e293b' },
    cellTextBold: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    cellTextSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    pillBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
    pillBadgeText: { fontSize: 10, fontWeight: '800' },
    viewBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6 },
    viewBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' }
});

export default OTCompletedPage;
