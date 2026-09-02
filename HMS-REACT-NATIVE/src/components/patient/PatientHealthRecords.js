import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PatientHealthRecords = ({ user }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .section-header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderH2}>Personal & Health Information</Text>
            </View>

            {/* Translating web class: .dashboard-card */}
            <View style={styles.dashboardCard}>
                <View style={styles.cardBody}>
                    {/* Translating web class: .profile-grid */}
                    <View style={styles.profileGrid}>
                        
                        {/* Translating web class: .profile-section */}
                        <View style={styles.profileSection}>
                            <Text style={styles.profileSectionH3}>Demographics</Text>
                            
                            {/* Translating web class: .profile-field */}
                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Full Name</Text>
                                {/* Translating web class: .value */}
                                <Text style={styles.profileFieldValue}>{user?.name || 'N/A'}</Text>
                            </View>

                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Date of Birth (Age)</Text>
                                <Text style={styles.profileFieldValue}>{user?.dateOfBirth ? `${new Date(user.dateOfBirth).toLocaleDateString()} (${user.age} yrs)` : 'N/A'}</Text>
                            </View>

                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Gender</Text>
                                <Text style={styles.profileFieldValue}>{user?.gender || 'N/A'}</Text>
                            </View>
                            
                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Blood Group</Text>
                                <Text style={styles.profileFieldValue}>{user?.bloodGroup || 'N/A'}</Text>
                            </View>
                        </View>

                        <View style={styles.profileSection}>
                            <Text style={styles.profileSectionH3}>Contact Information</Text>
                            
                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Email Address</Text>
                                <Text style={styles.profileFieldValue}>{user?.email || 'N/A'}</Text>
                            </View>

                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Phone Number</Text>
                                <Text style={styles.profileFieldValue}>{user?.phone || 'N/A'}</Text>
                            </View>

                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Emergency Contact</Text>
                                <Text style={styles.profileFieldValue}>{user?.emergencyContactName ? `${user.emergencyContactName} (${user.emergencyContactPhone})` : 'N/A'}</Text>
                            </View>
                            
                            <View style={styles.profileField}>
                                <Text style={styles.profileFieldLabel}>Address</Text>
                                <Text style={styles.profileFieldValue}>{user?.address || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* Placeholder for other records */}
            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                <Text style={styles.sectionHeaderH2}>Recent Vitals & Lab Reports</Text>
            </View>
            
            <View style={styles.dashboardCard}>
                <View style={styles.cardBody}>
                    <View style={styles.emptyStateLarge}>
                        <Text style={styles.emptyStateIcon}>📊</Text>
                        <Text style={styles.emptyStateH3}>No recent records found</Text>
                        <Text style={styles.emptyStateP}>Your vitals and lab reports will appear here after your visit.</Text>
                    </View>
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

    // Translating web class: .profile-grid
    profileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 32 // 2rem
    },

    // Translating web class: .profile-section
    profileSection: {
        flex: 1,
        minWidth: 300
    },
    profileSectionH3: {
        fontSize: 17.6, // 1.1rem
        color: '#0f172a',
        marginBottom: 16, // 1rem
        paddingBottom: 8, // 0.5rem
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        fontWeight: 'bold' // implicitly implied in heading
    },

    // Translating web class: .profile-field
    profileField: {
        marginBottom: 16 // 1rem
    },
    profileFieldLabel: {
        fontSize: 13.6, // 0.85rem
        color: '#64748b',
        marginBottom: 4, // 0.25rem
        fontWeight: '500'
    },
    
    // Translating web class: .value
    profileFieldValue: {
        fontSize: 16, // 1rem
        color: '#0f172a',
        fontWeight: '600'
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
    }
});

export default PatientHealthRecords;
