import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, ActivityIndicator, Alert, Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { refundReceptionAPI } from '../../utils/api';
import socket from '../../utils/socket';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);

const formatDateTime = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const ReceptionRefunds = () => {
    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewTab, setViewTab] = useState('PENDING'); // 'PENDING' or 'HISTORY'
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmModal, setConfirmModal] = useState(null);

    const loadRefunds = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            let res;
            if (viewTab === 'PENDING') {
                res = await refundReceptionAPI.getCashRefunds(false);
            } else {
                res = await refundReceptionAPI.getRefundHistory();
            }
            if (res.success) {
                setRefunds(res.data || []);
            }
        } catch (err) {
            console.error('Reception Refunds load error:', err);
            setError('Failed to load cash refund queue');
        } finally {
            setLoading(false);
        }
    }, [viewTab]);

    useEffect(() => {
        loadRefunds();
    }, [loadRefunds]);

    // Real-time socket events for receptionist
    useEffect(() => {
        const handleCashReady = (data) => {
            Alert.alert(
                '💵 Cash Refund Ready!',
                `${formatCurrency(data.refundAmount)} for ${data.patientName || 'Patient'} is ready for handover.`
            );
            loadRefunds();
        };

        const handleRefundStatus = () => {
            loadRefunds();
        };

        socket.on('refund_cash_ready', handleCashReady);
        socket.on('refund_status_updated', handleRefundStatus);
        socket.on('refund_completed', handleRefundStatus);

        return () => {
            socket.off('refund_cash_ready', handleCashReady);
            socket.off('refund_status_updated', handleRefundStatus);
            socket.off('refund_completed', handleRefundStatus);
        };
    }, [loadRefunds]);

    const handleHandoverSubmit = async () => {
        if (!confirmModal) return;
        try {
            setActionLoading(true);
            const res = await refundReceptionAPI.handOverCash(confirmModal._id);
            if (res.success) {
                Alert.alert('Success', `₹${confirmModal.refundAmount} cash handed over to ${confirmModal.patientName}`);
                setConfirmModal(null);
                loadRefunds();
            }
        } catch (err) {
            console.error('Handover error:', err);
            Alert.alert('Error', err.response?.data?.message || 'Failed to complete cash handover');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredRefunds = refunds.filter((r) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
            (r.patientName || '').toLowerCase().includes(q) ||
            (r.patientMRN || '').toLowerCase().includes(q) ||
            (r.reason || '').toLowerCase().includes(q) ||
            (r.approvedByName || '').toLowerCase().includes(q) ||
            (r.handedOverByName || '').toLowerCase().includes(q)
        );
    });

    const pendingTotal = refunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pageTitle}>Cash Refund Counter</Text>
                        <Text style={styles.pageSubtitle}>Hand over approved cash refunds to patients and record disbursements</Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={loadRefunds} disabled={loading}>
                        <Feather name="refresh-cw" size={15} color="#0d9488" />
                        <Text style={styles.refreshBtnText}>Refresh</Text>
                    </TouchableOpacity>
                </View>

                {!!error && (
                    <View style={styles.errorBanner}>
                        <Feather name="alert-circle" size={14} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* KPI Banner */}
                <View style={styles.kpiCard}>
                    <View style={[styles.kpiIconWrap, { backgroundColor: '#fef3c7' }]}>
                        <Feather name="dollar-sign" size={22} color="#d97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.kpiValue}>{formatCurrency(pendingTotal)}</Text>
                        <Text style={styles.kpiLabel}>
                            {viewTab === 'PENDING' ? 'Pending Cash Disbursement' : 'Total Handed Over (Recent)'}
                        </Text>
                        <Text style={styles.kpiSub}>{refunds.length} transactions</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabRow}>
                    <TouchableOpacity
                        style={[styles.tab, viewTab === 'PENDING' && styles.tabActive]}
                        onPress={() => { setViewTab('PENDING'); setSearchTerm(''); }}
                    >
                        <Feather name="clock" size={14} color={viewTab === 'PENDING' ? '#065f46' : '#64748b'} />
                        <Text style={[styles.tabText, viewTab === 'PENDING' && styles.tabTextActive]}>
                            Pending Queue {viewTab === 'PENDING' ? `(${refunds.length})` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewTab === 'HISTORY' && styles.tabActiveBlue]}
                        onPress={() => { setViewTab('HISTORY'); setSearchTerm(''); }}
                    >
                        <Feather name="check-circle" size={14} color={viewTab === 'HISTORY' ? '#1e40af' : '#64748b'} />
                        <Text style={[styles.tabText, viewTab === 'HISTORY' && styles.tabTextActiveBlue]}>
                            Handover History
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchBox}>
                    <Feather name="search" size={15} color="#94a3b8" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by patient name, MRN, approver..."
                        placeholderTextColor="#94a3b8"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    {!!searchTerm && (
                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                            <Feather name="x" size={14} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Refund List */}
                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color="#0d9488" size="large" />
                        <Text style={styles.loadingText}>Loading cash queue...</Text>
                    </View>
                ) : filteredRefunds.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyIcon}>💸</Text>
                        <Text style={styles.emptyTitle}>
                            {viewTab === 'PENDING' ? 'No pending cash refunds' : 'No handover history found'}
                        </Text>
                        <Text style={styles.emptySub}>
                            {viewTab === 'PENDING'
                                ? 'When an admin approves a cash refund, it will appear here.'
                                : 'Completed cash handovers will be listed here.'}
                        </Text>
                    </View>
                ) : (
                    filteredRefunds.map((r) => (
                        <View key={r._id} style={styles.refundCard}>
                            {/* Patient Info */}
                            <View style={styles.cardTopRow}>
                                <View style={styles.avatarCircle}>
                                    <Text style={styles.avatarText}>{(r.patientName || 'P')[0].toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.patientName}>{r.patientName || 'Unnamed Patient'}</Text>
                                    <Text style={styles.patientMrn}>MRN: {r.patientMRN || '—'}</Text>
                                </View>
                                <View style={styles.amountBadge}>
                                    <Text style={styles.amountText}>{formatCurrency(r.refundAmount)}</Text>
                                    <View style={styles.cashPill}>
                                        <Text style={styles.cashPillText}>CASH</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Meta info */}
                            <View style={styles.metaRow}>
                                <View style={styles.metaItem}>
                                    <Text style={styles.metaLabel}>Authorized By</Text>
                                    <Text style={styles.metaValue}>{r.approvedByName || 'Admin'}</Text>
                                    <Text style={styles.metaSub}>{formatDateTime(r.approvedAt)}</Text>
                                </View>
                                <View style={styles.metaItem}>
                                    <Text style={styles.metaLabel}>Reason</Text>
                                    <Text style={styles.metaValue} numberOfLines={2}>{r.reason || 'Patient refund'}</Text>
                                </View>
                                {viewTab === 'HISTORY' && (
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Handed Over By</Text>
                                        <Text style={styles.metaValue}>{r.handedOverByName || 'Receptionist'}</Text>
                                        <Text style={styles.metaSub}>{formatDateTime(r.handedOverAt || r.updatedAt)}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Action button (only for PENDING) */}
                            {viewTab === 'PENDING' && (
                                <TouchableOpacity
                                    style={styles.handoverBtn}
                                    onPress={() => setConfirmModal(r)}
                                    activeOpacity={0.85}
                                >
                                    <Feather name="check" size={14} color="#ffffff" />
                                    <Text style={styles.handoverBtnText}>Mark Cash Handed Over</Text>
                                </TouchableOpacity>
                            )}

                            {viewTab === 'HISTORY' && (
                                <View style={styles.completedBadge}>
                                    <Feather name="check-circle" size={13} color="#059669" />
                                    <Text style={styles.completedText}>Completed</Text>
                                </View>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Confirm Handover Modal */}
            <Modal visible={!!confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>✅ Confirm Cash Handover</Text>
                            <TouchableOpacity onPress={() => setConfirmModal(null)}>
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalBodyText}>
                            You are about to disburse physical cash to:
                        </Text>

                        <View style={styles.patientPreview}>
                            <Text style={styles.previewName}>{confirmModal?.patientName}</Text>
                            <Text style={styles.previewMrn}>MRN: {confirmModal?.patientMRN || '—'}</Text>
                            <Text style={styles.previewAmount}>{formatCurrency(confirmModal?.refundAmount)}</Text>
                        </View>

                        <View style={styles.warningBox}>
                            <Text style={styles.warningText}>
                                ⚠️ Please verify the patient's identity and hand over the exact amount before confirming. This action is permanently recorded.
                            </Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setConfirmModal(null)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, actionLoading && { opacity: 0.7 }]}
                                onPress={handleHandoverSubmit}
                                disabled={actionLoading}
                            >
                                {actionLoading
                                    ? <ActivityIndicator size="small" color="#ffffff" />
                                    : <Text style={styles.confirmBtnText}>Confirm Handed Over</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 20, paddingBottom: 60 },

    // Header
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 },
    pageTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
    pageSubtitle: { fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 18 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    refreshBtnText: { fontSize: 13, color: '#0d9488', fontWeight: '600' },

    // Error Banner
    errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 14 },
    errorText: { fontSize: 13, color: '#dc2626', flex: 1 },

    // KPI Card
    kpiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#fde68a', padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    kpiIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    kpiValue: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
    kpiSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

    // Tabs — flexWrap: 'wrap' allows tabs to wrap on narrow screens
    tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', flexShrink: 1 },
    tabActive: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
    tabActiveBlue: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabTextActive: { color: '#065f46' },
    tabTextActiveBlue: { color: '#1e40af' },

    // Search
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
    searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },

    // Loading / Empty
    loadingBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
    emptyBox: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: 40, marginBottom: 10 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 6 },
    emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

    // Refund Card
    refundCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
    patientName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    patientMrn: { fontSize: 12, color: '#64748b', marginTop: 2 },
    amountBadge: { alignItems: 'flex-end', gap: 4 },
    amountText: { fontSize: 16, fontWeight: '800', color: '#059669' },
    cashPill: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    cashPillText: { fontSize: 10, fontWeight: '800', color: '#92400e' },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginBottom: 12 },
    metaItem: { flex: 1, minWidth: 100 },
    metaLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 3 },
    metaValue: { fontSize: 13, fontWeight: '600', color: '#334155' },
    metaSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

    handoverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 11, elevation: 2, shadowColor: '#059669', shadowOpacity: 0.25, shadowRadius: 8 },
    handoverBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
    completedText: { fontSize: 13, fontWeight: '600', color: '#059669' },

    // Modal — keyboard-safe, bounded by screen edges
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 24 },
    modalBox: { backgroundColor: '#ffffff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 440, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#059669' },
    modalBodyText: { fontSize: 13, color: '#334155', marginBottom: 12 },
    patientPreview: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 12 },
    previewName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    previewMrn: { fontSize: 12, color: '#64748b', marginTop: 2 },
    previewAmount: { fontSize: 22, fontWeight: '900', color: '#059669', marginTop: 8 },
    warningBox: { backgroundColor: '#ecfdf5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 16 },
    warningText: { fontSize: 12, color: '#065f46', lineHeight: 17 },
    modalActions: { flexDirection: 'row', gap: 10 },
    cancelBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#475569' },
    confirmBtn: { flex: 1, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center', elevation: 2 },
    confirmBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});

export default ReceptionRefunds;
