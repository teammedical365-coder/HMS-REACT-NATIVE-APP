import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../../utils/api';
import { useBranding } from '../../context/BrandingContext';
import { HARDCODED_TENANT } from '../../tenant';

import NeuralAuthPortal from '../../components/auth/NeuralAuthPortal';

// Synchronously resolve build-configured tenant
const BUILD_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG || HARDCODED_TENANT?.slug || null;
const IS_FIXED_WHITE_LABEL_BUILD = Boolean(
    BUILD_TENANT_SLUG && BUILD_TENANT_SLUG !== 'medical365'
);

const Login = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { branding } = useBranding();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg, tenant } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '', hospitalSlug: '' });
    const [localError, setLocalError] = useState(null);
    const searchParams = route.params || {};

    useEffect(() => {
        dispatch(clearError());
        dispatch(resetOtpFlow());

        // For white-label APK, ensure authoritative slug is recorded in storage
        if (BUILD_TENANT_SLUG) {
            AsyncStorage.setItem('tenantSlug', BUILD_TENANT_SLUG).catch(() => {});
        }
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

        let slug;
        if (IS_FIXED_WHITE_LABEL_BUILD) {
            // For a hospital-specific white-label APK, the build tenant is strictly authoritative.
            // Stale AsyncStorage, deep-link query params, or form fields cannot redirect to another hospital.
            slug = BUILD_TENANT_SLUG;
        } else {
            // Dynamic multi-tenant workflow: resolve from form input, route params, or stored session
            const storedSlug = await AsyncStorage.getItem('tenantSlug').catch(() => null);
            slug = formData.hospitalSlug || searchParams.slug || searchParams.tenantId || storedSlug || undefined;
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
        </View>
    );
};

export default Login;
