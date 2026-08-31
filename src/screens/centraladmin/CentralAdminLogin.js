import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import PasswordInput from '../../components/PasswordInput';
import { SafeAreaView } from 'react-native-safe-area-context';

let PERSISTED_EMAIL = '';
let PERSISTED_PASSWORD = '';
let PERSISTED_ERROR = '';
let PERSISTED_PRE_AUTH_TOKEN = '';

const CentralAdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();

    const { loading, error, isAuthenticated, user, preAuthToken } = useAuth();

    const [formData, setFormData] = useState({ email: PERSISTED_EMAIL, password: PERSISTED_PASSWORD });
    const [sessionBanner, setSessionBanner] = useState(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState(PERSISTED_ERROR);
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');

    useEffect(() => {
        const checkSession = async () => {
            const msg = await AsyncStorage.getItem('sessionExpiredMessage');
            if (msg) {
                setSessionBanner(msg);
                await AsyncStorage.removeItem('sessionExpiredMessage');
            }
        };
        checkSession();
    }, []);

    useEffect(() => {
        dispatch(clearError());
    }, [dispatch]);

    const handleChange = (name, value) => {
        if (name === 'email') PERSISTED_EMAIL = value;
        if (name === 'password') PERSISTED_PASSWORD = value;
        setFormData(prev => ({ ...prev, [name]: value }));
        dispatch(clearError());
        PERSISTED_ERROR = '';
        setLocalError('');
    };

    const getSafeErrorText = () => {
        if (localError) return String(localError);
        if (error) {
            if (typeof error === 'string') return error;
            if (error.message) return String(error.message);
            return 'An unknown error occurred.';
        }
        return '';
    };
    const displayError = getSafeErrorText();

    const handleSubmit = async () => {
        const { email, password } = formData;
        if (!email || !password) {
            setLocalError("Please enter email and password");
            return;
        }
        setLocalError("");
        setLocalLoading(true);

        try {
            const result = await dispatch(sendOtp({ email, password, loginType: 'admin' })).unwrap();

            if (result.preAuthToken) {
                PERSISTED_PRE_AUTH_TOKEN = result.preAuthToken;
                // 🔥 FIX 1: Physical lock taaki token hawa mein na ude
                await AsyncStorage.setItem('SAFE_PRE_AUTH_TOKEN', result.preAuthToken);
            }

            if (result.otpBypassed && result.token) {
                await AsyncStorage.setItem('superadmin_token', result.token);
                await AsyncStorage.setItem('token', result.token);
                return;
            }
            setStep(2);
        } catch (err) {
            const errMsg = typeof err === 'object' ? (err.message || JSON.stringify(err)) : err;
            PERSISTED_ERROR = errMsg || "Failed to send OTP";
            setLocalError(PERSISTED_ERROR);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (localLoading || window._isVerifyingOtp) return;

        const cleanOtp = String(otp).replace(/\D/g, '');
        if (!cleanOtp || cleanOtp.length !== 6) {
            return setLocalError('Please enter a valid 6-digit OTP.');
        }

        window._isVerifyingOtp = true;
        setLocalError('');
        setLocalLoading(true);

        try {
            let freshToken = PERSISTED_PRE_AUTH_TOKEN || await AsyncStorage.getItem('SAFE_PRE_AUTH_TOKEN') || preAuthToken;

            if (!freshToken || freshToken === 'undefined') {
                setLocalError("Token lost. Please click 'Cancel' and login again.");
                return;
            }

            const response = await fetch('http://localhost:3000/api/auth/otp/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshToken}`
                },
                body: JSON.stringify({
                    preAuthToken: freshToken,
                    otp: cleanOtp
                })
            });

            const data = await response.json();

            if (response.ok && data.success !== false) {

                // 🔥 THE FINAL BOSS: Active Session Limit Reached
                if (data.activeSessionExists) {
                    setLocalError("OTP Verified! Clearing your old sessions to let you in...");

                    try {
                        // Imported forceLogin thunk ko dispatch karke purane sessions uda do
                        const forceResult = await dispatch(forceLogin({
                            preAuthToken: freshToken,
                            email: formData.email,
                            loginType: 'admin'
                        })).unwrap();

                        if (forceResult?.token) {
                            await AsyncStorage.setItem('token', forceResult.token);
                            await AsyncStorage.setItem('superadmin_token', forceResult.token);
                            await AsyncStorage.removeItem('SAFE_PRE_AUTH_TOKEN');
                            navigation.replace('CentralAdminDashboard');
                            return;
                        }
                    } catch (forceErr) {
                        const msg = typeof forceErr === 'object' ? JSON.stringify(forceErr) : forceErr;
                        return setLocalError("Force Login error: " + msg);
                    }
                }

                // Normal Flow (Agar future mein session limit cross na ho)
                const finalToken = data.token || data.accessToken || data.data?.token || data.data?.accessToken;

                if (finalToken) {
                    await AsyncStorage.setItem('token', finalToken);
                    await AsyncStorage.setItem('superadmin_token', finalToken);
                    await AsyncStorage.removeItem('SAFE_PRE_AUTH_TOKEN');
                    navigation.replace('CentralAdminDashboard');
                } else {
                    setLocalError("Login Success but token missing: " + JSON.stringify(data));
                }
            } else {
                setLocalError(data.message || data.error || 'Invalid OTP');
            }
        } catch (err) {
            setLocalError('Network error during verification.');
        } finally {
            setLocalLoading(false);
            window._isVerifyingOtp = false;
        }
    };

    const handleBackToLogin = () => {
        setStep(1);
        dispatch(resetOtpFlow());
    };

    const showOtpScreen = step === 2 || !!preAuthToken;

    if (isAuthenticated) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={{ marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>
                    Authenticating & Redirecting...
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.card}>
                        <View style={styles.leftColumn}>
                            {!showOtpScreen && (
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e?.preventDefault();
                                        if (navigation.canGoBack()) { navigation.goBack(); }
                                    }}
                                    style={styles.backButton}>
                                    <Text style={styles.backButtonText}>← Go Back</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.formContainer}>
                                <Image source={require('../../assets/medical365-logo.png')} style={styles.logo} resizeMode="contain" />

                                {sessionBanner && (
                                    <View style={styles.sessionBanner}>
                                        <Text style={styles.sessionBannerText}>⚠️ {sessionBanner}</Text>
                                    </View>
                                )}

                                {!showOtpScreen ? (
                                    <View style={{ width: '100%' }}>
                                        <Text style={styles.title}>Supreme Portal</Text>
                                        <Text style={styles.subtitle}>Sign in to the system administration dashboard.</Text>

                                        {displayError ? (
                                            <View style={styles.errorBanner}>
                                                <Text style={styles.errorBannerText}>{displayError}</Text>
                                            </View>
                                        ) : null}

                                        <View style={styles.formGroup}>
                                            <Text style={styles.label}>Admin Email</Text>
                                            <View style={styles.inputWrapper}>
                                                <Text style={styles.inputIcon}>✉️</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="admin@medical365.in"
                                                    placeholderTextColor="#94a3b8"
                                                    value={formData.email}
                                                    onChangeText={(t) => handleChange('email', t)}
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.label}>Secret Password</Text>
                                            <View style={styles.inputWrapper}>
                                                <Text style={styles.inputIcon}>🔒</Text>
                                                <PasswordInput
                                                    placeholder="••••••••"
                                                    value={formData.password}
                                                    onChangeText={(t) => handleChange('password', t)}
                                                    style={styles.passwordInputCustom}
                                                />
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            onPress={(e) => { e?.preventDefault(); handleSubmit(); }}
                                            style={[styles.submitBtn, { backgroundColor: '#2563eb', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 }]}
                                            disabled={loading || localLoading}
                                        >
                                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                                {loading || localLoading ? 'Authenticating...' : 'Access system control'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={{ width: '100%' }}>
                                        <Text style={{ marginBottom: 10, fontWeight: 'bold', color: '#333', fontSize: 18 }}>Security Challenge</Text>
                                        <Text style={{ marginBottom: 20, color: '#64748b' }}>Enter 6-digit OTP sent to {formData.email}</Text>

                                        {displayError ? (
                                            <View style={styles.errorBanner}>
                                                <Text style={styles.errorBannerText}>{displayError}</Text>
                                            </View>
                                        ) : null}

                                        <TextInput
                                            style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 15, fontSize: 18, letterSpacing: 5, textAlign: 'center' }}
                                            placeholder="XXXXXX"
                                            value={otp}
                                            onChangeText={setOtp}
                                            keyboardType="number-pad"
                                        />
                                        <TouchableOpacity
                                            onPress={(e) => { e?.preventDefault(); handleVerifyOtp(); }}
                                            style={{ backgroundColor: '#10b981', padding: 15, borderRadius: 8, alignItems: 'center' }}
                                            disabled={loading || localLoading}
                                        >
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                                {loading || localLoading ? 'Verifying...' : 'Verify & Login'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={handleBackToLogin} style={{ marginTop: 20, alignItems: 'center' }}>
                                            <Text style={{ color: '#2563eb', fontWeight: '600' }}>Cancel & Return to Login</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>ENTERPRISE INTERNAL CONTROL NODE</Text>
                            </View>
                        </View>

                        <View style={styles.rightColumn}>
                            <View style={styles.overlay} />
                            <View style={styles.rightContent}>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>System Core</Text>
                                </View>
                                <Text style={styles.rightTitle}>Global Oversight.</Text>
                                <Text style={styles.rightSubtitle}>
                                    Manage all clinical instances, audit logs, and provider performance from the unified central command.
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
    card: { width: '100%', maxWidth: 1000, backgroundColor: 'white', borderRadius: 24, overflow: 'hidden', flexDirection: 'row', minHeight: 600, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, borderColor: '#e2e8f0', borderWidth: 1 },
    leftColumn: { flex: 1, padding: 32, justifyContent: 'center', backgroundColor: 'white' },
    rightColumn: { flex: 1, backgroundColor: '#020617', padding: 48, justifyContent: 'center', display: Dimensions.get('window').width < 768 ? 'none' : 'flex' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.8)' },
    rightContent: { zIndex: 10, maxWidth: 384, alignSelf: 'center' },
    badge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 12, marginBottom: 24, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.2)', borderColor: 'rgba(99, 102, 241, 0.3)', borderWidth: 1 },
    badgeText: { color: '#a5b4fc', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
    rightTitle: { fontSize: 36, fontWeight: 'bold', color: 'white', marginBottom: 24, lineHeight: 40 },
    rightSubtitle: { color: '#94a3b8', fontSize: 18, lineHeight: 28 },
    backButton: { marginBottom: 32, alignSelf: 'flex-start' },
    backButtonText: { color: '#64748b', fontSize: 16, fontWeight: '500' },
    formContainer: { marginBottom: 24 },
    logo: { height: 40, width: 150, marginBottom: 32 },
    sessionBanner: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 20 },
    sessionBannerText: { fontSize: 14, fontWeight: '600', color: '#92400e' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { color: '#64748b', marginTop: 8, marginBottom: 24, fontSize: 16 },
    errorBanner: { marginBottom: 16, padding: 12, borderRadius: 8, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1 },
    errorBannerText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
    formGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 4 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
    inputIcon: { position: 'absolute', left: 12, zIndex: 10, fontSize: 18 },
    input: { flex: 1, paddingLeft: 40, paddingRight: 16, paddingVertical: 12, borderRadius: 12, borderColor: '#e2e8f0', borderWidth: 1, backgroundColor: 'white', fontSize: 16, color: '#1e293b' },
    passwordInputCustom: { flex: 1, paddingLeft: 40, paddingRight: 16, paddingVertical: 12, borderRadius: 12, borderColor: '#e2e8f0', borderWidth: 1, backgroundColor: 'white', fontSize: 16, color: '#1e293b' },
    submitBtn: { width: '100%', marginTop: 16, backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    footer: { marginTop: 'auto', paddingTop: 32, alignItems: 'center' },
    footerText: { fontSize: 10, letterSpacing: 1.5, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
});

export default CentralAdminLogin;