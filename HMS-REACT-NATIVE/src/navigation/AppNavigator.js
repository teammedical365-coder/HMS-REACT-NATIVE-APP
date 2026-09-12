import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch } from 'react-redux';
import { useAuth } from '../store/hooks';
import { setCredentials } from '../store/slices/authSlice';

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

const defaultHospitalAdminUser = {
    _id: "6758493021abcdef12345678",
    name: "Dr. Katherine Vance",
    email: "admin@metropolisgeneral.org",
    role: "hospitaladmin",
    hospitalId: "6758493021abcdef12345679",
    hospitalName: "Metropolis General Hospital",
    permissions: ["all"],
    subscriptionPlan: "pro"
};

const defaultReceptionUser = {
    _id: "6758493021abcdef12345699",
    name: "Aman Sharma",
    email: "reception@metropolisgeneral.org",
    role: "receptionist",
    hospitalId: "6758493021abcdef12345679",
    hospitalName: "Metropolis General Hospital",
    permissions: ["reception_manage", "patient_register", "billing_access"],
    subscriptionPlan: "pro"
};

const defaultPharmacyUser = {
    _id: "6758493021abcdef12345688",
    name: "Rajesh Patel",
    email: "pharmacy@metropolisgeneral.org",
    role: "pharmacist",
    hospitalId: "6758493021abcdef12345679",
    hospitalName: "Metropolis General Hospital",
    permissions: ["pharmacy_manage", "inventory_manage", "billing_access"],
    subscriptionPlan: "pro"
};

const FallbackStack = () => (
    <DashboardLayout>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
        </Stack.Navigator>
    </DashboardLayout>
);

const AppNavigator = () => {
    const dispatch = useDispatch();
    const { loading: isLoading, isAuthenticated, user } = useAuth();

    const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
    const isLoggedOut = isWeb && (localStorage.getItem('isLoggedOut') === 'true' || sessionStorage.getItem('isLoggedOut') === 'true');
    const isPharmacyDev = !isLoggedOut && isWeb && (
        window.location.hash.includes('pharmacy') ||
        window.location.search.includes('pharmacy') ||
        window.location.pathname.includes('pharmacy') ||
        localStorage.getItem('role') === 'pharmacy' ||
        localStorage.getItem('role') === 'pharmacist'
    );
    const isReceptionDev = !isLoggedOut && !isPharmacyDev && isWeb && (
        window.location.hash.includes('reception') ||
        window.location.search.includes('reception') ||
        window.location.pathname.includes('reception') ||
        localStorage.getItem('role') === 'reception' ||
        localStorage.getItem('role') === 'receptionist' ||
        (!window.location.hash.includes('hospitaladmin') && !window.location.search.includes('hospitaladmin') && localStorage.getItem('role') !== 'hospitaladmin')
    );
    const isHospitalAdminDev = !isLoggedOut && !isPharmacyDev && !isReceptionDev && isWeb && (
        window.location.hash.includes('hospitaladmin') ||
        window.location.search.includes('hospitaladmin') ||
        window.location.pathname.includes('hospitaladmin') ||
        localStorage.getItem('role') === 'hospitaladmin'
    );

    React.useEffect(() => {
        if (isPharmacyDev && !isAuthenticated) {
            dispatch(setCredentials({
                user: defaultPharmacyUser,
                token: "mock_jwt_token_for_pharmacy_parity"
            }));
        } else if (isReceptionDev && !isAuthenticated) {
            dispatch(setCredentials({
                user: defaultReceptionUser,
                token: "mock_jwt_token_for_reception_parity"
            }));
        } else if (isHospitalAdminDev && !isAuthenticated) {
            dispatch(setCredentials({
                user: defaultHospitalAdminUser,
                token: "mock_jwt_token_for_hospital_admin_parity"
            }));
        }
    }, [isPharmacyDev, isReceptionDev, isHospitalAdminDev, isAuthenticated, dispatch]);

    const activeUser = user || (isPharmacyDev ? defaultPharmacyUser : (isReceptionDev ? defaultReceptionUser : (isHospitalAdminDev ? defaultHospitalAdminUser : null)));
    const isEffectiveAuth = isAuthenticated || isPharmacyDev || isReceptionDev || isHospitalAdminDev;

    const renderRoleStack = () => {
        const currentUserObj = activeUser || user;
        const rawRole = typeof currentUserObj?.role === 'object' ? currentUserObj?.role?.name : currentUserObj?.role;
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
        <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
                {!isEffectiveAuth ? (
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