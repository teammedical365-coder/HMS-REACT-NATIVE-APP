import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../utils/api';

const HospitalLogin = () => {
    const navigation = useNavigation();
    const [hospitalSlug, setHospitalSlug] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!hospitalSlug) { Alert.alert('Error', 'Please enter a hospital slug'); return; }
        setLoading(true);
        try {
            // Verify and fetch hospital config
            const res = await authAPI.getHospitalConfig(hospitalSlug);
            if (res.success) {
                // Navigate to the main login passing the hospital context
                navigation.navigate('Login', { hospitalSlug });
            }
        } catch (error) { Alert.alert('Error', error.response?.data?.message || 'Hospital not found'); }
        finally { setLoading(false); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Tenant Portal</Text>
            <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Hospital Shortcode/Slug" value={hospitalSlug} onChangeText={setHospitalSlug} autoCapitalize="none" />
                <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                    <Text style={styles.btnText}>{loading ? 'Verifying...' : 'Find Hospital'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 12, elevation: 2 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', padding: 12, borderRadius: 8, marginBottom: 16 },
    btn: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, alignItems: 'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default HospitalLogin;
