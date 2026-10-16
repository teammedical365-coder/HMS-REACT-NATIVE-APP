import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fetchAccountantHistoryWithOffline } from '../../services/offline/offlineHospitalAdminService';
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

const STATUS_BADGE = {
    REFUNDED: { label: 'Refunded', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: 'check-circle' },
    REJECTED: { label: 'Rejected', bg: '#fef2f2', text: '#dc2626', border: '#fecaca', icon: 'x' },
    CANCELLED: { label: 'Cancelled', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: 'x' },
};

const AccountantHistory = () => {
    const { width } = useWindowDimensions();

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 0 });
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [offlineMeta, setOfflineMeta] = useState(null);

    const loadHistory = useCallback(async (page = 1, isManualRefresh = false) => {
        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            const params = { page, limit: 30 };
            if (dateFilter.startDate) params.startDate = dateFilter.startDate;
            if (dateFilter.endDate) params.endDate = dateFilter.endDate;

            const res = await fetchAccountantHistoryWithOffline(params, isManualRefresh);
            if (res && res.data) {
                setHistory(res.data.history || []);
                setPagination(res.data.pagination || { page: 1, limit: 30, total: 0, totalPages: 0 });
                setOfflineMeta(res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.lastSynced,
                    freshnessNote: res.freshnessNote
                } : null);
            }
        } catch (err) {
            console.error('Load refund history error:', err);
            Alert.alert('Error', 'Failed to load refund history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        loadHistory(1);
    }, [loadHistory]);

    const handleClearDateFilter = () => {
        setDateFilter({ startDate: '', endDate: '' });
    };

    const getStatusBadge = (status) => {
        const cfg = STATUS_BADGE[status] || { label: status || '—', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', icon: 'help-circle' };
        return (
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Feather name={cfg.icon} size={11} color={cfg.text} style={{ marginRight: 4 }} />
                <Text style={[styles.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
            </View>
        );
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(pagination.page, true)} colors={['#0ea5e9']} />
            }
        >
            <OfflineBanner offlineMeta={offlineMeta} />

            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Refund History</Text>
                        <View style={styles.headerTag}>
                            <Text style={styles.headerTagText}>Audit Trail</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>Complete audit trail of all refund transactions</Text>
                </View>

                <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => loadHistory(pagination.page, true)}
                    disabled={loading || refreshing}
                >
                    <Feather name="refresh-cw" size={14} color="#0284c7" />
                    <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Date Filter Card */}
            <View style={styles.card}>
                <View style={styles.filtersWrap}>
                    <Text style={styles.filterTitle}>Date Range:</Text>
                    <View style={styles.datePickerWrap}>
                        <DatePickerInput
                            placeholder="Start Date"
                            title="Start Date"
                            value={dateFilter.startDate}
                            onChange={(val) => setDateFilter(f => ({ ...f, startDate: val || '' }))}
                        />
                    </View>
                    <Text style={styles.toText}>to</Text>
                    <View style={styles.datePickerWrap}>
                        <DatePickerInput
                            placeholder="End Date"
                            title="End Date"
                            value={dateFilter.endDate}
                            onChange={(val) => setDateFilter(f => ({ ...f, endDate: val || '' }))}
                        />
                    </View>
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClearDateFilter}>
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* History List */}
            <View style={styles.card}>
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                        <Text style={styles.loadingText}>Loading audit history...</Text>
                    </View>
                ) : history.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>📜</Text>
                        <Text style={styles.emptyTitle}>No refund history</Text>
                        <Text style={styles.emptySubtitle}>Completed, rejected, and cancelled refunds will appear here</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ gap: 10 }}>
                            {history.map(r => (
                                <View key={r._id} style={styles.historyCard}>
                                    <View style={styles.historyCardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <View style={styles.patientRow}>
                                                <Feather name="user" size={14} color="#0f172a" />
                                                <Text style={styles.patientName} numberOfLines={1}>{r.patientName || '—'}</Text>
                                            </View>
                                            <View style={styles.mrnRow}>
                                                <Feather name="hash" size={12} color="#64748b" />
                                                <Text style={styles.mrnText}>{r.patientMRN || '—'}</Text>
                                            </View>
                                        </View>

                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.amountText}>{formatCurrency(r.refundAmount)}</Text>
                                            {getStatusBadge(r.status)}
                                        </View>
                                    </View>

                                    {/* Footer details */}
                                    <View style={styles.historyCardFooter}>
                                        <View style={styles.metaCol}>
                                            <Text style={styles.metaLabel}>Mode</Text>
                                            <View style={styles.modeBadge}>
                                                <Text style={styles.modeBadgeText}>{r.refundMode}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.metaCol}>
                                            <Text style={styles.metaLabel}>Requested By</Text>
                                            <Text style={styles.metaVal}>{r.requestedByName || 'Staff'}</Text>
                                        </View>

                                        <View style={styles.metaCol}>
                                            <Text style={styles.metaLabel}>
                                                {r.status === 'REJECTED' ? 'Rejected By' : 'Approved By'}
                                            </Text>
                                            <Text style={styles.metaVal}>
                                                {r.status === 'REJECTED' ? (r.rejectedByName || '—') : (r.approvedByName || '—')}
                                            </Text>
                                        </View>

                                        {(r.handedOverByName || r.processedByName) ? (
                                            <View style={styles.metaCol}>
                                                <Text style={styles.metaLabel}>Settled By</Text>
                                                <Text style={styles.metaVal}>{r.handedOverByName || r.processedByName}</Text>
                                            </View>
                                        ) : null}

                                        {r.refundTransactionId ? (
                                            <View style={styles.metaCol}>
                                                <Text style={styles.metaLabel}>UTR / Ref</Text>
                                                <Text style={styles.metaVal} numberOfLines={1}>{r.refundTransactionId}</Text>
                                            </View>
                                        ) : null}

                                        <View style={styles.metaCol}>
                                            <Text style={styles.metaLabel}>Completed</Text>
                                            <Text style={styles.metaVal}>
                                                {formatDateTime(r.processedAt || r.handedOverAt || r.rejectedAt || r.updatedAt)}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.viewDetailBtn}
                                            onPress={() => setSelectedDetail(r)}
                                        >
                                            <Feather name="eye" size={13} color="#0284c7" />
                                            <Text style={styles.viewDetailBtnText}>View</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <View style={styles.paginationRow}>
                                <TouchableOpacity
                                    style={[styles.pageBtn, pagination.page <= 1 && styles.pageBtnDisabled]}
                                    disabled={pagination.page <= 1}
                                    onPress={() => loadHistory(pagination.page - 1)}
                                >
                                    <Feather name="chevron-left" size={16} color={pagination.page <= 1 ? '#94a3b8' : '#0f172a'} />
                                    <Text style={[styles.pageBtnText, pagination.page <= 1 && styles.pageBtnTextDisabled]}>Previous</Text>
                                </TouchableOpacity>

                                <Text style={styles.paginationInfo}>
                                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                                </Text>

                                <TouchableOpacity
                                    style={[styles.pageBtn, pagination.page >= pagination.totalPages && styles.pageBtnDisabled]}
                                    disabled={pagination.page >= pagination.totalPages}
                                    onPress={() => loadHistory(pagination.page + 1)}
                                >
                                    <Text style={[styles.pageBtnText, pagination.page >= pagination.totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                                    <Feather name="chevron-right" size={16} color={pagination.page >= pagination.totalPages ? '#94a3b8' : '#0f172a'} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* ════ Refund Details Modal ════ */}
            {selectedDetail && (
                <Modal visible={true} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 18 }}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle}>Refund Details</Text>
                                <TouchableOpacity onPress={() => setSelectedDetail(null)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {/* Main Summary */}
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Patient</Text>
                                    <Text style={styles.summaryVal}>{selectedDetail.patientName}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>MRN</Text>
                                    <Text style={styles.summaryVal}>{selectedDetail.patientMRN}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Refund Amount</Text>
                                    <Text style={[styles.summaryVal, { color: '#dc2626', fontWeight: '800' }]}>
                                        {formatCurrency(selectedDetail.refundAmount)}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Refund Mode</Text>
                                    <Text style={styles.summaryVal}>{selectedDetail.refundMode}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Status</Text>
                                    {getStatusBadge(selectedDetail.status)}
                                </View>
                            </View>

                            {/* Financial Snapshot */}
                            <Text style={styles.modalSectionTitle}>Financial Snapshot</Text>
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Original Payment</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(selectedDetail.originalPaymentAmount)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Charges</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(selectedDetail.totalCharges)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Paid</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(selectedDetail.totalPaid)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Already Refunded</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(selectedDetail.alreadyRefunded)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Reason</Text>
                                    <Text style={[styles.summaryVal, { flex: 1, textAlign: 'right' }]} numberOfLines={3}>
                                        {selectedDetail.reason || '—'}
                                    </Text>
                                </View>
                            </View>

                            {/* Timeline */}
                            <Text style={styles.modalSectionTitle}>Timeline & Audit Trail</Text>
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Requested By</Text>
                                    <Text style={styles.summaryVal}>
                                        {selectedDetail.requestedByName || 'Staff'} — {formatDateTime(selectedDetail.requestedAt)}
                                    </Text>
                                </View>

                                {selectedDetail.approvedByName ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Approved By</Text>
                                        <Text style={styles.summaryVal}>
                                            {selectedDetail.approvedByName} — {formatDateTime(selectedDetail.approvedAt)}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedDetail.rejectedByName ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Rejected By</Text>
                                        <Text style={[styles.summaryVal, { color: '#dc2626' }]}>
                                            {selectedDetail.rejectedByName} — {formatDateTime(selectedDetail.rejectedAt)}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedDetail.rejectionReason ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Rejection Reason</Text>
                                        <Text style={[styles.summaryVal, { color: '#dc2626', flex: 1, textAlign: 'right' }]}>
                                            {selectedDetail.rejectionReason}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedDetail.processedByName ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Processed By</Text>
                                        <Text style={styles.summaryVal}>
                                            {selectedDetail.processedByName} — {formatDateTime(selectedDetail.processedAt)}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedDetail.handedOverByName ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Cash Handed Over By</Text>
                                        <Text style={styles.summaryVal}>
                                            {selectedDetail.handedOverByName} — {formatDateTime(selectedDetail.handedOverAt)}
                                        </Text>
                                    </View>
                                ) : null}

                                {selectedDetail.originalTransactionId ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Original Txn ID</Text>
                                        <Text style={styles.summaryVal}>{selectedDetail.originalTransactionId}</Text>
                                    </View>
                                ) : null}

                                {selectedDetail.refundTransactionId ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Refund Txn ID / UTR</Text>
                                        <Text style={[styles.summaryVal, { fontWeight: '700' }]}>{selectedDetail.refundTransactionId}</Text>
                                    </View>
                                ) : null}

                                {selectedDetail.processingNotes ? (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>Processing Notes</Text>
                                        <Text style={[styles.summaryVal, { flex: 1, textAlign: 'right' }]} numberOfLines={3}>
                                            {selectedDetail.processingNotes}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Close Action */}
                            <View style={{ marginTop: 18, alignItems: 'flex-end' }}>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => setSelectedDetail(null)}
                                >
                                    <Text style={styles.modalCloseBtnText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            )}
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
    filtersWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8
    },
    filterTitle: { fontSize: 12, fontWeight: '700', color: '#334155' },
    datePickerWrap: { minWidth: 130, flex: 1 },
    toText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
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
    historyCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12
    },
    historyCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    patientRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patientName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    mrnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    mrnText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    amountText: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        marginTop: 4
    },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    historyCardFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 8,
        marginTop: 6,
        alignItems: 'center'
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
    viewDetailBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        marginLeft: 'auto'
    },
    viewDetailBtnText: { fontSize: 11, fontWeight: '700', color: '#0284c7' },
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
        padding: 16
    },
    modalScroll: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90%'
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    modalSectionTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 14, marginBottom: 6 },
    summaryBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3
    },
    summaryLabel: { fontSize: 12, color: '#64748b' },
    summaryVal: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
    modalCloseBtn: {
        backgroundColor: '#0284c7',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 8
    },
    modalCloseBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' }
});

export default AccountantHistory;
