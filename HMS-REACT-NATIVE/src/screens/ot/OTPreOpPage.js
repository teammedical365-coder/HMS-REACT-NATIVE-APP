import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { getStatusStyle, SurgeryDetailsModal } from './OTModals';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const OTPreOpPage = () => {
    const [preOpSurgeries, setPreOpSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const fetchPreOpData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await otAPI.getTodaySchedule(today);
            if (res.success) {
                const list = (res.schedule || []).filter(s => s.status === 'PRE_OP' || s.status === 'READY_FOR_OT');
                setPreOpSurgeries(list);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch pre-op error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPreOpData();

        const handleUpdate = () => fetchPreOpData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
        };
    }, [fetchPreOpData]);

    const handleWorkflowTransition = async (surgeryId, nextStatus) => {
        try {
            const res = await otAPI.updateSurgeryWorkflow(surgeryId, { status: nextStatus });
            if (res.success) fetchPreOpData();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Workflow transition failed');
        }
    };

    const filteredSurgeries = preOpSurgeries.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const pName = (s.patientId?.name || '').toLowerCase();
        const pMrn = (s.patientId?.mrn || s.patientId?.patientId || '').toLowerCase();
        const proc = (s.surgery || '').toLowerCase();
        const sName = (s.surgeonId?.name || '').toLowerCase();
        const rName = (s.otRoomId?.name || '').toLowerCase();
        return pName.includes(q) || pMrn.includes(q) || proc.includes(q) || sName.includes(q) || rName.includes(q);
    });

    return (
        <View style={styles.container}>
            <OTHeader
                title="Pre-Operative Patients"
                subtitle="Patients currently admitted and preparing for surgery (fasting, pre-medication, clinical clearance)."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchPreOpData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ preOp: preOpSurgeries.length }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Pre-Op Patients List */}
                {filteredSurgeries.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="user-check" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Patients Currently in Pre-Op</Text>
                        <Text style={styles.emptySub}>
                            When scheduled patients are admitted and pre-op preparation starts, they will appear here.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {filteredSurgeries.map(s => {
                            const stInfo = getStatusStyle(s.status);
                            const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
                            const assistants = s.assistantSurgeonIds || [];

                            const isReadyForOT = s.status === 'READY_FOR_OT';

                            return (
                                <View
                                    key={s._id}
                                    style={[
                                        styles.card,
                                        isReadyForOT ? styles.cardReady : styles.cardPreOp
                                    ]}
                                >
                                    <View>
                                        <View style={styles.cardHeaderRow}>
                                            <View style={styles.roomBadge}>
                                                <Text style={styles.roomBadgeText}>
                                                    🚪 {s.otRoomId?.name || 'OT Suite'}
                                                </Text>
                                            </View>

                                            <View style={[
                                                styles.statusBadge, 
                                                { backgroundColor: stInfo.bg, borderColor: stInfo.border }
                                            ]}>
                                                <Text style={[styles.statusBadgeText, { color: stInfo.color }]}>
                                                    {stInfo.label}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.surgeryTitle}>{s.surgery}</Text>

                                        <View style={styles.patientInfoBox}>
                                            <Text style={styles.patientName}>
                                                👤 {s.patientId?.name || 'Patient'}
                                            </Text>
                                            <Text style={styles.patientSubInfo}>
                                                MRN: <Text style={styles.boldText}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text>
                                                {s.patientId?.phone ? ` • 📞 ${s.patientId.phone}` : ''}
                                            </Text>
                                        </View>

                                        <View style={styles.clinicalGrid}>
                                            <View style={styles.clinicalItem}>
                                                <Text style={styles.clinicalLabel}>SURGEON</Text>
                                                <Text style={styles.clinicalValue}>Dr. {surgeonName}</Text>
                                            </View>
                                            <View style={styles.clinicalItem}>
                                                <Text style={styles.clinicalLabel}>SCHEDULED TIME</Text>
                                                <Text style={styles.clinicalValue}>
                                                    {s.startTime || '--:--'} - {s.endTime || '--:--'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Pre-Op Checklist Indicator */}
                                        <View style={styles.checklistIndicator}>
                                            <Text style={styles.checklistText}>✓ Pre-anesthesia vitals recorded</Text>
                                            <Text style={styles.checklistText}>✓ Surgical consent verified</Text>
                                        </View>
                                    </View>

                                    {/* Bottom Actions */}
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedSurgery(s);
                                                setShowDetailsModal(true);
                                            }}
                                            style={styles.viewBtn}
                                        >
                                            <Text style={styles.viewBtnText}>View Details</Text>
                                        </TouchableOpacity>

                                        {s.status === 'PRE_OP' && (
                                            <TouchableOpacity
                                                onPress={() => handleWorkflowTransition(s._id, 'READY_FOR_OT')}
                                                style={[styles.workflowBtn, { backgroundColor: '#7c3aed' }]}
                                            >
                                                <Text style={styles.workflowBtnText}>Mark Ready for OT →</Text>
                                            </TouchableOpacity>
                                        )}

                                        {s.status === 'READY_FOR_OT' && (
                                            <TouchableOpacity
                                                onPress={() => handleWorkflowTransition(s._id, 'IN_OT')}
                                                style={[styles.workflowBtn, { backgroundColor: '#dc2626' }]}
                                            >
                                                <Text style={styles.workflowBtnText}>🔴 Transfer to OT →</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Modals */}
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
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 16,
    },
    emptyState: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    emptyIcon: {
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
    },
    grid: {
        flexDirection: isTablet ? 'row' : 'column',
        flexWrap: 'wrap',
        gap: 16,
    },
    card: {
        width: isTablet ? '48%' : '100%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1.5,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        justifyContent: 'space-between',
    },
    cardReady: {
        borderColor: '#d8b4fe',
    },
    cardPreOp: {
        borderColor: '#fde68a',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    roomBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    roomBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#475569',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    surgeryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    patientInfoBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    patientName: {
        fontWeight: 'bold',
        color: '#0f172a',
        fontSize: 14,
    },
    patientSubInfo: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    boldText: {
        fontWeight: 'bold',
    },
    clinicalGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    clinicalItem: {
        flex: 1,
    },
    clinicalLabel: {
        color: '#64748b',
        fontSize: 11,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    clinicalValue: {
        color: '#0f172a',
        fontWeight: 'bold',
        fontSize: 13,
    },
    checklistIndicator: {
        backgroundColor: '#fefce8',
        borderWidth: 1,
        borderColor: '#fef08a',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    checklistText: {
        fontSize: 12,
        color: '#854d0e',
        marginBottom: 2,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        paddingTop: 14,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    viewBtn: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
    },
    viewBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#334155',
    },
    workflowBtn: {
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    workflowBtnText: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold',
    },
});

export default OTPreOpPage;
