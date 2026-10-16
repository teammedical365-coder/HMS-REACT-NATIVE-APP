import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth Screens
import Login from '../screens/user/Login';
import Signup from '../screens/user/Signup';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';
import { HARDCODED_TENANT } from '../tenant';
import { getSubdomain } from '../utils/subdomain';

// Central Admin Auth
import CentralAdminLogin from '../screens/centraladmin/CentralAdminLogin';
import CentralAdminSignup from '../screens/centraladmin/CentralAdminSignup';
import AdminSignup from '../screens/administration/AdminSignup';

// Hospital Admin Auth
import HospitalAdminLogin from '../screens/hospitaladmin/HospitalAdminLogin';

// Patient Auth
import PatientPortalLogin from '../screens/patient/PatientPortalLogin';
import PatientSignup from '../screens/patient/PatientSignup';
import PatientForgotPassword from '../screens/patient/PatientForgotPassword';
import PatientResetPassword from '../screens/patient/PatientResetPassword';

// Public Services, Doctors & Booking Workflow
import Services from '../screens/user/Services';
import Doctors from '../screens/user/Doctors';
import Appointment from '../screens/user/Appointment';
import AppointmentSuccess from '../screens/user/AppointmentSuccess';

const Stack = createNativeStackNavigator();

/**
 * Authoritative initial route resolver:
 * - Detects web URLs (hash/pathname/hostname/subdomain/query) for direct portal mapping
 * - Detects configured hospital build tenants for white-label APK / fixed deployments
 * - Falls back to original prior committed default: CentralAdminLogin (Super Admin)
 */
const resolveInitialRoute = () => {
    // 1. Web environment: inspect pathname, hash, query params, and subdomain
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = (window.location.hash || '').toLowerCase();
        const path = (window.location.pathname || '').toLowerCase();
        const search = (window.location.search || '').toLowerCase();
        const host = (window.location.hostname || '').toLowerCase();

        // Supreme / Central Admin explicit routes
        if (
            hash.includes('supremeadmin') ||
            hash.includes('centraladmin') ||
            path.includes('supremeadmin') ||
            host === 'admin.medical365.in' ||
            host.startsWith('admin.')
        ) {
            return 'CentralAdminLogin';
        }

        // Hospital Admin explicit routes
        if (hash.includes('hospitaladmin') || path.includes('hospitaladmin')) {
            return 'HospitalAdminLogin';
        }

        // Patient Portal explicit routes
        if (hash.includes('patient') || path.includes('patient')) {
            return 'PatientPortalLogin';
        }

        // Hospital Staff / User Login explicit routes
        if (hash.includes('login') || path.includes('login')) {
            return 'Login';
        }

        // Subdomain / query tenant resolution
        const sub = getSubdomain();
        if (sub && sub !== 'admin' && sub !== 'www' && sub !== 'api') {
            return 'Login';
        }
        if (search.includes('tenant=') || search.includes('slug=') || search.includes('hospital=')) {
            return 'Login';
        }

        // Saved tenant in local storage
        try {
            if (localStorage.getItem('tenantSlug')) {
                return 'Login';
            }
        } catch (_) {}
    }

    // 2. Pre-configured tenant (Build environment / White-label APK / Hardcoded config)
    const hasConfiguredTenant = Boolean(
        process.env.EXPO_PUBLIC_TENANT_ID ||
        process.env.EXPO_PUBLIC_TENANT_SLUG ||
        HARDCODED_TENANT?.tenantId ||
        HARDCODED_TENANT?.slug
    );
    if (hasConfiguredTenant) {
        return 'Login';
    }

    // 3. Fallback based on original prior committed code: CentralAdminLogin
    return 'CentralAdminLogin';
};

const AuthStack = () => {
    const initialRoute = resolveInitialRoute();

    return (
        <Stack.Navigator 
            initialRouteName={initialRoute}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right'
            }}
        >
            {/* Hospital User Auth & Workflow */}
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={Signup} />
            <Stack.Screen name="OTP" component={OTPVerificationScreen} />

            {/* Public Booking Workflow */}
            <Stack.Screen name="Services" component={Services} />
            <Stack.Screen name="Doctors" component={Doctors} />
            <Stack.Screen name="Appointment" component={Appointment} />
            <Stack.Screen name="AppointmentSuccess" component={AppointmentSuccess} />

            {/* Central Admin (Independent of Workspace usually, but part of public stack) */}
            <Stack.Screen name="CentralAdminLogin" component={CentralAdminLogin} />
            <Stack.Screen name="CentralAdminSignup" component={CentralAdminSignup} />
            <Stack.Screen name="AdminSignup" component={AdminSignup} />

            {/* Hospital Admin Portal */}
            <Stack.Screen name="HospitalAdminLogin" component={HospitalAdminLogin} />

            {/* Patient Portal */}
            <Stack.Screen name="PatientPortalLogin" component={PatientPortalLogin} />
            <Stack.Screen name="PatientSignup" component={PatientSignup} />
            <Stack.Screen name="PatientForgotPassword" component={PatientForgotPassword} />
            <Stack.Screen name="PatientResetPassword" component={PatientResetPassword} />
        </Stack.Navigator>
    );
};

export default AuthStack;