import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

const AppointmentSuccess = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const appointment = route.params?.appointment;

    useEffect(() => {
        if (!appointment) {
            navigation.replace('Appointment');
        }
    }, [appointment, navigation]);

    if (!appointment) return null;

    const appointmentDate = new Date(appointment.appointmentDate);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.contentWrapper}>

            {/* Success Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.successIcon}>✅</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Appointment Confirmed</Text>
                    </View>
                    <Text style={styles.title}>
                        Appointment <Text style={styles.textGradient}>Scheduled</Text>
                    </Text>
                    <Text style={styles.subtext}>
                        Your appointment has been successfully scheduled. We'll send you a confirmation email shortly.
                    </Text>
                </View>
            </View>

            {/* Appointment Details Card */}
            <View style={styles.cardSection}>
                <View style={styles.detailsCard}>
                    <Text style={styles.cardTitle}>Appointment Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Doctor:</Text>
                        <Text style={styles.detailValue}>{appointment.doctorName}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>{formattedDate}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Time:</Text>
                        <Text style={styles.detailValue}>{appointment.appointmentTime}</Text>
                    </View>

                    {appointment.serviceName && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Service:</Text>
                            <Text style={styles.detailValue}>{appointment.serviceName}</Text>
                        </View>
                    )}

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status:</Text>
                        <Text style={[styles.detailValue, { color: appointment.status === 'confirmed' ? '#00ffab' : '#ffd700' }]}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Status:</Text>
                        <Text style={[styles.detailValue, { color: appointment.paymentStatus === 'paid' ? '#00ffab' : '#ffd700' }]}>
                            {appointment.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                        </Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Dashboard')}>
                        <Text style={styles.btnSecondaryText}>Back to Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('LabReports')}>
                        <Text style={styles.btnPrimaryText}>View Lab Reports</Text>
                    </TouchableOpacity>
                </View>
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#0f172a' }, // Inheriting dark theme based on CSS visual clues
    contentWrapper: { padding: 24, paddingTop: 60, paddingBottom: 100 },
    header: { marginBottom: 40 },
    headerContent: { alignItems: 'center' },
    successIcon: { fontSize: 80, marginBottom: 20 },
    badge: { backgroundColor: 'rgba(20, 195, 142, 0.2)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginBottom: 20 },
    badgeText: { color: '#14c38e', fontSize: 14, fontWeight: '700' },
    title: { fontSize: 32, fontWeight: '700', color: '#ffffff', marginBottom: 16, textAlign: 'center' },
    textGradient: { color: '#14C38E' },
    subtext: { fontSize: 16, color: '#94a3b8', textAlign: 'center', lineHeight: 24, maxWidth: 400 },
    cardSection: { width: '100%' },
    detailsCard: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', marginBottom: 32 },
    cardTitle: { fontSize: 18, color: '#ffffff', fontWeight: '700', marginBottom: 24 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
    detailLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '500' },
    detailValue: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
    actions: { gap: 16 },
    btnPrimary: { backgroundColor: '#14C38E', paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
    btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    btnSecondary: { backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#334155', width: '100%' },
    btnSecondaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' }
});

export default AppointmentSuccess;
