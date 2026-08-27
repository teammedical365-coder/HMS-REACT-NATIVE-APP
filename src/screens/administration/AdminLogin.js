import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const AdminLogin = () => {
    const navigation = useNavigation();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>SuperAdmin Login</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
                <Text style={styles.btnText}>Go to Main Login</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    btn: { backgroundColor: '#0f172a', padding: 14, borderRadius: 8 },
    btnText: { color: 'white', fontWeight: 'bold' }
});

export default AdminLogin;
