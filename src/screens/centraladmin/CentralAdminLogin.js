import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, Dimensions, Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { sendOtp, verifyOtp, resendOtp, forceLogin, clearError, resetOtpFlow } from '../../store/slices/authSlice';
import PasswordInput from '../../components/PasswordInput';
import OtpVerification from '../../components/OtpVerification';
import ActiveSessionModal from '../../components/ActiveSessionModal';
import { SafeAreaView } from 'react-native-safe-area-context';

const CentralAdminLogin = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { loading, error, isAuthenticated, user, otpStep, preAuthToken, otpEmail, activeSession, otpSuccessMsg } = useAuth();

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [sessionBanner, setSessionBanner] = useState(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState('');

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
        dispatch(resetOtpFlow());
    }, [dispatch]);

    useEffect(() => {
        if (isAuthenticated && user) {
            const role = user.role?.toLowerCase();
            if (role === 'centraladmin' || role === 'superadmin') {
                //navigation.navigate('CentralAdmin');
            }
        }
    }, [isAuthenticated, user, navigation]);

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        dispatch(clearError());
    };

    const handleSubmit = async () => {
        dispatch(clearError());
        setLocalError('');
        if (!formData.email || !formData.password) return;
        setSessionBanner(null);

        try {
            setLocalLoading(true);
            const result = await dispatch(sendOtp({
                email: formData.email,
                password: formData.password,
                loginType: 'admin',
            })).unwrap();

            if (result.otpBypassed && !result.activeSessionExists && result.token) {
                await AsyncStorage.setItem('superadmin_token', result.token);
                //navigation.navigate('CentralAdmin');
            }
        } catch (err) {
            const errMsg = typeof err === 'object' ? (err.message || JSON.stringify(err)) : err;
            setLocalError(errMsg || 'Invalid Credentials');
        } finally {
            setLocalLoading(false);
        }
    };

    const handleVerifyOtp = async (otp) => {
        await dispatch(verifyOtp({ preAuthToken, otp }));
    };

    const handleResendOtp = async () => {
        await dispatch(resendOtp({ preAuthToken }));
    };

    const handleBackToLogin = () => {
        dispatch(resetOtpFlow());
    };

    const handleForceLogin = async () => {
        await dispatch(forceLogin({ preAuthToken }));
    };

    const handleCancelSession = () => {
        dispatch(resetOtpFlow());
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.card}>

                        <View style={styles.leftColumn}>
                            {!otpStep && (
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                    <Text style={styles.backButtonText}>← Go Back</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.formContainer}>
                                <Image
                                    source={require('../../assets/medical365-logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />

                                {sessionBanner && (
                                    <View style={styles.sessionBanner}>
                                        <Text style={styles.sessionBannerText}>⚠️ {sessionBanner}</Text>
                                    </View>
                                )}

                                {!otpStep && (
                                    <View>
                                        <Text style={styles.title}>Supreme Portal</Text>
                                        <Text style={styles.subtitle}>Sign in to the system administration dashboard.</Text>

                                        {(error || localError) ? (
                                            <View style={styles.errorBanner}>
                                                <Text style={styles.errorBannerText}>{error || localError}</Text>
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
                                            style={styles.submitBtn}
                                            onPress={handleSubmit}
                                            disabled={loading || localLoading}
                                        >
                                            <Text style={styles.submitBtnText}>
                                                {loading || localLoading ? 'Authenticating...' : 'Access System Control →'}
                                            </Text>
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
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>ENTERPRISE INTERNAL CONTROL NODE</Text>
                            </View>
                        </View>

                        {/* Right Column (Hidden on small screens, approximated for tablet/desktop layout on RN if needed) */}
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

            {otpStep === 'session_check' && activeSession && (
                <ActiveSessionModal
                    activeSession={activeSession}
                    onForceLogin={handleForceLogin}
                    onCancel={handleCancelSession}
                    loading={loading}
                />
            )}
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
        padding: 16,
    },
    card: {
        width: '100%',
        maxWidth: 1000,
        backgroundColor: 'white',
        borderRadius: 24,
        overflow: 'hidden',
        flexDirection: 'row',
        minHeight: 600,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        borderColor: '#e2e8f0',
        borderWidth: 1,
    },
    leftColumn: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    rightColumn: {
        flex: 1,
        backgroundColor: '#020617',
        padding: 48,
        justifyContent: 'center',
        display: Dimensions.get('window').width < 768 ? 'none' : 'flex',
    },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
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
        color: 'white',
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
        backgroundColor: 'white',
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
        backgroundColor: 'white',
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
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
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
});

export default CentralAdminLogin;
