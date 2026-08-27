import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const ClinicDoctorRoster = ({ doctors = [] }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .clinic-card */}
            <View style={styles.clinicCard}>
                {/* Translating web class: .clinic-card h3 */}
                <Text style={styles.clinicCardH3}>Doctor Roster & Availability</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrapper}>
                    {/* Translating web class: .clinic-table */}
                    <View style={styles.clinicTable}>
                        
                        {/* Table Header */}
                        <View style={styles.clinicTableTrHeader}>
                            {/* Translating web class: .clinic-table th */}
                            <Text style={styles.clinicTableTh}>Doctor Name</Text>
                            <Text style={styles.clinicTableTh}>Department</Text>
                            <Text style={styles.clinicTableTh}>Availability</Text>
                            <Text style={styles.clinicTableTh}>Patients Today</Text>
                        </View>

                        {/* Table Body */}
                        {doctors.map((doc, idx) => (
                            <View key={idx} style={styles.clinicTableTr}>
                                {/* Translating web class: .clinic-table td */}
                                <Text style={styles.clinicTableTd}>{doc.name}</Text>
                                <View style={styles.clinicTableTd}>
                                    {/* Translating web class: .clinic-badge */}
                                    <View style={styles.clinicBadge}>
                                        <Text style={styles.clinicBadgeText}>{doc.department}</Text>
                                    </View>
                                </View>
                                <Text style={styles.clinicTableTd}>{doc.availability || 'Unavailable'}</Text>
                                <Text style={styles.clinicTableTd}>{doc.patientsCount || 0}</Text>
                            </View>
                        ))}
                        {doctors.length === 0 && (
                            <View style={styles.clinicTableTr}>
                                <Text style={styles.clinicTableTd}>No doctors found in the roster.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 16 },

    // Translating web class: .clinic-card
    clinicCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 24,
        marginBottom: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    // Translating web class: .clinic-card h3
    clinicCardH3: {
        fontSize: 16, // 1rem
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16
    },

    tableWrapper: {
        flexGrow: 1
    },

    // Translating web class: .clinic-table
    clinicTable: {
        width: '100%'
    },
    
    clinicTableTrHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0'
    },
    clinicTableTr: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },

    // Translating web class: .clinic-table th
    clinicTableTh: {
        flex: 1,
        minWidth: 120,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        color: '#64748b',
        fontWeight: '700',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 0.04
    },
    
    // Translating web class: .clinic-table td
    clinicTableTd: {
        flex: 1,
        minWidth: 120,
        paddingVertical: 10,
        paddingHorizontal: 12,
        color: '#1e293b',
        fontSize: 13
    },

    // Translating web class: .clinic-badge
    clinicBadge: {
        backgroundColor: '#eef2ff',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignSelf: 'flex-start'
    },
    clinicBadgeText: {
        color: '#6366f1',
        fontSize: 11,
        fontWeight: '700'
    }
});

export default ClinicDoctorRoster;
