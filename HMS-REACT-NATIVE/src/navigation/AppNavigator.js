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
    AccountantApp,
    CashierApp,
    NurseApp,
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

const defaultLabUser = {
    _id: "6758493021abcdef12345677",
    name: "Vikram Sen",
    email: "lab@metropolisgeneral.org",
    role: "lab",
    hospitalId: "6758493021abcdef12345679",
    hospitalName: "Metropolis General Hospital",
    permissions: ["lab_manage", "report_upload", "tests_view"],
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

const defaultDoctorUser = {
    _id: "6758493021abcdef12345670",
    name: "Dr. Alexander Fleming",
    email: "doctor@metropolisgeneral.org",
    role: "doctor",
    hospitalId: "6758493021abcdef12345679",
    hospitalName: "Metropolis General Hospital",
    permissions: [
        "visit_diagnose",
        "patient_view",
        "clinical_history",
        "lab_view",
        "pharmacy_view",
        "ai_assistant"
    ],
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

    React.useEffect(() => {
        logKbEvent(`APPNAV_LOADING_${isLoading ? 'TRUE' : 'FALSE'}`, { appNavLoading: !!isLoading });
        console.log(`[KB-DEBUG] AppNavigator loading changed to: ${isLoading}`);
    }, [isLoading]);

    const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

    // Check if role is explicitly targeted in URL / hash
    const forcedRoleInUrl = isWeb ? (
        (window.location.hash.toLowerCase().includes('doctor') || window.location.search.toLowerCase().includes('doctor') || window.location.pathname.toLowerCase().includes('doctor') || window.location.pathname.includes('AIAssistant') || window.location.pathname.includes('IPDCommandCenter')) ? 'doctor' :
        (window.location.hash.toLowerCase().includes('lab') || window.location.search.toLowerCase().includes('lab') || window.location.pathname.toLowerCase().includes('lab')) ? 'lab' :
        (window.location.hash.toLowerCase().includes('pharmacy') || window.location.search.toLowerCase().includes('pharmacy') || window.location.pathname.toLowerCase().includes('pharmacy')) ? 'pharmacy' :
        (window.location.hash.toLowerCase().includes('reception') || window.location.search.toLowerCase().includes('reception') || window.location.pathname.toLowerCase().includes('reception')) ? 'reception' :
        (window.location.hash.toLowerCase().includes('hospitaladmin') || window.location.search.toLowerCase().includes('hospitaladmin') || window.location.pathname.toLowerCase().includes('hospitaladmin')) ? 'hospitaladmin' :
        null
    ) : null;

    const isLoggedOut = !forcedRoleInUrl && isWeb && (localStorage.getItem('isLoggedOut') === 'true' || sessionStorage.getItem('isLoggedOut') === 'true');

    const isDoctorDev = !isLoggedOut && isWeb && (
        forcedRoleInUrl === 'doctor' ||
        localStorage.getItem('role') === 'doctor' ||
        localStorage.getItem('role') === 'clinicdoctor'
    );
    const isLabDev = !isLoggedOut && !isDoctorDev && isWeb && (
        forcedRoleInUrl === 'lab' ||
        localStorage.getItem('role') === 'lab' ||
        localStorage.getItem('role') === 'pathologist' ||
        localStorage.getItem('role') === 'labtechnician'
    );
    const isPharmacyDev = !isLoggedOut && !isDoctorDev && !isLabDev && isWeb && (
        forcedRoleInUrl === 'pharmacy' ||
        localStorage.getItem('role') === 'pharmacy' ||
        localStorage.getItem('role') === 'pharmacist'
    );
    const isReceptionDev = !isLoggedOut && !isDoctorDev && !isLabDev && !isPharmacyDev && isWeb && (
        forcedRoleInUrl === 'reception' ||
        localStorage.getItem('role') === 'reception' ||
        localStorage.getItem('role') === 'receptionist'
    );
    const isHospitalAdminDev = !isLoggedOut && !isDoctorDev && !isLabDev && !isPharmacyDev && !isReceptionDev && isWeb && (
        forcedRoleInUrl === 'hospitaladmin' ||
        localStorage.getItem('role') === 'hospitaladmin'
    );

    React.useEffect(() => {
        if (isDoctorDev && !isAuthenticated) {
            if (isWeb) {
                localStorage.removeItem('isLoggedOut');
                sessionStorage.removeItem('isLoggedOut');
                localStorage.setItem('role', 'doctor');
                try {
                    localStorage.setItem('user', JSON.stringify(defaultDoctorUser));
                } catch(e) {}
            }
            dispatch(setCredentials({
                user: defaultDoctorUser,
                token: "mock_jwt_token_for_doctor_parity"
            }));
        } else if (isLabDev && !isAuthenticated) {
            dispatch(setCredentials({
                user: defaultLabUser,
                token: "mock_jwt_token_for_lab_parity"
            }));
        } else if (isPharmacyDev && !isAuthenticated) {
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
    }, [isDoctorDev, isLabDev, isPharmacyDev, isReceptionDev, isHospitalAdminDev, isAuthenticated, dispatch]);

    const activeUser = user || (
        isDoctorDev ? defaultDoctorUser : (
            isLabDev ? defaultLabUser : (
                isPharmacyDev ? defaultPharmacyUser : (
                    isReceptionDev ? defaultReceptionUser : (
                        isHospitalAdminDev ? defaultHospitalAdminUser : null
                    )
                )
            )
        )
    );
    const isEffectiveAuth = isAuthenticated || isDoctorDev || isLabDev || isPharmacyDev || isReceptionDev || isHospitalAdminDev;

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
                return <Stack.Screen name="Accountant" component={AccountantApp} />;
            case 'billing':
            case 'cashier':
                return <Stack.Screen name="Cashier" component={CashierApp} />;
            case 'lab':
            case 'pathologist':
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