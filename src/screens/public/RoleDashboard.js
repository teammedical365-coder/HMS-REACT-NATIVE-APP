import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const RoleDashboard = () => {
    const navigation = useNavigation();

    useEffect(() => {
        const routeUser = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) {
                // Since this is RoleDashboard, it acts as a router/redirect.
                // In a React Native Drawer setup, DashboardLayout handles rendering the correct screens.
                navigation.replace('DashboardLayout');
            } else {
                navigation.replace('Home');
            }
        };
        routeUser();
    }, []);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.text}>Routing you to your dashboard...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
    text: { marginTop: 20, color: '#64748b', fontSize: 16 }
});

export default RoleDashboard;
