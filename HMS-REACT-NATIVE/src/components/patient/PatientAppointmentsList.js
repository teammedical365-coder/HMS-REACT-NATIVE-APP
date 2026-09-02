import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const PatientAppointmentsList = ({ appointments = [] }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .section-header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderH2}>Upcoming Appointments</Text>
            </View>

            {/* Translating web class: .dashboard-card */}
            <View style={styles.dashboardCard}>
                <View style={styles.cardBody}>
                    {appointments.length === 0 ? (
                        // Translating web class: .empty-state-large
                        <View style={styles.emptyStateLarge}>
                            <Text style={styles.emptyStateIcon}>📅</Text>
                            <Text style={styles.emptyStateH3}>No upcoming appointments</Text>
                            <Text style={styles.emptyStateP}>You have no scheduled appointments at this time.</Text>
                        </View>
                    ) : (
                        // Translating web class: .appointment-list-full
                        <View style={styles.appointmentListFull}>
                            {appointments.map((appt, idx) => {
                                const dateObj = new Date(appt.date);
                                const month = dateObj.toLocaleString('default', { month: 'short' });
                                const day = dateObj.getDate();

                                let statusStyle = styles.apptStatusPending;
                                if (appt.status === 'confirmed') statusStyle = styles.apptStatusConfirmed;
                                if (appt.status === 'completed') statusStyle = styles.apptStatusCompleted;
                                if (appt.status === 'cancelled') statusStyle = styles.apptStatusCancelled;

                                return (
                                    // Translating web class: .appointment-item-full
                                    <View key={idx} style={styles.appointmentItemFull}>
                                        
                                        {/* Translating web class: .appt-info-main */}
                                        <View style={styles.apptInfoMain}>
                                            {/* Translating web class: .appt-date-box */}
                                            <View style={styles.apptDateBox}>
                                                <Text style={styles.apptDateMonth}>{month}</Text>
                                                <Text style={styles.apptDateDay}>{day}</Text>
                                            </View>

                                            {/* Translating web class: .appt-details-full */}
                                            <View style={styles.apptDetailsFull}>
                                                <Text style={styles.apptDetailsH4}>Dr. {appt.doctorName}</Text>
                                                
                                                {/* Translating web class: .appt-meta */}
                                                <View style={styles.apptMeta}>
                                                    <Text style={styles.apptMetaText}>{appt.time}</Text>
                                                    <Text style={styles.apptMetaText}>•</Text>
                                                    <Text style={styles.apptMetaText}>{appt.department || 'General'}</Text>
                                                    
                                                    {/* Translating web class: .appt-status */}
                                                    <View style={[styles.apptStatus, statusStyle]}>
                                                        <Text style={[styles.apptStatusText, statusStyle]}>{appt.status}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Translating web class: .appt-actions */}
                                        <View style={styles.apptActions}>
                                            {/* Translating web class: .btn-secondary */}
                                            <TouchableOpacity style={styles.btnSecondary}>
                                                <Text style={styles.btnSecondaryText}>Reschedule</Text>
                                            </TouchableOpacity>
                                            
                                            {/* Translating web class: .btn-danger-outline */}
                                            <TouchableOpacity style={styles.btnDangerOutline}>
                                                <Text style={styles.btnDangerOutlineText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 24 },

    // Translating web class: .section-header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    sectionHeaderH2: {
        fontSize: 24, // 1.5rem
        color: '#0f172a',
        fontWeight: '700'
    },

    // Translating web class: .dashboard-card
    dashboardCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        overflow: 'hidden'
    },
    cardBody: {
        padding: 24 // 1.5rem
    },

    // Translating web class: .empty-state-large
    emptyStateLarge: {
        alignItems: 'center',
        paddingVertical: 64, // 4rem
        paddingHorizontal: 32, // 2rem
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed'
    },
    emptyStateIcon: {
        fontSize: 48, // 3rem
        marginBottom: 16,
        opacity: 0.5
    },
    emptyStateH3: {
        fontSize: 16,
        color: '#0f172a',
        marginBottom: 8,
        fontWeight: 'bold' // implicitly implied in heading
    },
    emptyStateP: {
        color: '#64748b',
        fontSize: 14
    },

    // Translating web class: .appointment-list-full
    appointmentListFull: {
        flexDirection: 'column',
        gap: 16
    },

    // Translating web class: .appointment-item-full
    appointmentItemFull: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20, // 1.25rem
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        flexWrap: 'wrap',
        gap: 16
    },

    // Translating web class: .appt-info-main
    apptInfoMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24
    },

    // Translating web class: .appt-date-box
    apptDateBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
        minWidth: 80
    },
    apptDateMonth: {
        fontSize: 12, // 0.75rem
        fontWeight: '700',
        textTransform: 'uppercase',
        color: '#64748b'
    },
    apptDateDay: {
        fontSize: 24, // 1.5rem
        fontWeight: '800',
        color: '#0f172a'
    },

    // Translating web class: .appt-details-full
    apptDetailsFull: {
        flexDirection: 'column'
    },
    apptDetailsH4: {
        fontSize: 17.6, // 1.1rem
        color: '#0f172a',
        marginBottom: 8,
        fontWeight: 'bold'
    },

    // Translating web class: .appt-meta
    apptMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap'
    },
    apptMetaText: {
        fontSize: 14.4, // 0.9rem
        color: '#64748b'
    },

    // Translating web class: .appt-status
    apptStatus: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20
    },
    apptStatusText: {
        fontSize: 12.8, // 0.8rem
        fontWeight: '600',
        textTransform: 'capitalize'
    },
    apptStatusConfirmed: { backgroundColor: '#dcfce7', color: '#166534' },
    apptStatusCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
    apptStatusCompleted: { backgroundColor: '#f1f5f9', color: '#475569' },
    apptStatusPending: { backgroundColor: '#fef9c3', color: '#854d0e' },

    // Translating web class: .appt-actions
    apptActions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center'
    },

    // Translating web class: .btn-secondary
    btnSecondary: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14
    },

    // Translating web class: .btn-danger-outline
    btnDangerOutline: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#fecaca',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    btnDangerOutlineText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 14
    }
});

export default PatientAppointmentsList;
