import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doctorAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DoctorDashboard = () => {
    const navigation = useNavigation();
    const [stats, setStats] = useState({ today: 0, pending: 0, completed: 0 });
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState({});

    useEffect(() => {
        const init = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                const parsedUser = userStr ? JSON.parse(userStr) : {};
                setUser(parsedUser);

                if (parsedUser?.clinicType === 'clinic') {
                    navigation.replace('HospitalAdminDashboard');
                    return;
                }
                
                fetchDashboardData();
            } catch (err) {
                console.error('Init error:', err);
                setLoading(false);
            }
        };
        init();
    }, [navigation]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError('');

            const aptRes = await doctorAPI.getAppointments();
            if (aptRes.success) {
                const apts = aptRes.appointments || [];
                setAppointments(apts);

                const todayStr = new Date().toISOString().split('T')[0];
                setStats({
                    today: apts.filter(a => a.appointmentDate && String(a.appointmentDate).startsWith(todayStr)).length,
                    pending: apts.filter(a => a.status === 'pending' || a.status === 'confirmed').length,
                    completed: apts.filter(a => a.status === 'completed').length
                });
            } else {
                setError(aptRes.message || 'Failed to load appointments');
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err.message || 'Network error';
            setError(msg);
            console.error('DoctorDashboard error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePatientClick = (appointmentId) => {
        navigation.navigate('DoctorPatientDetails', { appointmentId });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerAll]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ marginTop: 16, color: '#64748b' }}>Loading Dashboard...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}><Text style={{ fontWeight: 'bold' }}>Error loading dashboard:</Text> {error}</Text>
                    <TouchableOpacity onPress={fetchDashboardData} style={styles.retryBtn}>
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.doctorHeader}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={styles.title}>Dr. {user.name || ''}</Text>
                        <Text style={styles.subtitle}>Dashboard & Patient Management</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.btnSecondary}>
                            <Text style={styles.btnSecondaryText}>📅 My Schedule</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, styles.borderBlue]}>
                        <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.today}</Text>
                        <Text style={styles.statLabel}>Today's Appointments</Text>
                    </View>
                    <View style={[styles.statCard, styles.borderOrange]}>
                        <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>Pending / Upcoming</Text>
                    </View>
                    <View style={[styles.statCard, styles.borderGreen]}>
                        <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
                        <Text style={styles.statLabel}>Completed Visits</Text>
                    </View>
                </View>

                {/* Appointments List */}
                <View style={styles.appointmentsSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Schedule & Upcoming</Text>
                    </View>

                    {appointments.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateIcon}>📅</Text>
                            <Text style={styles.emptyStateTitle}>No appointments found.</Text>
                            <Text style={styles.emptyStateSub}>Your appointments will appear here once booked by reception. Contact your admin if you expect to see appointments.</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Time / Date</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Patient Name</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Type</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
                                </View>
                                
                                {appointments.map(apt => {
                                    // Status styling logic
                                    let statusBg = '#f1f5f9';
                                    let statusColor = '#64748b';
                                    if (apt.status === 'confirmed') { statusBg = '#ecfdf5'; statusColor = '#059669'; }
                                    else if (apt.status === 'pending') { statusBg = '#fffbeb'; statusColor = '#d97706'; }
                                    else if (apt.status === 'completed') { statusBg = '#eff6ff'; statusColor = '#2563eb'; }
                                    else if (apt.status === 'cancelled') { statusBg = '#fef2f2'; statusColor = '#dc2626'; }

                                    return (
                                        <View key={apt._id} style={styles.tableRow}>
                                            <View style={[styles.td, { flex: 1.5 }]}>
                                                <Text style={styles.timeText}>{apt.appointmentTime}</Text>
                                                <Text style={styles.dateText}>{new Date(apt.appointmentDate).toLocaleDateString()}</Text>
                                            </View>
                                            <View style={[styles.td, { flex: 2 }]}>
                                                <Text style={styles.patientName}>{apt.userId?.name || 'Walk-in Patient'}</Text>
                                                <Text style={styles.patientId}>{apt.patientId || 'ID: Pending'}</Text>
                                            </View>
                                            <View style={[styles.td, { flex: 1.5 }]}>
                                                <Text style={styles.tdText}>{apt.serviceName || 'Consultation'}</Text>
                                            </View>
                                            <View style={[styles.td, { flex: 1 }]}>
                                                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                                                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>{apt.status}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.td, { flex: 1, alignItems: 'center' }]}>
                                                <TouchableOpacity 
                                                    style={styles.btnView}
                                                    onPress={() => handlePatientClick(apt._id)}
                                                >
                                                    <Text style={styles.btnViewText}>View Details</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9', // Using a solid light color for the gradient fallback
    },
    content: {
        padding: 32,
        maxWidth: 1200,
        marginHorizontal: 'auto',
    },
    centerAll: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 10,
        padding: 20,
        margin: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    errorText: {
        color: '#b91c1c',
        flex: 1,
        marginRight: 10,
    },
    retryBtn: {
        backgroundColor: '#b91c1c',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    retryBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    doctorHeader: {
        marginBottom: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // Glass simulation
        paddingVertical: 24,
        paddingHorizontal: 32,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        // Shadow
        elevation: 4,
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#3b82f6', // Fallback for gradient text
        marginBottom: 6,
    },
    subtitle: {
        color: '#64748b',
        fontSize: 16,
    },
    headerActions: {
        flexDirection: 'row',
    },
    btnSecondary: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        elevation: 1,
    },
    btnSecondaryText: {
        color: '#1e293b',
        fontWeight: '600',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        marginBottom: 40,
    },
    statCard: {
        flex: 1,
        minWidth: 240,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        padding: 28,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 15,
        borderLeftWidth: 4, // Represents the absolute ::before pseudo-element
    },
    borderBlue: {
        borderLeftColor: '#3b82f6',
    },
    borderOrange: {
        borderLeftColor: '#f59e0b',
    },
    borderGreen: {
        borderLeftColor: '#10b981',
    },
    statValue: {
        fontSize: 48,
        fontWeight: '800',
        marginBottom: 8,
        letterSpacing: -1,
    },
    statLabel: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    appointmentsSection: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        padding: 24,
        elevation: 4,
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
    },
    sectionHeader: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
        paddingBottom: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: 16,
    },
    th: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 8,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
    },
    td: {
        padding: 16,
        justifyContent: 'center',
    },
    timeText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    dateText: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    patientName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    patientId: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    tdText: {
        fontSize: 14,
        color: '#334155',
    },
    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    btnView: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        elevation: 3,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    btnViewText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 18,
        color: '#64748b',
        fontWeight: 'bold',
    },
    emptyStateSub: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
        maxWidth: 500,
    }
});

export default DoctorDashboard;
