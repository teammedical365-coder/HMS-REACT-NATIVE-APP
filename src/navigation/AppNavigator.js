import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// AuthContext ko hata kar humne Redux ka hook import kiya
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
    // Context ki jagah Redux se status le rahe hain
    const { loading: isLoading, isAuthenticated, user, token } = useAuth();
    const userRole = user?.role;

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // Role-based routing resolution based EXACTLY on web client strings
    const renderRoleStack = () => {
        // Extract role string whether user.role is a string or an object { name: 'admin' }
       const rawRole = typeof user?.role === 'object' ? user?.role?.name : user?.role;
const role = (rawRole || '').toLowerCase().replace(/\s+/g, '');

switch (role) {
    case 'superadmin':
    case 'centraladmin':
    case 'admin':
        return <Stack.Screen name="CentralAdmin" component={CentralAdminApp} />;
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
            {(!isAuthenticated || !token) ? ( // Check both isAuthenticated and token to prevent premature API calls in child screens
                // No token found, user isn't signed in
                <Stack.Screen name="Auth" component={AuthStack} />
            ) : (
                // User is signed in, render specific stack based on exact role
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