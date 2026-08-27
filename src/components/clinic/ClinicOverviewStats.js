import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ClinicOverviewStats = ({ stats, clinicInfo }) => {
    return (
        <View style={styles.container}>
            {/* Translating web class: .clinic-banner */}
            <View style={styles.clinicBanner}>
                <Text style={styles.clinicBannerIcon}>🏥</Text>
                <Text style={styles.clinicBannerH2}>{clinicInfo?.name || 'Clinic Dashboard'}</Text>
            </View>

            {/* Translating web class: .clinic-kpi-grid */}
            <View style={styles.clinicKpiGrid}>
                {/* Translating web class: .clinic-kpi-card */}
                <View style={styles.clinicKpiCard}>
                    <Text style={styles.statLabel}>Today's Appointments</Text>
                    <Text style={styles.statValue}>{stats?.todayCount || 0}</Text>
                </View>
                <View style={styles.clinicKpiCard}>
                    <Text style={styles.statLabel}>Patients Waiting</Text>
                    <Text style={styles.statValue}>{stats?.waitingCount || 0}</Text>
                </View>
                <View style={styles.clinicKpiCard}>
                    <Text style={styles.statLabel}>Completed</Text>
                    <Text style={styles.statValue}>{stats?.completedCount || 0}</Text>
                </View>
                <View style={styles.clinicKpiCard}>
                    <Text style={styles.statLabel}>Total Revenue</Text>
                    <Text style={styles.statValue}>₹{stats?.revenue || 0}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginBottom: 16 },

    // Translating web class: .clinic-banner
    clinicBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#eef2ff', // approx linear-gradient fallback
        borderWidth: 1,
        borderColor: '#c7d2fe',
        borderRadius: 14,
        paddingVertical: 20,
        paddingHorizontal: 24,
        marginBottom: 20
    },
    // Translating web class: .clinic-banner-icon
    clinicBannerIcon: {
        fontSize: 40
    },
    // Translating web class: .clinic-banner h2
    clinicBannerH2: {
        fontSize: 22.4, // 1.4rem
        fontWeight: '800',
        color: '#1e293b'
    },

    // Translating web class: .clinic-kpi-grid
    clinicKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20
    },

    // Translating web class: .clinic-kpi-card
    clinicKpiCard: {
        flex: 1,
        minWidth: 160,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4
    },
    
    // Extrapolated standard text styles for KPIs
    statLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.04,
        marginBottom: 8
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b'
    }
});

export default ClinicOverviewStats;
