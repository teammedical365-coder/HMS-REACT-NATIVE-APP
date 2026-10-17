import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth Screens
import Login from '../screens/user/Login';
import Signup from '../screens/user/Signup';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';
import { HARDCODED_TENANT } from '../tenant';
import { 
    getSubdomain, 
    isCentralPlatformDomain,
    BUILD_TENANT_ID,
    BUILD_TENANT_SLUG,
    BUILD_TENANT_IDENTIFIER,
    HAS_EXPLICIT_HOSPITAL_TENANT_CONFIG,
    IS_FIXED_NATIVE_WHITE_LABEL_BUILD,
} from '../utils/subdomain';

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
    // 1. Web environment: inspect pathname, hash, query params, hostname, and subdomain
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = (window.location.hash || '').toLowerCase();
        const path = (window.location.pathname || '').toLowerCase();
        const search = (window.location.search || '').toLowerCase();
        const host = (window.location.hostname || '').toLowerCase();

        // 1a. Explicit Central Admin / Super Admin routes take precedence across all hosts
        if (
            hash.includes('supremeadmin') ||
            hash.includes('centraladmin') ||
            path.includes('supremeadmin') ||
            path.includes('centraladmin') ||
            path === '/admin' ||
            path.startsWith('/admin/') ||
            host === 'admin.medical365.in' ||
            host.startsWith('admin.')
        ) {
            return 'CentralAdminLogin';
        }

        // 1b. Explicit Hospital Admin routes
        if (hash.includes('hospitaladmin') || path.includes('hospitaladmin')) {
            return 'HospitalAdminLogin';
        }

        // 1c. Explicit Patient Portal routes
        if (hash.includes('patient') || path.includes('patient')) {
            return 'PatientPortalLogin';
        }

        // 1d. Explicit tenant in search query (e.g. ?tenant=xyz, ?slug=xyz, ?hospital=xyz)
        if (
            search.includes('tenant=') ||
            search.includes('slug=') ||
            search.includes('hospital=') ||
            search.includes('hospitalid=')
        ) {
            return 'Login';
        }

        // 1e. Subdomain-based hospital tenant resolution (e.g. apollo.medical365.in or custom domain)
        const sub = getSubdomain();
        if (sub && sub !== 'admin' && sub !== 'www' && sub !== 'api') {
            return 'Login';
        }

        // 1f. Valid explicitly configured hospital Tenant ID or Slug for Web
        // When running web with an explicitly configured hospital tenant (e.g. EXPO_PUBLIC_TENANT_ID or SLUG),
        // resolve to that hospital's Clinical Portal (Login), even on localhost or Vercel host.
        if (HAS_EXPLICIT_HOSPITAL_TENANT_CONFIG) {
            return 'Login';
        }

        // 1g. Central Platform & Vercel deployment detection:
        // Main Vercel deployment (hms-react-native-app.vercel.app), platform root, or default local dev
        // with NO explicitly configured hospital tenant.
        // Stale localStorage.tenantSlug alone MUST NOT turn central platform into hospital portal.
        if (isCentralPlatformDomain(host)) {
            return 'CentralAdminLogin';
        }

        // 1h. Custom hospital domains: inspect saved tenant in local storage
        try {
            if (localStorage.getItem('tenantSlug')) {
                return 'Login';
            }
        } catch (_) {}

        // 1i. Explicit staff login on custom hospital domain
        if (hash.includes('login') || path.includes('login')) {
            return 'Login';
        }

        // Web fallback: Central Admin
        return 'CentralAdminLogin';
    }

    // 2. Native fixed-tenant hospital APK
    if (IS_FIXED_NATIVE_WHITE_LABEL_BUILD) {
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

            {/* Central Admin (Omitted ONLY in fixed-tenant native white-label builds to enforce portal isolation) */}
            {!IS_FIXED_NATIVE_WHITE_LABEL_BUILD && (
                <>
                    <Stack.Screen name="CentralAdminLogin" component={CentralAdminLogin} />
                    <Stack.Screen name="CentralAdminSignup" component={CentralAdminSignup} />
                    <Stack.Screen name="AdminSignup" component={AdminSignup} />
                </>
            )}

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