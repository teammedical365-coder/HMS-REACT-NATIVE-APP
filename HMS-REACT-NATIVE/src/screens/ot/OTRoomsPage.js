import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { SurgeryDetailsModal } from './OTModals';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const OTRoomsPage = () => {
    const [rooms, setRooms] = useState([]);
    const [summary, setSummary] = useState({ available: 0, inOt: 0, delayed: 0, scheduled: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, AVAILABLE, SCHEDULED, IN_OT, DELAYED, MAINTENANCE

    // Modals
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const fetchRoomsData = useCallback(async () => {
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const res = await otAPI.getRoomStatus(today);
            if (res.success) {
                setRooms(res.rooms || []);
                if (res.summary) setSummary(res.summary);
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch rooms error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoomsData();

        const handleUpdate = () => fetchRoomsData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
        };
    }, [fetchRoomsData]);

    const filteredRooms = rooms.filter(r => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const rName = (r.name || '').toLowerCase();
            const proc = (r.currentSurgery?.procedure || r.nextSurgery?.procedure || '').toLowerCase();
            const sName = (r.currentSurgery?.surgeon || '').toLowerCase();
            const pName = (r.currentSurgery?.patientName || '').toLowerCase();
            if (!rName.includes(q) && !proc.includes(q) && !sName.includes(q) && !pName.includes(q)) {
                return false;
            }
        }

        const st = (r.status || '').toUpperCase();
        if (activeFilter === 'AVAILABLE') return st === 'AVAILABLE';
        if (activeFilter === 'SCHEDULED') return st === 'SCHEDULED';
        if (activeFilter === 'IN_OT') return st === 'IN OT' || st === 'IN_OT';
        if (activeFilter === 'DELAYED') return st === 'DELAYED';
        if (activeFilter === 'MAINTENANCE') return st === 'MAINTENANCE' || st === 'UNAVAILABLE';

        return true;
    });

    const filters = [
        { id: 'ALL', label: `All Rooms (${rooms.length})` },
        { id: 'AVAILABLE', label: `Available (${summary.available})` },
        { id: 'IN_OT', label: `In OT (${summary.inOt})` },
        { id: 'SCHEDULED', label: `Scheduled (${summary.scheduled})` },
        { id: 'DELAYED', label: `Delayed (${summary.delayed})` },
        { id: 'MAINTENANCE', label: 'Maintenance' }
    ];

    return (
        <View style={styles.container}>
            <OTHeader
                title="OT Rooms & Live Suite Board"
                subtitle="Live status, capacity, intraoperative monitoring, and real-time equipment allocation for all OT suites."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchRoomsData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ roomsInUse: summary.inOt }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Room Summary KPI Cards */}
                <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                        <View>
                            <Text style={styles.kpiTitle}>Total Rooms</Text>
                            <Text style={styles.kpiValue}>{rooms.length}</Text>
                        </View>
                        <Feather name="box" size={28} color="#64748b" />
                    </View>

                    <View style={[styles.kpiCard, styles.kpiCardAvailable]}>
                        <View>
                            <Text style={[styles.kpiTitle, { color: '#166534' }]}>Available Now</Text>
                            <Text style={[styles.kpiValue, { color: '#15803d' }]}>{summary.available}</Text>
                        </View>
                        <Feather name="check-circle" size={28} color="#16a34a" />
                    </View>

                    <View style={[styles.kpiCard, styles.kpiCardInOT]}>
                        <View>
                            <Text style={[styles.kpiTitle, { color: '#991b1b' }]}>In OT (Active)</Text>
                            <Text style={[styles.kpiValue, { color: '#b91c1c' }]}>{summary.inOt}</Text>
                        </View>
                        <Feather name="activity" size={28} color="#ef4444" />
                    </View>

                    <View style={[styles.kpiCard, styles.kpiCardScheduled]}>
                        <View>
                            <Text style={[styles.kpiTitle, { color: '#1e40af' }]}>Scheduled Next</Text>
                            <Text style={[styles.kpiValue, { color: '#2563eb' }]}>{summary.scheduled}</Text>
                        </View>
                        <Feather name="clock" size={28} color="#3b82f6" />
                    </View>

                    <View style={[styles.kpiCard, styles.kpiCardDelayed]}>
                        <View>
                            <Text style={[styles.kpiTitle, { color: '#92400e' }]}>Delayed</Text>
                            <Text style={[styles.kpiValue, { color: '#b45309' }]}>{summary.delayed}</Text>
                        </View>
                        <Feather name="alert-triangle" size={28} color="#f59e0b" />
                    </View>
                </View>

                {/* Filter Tabs */}
                <View style={styles.filterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {filters.map(f => (
                            <TouchableOpacity
                                key={f.id}
                                onPress={() => setActiveFilter(f.id)}
                                style={[styles.filterBtn, activeFilter === f.id && styles.filterBtnActive]}
                            >
                                <Text style={[styles.filterBtnText, activeFilter === f.id && styles.filterBtnTextActive]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Room Grid */}
                {filteredRooms.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="box" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No OT Rooms Match Filter</Text>
                        <Text style={styles.emptySub}>
                            Try changing your filter or search query.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.roomGrid}>
                        {filteredRooms.map(room => {
                            const isOccupied = room.status === 'In OT' || room.status === 'IN_OT';
                            const isAvailable = room.status === 'Available' || room.status === 'AVAILABLE';
                            const isDelayed = room.status === 'Delayed';
                            const isScheduled = room.status === 'Scheduled';

                            return (
                                <View
                                    key={room._id}
                                    style={[
                                        styles.roomCard,
                                        isOccupied && styles.roomCardOccupied,
                                        isAvailable && styles.roomCardAvailable,
                                        isDelayed && styles.roomCardDelayed,
                                    ]}
                                >
                                    <View>
                                        {/* Header: Room Name + Status Badge */}
                                        <View style={styles.roomCardHeader}>
                                            <View style={styles.roomHeaderLeft}>
                                                <Text style={styles.roomIconText}>🚪</Text>
                                                <View>
                                                    <Text style={styles.roomNameText}>{room.name}</Text>
                                                    <Text style={styles.roomTypeText}>{room.roomType || 'General OT Suite'}</Text>
                                                </View>
                                            </View>

                                            <View style={[
                                                styles.statusBadge,
                                                isOccupied ? styles.statusOccupied : (isAvailable ? styles.statusAvailable : (isDelayed ? styles.statusDelayed : styles.statusScheduled))
                                            ]}>
                                                <Text style={[
                                                    styles.statusBadgeText,
                                                    isOccupied ? styles.statusTextOccupied : (isAvailable ? styles.statusTextAvailable : (isDelayed ? styles.statusTextDelayed : styles.statusTextScheduled))
                                                ]}>
                                                    {room.status}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Active In-OT Surgery Card */}
                                        {room.currentSurgery ? (
                                            <View style={styles.activeSurgeryBox}>
                                                <View style={styles.activeSurgeryHeader}>
                                                    <Text style={styles.activeSurgeryAlertText}>🔴 ACTIVE SURGERY IN PROGRESS</Text>
                                                    {room.currentSurgery.elapsedTime ? (
                                                        <View style={styles.elapsedTimeBadge}>
                                                            <Text style={styles.elapsedTimeText}>⏱️ {room.currentSurgery.elapsedTime}</Text>
                                                        </View>
                                                    ) : null}
                                                </View>

                                                <Text style={styles.activeProcedureText}>{room.currentSurgery.procedure}</Text>

                                                <Text style={styles.activePatientText}>
                                                    Patient: <Text style={styles.boldText}>{room.currentSurgery.patientName || 'Patient'}</Text>
                                                </Text>
                                                <Text style={styles.activeSurgeonText}>
                                                    Surgeon: <Text style={styles.boldText}>Dr. {(room.currentSurgery.surgeon || 'Doctor').replace(/^Dr\.?\s*/i, '')}</Text>
                                                </Text>
                                                
                                                {room.currentSurgery.startTime ? (
                                                    <Text style={styles.activeTimeText}>
                                                        Scheduled: {room.currentSurgery.startTime} - {room.currentSurgery.endTime}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ) : (
                                            <View style={styles.inactiveSurgeryBox}>
                                                {isAvailable ? (
                                                    <View style={styles.availableBoxRow}>
                                                        <Feather name="check-circle" size={14} color="#16a34a" />
                                                        <Text style={styles.availableBoxText}>Available for immediate scheduling</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.inactiveBoxText}>No surgery currently in OT.</Text>
                                                )}
                                            </View>
                                        )}

                                        {/* Next Scheduled Surgery Preview */}
                                        {room.nextSurgery ? (
                                            <View style={styles.nextSurgeryBox}>
                                                <Text style={styles.nextSurgeryLabel}>Next in Queue: </Text>
                                                <Text style={styles.nextSurgeryValue}>
                                                    <Text style={styles.boldText}>{room.nextSurgery.procedure}</Text> at {room.nextSurgery.time}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Bottom Actions */}
                                    <View style={styles.roomActionsRow}>
                                        {room.currentSurgery?.rawSurgery ? (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSelectedSurgery(room.currentSurgery.rawSurgery);
                                                    setShowDetailsModal(true);
                                                }}
                                                style={styles.viewActionBtn}
                                            >
                                                <Text style={styles.viewActionBtnText}>View Active Surgery</Text>
                                            </TouchableOpacity>
                                        ) : null}
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
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
    },
    kpiCard: {
        flex: 1,
        minWidth: 150,
        backgroundColor: '#ffffff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    kpiCardAvailable: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
    kpiCardInOT: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    kpiCardScheduled: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    kpiCardDelayed: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
    kpiTitle: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    kpiValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    filterBar: {
        backgroundColor: '#ffffff',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    filterScroll: {
        flexDirection: 'row',
        gap: 8,
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    filterBtnActive: {
        backgroundColor: '#0f172a',
    },
    filterBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#475569',
    },
    filterBtnTextActive: {
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
    roomGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 18,
    },
    roomCard: {
        width: isTablet ? '48%' : '100%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        justifyContent: 'space-between',
    },
    roomCardOccupied: {
        backgroundColor: '#fff5f5',
        borderColor: '#fca5a5',
    },
    roomCardAvailable: {
        backgroundColor: '#fafffd',
        borderColor: '#86efac',
    },
    roomCardDelayed: {
        borderColor: '#fde68a',
    },
    roomCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    roomHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    roomIconText: {
        fontSize: 22,
    },
    roomNameText: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0f172a',
    },
    roomTypeText: {
        fontSize: 12,
        color: '#64748b',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    statusOccupied: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
    statusAvailable: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
    statusDelayed: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
    statusScheduled: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '900',
    },
    statusTextOccupied: { color: '#b91c1c' },
    statusTextAvailable: { color: '#15803d' },
    statusTextDelayed: { color: '#b45309' },
    statusTextScheduled: { color: '#1d4ed8' },
    activeSurgeryBox: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
    },
    activeSurgeryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    activeSurgeryAlertText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#dc2626',
    },
    elapsedTimeBadge: {
        backgroundColor: '#fee2e2',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    elapsedTimeText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#b91c1c',
    },
    activeProcedureText: {
        fontSize: 15,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 4,
    },
    activePatientText: {
        fontSize: 13,
        color: '#334155',
        marginTop: 4,
    },
    activeSurgeonText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    activeTimeText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    inactiveSurgeryBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 14,
    },
    availableBoxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    availableBoxText: {
        color: '#16a34a',
        fontWeight: 'bold',
        fontSize: 13,
    },
    inactiveBoxText: {
        color: '#64748b',
        fontSize: 13,
    },
    nextSurgeryBox: {
        flexDirection: 'row',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
    },
    nextSurgeryLabel: {
        fontWeight: 'bold',
        color: '#1d4ed8',
        fontSize: 12,
    },
    nextSurgeryValue: {
        color: '#475569',
        fontSize: 12,
    },
    boldText: {
        fontWeight: 'bold',
    },
    roomActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    viewActionBtn: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
    },
    viewActionBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#334155',
    },
});

export default OTRoomsPage;
