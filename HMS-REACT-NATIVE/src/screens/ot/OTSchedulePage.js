import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { otAPI, doctorAPI, bedAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { 
    getStatusStyle, 
    getElapsedTime, 
    checkIfDelayed, 
    SurgeryDetailsModal, 
    ScheduleSurgeryModal, 
    WorkflowBedModal 
} from './OTModals';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const OTSchedulePage = () => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [schedule, setSchedule] = useState([]);
    const [doctorsList, setDoctorsList] = useState([]);
    const [otRoomsList, setOtRoomsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, DELAYED, SCHEDULED, IN_OT, COMPLETED

    // Modals
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [activePlanToSchedule, setActivePlanToSchedule] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [bedModal, setBedModal] = useState({ open: false, actionType: null, patientId: null, surgeryId: null });

    const fetchScheduleData = useCallback(async () => {
        setLoading(true);
        try {
            const [scheduleRes, docsRes, roomsRes] = await Promise.all([
                otAPI.getTodaySchedule(selectedDate),
                doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
                otAPI.getRooms().catch(() => ({ rooms: [] }))
            ]);

            if (scheduleRes.success) {
                setSchedule(scheduleRes.schedule || []);
            }
            if (docsRes.doctors) setDoctorsList(docsRes.doctors);
            if (roomsRes.rooms) setOtRoomsList(roomsRes.rooms);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch schedule error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchScheduleData();

        const handleUpdate = () => fetchScheduleData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
        };
    }, [fetchScheduleData]);

    const handleDateShift = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const handleWorkflowTransition = async (surgeryId, nextStatus) => {
        try {
            const res = await otAPI.updateSurgeryWorkflow(surgeryId, { status: nextStatus });
            if (res.success) fetchScheduleData();
        } catch (err) {
            Alert.alert('Workflow Error', err.response?.data?.message || 'Workflow update failed');
        }
    };

    const handleCancelSurgery = async (surgeryId) => {
        Alert.alert(
            'Confirm Cancel',
            'Are you sure you want to cancel this scheduled surgery?',
            [
                { text: 'No', style: 'cancel' },
                { 
                    text: 'Yes, Cancel', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await otAPI.cancelSurgery(surgeryId);
                            if (res.success) fetchScheduleData();
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Cancel failed');
                        }
                    }
                }
            ]
        );
    };

    // Filter surgeries
    const filteredSchedule = schedule.filter(s => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const pName = (s.patientId?.name || '').toLowerCase();
            const pMrn = (s.patientId?.mrn || s.patientId?.patientId || '').toLowerCase();
            const proc = (s.surgery || '').toLowerCase();
            const sName = (s.surgeonId?.name || '').toLowerCase();
            const rName = (s.otRoomId?.name || '').toLowerCase();
            if (!pName.includes(q) && !pMrn.includes(q) && !proc.includes(q) && !sName.includes(q) && !rName.includes(q)) {
                return false;
            }
        }

        const isDelayed = checkIfDelayed(s);
        if (activeFilter === 'DELAYED') return isDelayed;
        if (activeFilter === 'SCHEDULED') return s.status === 'SCHEDULED' || s.status === 'ADMITTED';
        if (activeFilter === 'IN_OT') return s.status === 'IN_OT';
        if (activeFilter === 'COMPLETED') return s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED';

        return true;
    });

    const filters = [
        { id: 'ALL', label: `All (${schedule.length})` },
        { id: 'DELAYED', label: `Delayed (${schedule.filter(s => checkIfDelayed(s)).length})` },
        { id: 'SCHEDULED', label: 'Scheduled' },
        { id: 'IN_OT', label: 'In OT' },
        { id: 'COMPLETED', label: 'Completed' }
    ];

    return (
        <View style={styles.container}>
            <OTHeader
                title="OT Schedule & Daily Planning"
                subtitle="Complete daily surgery roster, room allocation, surgeon teams, and real-time tracking."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchScheduleData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ today: schedule.length }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Date Navigator Bar & Filter Pills */}
                <View style={styles.navBar}>
                    {/* Date Controls */}
                    <View style={styles.dateControls}>
                        <TouchableOpacity onPress={() => handleDateShift(-1)} style={styles.navBtn}>
                            <Feather name="chevron-left" size={16} color="#334155" />
                            <Text style={styles.navBtnText}>Prev</Text>
                        </TouchableOpacity>

                        <View style={styles.dateDisplay}>
                            <Text style={styles.dateDisplayText}>{selectedDate}</Text>
                        </View>

                        <TouchableOpacity onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])} style={styles.todayBtn}>
                            <Text style={styles.todayBtnText}>Today</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => handleDateShift(1)} style={styles.navBtn}>
                            <Text style={styles.navBtnText}>Next</Text>
                            <Feather name="chevron-right" size={16} color="#334155" />
                        </TouchableOpacity>
                    </View>

                    {/* Filter Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {filters.map(f => (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => setActiveFilter(f.id)}
                                style={[styles.filterPill, activeFilter === f.id && styles.filterPillActive]}
                            >
                                <Text style={[styles.filterPillText, activeFilter === f.id && styles.filterPillTextActive]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Schedule Table / List */}
                {filteredSchedule.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="calendar" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Surgeries Scheduled</Text>
                        <Text style={styles.emptySub}>
                            Selected Date: <Text style={styles.boldText}>{new Date(selectedDate).toDateString()}</Text>
                        </Text>
                    </View>
                ) : (
                    <ScrollView horizontal={!isTablet} showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
                        <View style={[styles.listContainer, { minWidth: isTablet ? '100%' : 800 }]}>
                            {filteredSchedule.map(s => {
                                const stInfo = getStatusStyle(s.status);
                                const isDelayed = checkIfDelayed(s);
                                const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
                                const assistants = s.assistantSurgeonIds || [];
                                const cost = Number(s.surgeryCost) || 0;
                                const paid = Number(s.paidAmount) || 0;
                                const remaining = Math.max(0, cost - paid);

                                return (
                                    <View key={s._id} style={[styles.scheduleCard, isDelayed && styles.scheduleCardDelayed]}>
                                        
                                        {/* Column 1: Time & OT Room */}
                                        <View style={styles.col1}>
                                            <Text style={styles.timeText}>⏰ {s.startTime || '--:--'}</Text>
                                            <Text style={styles.timeToText}>to {s.endTime || '--:--'}</Text>
                                            <View style={styles.roomBadge}>
                                                <Text style={styles.roomBadgeText}>🚪 {s.otRoomId?.name || 'Unassigned OT'}</Text>
                                            </View>
                                        </View>

                                        {/* Column 2: Procedure & Patient & Surgeon Team */}
                                        <View style={styles.col2}>
                                            <View style={styles.procedureRow}>
                                                <Text style={styles.procedureName}>{s.surgery}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                                                    <Text style={[styles.statusBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                                                </View>
                                                {isDelayed && (
                                                    <View style={styles.delayedBadge}>
                                                        <Text style={styles.delayedBadgeText}>🚨 DELAYED</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <Text style={styles.patientInfo}>
                                                👤 <Text style={styles.boldText}>{s.patientId?.name || 'Patient'}</Text> [MRN: {s.patientId?.mrn || s.patientId?.patientId || '-'}]
                                                {s.patientId?.phone ? ` • 📞 ${s.patientId.phone}` : ''}
                                            </Text>

                                            <Text style={styles.surgeonInfo}>
                                                👨‍⚕️ Operating Surgeon: <Text style={styles.boldText}>Dr. {surgeonName}</Text>
                                                {assistants.length > 0 ? ` • Assistants: ${assistants.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}` : ''}
                                            </Text>
                                        </View>

                                        {/* Column 3: Billing & Payment Status */}
                                        <View style={styles.col3}>
                                            <Text style={styles.billingLabel}>BILLING STATUS</Text>
                                            <View style={[
                                                styles.paymentBadge, 
                                                s.paymentStatus === 'PAID' ? styles.paymentBadgePaid : (s.paymentStatus === 'PARTIALLY PAID' ? styles.paymentBadgePartial : styles.paymentBadgeUnpaid)
                                            ]}>
                                                <Text style={[
                                                    styles.paymentBadgeText,
                                                    s.paymentStatus === 'PAID' ? styles.paymentTextPaid : (s.paymentStatus === 'PARTIALLY PAID' ? styles.paymentTextPartial : styles.paymentTextUnpaid)
                                                ]}>
                                                    {s.paymentStatus || 'UNPAID'}
                                                </Text>
                                            </View>
                                            {cost > 0 && (
                                                <View style={styles.costBox}>
                                                    <Text style={styles.costFee}>Fee: <Text style={styles.boldText}>₹{cost.toLocaleString()}</Text></Text>
                                                    {remaining > 0 ? (
                                                        <Text style={styles.costDue}>Due: ₹{remaining.toLocaleString()}</Text>
                                                    ) : (
                                                        <Text style={styles.costPaid}>Paid Full</Text>
                                                    )}
                                                </View>
                                            )}
                                        </View>

                                        {/* Column 4: Actions & Step Progression */}
                                        <View style={styles.col4}>
                                            <View style={styles.actionRow}>
                                                <TouchableOpacity 
                                                    style={styles.viewBtn}
                                                    onPress={() => {
                                                        setSelectedSurgery(s);
                                                        setShowDetailsModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.viewBtnText}>View</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    style={styles.cancelBtn}
                                                    onPress={() => handleCancelSurgery(s._id)}
                                                >
                                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Next Step Progression Action */}
                                            {s.status === 'SCHEDULED' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#2563eb' }]}
                                                    onPress={() => {
                                                        if (s.admissionRequired) {
                                                            setBedModal({ open: true, actionType: 'ADMIT', patientId: s.patientId?._id, surgeryId: s._id });
                                                        } else {
                                                            handleWorkflowTransition(s._id, 'PRE_OP');
                                                        }
                                                    }}
                                                >
                                                    <Text style={styles.progressBtnText}>{s.admissionRequired ? '🏥 Admit Patient' : 'Start Pre-Op →'}</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'ADMITTED' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#d97706' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'PRE_OP')}
                                                >
                                                    <Text style={styles.progressBtnText}>Start Pre-Op →</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'PRE_OP' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#7c3aed' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'READY_FOR_OT')}
                                                >
                                                    <Text style={styles.progressBtnText}>Mark Ready for OT →</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'READY_FOR_OT' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#dc2626' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'IN_OT')}
                                                >
                                                    <Text style={styles.progressBtnText}>🔴 Enter OT →</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'IN_OT' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#0d9488' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'SURGERY_COMPLETED')}
                                                >
                                                    <Text style={styles.progressBtnText}>✓ Complete Surgery</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'SURGERY_COMPLETED' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#0891b2' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'POST_OP')}
                                                >
                                                    <Text style={styles.progressBtnText}>Move to Post-Op →</Text>
                                                </TouchableOpacity>
                                            )}

                                            {s.status === 'POST_OP' && (
                                                <TouchableOpacity 
                                                    style={[styles.progressBtn, { backgroundColor: '#16a34a' }]}
                                                    onPress={() => handleWorkflowTransition(s._id, 'COMPLETED')}
                                                >
                                                    <Text style={styles.progressBtnText}>✓ Discharge / Finish</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
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

            <ScheduleSurgeryModal
                open={showScheduleModal}
                activePlan={activePlanToSchedule}
                doctorsList={doctorsList}
                otRoomsList={otRoomsList}
                onClose={() => {
                    setShowScheduleModal(false);
                    setActivePlanToSchedule(null);
                }}
                onSuccess={() => fetchScheduleData()}
            />

            <WorkflowBedModal
                open={bedModal.open}
                actionType={bedModal.actionType}
                patientId={bedModal.patientId}
                surgeryId={bedModal.surgeryId}
                onClose={() => setBedModal({ open: false, actionType: null, patientId: null, surgeryId: null })}
                onSuccess={() => fetchScheduleData()}
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
    navBar: {
        backgroundColor: '#ffffff',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        flexDirection: isTablet ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: isTablet ? 'center' : 'flex-start',
        gap: 16,
    },
    dateControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    navBtnText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600',
    },
    dateDisplay: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    dateDisplayText: {
        fontWeight: 'bold',
        color: '#0f172a',
        fontSize: 14,
    },
    todayBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 8,
    },
    todayBtnText: {
        color: '#1d4ed8',
        fontWeight: 'bold',
        fontSize: 13,
    },
    filterScroll: {
        flexDirection: 'row',
        gap: 8,
    },
    filterPill: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    filterPillActive: {
        backgroundColor: '#2563eb',
    },
    filterPillText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#475569',
    },
    filterPillTextActive: {
        color: '#ffffff',
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
    },
    boldText: {
        fontWeight: 'bold',
    },
    horizontalScroll: {
        flex: 1,
    },
    listContainer: {
        flexDirection: 'column',
        gap: 14,
    },
    scheduleCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 18,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        justifyContent: 'space-between',
        gap: 18,
    },
    scheduleCardDelayed: {
        borderColor: '#fca5a5',
    },
    col1: {
        width: 160,
        borderRightWidth: 1,
        borderColor: '#f1f5f9',
        paddingRight: 14,
    },
    timeText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a',
    },
    timeToText: {
        fontSize: 13,
        color: '#64748b',
    },
    roomBadge: {
        marginTop: 8,
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    roomBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
    },
    col2: {
        flex: 1,
    },
    procedureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    procedureName: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0f172a',
    },
    statusBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '900',
    },
    delayedBadge: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        backgroundColor: '#fee2e2',
    },
    delayedBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#b91c1c',
    },
    patientInfo: {
        fontSize: 13,
        color: '#334155',
        marginTop: 4,
    },
    surgeonInfo: {
        fontSize: 12,
        color: '#475569',
        marginTop: 4,
    },
    col3: {
        width: 180,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#f1f5f9',
        paddingHorizontal: 14,
        justifyContent: 'center',
    },
    billingLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    paymentBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    paymentBadgePaid: { backgroundColor: '#dcfce7' },
    paymentBadgePartial: { backgroundColor: '#fef3c7' },
    paymentBadgeUnpaid: { backgroundColor: '#fee2e2' },
    paymentBadgeText: {
        fontSize: 11,
        fontWeight: '900',
    },
    paymentTextPaid: { color: '#15803d' },
    paymentTextPartial: { color: '#b45309' },
    paymentTextUnpaid: { color: '#b91c1c' },
    costBox: {
        marginTop: 4,
    },
    costFee: {
        fontSize: 12,
        color: '#334155',
    },
    costDue: {
        fontSize: 11,
        color: '#dc2626',
    },
    costPaid: {
        fontSize: 11,
        color: '#16a34a',
    },
    col4: {
        width: 220,
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 6,
    },
    viewBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
    },
    viewBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
    },
    cancelBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 6,
    },
    cancelBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#dc2626',
    },
    progressBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 6,
        width: '100%',
        alignItems: 'center',
    },
    progressBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default OTSchedulePage;
