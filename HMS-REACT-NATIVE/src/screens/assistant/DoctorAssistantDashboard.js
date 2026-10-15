import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    useWindowDimensions,
    Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getOfflineAssistantDashboard } from '../../services/offline/offlineAssistantService';
import OfflineBanner from '../../components/OfflineBanner';

const DoctorAssistantDashboard = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dashboardData, setDashboardData] = useState(null);
    const [fromCache, setFromCache] = useState(false);

    const fetchDashboard = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await getOfflineAssistantDashboard(!isSilent);
            setDashboardData(res);
            setFromCache(Boolean(res?._fromCache));
        } catch (error) {
            console.error('Assistant dashboard load error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const summary = dashboardData?.summary || {
        totalTodayPatients: 0,
        waiting: 0,
        inProgress: 0,
        readyForDoctor: 0,
        completed: 0
    };

    const myDoctors = dashboardData?.myDoctors || [];
    const patientQueue = dashboardData?.patientQueue || [];
    const authorizedDepartments = dashboardData?.authorizedDepartments || [];
    const recentActivities = dashboardData?.recentActivities || [];

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

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboard(true)} />
            }
        >
            <OfflineBanner />

            {/* Top Clinical Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleWrap}>
                    <View style={styles.titleRow}>
                        <Feather name="user-check" size={24} color="#0ea5e9" />
                        <Text style={styles.title}>Doctor Assistant — Clinical Preparation</Text>
                    </View>
                    <Text style={styles.subtitle}>
                        Pre-consultation patient intake, vitals, and department-specific questionnaire management
                    </Text>
                    {fromCache && (
                        <View style={styles.cachedNotice}>
                            <Feather name="database" size={12} color="#0284c7" />
                            <Text style={styles.cachedText}>Displaying offline cached clinic data</Text>
                        </View>
                    )}
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => fetchDashboard(true)}
                        disabled={refreshing || loading}
                    >
                        <Feather name="refresh-cw" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnPrimary]}
                        onPress={() => navigation.navigate('DoctorAssistantQueue')}
                    >
                        <Feather name="users" size={14} color="#ffffff" />
                        <Text style={styles.btnPrimaryText}>Open Patient Queue</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Metrics Summary Grid */}
            <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { borderLeftColor: '#3b82f6' }]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#eff6ff' }]}>
                        <Feather name="users" size={20} color="#3b82f6" />
                    </View>
                    <View style={styles.metricInfo}>
                        <Text style={styles.metricValue}>{summary.totalTodayPatients}</Text>
                        <Text style={styles.metricLabel}>Today's Patients</Text>
                    </View>
                </View>

                <View style={[styles.metricCard, { borderLeftColor: '#f59e0b' }]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#fffbeb' }]}>
                        <Feather name="clock" size={20} color="#f59e0b" />
                    </View>
                    <View style={styles.metricInfo}>
                        <Text style={styles.metricValue}>{summary.waiting}</Text>
                        <Text style={styles.metricLabel}>Waiting For Assistant</Text>
                    </View>
                </View>

                <View style={[styles.metricCard, { borderLeftColor: '#06b6d4' }]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#ecfeff' }]}>
                        <Feather name="activity" size={20} color="#06b6d4" />
                    </View>
                    <View style={styles.metricInfo}>
                        <Text style={styles.metricValue}>{summary.inProgress}</Text>
                        <Text style={styles.metricLabel}>Prep In Progress</Text>
                    </View>
                </View>

                <View style={[styles.metricCard, { borderLeftColor: '#10b981' }]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#ecfdf5' }]}>
                        <Feather name="check-circle" size={20} color="#10b981" />
                    </View>
                    <View style={styles.metricInfo}>
                        <Text style={styles.metricValue}>{summary.readyForDoctor}</Text>
                        <Text style={styles.metricLabel}>Ready For Doctor</Text>
                    </View>
                </View>

                <View style={[styles.metricCard, { borderLeftColor: '#8b5cf6' }]}>
                    <View style={[styles.metricIconWrap, { backgroundColor: '#f5f3ff' }]}>
                        <Feather name="check-square" size={20} color="#8b5cf6" />
                    </View>
                    <View style={styles.metricInfo}>
                        <Text style={styles.metricValue}>{summary.completed}</Text>
                        <Text style={styles.metricLabel}>Completed</Text>
                    </View>
                </View>
            </View>

            {/* Section: My Assigned Doctors */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>👨‍⚕️ My Assigned Doctors</Text>
                        <Text style={styles.sectionSubtitle}>
                            Doctors and departments you are authorized to prepare patients for
                        </Text>
                    </View>
                    <View style={styles.docCountPill}>
                        <Text style={styles.docCountPillText}>
                            {myDoctors.length} Assigned {myDoctors.length === 1 ? 'Doctor' : 'Doctors'}
                        </Text>
                    </View>
                </View>

                {myDoctors.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            No doctors currently assigned. Please contact your Hospital Administrator.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.doctorsGrid}>
                        {myDoctors.map(doc => (
                            <View key={doc._id} style={styles.doctorCard}>
                                <View style={styles.doctorAvatar}>
                                    <Text style={styles.doctorAvatarText}>
                                        {(doc.name || 'D').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.doctorDetails}>
                                    <Text style={styles.doctorName}>{doc.name}</Text>
                                    <Text style={styles.doctorDept}>
                                        {doc.departments?.[0] || doc.specialty || 'General Medicine'}
                                    </Text>
                                </View>
                                <View style={styles.doctorBadge}>
                                    <Text style={styles.doctorBadgeText}>
                                        {doc.todayPatientsCount || 0} {doc.todayPatientsCount === 1 ? 'Patient' : 'Patients'}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Section: Today's Patient Queue */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>📋 Today's Patient Queue</Text>
                        <Text style={styles.sectionSubtitle}>
                            Patients scheduled with your assigned doctors for pre-consultation preparation
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, { paddingVertical: 6, paddingHorizontal: 10 }]}
                        onPress={() => navigation.navigate('DoctorAssistantQueue')}
                    >
                        <Text style={[styles.btnSecondaryText, { fontSize: 12 }]}>View Full Queue</Text>
                        <Feather name="arrow-right" size={14} color="#0f172a" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="small" color="#0ea5e9" />
                        <Text style={[styles.emptyStateText, { marginTop: 8 }]}>Loading patient queue...</Text>
                    </View>
                ) : patientQueue.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            No appointments scheduled for your assigned doctors today.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.queueList}>
                        {patientQueue.map(item => (
                            <View key={item.appointmentId} style={styles.queueItemCard}>
                                <View style={styles.queueItemTop}>
                                    <View>
                                        <Text style={styles.patientName}>{item.patient?.name || 'Patient'}</Text>
                                        <Text style={styles.patientUhid}>
                                            UHID: {item.patient?.uhid || 'N/A'} {item.patient?.age ? `• ${item.patient.age}y` : ''} {item.patient?.gender ? `• ${item.patient.gender}` : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.timeTag}>
                                        <Feather name="clock" size={12} color="#0369a1" />
                                        <Text style={styles.timeTagText}>{item.appointmentTime || 'Today'}</Text>
                                    </View>
                                </View>

                                <View style={styles.queueItemMeta}>
                                    <Text style={styles.metaDoctor}>👨‍⚕️ {item.doctor?.name || 'Doctor'}</Text>
                                    <Text style={styles.metaDept}>• {item.department || 'General'}</Text>
                                </View>

                                <View style={styles.queueItemProgressRow}>
                                    <View style={styles.progressBarBg}>
                                        <View
                                            style={[
                                                styles.progressBarFill,
                                                { width: `${Math.min(100, item.progressPercentage || 0)}%` },
                                                item.preparationStatus === 'ready_for_doctor' && styles.progressBarReady
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.progressText}>{item.progressPercentage || 0}%</Text>
                                </View>

                                <View style={styles.queueItemFooter}>
                                    {renderStatusBadge(item.preparationStatus)}

                                    <TouchableOpacity
                                        style={[
                                            styles.actionBtn,
                                            item.preparationStatus === 'waiting_for_assistant' ? styles.actionStart :
                                            item.preparationStatus === 'preparation_in_progress' ? styles.actionContinue :
                                            styles.actionView
                                        ]}
                                        onPress={() => navigation.navigate('DoctorAssistantPreparation', { appointmentId: item.appointmentId })}
                                    >
                                        <Text style={styles.actionBtnText}>
                                            {item.preparationStatus === 'waiting_for_assistant' ? 'Start Prep' :
                                             item.preparationStatus === 'preparation_in_progress' ? 'Continue Prep' :
                                             'View Prep'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Section: Authorized Question Library Quick Access */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>📖 Authorized Question Library</Text>
                        <Text style={styles.sectionSubtitle}>
                            Department-specific patient intake protocols and clinical questionnaires
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary, { paddingVertical: 6, paddingHorizontal: 10 }]}
                        onPress={() => navigation.navigate('DoctorAssistantQuestionLibrary')}
                    >
                        <Text style={[styles.btnSecondaryText, { fontSize: 12 }]}>Explore Library</Text>
                        <Feather name="arrow-right" size={14} color="#0f172a" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>

                <View style={styles.qlGrid}>
                    {authorizedDepartments.map(dept => (
                        <TouchableOpacity
                            key={dept}
                            style={styles.qlCard}
                            onPress={() => navigation.navigate('DoctorAssistantQuestionLibrary', { dept })}
                        >
                            <Text style={styles.qlCardName}>📋 {dept} Intake Protocol</Text>
                            <View style={styles.qlActivePill}>
                                <Text style={styles.qlActivePillText}>Active</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    {authorizedDepartments.length === 0 && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No department question protocols loaded yet.</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Section: Recent Activity Audit */}
            {recentActivities.length > 0 && (
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>🕒 Recent Activity</Text>
                            <Text style={styles.sectionSubtitle}>
                                Audit history of patient intake and preparation updates
                            </Text>
                        </View>
                    </View>

                    <View style={styles.activitiesList}>
                        {recentActivities.map(act => (
                            <View key={act._id} style={styles.activityItem}>
                                <View style={styles.activityLeft}>
                                    <Text style={styles.activityAction}>
                                        {(act.action || 'UPDATE').replace(/_/g, ' ')}
                                    </Text>
                                    <Text style={styles.activityTarget}>
                                        — {act.targetLabel || 'Patient Record'}
                                    </Text>
                                </View>
                                <Text style={styles.activityTime}>
                                    {act.createdAt ? new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </Text>
                            </View>
                        ))}
                    </View>
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
        marginBottom: 20,
    },
    headerTitleWrap: {
        marginBottom: 12,
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
        lineHeight: 18,
    },
    cachedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        backgroundColor: '#f0f9ff',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    cachedText: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        gap: 6,
    },
    btnPrimary: {
        backgroundColor: '#0ea5e9',
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 13,
    },
    btnSecondary: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#0f172a',
        fontWeight: '600',
        fontSize: 13,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    metricCard: {
        flex: 1,
        minWidth: 140,
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metricIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricInfo: {
        flex: 1,
    },
    metricValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    metricLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        marginBottom: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    docCountPill: {
        backgroundColor: '#f0f9ff',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    docCountPillText: {
        fontSize: 12,
        color: '#0369a1',
        fontWeight: '600',
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
    },
    doctorsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    doctorCard: {
        flex: 1,
        minWidth: 220,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    doctorAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#0ea5e9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doctorAvatarText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    doctorDetails: {
        flex: 1,
    },
    doctorName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    doctorDept: {
        fontSize: 12,
        color: '#0369a1',
        fontWeight: '500',
    },
    doctorBadge: {
        backgroundColor: '#e0f2fe',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    doctorBadgeText: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
    },
    queueList: {
        gap: 12,
    },
    queueItemCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 14,
    },
    queueItemTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    patientName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    patientUhid: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    timeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0f9ff',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    timeTagText: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
    },
    queueItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    metaDoctor: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    metaDept: {
        fontSize: 12,
        color: '#64748b',
    },
    queueItemProgressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
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
    progressText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        minWidth: 32,
    },
    queueItemFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
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
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    actionStart: {
        backgroundColor: '#0ea5e9',
    },
    actionContinue: {
        backgroundColor: '#0284c7',
    },
    actionView: {
        backgroundColor: '#f1f5f9',
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    qlGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    qlCard: {
        flex: 1,
        minWidth: 200,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    qlCardName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    qlActivePill: {
        backgroundColor: '#dcfce7',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    qlActivePillText: {
        fontSize: 10,
        color: '#15803d',
        fontWeight: '700',
    },
    activitiesList: {
        gap: 8,
    },
    activityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    activityLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    activityAction: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0ea5e9',
    },
    activityTarget: {
        fontSize: 12,
        color: '#475569',
    },
    activityTime: {
        fontSize: 11,
        color: '#94a3b8',
    },
});

export default DoctorAssistantDashboard;
