import React, { useState, useEffect, useRef } from 'react';
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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

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
    
    // OTP State (6 inputs)
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const otpInputRefs = useRef([]);
    const [resendTimer, setResendTimer] = useState(20);
    const [focusedOtpIndex, setFocusedOtpIndex] = useState(null);

    const [rememberMe, setRememberMe] = useState(true);
    const { width } = useWindowDimensions();
    
    const isDesktop = width >= 1024;

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

    // Resend Timer logic
    useEffect(() => {
        let interval = null;
        if (step === 2 && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer(t => t - 1);
            }, 1000);
        } else if (resendTimer === 0) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [step, resendTimer]);

    const handleChange = (name, value) => {
        if (name === 'email') PERSISTED_EMAIL = value;
        if (name === 'password') PERSISTED_PASSWORD = value;
        setFormData(prev => ({ ...prev, [name]: value }));
        dispatch(clearError());
        PERSISTED_ERROR = '';
        setLocalError('');
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) {
            // Handle pasting
            const pasteChars = value.split('').slice(0, 6);
            const newOtp = [...otpValues];
            pasteChars.forEach((char, i) => {
                if (index + i < 6) newOtp[index + i] = char;
            });
            setOtpValues(newOtp);
            // Focus last filled or next empty
            const nextIndex = Math.min(index + pasteChars.length, 5);
            otpInputRefs.current[nextIndex]?.focus();
            return;
        }

        const newOtp = [...otpValues];
        newOtp[index] = value;
        setOtpValues(newOtp);
        setLocalError('');

        if (value !== '' && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyPress = (index, e) => {
        if (e.nativeEvent.key === 'Backspace' && otpValues[index] === '' && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
            const newOtp = [...otpValues];
            newOtp[index - 1] = '';
            setOtpValues(newOtp);
        }
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
                navigation.reset({ index: 0, routes: [{ name: 'CentralAdminDashboard' }] });
                return;
            }
            setStep(2);
            setResendTimer(20);
        } catch (err) {
            console.log('[Login Error]', err);
            let errMsg = 'Invalid Credentials';
            if (err) {
                if (typeof err === 'string') {
                    errMsg = err;
                } else if (err.message) {
                    errMsg = err.message;
                } else if (typeof err === 'object') {
                    errMsg = JSON.stringify(err);
                }
            }
            if (errMsg.includes('401') || errMsg.toLowerCase().includes('unauthorized')) {
                errMsg = 'Invalid email or password. Please try again.';
            }
            PERSISTED_ERROR = errMsg;
            setLocalError(PERSISTED_ERROR);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (localLoading) return;

        const cleanOtp = otpValues.join('').replace(/\D/g, '');
        if (!cleanOtp || cleanOtp.length !== 6) {
            return setLocalError('Please enter a valid 6-digit OTP.');
        }

        setLocalError('');
        setLocalLoading(true);

        try {
            const result = await dispatch(verifyOtp({ preAuthToken, otp: cleanOtp })).unwrap();
            
            if (result.activeSessionExists) {
                setLocalError("OTP Verified! Clearing your old sessions to let you in...");
                try {
                    const forceResult = await dispatch(forceLogin({
                        preAuthToken, email: formData.email, loginType: 'admin'
                    })).unwrap();

                    if (forceResult?.token) {
                        await AsyncStorage.setItem('token', forceResult.token);
                        await AsyncStorage.setItem('superadmin_token', forceResult.token);
                        setAuthHeader(forceResult.token);
                        if (forceResult.user) {
                            dispatch(setCredentials({ user: forceResult.user, token: forceResult.token }));
                        }
                        navigation.reset({ index: 0, routes: [{ name: 'CentralAdminDashboard' }] });
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
                navigation.reset({ index: 0, routes: [{ name: 'CentralAdminDashboard' }] });
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

    const handleResendOtp = async () => {
        setLocalError('');
        setLocalLoading(true);
        try {
            await dispatch(sendOtp({ email: formData.email, password: formData.password, loginType: 'admin' })).unwrap();
            setResendTimer(20);
        } catch (err) {
            setLocalError('Failed to resend OTP.');
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
                <ActivityIndicator size="large" color="#0284c7" />
                <Text style={{ marginTop: 20, fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>
                    Authenticating & Redirecting...
                </Text>
            </SafeAreaView>
        );
    }

    const censorEmail = (email) => {
        if (!email) return 'your email';
        const [name, domain] = email.split('@');
        if (!domain) return email;
        const censoredName = name.length > 2 ? name.substring(0, 2) + '***' : name + '***';
        return `${censoredName}@${domain}`;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.layout}>
                    
                    {/* LEFT COLUMN: Visual & Branding */}
                    {isDesktop && (
                        <View style={styles.leftColumn}>
                            <View style={styles.dotGridOverlay} />
                            <View style={styles.leftContent}>
                                {/* Top Logo */}
                                <View style={styles.brandRow}>
                                    <Image
                                        source={require('../../assets/medical365-logo.png')}
                                        style={styles.logo}
                                        resizeMode="contain"
                                    />
                                    <MaterialCommunityIcons name="flower-tulip-outline" size={26} color="#0284c7" style={{marginLeft: 8}} />
                                </View>

                                {/* Hero Text */}
                                <Text style={styles.heroLine1}>Smarter Healthcare</Text>
                                <Text style={styles.heroLine2}>Better Tomorrow</Text>
                                <Text style={styles.heroSubtitle}>
                                    Medical365 is your all-in-one healthcare management platform designed to streamline clinical workflows, empower professionals, and deliver better patient outcomes globally.
                                </Text>

                                {/* Stacked Feature Cards */}
                                <View style={styles.featuresStack}>
                                    <View style={styles.featureCard}>
                                        <View style={styles.featureIconWrap}>
                                            <Ionicons name="shield-checkmark" size={16} color="#0d9488" />
                                        </View>
                                        <Text style={styles.featureText}>Secure & Compliant</Text>
                                    </View>
                                    <View style={styles.featureCard}>
                                        <View style={styles.featureIconWrap}>
                                            <Ionicons name="people" size={16} color="#0d9488" />
                                        </View>
                                        <Text style={styles.featureText}>Smart Management</Text>
                                    </View>
                                    <View style={styles.featureCard}>
                                        <View style={styles.featureIconWrap}>
                                            <Ionicons name="stats-chart" size={16} color="#0d9488" />
                                        </View>
                                        <Text style={styles.featureText}>Better Insights</Text>
                                    </View>
                                </View>

                                {/* Center Glow Graphic */}
                                <View style={styles.glowGraphicContainer}>
                                    <View style={styles.glowCircle} />
                                    <MaterialCommunityIcons name="medical-bag" size={90} color="#0ea5e9" style={{zIndex: 2, opacity: 0.8}} />
                                </View>
                            </View>

                            {/* Bottom Pulse & Trust Badge */}
                            <View style={styles.bottomGraphic}>
                                <View style={styles.pulseContainer}>
                                    <Svg width="100%" height="40" viewBox="0 0 400 40">
                                        <Path
                                            d="M0 20 L50 20 L65 5 L80 35 L95 20 L150 20 L165 5 L180 35 L195 20 L250 20 L265 5 L280 35 L295 20 L350 20 L365 5 L380 35 L395 20 L400 20"
                                            stroke="#14b8a6"
                                            strokeWidth="2"
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            opacity="0.3"
                                        />
                                    </Svg>
                                </View>
                                <View style={styles.trustBadge}>
                                    <Feather name="check-circle" size={14} color="#14b8a6" style={{marginRight: 6}} />
                                    <Text style={styles.trustBadgeText}>Trusted by 1000+ Healthcare Professionals</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* RIGHT COLUMN: Form Card */}
                    <ScrollView 
                        contentContainerStyle={[styles.rightColumnScroll, !isDesktop && styles.mobileCenterForm]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {!isDesktop && (
                            <View style={{alignItems: 'center', marginBottom: 20}}>
                                <Image
                                    source={require('../../assets/medical365-logo.png')}
                                    style={styles.logoMobile}
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                        <View style={styles.formCard}>
                            {!showOtpScreen && (
                                <TouchableOpacity
                                    onPress={() => navigation.canGoBack() && navigation.goBack()}
                                    style={styles.backButton}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="arrow-left" size={14} color="#64748b" style={{marginRight: 4}} />
                                    <Text style={styles.backButtonText}>Go Back</Text>
                                </TouchableOpacity>
                            )}

                            {sessionBanner && (
                                <View style={styles.sessionBanner}>
                                    <Ionicons name="warning-outline" size={18} color="#92400e" style={{marginRight: 6}} />
                                    <Text style={styles.sessionBannerText}>{sessionBanner}</Text>
                                </View>
                            )}

                            {!showOtpScreen ? (
                                <View>
                                    <Text style={styles.formTitle}>Supreme Portal</Text>
                                    <Text style={styles.formSubtitle}>Access Medical365 central system administration core.</Text>

                                    {displayError ? (
                                        <View style={styles.errorBanner}>
                                            <Text style={styles.errorBannerText}>{displayError}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>ADMINISTRATOR EMAIL</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="user" size={16} color="#64748b" style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Enter admin email or ID"
                                                placeholderTextColor="#94a3b8"
                                                value={formData.email}
                                                onChangeText={(t) => handleChange('email', t)}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                                editable={!localLoading}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>PASSWORD</Text>
                                        <View style={styles.inputWrapper}>
                                            <Feather name="lock" size={16} color="#64748b" style={styles.inputIcon} />
                                            <PasswordInput
                                                placeholder="•••••••••"
                                                value={formData.password}
                                                onChangeText={(t) => handleChange('password', t)}
                                                style={styles.passwordInputCustom}
                                                editable={!localLoading}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.formOptions}>
                                        <TouchableOpacity 
                                            style={styles.checkboxRow} 
                                            activeOpacity={0.7}
                                            onPress={() => setRememberMe(!rememberMe)}
                                        >
                                            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                                                {rememberMe && <Feather name="check" size={12} color="#fff" />}
                                            </View>
                                            <Text style={styles.checkboxLabel}>Remember me</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity activeOpacity={0.7}>
                                            <Text style={styles.forgotLink}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity
                                        onPress={handleSubmit}
                                        style={[styles.submitBtn, (loading || localLoading) && styles.submitBtnLoading]}
                                        disabled={loading || localLoading}
                                        activeOpacity={0.8}
                                    >
                                        {localLoading ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                <Text style={styles.submitBtnText}>Sign In </Text>
                                                <Feather name="arrow-right" size={16} color="#ffffff" style={{marginLeft: 6}} />
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.securityBox}>
                                        <Ionicons name="shield-checkmark-outline" size={20} color="#0d9488" style={{marginRight: 12}} />
                                        <Text style={styles.securityBoxText}>
                                            Your security is our priority. All data is encrypted and securely protected.
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.otpScreenContainer}>
                                    <View style={styles.otpShieldWrap}>
                                        <Ionicons name="shield-checkmark-sharp" size={40} color="#10b981" />
                                    </View>
                                    <Text style={styles.otpTitle}>Two-Factor Authentication</Text>
                                    <View style={styles.otpBadge}>
                                        <Text style={styles.otpBadgeText}>Code sent to {censorEmail(formData.email)}</Text>
                                    </View>

                                    {displayError ? (
                                        <View style={styles.errorBanner}>
                                            <Text style={styles.errorBannerText}>{displayError}</Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.otpInputsContainer}>
                                        {otpValues.map((val, index) => (
                                            <TextInput
                                                key={index}
                                                ref={el => otpInputRefs.current[index] = el}
                                                style={[
                                                    styles.otpBox, 
                                                    val && styles.otpBoxFilled,
                                                    focusedOtpIndex === index && styles.otpBoxFocused
                                                ]}
                                                keyboardType="number-pad"
                                                maxLength={1}
                                                value={val}
                                                onChangeText={(t) => handleOtpChange(index, t)}
                                                onKeyPress={(e) => handleOtpKeyPress(index, e)}
                                                onFocus={() => setFocusedOtpIndex(index)}
                                                onBlur={() => setFocusedOtpIndex(null)}
                                                editable={!localLoading}
                                            />
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        onPress={handleVerifyOtp}
                                        style={[styles.submitBtn, {backgroundColor: '#0d9488'}, (loading || localLoading || otpValues.join('').length !== 6) && styles.submitBtnLoading]}
                                        disabled={loading || localLoading || otpValues.join('').length !== 6}
                                        activeOpacity={0.8}
                                    >
                                        {localLoading ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                                <Text style={styles.submitBtnText}>Verify & Continue </Text>
                                                <Feather name="arrow-right" size={16} color="#ffffff" style={{marginLeft: 6}} />
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.resendContainer}>
                                        <Text style={styles.resendText}>Didn't receive code? </Text>
                                        {resendTimer > 0 ? (
                                            <Text style={styles.resendTimerText}>Resend in {resendTimer}s</Text>
                                        ) : (
                                            <TouchableOpacity onPress={handleResendOtp} disabled={localLoading}>
                                                <Text style={styles.resendLink}>Resend Code</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLoginBtn}>
                                        <Feather name="arrow-left" size={14} color="#0284c7" style={{marginRight: 4}} />
                                        <Text style={styles.backToLoginText}>Back to Login</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        
                        {!isDesktop && (
                            <View style={styles.mobileFooter}>
                                <Text style={styles.footerText}>© 2025 Medical365. All rights reserved.</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Fixed Footer for Desktop */}
                {isDesktop && (
                    <View style={styles.footerRow}>
                        <Text style={styles.footerText}>© 2025 Medical365. All rights reserved.</Text>
                        <View style={styles.footerRight}>
                            <Text style={styles.footerTextRight}>Ver 2.5.1  •  </Text>
                            <View style={styles.securePill}>
                                <Feather name="lock" size={10} color="#059669" style={{marginRight: 4}} />
                                <Text style={styles.securePillText}>Secure</Text>
                            </View>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f0fdfa', // Light cyan background
    },
    container: {
        flex: 1,
    },
    layout: {
        flex: 1,
        flexDirection: 'row',
    },
    
    // LEFT COLUMN (Visual & Branding)
    leftColumn: {
        flex: 1.2,
        backgroundColor: '#f4fafb',
        padding: 48,
        position: 'relative',
        justifyContent: 'space-between',
    },
    dotGridOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: 0.05,
        backgroundColor: 'transparent',
    },
    leftContent: {
        zIndex: 10,
        maxWidth: 500,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        height: 35,
        width: 140,
    },
    heroLine1: {
        fontSize: 42,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: -5,
    },
    heroLine2: {
        fontSize: 42,
        fontWeight: '900',
        color: '#0ea5e9',
        marginBottom: 16,
    },
    heroSubtitle: {
        fontSize: 16,
        lineHeight: 24,
        color: '#475569',
        marginBottom: 32,
    },
    featuresStack: {
        gap: 12,
        marginBottom: 40,
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        maxWidth: 250,
    },
    featureIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f0fdfa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
    },
    glowGraphicContainer: {
        position: 'absolute',
        right: -80,
        top: '20%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowCircle: {
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#0ea5e9',
        opacity: 0.15,
        position: 'absolute',
    },
    bottomGraphic: {
        zIndex: 10,
        position: 'relative',
    },
    pulseContainer: {
        marginBottom: 16,
        width: 400,
    },
    trustBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#ffffff',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    trustBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },

    // RIGHT COLUMN (Form Card)
    rightColumnScroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 40,
    },
    mobileCenterForm: {
        alignItems: 'center',
        padding: 20,
    },
    logoMobile: {
        height: 40,
        width: 160,
    },
    formCard: {
        width: '100%',
        maxWidth: 480,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'center',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
    sessionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
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
        flex: 1,
    },
    formTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 8,
    },
    formSubtitle: {
        color: '#64748b',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 24,
    },
    errorBanner: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#fef2f2',
        borderLeftWidth: 4,
        borderLeftColor: '#dc2626',
    },
    errorBannerText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '600',
    },
    formGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: '#f0f7ff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        height: 50,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
        fontWeight: '500',
    },
    passwordInputCustom: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
        fontWeight: '500',
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
    },
    formOptions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 4,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    checkboxActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
    },
    checkboxLabel: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
    },
    forgotLink: {
        fontSize: 13,
        color: '#0284c7',
        fontWeight: '600',
    },
    submitBtn: {
        width: '100%',
        backgroundColor: '#0284c7',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: 24,
    },
    submitBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 15,
    },
    submitBtnLoading: {
        opacity: 0.7,
    },
    securityBox: {
        flexDirection: 'row',
        backgroundColor: '#f0fdfa',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccfbf1',
    },
    securityBoxText: {
        flex: 1,
        fontSize: 12,
        color: '#0d9488',
        fontWeight: '500',
        lineHeight: 18,
    },

    // OTP SCREEN STYLES
    otpScreenContainer: {
        alignItems: 'center',
    },
    otpShieldWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    otpTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8,
    },
    otpBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginBottom: 24,
    },
    otpBadgeText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },
    otpInputsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 4,
        marginVertical: 20,
    },
    otpBox: {
        width: 42,
        height: 50,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        textAlign: 'center',
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    otpBoxFilled: {
        borderColor: '#14b8a6',
        backgroundColor: '#f0fdfa',
        color: '#0f172a',
    },
    otpBoxFocused: {
        borderColor: '#14b8a6',
    },
    resendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    resendText: {
        color: '#64748b',
        fontSize: 14,
    },
    resendTimerText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '500',
    },
    resendLink: {
        color: '#0d9488',
        fontSize: 14,
        fontWeight: '700',
    },
    backToLoginBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingVertical: 10,
    },
    backToLoginText: {
        color: '#0284c7',
        fontSize: 14,
        fontWeight: '600',
    },

    // FOOTER STYLES
    footerRow: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 16,
        backgroundColor: 'transparent',
    },
    mobileFooter: {
        marginTop: 32,
        alignItems: 'center',
    },
    footerText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '500',
    },
    footerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerTextRight: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
    },
    securePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    securePillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#059669',
    },
});

export default CentralAdminLogin;