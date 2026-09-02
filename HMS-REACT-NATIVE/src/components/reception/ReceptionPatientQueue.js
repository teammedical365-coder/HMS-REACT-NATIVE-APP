import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const ReceptionPatientQueue = ({ queue = [] }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .appointments-list */}
            <View style={styles.appointmentsList}>
                {/* Translating web class: .appointments-list h3 */}
                <Text style={styles.appointmentsListH3}>Live Waiting Queue & Appointments</Text>
                
                {/* Translating web class: .table-responsive */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableResponsive}>
                    {/* Translating web class: .reception-table */}
                    <View style={styles.receptionTable}>
                        
                        {/* Table Header */}
                        <View style={styles.receptionTableTrHeader}>
                            {/* Translating web class: .reception-table th */}
                            <Text style={[styles.receptionTableTh, styles.receptionTableThFirst]}>Patient</Text>
                            <Text style={styles.receptionTableTh}>Time</Text>
                            <Text style={styles.receptionTableTh}>Doctor</Text>
                            <Text style={[styles.receptionTableTh, styles.receptionTableThLast]}>Status</Text>
                        </View>
                        
                        {/* Table Body */}
                        {/* Translating web class: .reception-table tbody tr */}
                        {queue.map((item, index) => {
                            let statusStyle = styles.statusPending;
                            if (item.status === 'confirmed') statusStyle = styles.statusConfirmed;
                            if (item.status === 'completed') statusStyle = styles.statusCompleted;
                            if (item.status === 'cancelled') statusStyle = styles.statusCancelled;

                            return (
                                <View key={index} style={styles.receptionTableTr}>
                                    {/* Translating web class: .reception-table td */}
                                    <Text style={styles.receptionTableTd}>{item.patientName}</Text>
                                    <Text style={styles.receptionTableTd}>{item.time}</Text>
                                    <Text style={styles.receptionTableTd}>{item.doctorName}</Text>
                                    <View style={styles.receptionTableTd}>
                                        {/* Translating web class: .status */}
                                        <View style={[styles.status, statusStyle]}>
                                            <Text style={[styles.statusText, statusStyle]}>{item.status}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                        {queue.length === 0 && (
                            <View style={styles.receptionTableTr}>
                                <Text style={styles.receptionTableTd}>No patients in queue.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 20 },

    // Translating web class: .appointments-list
    appointmentsList: {
        backgroundColor: '#ffffff', // var(--surface-0)
        paddingVertical: 22,
        paddingHorizontal: 24,
        borderRadius: 16, // var(--radius-lg)
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb' // var(--gray-200)
    },
    // Translating web class: .appointments-list h3
    appointmentsListH3: {
        fontSize: 16, // 1rem
        fontWeight: '700',
        color: '#1f2937', // var(--gray-800)
        marginBottom: 18
    },

    // Translating web class: .table-responsive
    tableResponsive: {
        flexGrow: 1,
        width: '100%'
    },

    // Translating web class: .reception-table
    receptionTable: {
        width: '100%'
    },
    receptionTableTrHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb', // var(--gray-200)
        backgroundColor: '#f9fafb' // var(--gradient-surface) approx
    },
    // Translating web class: .reception-table tbody tr
    receptionTableTr: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6' // var(--gray-100)
    },

    // Translating web class: .reception-table th
    receptionTableTh: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        color: '#6b7280', // var(--gray-500)
        fontWeight: '700',
        fontSize: 11.52, // 0.72rem
        textTransform: 'uppercase',
        letterSpacing: 0.07,
        minWidth: 100
    },
    receptionTableThFirst: {
        borderTopLeftRadius: 12
    },
    receptionTableThLast: {
        borderTopRightRadius: 12
    },

    // Translating web class: .reception-table td
    receptionTableTd: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        color: '#374151', // var(--gray-700)
        fontSize: 14, // 0.875rem
        minWidth: 100
    },

    // Translating web class: .status
    status: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 9999, // var(--radius-pill)
        alignSelf: 'flex-start',
        borderWidth: 1
    },
    statusText: {
        fontSize: 11.52, // 0.72rem
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: 0.05
    },
    statusPending: { backgroundColor: '#fef3c7', color: '#d97706', borderColor: 'rgba(245,158,11,0.2)' },
    statusConfirmed: { backgroundColor: '#d1fae5', color: '#10b981', borderColor: 'rgba(16,185,129,0.2)' },
    statusCompleted: { backgroundColor: '#eff6ff', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.2)' },
    statusCancelled: { backgroundColor: '#fee2e2', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }
});

export default ReceptionPatientQueue;
