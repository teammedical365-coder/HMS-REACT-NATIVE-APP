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
import {
    fetchAccountantRefundsWithOffline,
    createAccountantRefundRequestOnlineOnly,
    processAccountantRefundOnlineOnly
} from '../../services/offline/offlineHospitalAdminService';
import { accountantAPI, billingAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OfflineBanner from '../../components/common/OfflineBanner';

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

const STATUS_CONFIG = {
    PENDING_APPROVAL: { label: 'Pending Approval', bg: '#fffbeb', text: '#d97706', border: '#fde68a', icon: 'clock' },
    APPROVED: { label: 'Approved', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', icon: 'check' },
    PROCESSING: { label: 'Processing', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: 'arrow-right' },
    REFUNDED: { label: 'Refunded', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', icon: 'check-circle' },
    REJECTED: { label: 'Rejected', bg: '#fef2f2', text: '#dc2626', border: '#fecaca', icon: 'x' },
    CANCELLED: { label: 'Cancelled', bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', icon: 'x' },
};

const AccountantRefunds = () => {
    const { width } = useWindowDimensions();

    const [refunds, setRefunds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 0 });
    const [offlineMeta, setOfflineMeta] = useState(null);

    // ── New Refund Modal State ──
    const [showNewRefund, setShowNewRefund] = useState(false);
    const [patientSearch, setPatientSearch] = useState('');
    const [patientSearching, setPatientSearching] = useState(false);
    const [patientResults, setPatientResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [refundData, setRefundData] = useState(null);
    const [refundForm, setRefundForm] = useState({ refundAmount: '', refundMode: 'CASH', reason: '', originalPaymentId: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    // ── Process Refund Modal State ──
    const [processModal, setProcessModal] = useState(null);
    const [processForm, setProcessForm] = useState({ refundTransactionId: '', processingNotes: '' });
    const [processing, setProcessing] = useState(false);
    const [processError, setProcessError] = useState(null);

    const loadRefunds = useCallback(async (page = 1, isManualRefresh = false) => {
        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            const params = { page, limit: 30 };
            if (activeTab !== 'all') params.status = activeTab;

            const res = await fetchAccountantRefundsWithOffline(params, isManualRefresh);
            if (res && res.data) {
                setRefunds(res.data.refunds || []);
                setPagination(res.data.pagination || { page: 1, limit: 30, total: 0, totalPages: 0 });
                setOfflineMeta(res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.lastSynced,
                    freshnessNote: res.freshnessNote
                } : null);
            }
        } catch (err) {
            console.error('Load refunds error:', err);
            Alert.alert('Error', 'Failed to load refund requests');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadRefunds(1);
    }, [loadRefunds]);

    // Real-time socket updates matching web AccountantRefunds
    useEffect(() => {
        if (!socket || !socket.on) return;
        const handleUpdate = () => loadRefunds(pagination.page, true);
        socket.on('refund_approved', handleUpdate);
        socket.on('refund_rejected', handleUpdate);
        socket.on('refund_completed', handleUpdate);
        socket.on('refund_status_updated', handleUpdate);
        return () => {
            socket.off('refund_approved', handleUpdate);
            socket.off('refund_rejected', handleUpdate);
            socket.off('refund_completed', handleUpdate);
            socket.off('refund_status_updated', handleUpdate);
        };
    }, [loadRefunds, pagination.page]);

    // Patient Search
    const handlePatientSearch = async () => {
        if (!patientSearch.trim()) return;
        setPatientSearching(true);
        setSubmitError(null);
        try {
            const res = await billingAPI.searchPatients(patientSearch.trim());
            if (res && res.success) {
                setPatientResults(res.patients || res.data || []);
            } else {
                setPatientResults([]);
                setSubmitError('No matching patient found');
            }
        } catch (err) {
            setSubmitError(err.response?.data?.message || 'Patient search failed');
        } finally {
            setPatientSearching(false);
        }
    };

    // Select Patient & Fetch Refund Balance Data
    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setPatientResults([]);
        setSubmitError(null);
        try {
            const res = await accountantAPI.getPatientRefundData(patient._id);
            if (res && res.success) {
                setRefundData(res.data);
                setRefundForm(f => ({ ...f, refundAmount: '', originalPaymentId: '' }));
            } else {
                setSubmitError(res?.message || 'Failed to fetch refundable balance');
            }
        } catch (err) {
            setSubmitError(err.response?.data?.message || 'Failed to fetch refundable balance for patient');
        }
    };

    const resetNewRefundForm = () => {
        setSelectedPatient(null);
        setRefundData(null);
        setPatientSearch('');
        setPatientResults([]);
        setRefundForm({ refundAmount: '', refundMode: 'CASH', reason: '', originalPaymentId: '' });
        setSubmitError(null);
    };

    // Submit Refund Request (Online-only gate)
    const handleSubmitRefund = async () => {
        if (submitting) return;

        if (!selectedPatient) {
            Alert.alert('Patient Required', 'Please select a patient first.');
            return;
        }

        const amount = parseFloat(refundForm.refundAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid refund amount greater than 0.');
            return;
        }

        if (refundData && amount > refundData.refundableAmount) {
            Alert.alert('Amount Exceeded', `Refund amount cannot exceed ₹${refundData.refundableAmount.toLocaleString()}.`);
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            const res = await createAccountantRefundRequestOnlineOnly({
                patientId: selectedPatient._id,
                refundAmount: amount,
                refundMode: refundForm.refundMode,
                reason: refundForm.reason,
                originalPaymentId: refundForm.originalPaymentId || undefined
            });

            if (res && res.success) {
                Alert.alert('Request Submitted', 'Refund request created successfully! Awaiting Hospital Admin approval.');
                setShowNewRefund(false);
                resetNewRefundForm();
                loadRefunds(1, true);
            } else {
                const msg = res?.message || 'Failed to create refund request';
                setSubmitError(msg);
                Alert.alert('Error', msg);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to submit refund request';
            setSubmitError(msg);
            Alert.alert('Submission Failed', msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Process Approved UPI / Bank Refund (Online-only gate)
    const handleProcessRefund = async () => {
        if (processing || !processModal) return;

        const trimmedRef = (processForm.refundTransactionId || '').trim();
        if (!trimmedRef) {
            Alert.alert('Transaction Reference Required', 'Please enter the transaction reference / UTR number.');
            return;
        }

        setProcessing(true);
        setProcessError(null);

        try {
            const res = await processAccountantRefundOnlineOnly(processModal._id, {
                refundTransactionId: trimmedRef,
                processingNotes: processForm.processingNotes
            });

            if (res && res.success) {
                Alert.alert('Success', 'Refund marked as completed!');
                setProcessModal(null);
                setProcessForm({ refundTransactionId: '', processingNotes: '' });
                loadRefunds(pagination.page, true);
            } else {
                const msg = res?.message || 'Failed to process refund';
                setProcessError(msg);
                Alert.alert('Error', msg);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to process refund';
            setProcessError(msg);
            Alert.alert('Action Failed', msg);
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const cfg = STATUS_CONFIG[status] || { label: status || '—', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', icon: 'help-circle' };
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
                <RefreshControl refreshing={refreshing} onRefresh={() => loadRefunds(pagination.page, true)} colors={['#0ea5e9']} />
            }
        >
            <OfflineBanner offlineMeta={offlineMeta} />

            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Refund Management</Text>
                        <View style={styles.headerTag}>
                            <Text style={styles.headerTagText}>Multi-Party Flow</Text>
                        </View>
                    </View>
                    <Text style={styles.subtitle}>Create, track, and process patient refund requests</Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.newRefundBtn}
                        onPress={() => { setShowNewRefund(true); resetNewRefundForm(); }}
                    >
                        <Feather name="plus" size={15} color="#ffffff" />
                        <Text style={styles.newRefundBtnText}>New Request</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.refreshBtn}
                        onPress={() => loadRefunds(pagination.page, true)}
                        disabled={loading || refreshing}
                    >
                        <Feather name="refresh-cw" size={14} color="#0284c7" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
                {[
                    { key: 'all', label: 'All' },
                    { key: 'PENDING_APPROVAL', label: 'Pending' },
                    { key: 'APPROVED', label: 'Approved' },
                    { key: 'REFUNDED', label: 'Completed' },
                    { key: 'REJECTED', label: 'Rejected' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Refund List */}
            <View style={styles.card}>
                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0ea5e9" />
                        <Text style={styles.loadingText}>Loading refunds...</Text>
                    </View>
                ) : refunds.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={{ fontSize: 32, marginBottom: 8 }}>💸</Text>
                        <Text style={styles.emptyTitle}>No refund requests</Text>
                        <Text style={styles.emptySubtitle}>Click "New Request" to create a patient refund request</Text>
                    </View>
                ) : (
                    <>
                        <View style={{ gap: 10 }}>
                            {refunds.map(r => (
                                <View key={r._id} style={styles.refundCard}>
                                    <View style={styles.refundCardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <View style={styles.patientRow}>
                                                <Feather name="user" size={14} color="#0f172a" />
                                                <Text style={styles.patientName} numberOfLines={1}>
                                                    {r.patientName || '—'}
                                                </Text>
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

                                    {/* Reason if available */}
                                    {r.reason ? (
                                        <Text style={styles.reasonText} numberOfLines={2}>
                                            Reason: {r.reason}
                                        </Text>
                                    ) : null}

                                    {/* Footer details & Action */}
                                    <View style={styles.refundCardFooter}>
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
                                            <Text style={styles.metaLabel}>Requested At</Text>
                                            <Text style={styles.metaVal}>{formatDateTime(r.requestedAt)}</Text>
                                        </View>

                                        {/* Action Button */}
                                        <View style={{ alignSelf: 'center', marginLeft: 'auto' }}>
                                            {r.status === 'APPROVED' && ['UPI', 'BANK_TRANSFER'].includes(r.refundMode) && (
                                                <TouchableOpacity
                                                    style={styles.processActionBtn}
                                                    onPress={() => {
                                                        setProcessModal(r);
                                                        setProcessForm({ refundTransactionId: '', processingNotes: '' });
                                                        setProcessError(null);
                                                    }}
                                                >
                                                    <Feather name="check-circle" size={13} color="#ffffff" />
                                                    <Text style={styles.processActionBtnText}>Process Refund</Text>
                                                </TouchableOpacity>
                                            )}

                                            {r.status === 'APPROVED' && r.refundMode === 'CASH' && (
                                                <View style={styles.cashNoticeBadge}>
                                                    <Text style={styles.cashNoticeText}>⏳ Awaiting Reception</Text>
                                                </View>
                                            )}

                                            {r.status === 'REFUNDED' && (
                                                <View style={styles.completedBadge}>
                                                    <Text style={styles.completedBadgeText}>✓ Completed</Text>
                                                </View>
                                            )}
                                        </View>
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
                                    onPress={() => loadRefunds(pagination.page - 1)}
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
                                    onPress={() => loadRefunds(pagination.page + 1)}
                                >
                                    <Text style={[styles.pageBtnText, pagination.page >= pagination.totalPages && styles.pageBtnTextDisabled]}>Next</Text>
                                    <Feather name="chevron-right" size={16} color={pagination.page >= pagination.totalPages ? '#94a3b8' : '#0f172a'} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* ════ Modal 1: Create Refund Request ════ */}
            <Modal visible={showNewRefund} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <ScrollView style={styles.modalScroll} contentContainerStyle={{ padding: 18 }}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalTitle}>Create Refund Request</Text>
                            <TouchableOpacity onPress={() => setShowNewRefund(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {!selectedPatient ? (
                            <>
                                <Text style={styles.fieldLabel}>Search Patient</Text>
                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Phone / MRN / Patient ID..."
                                        placeholderTextColor="#94a3b8"
                                        value={patientSearch}
                                        onChangeText={setPatientSearch}
                                        onSubmitEditing={handlePatientSearch}
                                        returnKeyType="search"
                                    />
                                    <TouchableOpacity
                                        style={styles.searchActionBtn}
                                        onPress={handlePatientSearch}
                                        disabled={patientSearching}
                                    >
                                        {patientSearching ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <Feather name="search" size={16} color="#ffffff" />
                                        )}
                                    </TouchableOpacity>
                                </View>

                                {submitError && (
                                    <View style={styles.errorNotice}>
                                        <Text style={styles.errorNoticeText}>⚠️ {submitError}</Text>
                                    </View>
                                )}

                                {patientResults.length > 0 && (
                                    <View style={styles.resultsList}>
                                        {patientResults.map(p => (
                                            <TouchableOpacity
                                                key={p._id}
                                                style={styles.resultItem}
                                                onPress={() => handleSelectPatient(p)}
                                            >
                                                <View>
                                                    <Text style={styles.resultName}>{p.name}</Text>
                                                    <Text style={styles.resultMeta}>{p.phone || 'No phone'} • ID: {p.patientId || p.mrn || '—'}</Text>
                                                </View>
                                                <Feather name="chevron-right" size={16} color="#94a3b8" />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Selected Patient Banner */}
                                <View style={styles.selectedPatientBanner}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.selectedPatientName}>{selectedPatient.name}</Text>
                                        <Text style={styles.selectedPatientMeta}>
                                            {selectedPatient.patientId || selectedPatient.mrn || selectedPatient.phone}
                                        </Text>
                                    </View>
                                    <TouchableOpacity style={styles.changePatientBtn} onPress={resetNewRefundForm}>
                                        <Text style={styles.changePatientBtnText}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                {refundData && (
                                    <>
                                        {/* Financial Summary Card */}
                                        <View style={styles.financialSummaryBox}>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Total Paid</Text>
                                                <Text style={styles.summaryVal}>{formatCurrency(refundData.totalPaid)}</Text>
                                            </View>
                                            <View style={styles.summaryRow}>
                                                <Text style={styles.summaryLabel}>Already Refunded</Text>
                                                <Text style={styles.summaryVal}>{formatCurrency(refundData.alreadyRefunded)}</Text>
                                            </View>
                                            {refundData.pendingRefundAmount > 0 && (
                                                <View style={styles.summaryRow}>
                                                    <Text style={styles.summaryLabel}>Pending Approval</Text>
                                                    <Text style={[styles.summaryVal, { color: '#d97706' }]}>
                                                        {formatCurrency(refundData.pendingRefundAmount)}
                                                    </Text>
                                                </View>
                                            )}
                                            <View style={[styles.summaryRow, styles.summaryHighlightRow]}>
                                                <Text style={styles.maxRefundLabel}>Max Refundable Balance</Text>
                                                <Text style={styles.maxRefundVal}>{formatCurrency(refundData.refundableAmount)}</Text>
                                            </View>
                                        </View>

                                        {/* Quick Select From Past Payments */}
                                        {refundData.payments && refundData.payments.length > 0 && (
                                            <View style={{ marginTop: 12 }}>
                                                <Text style={styles.fieldLabel}>Quick Select From Recent Payments (Optional)</Text>
                                                <View style={{ gap: 6, maxHeight: 150 }}>
                                                    {refundData.payments.slice(0, 5).map(p => {
                                                        const isSelected = refundForm.originalPaymentId === p._id;
                                                        const mode = (p.paymentMode || 'Cash').toUpperCase();
                                                        return (
                                                            <TouchableOpacity
                                                                key={p._id}
                                                                style={[styles.quickPayItem, isSelected && styles.quickPayItemSelected]}
                                                                onPress={() => {
                                                                    const targetMode = mode.includes('UPI') ? 'UPI' : (mode.includes('BANK') || mode.includes('CARD') || mode.includes('ONLINE')) ? 'BANK_TRANSFER' : 'CASH';
                                                                    setRefundForm(f => ({
                                                                        ...f,
                                                                        originalPaymentId: isSelected ? '' : p._id,
                                                                        refundAmount: isSelected ? '' : String(Math.min(p.amount, refundData.refundableAmount)),
                                                                        refundMode: isSelected ? f.refundMode : targetMode
                                                                    }));
                                                                }}
                                                            >
                                                                <View style={{ flex: 1 }}>
                                                                    <Text style={styles.quickPayAmount}>{formatCurrency(p.amount)}</Text>
                                                                    <Text style={styles.quickPayMeta}>{p.paymentMode || 'Cash'} {p.transactionId ? `• #${p.transactionId}` : ''}</Text>
                                                                </View>
                                                                <Text style={[styles.quickPaySelectTag, isSelected && styles.quickPaySelectTagActive]}>
                                                                    {isSelected ? '✓ Selected' : 'Use'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        )}

                                        {refundData.refundableAmount <= 0 ? (
                                            <View style={styles.errorNotice}>
                                                <Text style={styles.errorNoticeText}>
                                                    No refundable amount available for this patient (all collected payments have already been refunded or are pending approval).
                                                </Text>
                                            </View>
                                        ) : (
                                            <>
                                                {/* Refund Amount Input */}
                                                <View style={{ marginTop: 12 }}>
                                                    <Text style={styles.fieldLabel}>Refund Amount (₹) *</Text>
                                                    <TextInput
                                                        style={styles.modalInput}
                                                        keyboardType="numeric"
                                                        value={refundForm.refundAmount}
                                                        onChangeText={val => setRefundForm(f => ({ ...f, refundAmount: val }))}
                                                        placeholder={`Max ₹${refundData.refundableAmount.toLocaleString()}`}
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                </View>

                                                {/* Refund Mode Buttons */}
                                                <View style={{ marginTop: 12 }}>
                                                    <Text style={styles.fieldLabel}>Refund Mode *</Text>
                                                    <View style={styles.modePickRow}>
                                                        {['CASH', 'UPI', 'BANK_TRANSFER'].map(m => (
                                                            <TouchableOpacity
                                                                key={m}
                                                                style={[styles.modePickBtn, refundForm.refundMode === m && styles.modePickBtnActive]}
                                                                onPress={() => setRefundForm(f => ({ ...f, refundMode: m }))}
                                                            >
                                                                <Text style={[styles.modePickBtnText, refundForm.refundMode === m && styles.modePickBtnTextActive]}>
                                                                    {m === 'BANK_TRANSFER' ? 'Bank Transfer' : m}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>

                                                {/* Reason Input */}
                                                <View style={{ marginTop: 12 }}>
                                                    <Text style={styles.fieldLabel}>Reason / Notes</Text>
                                                    <TextInput
                                                        style={[styles.modalInput, { height: 60, textAlignVertical: 'top' }]}
                                                        multiline
                                                        value={refundForm.reason}
                                                        onChangeText={val => setRefundForm(f => ({ ...f, reason: val }))}
                                                        placeholder="Clinical or billing reason for refund..."
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                </View>

                                                {submitError && (
                                                    <View style={[styles.errorNotice, { marginTop: 10 }]}>
                                                        <Text style={styles.errorNoticeText}>⚠️ {submitError}</Text>
                                                    </View>
                                                )}

                                                {/* Action Buttons */}
                                                <View style={styles.modalActionRow}>
                                                    <TouchableOpacity
                                                        style={styles.modalCancelBtn}
                                                        onPress={() => setShowNewRefund(false)}
                                                        disabled={submitting}
                                                    >
                                                        <Text style={styles.modalCancelBtnText}>Cancel</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={[styles.modalSubmitBtn, submitting && styles.btnDisabled]}
                                                        onPress={handleSubmitRefund}
                                                        disabled={submitting}
                                                    >
                                                        {submitting ? (
                                                            <>
                                                                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                                                <Text style={styles.modalSubmitBtnText}>Submitting...</Text>
                                                            </>
                                                        ) : (
                                                            <Text style={styles.modalSubmitBtnText}>Request Refund</Text>
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* ════ Modal 2: Process Refund (UPI / Bank) ════ */}
            {processModal && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle}>
                                    Process {processModal.refundMode === 'UPI' ? 'UPI' : 'Bank Transfer'} Refund
                                </Text>
                                <TouchableOpacity onPress={() => setProcessModal(null)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            {/* Summary */}
                            <View style={styles.financialSummaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Patient</Text>
                                    <Text style={styles.summaryVal}>{processModal.patientName}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>MRN</Text>
                                    <Text style={styles.summaryVal}>{processModal.patientMRN}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Refund Amount</Text>
                                    <Text style={[styles.summaryVal, { color: '#dc2626', fontWeight: '800' }]}>
                                        {formatCurrency(processModal.refundAmount)}
                                    </Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Mode</Text>
                                    <Text style={styles.summaryVal}>{processModal.refundMode}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Approved By</Text>
                                    <Text style={styles.summaryVal}>{processModal.approvedByName || 'Admin'}</Text>
                                </View>
                            </View>

                            {/* UTR Input */}
                            <View style={{ marginTop: 12 }}>
                                <Text style={styles.fieldLabel}>Transaction ID / UTR / Reference Number *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. 423512345678, UPI Ref..."
                                    placeholderTextColor="#94a3b8"
                                    value={processForm.refundTransactionId}
                                    onChangeText={val => setProcessForm(f => ({ ...f, refundTransactionId: val }))}
                                    editable={!processing}
                                />
                            </View>

                            {/* Processing Notes */}
                            <View style={{ marginTop: 10 }}>
                                <Text style={styles.fieldLabel}>Processing Notes (Optional)</Text>
                                <TextInput
                                    style={[styles.modalInput, { height: 50, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Optional notes or bank account reference..."
                                    placeholderTextColor="#94a3b8"
                                    value={processForm.processingNotes}
                                    onChangeText={val => setProcessForm(f => ({ ...f, processingNotes: val }))}
                                    editable={!processing}
                                />
                            </View>

                            {processError && (
                                <View style={[styles.errorNotice, { marginTop: 10 }]}>
                                    <Text style={styles.errorNoticeText}>⚠️ {processError}</Text>
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setProcessModal(null)}
                                    disabled={processing}
                                >
                                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modalProcessBtn, processing && styles.btnDisabled]}
                                    onPress={handleProcessRefund}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <>
                                            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                            <Text style={styles.modalProcessBtnText}>Processing...</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.modalProcessBtnText}>Mark Refunded</Text>
                                    )}
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
    headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    newRefundBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0284c7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8
    },
    newRefundBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
    refreshBtn: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        padding: 8,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    tabsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 14
    },
    tabBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    tabBtnActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7'
    },
    tabBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
    tabBtnTextActive: { color: '#ffffff', fontWeight: '700' },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 14
    },
    loadingContainer: { padding: 30, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 10, fontSize: 13, color: '#64748b' },
    emptyContainer: { padding: 30, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    emptySubtitle: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
    refundCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12
    },
    refundCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    patientRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patientName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    mrnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    mrnText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    amountText: { fontSize: 15, fontWeight: '800', color: '#dc2626' },
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
    reasonText: {
        fontSize: 12,
        color: '#475569',
        backgroundColor: '#f8fafc',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginVertical: 8
    },
    refundCardFooter: {
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
    processActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#059669',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6
    },
    processActionBtnText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },
    cashNoticeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#fffbeb',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#fde68a'
    },
    cashNoticeText: { fontSize: 11, fontWeight: '600', color: '#d97706' },
    completedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#f0fdf4',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#bbf7d0'
    },
    completedBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
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
        maxWidth: 500,
        maxHeight: '90%'
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        width: '100%',
        maxWidth: 480
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4
    },
    searchInput: { flex: 1, fontSize: 13, color: '#0f172a', paddingVertical: 6 },
    searchActionBtn: {
        backgroundColor: '#0284c7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        marginLeft: 6
    },
    resultsList: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        maxHeight: 180
    },
    resultItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    resultName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    resultMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
    selectedPatientBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12
    },
    selectedPatientName: { fontSize: 14, fontWeight: '700', color: '#0369a1' },
    selectedPatientMeta: { fontSize: 11, color: '#0284c7', marginTop: 2 },
    changePatientBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 6
    },
    changePatientBtnText: { fontSize: 11, fontWeight: '700', color: '#0284c7' },
    financialSummaryBox: {
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
    summaryHighlightRow: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
        marginTop: 4
    },
    summaryLabel: { fontSize: 12, color: '#64748b' },
    summaryVal: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
    maxRefundLabel: { fontSize: 12, fontWeight: '700', color: '#047857' },
    maxRefundVal: { fontSize: 14, fontWeight: '800', color: '#047857' },
    quickPayItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc'
    },
    quickPayItemSelected: {
        borderColor: '#059669',
        backgroundColor: '#ecfdf5'
    },
    quickPayAmount: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    quickPayMeta: { fontSize: 10, color: '#64748b' },
    quickPaySelectTag: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    quickPaySelectTagActive: { color: '#059669', fontWeight: '700' },
    modalInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff'
    },
    modePickRow: { flexDirection: 'row', gap: 8 },
    modePickBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1'
    },
    modePickBtnActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7'
    },
    modePickBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
    modePickBtnTextActive: { color: '#ffffff', fontWeight: '700' },
    errorNotice: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 6,
        padding: 8
    },
    errorNoticeText: { fontSize: 12, color: '#b91c1c' },
    modalActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16
    },
    modalCancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 8
    },
    modalCancelBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    modalSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#0284c7',
        borderRadius: 8
    },
    modalSubmitBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
    modalProcessBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#059669',
        borderRadius: 8
    },
    modalProcessBtnText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
    btnDisabled: { opacity: 0.6 }
});

export default AccountantRefunds;
