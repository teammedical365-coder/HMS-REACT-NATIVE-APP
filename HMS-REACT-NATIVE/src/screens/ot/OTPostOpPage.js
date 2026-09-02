import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, ActivityIndicator, Alert } from 'react-native';
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

const OTPostOpPage = () => {
    const navigation = useNavigation();
    const [postOpSurgeries, setPostOpSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPostOpData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await otAPI.getTodaySchedule(today);
            if (res.success) {
                const list = (res.schedule || []).filter(s => s.status === 'POST_OP' || s.status === 'SURGERY_COMPLETED');
                setPostOpSurgeries(list);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch post-op error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPostOpData();
    }, [fetchPostOpData]);

    const handleWorkflowTransition = (surgeryId, nextStatus) => {
        let msg = 'Confirm this action?';
        let title = 'Action Required';
        if (nextStatus === 'POST_OP') {
            title = 'Move to Post-Op';
            msg = 'Transfer patient to PACU / Recovery?';
        } else if (nextStatus === 'COMPLETED') {
            title = 'Discharge Patient';
            msg = 'Mark as fully completed and discharge from OT flow?';
        }

        Alert.alert(
            title,
            msg,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Confirm", 
                    style: "default",
                    onPress: async () => {
                        try {
                            const res = await otAPI.updateSurgeryWorkflow(surgeryId, { status: nextStatus });
                            if (res.success) fetchPostOpData();
                        } catch (err) {
                            Alert.alert("Error", err.message || 'Workflow transition failed');
                        }
                    }
                }
            ]
        );
    };

    const handleTransferBed = () => {
        Alert.alert("Transfer Bed", "This feature requires WorkflowBedModal. Coming soon.");
    };

    const filteredSurgeries = postOpSurgeries.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const pName = (s.patientId?.name || '').toLowerCase();
        const pMrn = (s.patientId?.mrn || s.patientId?.patientId || '').toLowerCase();
        const proc = (s.surgery || '').toLowerCase();
        const sName = (s.surgeonId?.name || '').toLowerCase();
        const rName = (s.otRoomId?.name || '').toLowerCase();
        return pName.includes(q) || pMrn.includes(q) || proc.includes(q) || sName.includes(q) || rName.includes(q);
    });

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OTHeader
                title="Post-Operative Patients & Recovery"
                subtitle="Patients in PACU / recovery unit, vitals monitoring, recovery stabilization, and ward bed transfer."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchPostOpData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ postOp: postOpSurgeries.length }}
            />

            {/* Post-Op Patients List */}
            {filteredSurgeries.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>❤️</Text>
                    <Text style={styles.emptyTitle}>No Patients Currently in Post-Op Recovery</Text>
                    <Text style={styles.emptyText}>When surgeries complete, patients transition to PACU/Post-Op recovery and appear here.</Text>
                </View>
            ) : (
                <View style={[styles.grid, !isLargeScreen && { flexDirection: 'column' }]}>
                    {filteredSurgeries.map(s => {
                        const stInfo = getStatusStyle(s.status);
                        const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');

                        return (
                            <View key={s._id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.pacuBadge}>
                                        <Text style={styles.pacuBadgeText}>🏥 PACU / Recovery Unit</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                                        <Text style={[styles.statusBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                                    </View>
                                </View>

                                <Text style={styles.surgeryTitle}>{s.surgery}</Text>

                                <View style={styles.patientBox}>
                                    <Text style={styles.patientName}>👤 {s.patientId?.name || 'Patient'}</Text>
                                    <Text style={styles.patientMeta}>MRN: <Text style={{fontWeight: 'bold'}}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text></Text>
                                </View>

                                <View style={styles.infoGrid}>
                                    <View style={styles.infoCol}>
                                        <Text style={styles.infoLabel}>SURGEON</Text>
                                        <Text style={styles.infoValue}>Dr. {surgeonName}</Text>
                                    </View>
                                    <View style={styles.infoCol}>
                                        <Text style={styles.infoLabel}>OT ROOM</Text>
                                        <Text style={styles.infoValue}>{s.otRoomId?.name || 'OT Suite'}</Text>
                                    </View>
                                </View>

                                {s.actualEndTime && (
                                    <View style={styles.completedTimeBox}>
                                        <Text style={styles.completedTimeText}>
                                            ⏱️ Completed at: <Text style={{fontWeight: 'bold'}}>{new Date(s.actualEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={styles.viewBtn}>
                                        <Text style={styles.viewBtnText}>View Details</Text>
                                    </TouchableOpacity>

                                    {s.status === 'SURGERY_COMPLETED' ? (
                                        <TouchableOpacity onPress={() => handleWorkflowTransition(s._id, 'POST_OP')} style={styles.moveToPostOpBtn}>
                                            <Text style={styles.moveToPostOpBtnText}>Move to Post-Op →</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <TouchableOpacity onPress={handleTransferBed} style={styles.transferBedBtn}>
                                                <Text style={styles.transferBedBtnText}>Transfer Bed</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleWorkflowTransition(s._id, 'COMPLETED')} style={styles.dischargeBtn}>
                                                <Text style={styles.dischargeBtnText}>✓ Discharge / Finish</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 16 },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 60, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    card: { flex: 1, minWidth: 350, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#a5f3fc', padding: 20, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    pacuBadge: { backgroundColor: '#ecfeff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
    pacuBadgeText: { fontSize: 12, fontWeight: '800', color: '#0e7490' },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    surgeryTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
    patientBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    patientName: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
    patientMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    infoGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    infoCol: { flex: 1 },
    infoLabel: { fontSize: 10, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', fontWeight: 'bold' },
    infoValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    completedTimeBox: { backgroundColor: '#ecfeff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12 },
    completedTimeText: { fontSize: 12, color: '#0e7490' },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    viewBtn: { paddingVertical: 7, paddingHorizontal: 14, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6 },
    viewBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    moveToPostOpBtn: { paddingVertical: 7, paddingHorizontal: 16, backgroundColor: '#0891b2', borderRadius: 6 },
    moveToPostOpBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    transferBedBtn: { paddingVertical: 7, paddingHorizontal: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6 },
    transferBedBtnText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
    dischargeBtn: { paddingVertical: 7, paddingHorizontal: 16, backgroundColor: '#16a34a', borderRadius: 6 },
    dischargeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' }
});

export default OTPostOpPage;
