import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseURL } from '../../utils/api';
import { useBranding } from '../../context/BrandingContext';

import PasswordInput from '../../components/PasswordInput';
import OtpVerification from '../../components/OtpVerification';
import ActiveSessionModal from '../../components/ActiveSessionModal';

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

    const handleSubmit = async () => {
        dispatch(clearError());
        setLocalError(null);
        if (!formData.email || !formData.password) return;

        let slug = formData.hospitalSlug || searchParams.slug || searchParams.tenantId || await AsyncStorage.getItem('tenantSlug') || 'cityhospital';
        if (nativeSlug) {
            slug = nativeSlug;
        }

        try {
            await dispatch(sendOtp({
                email: formData.email,
                password: formData.password,
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
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.card}>
                        <View style={styles.logoContainer}>
                            <Image 
                                source={branding?.logoUrl ? { uri: branding.logoUrl } : require('../../assets/medical365-logo.png')} 
                                style={styles.logo} 
                                resizeMode="contain" 
                                defaultSource={null}
                            />
                        </View>

                        <View style={styles.header}>
                            <Text style={styles.title}>Sign In</Text>
                            <Text style={styles.subtitle}>Enter your credentials to access your account.</Text>
                        </View>

                        {!otpStep && (
                            <View style={styles.formContainer}>
                                {(error || localError) ? (
                                    <View style={styles.errorBox}>
                                        <Text style={styles.errorText}>{error || localError}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Workspace ID / Clinic URL</Text>
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputIcon}>🏢</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.hospitalSlug}
                                            onChangeText={(v) => handleChange('hospitalSlug', v)}
                                            placeholder="Enter workspace ID (e.g., cityhospital)"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Email Address</Text>
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputIcon}>âœ‰ï¸</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={formData.email}
                                            onChangeText={(v) => handleChange('email', v)}
                                            placeholder="Enter your email"
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Password</Text>
                                    <View style={styles.inputWrapper}>
                                        <Text style={styles.inputIcon}>ðŸ”’</Text>
                                        <View style={{ flex: 1 }}>
                                            <PasswordInput
                                                value={formData.password}
                                                onChangeText={(v) => handleChange('password', v)}
                                                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                                            />
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    style={styles.submitBtn} 
                                    onPress={handleSubmit} 
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Sign In</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        {otpStep === 'otp' && (
                            <OtpVerification
                                email={otpEmail}
                                onVerify={handleVerifyOtp}
                                onResend={handleResendOtp}
                                onBack={handleBackToLogin}
                                loading={loading}
                                error={error}
                                successMsg={otpSuccessMsg}
                            />
                        )}

                        {otpStep === 'session_check' && activeSession && (
                            <ActiveSessionModal
                                activeSession={activeSession}
                                onForceLogin={handleForceLogin}
                                onCancel={handleCancelSession}
                                loading={loading}
                                visible={true}
                            />
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 16 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
    logoContainer: { alignItems: 'center', marginBottom: 24 },
    logo: { width: 220, height: 80 },
    header: { alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center' },
    formContainer: { gap: 16 },
    errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, padding: 12, borderRadius: 8 },
    errorText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
    inputGroup: { gap: 4 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12 },
    inputIcon: { fontSize: 18, color: '#94a3b8', marginRight: 8 },
    input: { flex: 1, paddingVertical: 12, fontSize: 15, color: '#1e293b' },
    submitBtn: { backgroundColor: '#0d9488', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default Login;
