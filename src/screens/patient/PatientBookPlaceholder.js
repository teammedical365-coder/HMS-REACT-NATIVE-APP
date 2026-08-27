import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const PatientBookPlaceholder = () => {
    const navigation = useNavigation();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Book Appointment</Text>
            <Text style={styles.desc}>This feature is coming soon to the mobile app.</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
                <Text style={styles.btnText}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    desc: { fontSize: 16, color: '#64748b', marginBottom: 20, textAlign: 'center' },
    btn: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
    btnText: { color: 'white', fontWeight: 'bold' }
});

export default PatientBookPlaceholder;
