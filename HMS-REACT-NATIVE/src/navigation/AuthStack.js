import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth Screens
// We assume WorkspaceLoginScreen is created for the multi-tenant ID entry
import WorkspaceLoginScreen from '../screens/Auth/WorkspaceLoginScreen';
import Login from '../screens/user/Login';
import SignupScreen from '../screens/Auth/SignupScreen';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';

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

const AuthStack = () => {
    // If EXPO_PUBLIC_TENANT_ID is injected, route directly to the Hospital Login.
    // Otherwise, fallback to WorkspaceLogin (or CentralAdminLogin).
    const hasTenant = !!process.env.EXPO_PUBLIC_TENANT_ID;
    const initialRoute = hasTenant ? "Login" : "CentralAdminLogin";

    return (
        <Stack.Navigator 
            initialRouteName={initialRoute}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right'
            }}
        >
            {/* Multi-Tenant Workflow */}
            <Stack.Screen name="WorkspaceLogin" component={WorkspaceLoginScreen} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Signup" component={SignupScreen} />
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