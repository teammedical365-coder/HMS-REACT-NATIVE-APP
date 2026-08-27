import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { patientAPI } from '../../utils/api';

const UnifiedPatientProfile = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const [patientData, setPatientData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // In React Native, get ID from route params
    const patientId = route.params?.id;

    useEffect(() => {
        if (patientId) {
            fetchPatient();
        }
    }, [patientId]);

    const fetchPatient = async () => {
        setLoading(true);
        try {
            const res = await patientAPI.getPatientById(patientId);
            if (res.success) {
                setPatientData(res.patient);
            }
        } catch (err) {
            console.error("Failed to load patient profile:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loaderText}>Loading Unified Profile...</Text>
            </View>
        );
    }

    if (!patientData) {
        return (
            <View style={styles.loaderContainer}>
                <Text style={styles.errorText}>Patient profile not found.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Unified Patient Record</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.profileCard}>
                    <View style={styles.profileHeaderRow}>
                        <View style={styles.avatarLarge}>
                            {patientData.avatar ? (
                                <Image source={{ uri: patientData.avatar }} style={styles.avatarImg} />
                            ) : (
                                <Text style={styles.avatarLetter}>{(patientData.name || 'P')[0].toUpperCase()}</Text>
                            )}
                        </View>
                        <View style={styles.nameBlock}>
                            <Text style={styles.patientName}>{patientData.name}</Text>
                            <Text style={styles.patientId}>MRN: {patientData.patientId || 'N/A'}</Text>
                        </View>
                    </View>

                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Email</Text>
                            <Text style={styles.detailValue}>{patientData.email || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Phone</Text>
                            <Text style={styles.detailValue}>{patientData.phone || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Age / Gender</Text>
                            <Text style={styles.detailValue}>{patientData.age || '-'} / {patientData.gender || '-'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Blood Group</Text>
                            <Text style={styles.detailValue}>{patientData.bloodGroup || 'N/A'}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    loaderText: { color: '#3b82f6', fontWeight: '600', marginTop: 10 },
    errorText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backBtn: { marginRight: 16 },
    backBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    content: { padding: 20 },
    profileCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
    profileHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 24 },
    avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarLetter: { fontSize: 28, color: '#ffffff', fontWeight: '800' },
    nameBlock: { marginLeft: 16 },
    patientName: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    patientId: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    detailItem: { width: '50%', marginBottom: 16 },
    detailLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    detailValue: { fontSize: 15, color: '#1e293b', fontWeight: '600' }
});

export default UnifiedPatientProfile;
