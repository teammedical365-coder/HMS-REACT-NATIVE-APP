import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
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
import { useOTResponsive } from './otResponsive';

const OTDashboard = () => {
    const navigation = useNavigation();
    const { width, isSmallPhone, isPhone, isTablet, isLargeTablet, pagePadding, cardPadding, gap } = useOTResponsive();
    const isMobile = !isTablet;
    const isSmallMobile = isSmallPhone;
    const kpiCardWidth = isSmallPhone ? '100%' : isPhone ? '48%' : isLargeTablet ? '23%' : '31%';

    // Data states
    const [stats, setStats] = useState({
        todaySurgeries: 0,
        upcomingSurgeries: 0,
        plannedPatients: 0,
        preOpPatients: 0,
        postOpPatients: 0,
        occupiedRooms: 0,
        totalRooms: 0
    });
    const [rooms, setRooms] = useState([]);
    const [roomSummary, setRoomSummary] = useState({ available: 0, inOt: 0, delayed: 0, scheduled: 0, total: 0 });
    const [alerts, setAlerts] = useState([]);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [plannedSurgeries, setPlannedSurgeries] = useState([]);
    const [doctorsList, setDoctorsList] = useState([]);
    const [otRoomsList, setOtRoomsList] = useState([]);

    // UI states
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [activePlanToSchedule, setActivePlanToSchedule] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [bedModal, setBedModal] = useState({ open: false, actionType: null, patientId: null, surgeryId: null });

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];

            const [statsRes, roomsRes, alertsRes, scheduleRes, plannedRes, docsRes, allRoomsRes] = await Promise.all([
                otAPI.getDashboardStats(),
                otAPI.getRoomStatus(today),
                otAPI.getWorkflowAlerts(today),
                otAPI.getTodaySchedule(today),
                otAPI.getPlannedSurgeries(),
                doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
                otAPI.getRooms().catch(() => ({ rooms: [] }))
            ]);

            if (statsRes.success) setStats(statsRes.stats);
            if (roomsRes.success) {
                setRooms(roomsRes.rooms || []);
                if (roomsRes.summary) setRoomSummary(roomsRes.summary);
            }
            if (alertsRes.success) setAlerts(alertsRes.alerts || []);
            if (scheduleRes.success) setTodaySchedule(scheduleRes.schedule || []);
            if (plannedRes.success) setPlannedSurgeries(plannedRes.surgeries || []);
            if (docsRes.doctors) setDoctorsList(docsRes.doctors);
            if (allRoomsRes.rooms) setOtRoomsList(allRoomsRes.rooms);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('OT Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const [userHospitalId, setUserHospitalId] = useState('');

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                if (userStr) {
                    const u = JSON.parse(userStr);
                    const hid = u.hospitalId || (u.hospital?._id || u.hospital) || '';
                    setUserHospitalId(hid);
                }
            } catch (err) {
                console.error('OT user load error:', err);
            }
        };
        loadUser();
    }, []);

    useEffect(() => {
        fetchDashboardData();

        if (!socket) return;
        const handleOtUpdate = () => fetchDashboardData();
        socket.on('ot_update', handleOtUpdate);
        socket.on('ot_surgery_scheduled', handleOtUpdate);
        socket.on('surgery_plan_created', handleOtUpdate);

        return () => {
            socket.off('ot_update', handleOtUpdate);
            socket.off('ot_surgery_scheduled', handleOtUpdate);
            socket.off('surgery_plan_created', handleOtUpdate);
        };
    }, [fetchDashboardData]);

    const handleWorkflowTransition = async (surgeryId, nextStatus) => {
        try {
            const res = await otAPI.updateSurgeryWorkflow(surgeryId, { status: nextStatus });
            if (res.success) {
                Alert.alert('Success', 'Workflow transition updated');
                fetchDashboardData();
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Workflow transition failed');
        }
    };

    // Calculate badge counts for header
    const inOtCount = todaySchedule.filter(s => s.status === 'IN_OT').length;
    const preOpCount = todaySchedule.filter(s => s.status === 'PRE_OP' || s.status === 'READY_FOR_OT').length;
    const postOpCount = todaySchedule.filter(s => s.status === 'POST_OP').length;
    const completedCount = todaySchedule.filter(s => s.status === 'COMPLETED' || s.status === 'SURGERY_COMPLETED').length;

    // Filter preview records by global search if entered
    const matchesSearch = (item) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const pName = (item.patientId?.name || '').toLowerCase();
        const pMrn = (item.patientId?.mrn || item.patientId?.patientId || '').toLowerCase();
        const proc = (item.surgery || '').toLowerCase();
        const sName = (item.surgeonId?.name || '').toLowerCase();
        const rName = (item.otRoomId?.name || '').toLowerCase();
        const planId = (item.planId || '').toLowerCase();
        return pName.includes(q) || pMrn.includes(q) || proc.includes(q) || sName.includes(q) || rName.includes(q) || planId.includes(q);
    };

    const previewSchedule = todaySchedule.filter(matchesSearch).slice(0, 4);
    const previewRooms = rooms.slice(0, 4);
    const previewPlanned = plannedSurgeries.filter(matchesSearch).slice(0, 4);

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}>
            {/* Header & Tabs */}
            <OTHeader
                title="Operation Theatre Command Center"
                subtitle="Real-time operational overview, department KPIs, and quick access modules."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchDashboardData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{
                    planned: stats.plannedPatients,
                    today: stats.todaySurgeries,
                    roomsInUse: roomSummary.inOt,
                    preOp: preOpCount,
                    inOt: inOtCount,
                    postOp: postOpCount,
                    completed: completedCount
                }}
            />

            {/* ========================================================= */}
            {/* 1. KPI SUMMARY SECTION (7 CARDS)                          */}
            {/* ========================================================= */}
            <View style={[styles.kpiGrid, { gap }]}>
                {/* 1. Today's Surgeries */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTSchedulePage')}
                    style={[styles.kpiCard, { borderColor: '#e2e8f0', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#3b82f6' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>TODAY'S SURGERIES</Text>
                        <Feather name="calendar" size={18} color="#3b82f6" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#0f172a' }, isSmallPhone && { fontSize: 24 }]}>{stats.todaySurgeries}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#3b82f6' }]}>View Schedule</Text>
                        <Feather name="arrow-right" size={12} color="#3b82f6" />
                    </View>
                </TouchableOpacity>

                {/* 2. In OT */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTInProgressPage')}
                    style={[styles.kpiCard, { borderColor: '#fee2e2', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#ef4444' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>IN OT</Text>
                        <Feather name="activity" size={18} color="#ef4444" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#dc2626' }, isSmallPhone && { fontSize: 24 }]}>{roomSummary.inOt}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#dc2626' }]}>Live In-OT Feed</Text>
                        <Feather name="arrow-right" size={12} color="#dc2626" />
                    </View>
                </TouchableOpacity>

                {/* 3. Available OT Rooms */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTRoomsPage')}
                    style={[styles.kpiCard, { borderColor: '#dcfce7', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#22c55e' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>AVAILABLE OT</Text>
                        <Feather name="box" size={18} color="#22c55e" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#16a34a' }, isSmallPhone && { fontSize: 24 }]}>{roomSummary.available}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#16a34a' }]}>View Rooms</Text>
                        <Feather name="arrow-right" size={12} color="#16a34a" />
                    </View>
                </TouchableOpacity>

                {/* 4. Occupied OT Rooms */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTRoomsPage')}
                    style={[styles.kpiCard, { borderColor: '#fed7aa', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#f97316' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>OCCUPIED OT</Text>
                        <Feather name="box" size={18} color="#f97316" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#ea580c' }, isSmallPhone && { fontSize: 24 }]}>{roomSummary.inOt + roomSummary.scheduled}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#ea580c' }]}>Room Board</Text>
                        <Feather name="arrow-right" size={12} color="#ea580c" />
                    </View>
                </TouchableOpacity>

                {/* 5. Pre-Op Patients */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTPreOpPage')}
                    style={[styles.kpiCard, { borderColor: '#fef08a', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#eab308' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>PRE-OP PATIENTS</Text>
                        <Feather name="users" size={18} color="#eab308" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#ca8a04' }, isSmallPhone && { fontSize: 24 }]}>{preOpCount}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#ca8a04' }]}>View Pre-Op</Text>
                        <Feather name="arrow-right" size={12} color="#ca8a04" />
                    </View>
                </TouchableOpacity>

                {/* 6. Completed Today */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTCompletedPage')}
                    style={[styles.kpiCard, { borderColor: '#c7d2fe', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#6366f1' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>COMPLETED TODAY</Text>
                        <Feather name="check-circle" size={18} color="#6366f1" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#4f46e5' }, isSmallPhone && { fontSize: 24 }]}>{completedCount}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#4f46e5' }]}>View History</Text>
                        <Feather name="arrow-right" size={12} color="#4f46e5" />
                    </View>
                </TouchableOpacity>

                {/* 7. Planned Surgeries */}
                <TouchableOpacity
                    onPress={() => navigation.navigate('OTPlannedSurgeries')}
                    style={[styles.kpiCard, { borderColor: '#e9d5ff', width: kpiCardWidth, minWidth: 0, padding: cardPadding }]}
                    activeOpacity={0.7}
                >
                    <View style={[styles.kpiIndicator, { backgroundColor: '#a855f7' }]} />
                    <View style={styles.kpiHeader}>
                        <Text style={[styles.kpiTitle, isSmallPhone && { fontSize: 11 }]}>PLANNED SURGERIES</Text>
                        <Feather name="clock" size={18} color="#a855f7" />
                    </View>
                    <Text style={[styles.kpiValue, { color: '#7e22ce' }, isSmallPhone && { fontSize: 24 }]}>{stats.plannedPatients}</Text>
                    <View style={styles.kpiAction}>
                        <Text style={[styles.kpiActionText, { color: '#7e22ce' }]}>Schedule Now</Text>
                        <Feather name="arrow-right" size={12} color="#7e22ce" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* ========================================================= */}
            {/* 2. ATTENTION REQUIRED ALERT CENTER                        */}
            {/* ========================================================= */}
            {alerts.length > 0 && (
                <View style={styles.alertCenterContainer}>
                    <View style={[styles.alertCenterHeader, isPhone && styles.alertCenterHeaderPhone]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexShrink: 1, minWidth: 0, width: '100%' }}>
                            <Feather name="alert-triangle" size={18} color="#dc2626" style={{ marginTop: 2 }} />
                            <Text
                                style={styles.alertCenterTitle}
                                numberOfLines={2}
                            >
                                Attention Required ({alerts.length} Actionable Alert{alerts.length > 1 ? 's' : ''})
                            </Text>
                        </View>
                        <Text style={styles.alertCenterSubtitle}>Clinical delays, missing admissions, and schedule conflicts</Text>
                    </View>

                    <View style={styles.alertGrid}>
                        {alerts.map((alert, idx) => (
                            <View
                                key={idx}
                                style={[
                                    styles.alertItem,
                                    {
                                        width: isPhone ? '100%' : '48%',
                                        minWidth: 0,
                                        flexDirection: isSmallPhone ? 'column' : 'row',
                                        alignItems: isSmallPhone ? 'stretch' : 'center',
                                        gap: 10,
                                    }
                                ]}
                            >
                                <View style={{ flex: 1, paddingRight: isSmallPhone ? 0 : 10 }}>
                                    <Text style={styles.alertItemTitle}>
                                        {alert.surgery?.surgery || 'Scheduled Procedure'}
                                    </Text>
                                    <Text style={styles.alertItemSubtitle}>
                                        Patient: <Text style={{ fontWeight: 'bold' }}>{alert.surgery?.patientId?.name || 'Patient'}</Text> | Room: <Text style={{ fontWeight: 'bold' }}>{alert.surgery?.otRoomId?.name || 'OT'}</Text>
                                    </Text>
                                    <Text style={styles.alertItemMessage}>
                                        ⚠️ {alert.message}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedSurgery(alert.surgery);
                                        setShowDetailsModal(true);
                                    }}
                                    style={[styles.alertBtnView, isSmallPhone && { alignSelf: 'flex-start' }]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.alertBtnViewText}>View Details</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* ========================================================= */}
            {/* 3. TODAY'S OPERATIONS (TWO-COLUMN PREVIEW)                 */}
            {/* ========================================================= */}
            <View style={[styles.previewColumnsContainer, { gap }]}>
                {/* Left Column: Today's OT Schedule Preview */}
                <View style={[styles.previewColumn, { width: isTablet ? '48%' : '100%', minWidth: 0, padding: cardPadding }]}>
                    <View style={[styles.previewHeader, isPhone && styles.previewHeaderPhone]}>
                        <View style={{ flex: isPhone ? undefined : 1, minWidth: 0, width: isPhone ? '100%' : undefined }}>
                            <Text style={styles.previewTitle} numberOfLines={2}>📅 Today's OT Schedule</Text>
                            <Text style={styles.previewSubtitle}>Showing {previewSchedule.length} of {todaySchedule.length} surgeries scheduled today</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('OTSchedulePage')}
                            style={[styles.previewLink, isPhone && styles.previewLinkPhone]}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.previewLinkText}>View Full Schedule</Text>
                            <Feather name="arrow-right" size={14} color="#2563eb" />
                        </TouchableOpacity>
                    </View>

                    {previewSchedule.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="calendar" size={32} color="#cbd5e1" style={{ marginBottom: 6 }} />
                            <Text style={styles.emptyStateText}>No surgeries scheduled for today.</Text>
                        </View>
                    ) : (
                        <View style={styles.previewList}>
                            {previewSchedule.map(s => {
                                const stInfo = getStatusStyle(s.status);
                                const isDelayed = checkIfDelayed(s);
                                const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
                                const assistants = s.assistantSurgeonIds || [];

                                return (
                                    <View
                                        key={s._id}
                                        style={[
                                            styles.previewItem,
                                            isSmallPhone && { flexDirection: 'column', alignItems: 'stretch' }
                                        ]}
                                    >
                                        <View style={{ flex: 1, paddingRight: isSmallPhone ? 0 : 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <Text style={styles.previewItemTitle}>{s.surgery}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: stInfo.bg, borderColor: stInfo.border }]}>
                                                    <Text style={[styles.statusBadgeText, { color: stInfo.color }]}>{stInfo.label}</Text>
                                                </View>
                                                {isDelayed && (
                                                    <View style={[styles.statusBadge, { backgroundColor: '#fee2e2', borderColor: '#fee2e2' }]}>
                                                        <Text style={[styles.statusBadgeText, { color: '#b91c1c' }]}>DELAYED</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.previewItemSub}>
                                                👤 <Text style={{ fontWeight: 'bold' }}>{s.patientId?.name || 'Patient'}</Text> | ⏰ {s.startTime || '--:--'} - {s.endTime || '--:--'} | 🚪 {s.otRoomId?.name || 'Unassigned OT'}
                                            </Text>
                                            <Text style={styles.previewItemSurgeon}>
                                                Surgeon: <Text style={{ fontWeight: 'bold' }}>Dr. {surgeonName}</Text>
                                                {assistants.length > 0 && (
                                                    <Text> • Assistants: {assistants.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}</Text>
                                                )}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedSurgery(s);
                                                setShowDetailsModal(true);
                                            }}
                                            style={[styles.btnViewDetails, isSmallPhone && { alignSelf: 'flex-start' }]}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.btnViewDetailsText}>View</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Right Column: Live OT Room Status Preview */}
                <View style={[styles.previewColumn, { width: isTablet ? '48%' : '100%', minWidth: 0, padding: cardPadding }]}>
                    <View style={[styles.previewHeader, isPhone && styles.previewHeaderPhone]}>
                        <View style={{ flex: isPhone ? undefined : 1, minWidth: 0, width: isPhone ? '100%' : undefined }}>
                            <Text style={styles.previewTitle} numberOfLines={2}>🏥 Live OT Room Status</Text>
                            <Text style={styles.previewSubtitle}>Showing {previewRooms.length} of {rooms.length} OT suites</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('OTRoomsPage')}
                            style={[styles.previewLink, isPhone && styles.previewLinkPhone]}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.previewLinkText}>View All OT Rooms</Text>
                            <Feather name="arrow-right" size={14} color="#2563eb" />
                        </TouchableOpacity>
                    </View>

                    {previewRooms.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="box" size={32} color="#cbd5e1" style={{ marginBottom: 6 }} />
                            <Text style={styles.emptyStateText}>No OT Rooms registered in this hospital.</Text>
                        </View>
                    ) : (
                        <View style={[styles.roomGrid, { gap }]}>
                            {previewRooms.map(r => {
                                const isOccupied = r.status === 'In OT' || r.status === 'IN_OT';
                                const isAvailable = r.status === 'Available' || r.status === 'AVAILABLE';

                                return (
                                    <View
                                        key={r._id}
                                        style={[
                                            styles.roomCard,
                                            {
                                                width: isSmallPhone ? '100%' : '48%',
                                                minWidth: 0,
                                                backgroundColor: isOccupied ? '#fef2f2' : (isAvailable ? '#f0fdf4' : '#eff6ff'),
                                                borderColor: isOccupied ? '#fecaca' : (isAvailable ? '#bbf7d0' : '#bfdbfe')
                                            }
                                        ]}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                            <Text style={styles.roomName}>🚪 {r.name}</Text>
                                            <View style={[
                                                styles.roomStatusBadge,
                                                { backgroundColor: isOccupied ? '#fee2e2' : (isAvailable ? '#dcfce7' : '#dbeafe') }
                                            ]}>
                                                <Text style={[
                                                    styles.roomStatusText,
                                                    { color: isOccupied ? '#b91c1c' : (isAvailable ? '#15803d' : '#1d4ed8') }
                                                ]}>
                                                    {r.status}
                                                </Text>
                                            </View>
                                        </View>

                                        {r.currentSurgery ? (
                                            <View>
                                                <Text style={styles.roomInfoText}><Text style={{ fontWeight: 'bold' }}>Procedure:</Text> {r.currentSurgery.procedure}</Text>
                                                <Text style={styles.roomInfoText}><Text style={{ fontWeight: 'bold' }}>Surgeon:</Text> Dr. {(r.currentSurgery.surgeon || '').replace(/^Dr\.?\s*/i, '')}</Text>
                                                {Boolean(r.currentSurgery.elapsedTime) && (
                                                    <Text style={styles.roomElapsedText}>
                                                        ⏱️ Elapsed: {r.currentSurgery.elapsedTime}
                                                    </Text>
                                                )}
                                            </View>
                                        ) : (
                                            <View>
                                                {r.nextSurgery ? (
                                                    <Text style={styles.roomInfoSubtext}>Next: <Text style={{ fontWeight: 'bold' }}>{r.nextSurgery.procedure}</Text> at {r.nextSurgery.time}</Text>
                                                ) : (
                                                    <Text style={styles.roomInfoSubtext}>Ready for immediate scheduling.</Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>

            {/* ========================================================= */}
            {/* 4. PLANNED SURGERIES PREVIEW (AWAITING OT SCHEDULING)      */}
            {/* ========================================================= */}
            <View style={[styles.plannedSection, { padding: cardPadding }]}>
                <View style={[styles.previewHeader, isPhone && styles.previewHeaderPhone]}>
                    <View style={{ flex: isPhone ? undefined : 1, minWidth: 0, width: isPhone ? '100%' : undefined }}>
                        <Text style={styles.previewTitle} numberOfLines={2}>📋 Planned Surgeries (Awaiting OT Scheduling)</Text>
                        <Text style={styles.previewSubtitle}>Showing {previewPlanned.length} of {plannedSurgeries.length} doctor-created surgery plans</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('OTPlannedSurgeries')}
                        style={[styles.previewLink, { backgroundColor: '#f5f3ff' }, isPhone && styles.previewLinkPhone]}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.previewLinkText, { color: '#7c3aed' }]}>View All Planned</Text>
                        <Feather name="arrow-right" size={14} color="#7c3aed" />
                    </TouchableOpacity>
                </View>

                {previewPlanned.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="clock" size={32} color="#cbd5e1" style={{ marginBottom: 6 }} />
                        <Text style={styles.emptyStateText}>No surgery plans awaiting OT scheduling. All planned procedures are booked.</Text>
                    </View>
                ) : (
                    <View style={[styles.plannedGrid, { gap }]}>
                        {previewPlanned.map(plan => {
                            const surgeonName = (plan.surgeonId?.name || plan.doctorId?.name || 'Doctor').replace(/^Dr\.?\s*/i, '');

                            return (
                                <View key={plan._id} style={[styles.plannedCard, { width: isTablet ? '48%' : '100%', minWidth: 0, padding: cardPadding }]}>
                                    <View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                                            <Text style={styles.plannedTitle}>{plan.surgery}</Text>
                                            {Boolean(plan.planId) && (
                                                <View style={styles.plannedIdBadge}>
                                                    <Text style={styles.plannedIdText}>{plan.planId}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.plannedPatientText}>
                                            👤 <Text style={{ fontWeight: 'bold' }}>{plan.patientId?.name || 'Patient'}</Text> [MRN: {plan.patientId?.mrn || plan.patientId?.patientId || '-'}]
                                        </Text>
                                        <Text style={styles.plannedSurgeonText}>
                                            Surgeon: <Text style={{ fontWeight: 'bold' }}>Dr. {surgeonName}</Text> | Pref: {new Date(plan.preferredDate || plan.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        </Text>
                                    </View>

                                    <View style={styles.plannedActionArea}>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedSurgery(plan);
                                                setShowDetailsModal(true);
                                            }}
                                            style={[styles.btnPlannedView, isPhone && { flex: 1 }]}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.btnPlannedViewText}>View Plan</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setActivePlanToSchedule(plan);
                                                setShowScheduleModal(true);
                                            }}
                                            style={[styles.btnPlannedSchedule, isPhone && { flex: 1.4 }]}
                                            activeOpacity={0.7}
                                        >
                                            <Feather name="calendar" size={14} color="#fff" />
                                            <Text style={styles.btnPlannedScheduleText}>Schedule OT</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>

            {/* Modals */}
            {showDetailsModal && (
                <SurgeryDetailsModal
                    open={showDetailsModal}
                    surgery={selectedSurgery}
                    onClose={() => {
                        setShowDetailsModal(false);
                        setSelectedSurgery(null);
                    }}
                    onOpenScheduleModal={(plan) => {
                        setActivePlanToSchedule(plan);
                        setShowScheduleModal(true);
                    }}
                />
            )}

            {showScheduleModal && (
                <ScheduleSurgeryModal
                    open={showScheduleModal}
                    activePlan={activePlanToSchedule}
                    doctorsList={doctorsList}
                    otRoomsList={otRoomsList}
                    onClose={() => {
                        setShowScheduleModal(false);
                        setActivePlanToSchedule(null);
                    }}
                    onSuccess={() => {
                        fetchDashboardData();
                    }}
                />
            )}

            {bedModal.open && (
                <WorkflowBedModal
                    open={bedModal.open}
                    actionType={bedModal.actionType}
                    patientId={bedModal.patientId}
                    surgeryId={bedModal.surgeryId}
                    onClose={() => setBedModal({ open: false, actionType: null, patientId: null, surgeryId: null })}
                    onSuccess={() => fetchDashboardData()}
                />
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        padding: 16,
        paddingBottom: 40,
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    kpiCard: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 14,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    kpiIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 4,
        height: '100%',
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    kpiTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    kpiValue: {
        fontSize: 30,
        fontWeight: '900',
    },
    kpiAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    kpiActionText: {
        fontSize: 12,
        fontWeight: '700',
    },
    alertCenterContainer: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderColor: '#fecaca',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        marginBottom: 24,
        overflow: 'hidden',
    },
    alertCenterHeader: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: '#fef2f2',
        borderBottomWidth: 1,
        borderBottomColor: '#fee2e2',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    alertCenterHeaderPhone: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
    },
    alertCenterTitle: {
        fontWeight: '800',
        color: '#991b1b',
        fontSize: 15,
        lineHeight: 20,
        flexShrink: 1,
        minWidth: 0,
    },
    alertCenterSubtitle: {
        fontSize: 12,
        color: '#991b1b',
        fontWeight: '600',
    },
    alertGrid: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    alertItem: {
        backgroundColor: '#fff',
        borderColor: '#fee2e2',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    alertItemTitle: {
        fontWeight: '700',
        color: '#1e293b',
        fontSize: 14,
    },
    alertItemSubtitle: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
    },
    alertItemMessage: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
        marginTop: 4,
    },
    alertBtnView: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        borderWidth: 1,
        borderRadius: 6,
    },
    alertBtnViewText: {
        color: '#b91c1c',
        fontSize: 12,
        fontWeight: '700',
    },
    previewColumnsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 24,
    },
    previewColumn: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        padding: 20,
        flexDirection: 'column',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 12,
        flexWrap: 'wrap',
        gap: 10,
    },
    previewHeaderPhone: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
    },
    previewLinkPhone: {
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    previewSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    previewLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        gap: 4,
        backgroundColor: '#eff6ff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    previewLinkText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#2563eb',
    },
    emptyState: {
        padding: 36,
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
    },
    emptyStateText: {
        color: '#94a3b8',
        fontSize: 14,
    },
    previewList: {
        flexDirection: 'column',
        gap: 10,
    },
    previewItem: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    previewItemTitle: {
        fontWeight: '800',
        color: '#0f172a',
        fontSize: 14,
    },
    statusBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    previewItemSub: {
        fontSize: 12,
        color: '#475569',
        marginTop: 3,
    },
    previewItemSurgeon: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    btnViewDetails: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 6,
    },
    btnViewDetailsText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    roomGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    roomCard: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    roomName: {
        fontWeight: '800',
        color: '#0f172a',
        fontSize: 14,
    },
    roomStatusBadge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    roomStatusText: {
        fontSize: 10,
        fontWeight: '800',
    },
    roomInfoText: {
        fontSize: 12,
        color: '#334155',
    },
    roomElapsedText: {
        color: '#dc2626',
        fontWeight: '700',
        marginTop: 2,
        fontSize: 12,
    },
    roomInfoSubtext: {
        fontSize: 12,
        color: '#64748b',
    },
    plannedSection: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        padding: 20,
        marginBottom: 24,
    },
    plannedGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    plannedCard: {
        backgroundColor: '#faf5ff',
        borderColor: '#e9d5ff',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    plannedTitle: {
        fontWeight: '800',
        color: '#581c87',
        fontSize: 16,
    },
    plannedIdBadge: {
        backgroundColor: '#e9d5ff',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    plannedIdText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#6b21a8',
    },
    plannedPatientText: {
        fontSize: 12,
        color: '#334155',
    },
    plannedSurgeonText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    plannedActionArea: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f3e8ff',
    },
    btnPlannedView: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderColor: '#d8b4fe',
        borderWidth: 1,
        borderRadius: 6,
    },
    btnPlannedViewText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b21a8',
    },
    btnPlannedSchedule: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: '#7c3aed',
        borderRadius: 6,
    },
    btnPlannedScheduleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    }
});

export default OTDashboard;
