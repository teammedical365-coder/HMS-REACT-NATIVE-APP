import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Dimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { otAPI, doctorAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { 
    getStatusStyle, 
    SurgeryDetailsModal, 
    ScheduleSurgeryModal 
} from './OTModals';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const OTPlannedSurgeries = () => {
    const [plannedSurgeries, setPlannedSurgeries] = useState([]);
    const [doctorsList, setDoctorsList] = useState([]);
    const [otRoomsList, setOtRoomsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Filters & Search
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, ADMISSION_REQ, NO_ADMISSION, TODAY, UPCOMING

    // Modals
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [activePlanToSchedule, setActivePlanToSchedule] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const fetchPlannedData = useCallback(async () => {
        setLoading(true);
        try {
            const [plannedRes, docsRes, roomsRes] = await Promise.all([
                otAPI.getPlannedSurgeries(),
                doctorAPI.getDoctors().catch(() => ({ doctors: [] })),
                otAPI.getRooms().catch(() => ({ rooms: [] }))
            ]);

            if (plannedRes.success) {
                setPlannedSurgeries(plannedRes.surgeries || []);
            }
            if (docsRes.doctors) setDoctorsList(docsRes.doctors);
            if (roomsRes.rooms) setOtRoomsList(roomsRes.rooms);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch planned error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlannedData();

        const handleUpdate = () => fetchPlannedData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
        };
    }, [fetchPlannedData]);

    const handleCancelPlan = async (planId) => {
        Alert.alert(
            'Confirm Cancel',
            'Are you sure you want to cancel this surgery plan?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await otAPI.cancelSurgery(planId);
                            if (res.success) {
                                fetchPlannedData();
                            }
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Failed to cancel surgery plan');
                        }
                    }
                }
            ]
        );
    };

    // Filter logic
    const filteredSurgeries = plannedSurgeries.filter(plan => {
        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const pName = (plan.patientId?.name || '').toLowerCase();
            const pMrn = (plan.patientId?.mrn || plan.patientId?.patientId || '').toLowerCase();
            const proc = (plan.surgery || '').toLowerCase();
            const sName = (plan.surgeonId?.name || plan.doctorId?.name || '').toLowerCase();
            const planIdStr = (plan.planId || '').toLowerCase();
            if (!pName.includes(q) && !pMrn.includes(q) && !proc.includes(q) && !sName.includes(q) && !planIdStr.includes(q)) {
                return false;
            }
        }

        // Tab filter
        const todayStr = new Date().toISOString().split('T')[0];
        const prefDate = plan.preferredDate ? new Date(plan.preferredDate).toISOString().split('T')[0] : null;

        if (activeFilter === 'ADMISSION_REQ') return Boolean(plan.admissionRequired);
        if (activeFilter === 'NO_ADMISSION') return !plan.admissionRequired;
        if (activeFilter === 'TODAY') return prefDate === todayStr;
        if (activeFilter === 'UPCOMING') return prefDate && prefDate > todayStr;

        return true;
    });

    const filters = [
        { id: 'ALL', label: `All Plans (${plannedSurgeries.length})` },
        { id: 'ADMISSION_REQ', label: `Admission Req (${plannedSurgeries.filter(p => p.admissionRequired).length})` },
        { id: 'NO_ADMISSION', label: `Day Care (${plannedSurgeries.filter(p => !p.admissionRequired).length})` },
        { id: 'TODAY', label: 'Preferred Today' },
        { id: 'UPCOMING', label: 'Upcoming' }
    ];

    return (
        <View style={styles.container}>
            <OTHeader
                title="Planned Surgeries"
                subtitle="Review consultation surgery plans and schedule OT suites."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchPlannedData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                badgeCounts={{ planned: plannedSurgeries.length }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Filter Bar */}
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
                    <View style={styles.resultsCount}>
                        <Text style={styles.resultsCountText}>
                            Showing <Text style={styles.boldText}>{filteredSurgeries.length}</Text> plans
                        </Text>
                    </View>
                </View>

                {/* Planned Surgeries Cards */}
                {filteredSurgeries.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="clock" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Planned Surgeries Found</Text>
                        <Text style={styles.emptySub}>
                            {searchQuery ? 'No planned surgeries matched your search query.' : 'There are currently no doctor-created surgery plans waiting for OT scheduling.'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {filteredSurgeries.map(plan => {
                            const surgeonName = (plan.surgeonId?.name || plan.doctorId?.name || 'Doctor').replace(/^Dr\.?\s*/i, '');
                            const referringDoctor = plan.referringDoctorId?.name ? (plan.referringDoctorId?.name).replace(/^Dr\.?\s*/i, '') : null;
                            const assistants = plan.assistantSurgeonIds || [];

                            return (
                                <View key={plan._id} style={styles.card}>
                                    <View>
                                        {/* Top Line */}
                                        <View style={styles.cardHeaderRow}>
                                            <View style={styles.cardHeaderLeft}>
                                                <View style={styles.planIdBadge}>
                                                    <Text style={styles.planIdText}>{plan.planId || 'PLAN'}</Text>
                                                </View>
                                                <Text style={styles.createdDateText}>
                                                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            <View style={[styles.admissionBadge, plan.admissionRequired ? styles.admissionBadgeReq : styles.admissionBadgeNo]}>
                                                <Text style={[styles.admissionBadgeText, plan.admissionRequired ? styles.admissionBadgeTextReq : styles.admissionBadgeTextNo]}>
                                                    {plan.admissionRequired ? '🏥 Admission Req' : 'Day Care'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Procedure Title */}
                                        <Text style={styles.surgeryTitle}>{plan.surgery}</Text>

                                        {/* Patient Info */}
                                        <View style={styles.patientInfoBox}>
                                            <Text style={styles.patientName}>👤 {plan.patientId?.name || 'Patient'}</Text>
                                            <Text style={styles.patientSubInfo}>
                                                MRN: <Text style={styles.boldText}>{plan.patientId?.mrn || plan.patientId?.patientId || '-'}</Text>
                                                {plan.patientId?.phone ? ` • 📞 ${plan.patientId.phone}` : ''}
                                            </Text>
                                        </View>

                                        {/* Clinical Info Grid */}
                                        <View style={styles.clinicalGrid}>
                                            <View style={styles.clinicalItem}>
                                                <Text style={styles.clinicalLabel}>OPERATING SURGEON</Text>
                                                <Text style={styles.clinicalValue}>Dr. {surgeonName}</Text>
                                            </View>
                                            <View style={styles.clinicalItem}>
                                                <Text style={styles.clinicalLabel}>PREFERRED DATE</Text>
                                                <Text style={styles.clinicalValue}>
                                                    {plan.preferredDate ? new Date(plan.preferredDate).toLocaleDateString() : 'Flexible'}
                                                </Text>
                                            </View>
                                            {referringDoctor && referringDoctor !== surgeonName && (
                                                <View style={styles.clinicalItem}>
                                                    <Text style={styles.clinicalLabel}>REFERRING DOCTOR</Text>
                                                    <Text style={styles.clinicalValueSub}>Dr. {referringDoctor}</Text>
                                                </View>
                                            )}
                                            {plan.diagnosis ? (
                                                <View style={styles.clinicalItem}>
                                                    <Text style={styles.clinicalLabel}>DIAGNOSIS</Text>
                                                    <Text style={styles.clinicalValueSub}>{plan.diagnosis}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        {assistants.length > 0 && (
                                            <Text style={styles.assistantsText}>
                                                <Text style={styles.assistantsLabel}>Assistants: </Text>
                                                {assistants.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}
                                            </Text>
                                        )}

                                        {plan.notes ? (
                                            <View style={styles.notesBox}>
                                                <Text style={styles.notesText}>"{plan.notes}"</Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Action Buttons */}
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity onPress={() => handleCancelPlan(plan._id)} style={styles.cancelBtn}>
                                            <Text style={styles.cancelBtnText}>Cancel Plan</Text>
                                        </TouchableOpacity>

                                        <View style={styles.actionRight}>
                                            <TouchableOpacity 
                                                style={styles.viewPlanBtn}
                                                onPress={() => {
                                                    setSelectedSurgery(plan);
                                                    setShowDetailsModal(true);
                                                }}
                                            >
                                                <Text style={styles.viewPlanBtnText}>View Plan</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={styles.scheduleBtn}
                                                onPress={() => {
                                                    setActivePlanToSchedule(plan);
                                                    setShowScheduleModal(true);
                                                }}
                                            >
                                                <Feather name="calendar" size={14} color="white" style={styles.scheduleIcon} />
                                                <Text style={styles.scheduleBtnText}>Schedule OT</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <SurgeryDetailsModal
                open={showDetailsModal}
                surgery={selectedSurgery}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedSurgery(null);
                }}
                onOpenScheduleModal={(plan) => {
                    setShowDetailsModal(false);
                    setTimeout(() => {
                        setActivePlanToSchedule(plan);
                        setShowScheduleModal(true);
                    }, 500); // small delay to prevent modal stacking issues on native
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
                onSuccess={() => {
                    fetchPlannedData();
                    setShowScheduleModal(false);
                    setActivePlanToSchedule(null);
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
    filterBar: {
        backgroundColor: '#ffffff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        gap: 12,
    },
    filterScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 4,
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    filterBtnActive: {
        backgroundColor: '#7c3aed',
    },
    filterBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#475569',
    },
    filterBtnTextActive: {
        color: '#ffffff',
    },
    resultsCount: {
        alignItems: 'flex-start',
    },
    resultsCountText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
    },
    boldText: {
        fontWeight: 'bold',
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
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 20,
        width: isTablet ? '48%' : '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        justifyContent: 'space-between',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    planIdBadge: {
        backgroundColor: '#f5f3ff',
        borderWidth: 1,
        borderColor: '#ddd6fe',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    planIdText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#6b21a8',
    },
    createdDateText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748b',
    },
    admissionBadge: {
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    admissionBadgeReq: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    admissionBadgeNo: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
    },
    admissionBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    admissionBadgeTextReq: {
        color: '#1d4ed8',
    },
    admissionBadgeTextNo: {
        color: '#64748b',
    },
    surgeryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    patientInfoBox: {
        backgroundColor: '#f8fafc',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    patientName: {
        fontWeight: 'bold',
        color: '#1e293b',
        fontSize: 14,
    },
    patientSubInfo: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    clinicalGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 12,
        gap: 12,
    },
    clinicalItem: {
        width: '46%',
        marginBottom: 8,
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
    clinicalValueSub: {
        color: '#475569',
        fontSize: 13,
    },
    assistantsText: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 10,
    },
    assistantsLabel: {
        color: '#64748b',
    },
    notesBox: {
        backgroundColor: '#fcfcfc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        marginBottom: 12,
    },
    notesText: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    cancelBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
    },
    cancelBtnText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionRight: {
        flexDirection: 'row',
        gap: 8,
    },
    viewPlanBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    viewPlanBtnText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: 'bold',
    },
    scheduleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#7c3aed',
        borderRadius: 8,
        gap: 6,
    },
    scheduleIcon: {
        marginRight: 2,
    },
    scheduleBtnText: {
        color: 'white',
        fontSize: 13,
        fontWeight: 'bold',
    },
});

export default OTPlannedSurgeries;
