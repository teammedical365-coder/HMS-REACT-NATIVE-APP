import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image,
    KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, forceLogin, clearError, resetOtpFlow, setCredentials } from '../../store/slices/authSlice';
import { setAuthHeader } from '../../utils/api';
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
    const { width } = useWindowDimensions();
    const isCompact = width < 768;

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

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleSubmit = async () => {
        const { email, password } = formData;
        
        if (!email || !password) {
            setLocalError("Please enter email and password");
            return;
        }
        
        if (!isValidEmail(email)) {
            setLocalError("Please enter a valid email address");
            return;
        }
        
        if (password.length < 6) {
            setLocalError("Password must be at least 6 characters long");
            return;
        }
        
        setLocalError("");
        setLocalLoading(true);

        try {
            const result = await dispatch(sendOtp({ email, password, loginType: 'admin' })).unwrap();

            if (result.preAuthToken) {
                PERSISTED_PRE_AUTH_TOKEN = result.preAuthToken;
                await AsyncStorage.setItem('SAFE_PRE_AUTH_TOKEN', result.preAuthToken);
            }

            if (result.token) {
                await AsyncStorage.setItem('token', result.token);
                await AsyncStorage.setItem('superadmin_token', result.token);
                setAuthHeader(result.token);
                if (result.user) {
                    dispatch(setCredentials({ user: result.user, token: result.token }));
                }
                // Use navigation.reset to properly transition from Auth stack to CentralAdmin stack
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'CentralAdmin' }],
                });
                return;
            }
            setStep(2);
        } catch (err) {
            const errMsg = typeof err === 'object' ? (err.message || JSON.stringify(err)) : err;
            PERSISTED_ERROR = errMsg || "Invalid Credentials";
            setLocalError(PERSISTED_ERROR);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (localLoading) return;

        const cleanOtp = String(otp).replace(/\D/g, '');
        if (!cleanOtp || cleanOtp.length !== 6) {
            return setLocalError('Please enter a valid 6-digit OTP.');
        }

        setLocalError('');
        setLocalLoading(true);

        try {
            // Use dispatch(verifyOtp) to maintain consistency with web flow
            const result = await dispatch(verifyOtp({ preAuthToken, otp: cleanOtp })).unwrap();
            
            if (result.activeSessionExists) {
                setLocalError("OTP Verified! Clearing your old sessions to let you in...");
                try {
                    const forceResult = await dispatch(forceLogin({
                        preAuthToken,
                        email: formData.email,
                        loginType: 'admin'
                    })).unwrap();

                    if (forceResult?.token) {
                        await AsyncStorage.setItem('token', forceResult.token);
                        await AsyncStorage.setItem('superadmin_token', forceResult.token);
                        setAuthHeader(forceResult.token);
                        
                        if (forceResult.user) {
                            dispatch(setCredentials({ user: forceResult.user, token: forceResult.token }));
                        }
                        
                        // Use navigation.reset to properly transition from Auth stack to CentralAdmin stack
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'CentralAdmin' }],
                        });
                        return;
                    }
                } catch (forceErr) {
                    const msg = typeof forceErr === 'object' ? (forceErr.message || JSON.stringify(forceErr)) : forceErr;
                    setLocalError(msg || "Force Login error");
                }
            } else if (result.token) {
                await AsyncStorage.setItem('token', result.token);
                await AsyncStorage.setItem('superadmin_token', result.token);
                setAuthHeader(result.token);
                
                if (result.user) {
                    dispatch(setCredentials({ user: result.user, token: result.token }));
                }
                
                // Use navigation.reset to properly transition from Auth stack to CentralAdmin stack
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'CentralAdmin' }],
                });
            } else {
                setLocalError(result.message || 'Invalid OTP');
            }
        } catch (err) {
            const errMsg = typeof err === 'object' ? (err.message || JSON.stringify(err)) : err;
            setLocalError(errMsg || 'Invalid OTP');
        } finally {
            setLocalLoading(false);
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
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        {/* LEFT COLUMN: Form */}
                        <View style={styles.leftColumn} pointerEvents="box-none">
                            {!showOtpScreen && (
                                <TouchableOpacity
                                    onPress={(e) => {
                                        e?.preventDefault();
                                        if (navigation.canGoBack()) { navigation.goBack(); }
                                    }}
                                    style={styles.backButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.backButtonText}>← Go Back</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.formContainer} pointerEvents="box-none">
                                <Image
                                    source={require('../../assets/medical365-logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />

                                {sessionBanner && (
                                    <View style={styles.sessionBanner} pointerEvents="box-none">
                                        <Text style={styles.sessionBannerText}>⚠️ {sessionBanner}</Text>
                                    </View>
                                )}

                                {!showOtpScreen ? (
                                    <View style={{ width: '100%' }} pointerEvents="box-none">
                                        <Text style={styles.title}>Supreme Portal</Text>
                                        <Text style={styles.subtitle}>Sign in to the system administration dashboard.</Text>

                                        {displayError ? (
                                            <View style={styles.errorBanner} pointerEvents="box-none">
                                                <Text style={styles.errorBannerText}>{displayError}</Text>
                                            </View>
                                        ) : null}

                                        <View style={styles.formGroup} pointerEvents="box-none">
                                            <Text style={styles.label}>Admin Email</Text>
                                            <View style={styles.inputWrapper} pointerEvents="box-none">
                                                <Text style={styles.inputIcon}>✉️</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="admin@medical365.in"
                                                    placeholderTextColor="#94a3b8"
                                                    value={formData.email}
                                                    onChangeText={(t) => handleChange('email', t)}
                                                    keyboardType="email-address"
                                                    autoCapitalize="none"
                                                    editable={!localLoading}
                                                />
                                            </View>
                                        </View>

                                        <View style={styles.formGroup} pointerEvents="box-none">
                                            <Text style={styles.label}>Secret Password</Text>
                                            <View style={styles.inputWrapper} pointerEvents="box-none">
                                                <Text style={styles.inputIcon}>🔒</Text>
                                                <PasswordInput
                                                    placeholder="••••••••"
                                                    value={formData.password}
                                                    onChangeText={(t) => handleChange('password', t)}
                                                    style={styles.passwordInputCustom}
                                                    editable={!localLoading}
                                                />
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            onPress={handleSubmit}
                                            style={[
                                                styles.submitBtn,
                                                { backgroundColor: '#2563eb' },
                                                (loading || localLoading) && styles.submitBtnLoading,
                                            ]}
                                            disabled={loading || localLoading}
                                            activeOpacity={0.8}
                                        >
                                            {localLoading ? (
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            ) : (
                                                <Text style={styles.submitBtnText}>Access system control</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.otpScreenContainer} pointerEvents="box-none">
                                        <Text style={styles.otpTitle}>Security Challenge</Text>
                                        <Text style={styles.otpSubtitle}>
                                            Enter 6-digit OTP sent to {formData.email}
                                        </Text>

                                        {displayError ? (
                                            <View style={styles.errorBanner} pointerEvents="box-none">
                                                <Text style={styles.errorBannerText}>{displayError}</Text>
                                            </View>
                                        ) : null}

                                        <TextInput
                                            style={styles.otpInput}
                                            placeholder="XXXXXX"
                                            value={otp}
                                            onChangeText={setOtp}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            editable={!localLoading}
                                        />

                                        <TouchableOpacity
                                            onPress={handleVerifyOtp}
                                            style={[
                                                styles.verifyBtn,
                                                (loading || localLoading) && styles.submitBtnLoading,
                                            ]}
                                            disabled={loading || localLoading}
                                            activeOpacity={0.8}
                                        >
                                            {localLoading ? (
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            ) : (
                                                <Text style={styles.verifyBtnText}>Verify & Login</Text>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={handleBackToLogin}
                                            style={styles.backToLoginBtn}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.backToLoginText}>Cancel & Return to Login</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={styles.footer} pointerEvents="box-none">
                                <Text style={styles.footerText}>ENTERPRISE INTERNAL CONTROL NODE</Text>
                            </View>
                        </View>

                        {/* RIGHT COLUMN: Visual Branding */}
                        <View
                            style={[styles.rightColumn, isCompact && { display: 'none' }]}
                            pointerEvents="none"
                        >
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
    safeArea: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    card: {
        width: '100%',
        maxWidth: 1000,
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        overflow: 'hidden',
        minHeight: 600,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    leftColumn: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    rightColumn: {
        flex: 0.85,
        backgroundColor: '#020617',
        padding: 48,
        justifyContent: 'center',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.8)',
    },
    rightContent: {
        zIndex: 10,
        maxWidth: 384,
        alignSelf: 'center',
    },
    badge: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 12,
        marginBottom: 24,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
    },
    badgeText: {
        color: '#a5b4fc',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    rightTitle: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 24,
        lineHeight: 40,
    },
    rightSubtitle: {
        color: '#94a3b8',
        fontSize: 18,
        lineHeight: 28,
    },
    backButton: {
        marginBottom: 32,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '500',
    },
    formContainer: {
        marginBottom: 24,
    },
    logo: {
        height: 40,
        width: 150,
        marginBottom: 32,
    },
    sessionBanner: {
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
    },
    sessionBannerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#92400e',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    subtitle: {
        color: '#64748b',
        marginTop: 8,
        marginBottom: 24,
        fontSize: 16,
    },
    errorBanner: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        borderWidth: 1,
    },
    errorBannerText: {
        color: '#dc2626',
        fontSize: 14,
        fontWeight: '500',
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    inputIcon: {
        position: 'absolute',
        left: 12,
        zIndex: 10,
        fontSize: 18,
    },
    input: {
        flex: 1,
        paddingLeft: 40,
        paddingRight: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        fontSize: 16,
        color: '#1e293b',
    },
    passwordInputCustom: {
        flex: 1,
        paddingLeft: 40,
        paddingRight: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        fontSize: 16,
        color: '#1e293b',
    },
    submitBtn: {
        width: '100%',
        marginTop: 16,
        backgroundColor: '#0f172a',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    submitBtnText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    submitBtnLoading: {
        opacity: 0.8,
    },
    footer: {
        marginTop: 'auto',
        paddingTop: 32,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 10,
        letterSpacing: 1.5,
        color: '#94a3b8',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    otpScreenContainer: {
        width: '100%',
    },
    otpTitle: {
        marginBottom: 10,
        fontWeight: '700',
        color: '#1e293b',
        fontSize: 18,
    },
    otpSubtitle: {
        marginBottom: 20,
        color: '#64748b',
        fontSize: 14,
        lineHeight: 20,
    },
    otpInput: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        fontSize: 18,
        letterSpacing: 5,
        textAlign: 'center',
        fontWeight: '700',
        color: '#1e293b',
    },
    verifyBtn: {
        backgroundColor: '#10b981',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    verifyBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    backToLoginBtn: {
        marginTop: 20,
        paddingVertical: 10,
        alignItems: 'center',
    },
    backToLoginText: {
        color: '#2563eb',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default CentralAdminLogin;