import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Home = () => {
    const navigation = useNavigation();

    return (
        <View style={styles.container}>
            <View style={styles.hero}>
                <Text style={styles.heroTitle}>Next-Gen Hospital Management</Text>
                <Text style={styles.heroSubtitle}>Connecting Patients, Doctors, and Clinics instantly.</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity style={styles.btnPatient} onPress={() => navigation.navigate('PatientPortalLogin')}>
                    <Text style={styles.btnText}>I am a Patient</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnStaff} onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.btnText}>Hospital Staff / Doctor</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnStaff, { backgroundColor: '#475569', marginTop: 10 }]} onPress={() => navigation.navigate('HospitalLogin')}>
                    <Text style={styles.btnText}>Tenant Login</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', padding: 20 },
    hero: { marginBottom: 40, alignItems: 'center' },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 10 },
    heroSubtitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
    actions: { width: '100%', gap: 16 },
    btnPatient: { backgroundColor: '#3b82f6', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 2 },
    btnStaff: { backgroundColor: '#10b981', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 2 },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});

export default Home;
