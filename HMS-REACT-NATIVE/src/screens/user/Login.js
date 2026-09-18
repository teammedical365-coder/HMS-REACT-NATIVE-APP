import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../../utils/api';
import { useBranding } from '../../context/BrandingContext';

import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';
import { logKbEvent, kbDebugState, subscribeKbDebug } from '../../utils/kbDebug';

const Login = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { branding } = useBranding();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg, tenant } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '', hospitalSlug: '' });
    const [nativeSlug, setNativeSlug] = useState(null);
    const [localError, setLocalError] = useState(null);
    const searchParams = route.params || {};

    useEffect(() => {
        kbDebugState.loginMountCount += 1;
        logKbEvent('LOGIN_MOUNT', { loginMountCount: kbDebugState.loginMountCount, currentRoute: route.name || 'Login' });
        console.log(`[KB-DEBUG] LOGIN_MOUNT #${kbDebugState.loginMountCount}`);

        return () => {
            kbDebugState.loginUnmountCount += 1;
            logKbEvent('LOGIN_UNMOUNT', { loginUnmountCount: kbDebugState.loginUnmountCount });
            console.log(`[KB-DEBUG] LOGIN_UNMOUNT #${kbDebugState.loginUnmountCount}`);
        };
    }, []);

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());

        // Use hardcoded tenant
        import('../../tenant.js').then((module) => {
            if (module.HARDCODED_TENANT && module.HARDCODED_TENANT.slug) {
                setNativeSlug(module.HARDCODED_TENANT.slug);
                AsyncStorage.setItem('tenantSlug', module.HARDCODED_TENANT.slug);
            }
        }).catch(err => {
            console.error('[Login] Could not load tenant.js', err);
        });
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            const handleRedirect = async () => {
                const tenantRaw = await AsyncStorage.getItem('tenant') || (tenant ? JSON.stringify(tenant) : null);
                let parsedTenant = null;
                try {
                    if (tenantRaw) parsedTenant = JSON.parse(tenantRaw);
                } catch (e) { }

                if (parsedTenant && parsedTenant.subdomain) {
                    // Mobile SSO Handover logic can be placed here
                    // e.g., using Linking to open a web browser if it's a web-only portal
                    // but for native, we usually stay in the app. Let's stick to standard routing.
                }

                const redirectMap = {
                    admin: 'Admin',
                    superadmin: 'SuperAdmin',
                    centraladmin: 'SupremeAdmin',
                    doctor: 'DoctorPatients',
                    nurse: 'DoctorPatients',
                    lab: 'LabDashboard',
                    pharmacy: 'PharmacyDashboard',
                    reception: 'ReceptionDashboard',
                    receptionist: 'ReceptionDashboard',
                    accountant: 'AccountantDashboard',
                    patient: 'Dashboard',
                    hospitaladmin: 'HospitalAdmin',
                    'clinic doctor': 'HospitalAdmin',
                    clinicdoctor: 'HospitalAdmin',
                    otmanager: 'OTDashboard',
                    otstaff: 'OTDashboard',
                    ot: 'OTDashboard'
                };
                const role = (user.role || '').toLowerCase().replace(/\s+/g, '');
                let targetPath = redirectMap[role] || redirectMap[(user.role || '').toLowerCase()] || searchParams.redirect || 'Dashboard';
                if (role === 'doctor' && user.clinicType === 'clinic') {
                    targetPath = 'HospitalAdmin';
                }
                
                // fallback to RoleDashboard if screen not mapped
                try {
                    navigation.replace(targetPath);
                } catch (e) {
                    navigation.replace('RoleDashboard');
                }
            };
            handleRedirect();
        }
    }, [isAuthenticated, user, navigation, searchParams, tenant]);

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        dispatch(clearError());
        setLocalError(null);
    };

    const handleSubmit = async (creds) => {
        dispatch(clearError());
        setLocalError(null);
        if (!creds.id || !creds.password) return;

        let slug = formData.hospitalSlug || searchParams.slug || searchParams.tenantId || await AsyncStorage.getItem('tenantSlug') || 'cityhospital';
        if (nativeSlug) {
            slug = nativeSlug;
        }

        try {
            await dispatch(sendOtp({
                email: creds.id,
                password: creds.password,
                hospitalSlug: slug,
                loginType: 'staff',
            })).unwrap();
        } catch (err) {
            console.error('[Login] OTP Request Failed:', err);
            const errDetails = typeof err === 'object' && err.message ? err.message : (typeof err === 'string' ? err : 'Invalid credentials or network issue');
            setLocalError(errDetails);
        }
    };

    const handleVerifyOtp = async (otp) => await dispatch(verifyOtp({ preAuthToken, otp }));
    const handleResendOtp = async () => await dispatch(resendOtp({ preAuthToken }));
    const handleBackToLogin = () => dispatch(resetOtpFlow());
    const handleForceLogin = async () => await dispatch(forceLogin({ preAuthToken }));
    const handleCancelSession = () => dispatch(resetOtpFlow());

    return (
        <View style={{ flex: 1 }}>
            <NeuralAuthPortal
                portalType="staff"
                title="Clinical Portal"
                subtitle="Access your high-performance medical workspace."
                idLabel="Email or Practitioner ID"
                idPlaceholder="Enter your email or ID"
                idType="email-address"
                passkeyLabel="Password"
                passkeyPlaceholder="••••••••"
                branding={branding}
                onLoginSubmit={(creds) => {
                    setFormData(prev => ({ ...prev, email: creds.id, password: creds.password }));
                    handleSubmit(creds);
                }}
                onVerifyOtp={handleVerifyOtp}
                onResendOtp={handleResendOtp}
                onAbortOtp={handleBackToLogin}
                onForceLogin={handleForceLogin}
                onCancelSession={handleCancelSession}
                otpStep={otpStep}
                otpEmail={otpEmail}
                activeSession={otpStep === 'session_check' ? activeSession : null}
                loading={loading}
                error={error || localError}
                successMsg={otpSuccessMsg}
            />
            <KbDebugOverlay />
        </View>
    );
};

