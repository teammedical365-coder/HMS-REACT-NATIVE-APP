import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const PatientHeaderStats = ({ user, nextAppointment, stats }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .patient-welcome-card (Pending State mapping) */}
            {!user?.isActive && (
                <View style={styles.patientWelcomeCard}>
                    <Text style={styles.patientWelcomeCardH3}>Welcome, {user?.name}</Text>
                    
                    {/* Translating web class: .patient-status-badge-container */}
                    <View style={styles.patientStatusBadgeContainer}>
                        {/* Translating web class: .patient-status-badge */}
                        <View style={styles.patientStatusBadge}>
                            <Text style={styles.patientStatusBadgeTitle}>Account Status</Text>
                            {/* Translating web class: .patient-status-badge-value & .status-pending */}
                            <Text style={[styles.patientStatusBadgeValue, styles.statusPending]}>Pending Approval</Text>
                        </View>
                    </View>

                    {/* Translating web class: .patient-message-box */}
                    <View style={styles.patientMessageBox}>
                        <Text style={styles.patientMessageBoxText}>Your account is currently pending verification.</Text>
                    </View>
                </View>
            )}

            {/* Translating web class: .patient-profile-hero (Hero Section Activated) */}
            {user?.isActive && (
                <LinearGradient colors={['#1e3a8a', '#3b82f6']} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.patientProfileHero}>
                    <View style={styles.patientHeroContent}>
                        <Text style={styles.patientHeroContentH2}>Hello, {user?.name}</Text>
                        
                        {nextAppointment && (
                            // Translating web class: .hero-upcoming-appt
                            <View style={styles.heroUpcomingAppt}>
                                <View>
                                    <Text style={styles.upcomingLabel}>Next Appointment</Text>
                                    <Text style={styles.upcomingDoctor}>Dr. {nextAppointment.doctorName}</Text>
                                    <View style={styles.upcomingTime}>
                                        <Feather name="clock" size={14} color="#ffffff" />
                                        <Text style={styles.upcomingTimeText}>{nextAppointment.time}</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.patientHeroActions}>
                        {/* Translating web class: .patient-hero-mrn */}
                        <View style={styles.patientHeroMrn}>
                            <Text style={styles.patientHeroMrnSpan}>MRN:</Text>
                            <Text style={styles.patientHeroMrnText}>{user?.mrn || 'N/A'}</Text>
                        </View>

                        {/* Translating web class: .btn-solid-white */}
                        <TouchableOpacity style={styles.btnSolidWhite}>
                            <Text style={styles.btnSolidWhiteText}>Book Appointment</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            )}

            {/* Translating web class: .quick-actions-grid */}
            <View style={styles.quickActionsGrid}>
                {/* Translating web class: .quick-action-card */}
                <TouchableOpacity style={styles.quickActionCard}>
                    {/* Translating web class: .qa-icon & .qa-icon.appointments */}
                    <View style={[styles.qaIcon, styles.qaIconAppointments]}>
                        <Feather name="calendar" size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.qaContent}>
                        <Text style={styles.qaContentH3}>Appointments</Text>
                        <Text style={styles.qaContentP}>{stats?.appointments || 0} scheduled</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard}>
                    {/* Translating web class: .qa-icon & .qa-icon.records */}
                    <View style={[styles.qaIcon, styles.qaIconRecords]}>
                        <Feather name="file-text" size={24} color="#22c55e" />
                    </View>
                    <View style={styles.qaContent}>
                        <Text style={styles.qaContentH3}>Health Records</Text>
                        <Text style={styles.qaContentP}>{stats?.records || 0} files available</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard}>
                    {/* Translating web class: .qa-icon & .qa-icon.bills */}
                    <View style={[styles.qaIcon, styles.qaIconBills]}>
                        <MaterialIcons name="receipt-long" size={24} color="#f59e0b" />
                    </View>
                    <View style={styles.qaContent}>
                        <Text style={styles.qaContentH3}>Billing & Payments</Text>
                        <Text style={styles.qaContentP}>View invoices</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 24 },
    
    // Translating web class: .patient-welcome-card
    patientWelcomeCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 32, // approx 2.5rem
        elevation: 3,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        flexDirection: 'column',
        gap: 24,
        marginBottom: 32
    },
    patientWelcomeCardH3: {
        fontSize: 28, // 1.75rem
        color: '#0f172a',
        fontWeight: '800'
    },
    patientStatusBadgeContainer: {
        flexDirection: 'row',
        gap: 24,
        flexWrap: 'wrap'
    },
    patientStatusBadge: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'column',
        gap: 4,
        minWidth: 200
    },
    patientStatusBadgeTitle: {
        fontSize: 13.6, // 0.85rem
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.05
    },
    patientStatusBadgeValue: {
        fontSize: 18, // 1.125rem
        fontWeight: '700'
    },
    statusPending: { color: '#d97706' },
    statusActive: { color: '#16a34a' },

    patientMessageBox: {
        backgroundColor: '#fffbeb',
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
        padding: 20,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8
    },
    patientMessageBoxText: {
        color: '#92400e',
        lineHeight: 25.6
    },

    // Translating web class: .patient-profile-hero
    patientProfileHero: {
        borderRadius: 20,
        padding: 30,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
        marginBottom: 32,
        flexWrap: 'wrap'
    },
    patientHeroContent: { zIndex: 1, flex: 1, marginRight: 16 },
    patientHeroContentH2: {
        fontSize: 32, // 2rem
        fontWeight: '800',
        letterSpacing: -0.02,
        color: '#ffffff',
        marginBottom: 16
    },

    // Translating web class: .hero-upcoming-appt
    heroUpcomingAppt: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24
    },
    upcomingLabel: {
        fontSize: 12.8, // 0.8rem
        textTransform: 'uppercase',
        letterSpacing: 0.1,
        opacity: 0.8,
        marginBottom: 4,
        color: '#ffffff'
    },
    upcomingDoctor: {
        fontSize: 17.6, // 1.1rem
        fontWeight: '700',
        marginBottom: 4,
        color: '#ffffff'
    },
    upcomingTime: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    upcomingTimeText: {
        fontSize: 14.4, // 0.9rem
        opacity: 0.9,
        color: '#ffffff'
    },

    patientHeroActions: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
        zIndex: 1
    },

    // Translating web class: .patient-hero-mrn
    patientHeroMrn: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    patientHeroMrnSpan: {
        fontSize: 12.8, // 0.8rem
        textTransform: 'uppercase',
        letterSpacing: 0.1,
        opacity: 0.8,
        color: '#ffffff'
    },
    patientHeroMrnText: {
        fontSize: 17.6, // 1.1rem
        fontWeight: 'bold',
        color: '#ffffff'
    },

    // Translating web class: .btn-solid-white
    btnSolidWhite: {
        backgroundColor: '#ffffff',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6
    },
    btnSolidWhiteText: {
        color: '#1e3a8a',
        fontWeight: '700',
        fontSize: 14
    },

    // Translating web class: .quick-actions-grid
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        marginBottom: 32,
        width: '100%'
    },
    
    // Translating web class: .quick-action-card
    quickActionCard: {
        flex: 1,
        minWidth: 250,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20
    },

    // Translating web class: .qa-icon
    qaIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    qaIconAppointments: { backgroundColor: '#eff6ff' },
    qaIconRecords: { backgroundColor: '#f0fdf4' },
    qaIconBills: { backgroundColor: '#fffbeb' },

    qaContent: { flex: 1 },
    qaContentH3: {
        fontSize: 16.8, // 1.05rem
        color: '#0f172a',
        marginBottom: 4,
        fontWeight: 'bold' // Mapped implicitly from native behavior for headings if specified
    },
    qaContentP: {
        fontSize: 13.6, // 0.85rem
        color: '#64748b'
    }
});

export default PatientHeaderStats;
