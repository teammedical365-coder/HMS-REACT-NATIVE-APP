import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { refundAdminAPI } from '../../utils/api';
import socket from '../../utils/socket';

const { width } = Dimensions.get('window');

const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const formatDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const HospitalAdminRefunds = () => {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    // Modals
    const [selectedRefund, setSelectedRefund] = useState(null);
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const loadRefunds = useCallback(async (isPull = false) => {
        try {
            if (isPull) setRefreshing(true);
            else setLoading(true);
            setError('');
            const params = { page, limit: 30 };
            if (statusFilter && statusFilter !== 'ALL') {
                params.status = statusFilter;
            }
            const res = await refundAdminAPI.getRefunds(params);
            if (res.success && res.data) {
                setRefunds(res.data.refunds || []);
                setPagination(res.data.pagination || null);
            } else if (Array.isArray(res)) {
                setRefunds(res);
            } else {
                setRefunds(res.refunds || []);
            }
        } catch (err) {
            console.error('Error loading refunds for admin:', err);
            setError('Failed to load refund requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter, page]);

    useEffect(() => {
        loadRefunds();
    }, [loadRefunds]);

    useEffect(() => {
        if (!socket) return;
        const handleRefresh = () => {
            loadRefunds();
        };

        socket.on('refund_requested', handleRefresh);
        socket.on('refund_status_updated', handleRefresh);
        socket.on('refund_completed', handleRefresh);

        return () => {
            socket.off('refund_requested', handleRefresh);
            socket.off('refund_status_updated', handleRefresh);
            socket.off('refund_completed', handleRefresh);
        };
    }, [loadRefunds]);

    const handleApprove = (id) => {
        Alert.alert(
            'Authorize Refund',
            'Are you sure you want to approve this refund request?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Authorize & Approve',
                    style: 'default',
                    onPress: async () => {
                        try {
                            setActionLoading(true);
                            const res = await refundAdminAPI.approveRefund(id);
                            if (res.success) {
                                Alert.alert('Success', 'Refund request approved successfully!');
                                loadRefunds();
                                if (selectedRefund?._id === id) {
                                    setSelectedRefund(null);
                                }
                            } else {
                                Alert.alert('Error', res.message || 'Failed to approve refund');
                            }
                        } catch (err) {
                            console.error('Error approving refund:', err);
                            Alert.alert('Error', err.response?.data?.message || 'Failed to approve refund');
                        } finally {
                            setActionLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRejectSubmit = async () => {
        if (!rejectModal) return;
        if (!rejectionReason.trim()) {
            Alert.alert('Required', 'Please enter a rejection reason');
            return;
        }

        try {
            setActionLoading(true);
            const res = await refundAdminAPI.rejectRefund(rejectModal._id, rejectionReason.trim());
            if (res.success) {
                Alert.alert('Success', 'Refund request rejected');
                setRejectModal(null);
                setRejectionReason('');
                loadRefunds();
                if (selectedRefund?._id === rejectModal._id) {
                    setSelectedRefund(null);
                }
            } else {
                Alert.alert('Error', res.message || 'Failed to reject refund');
            }
        } catch (err) {
            console.error('Error rejecting refund:', err);
            Alert.alert('Error', err.response?.data?.message || 'Failed to reject refund');
        } finally {
            setActionLoading(false);
        }
    };

    // Client-side search filtering
    const filteredRefunds = refunds.filter((r) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (r.patientName || '').toLowerCase().includes(q) ||
            (r.patientMRN || '').toLowerCase().includes(q) ||
            (r.refundMode || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.requestedByName || '').toLowerCase().includes(q)
        );
    });

    const pendingCount = refunds.filter(r => r.status === 'PENDING_APPROVAL').length;

    const filterTabs = [
        { key: 'PENDING_APPROVAL', label: 'Pending Approval', badge: pendingCount },
        { key: 'APPROVED', label: 'Approved (Pending Execution)' },
        { key: 'REFUNDED', label: 'Completed / Refunded' },
        { key: 'REJECTED', label: 'Rejected' },
        { key: 'ALL', label: 'All Requests' },
    ];

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
            case 'APPROVED':
                return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
            case 'REFUNDED':
                return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
            case 'REJECTED':
            default:
                return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadRefunds(true)} />
            }
        >
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.headerTitle}>Refund Authorizations</Text>
                        <View style={styles.headerTag}>
                            <Text style={styles.headerTagText}>Executive Approvals</Text>
                        </View>
                    </View>
                    <Text style={styles.headerSub}>Review, authorize, or decline patient refund requests submitted by the Finance team</Text>
                </View>
                <TouchableOpacity
                    style={[styles.refreshBtn, loading && { opacity: 0.7 }]}
                    onPress={() => loadRefunds()}
                    disabled={loading}
                >
                    <Ionicons name="refresh" size={16} color="#475569" />
                    <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Error banner */}
            {error ? (
                <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                <View style={styles.tabsRow}>
                    {filterTabs.map(tab => {
                        const active = statusFilter === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tabBtn, active && styles.tabBtnActive]}
                                onPress={() => { setStatusFilter(tab.key); setPage(1); }}
                            >
                                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                                    {tab.label}
                                </Text>
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <View style={styles.tabBadge}>
                                        <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Search Box */}
            <View style={styles.searchCard}>
                <Ionicons name="search" size={18} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by patient name, MRN, requested by, or reason..."
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                {searchTerm ? (
                    <TouchableOpacity onPress={() => setSearchTerm('')}>
                        <Ionicons name="close-circle" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Main Content List / Table */}
            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ marginTop: 10, color: '#64748b' }}>Loading refund requests...</Text>
                </View>
            ) : filteredRefunds.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Ionicons name="alert-circle-outline" size={44} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No refund requests found</Text>
                    <Text style={styles.emptySub}>
                        {statusFilter === 'PENDING_APPROVAL'
                            ? 'No refund requests awaiting your authorization.'
                            : 'No matching records found for this filter.'}
                    </Text>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ minWidth: 960 }}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { width: 170 }]}>Patient</Text>
                            <Text style={[styles.th, { width: 120 }]}>Refund Amount</Text>
                            <Text style={[styles.th, { width: 90 }]}>Mode</Text>
                            <Text style={[styles.th, { width: 220 }]}>Financial Context</Text>
                            <Text style={[styles.th, { width: 150 }]}>Requested By</Text>
                            <Text style={[styles.th, { width: 110 }]}>Status</Text>
                            <Text style={[styles.th, { width: 150, textAlign: 'right' }]}>Actions</Text>
                        </View>

                        {/* Table Body */}
                        {filteredRefunds.map((r, i) => {
                            const sStyle = getStatusStyle(r.status);
                            return (
                                <View key={r._id || i} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }]}>
                                    <View style={{ width: 170 }}>
                                        <Text style={{ fontWeight: '600', color: '#0f172a', fontSize: 13 }} numberOfLines={1}>{r.patientName || 'Unnamed Patient'}</Text>
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>MRN: {r.patientMRN || '—'}</Text>
                                    </View>
                                    <View style={{ width: 120 }}>
                                        <Text style={{ fontWeight: '700', color: '#dc2626', fontSize: 15 }}>
                                            {formatCurrency(r.refundAmount)}
                                        </Text>
                                    </View>
                                    <View style={{ width: 90 }}>
                                        <View style={[
                                            styles.modeBadge,
                                            { backgroundColor: r.refundMode === 'CASH' ? '#fef3c7' : '#e0e7ff' }
                                        ]}>
                                            <Text style={{
                                                fontSize: 11,
                                                fontWeight: '700',
                                                color: r.refundMode === 'CASH' ? '#92400e' : '#3730a3'
                                            }}>
                                                {r.refundMode || 'ONLINE'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 220 }}>
                                        <Text style={{ fontSize: 11, color: '#475569' }}>
                                            Paid: <Text style={{ fontWeight: '600' }}>{formatCurrency(r.totalPaid)}</Text> | Charges: <Text style={{ fontWeight: '600' }}>{formatCurrency(r.totalCharges)}</Text>
                                        </Text>
                                        <Text style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                                            Refundable: {formatCurrency(r.refundableAmount)}
                                        </Text>
                                    </View>
                                    <View style={{ width: 150 }}>
                                        <Text style={{ fontWeight: '500', color: '#334155', fontSize: 12 }}>{r.requestedByName || 'Accountant'}</Text>
                                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{formatDateTime(r.requestedAt || r.createdAt)}</Text>
                                    </View>
                                    <View style={{ width: 110 }}>
                                        <View style={[styles.statusBadge, { backgroundColor: sStyle.bg, borderColor: sStyle.border }]}>
                                            <Text style={[styles.statusBadgeText, { color: sStyle.text }]}>
                                                {r.status ? r.status.replace(/_/g, ' ') : 'PENDING'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 150, flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <TouchableOpacity
                                            style={styles.actionBtnDetails}
                                            onPress={() => setSelectedRefund(r)}
                                        >
                                            <Text style={{ fontSize: 11, color: '#334155', fontWeight: '600' }}>Details</Text>
                                        </TouchableOpacity>
                                        {r.status === 'PENDING_APPROVAL' && (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.actionBtnApprove}
                                                    disabled={actionLoading}
                                                    onPress={() => handleApprove(r._id)}
                                                >
                                                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: 'bold' }}>✓</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.actionBtnReject}
                                                    disabled={actionLoading}
                                                    onPress={() => { setRejectModal(r); setRejectionReason(''); }}
                                                >
                                                    <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>✕</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            )}

            {/* Details Modal */}
            {selectedRefund && (
                <Modal transparent visible animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalHeaderTitle}>Refund Authorization Details</Text>
                                <TouchableOpacity onPress={() => setSelectedRefund(null)}>
                                    <Ionicons name="close" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                                <View style={styles.modalPatientCard}>
                                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#0f172a' }}>{selectedRefund.patientName}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>MRN: {selectedRefund.patientMRN || '—'}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                    <View style={[styles.summaryBox, { backgroundColor: '#fef2f2', flex: 1 }]}>
                                        <Text style={{ fontSize: 10, color: '#991b1b', fontWeight: 'bold', textTransform: 'uppercase' }}>Refund Amount</Text>
                                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#dc2626', marginTop: 4 }}>{formatCurrency(selectedRefund.refundAmount)}</Text>
                                    </View>
                                    <View style={[styles.summaryBox, { backgroundColor: '#eff6ff', flex: 1 }]}>
                                        <Text style={{ fontSize: 10, color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase' }}>Refund Mode</Text>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#2563eb', marginTop: 4 }}>{selectedRefund.refundMode}</Text>
                                    </View>
                                </View>

                                <View style={styles.breakdownCard}>
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 }}>Financial Breakdown</Text>
                                    <View style={styles.breakdownRow}>
                                        <Text style={{ color: '#64748b', fontSize: 12 }}>Total Paid by Patient:</Text>
                                        <Text style={{ fontWeight: '600', fontSize: 12 }}>{formatCurrency(selectedRefund.totalPaid)}</Text>
                                    </View>
                                    <View style={styles.breakdownRow}>
                                        <Text style={{ color: '#64748b', fontSize: 12 }}>Total Patient Charges:</Text>
                                        <Text style={{ fontWeight: '600', fontSize: 12 }}>{formatCurrency(selectedRefund.totalCharges)}</Text>
                                    </View>
                                    <View style={styles.breakdownRow}>
                                        <Text style={{ color: '#64748b', fontSize: 12 }}>Previously Refunded:</Text>
                                        <Text style={{ fontWeight: '600', fontSize: 12 }}>{formatCurrency(selectedRefund.alreadyRefunded)}</Text>
                                    </View>
                                    <View style={[styles.breakdownRow, { borderTopWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', paddingTop: 8, marginTop: 6 }]}>
                                        <Text style={{ fontWeight: '700', color: '#059669', fontSize: 13 }}>Eligible Refundable Balance:</Text>
                                        <Text style={{ fontWeight: '700', color: '#059669', fontSize: 13 }}>{formatCurrency(selectedRefund.refundableAmount)}</Text>
                                    </View>
                                </View>

                                {selectedRefund.reason ? (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 }}>Reason for Refund:</Text>
                                        <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                            <Text style={{ fontSize: 13, color: '#1e293b' }}>{selectedRefund.reason}</Text>
                                        </View>
                                    </View>
                                ) : null}

                                {/* Audit Timeline */}
                                <View style={styles.timelineBox}>
                                    <Text style={styles.timelineText}>• Requested by: <Text style={{ fontWeight: '600' }}>{selectedRefund.requestedByName || 'Accountant'}</Text> on {formatDateTime(selectedRefund.requestedAt || selectedRefund.createdAt)}</Text>
                                    {selectedRefund.approvedBy ? (
                                        <Text style={styles.timelineText}>• Approved by: <Text style={{ fontWeight: '600' }}>{selectedRefund.approvedByName}</Text> on {formatDateTime(selectedRefund.approvedAt)}</Text>
                                    ) : null}
                                    {selectedRefund.rejectedBy ? (
                                        <Text style={[styles.timelineText, { color: '#dc2626' }]}>• Rejected by: <Text style={{ fontWeight: '600' }}>{selectedRefund.rejectedByName}</Text> on {formatDateTime(selectedRefund.rejectedAt)} — Reason: {selectedRefund.rejectionReason}</Text>
                                    ) : null}
                                    {selectedRefund.processedBy ? (
                                        <Text style={styles.timelineText}>• Processed by: <Text style={{ fontWeight: '600' }}>{selectedRefund.processedByName}</Text> on {formatDateTime(selectedRefund.processedAt)} (UTR: {selectedRefund.refundTransactionId || '—'})</Text>
                                    ) : null}
                                    {selectedRefund.handedOverBy ? (
                                        <Text style={styles.timelineText}>• Cash handed over by: <Text style={{ fontWeight: '600' }}>{selectedRefund.handedOverByName}</Text> on {formatDateTime(selectedRefund.handedOverAt)}</Text>
                                    ) : null}
                                </View>
                            </ScrollView>

                            <View style={styles.modalFooter}>
                                {selectedRefund.status === 'PENDING_APPROVAL' && (
                                    <>
                                        <TouchableOpacity
                                            style={styles.modalRejectBtn}
                                            onPress={() => { setRejectModal(selectedRefund); setRejectionReason(''); }}
                                        >
                                            <Text style={styles.modalRejectBtnText}>Reject Request</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.modalApproveBtn}
                                            disabled={actionLoading}
                                            onPress={() => handleApprove(selectedRefund._id)}
                                        >
                                            <Text style={styles.modalApproveBtnText}>Authorize & Approve</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => setSelectedRefund(null)}
                                >
                                    <Text style={styles.modalCloseBtnText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Rejection Modal */}
            {rejectModal && (
                <Modal transparent visible animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { maxWidth: 440 }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalHeaderTitle, { color: '#dc2626' }]}>Reject Refund Request</Text>
                                <TouchableOpacity onPress={() => setRejectModal(null)}>
                                    <Ionicons name="close" size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                                Please provide a reason for declining the refund of <Text style={{ fontWeight: 'bold' }}>{formatCurrency(rejectModal.refundAmount)}</Text> for <Text style={{ fontWeight: 'bold' }}>{rejectModal.patientName}</Text>.
                            </Text>

                            <TextInput
                                multiline
                                numberOfLines={4}
                                placeholder="Enter rejection reason (required for audit trail)..."
                                value={rejectionReason}
                                onChangeText={setRejectionReason}
                                style={styles.rejectionInput}
                            />

                            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => setRejectModal(null)}
                                >
                                    <Text style={styles.modalCloseBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalRejectBtn, (!rejectionReason.trim() || actionLoading) && { opacity: 0.6 }]}
                                    disabled={actionLoading || !rejectionReason.trim()}
                                    onPress={handleRejectSubmit}
                                >
                                    <Text style={styles.modalRejectBtnText}>
                                        {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    headerTag: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    headerTagText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
    headerSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    refreshBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 10, borderRadius: 8, marginBottom: 14 },
    errorText: { color: '#dc2626', fontSize: 13, fontWeight: '600' },

    tabsScroll: { marginBottom: 14 },
    tabsRow: { flexDirection: 'row', gap: 8 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
    tabBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb', borderWidth: 2 },
    tabBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    tabBtnTextActive: { color: '#1d4ed8', fontWeight: '700' },
    tabBadge: { backgroundColor: '#dc2626', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
    tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    searchCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
    searchInput: { flex: 1, fontSize: 13, color: '#1e293b' },

    tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#e2e8f0', borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    th: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },

    modeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, alignSelf: 'flex-start' },
    statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

    actionBtnDetails: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    actionBtnApprove: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    actionBtnReject: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },

    loadingBox: { padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8 },
    emptyCard: { padding: 40, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 8 },
    emptySub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 540 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 12, marginBottom: 14 },
    modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    modalPatientCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 },
    summaryBox: { padding: 12, borderRadius: 8 },
    breakdownCard: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 12 },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
    timelineBox: { borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 10, marginTop: 4, gap: 4 },
    timelineText: { fontSize: 11, color: '#64748b' },

    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderColor: '#f1f5f9', paddingTop: 12, marginTop: 12, flexWrap: 'wrap' },
    modalRejectBtn: { backgroundColor: '#dc2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
    modalRejectBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    modalApproveBtn: { backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
    modalApproveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    modalCloseBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
    modalCloseBtnText: { color: '#475569', fontWeight: '600', fontSize: 12 },

    rejectionInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, minHeight: 90, textAlignVertical: 'top' },
});

export default HospitalAdminRefunds;