const KbDebugOverlay = () => {
    const [debugState, setDebugState] = useState({ ...kbDebugState });

    useEffect(() => {
        const unsub = subscribeKbDebug((s) => setDebugState({ ...s }));
        return unsub;
    }, []);

    return (
        <View 
            pointerEvents="none"
            style={debugStyles.overlay}
        >
            <Text style={debugStyles.title}>[KB DEBUG]</Text>
            <Text style={debugStyles.line}>Last Event: <Text style={debugStyles.highlight}>{debugState.lastEvent}</Text></Text>
            <Text style={debugStyles.line}>Last Event Time: <Text style={debugStyles.val}>{debugState.lastEventTime}</Text></Text>
            <Text style={debugStyles.line}>Email Focus Count: <Text style={debugStyles.val}>{debugState.emailFocusCount}</Text></Text>
            <Text style={debugStyles.line}>Email Blur Count: <Text style={debugStyles.val}>{debugState.emailBlurCount}</Text></Text>
            <Text style={debugStyles.line}>Email Component Mount Count: <Text style={debugStyles.val}>{debugState.emailMountCount}</Text></Text>
            <Text style={debugStyles.line}>Email Component Unmount Count: <Text style={debugStyles.val}>{debugState.emailUnmountCount}</Text></Text>
            <Text style={debugStyles.line}>NeuralAuthPortal Mount Count: <Text style={debugStyles.val}>{debugState.neuralMountCount}</Text></Text>
            <Text style={debugStyles.line}>NeuralAuthPortal Unmount Count: <Text style={debugStyles.val}>{debugState.neuralUnmountCount}</Text></Text>
            <Text style={debugStyles.line}>Keyboard Show Count: <Text style={debugStyles.val}>{debugState.keyboardShowCount}</Text></Text>
            <Text style={debugStyles.line}>Keyboard Hide Count: <Text style={debugStyles.val}>{debugState.keyboardHideCount}</Text></Text>
            <Text style={debugStyles.line}>Login Mount Count: <Text style={debugStyles.val}>{debugState.loginMountCount}</Text></Text>
            <Text style={debugStyles.line}>Login Unmount Count: <Text style={debugStyles.val}>{debugState.loginUnmountCount}</Text></Text>
            <Text style={debugStyles.line}>Branding Loading: <Text style={debugStyles.val}>{String(debugState.brandingLoading)}</Text></Text>
            <Text style={debugStyles.line}>AppNavigator Loading: <Text style={debugStyles.val}>{String(debugState.appNavLoading)}</Text></Text>
            <Text style={debugStyles.line}>Current Route: <Text style={debugStyles.val}>{debugState.currentRoute}</Text></Text>
            
            <Text style={[debugStyles.title, { marginTop: 4, borderTopColor: '#334155', borderTopWidth: 0.5, paddingTop: 2 }]}>LAST 10 EVENTS:</Text>
            {debugState.history.slice(0, 10).map((item, idx) => (
                <Text key={idx} style={debugStyles.historyItem}>{item}</Text>
            ))}
        </View>
    );
};

const debugStyles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 28,
        right: 4,
        width: 255,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#38bdf8',
        borderWidth: 1.5,
        borderRadius: 8,
        padding: 6,
        zIndex: 999999,
        elevation: 30,
    },
    title: {
        color: '#38bdf8',
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 2,
        letterSpacing: 0.5,
    },
    line: {
        color: '#cbd5e1',
        fontSize: 9,
        lineHeight: 12,
    },
    val: {
        color: '#fbbf24',
        fontWeight: 'bold',
    },
    highlight: {
        color: '#4ade80',
        fontWeight: 'bold',
    },
    historyItem: {
        color: '#94a3b8',
        fontSize: 8.5,
        fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
        lineHeight: 11,
    },
});

export default Login;
