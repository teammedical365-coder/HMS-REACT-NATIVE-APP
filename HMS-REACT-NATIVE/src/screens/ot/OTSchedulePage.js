import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
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
} from '../../components/ot/OTModals';
import DatePickerInput from '../../components/common/DatePickerInput';
import useOTResponsive from './otResponsive';

const OTSchedulePage = () => {
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

        if (!socket) return;
        const handleUpdate = () => fetchScheduleData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);
        socket.on('surgery_plan_created', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
            socket.off('surgery_plan_created', handleUpdate);
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
            if (res.success) {
                Alert.alert('Success', 'Workflow status updated');
                fetchScheduleData();
            }
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
                            if (res.success) {
                                Alert.alert('Success', 'Surgery cancelled successfully');
                                fetchScheduleData();
                            }
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

    const renderProgressionButton = (s, isMobile = false) => {
        let btnColor = null;
        let btnText = null;
        let onPress = null;

        if (s.status === 'SCHEDULED') {
            btnColor = '#2563eb';
            btnText = s.admissionRequired ? '🏥 Admit Patient' : 'Start Pre-Op →';
            onPress = () => {
                if (s.admissionRequired) {
                    setBedModal({ open: true, actionType: 'ADMIT', patientId: s.patientId?._id, surgeryId: s._id });
                } else {
                    handleWorkflowTransition(s._id, 'PRE_OP');
                }
            };
        } else if (s.status === 'ADMITTED') {
            btnColor = '#d97706';
            btnText = 'Start Pre-Op →';
            onPress = () => handleWorkflowTransition(s._id, 'PRE_OP');
        } else if (s.status === 'PRE_OP') {
            btnColor = '#7c3aed';
            btnText = 'Mark Ready for OT →';
            onPress = () => handleWorkflowTransition(s._id, 'READY_FOR_OT');
        } else if (s.status === 'READY_FOR_OT') {
            btnColor = '#dc2626';
            btnText = '🔴 Enter OT →';
            onPress = () => handleWorkflowTransition(s._id, 'IN_OT');
        } else if (s.status === 'IN_OT') {
            btnColor = '#0d9488';
            btnText = '✓ Complete Surgery';
            onPress = () => handleWorkflowTransition(s._id, 'SURGERY_COMPLETED');
        } else if (s.status === 'SURGERY_COMPLETED') {
            btnColor = '#0891b2';
            btnText = 'Move to Post-Op →';
            onPress = () => handleWorkflowTransition(s._id, 'POST_OP');
        } else if (s.status === 'POST_OP') {
            btnColor = '#16a34a';
            btnText = '✓ Discharge / Finish';
            onPress = () => handleWorkflowTransition(s._id, 'COMPLETED');
        }

        if (!btnText) return null;

        return (
            <TouchableOpacity
                style={[styles.progressBtn, { backgroundColor: btnColor }, isMobile && styles.progressBtnMobile]}
                onPress={onPress}
                activeOpacity={0.8}
            >
                <Text style={styles.progressBtnText}>{btnText}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.scrollContent, { padding: pagePadding }]}>
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
                {/* Date Navigator Bar & Filter Pills */}
                <View style={[styles.navBar, { flexDirection: isTablet ? 'row' : 'column', alignItems: isTablet ? 'center' : 'stretch', gap: 14 }]}>
                    {/* Date Navigation */}
                    <View style={[styles.dateControls, isPhone && styles.dateControlsPhone]}>
                        <View style={styles.dateNavRow}>
                            <TouchableOpacity onPress={() => handleDateShift(-1)} style={styles.navBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Feather name="chevron-left" size={16} color="#334155" />
                                <Text style={styles.navBtnText}>Prev</Text>
                            </TouchableOpacity>

                            <View style={styles.dateInputContainer}>
                                <DatePickerInput
                                    value={selectedDate}
                                    onChange={d => setSelectedDate(d)}
                                />
                            </View>

                            <TouchableOpacity onPress={() => handleDateShift(1)} style={styles.navBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Text style={styles.navBtnText}>Next</Text>
                                <Feather name="chevron-right" size={16} color="#334155" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                style={[
                                    styles.todayBtn,
                                    selectedDate === new Date().toISOString().split('T')[0] && styles.todayBtnActive
                                ]}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <Text style={[
                                    styles.todayBtnText,
                                    selectedDate === new Date().toISOString().split('T')[0] && styles.todayBtnTextActive
                                ]}>Today</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Status Filter Pills */}
                    <View style={[styles.filterScroll, isPhone && styles.filterWrap]}>
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
                    </View>
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
                ) : isTablet ? (
                    /* Tablet & Desktop: Multi-column Card Layout */
                    <ScrollView horizontal={!isLargeTablet} showsHorizontalScrollIndicator={true} style={styles.horizontalScroll}>
                        <View style={[styles.listContainer, { minWidth: isLargeTablet ? '100%' : 750 }]}>
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
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    onPress={() => {
                                                        setSelectedSurgery(s);
                                                        setShowDetailsModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.viewBtnText}>View</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.cancelBtn}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    onPress={() => handleCancelSurgery(s._id)}
                                                >
                                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {renderProgressionButton(s, false)}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                ) : (
                    /* Phone & Compact Devices: Adaptive Vertical Clinical Cards (No horizontal scroll!) */
                    <View style={styles.mobileListContainer}>
                        {filteredSchedule.map(s => {
                            const stInfo = getStatusStyle(s.status);
                            const isDelayed = checkIfDelayed(s);
                            const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
                            const assistants = s.assistantSurgeonIds || [];
                            const cost = Number(s.surgeryCost) || 0;
                            const paid = Number(s.paidAmount) || 0;
                            const remaining = Math.max(0, cost - paid);

                            return (
                                <View
                                    key={s._id}
                                    style={[
                                        styles.mobileCard,
                                        { padding: cardPadding },
                                        isDelayed && styles.scheduleCardDelayed
                                    ]}
                                >
                                    {/* Top Row: Time/Room & Status Badges */}
                                    <View style={styles.mobileCardHeader}>
                                        <View style={styles.mobileTimeRoomGroup}>
                                            <View style={styles.mobileTimePill}>
                                                <Text style={styles.mobileTimeText}>⏰ {s.startTime || '--:--'} - {s.endTime || '--:--'}</Text>
                                            </View>
                                            <View style={styles.mobileRoomPill}>
                                                <Text style={styles.mobileRoomText} numberOfLines={2}>🚪 {s.otRoomId?.name || 'Unassigned'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.mobileStatusGroup}>
                                            <View style={[styles.statusBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                                                <Text style={[styles.statusBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                                            </View>
                                            {isDelayed && (
                                                <View style={styles.delayedBadge}>
                                                    <Text style={styles.delayedBadgeText}>🚨 DELAYED</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Procedure Name */}
                                    <Text style={styles.mobileProcedureTitle} numberOfLines={3}>{s.surgery}</Text>

                                    {/* Patient Info */}
                                    <View style={styles.mobilePatientBox}>
                                        <Text style={styles.mobilePatientName}>
                                            👤 <Text style={styles.boldText}>{s.patientId?.name || 'Patient'}</Text>
                                        </Text>
                                        <Text style={styles.mobilePatientSub}>
                                            MRN: <Text style={styles.boldText}>{s.patientId?.mrn || s.patientId?.patientId || '-'}</Text>
                                            {s.patientId?.phone ? ` • 📞 ${s.patientId.phone}` : ''}
                                        </Text>
                                    </View>

                                    {/* Surgeon & Billing Line */}
                                    <View style={styles.mobileSurgeonRow}>
                                        <Text style={styles.mobileSurgeonText} numberOfLines={2}>
                                            👨‍⚕️ <Text style={styles.boldText}>Dr. {surgeonName}</Text>
                                            {assistants.length > 0 ? ` (+${assistants.length} asst)` : ''}
                                        </Text>
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
                                    </View>

                                    {/* Financial Breakdown if cost set */}
                                    {cost > 0 && (
                                        <View style={styles.mobileBillingStrip}>
                                            <Text style={styles.mobileBillingFee}>Fee: <Text style={styles.boldText}>₹{cost.toLocaleString()}</Text></Text>
                                            {remaining > 0 ? (
                                                <Text style={styles.mobileBillingDue}>Due: ₹{remaining.toLocaleString()}</Text>
                                            ) : (
                                                <Text style={styles.mobileBillingPaid}>Paid Full</Text>
                                            )}
                                        </View>
                                    )}

                                    {/* Actions */}
                                    <View style={styles.mobileActionsContainer}>
                                        <View style={styles.mobileSecondaryActionRow}>
                                            <TouchableOpacity
                                                style={styles.mobileViewBtn}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                onPress={() => {
                                                    setSelectedSurgery(s);
                                                    setShowDetailsModal(true);
                                                }}
                                            >
                                                <Feather name="eye" size={14} color="#334155" style={{ marginRight: 4 }} />
                                                <Text style={styles.mobileViewBtnText}>Details</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.mobileCancelBtn}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                onPress={() => handleCancelSurgery(s._id)}
                                            >
                                                <Feather name="x-circle" size={14} color="#dc2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.mobileCancelBtnText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Primary Progression Button */}
                                        {renderProgressionButton(s, true)}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

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
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        padding: 16,
        paddingBottom: 40,
    },
    navBar: {
        backgroundColor: '#ffffff',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        justifyContent: 'space-between',
        gap: 16,
    },
    dateControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateControlsPhone: {
        width: '100%',
    },
    dateNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        flexWrap: 'wrap',
    },
    dateInputContainer: {
        flex: 1,
        minWidth: 100,
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
        minHeight: 44,
        justifyContent: 'center',
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
        minHeight: 44,
        justifyContent: 'center',
    },
    todayBtnActive: {
        backgroundColor: '#2563eb',
        borderColor: '#1d4ed8',
    },
    todayBtnText: {
        color: '#1d4ed8',
        fontWeight: 'bold',
        fontSize: 13,
    },
    todayBtnTextActive: {
        color: '#ffffff',
    },
    filterScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterWrap: {
        flexWrap: 'wrap',
    },
    filterPill: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        minHeight: 44,
        justifyContent: 'center',
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
        width: 140,
        borderRightWidth: 1,
        borderColor: '#f1f5f9',
        paddingRight: 12,
    },
    timeText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0f172a',
    },
    timeToText: {
        fontSize: 12,
        color: '#64748b',
    },
    roomBadge: {
        marginTop: 6,
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    roomBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#334155',
    },
    col2: {
        flex: 1,
        paddingHorizontal: 6,
    },
    procedureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    procedureName: {
        fontSize: 16,
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
        width: 160,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#f1f5f9',
        paddingHorizontal: 12,
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
        width: 190,
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
        minHeight: 44,
        justifyContent: 'center',
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
        minHeight: 44,
        justifyContent: 'center',
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
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: 6,
        width: '100%',
        alignItems: 'center',
    },
    progressBtnText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    // Mobile Adaptive Card Styles
    mobileListContainer: {
        flexDirection: 'column',
        gap: 12,
        width: '100%',
    },
    mobileCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
        gap: 10,
    },
    mobileCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    mobileTimeRoomGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        flex: 1,
    },
    mobileTimePill: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    mobileTimeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    mobileRoomPill: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        maxWidth: 160,
    },
    mobileRoomText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    mobileStatusGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
    },
    mobileProcedureTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    mobilePatientBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
    },
    mobilePatientName: {
        fontSize: 13,
        color: '#0f172a',
    },
    mobilePatientSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    mobileSurgeonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    mobileSurgeonText: {
        fontSize: 13,
        color: '#334155',
        flex: 1,
        minWidth: 0,
        flexShrink: 1,
    },
    mobileBillingStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    mobileBillingFee: {
        fontSize: 12,
        color: '#334155',
    },
    mobileBillingDue: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '700',
    },
    mobileBillingPaid: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '700',
    },
    mobileActionsContainer: {
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        gap: 8,
    },
    mobileSecondaryActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    mobileViewBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    mobileViewBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    mobileCancelBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
    },
    mobileCancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#dc2626',
    },
    progressBtnMobile: {
        width: '100%',
        minHeight: 44,
        borderRadius: 8,
        marginTop: 2,
    },
});

export default OTSchedulePage;
