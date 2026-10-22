import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Modal,
    StyleSheet,
    useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { releaseAPI } from '../../utils/api';

export default function CentralAdminReleaseConsole({ onBack }) {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const canGoBack = Boolean(onBack || (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()));
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
            navigation.goBack();
        } else if (navigation && typeof navigation.navigate === 'function') {
            navigation.navigate('CentralAdminDashboard');
        }
    };

    const [releases, setReleases] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dispatch Modal State
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [dispatchForm, setDispatchForm] = useState({
        channel: 'production',
        targetRuntimeVersion: 'current',
        targetCommitSha: '',
        message: 'Automated Clinical Release',
        releaseNotes: '',
    });

    // Rollback Modal State
    const [showRollbackModal, setShowRollbackModal] = useState(false);
    const [rollingBack, setRollingBack] = useState(false);
    const [selectedRollbackRelease, setSelectedRollbackRelease] = useState(null);
    const [rollbackReason, setRollbackReason] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [relRes, metRes] = await Promise.all([
                releaseAPI.getReleases({ limit: 50 }).catch((err) => {
                    const status = err?.response?.status;
                    if (status === 401 || status === 403) {
                        throw new Error('Unauthorized: Super Admin credentials required to access release catalog.');
                    }
                    if (err?.code === 'ERR_NETWORK' || !err?.response) {
                        throw new Error('Network error: Unable to reach release management service.');
                    }
                    throw err;
                }),
                releaseAPI.getMetrics().catch((err) => {
                    const status = err?.response?.status;
                    if (status === 401 || status === 403) {
                        return { metrics: null };
                    }
                    return { metrics: null };
                }),
            ]);
            setReleases(relRes?.releases || []);
            setMetrics(metRes?.metrics || null);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load releases');
        } finally {
            setLoading(false);
        }
    };

    const handleDispatchOta = async () => {
        if (!dispatchForm.channel) {
            setError('Update channel is required');
            return;
        }
        setDispatching(true);
        setError('');
        setSuccess('');
        try {
            const res = await releaseAPI.dispatchOta(dispatchForm);
            if (res && res.success) {
                setSuccess(`OTA release successfully dispatched for channel "${dispatchForm.channel}"! Correlation ID: ${res.releaseId}`);
                setShowDispatchModal(false);
                setDispatchForm({
                    channel: 'production',
                    targetRuntimeVersion: 'current',
                    targetCommitSha: '',
                    message: 'Automated Clinical Release',
                    releaseNotes: '',
                });
                await loadData();
            } else {
                setError(res?.message || 'Dispatch failed');
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                setError('Unauthorized: Only Super Admin can dispatch OTA releases.');
            } else {
                setError(err?.response?.data?.message || err?.message || 'Failed to dispatch OTA update');
            }
        } finally {
            setDispatching(false);
        }
    };

    const handleConfirmRollback = async () => {
        if (!selectedRollbackRelease || !selectedRollbackRelease.releaseId) {
            setError('Target release ID is required for rollback');
            return;
        }
        setRollingBack(true);
        setError('');
        setSuccess('');
        try {
            const res = await releaseAPI.rollback({
                targetReleaseId: selectedRollbackRelease.releaseId,
                channel: selectedRollbackRelease.channel || 'production',
                reason: rollbackReason || 'Emergency rollback from Super Admin console',
            });
            if (res && res.success) {
                setSuccess(`Emergency rollback initiated! Rollback ID: ${res.rollbackReleaseId}`);
                setShowRollbackModal(false);
                setSelectedRollbackRelease(null);
                setRollbackReason('');
                await loadData();
            } else {
                setError(res?.message || 'Rollback failed');
            }
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                setError('Unauthorized: Only Super Admin can execute emergency rollbacks.');
            } else {
                setError(err?.response?.data?.message || err?.message || 'Failed to execute rollback');
            }
        } finally {
            setRollingBack(false);
        }
    };

    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'COMPLETED':
                return { bg: '#ccfbf1', text: '#0f766e' };
            case 'BUILDING':
            case 'PROCESSING':
            case 'DISPATCHED':
                return { bg: '#e0f2fe', text: '#0369a1' };
            case 'FAILED':
                return { bg: '#fee2e2', text: '#b91c1c' };
            case 'ROLLED_BACK':
                return { bg: '#fef3c7', text: '#b45309' };
            default:
                return { bg: '#f1f5f9', text: '#475569' };
        }
    };

    return (
        <View style={styles.container}>
            {canGoBack && (
                <TouchableOpacity style={styles.btnBack} onPress={handleBack}>
                    <Text style={styles.btnBackText}>← Back to Dashboard</Text>
                </TouchableOpacity>
            )}

            {/* Header & Actions */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1, minWidth: 240 }}>
                    <Text style={styles.consoleTitle}>Release Management Console</Text>
                    <Text style={styles.consoleSubtitle}>
                        Orchestrate native APK releases, EAS OTA cohorts, and emergency rollbacks.
                    </Text>
                </View>
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={loadData} disabled={loading}>
                        <Text style={styles.btnSecondaryText}>{loading ? 'Refreshing...' : 'Refresh'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btnSecondary, { borderColor: '#f59e0b', borderWidth: 1.5, backgroundColor: '#fffbeb' }]}
                        onPress={() => {
                            const latestCompleted = releases.find(r => r.status === 'COMPLETED' && (r.type === 'OTA_UPDATE' || r.type === 'OTA')) || releases[0];
                            if (latestCompleted) {
                                setSelectedRollbackRelease({ ...latestCompleted });
                            } else {
                                setSelectedRollbackRelease({ releaseId: '', channel: 'production', runtimeVersion: '1.0.0' });
                            }
                            setShowRollbackModal(true);
                        }}
                    >
                        <Text style={[styles.btnSecondaryText, { color: '#b45309', fontWeight: '700' }]}>⚠️ Emergency Rollback</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowDispatchModal(true)}>
                        <Text style={styles.btnPrimaryText}>🚀 Dispatch OTA Update</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Notifications */}
            {Boolean(error) && (
                <View style={styles.alertError}>
                    <Text style={styles.alertErrorText}>{error}</Text>
                </View>
            )}
            {Boolean(success) && (
                <View style={styles.alertSuccess}>
                    <Text style={styles.alertSuccessText}>{success}</Text>
                </View>
            )}

            {/* Telemetry Metrics Cards */}
            <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Total Releases</Text>
                    <Text style={styles.metricValue}>{metrics?.totalReleases ?? releases.length}</Text>
                </View>
                <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Active Cohorts</Text>
                    <Text style={styles.metricValue}>{metrics?.activeCohorts?.join(', ') || '1.0.0'}</Text>
                </View>
                <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Completed OTA Updates</Text>
                    <Text style={styles.metricValue}>{metrics?.completedOta ?? 0}</Text>
                </View>
                <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Total Downloads</Text>
                    <Text style={styles.metricValue}>{metrics?.totalDownloads ?? 0}</Text>
                </View>
            </View>

            {/* Releases Catalog Table */}
            <View style={styles.tableCard}>
                <Text style={styles.tableTitle}>Release History & Active Deployments</Text>
                {loading && releases.length === 0 ? (
                    <ActivityIndicator size="large" color="#0d9488" style={{ padding: 32 }} />
                ) : releases.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No release records found. Dispatched builds and OTA updates will appear here.</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                        <View style={{ minWidth: 850 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHCell, { width: 140 }]}>RELEASE ID</Text>
                                <Text style={[styles.tableHCell, { width: 90 }]}>TYPE</Text>
                                <Text style={[styles.tableHCell, { width: 100 }]}>CHANNEL</Text>
                                <Text style={[styles.tableHCell, { width: 90 }]}>RUNTIME</Text>
                                <Text style={[styles.tableHCell, { width: 110 }]}>STATUS</Text>
                                <Text style={[styles.tableHCell, { width: 140 }]}>TIMESTAMP</Text>
                                <Text style={[styles.tableHCell, { width: 110 }]}>ACTION</Text>
                            </View>
                            {releases.map((rel, idx) => {
                                const badge = getStatusBadgeStyle(rel.status);
                                return (
                                    <View key={rel.releaseId || idx} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 140, fontWeight: '600' }]} numberOfLines={1}>
                                            {rel.releaseId || 'N/A'}
                                        </Text>
                                        <View style={{ width: 90 }}>
                                            <Text style={styles.badgeType}>{rel.type || 'OTA'}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, { width: 100 }]}>{rel.channel || 'production'}</Text>
                                        <Text style={[styles.tableCell, { width: 90 }]}>{rel.runtimeVersion || '1.0.0'}</Text>
                                        <View style={{ width: 110 }}>
                                            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                                                <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                                                    {rel.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.tableCell, { width: 140, color: '#64748b', fontSize: 12 }]}>
                                            {rel.createdAt ? new Date(rel.createdAt).toLocaleString() : 'Recent'}
                                        </Text>
                                        <View style={{ width: 110 }}>
                                            {rel.status === 'COMPLETED' && rel.type === 'OTA_UPDATE' ? (
                                                <TouchableOpacity
                                                    style={styles.btnRollback}
                                                    onPress={() => {
                                                        setSelectedRollbackRelease(rel);
                                                        setShowRollbackModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.btnRollbackText}>Rollback</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>—</Text>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </View>

            {/* Modal: Dispatch OTA Release */}
            <Modal visible={showDispatchModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Dispatch OTA Release</Text>
                        <Text style={styles.modalSub}>
                            Publishes an immutable, tenant-neutral JavaScript update across targeted runtime cohorts.
                        </Text>

                        <Text style={styles.inputLabel}>Target Channel</Text>
                        <TextInput
                            style={styles.textInput}
                            value={dispatchForm.channel}
                            onChangeText={(t) => setDispatchForm(prev => ({ ...prev, channel: t }))}
                            placeholder="production, preview, staging"
                        />

                        <Text style={styles.inputLabel}>Target Runtime Version Cohort</Text>
                        <TextInput
                            style={styles.textInput}
                            value={dispatchForm.targetRuntimeVersion}
                            onChangeText={(t) => setDispatchForm(prev => ({ ...prev, targetRuntimeVersion: t }))}
                            placeholder="current, or semver e.g. 1.0.0"
                        />

                        <Text style={styles.inputLabel}>Approved Git Commit SHA (Optional)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={dispatchForm.targetCommitSha}
                            onChangeText={(t) => setDispatchForm(prev => ({ ...prev, targetCommitSha: t }))}
                            placeholder="Leave empty for current HEAD"
                        />

                        <Text style={styles.inputLabel}>Release Message & Clinical Notes</Text>
                        <TextInput
                            style={[styles.textInput, { height: 70 }]}
                            value={dispatchForm.releaseNotes}
                            onChangeText={(t) => setDispatchForm(prev => ({ ...prev, releaseNotes: t }))}
                            placeholder="Summary of bug fixes, features, or schema additions"
                            multiline
                        />

                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setShowDispatchModal(false)}
                                disabled={dispatching}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnPrimary}
                                onPress={handleDispatchOta}
                                disabled={dispatching}
                            >
                                <Text style={styles.btnPrimaryText}>{dispatching ? 'Dispatching...' : 'Dispatch Now'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal: Emergency Rollback */}
            <Modal visible={showRollbackModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderColor: '#f59e0b', borderWidth: 1 }]}>
                        <Text style={[styles.modalTitle, { color: '#b45309' }]}>Emergency Rollback Confirmation</Text>
                        <Text style={styles.modalSub}>
                            This action will supersede active channel updates by republishing verified code from:
                        </Text>
                        <View style={{ backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginVertical: 12 }}>
                            <Text style={{ fontWeight: '700', color: '#92400e' }}>
                                Release ID: {selectedRollbackRelease?.releaseId || '(Enter target release ID below)'}
                            </Text>
                            <Text style={{ color: '#b45309', fontSize: 13, marginTop: 4 }}>
                                Target Runtime: {selectedRollbackRelease?.runtimeVersion || '1.0.0'} | Channel: {selectedRollbackRelease?.channel || 'production'}
                            </Text>
                        </View>

                        <Text style={styles.inputLabel}>Target Release ID</Text>
                        <TextInput
                            style={styles.textInput}
                            value={selectedRollbackRelease?.releaseId || ''}
                            onChangeText={(t) => setSelectedRollbackRelease(prev => ({ ...(prev || {}), releaseId: t }))}
                            placeholder="Enter Release ID e.g. rel-xxx"
                        />

                        <Text style={styles.inputLabel}>Target Channel</Text>
                        <TextInput
                            style={styles.textInput}
                            value={selectedRollbackRelease?.channel || 'production'}
                            onChangeText={(t) => setSelectedRollbackRelease(prev => ({ ...(prev || {}), channel: t }))}
                            placeholder="production, preview, staging"
                        />

                        <Text style={styles.inputLabel}>Rollback Reason (Audit Log)</Text>
                        <TextInput
                            style={styles.textInput}
                            value={rollbackReason}
                            onChangeText={setRollbackReason}
                            placeholder="Describe defect or regression requiring rollback"
                        />

                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setShowRollbackModal(false)}
                                disabled={rollingBack}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: '#b45309' }]}
                                onPress={handleConfirmRollback}
                                disabled={rollingBack}
                            >
                                <Text style={styles.btnPrimaryText}>{rollingBack ? 'Executing...' : 'Confirm Rollback'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginTop: 20,
    },
    btnBack: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    btnBackText: {
        color: '#2563eb',
        fontSize: 13,
        fontWeight: '600',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    consoleTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
    },
    consoleSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    btnPrimary: {
        backgroundColor: '#0d9488',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    btnSecondary: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14,
    },
    alertError: {
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    alertErrorText: {
        color: '#b91c1c',
        fontSize: 14,
    },
    alertSuccess: {
        backgroundColor: '#ccfbf1',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    alertSuccessText: {
        color: '#0f766e',
        fontSize: 14,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    metricCard: {
        flex: 1,
        minWidth: 160,
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    metricLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    metricValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 8,
    },
    tableCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
    },
    tableTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    tableHCell: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tableCell: {
        fontSize: 13,
        color: '#1e293b',
    },
    badgeType: {
        backgroundColor: '#f1f5f9',
        color: '#475569',
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    btnRollback: {
        backgroundColor: '#fef3c7',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    btnRollbackText: {
        color: '#b45309',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748b',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 520,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
    },
    modalSub: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
        marginTop: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        backgroundColor: '#f8fafc',
    },
    modalBtnRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
    },
});
