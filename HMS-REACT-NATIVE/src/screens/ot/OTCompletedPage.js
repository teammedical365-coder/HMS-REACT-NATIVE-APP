import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, FlatList, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { SurgeryDetailsModal } from '../../components/ot/OTModals';
import DatePickerInput from '../../components/common/DatePickerInput';
import useOTResponsive from './otResponsive';

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
    const {
        width,
        isSmallPhone,
        isPhone,
        isTablet,
        isLargeTablet,
        pagePadding,
        cardPadding,
        gap,
    } = useOTResponsive();

    const [completedSurgeries, setCompletedSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);

    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('ALL');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchCompletedData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await otAPI.getScheduledSurgeries();
            if (res.success) {
                const list = (res.surgeries || []).filter(s => s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED');
                setCompletedSurgeries(list);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch completed error:', err);
            setError(err.response?.data?.message || 'Unable to load completed surgeries. Please check connection and retry.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompletedData();

        if (!socket) return;
        const handleUpdate = () => fetchCompletedData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);
        socket.on('surgery_plan_created', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
            socket.off('surgery_plan_created', handleUpdate);
        };
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

    const renderMobileCard = (s) => {
        const stInfo = getStatusStyle(s.status);
        const surgeryDateStr = new Date(s.surgeryDate || s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const surgeonName = (s.surgeonId?.name || '').replace(/^Dr\.?\s*/i, '');
        const isBilled = s.billingStatus === 'BILLED';

        return (
            <View key={s._id} style={[styles.mobileCard, { padding: cardPadding }]}>
                <View style={styles.mobileCardHeader}>
                    <View style={styles.mobileDateGroup}>
                        <Text style={styles.mobileDateText}>📅 {surgeryDateStr}</Text>
                        <Text style={styles.mobileRoomText} numberOfLines={2}>🚪 {s.otRoomId?.name || 'OT Suite'}</Text>
                    </View>
                    <View style={[styles.pillBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                        <Text style={[styles.pillBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                    </View>
                </View>

                <Text style={styles.mobileProcedureTitle} numberOfLines={3}>{s.surgery}</Text>

                <View style={styles.mobilePatientBox}>
                    <Text style={styles.mobilePatientName}>👤 <Text style={styles.boldText}>{s.patientId?.name || '-'}</Text></Text>
                    <Text style={styles.mobilePatientSub}>MRN: <Text style={styles.boldText}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text></Text>
                </View>

                <View style={styles.mobileMetaRow}>
                    <Text style={styles.mobileMetaText} numberOfLines={2}>👨‍⚕️ Surgeon: <Text style={styles.boldText}>Dr. {surgeonName || 'Unassigned'}</Text></Text>
                    <View style={[styles.pillBadge, { backgroundColor: isBilled ? '#dcfce7' : '#f1f5f9', borderColor: isBilled ? '#bbf7d0' : '#e2e8f0' }]}>
                        <Text style={[styles.pillBadgeText, { color: isBilled ? '#166534' : '#475569' }]}>
                            {s.billingStatus || 'PENDING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.mobileActionRow}>
                    <TouchableOpacity
                        style={styles.mobileViewBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        onPress={() => {
                            setSelectedSurgery(s);
                            setShowDetailsModal(true);
                        }}
                    >
                        <Feather name="eye" size={14} color="#334155" style={{ marginRight: 6 }} />
                        <Text style={styles.mobileViewBtnText}>View Details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderHeader = () => (
        <>
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
            <View style={[styles.filterBar, !isTablet && { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
                <View style={[styles.filterLeft, isPhone && { width: '100%' }]}>
                    <View style={[styles.filterScroll, isPhone && styles.filterWrap]}>
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
                    </View>

                    {dateFilter === 'CUSTOM' && (
                        <View style={[styles.customDateContainer, isSmallPhone && { flexDirection: 'column', alignItems: 'stretch' }]}>
                            <View style={{ minWidth: isSmallPhone ? '100%' : 130 }}>
                                <DatePickerInput
                                    value={customFrom}
                                    onChange={setCustomFrom}
                                    placeholder="From date"
                                />
                            </View>
                            <Text style={styles.toText}>to</Text>
                            <View style={{ minWidth: isSmallPhone ? '100%' : 130 }}>
                                <DatePickerInput
                                    value={customTo}
                                    onChange={setCustomTo}
                                    placeholder="To date"
                                />
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ marginTop: isTablet ? 0 : 8 }}>
                    <Text style={styles.resultsCount}>Showing <Text style={{fontWeight: 'bold'}}>{filteredSurgeries.length}</Text> completed surgeries</Text>
                </View>
            </View>
        </>
    );

    const renderEmptyOrError = () => {
        if (error) {
            return (
                <View style={styles.errorState}>
                    <Feather name="alert-circle" size={44} color="#ef4444" style={{ marginBottom: 12 }} />
                    <Text style={styles.errorTitle}>Unable to Load Data</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchCompletedData}
                        activeOpacity={0.7}
                    >
                        <Feather name="refresh-cw" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
                <Text style={styles.emptyTitle}>No Completed Surgeries Found</Text>
                <Text style={styles.emptyText}>Surgeries finished and discharged from OT recovery will appear in this historical archive.</Text>
            </View>
        );
    };

    if (!isTablet) {
        return (
            <View style={styles.container}>
                <FlatList
                    style={styles.container}
                    contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}
                    data={error ? [] : filteredSurgeries}
                    keyExtractor={s => s._id}
                    renderItem={({ item }) => renderMobileCard(item)}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    ListHeaderComponent={renderHeader}
                    ListEmptyComponent={renderEmptyOrError}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS !== 'web'}
                />
                <SurgeryDetailsModal
                    open={showDetailsModal}
                    surgery={selectedSurgery}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedSurgery(null);
                    }}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}>
                {renderHeader()}

                {/* Completed Surgeries Table vs Empty/Error */}
                {error || filteredSurgeries.length === 0 ? (
                    renderEmptyOrError()
                ) : (
                    /* Tablet & Desktop: Multi-column Table */
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
                                                <TouchableOpacity
                                                    style={styles.viewBtn}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    onPress={() => {
                                                        setSelectedSurgery(s);
                                                        setShowDetailsModal(true);
                                                    }}
                                                >
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

            <SurgeryDetailsModal
                open={showDetailsModal}
                surgery={selectedSurgery}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedSurgery(null);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 16, paddingBottom: 40 },
    filterBar: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    filterLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    filterScroll: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterWrap: { flexWrap: 'wrap' },
    filterBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
    filterBtnActive: { backgroundColor: '#16a34a' },
    filterBtnInactive: { backgroundColor: '#f1f5f9' },
    filterBtnText: { fontSize: 13, fontWeight: '700' },
    filterBtnTextActive: { color: '#ffffff' },
    filterBtnTextInactive: { color: '#475569' },
    customDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4, flexWrap: 'wrap' },
    toText: { fontSize: 13, color: '#64748b' },
    resultsCount: { fontSize: 13, color: '#64748b' },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 60, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    tableWrapper: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    tableContainer: { minWidth: 960 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerCell: { paddingVertical: 14, paddingHorizontal: 16, fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    cell: { paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center' },
    cellText: { fontSize: 13, color: '#1e293b' },
    cellTextBold: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    cellTextSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    pillBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
    pillBadgeText: { fontSize: 10, fontWeight: '800' },
    viewBtn: { paddingVertical: 6, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6 },
    viewBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    // Mobile Card Styles
    mobileCardList: { flexDirection: 'column', gap: 12 },
    mobileCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 5, elevation: 1, gap: 10 },
    mobileCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    mobileDateGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 },
    mobileDateText: { fontSize: 12, fontWeight: '700', color: '#0f172a', backgroundColor: '#f1f5f9', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
    mobileRoomText: { fontSize: 11, color: '#64748b' },
    mobileProcedureTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    mobilePatientBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    mobilePatientName: { fontSize: 13, color: '#0f172a' },
    mobilePatientSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    mobileMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    mobileMetaText: { fontSize: 13, color: '#334155', flex: 1, minWidth: 0, flexShrink: 1 },
    mobileActionRow: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    mobileViewBtn: { width: '100%', flexDirection: 'row', paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 },
    mobileViewBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    boldText: { fontWeight: 'bold' },
    errorState: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#fee2e2',
        padding: 40,
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

export default OTCompletedPage;
