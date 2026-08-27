import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../utils/api';

const HospitalAdminLogin = () => {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
        setLoading(true);
        try {
            const res = await authAPI.login(email, password, null, null, 'hospitaladmin');
            if (res.success) {
                await AsyncStorage.setItem('token', res.token);
                await AsyncStorage.setItem('user', JSON.stringify(res.user));
                // Reload app state natively via Redux or navigation reset
                navigation.replace('DashboardLayout');
            }
        } catch (error) { Alert.alert('Error', error.response?.data?.message || 'Login failed'); }
        finally { setLoading(false); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Hospital Admin Portal</Text>
            <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Admin Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
                <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                    <Text style={styles.btnText}>{loading ? 'Authenticating...' : 'Secure Login'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ marginTop: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#3b82f6' }}>Go back to User Login</Text>
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
    btn: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8, alignItems: 'center' },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});

export default HospitalAdminLogin;
