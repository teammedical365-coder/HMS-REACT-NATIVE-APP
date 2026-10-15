import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Modal,
    useWindowDimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { getOfflineAssistantQueue, getOfflineAssistantDoctors } from '../../services/offline/offlineAssistantService';
import OfflineBanner from '../../components/OfflineBanner';

const DoctorAssistantQueue = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [showAllDates, setShowAllDates] = useState(false);

    // Modal filter pickers for native responsiveness
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [showDeptPicker, setShowDeptPicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);

    const fetchQueue = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const params = {
                date: showAllDates ? 'ALL' : (selectedDate || undefined),
                doctorId: selectedDoctor || undefined,
                department: selectedDepartment || undefined,
                status: selectedStatus || undefined,
                search: searchText || undefined
            };

            const [apptsRes, docsRes] = await Promise.all([
                getOfflineAssistantQueue(params, !isSilent),
                getOfflineAssistantDoctors(!isSilent)
            ]);

            if (apptsRes) {
                setAppointments(apptsRes.appointments || []);
                if (apptsRes.authorizedDepartments && apptsRes.authorizedDepartments.length > 0) {
                    const cleanDepts = Array.from(new Set(apptsRes.authorizedDepartments.map(d => d && d.trim()))).filter(Boolean);
                    setDepartments(cleanDepts);
                }
            }
            if (docsRes) {
                setDoctors(docsRes.doctors || []);
            }
        } catch (error) {
            console.error('Queue load error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate, showAllDates, selectedDoctor, selectedDepartment, selectedStatus, searchText]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'ready_for_doctor':
                return (
                    <View style={[styles.badge, styles.badgeReady]}>
                        <Text style={styles.badgeTextReady}>● Ready For Doctor</Text>
                    </View>
                );
            case 'preparation_in_progress':
                return (
                    <View style={[styles.badge, styles.badgeInProgress]}>
                        <Text style={styles.badgeTextInProgress}>● In Progress</Text>
                    </View>
                );
            case 'completed':
                return (
                    <View style={[styles.badge, styles.badgeCompleted]}>
                        <Text style={styles.badgeTextCompleted}>✓ Completed</Text>
                    </View>
                );
            default:
                return (
                    <View style={[styles.badge, styles.badgeWaiting]}>
                        <Text style={styles.badgeTextWaiting}>● Waiting</Text>
                    </View>
                );
        }
    };

    const selectedDocName = doctors.find(d => String(d._id) === String(selectedDoctor))?.name || 'All Doctors';
    const selectedStatusLabel = selectedStatus ? selectedStatus.replace(/_/g, ' ').toUpperCase() : 'All Statuses';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchQueue(true)} />
            }
        >
            <OfflineBanner />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <View style={styles.titleRow}>
                        <Feather name="users" size={24} color="#0ea5e9" />
                        <Text style={styles.title}>Patient Preparation Queue</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        {showAllDates
                            ? 'Showing all recent & upcoming patient appointments'
                            : `Showing appointments for ${selectedDate}`}
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => navigation.navigate('DoctorAssistantDashboard')}
                    >
                        <Feather name="arrow-left" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>Dashboard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, showAllDates ? styles.btnPrimary : styles.btnSecondary]}
                        onPress={() => setShowAllDates(prev => !prev)}
                    >
                        <Text style={showAllDates ? styles.btnPrimaryText : styles.btnSecondaryText}>
                            {showAllDates ? '📅 Filter Today' : '📋 Show All Dates'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => fetchQueue(true)}
                        disabled={refreshing || loading}
                    >
                        <Feather name="refresh-cw" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterCard}>
                {/* Search */}
                <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search patient name, UHID, phone..."
                        placeholderTextColor="#94a3b8"
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                    {searchText ? (
                        <TouchableOpacity onPress={() => setSearchText('')}>
                            <Feather name="x" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Filter Pills */}
                <View style={styles.filterPillsRow}>
                    <TouchableOpacity
                        style={[styles.filterPill, selectedDoctor && styles.filterPillActive]}
                        onPress={() => setShowDocPicker(true)}
                    >
                        <Feather name="user" size={12} color={selectedDoctor ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.filterPillText, selectedDoctor && styles.filterPillTextActive]}>
                            {selectedDocName}
                        </Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, selectedDepartment && styles.filterPillActive]}
                        onPress={() => setShowDeptPicker(true)}
                    >
                        <Feather name="layers" size={12} color={selectedDepartment ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.filterPillText, selectedDepartment && styles.filterPillTextActive]}>
                            {selectedDepartment || 'All Specialties'}
                        </Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterPill, selectedStatus && styles.filterPillActive]}
                        onPress={() => setShowStatusPicker(true)}
                    >
                        <Feather name="check-circle" size={12} color={selectedStatus ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.filterPillText, selectedStatus && styles.filterPillTextActive]}>
                            {selectedStatusLabel}
                        </Text>
                        <Feather name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>

                    {(selectedDoctor || selectedDepartment || selectedStatus || searchText) ? (
                        <TouchableOpacity
                            style={styles.clearFiltersBtn}
                            onPress={() => {
                                setSelectedDoctor('');
                                setSelectedDepartment('');
                                setSelectedStatus('');
                                setSearchText('');
                            }}
                        >
                            <Text style={styles.clearFiltersBtnText}>Reset</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Doctor Picker Modal */}
            <Modal visible={showDocPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Doctor</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => { setSelectedDoctor(''); setShowDocPicker(false); }}
                        >
                            <Text style={styles.modalOptionText}>All Assigned Doctors ({doctors.length})</Text>
                        </TouchableOpacity>
                        {doctors.map(d => (
                            <TouchableOpacity
                                key={d._id}
                                style={styles.modalOption}
                                onPress={() => { setSelectedDoctor(d._id); setShowDocPicker(false); }}
                            >
                                <Text style={styles.modalOptionText}>👨‍⚕️ {d.name} ({d.departments?.[0] || d.specialty || 'General'})</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocPicker(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Department Picker Modal */}
            <Modal visible={showDeptPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Department</Text>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => { setSelectedDepartment(''); setShowDeptPicker(false); }}
                        >
                            <Text style={styles.modalOptionText}>All Authorized Departments</Text>
                        </TouchableOpacity>
                        {departments.map(dept => (
                            <TouchableOpacity
                                key={dept}
                                style={styles.modalOption}
                                onPress={() => { setSelectedDepartment(dept); setShowDeptPicker(false); }}
                            >
                                <Text style={styles.modalOptionText}>🏥 {dept}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDeptPicker(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Status Picker Modal */}
            <Modal visible={showStatusPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Filter by Status</Text>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setSelectedStatus(''); setShowStatusPicker(false); }}>
                            <Text style={styles.modalOptionText}>All Statuses</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setSelectedStatus('waiting_for_assistant'); setShowStatusPicker(false); }}>
                            <Text style={styles.modalOptionText}>Waiting For Assistant</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setSelectedStatus('preparation_in_progress'); setShowStatusPicker(false); }}>
                            <Text style={styles.modalOptionText}>Preparation In Progress</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setSelectedStatus('ready_for_doctor'); setShowStatusPicker(false); }}>
                            <Text style={styles.modalOptionText}>Ready For Doctor</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => { setSelectedStatus('completed'); setShowStatusPicker(false); }}>
                            <Text style={styles.modalOptionText}>Completed</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowStatusPicker(false)}>
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Queue List */}
            {loading ? (
                <View style={styles.emptyCard}>
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading appointments...</Text>
                </View>
            ) : appointments.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Feather name="inbox" size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <Text style={styles.emptyTitle}>No appointments found</Text>
                    <Text style={styles.emptyText}>No appointments matching your search and filter criteria.</Text>
                </View>
            ) : (
                <View style={styles.queueContainer}>
                    <Text style={styles.queueCountHeader}>
                        Showing {appointments.length} {appointments.length === 1 ? 'Patient' : 'Patients'} in Queue
                    </Text>

                    {appointments.map(item => (
                        <View key={item.appointmentId} style={styles.card}>
                            <View style={styles.cardTop}>
                                <View style={styles.tokenBox}>
                                    <Text style={styles.tokenNum}>
                                        {item.tokenNumber ? `Token #${item.tokenNumber}` : (item.appointmentTime || 'Today')}
                                    </Text>
                                    {item.tokenNumber && (
                                        <Text style={styles.tokenTime}>{item.appointmentTime}</Text>
                                    )}
                                </View>

                                {renderStatusBadge(item.preparationStatus)}
                            </View>

                            <View style={styles.patientRow}>
                                <Text style={styles.patientName}>{item.patient?.name || 'Patient'}</Text>
                                <Text style={styles.patientMeta}>
                                    UHID: {item.patient?.uhid || 'N/A'} {item.patient?.age ? `• ${item.patient.age}y` : ''} {item.patient?.gender ? `• ${item.patient.gender}` : ''} {item.patient?.phone ? `• ${item.patient.phone}` : ''}
                                </Text>
                            </View>

                            <View style={styles.docRow}>
                                <Text style={styles.docName}>👨‍⚕️ {item.doctor?.name || 'Doctor'}</Text>
                                <Text style={styles.docDept}>• {item.department || 'General'}</Text>
                            </View>

                            {/* Progress bar */}
                            <View style={styles.progressRow}>
                                <View style={styles.progressBarBg}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${Math.min(100, item.progressPercentage || 0)}%` },
                                            item.preparationStatus === 'ready_for_doctor' && styles.progressBarReady
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressPercent}>{item.progressPercentage || 0}% Prepared</Text>
                            </View>

                            {/* Action Button */}
                            <View style={styles.cardFooter}>
                                <TouchableOpacity
                                    style={[
                                        styles.actionBtn,
                                        item.preparationStatus === 'waiting_for_assistant' ? styles.actionStart :
                                        item.preparationStatus === 'preparation_in_progress' ? styles.actionContinue :
                                        styles.actionView
                                    ]}
                                    onPress={() => navigation.navigate('DoctorAssistantPreparation', { appointmentId: item.appointmentId })}
                                >
                                    <Feather
                                        name={item.preparationStatus === 'waiting_for_assistant' ? 'play-circle' : item.preparationStatus === 'preparation_in_progress' ? 'edit-3' : 'eye'}
                                        size={14}
                                        color="#ffffff"
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={styles.actionBtnText}>
                                        {item.preparationStatus === 'waiting_for_assistant' ? 'Start Preparation' :
                                         item.preparationStatus === 'preparation_in_progress' ? 'Continue Preparation' :
                                         'View Preparation'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
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
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 12,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    btnPrimary: {
        backgroundColor: '#0ea5e9',
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 12,
    },
    btnSecondary: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 12,
    },
    filterCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 16,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 42,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
    },
    filterPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
        alignItems: 'center',
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterPillActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#38bdf8',
    },
    filterPillText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '500',
    },
    filterPillTextActive: {
        color: '#0284c7',
        fontWeight: '700',
    },
    clearFiltersBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    clearFiltersBtnText: {
        fontSize: 12,
        color: '#ef4444',
        fontWeight: '600',
    },
    queueContainer: {
        gap: 12,
    },
    queueCountHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    tokenBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    tokenNum: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    tokenTime: {
        fontSize: 11,
        color: '#64748b',
    },
    patientRow: {
        marginTop: 10,
    },
    patientName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    patientMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    docName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    docDept: {
        fontSize: 12,
        color: '#64748b',
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#0ea5e9',
        borderRadius: 3,
    },
    progressBarReady: {
        backgroundColor: '#10b981',
    },
    progressPercent: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        minWidth: 70,
        textAlign: 'right',
    },
    cardFooter: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    actionStart: {
        backgroundColor: '#0ea5e9',
    },
    actionContinue: {
        backgroundColor: '#0284c7',
    },
    actionView: {
        backgroundColor: '#334155',
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    badge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    badgeReady: {
        backgroundColor: '#ecfdf5',
    },
    badgeTextReady: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '700',
    },
    badgeInProgress: {
        backgroundColor: '#ecfeff',
    },
    badgeTextInProgress: {
        color: '#0891b2',
        fontSize: 11,
        fontWeight: '700',
    },
    badgeCompleted: {
        backgroundColor: '#f5f3ff',
    },
    badgeTextCompleted: {
        color: '#7c3aed',
        fontSize: 11,
        fontWeight: '700',
    },
    badgeWaiting: {
        backgroundColor: '#fffbeb',
    },
    badgeTextWaiting: {
        color: '#d97706',
        fontSize: 11,
        fontWeight: '700',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    emptyText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 18,
        width: '100%',
        maxWidth: 420,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 12,
    },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalOptionText: {
        fontSize: 14,
        color: '#334155',
    },
    modalCloseBtn: {
        marginTop: 14,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
});

export default DoctorAssistantQueue;
