import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth Screens
// We assume WorkspaceLoginScreen is created for the multi-tenant ID entry
import WorkspaceLoginScreen from '../screens/Auth/WorkspaceLoginScreen';
import LoginScreen from '../screens/Auth/LoginScreen';
import SignupScreen from '../screens/Auth/SignupScreen';
import OTPVerificationScreen from '../screens/Auth/OTPVerificationScreen';

// Central Admin Auth
import CentralAdminLogin from '../screens/centraladmin/CentralAdminLogin';
import CentralAdminSignup from '../screens/centraladmin/CentralAdminSignup';

// Patient Auth
import PatientPortalLogin from '../screens/patient/PatientPortalLogin';
import PatientSignup from '../screens/patient/PatientSignup';
import PatientForgotPassword from '../screens/patient/PatientForgotPassword';
import PatientResetPassword from '../screens/patient/PatientResetPassword';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
    return (
        <Stack.Navigator 
            initialRouteName="CentralAdminLogin" // <--- BAS YEH LINE CHANGE KI HAI
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right'
            }}
        >
            {/* Multi-Tenant Workflow */}
            <Stack.Screen name="WorkspaceLogin" component={WorkspaceLoginScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="OTP" component={OTPVerificationScreen} />

            {/* Central Admin (Independent of Workspace usually, but part of public stack) */}
            <Stack.Screen name="CentralAdminLogin" component={CentralAdminLogin} />
            <Stack.Screen name="CentralAdminSignup" component={CentralAdminSignup} />

            {/* Patient Portal */}
            <Stack.Screen name="PatientPortalLogin" component={PatientPortalLogin} />
            <Stack.Screen name="PatientSignup" component={PatientSignup} />
            <Stack.Screen name="PatientForgotPassword" component={PatientForgotPassword} />
            <Stack.Screen name="PatientResetPassword" component={PatientResetPassword} />
        </Stack.Navigator>
    );
};

export default AuthStack;