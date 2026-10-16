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
    AccountantApp,
    CashierApp,
    NurseApp,
    PatientApp,
    AssistantApp
} from './RoleStacks';
import DashboardScreen from '../screens/DashboardScreen';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { useBranding } from '../context/BrandingContext';
import { connectAuthenticatedSocket, disconnectSocket } from '../utils/socket';

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
    const { loadBranding } = useBranding();

    // Auto-load hospital branding when user logs in (Web App.jsx 1:1 Parity)
    React.useEffect(() => {
        if (isAuthenticated && user) {
            const hospitalId = user.hospitalId || (typeof user.hospital === 'object' ? user.hospital?._id : user.hospital);
            const rawRole = typeof user.role === 'object' ? user.role?.name : user.role;
            const role = (rawRole || '').toLowerCase();
            if (hospitalId && !['centraladmin', 'superadmin'].includes(role)) {
                loadBranding(hospitalId);
            }
        }
        // White-label requirement: preserve hospital branding across user sessions/logout
    }, [isAuthenticated, user, loadBranding]);

    // Centralized authoritative socket connection lifecycle
    React.useEffect(() => {
        if (isAuthenticated && user) {
            connectAuthenticatedSocket(user);
        } else {
            disconnectSocket();
        }
    }, [isAuthenticated, user]);

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
                return <Stack.Screen name="Accountant" component={AccountantApp} />;
            case 'billing':
            case 'cashier':
                return <Stack.Screen name="Cashier" component={CashierApp} />;
            case 'lab':
            case 'pathologist':
            case 'lab_technician':
            case 'labtechnician':
                return <Stack.Screen name="Lab" component={LabApp} />;
            case 'pharmacy':
            case 'pharmacist':
                return <Stack.Screen name="Pharmacy" component={PharmacyApp} />;
            case 'nurse':
            case 'staffnurse':
            case 'headnurse':
                return <Stack.Screen name="Nurse" component={NurseApp} />;
            case 'patient':
                return <Stack.Screen name="Patient" component={PatientApp} />;
            case 'doctor_assistant':
            case 'doctorassistant':
            case 'clinicalassistant':
            case 'assistant':
                return <Stack.Screen name="Assistant" component={AssistantApp} />;
            default:
                return <Stack.Screen name="Fallback" component={FallbackStack} />;
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
                {!isAuthenticated ? (
                    <Stack.Screen name="Auth" component={AuthStack} />
                ) : (
                    renderRoleStack()
                )}
            </Stack.Navigator>

            {isLoading && (
                <View style={styles.globalLoadingOverlay}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    globalLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 10, // For Android
    }
});

export default AppNavigator;