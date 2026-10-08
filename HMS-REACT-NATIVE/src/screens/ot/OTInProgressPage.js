import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { SurgeryDetailsModal } from '../../components/ot/OTModals';
import useOTResponsive from './otResponsive';

const getElapsedTime = (startTime) => {
    if (!startTime) return null;
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    if (diffMs < 0) return '0m';
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
};

const OTInProgressPage = () => {
    const navigation = useNavigation();
    const {
        width,
        isSmallPhone,
        isPhone,
        isTablet,
        isLargeTablet,
        pagePadding,
        cardPadding,
        gap,
    } = useOTResponsive();

    const [inOtSurgeries, setInOtSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [now, setNow] = useState(Date.now()); // State to trigger timer rerender

    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const fetchInOtData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await otAPI.getTodaySchedule(today);
            if (res.success) {
                const list = (res.schedule || []).filter(s => s.status === 'IN_OT');
                setInOtSurgeries(list);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch in-ot error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInOtData();

        if (!socket) return;
        const handleUpdate = () => fetchInOtData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);
        socket.on('surgery_plan_created', handleUpdate);

        // 1-minute timer to keep elapsed time live
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 60000);

        return () => {
            clearInterval(timer);
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
            socket.off('surgery_plan_created', handleUpdate);
        };
    }, [fetchInOtData]);

    const handleCompleteSurgery = (surgeryId) => {
        Alert.alert(
            "Complete Surgery",
            "Mark this surgery as completed and transfer to Post-Op recovery?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Complete",
                    style: "default",
                    onPress: async () => {
                        try {
                            const res = await otAPI.updateSurgeryWorkflow(surgeryId, { status: 'SURGERY_COMPLETED' });
                            if (res.success) {
                                Alert.alert("Success", "Surgery completed and transferred to Post-Op recovery");
                                fetchInOtData();
                            }
                        } catch (err) {
                            Alert.alert("Error", err.message || 'Failed to complete surgery');
                        }
                    }
                }
            ]
        );
    };

    const filteredSurgeries = inOtSurgeries.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const pName = (s.patientId?.name || '').toLowerCase();
        const pMrn = (s.patientId?.mrn || s.patientId?.patientId || '').toLowerCase();
        const proc = (s.surgery || '').toLowerCase();
        const sName = (s.surgeonId?.name || '').toLowerCase();
        const rName = (s.otRoomId?.name || '').toLowerCase();
        return pName.includes(q) || pMrn.includes(q) || proc.includes(q) || sName.includes(q) || rName.includes(q);
    });

    const cardWidth = isLargeTablet ? '31.5%' : isTablet ? '48.5%' : '100%';

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}>
            <OTHeader
                title="Surgeries In OT (Active Live Feed)"
                subtitle="Live intraoperative status, elapsed surgery duration, and active surgical team monitoring."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchInOtData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ inOt: inOtSurgeries.length }}
            />

            {/* In-OT Surgeries List */}
            {filteredSurgeries.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>🔴</Text>
                    <Text style={styles.emptyTitle}>No Surgeries are Currently In OT</Text>
                    <Text style={styles.emptyText}>All OT suites are currently idle or preparing for upcoming scheduled procedures.</Text>
                </View>
            ) : (
                <View style={[styles.grid, { gap }]}>
                    {filteredSurgeries.map(s => {
                        const elapsed = getElapsedTime(s.actualStartTime);
                        const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
                        const assistants = s.assistantSurgeonIds || [];

                        return (
                            <View
                                key={s._id}
                                style={[
                                    styles.card,
                                    { width: cardWidth, padding: cardPadding }
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                                        <Text style={{ fontSize: 20 }}>🚪</Text>
                                        <Text style={styles.roomName} numberOfLines={2}>{s.otRoomId?.name || 'Major OT Suite'}</Text>
                                    </View>
                                    <View style={styles.statusBadge}>
                                        <View style={styles.pulseDot} />
                                        <Text style={styles.statusBadgeText}>IN OT (ACTIVE)</Text>
                                    </View>
                                </View>

                                <Text style={styles.surgeryTitle} numberOfLines={3}>{s.surgery}</Text>

                                <View style={styles.elapsedBanner}>
                                    <View>
                                        <Text style={styles.elapsedLabel}>ELAPSED DURATION</Text>
                                        <Text style={styles.elapsedValue}>{elapsed || 'In Progress'}</Text>
                                    </View>
                                    {Boolean(s.actualStartTime) && (
                                        <Text style={styles.startTimeText}>
                                            Started at: <Text style={{fontWeight: 'bold'}}>{new Date(s.actualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.patientBox}>
                                    <Text style={styles.patientName}>👤 {s.patientId?.name || 'Patient'}</Text>
                                    <Text style={styles.patientMeta}>MRN: <Text style={{fontWeight: 'bold'}}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text></Text>
                                </View>

                                <View style={styles.surgeonInfo}>
                                    <Text style={styles.surgeonText} numberOfLines={2}>👨‍⚕️ Operating Surgeon: <Text style={{fontWeight: 'bold'}}>Dr. {surgeonName}</Text></Text>
                                    {assistants.length > 0 && (
                                        <Text style={styles.assistantText}>
                                            Assistants: {assistants.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}
                                        </Text>
                                    )}
                                </View>

                                <View style={[styles.cardActions, isSmallPhone && styles.cardActionsSmallPhone]}>
                                    <TouchableOpacity
                                        style={[styles.viewBtn, isSmallPhone && styles.btnFullWidth]}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        onPress={() => {
                                            setSelectedSurgery(s);
                                            setShowDetailsModal(true);
                                        }}
                                    >
                                        <Feather name="eye" size={14} color="#991b1b" style={{ marginRight: 4 }} />
                                        <Text style={styles.viewBtnText}>Details</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleCompleteSurgery(s._id)}
                                        style={[styles.completeBtn, isSmallPhone && styles.btnFullWidth]}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={styles.completeBtnText}>✓ Mark Completed</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            <SurgeryDetailsModal
                open={showDetailsModal}
                surgery={selectedSurgery}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedSurgery(null);
                }}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 16, paddingBottom: 40 },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 60, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    card: { backgroundColor: '#fff5f5', borderRadius: 14, borderWidth: 2, borderColor: '#f87171', elevation: 2, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    roomName: { fontWeight: '800', color: '#991b1b', fontSize: 16 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
    statusBadgeText: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
    surgeryTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 8 },
    elapsedBanner: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    elapsedLabel: { fontSize: 11, fontWeight: '700', color: '#dc2626', textTransform: 'uppercase' },
    elapsedValue: { fontSize: 22, fontWeight: '900', color: '#b91c1c' },
    startTimeText: { fontSize: 12, color: '#64748b' },
    patientBox: { backgroundColor: '#ffffff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa', marginBottom: 12 },
    patientName: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
    patientMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    surgeonInfo: { marginBottom: 12 },
    surgeonText: { fontSize: 13, color: '#334155' },
    assistantText: { fontSize: 12, color: '#475569', marginTop: 2 },
    cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#fee2e2' },
    cardActionsSmallPhone: { flexDirection: 'column-reverse', alignItems: 'stretch' },
    btnFullWidth: { width: '100%', flex: undefined },
    viewBtn: { flex: 1, flexDirection: 'row', paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8 },
    viewBtnText: { fontSize: 13, fontWeight: '700', color: '#991b1b' },
    completeBtn: { flex: 1.5, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#dc2626', borderRadius: 8 },
    completeBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
});

export default OTInProgressPage;
