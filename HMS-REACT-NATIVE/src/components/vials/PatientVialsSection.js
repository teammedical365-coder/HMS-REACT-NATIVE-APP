import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    useWindowDimensions
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vialAPI } from '../../utils/api';

const VIAL_TYPES = [
    'Biological Sample',
    'Specimen',
    'Laboratory Sample',
    'Medication',
    'Reagent',
    'Cryogenic Sample',
    'Other'
];

export default function PatientVialsSection({ patientId, patientData }) {
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [vials, setVials] = useState([]);
    const [stats, setStats] = useState({
        totalVials: 0,
        currentlyStored: 0,
        retrievedCount: 0,
        discardedCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modals
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [activeVial, setActiveVial] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Store Form State
    const [storeForm, setStoreForm] = useState({
        vialId: '',
        vialType: 'Biological Sample',
        description: '',
        receivedAt: new Date().toISOString().slice(0, 16),
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        notes: '',
        initialStatus: 'Stored'
    });

    const fetchPatientVials = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await vialAPI.getPatientVials(patientId);
            if (res.success) {
                setVials(res.vials || []);
                if (res.stats) {
                    setStats(res.stats);
                }
            } else {
                setError(res.message || 'Unable to load vial information.');
            }
        } catch (err) {
            console.error('Error fetching patient vials:', err);
            setError(err?.response?.data?.message || 'Unable to load vial information.');
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchPatientVials();
    }, [fetchPatientVials]);

    const handleOpenStore = () => {
        setStoreForm({
            vialId: '',
            vialType: 'Biological Sample',
            description: '',
            receivedAt: new Date().toISOString().slice(0, 16),
            room: '',
            storageUnit: '',
            rack: '',
            box: '',
            position: '',
            notes: '',
            initialStatus: 'Stored'
        });
        setShowStoreModal(true);
    };

    const handleStoreSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                patientId,
                vialId: storeForm.vialId.trim() || undefined,
                vialType: storeForm.vialType,
                description: storeForm.description,
                receivedAt: storeForm.receivedAt,
                initialStatus: storeForm.initialStatus,
                notes: storeForm.notes,
                currentLocation: {
                    room: storeForm.room.trim(),
                    storageUnit: storeForm.storageUnit.trim(),
                    rack: storeForm.rack.trim(),
                    box: storeForm.box.trim(),
                    position: storeForm.position.trim()
                }
            };

            const res = await vialAPI.create(payload);
            if (res.success) {
                Alert.alert('Success', res.message || 'Vial stored successfully');
                setShowStoreModal(false);
                fetchPatientVials();
            } else {
                Alert.alert('Error', res.message || 'Failed to store vial');
            }
        } catch (err) {
            console.error('Store vial error:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Error registering vial');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenDetails = async (vial) => {
        try {
            const res = await vialAPI.getById(vial._id || vial.id);
            if (res.success && res.vial) {
                setActiveVial(res.vial);
                setShowDetailsModal(true);
            } else {
                Alert.alert('Error', 'Failed to load vial details');
            }
        } catch (err) {
            Alert.alert('Error', 'Error fetching vial details');
        }
    };

    const formatLocation = (loc) => {
        if (!loc || (!loc.storageUnit && !loc.room)) return 'Not assigned';
        const parts = [];
        if (loc.room) parts.push(`Room: ${loc.room}`);
        if (loc.storageUnit) parts.push(`Unit: ${loc.storageUnit}`);
        if (loc.rack) parts.push(`Rack ${loc.rack}`);
        if (loc.box) parts.push(`Box ${loc.box}`);
        if (loc.position) parts.push(`Pos ${loc.position}`);
        return parts.join(' → ');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const getStatusStyle = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'stored') return { bg: '#dcfce7', text: '#15803d', icon: 'check-circle' };
        if (s === 'retrieved') return { bg: '#e0e7ff', text: '#4338ca', icon: 'arrow-right-circle' };
        if (s === 'discarded') return { bg: '#fee2e2', text: '#b91c1c', icon: 'x-circle' };
        return { bg: '#f1f5f9', text: '#475569', icon: 'clock' };
    };

    const storedVials = vials.filter((v) => (v.currentStatus || '').toLowerCase() === 'stored');

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <FontAwesome5 name="vial" size={18} color="#6366f1" style={{ marginRight: 8 }} />
                        <Text style={styles.headerTitle}>Sample & Vial Storage</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>Cryogenic and laboratory specimen location tracking</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.btnRefresh} onPress={fetchPatientVials}>
                        <Feather name="refresh-cw" size={16} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnStore} onPress={handleOpenStore}>
                        <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnStoreText}>Register Vial</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Error banner */}
            {error ? (
                <View style={styles.errorBox}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : null}

            {/* Stat Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: '#6366f1' }]}>
                    <Text style={styles.statLabel}>Total Samples</Text>
                    <Text style={styles.statValue}>{stats.totalVials || vials.length}</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
                    <Text style={styles.statLabel}>Currently Stored</Text>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.currentlyStored || storedVials.length}</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                    <Text style={styles.statLabel}>Retrieved</Text>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.retrievedCount || 0}</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
                    <Text style={styles.statLabel}>Discarded</Text>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.discardedCount || 0}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#6366f1" />
                    <Text style={styles.loadingText}>Loading specimen records...</Text>
                </View>
            ) : vials.length === 0 ? (
                <View style={styles.emptyBox}>
                    <FontAwesome5 name="box-open" size={36} color="#94a3b8" style={{ marginBottom: 10 }} />
                    <Text style={styles.emptyTitle}>No specimen vials on record</Text>
                    <Text style={styles.emptySubtitle}>Register laboratory samples, blood vials, or biopsy specimens for cold-chain tracking.</Text>
                    <TouchableOpacity style={[styles.btnStore, { marginTop: 12 }]} onPress={handleOpenStore}>
                        <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnStoreText}>Register First Vial</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* Stored Vials Grid */}
                    {storedVials.length > 0 && (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>Active Storage Locations ({storedVials.length})</Text>
                            <View style={styles.locationsGrid}>
                                {storedVials.map((vial) => {
                                    const st = getStatusStyle(vial.currentStatus);
                                    return (
                                        <View key={vial._id || vial.id} style={styles.locCard}>
                                            <View style={styles.locCardTop}>
                                                <Text style={styles.vialIdText}>{vial.vialId || 'Vial'}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: st.text }]}>{vial.currentStatus || 'Stored'}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.vialType}>{vial.vialType || 'Biological Sample'}</Text>
                                            <View style={styles.locPathBox}>
                                                <Feather name="map-pin" size={13} color="#0284c7" style={{ marginRight: 6 }} />
                                                <Text style={styles.locPathText} numberOfLines={2}>{formatLocation(vial.currentLocation)}</Text>
                                            </View>
                                            <TouchableOpacity style={styles.btnViewDetails} onPress={() => handleOpenDetails(vial)}>
                                                <Text style={styles.btnViewDetailsText}>View Details & History</Text>
                                                <Feather name="chevron-right" size={14} color="#6366f1" />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* All Associated Vials List */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>All Associated Specimens ({vials.length})</Text>
                        {vials.map((vial, idx) => {
                            const st = getStatusStyle(vial.currentStatus);
                            return (
                                <View key={vial._id || idx} style={styles.vialRow}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={styles.vialRowId}>{vial.vialId || 'Sample'}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: st.bg, marginLeft: 8 }]}>
                                                <Text style={[styles.statusBadgeText, { color: st.text }]}>{vial.currentStatus}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.vialRowSub}>{vial.vialType} • Received: {formatDate(vial.receivedAt || vial.createdAt)}</Text>
                                        <Text style={styles.vialRowLoc}>📍 {formatLocation(vial.currentLocation)}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.btnActionSm} onPress={() => handleOpenDetails(vial)}>
                                        <Feather name="eye" size={16} color="#6366f1" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                </>
            )}

            {/* Modal: Register / Store Vial */}
            <Modal visible={showStoreModal} transparent animationType="slide" onRequestClose={() => setShowStoreModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Register & Store Sample</Text>
                            <TouchableOpacity onPress={() => setShowStoreModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            <Text style={styles.inputLabel}>Vial Barcode / Unique ID</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. VIAL-2026-001 (auto-assigned if blank)"
                                value={storeForm.vialId}
                                onChangeText={(val) => setStoreForm({ ...storeForm, vialId: val })}
                            />

                            <Text style={styles.inputLabel}>Sample Type</Text>
                            <View style={styles.pickerBox}>
                                <Picker
                                    selectedValue={storeForm.vialType}
                                    onValueChange={(val) => setStoreForm({ ...storeForm, vialType: val })}
                                    style={{ height: 44 }}
                                >
                                    {VIAL_TYPES.map((t) => (
                                        <Picker.Item key={t} label={t} value={t} />
                                    ))}
                                </Picker>
                            </View>

                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Blood EDTA, Biopsy tissue, Serum, etc."
                                value={storeForm.description}
                                onChangeText={(val) => setStoreForm({ ...storeForm, description: val })}
                            />

                            <Text style={[styles.sectionSubtitleHeader, { marginTop: 12 }]}>Storage Location</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Room / Lab</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Room 102"
                                        value={storeForm.room}
                                        onChangeText={(val) => setStoreForm({ ...storeForm, room: val })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Storage Unit</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Freezer A"
                                        value={storeForm.storageUnit}
                                        onChangeText={(val) => setStoreForm({ ...storeForm, storageUnit: val })}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Rack</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Rack 2"
                                        value={storeForm.rack}
                                        onChangeText={(val) => setStoreForm({ ...storeForm, rack: val })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Box</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Box 4"
                                        value={storeForm.box}
                                        onChangeText={(val) => setStoreForm({ ...storeForm, box: val })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Position / Slot</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="A12"
                                        value={storeForm.position}
                                        onChangeText={(val) => setStoreForm({ ...storeForm, position: val })}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Notes</Text>
                            <TextInput
                                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                placeholder="Storage instructions, temperature, precautions..."
                                value={storeForm.notes}
                                multiline
                                onChangeText={(val) => setStoreForm({ ...storeForm, notes: val })}
                            />

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity style={styles.btnCancel} onPress={() => setShowStoreModal(false)}>
                                    <Text style={styles.btnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSubmit} onPress={handleStoreSubmit} disabled={submitting}>
                                    <Text style={styles.btnSubmitText}>{submitting ? 'Registering...' : 'Save & Store'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal: Vial Details & Movement History */}
            <Modal visible={showDetailsModal} transparent animationType="slide" onRequestClose={() => setShowDetailsModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Specimen Details & Audit</Text>
                            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {activeVial && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <View style={styles.detailHeaderCard}>
                                    <Text style={styles.detailVialId}>{activeVial.vialId || 'Specimen'}</Text>
                                    <Text style={styles.detailVialType}>{activeVial.vialType}</Text>
                                    <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginTop: 6, backgroundColor: getStatusStyle(activeVial.currentStatus).bg }]}>
                                        <Text style={[styles.statusBadgeText, { color: getStatusStyle(activeVial.currentStatus).text }]}>
                                            Status: {activeVial.currentStatus}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={[styles.sectionSubtitleHeader, { marginTop: 14 }]}>Current Physical Location</Text>
                                <View style={styles.locBoxDetail}>
                                    <Text style={styles.locBoxDetailText}>{formatLocation(activeVial.currentLocation)}</Text>
                                </View>

                                {activeVial.description ? (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={styles.detailLabel}>Description</Text>
                                        <Text style={styles.detailVal}>{activeVial.description}</Text>
                                    </View>
                                ) : null}

                                <Text style={[styles.sectionSubtitleHeader, { marginTop: 16 }]}>Movement & Audit History</Text>
                                {(!activeVial.history || activeVial.history.length === 0) ? (
                                    <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>No movement history recorded.</Text>
                                ) : (
                                    <View style={styles.historyList}>
                                        {activeVial.history.map((h, i) => (
                                            <View key={i} style={styles.historyItem}>
                                                <View style={styles.historyDot} />
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <Text style={styles.historyAction}>{h.action || 'Updated'}</Text>
                                                        <Text style={styles.historyTime}>{formatDate(h.timestamp || h.date)}</Text>
                                                    </View>
                                                    {h.location ? (
                                                        <Text style={styles.historySub}>📍 {formatLocation(h.location)}</Text>
                                                    ) : null}
                                                    {h.notes ? (
                                                        <Text style={styles.historyNotes}>💬 {h.notes}</Text>
                                                    ) : null}
                                                    {h.performedBy?.name ? (
                                                        <Text style={styles.historyUser}>👤 {h.performedBy.name}</Text>
                                                    ) : null}
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', paddingVertical: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    headerSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
    btnRefresh: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    btnStore: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    btnStoreText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
    errorText: { color: '#ef4444', fontSize: 13, flex: 1 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    statCard: { flex: 1, minWidth: 120, backgroundColor: '#ffffff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4 },
    statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    statValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 4 },
    loadingBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    loadingText: { color: '#64748b', fontSize: 13, marginTop: 8 },
    emptyBox: { padding: 30, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', marginVertical: 8 },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    emptySubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 320 },
    sectionCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
    locationsGrid: { gap: 10 },
    locCard: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    locCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    vialIdText: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    vialType: { fontSize: 12, color: '#64748b', marginVertical: 4 },
    locPathBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', padding: 8, borderRadius: 6, marginVertical: 6 },
    locPathText: { fontSize: 12, color: '#0369a1', fontWeight: '600', flex: 1 },
    btnViewDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderColor: '#f1f5f9' },
    btnViewDetailsText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },
    vialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    vialRowId: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    vialRowSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    vialRowLoc: { fontSize: 12, color: '#0284c7', fontWeight: '500', marginTop: 2 },
    btnActionSm: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalCard: { backgroundColor: '#ffffff', width: '100%', maxWidth: 520, maxHeight: '90%', borderRadius: 16, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    inputLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 10, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#ffffff' },
    pickerBox: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden', backgroundColor: '#ffffff' },
    sectionSubtitleHeader: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
    btnCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9' },
    btnCancelText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    btnSubmit: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#6366f1' },
    btnSubmitText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
    detailHeaderCard: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    detailVialId: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    detailVialType: { fontSize: 12, color: '#64748b', marginTop: 2 },
    locBoxDetail: { backgroundColor: '#e0f2fe', padding: 10, borderRadius: 8, marginTop: 6 },
    locBoxDetailText: { color: '#0369a1', fontSize: 13, fontWeight: '700' },
    detailLabel: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    detailVal: { fontSize: 13, color: '#0f172a', marginTop: 2 },
    historyList: { marginTop: 10 },
    historyItem: { flexDirection: 'row', paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#cbd5e1', paddingLeft: 12, marginLeft: 6 },
    historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', position: 'absolute', left: -5, top: 12 },
    historyAction: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    historyTime: { fontSize: 11, color: '#94a3b8' },
    historySub: { fontSize: 12, color: '#0284c7', marginTop: 2 },
    historyNotes: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 },
    historyUser: { fontSize: 11, color: '#64748b', marginTop: 2 }
});
