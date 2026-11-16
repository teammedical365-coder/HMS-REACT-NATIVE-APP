import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { hospitalAPI } from '../../utils/api';

const NabhAccreditationModal = ({ hospital, onClose, onUpdated }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [enabled, setEnabled] = useState(hospital?.accreditation?.enabled === true);
    const [certNo, setCertNo] = useState(hospital?.accreditation?.certNo || '');
    const [meta, setMeta] = useState({
        updatedByName: hospital?.accreditation?.updatedByName || '',
        updatedAt: hospital?.accreditation?.updatedAt || null
    });
    const [auditTrail, setAuditTrail] = useState([]);

    useEffect(() => {
        if (!hospital?._id) return;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await hospitalAPI.getNabhStatus(hospital._id);
                if (!cancelled && res?.success && res.nabh) {
                    setEnabled(res.nabh.enabled === true);
                    setCertNo(res.nabh.certNo || '');
                    setMeta({
                        updatedByName: res.nabh.updatedByName || '',
                        updatedAt: res.nabh.updatedAt || null
                    });
                    setAuditTrail(Array.isArray(res.nabh.auditTrail) ? [...res.nabh.auditTrail].reverse() : []);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.response?.data?.message || 'Failed to load NABH status');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [hospital?._id]);

    const handleSave = async () => {
        if (!hospital?._id) return;
        setSaving(true);
        setError('');
        try {
            const res = await hospitalAPI.updateNabhStatus(hospital._id, {
                enabled: Boolean(enabled),
                certNo: certNo.trim()
            });
            if (res?.success) {
                Alert.alert('Success', res.message || `NABH accreditation ${enabled ? 'activated' : 'deactivated'} for ${hospital.name}`);
                if (typeof onUpdated === 'function') {
                    onUpdated(res);
                }
                onClose();
            } else {
                setError(res?.message || 'Failed to update NABH status');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error updating NABH status');
        } finally {
            setSaving(false);
        }
    };

    const formatTs = (val) => {
        if (!val) return '—';
        const d = new Date(val);
        return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN');
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons name="certificate" size={22} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>NABH Accreditation Control</Text>
                                <Text style={styles.subtitle} numberOfLines={1}>
                                    Hospital: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{hospital?.branding?.appName || hospital?.name}</Text>
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Feather name="x" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color="#059669" />
                            <Text style={styles.loadingText}>Loading accreditation status...</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
                            {error ? (
                                <View style={styles.errorBox}>
                                    <Feather name="alert-triangle" size={14} color="#dc2626" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Accreditation Toggle */}
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.switchLabel}>NABH Accreditation Active</Text>
                                    <Text style={styles.switchHint}>
                                        Enables the NABH certification badge across patient documents, TPR charts, and web/mobile portals.
                                    </Text>
                                </View>
                                <Switch
                                    value={enabled}
                                    onValueChange={setEnabled}
                                    trackColor={{ false: '#cbd5e1', true: '#a7f3d0' }}
                                    thumbColor={enabled ? '#059669' : '#f1f5f9'}
                                />
                            </View>

                            {/* Certificate Number */}
                            <View style={styles.formGroup}>
                                <Text style={styles.inputLabel}>Certificate / Accreditation Number</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g. NABH-HOSP-2026-9842"
                                    placeholderTextColor="#94a3b8"
                                    value={certNo}
                                    onChangeText={setCertNo}
                                />
                                <Text style={styles.inputHint}>
                                    Official NABH reference code to be displayed on hospital stationery and clinical reports.
                                </Text>
                            </View>

                            {/* Last Updated Meta */}
                            {meta.updatedAt && (
                                <View style={styles.metaBox}>
                                    <Feather name="info" size={13} color="#0d9488" />
                                    <Text style={styles.metaText}>
                                        Last modified by <Text style={{ fontWeight: '700' }}>{meta.updatedByName || 'Central Admin'}</Text> on {formatTs(meta.updatedAt)}
                                    </Text>
                                </View>
                            )}

                            {/* Audit Trail */}
                            <View style={styles.auditSection}>
                                <Text style={styles.auditHeading}>📜 Audit History ({auditTrail.length})</Text>
                                {auditTrail.length === 0 ? (
                                    <Text style={styles.emptyAuditText}>No previous status changes logged.</Text>
                                ) : (
                                    auditTrail.slice(0, 5).map((log, idx) => (
                                        <View key={idx} style={styles.auditCard}>
                                            <View style={styles.auditCardTop}>
                                                <Text style={styles.auditAction}>
                                                    {log.action || (log.enabled ? 'Accreditation Activated' : 'Accreditation Deactivated')}
                                                </Text>
                                                <Text style={styles.auditTime}>{formatTs(log.timestamp || log.createdAt)}</Text>
                                            </View>
                                            <Text style={styles.auditUser}>
                                                By: <Text style={{ fontWeight: '600' }}>{log.updatedByName || 'Admin'}</Text>
                                                {log.certNo ? ` • Cert: ${log.certNo}` : ''}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    )}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.disabledBtn]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Accreditation</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    content: {
        width: '100%',
        maxWidth: 520,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    iconCircle: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#ecfdf5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    closeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    centerBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: '#64748b',
    },
    body: {
        padding: 20,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 10,
        marginBottom: 14,
        gap: 8,
    },
    errorText: {
        fontSize: 12,
        color: '#dc2626',
        flex: 1,
        fontWeight: '600',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
    },
    switchLabel: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    switchHint: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        lineHeight: 16,
    },
    formGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    textInput: {
        height: 44,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 13.5,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    inputHint: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
    },
    metaBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderRadius: 8,
        padding: 10,
        marginBottom: 16,
        gap: 6,
    },
    metaText: {
        fontSize: 11.5,
        color: '#0f766e',
        flex: 1,
    },
    auditSection: {
        marginTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 14,
    },
    auditHeading: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
    },
    emptyAuditText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    auditCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        marginBottom: 8,
    },
    auditCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    auditAction: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    auditTime: {
        fontSize: 10.5,
        color: '#64748b',
    },
    auditUser: {
        fontSize: 11,
        color: '#475569',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 10,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#475569',
    },
    saveBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#059669',
    },
    saveBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ffffff',
    },
    disabledBtn: {
        opacity: 0.5,
    },
});

export default NabhAccreditationModal;

