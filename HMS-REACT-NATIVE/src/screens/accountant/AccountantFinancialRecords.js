import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { fetchAccountantFinancialRecordsWithOffline } from '../../services/offline/offlineHospitalAdminService';
import OfflineBanner from '../../components/common/OfflineBanner';
import DatePickerInput from '../../components/common/DatePickerInput';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);

const formatDateTime = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const AccountantFinancialRecords = () => {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ status: '', paymentMode: '', startDate: '', endDate: '', search: '' });
    const [offlineMeta, setOfflineMeta] = useState(null);

    // Modal pickers for mobile
    const [statusModalVisible, setStatusModalVisible] = useState(false);
    const [modeModalVisible, setModeModalVisible] = useState(false);

    const STATUS_OPTIONS = [
        { label: 'All Statuses', value: '' },
        { label: 'Paid', value: 'PAID' },
        { label: 'Pending', value: 'PENDING' },
        { label: 'Partial', value: 'PARTIAL' },
    ];

    const MODE_OPTIONS = [
        { label: 'All Payment Modes', value: '' },
        { label: 'Cash', value: 'Cash' },
        { label: 'UPI', value: 'UPI' },
        { label: 'Card', value: 'Card' },
        { label: 'Bank Transfer', value: 'Bank' },
        { label: 'Split Payment', value: 'Split' },
    ];

    const loadRecords = useCallback(async (page = 1, isManualRefresh = false) => {
        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            const params = { page, limit: 30 };
            if (filters.status) params.status = filters.status;
            if (filters.paymentMode) params.paymentMode = filters.paymentMode;
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.search) params.search = filters.search;

            const res = await fetchAccountantFinancialRecordsWithOffline(params, isManualRefresh);
            if (res && res.data) {
                setRecords(res.data.records || []);
                setPagination(res.data.pagination || { page: 1, limit: 30, total: 0, totalPages: 0 });
                setOfflineMeta(res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.lastSynced,
                    freshnessNote: res.freshnessNote
                } : null);
            }
        } catch (err) {
            console.error('Load financial records error:', err);
            Alert.alert('Error', 'Failed to load financial records');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filters]);

    useEffect(() => {
        loadRecords(1);
    }, [loadRecords]);

    const handleClearFilters = () => {
        setFilters({ status: '', paymentMode: '', startDate: '', endDate: '', search: '' });
    };

    const getStatusBadgeStyle = (status) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'paid':
                return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
            case 'pending':
                return { bg: '#fffbeb', text: '#d97706', border: '#fde68a' };
            case 'partial':
                return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
            case 'failed':
            case 'rejected':
                return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
            case 'refunded':
                return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
            default:
                return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadRecords(pagination.page, true)} colors={['#0ea5e9']} />
            }
        >
            <OfflineBanner offlineMeta={offlineMeta} />

            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Financial Records</Text>
                        <View style={styles.headerTag}>
                            <Text style={styles.headerTagText}>{pagination.total || 0} Transactions</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>All payment transactions & billing records</Text>
                </View>

                <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => loadRecords(pagination.page, true)}
                    disabled={loading || refreshing}
                >
                    <Feather name="refresh-cw" size={14} color="#0284c7" />
                    <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Filters Bar */}
            <View style={styles.card}>
                <View style={styles.searchRow}>
                    <Feather name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patient name / phone / MRN..."
                        placeholderTextColor="#94a3b8"
                        value={filters.search}
                        onChangeText={(val) => setFilters(f => ({ ...f, search: val }))}
                        onSubmitEditing={() => loadRecords(1)}
                        returnKeyType="search"
                    />
                    {filters.search.length > 0 && (
                        <TouchableOpacity onPress={() => setFilters(f => ({ ...f, search: '' }))}>
                            <Feather name="x" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.filtersWrap}>
                    {/* Status Dropdown Button */}
                    <TouchableOpacity
                        style={styles.filterDropdownBtn}
                        onPress={() => setStatusModalVisible(true)}
                    >
                        <Text style={styles.filterDropdownLabel} numberOfLines={1}>
                            {STATUS_OPTIONS.find(o => o.value === filters.status)?.label || 'All Statuses'}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Mode Dropdown Button */}
                    <TouchableOpacity
                        style={styles.filterDropdownBtn}
                        onPress={() => setModeModalVisible(true)}
                    >
                        <Text style={styles.filterDropdownLabel} numberOfLines={1}>
                            {MODE_OPTIONS.find(o => o.value === filters.paymentMode)?.label || 'All Modes'}
                        </Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>

                    {/* Date Pickers */}
                    <View style={styles.datePickerWrap}>
                        <DatePickerInput
                            placeholder="Start Date"
                            title="Start Date"
                            value={filters.startDate}
                            onChange={(val) => setFilters(f => ({ ...f, startDate: val || '' }))}
                        />
                    </View>

                    <View style={styles.datePickerWrap}>
                        <DatePickerInput
                            placeholder="End Date"
                            title="End Date"
                            value={filters.endDate}
                            onChange={(val) => setFilters(f => ({ ...f, endDate: val || '' }))}
                        />
                    </View>

                    {/* Clear Button */}
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClearFilters}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Status Modal Picker */}
            <Modal visible={statusModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Status</Text>
                        {STATUS_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.modalOption, filters.status === opt.value && styles.modalOptionActive]}
                                onPress={() => {
                                    setFilters(f => ({ ...f, status: opt.value }));
                                    setStatusModalVisible(false);
                                }}
                            >
                                <Text style={[styles.modalOptionText, filters.status === opt.value && styles.modalOptionTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setStatusModalVisible(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Mode Modal Picker */}
            <Modal visible={modeModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Payment Mode</Text>
                        {MODE_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.modalOption, filters.paymentMode === opt.value && styles.modalOptionActive]}
                                onPress={() => {
                                    setFilters(f => ({ ...f, paymentMode: opt.value }));
                                    setModeModalVisible(false);
                                }}
                            >
                                <Text style={[styles.modalOptionText, filters.paymentMode === opt.value && styles.modalOptionTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModeModalVisible(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Records List */}
            <View style={styles.card}>
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                        <Text style={styles.loadingText}>Loading financial records...</Text>
                    </View>
                ) : records.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                        <Text style={styles.emptyTitle}>No records found</Text>
                        <Text style={styles.emptySubtitle}>Try adjusting your search criteria or date filters</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ gap: 10 }}>
                            {records.map((r, idx) => {
                                const badgeStyle = getStatusBadgeStyle(r.paymentStatus);
                                return (
                                    <View key={r._id || idx} style={styles.recordCard}>
                                        <View style={styles.recordHeader}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <View style={styles.patientRow}>
                                                    <Feather name="user" size={14} color="#0f172a" />
                                                    <Text style={styles.patientName} numberOfLines={1}>
                                                        {r.patientId?.name || 'Walk-in Patient'}
                                                    </Text>
                                                </View>
                                                <View style={styles.mrnRow}>
                                                    <Feather name="hash" size={12} color="#64748b" />
                                                    <Text style={styles.mrnText}>
                                                        {r.patientId?.patientId || r.patientId?.mrn || '—'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountText}>{formatCurrency(r.amount)}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
                                                    <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
                                                        {r.paymentStatus || 'PAID'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Description */}
                                        {r.description ? (
                                            <Text style={styles.descriptionText} numberOfLines={2}>
                                                {r.description}
                                            </Text>
                                        ) : null}

                                        {/* Meta Footer */}
                                        <View style={styles.recordFooter}>
                                            <View style={styles.metaCol}>
                                                <Text style={styles.metaLabel}>Payment Mode</Text>
                                                <View style={styles.modeBadge}>
                                                    <Text style={styles.modeBadgeText}>{r.paymentMode || 'Cash'}</Text>
                                                </View>
                                            </View>

                                            {r.transactionId ? (
                                                <View style={styles.metaCol}>
                                                    <Text style={styles.metaLabel}>Txn ID</Text>
                                                    <Text style={styles.metaVal} numberOfLines={1}>{r.transactionId}</Text>
                                                </View>
                                            ) : null}

                                            <View style={styles.metaCol}>
                                                <Text style={styles.metaLabel}>Date</Text>
                                                <Text style={styles.metaVal}>{formatDateTime(r.paymentDate)}</Text>
                                            </View>

                                            {r.addedBy?.name ? (
                                                <View style={styles.metaCol}>
                                                    <Text style={styles.metaLabel}>Staff</Text>
                                                    <Text style={styles.metaVal}>{r.addedBy.name}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Pagination Bar */}
                        {pagination.totalPages > 1 && (
                            <View style={styles.paginationRow}>
                                <TouchableOpacity
                                    style={[styles.pageBtn, pagination.page <= 1 && styles.pageBtnDisabled]}
                                    disabled={pagination.page <= 1}
                                    onPress={() => loadRecords(pagination.page - 1)}
                                >
                                    <Feather name="chevron-left" size={16} color={pagination.page <= 1 ? '#94a3b8' : '#0f172a'} />
                                    <Text style={[styles.pageBtnText, pagination.page <= 1 && styles.pageBtnTextDisabled]}>
                                        Previous
                                    </Text>
                                </TouchableOpacity>

                                <Text style={styles.paginationInfo}>
                                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                                </Text>

                                <TouchableOpacity
                                    style={[styles.pageBtn, pagination.page >= pagination.totalPages && styles.pageBtnDisabled]}
                                    disabled={pagination.page >= pagination.totalPages}
                                    onPress={() => loadRecords(pagination.page + 1)}
                                >
                                    <Text style={[styles.pageBtnText, pagination.page >= pagination.totalPages && styles.pageBtnTextDisabled]}>
                                        Next
                                    </Text>
                                    <Feather name="chevron-right" size={16} color={pagination.page >= pagination.totalPages ? '#94a3b8' : '#0f172a'} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 16, paddingBottom: 40 },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 12
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    headerTag: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    headerTagText: { fontSize: 11, fontWeight: '700', color: '#0369a1' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 3 },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    refreshBtnText: { fontSize: 12, fontWeight: '700', color: '#0284c7' },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 14
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8
    },
    searchInput: { flex: 1, fontSize: 13, color: '#0f172a', padding: 0 },
    filtersWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
        marginTop: 10
    },
    filterDropdownBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 130
    },
    filterDropdownLabel: { fontSize: 12, color: '#334155', fontWeight: '600', marginRight: 6 },
    datePickerWrap: { minWidth: 130, flex: 1 },
    clearBtn: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    clearBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    loadingContainer: { padding: 30, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
    emptyContainer: { padding: 30, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    emptySubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
    recordCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    patientRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patientName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    mrnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    mrnText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    amountText: { fontSize: 15, fontWeight: '800', color: '#047857' },
    statusBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        marginTop: 4
    },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    descriptionText: {
        fontSize: 12,
        color: '#475569',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginVertical: 8
    },
    recordFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 8,
        marginTop: 6
    },
    metaCol: { minWidth: 70 },
    metaLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' },
    metaVal: { fontSize: 11, color: '#334155', fontWeight: '600', marginTop: 1 },
    modeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 1
    },
    modeBadgeText: { fontSize: 10, color: '#334155', fontWeight: '600' },
    paginationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9'
    },
    pageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    pageBtnDisabled: { opacity: 0.5 },
    pageBtnText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
    pageBtnTextDisabled: { color: '#94a3b8' },
    paginationInfo: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 18,
        width: '100%',
        maxWidth: 380
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    modalOptionActive: { backgroundColor: '#f0f9ff' },
    modalOptionText: { fontSize: 14, color: '#334155' },
    modalOptionTextActive: { color: '#0284c7', fontWeight: '700' },
    modalCloseBtn: {
        marginTop: 14,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center'
    },
    modalCloseText: { fontSize: 13, fontWeight: '700', color: '#475569' }
});

export default AccountantFinancialRecords;
