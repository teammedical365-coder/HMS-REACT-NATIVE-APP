import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../store/hooks';

import AuthStack from './AuthStack';
import {
    CentralAdminApp,
    HospitalAdminApp,
    DoctorApp,
    OTApp,
    LabApp,
    PharmacyApp,
    ReceptionApp,
    CashierApp,
    PatientApp
} from './RoleStacks';
import DashboardScreen from '../screens/DashboardScreen';
import DashboardLayout from '../components/layouts/DashboardLayout';

const Stack = createNativeStackNavigator();

const FallbackStack = () => (
    <DashboardLayout>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
    </DashboardLayout>
);

const AppNavigator = () => {
    const { loading: isLoading, isAuthenticated, user } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    const renderRoleStack = () => {
        const rawRole = typeof user?.role === 'object' ? user?.role?.name : user?.role;
        const role = (rawRole || '').toLowerCase().replace(/\s+/g, '');

        switch (role) {
            case 'superadmin':
            case 'centraladmin':
            case 'admin':
                return <Stack.Screen name="CentralAdmin" component={CentralAdminApp} options={{ headerShown: false }} />;
            case 'hospitaladmin':
                return <Stack.Screen name="HospitalAdmin" component={HospitalAdminApp} />;
            case 'doctor':
            case 'clinicdoctor':
                return <Stack.Screen name="Doctor" component={DoctorApp} />;
            case 'otmanager':
            case 'otstaff':
                return <Stack.Screen name="OT" component={OTApp} />;
            case 'reception':
            case 'receptionist':
                return <Stack.Screen name="Reception" component={ReceptionApp} />;
            case 'accountant':
            case 'billing':
            case 'cashier':
                return <Stack.Screen name="Cashier" component={CashierApp} />;
            case 'lab':
            case 'pathologist':
                return <Stack.Screen name="Lab" component={LabApp} />;
            case 'pharmacy':
            case 'pharmacist':
                return <Stack.Screen name="Pharmacy" component={PharmacyApp} />;
            case 'patient':
                return <Stack.Screen name="Patient" component={PatientApp} />;
            default:
                return <Stack.Screen name="Fallback" component={FallbackStack} />;
        }
    };

    return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
            {/* STRICT TOKEN CHECK REMOVED. Relying cleanly on isAuthenticated switch */}
            {!isAuthenticated ? (
                <Stack.Screen name="Auth" component={AuthStack} />
            ) : (
                renderRoleStack()
            )}
        </Stack.Navigator>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f1f5f9'
    }
});

export default AppNavigator;