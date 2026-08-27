import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ReceptionStatsGrid = ({ stats }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .reception-dashboard .dashboard-header */}
            <View style={styles.dashboardHeader}>
                {/* Translating web class: .reception-dashboard .dashboard-header h1 */}
                <Text style={styles.dashboardHeaderH1}>Reception Desk</Text>
            </View>

            {/* Note: The CSS file did not have specific classes for the stats grid itself, 
                so we maintain the layout parity requested using standard dashboard flex logic. */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Today's Appointments</Text>
                    <Text style={styles.statValue}>{stats?.todayCount || 0}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Waiting Patients</Text>
                    <Text style={styles.statValue}>{stats?.waitingCount || 0}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Completed</Text>
                    <Text style={styles.statValue}>{stats?.completedCount || 0}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 20 },
    
    // Translating web class: .reception-dashboard .dashboard-header
    dashboardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
        paddingVertical: 20,
        paddingHorizontal: 28,
        backgroundColor: '#ffffff', // var(--surface-0)
        borderRadius: 24, // var(--radius-xl)
        borderWidth: 1,
        borderColor: '#e5e7eb', // var(--gray-200)
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4
    },
    dashboardHeaderH1: {
        color: '#111827', // var(--gray-900)
        fontSize: 25.6, // 1.6rem
        fontWeight: '800',
        letterSpacing: -0.5
    },

    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16
    },
    statCard: {
        flex: 1,
        minWidth: 150,
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280', // var(--gray-500)
        fontWeight: '600',
        marginBottom: 8
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827'
    }
});

export default ReceptionStatsGrid;
